#!/usr/bin/env node
/**
 * Short-lived ap-south-1 EC2 helper for TigerGraph Community (x86_64).
 * Requires AWS CLI configured. Never prints secrets. Stop when idle — $20 hard cap.
 * Port 14240 must never be public. SSH: operator /32 (+ optional app SG after harden-sg).
 *
 * Usage: node infra/aws/ec2-tigergraph.mjs <create|status|stop|start|destroy|tunnel-hint|harden-sg|refresh-ssh>
 */
import {
  KEY, REGION, allowSshFromGroup, assertNoPublicGraphOrDb, aws, defaultVpcSubnet, latestAl2023Ami,
  loadJson, localPath, myIpCidr, pemPath, refreshInstancePublic, refreshSshCidr, saveJson,
} from './common.mjs';

const STATE = localPath('aws-tg-ec2.json');
const APP_STATE = localPath('aws-app-ec2.json');
const NAME = process.env.CASEGRAPH_TG_NAME || 'casegraph-tg-demo';
const TYPE = process.env.CASEGRAPH_TG_INSTANCE_TYPE || 't3.xlarge';

function loadState() {
  return loadJson(STATE, `No state at ${STATE}. Run create first.`);
}

function create() {
  const cidr = myIpCidr();
  const { vpc, subnet } = defaultVpcSubnet();
  const sg = aws(['ec2', 'create-security-group', '--group-name', `${NAME}-sg`, '--description', 'CaseGraph TG SSH only', '--vpc-id', vpc.VpcId]);
  aws(['ec2', 'authorize-security-group-ingress', '--group-id', sg.GroupId, '--protocol', 'tcp', '--port', '22', '--cidr', cidr]);
  assertNoPublicGraphOrDb(sg.GroupId);
  const imageId = latestAl2023Ami();
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
  let state = { region: REGION, instanceId, securityGroupId: sg.GroupId, keyName: KEY, createdAt: new Date().toISOString() };
  state = refreshInstancePublic(state);
  saveJson(STATE, state);
  console.log(JSON.stringify({
    status: 'CREATED',
    ...state,
    next: [
      `ssh -i ${pemPath(KEY)} ec2-user@${state.publicDns || state.publicIp}`,
      'Install Docker; follow infra/TIGERGRAPH.md + graph/README.md (Community 4.2.5).',
      `ssh -N -L 14240:127.0.0.1:14240 -i ${pemPath(KEY)} ec2-user@${state.publicDns || state.publicIp}`,
      'npm run graph:verify-live',
      'npm run aws:tg:stop when idle',
    ],
    note: 'Port 14240 is NOT public. Budget hard stop $20.',
  }, null, 2));
}

function status() {
  const state = refreshInstancePublic(loadState());
  saveJson(STATE, { ...loadState(), publicDns: state.publicDns, publicIp: state.publicIp, privateIp: state.privateIp });
  assertNoPublicGraphOrDb(state.securityGroupId);
  console.log(JSON.stringify({
    instanceId: state.instanceId,
    state: state.state,
    publicDns: state.publicDns,
    publicIp: state.publicIp,
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
  const next = refreshInstancePublic(state);
  const cidr = refreshSshCidr(next.securityGroupId);
  assertNoPublicGraphOrDb(next.securityGroupId);
  saveJson(STATE, next);
  console.log(JSON.stringify({ status: 'RUNNING', ...next, sshCidr: cidr }, null, 2));
}

function destroy() {
  const state = loadState();
  aws(['ec2', 'terminate-instances', '--instance-ids', state.instanceId]);
  try { aws(['ec2', 'delete-security-group', '--group-id', state.securityGroupId]); } catch { /* may still be attached briefly */ }
  saveJson(STATE, { ...state, terminatedAt: new Date().toISOString() });
  console.log(JSON.stringify({ status: 'TERMINATING', instanceId: state.instanceId, securityGroupId: state.securityGroupId }, null, 2));
}

function tunnelHint() {
  const state = loadState();
  const host = state.publicDns || state.publicIp;
  const key = pemPath(state.keyName || KEY);
  console.log(JSON.stringify({
    tunnel: `ssh -N -L 14240:127.0.0.1:14240 -i ${key} ec2-user@${host}`,
    verify: 'npm run graph:verify-live',
    app: 'TIGERGRAPH_ENABLED=true TIGERGRAPH_LOCAL_PORT=14240 npm run dev:demo',
  }, null, 2));
}

/** Drop any 14240/5432 ingress; refresh operator SSH; allow app SG SSH if present. */
function hardenSg() {
  const state = loadState();
  const sg = aws(['ec2', 'describe-security-groups', '--group-ids', state.securityGroupId]).SecurityGroups?.[0];
  for (const perm of sg?.IpPermissions || []) {
    const from = perm.FromPort ?? 0;
    const to = perm.ToPort ?? 0;
    for (const port of [14240, 5432, 9000]) {
      if (from <= port && to >= port) {
        for (const range of perm.IpRanges || []) {
          if (!range.CidrIp) continue;
          aws(['ec2', 'revoke-security-group-ingress', '--group-id', state.securityGroupId,
            '--ip-permissions', JSON.stringify([{ IpProtocol: perm.IpProtocol, FromPort: perm.FromPort, ToPort: perm.ToPort, IpRanges: [{ CidrIp: range.CidrIp }] }])]);
        }
        for (const pair of perm.UserIdGroupPairs || []) {
          aws(['ec2', 'revoke-security-group-ingress', '--group-id', state.securityGroupId,
            '--ip-permissions', JSON.stringify([{ IpProtocol: perm.IpProtocol, FromPort: perm.FromPort, ToPort: perm.ToPort, UserIdGroupPairs: [{ GroupId: pair.GroupId }] }])]);
        }
      }
    }
  }
  const cidr = refreshSshCidr(state.securityGroupId);
  let appSg = null;
  try {
    const app = loadJson(APP_STATE);
    allowSshFromGroup(state.securityGroupId, app.securityGroupId);
    appSg = app.securityGroupId;
  } catch { /* app not created yet */ }
  assertNoPublicGraphOrDb(state.securityGroupId);
  console.log(JSON.stringify({
    status: 'HARDENED',
    securityGroupId: state.securityGroupId,
    sshCidr: cidr,
    appSecurityGroupId: appSg,
    note: '14240 remains closed; SSH from operator /32 and optional app SG only.',
  }, null, 2));
}

function refreshSsh() {
  const state = loadState();
  const cidr = refreshSshCidr(state.securityGroupId);
  console.log(JSON.stringify({ status: 'SSH_CIDR_UPDATED', securityGroupId: state.securityGroupId, sshCidr: cidr }, null, 2));
}

const action = process.argv[2];
try {
  if (action === 'create') create();
  else if (action === 'status') status();
  else if (action === 'stop') stop();
  else if (action === 'start') start();
  else if (action === 'destroy') destroy();
  else if (action === 'tunnel-hint') tunnelHint();
  else if (action === 'harden-sg') hardenSg();
  else if (action === 'refresh-ssh') refreshSsh();
  else throw new Error('Use create|status|stop|start|destroy|tunnel-hint|harden-sg|refresh-ssh');
} catch (error) {
  console.error(JSON.stringify({ status: 'FAILED', reason: error.message }, null, 2));
  process.exitCode = 1;
}
