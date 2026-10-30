#!/usr/bin/env node
/**
 * Short-lived ap-south-1 EC2 helper for TigerGraph Community (x86_64).
 * Requires AWS CLI configured. Never prints secrets. Stop when idle — $20 hard cap.
 *
 * Usage: node infra/aws/ec2-tigergraph.mjs <create|status|stop|start|destroy|tunnel-hint>
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { root } from '../local.mjs';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const STATE = join(root, '.local', 'aws-tg-ec2.json');
const NAME = process.env.CASEGRAPH_TG_NAME || 'casegraph-tg-demo';
const KEY = process.env.CASEGRAPH_TG_KEY_NAME || 'casegraph-tg-aps1';
const TYPE = process.env.CASEGRAPH_TG_INSTANCE_TYPE || 't3.xlarge';

function aws(args) {
  const result = spawnSync('aws', [...args, '--region', REGION, '--output', 'json'], {
    encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error) throw new Error('AWS CLI is not installed or not on PATH. Install AWS CLI v2 and run aws configure.');
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'aws command failed').trim().slice(0, 400));
  const text = (result.stdout || '').trim();
  return text ? JSON.parse(text) : null;
}

function loadState() {
  if (!existsSync(STATE)) throw new Error(`No state at ${STATE}. Run create first.`);
  return JSON.parse(readFileSync(STATE, 'utf8'));
}

function saveState(state) {
  mkdirSync(join(root, '.local'), { recursive: true });
  writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

function myIp() {
  const override = process.env.CASEGRAPH_SSH_CIDR;
  if (override) return override;
  const curl = spawnSync('curl', ['-4', '-s', '--max-time', '8', 'https://checkip.amazonaws.com'], { encoding: 'utf8' });
  if (curl.status !== 0 || !curl.stdout?.trim()) throw new Error('Could not detect public IP. Set CASEGRAPH_SSH_CIDR=x.x.x.x/32');
  return `${curl.stdout.trim()}/32`;
}

function create() {
  const cidr = myIp();
  const vpc = aws(['ec2', 'describe-vpcs', '--filters', 'Name=isDefault,Values=true']).Vpcs?.[0];
  if (!vpc) throw new Error('No default VPC in region.');
  const subnet = aws(['ec2', 'describe-subnets', '--filters', `Name=vpc-id,Values=${vpc.VpcId}`]).Subnets?.[0];
  if (!subnet) throw new Error('No subnet in default VPC.');
  const sg = aws(['ec2', 'create-security-group', '--group-name', `${NAME}-sg`, '--description', 'CaseGraph TG SSH only', '--vpc-id', vpc.VpcId]);
  aws(['ec2', 'authorize-security-group-ingress', '--group-id', sg.GroupId, '--protocol', 'tcp', '--port', '22', '--cidr', cidr]);
  // Amazon Linux 2023 x86_64
  const image = aws(['ec2', 'describe-images', '--owners', 'amazon', '--filters',
    'Name=name,Values=al2023-ami-*-x86_64', 'Name=state,Values=available',
    '--query', 'sort_by(Images,&CreationDate)[-1].ImageId']);
  const imageId = typeof image === 'string' ? image : image;
  const run = aws(['ec2', 'run-instances',
    '--image-id', imageId,
    '--instance-type', TYPE,
    '--key-name', KEY,
    '--security-group-ids', sg.GroupId,
    '--subnet-id', subnet.SubnetId,
    '--block-device-mappings', JSON.stringify([{ DeviceName: '/dev/xvda', Ebs: { VolumeSize: 40, VolumeType: 'gp3', DeleteOnTermination: true } }]),
    '--tag-specifications', `ResourceType=instance,Tags=[{Key=Name,Value=${NAME}},{Key=casegraph,Value=tigergraph-demo}]`,
    '--count', '1',
  ]);
  const instanceId = run.Instances[0].InstanceId;
  aws(['ec2', 'wait', 'instance-running', '--instance-ids', instanceId]);
  const desc = aws(['ec2', 'describe-instances', '--instance-ids', instanceId]);
  const publicDns = desc.Reservations[0].Instances[0].PublicDnsName;
  const publicIp = desc.Reservations[0].Instances[0].PublicIpAddress;
  const state = { region: REGION, instanceId, securityGroupId: sg.GroupId, publicDns, publicIp, keyName: KEY, createdAt: new Date().toISOString() };
  saveState(state);
  console.log(JSON.stringify({
    status: 'CREATED',
    ...state,
    next: [
      `ssh -i ~/.ssh/${KEY}.pem ec2-user@${publicDns || publicIp}`,
      'Install Docker; follow infra/TIGERGRAPH.md + graph/README.md (Community 4.2.5).',
      `ssh -N -L 14240:127.0.0.1:14240 ec2-user@${publicDns || publicIp}`,
      'npm run graph:verify-live',
      'npm run aws:tg:stop when idle',
    ],
    note: 'Port 14240 is NOT public. Budget hard stop $20.',
  }, null, 2));
}

function status() {
  const state = loadState();
  const desc = aws(['ec2', 'describe-instances', '--instance-ids', state.instanceId]);
  const inst = desc.Reservations?.[0]?.Instances?.[0];
  console.log(JSON.stringify({
    instanceId: state.instanceId,
    state: inst?.State?.Name ?? 'unknown',
    publicDns: inst?.PublicDnsName ?? state.publicDns,
    publicIp: inst?.PublicIpAddress ?? state.publicIp,
    region: REGION,
  }, null, 2));
}

function stop() {
  const state = loadState();
  aws(['ec2', 'stop-instances', '--instance-ids', state.instanceId]);
  console.log(JSON.stringify({ status: 'STOPPING', instanceId: state.instanceId, tip: 'EBS still bills a little; destroy after demo.' }, null, 2));
}

function start() {
  const state = loadState();
  aws(['ec2', 'start-instances', '--instance-ids', state.instanceId]);
  aws(['ec2', 'wait', 'instance-running', '--instance-ids', state.instanceId]);
  const desc = aws(['ec2', 'describe-instances', '--instance-ids', state.instanceId]);
  const inst = desc.Reservations[0].Instances[0];
  state.publicDns = inst.PublicDnsName;
  state.publicIp = inst.PublicIpAddress;
  saveState(state);
  console.log(JSON.stringify({ status: 'RUNNING', ...state }, null, 2));
}

function destroy() {
  const state = loadState();
  aws(['ec2', 'terminate-instances', '--instance-ids', state.instanceId]);
  try { aws(['ec2', 'delete-security-group', '--group-id', state.securityGroupId]); } catch { /* may still be attached briefly */ }
  writeFileSync(STATE, `${JSON.stringify({ ...state, terminatedAt: new Date().toISOString() }, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ status: 'TERMINATING', instanceId: state.instanceId, securityGroupId: state.securityGroupId }, null, 2));
}

function tunnelHint() {
  const state = loadState();
  const host = state.publicDns || state.publicIp;
  console.log(JSON.stringify({
    tunnel: `ssh -N -L 14240:127.0.0.1:14240 -i ~/.ssh/${state.keyName}.pem ec2-user@${host}`,
    verify: 'npm run graph:verify-live',
    app: 'TIGERGRAPH_ENABLED=true TIGERGRAPH_LOCAL_PORT=14240 npm run dev:demo',
  }, null, 2));
}

const action = process.argv[2];
try {
  if (action === 'create') create();
  else if (action === 'status') status();
  else if (action === 'stop') stop();
  else if (action === 'start') start();
  else if (action === 'destroy') destroy();
  else if (action === 'tunnel-hint') tunnelHint();
  else throw new Error('Use create|status|stop|start|destroy|tunnel-hint');
} catch (error) {
  console.error(JSON.stringify({ status: 'FAILED', reason: error.message }, null, 2));
  process.exitCode = 1;
}
