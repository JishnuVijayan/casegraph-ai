#!/usr/bin/env node
/**
 * Short-lived ap-south-1 EC2 for the public CaseGraph demo app (web+API+Postgres+Caddy).
 * SG: 80/443 world; 22 operator /32 only. Never publish Postgres or TigerGraph.
 * Usage: node infra/aws/ec2-app.mjs <create|status|stop|start|destroy|refresh-ssh>
 */
import {
  KEY, REGION, allowSshFromGroup, assertNoPublicGraphOrDb, aws, defaultVpcSubnet, latestAl2023Ami,
  loadJson, localPath, myIpCidr, refreshInstancePublic, refreshSshCidr, saveJson,
} from './common.mjs';

const STATE = localPath('aws-app-ec2.json');
const TG_STATE = localPath('aws-tg-ec2.json');
const NAME = process.env.CASEGRAPH_APP_NAME || 'casegraph-app-demo';
const TYPE = process.env.CASEGRAPH_APP_INSTANCE_TYPE || 't3.medium';

function loadState() {
  return loadJson(STATE, `No app state at ${STATE}. Run npm run aws:app:create first.`);
}

function create() {
  const cidr = myIpCidr();
  const { vpc, subnet } = defaultVpcSubnet();
  const sg = aws(['ec2', 'create-security-group', '--group-name', `${NAME}-sg`,
    '--description', 'CaseGraph public demo: HTTPS + operator SSH only', '--vpc-id', vpc.VpcId]);
  aws(['ec2', 'authorize-security-group-ingress', '--group-id', sg.GroupId, '--protocol', 'tcp', '--port', '22', '--cidr', cidr]);
  aws(['ec2', 'authorize-security-group-ingress', '--group-id', sg.GroupId, '--protocol', 'tcp', '--port', '80', '--cidr', '0.0.0.0/0']);
  aws(['ec2', 'authorize-security-group-ingress', '--group-id', sg.GroupId, '--protocol', 'tcp', '--port', '443', '--cidr', '0.0.0.0/0']);
  assertNoPublicGraphOrDb(sg.GroupId);

  const imageId = latestAl2023Ami();
  const run = aws(['ec2', 'run-instances',
    '--image-id', imageId,
    '--instance-type', TYPE,
    '--key-name', KEY,
    '--security-group-ids', sg.GroupId,
    '--subnet-id', subnet.SubnetId,
    '--block-device-mappings', JSON.stringify([{ DeviceName: '/dev/xvda', Ebs: { VolumeSize: 30, VolumeType: 'gp3', DeleteOnTermination: true, Encrypted: true } }]),
    '--tag-specifications', `ResourceType=instance,Tags=[{Key=Name,Value=${NAME}},{Key=casegraph,Value=app-demo}]`,
    '--count', '1',
  ]);
  const instanceId = run.Instances[0].InstanceId;
  aws(['ec2', 'wait', 'instance-running', '--instance-ids', instanceId]);
  let state = {
    region: REGION, instanceId, securityGroupId: sg.GroupId, keyName: KEY, createdAt: new Date().toISOString(),
  };
  state = refreshInstancePublic(state);
  saveJson(STATE, state);

  // Allow this app SG to SSH into TigerGraph (for the localhost 14240 tunnel). Never open 14240.
  if (existsTg()) {
    const tg = loadJson(TG_STATE);
    allowSshFromGroup(tg.securityGroupId, sg.GroupId);
    assertNoPublicGraphOrDb(tg.securityGroupId);
  }

  console.log(JSON.stringify({
    status: 'CREATED',
    instanceId: state.instanceId,
    publicDns: state.publicDns,
    publicIp: state.publicIp,
    securityGroupId: state.securityGroupId,
    sshCidr: cidr,
    next: [
      'Create DuckDNS host + .local/duckdns.token and .local/duckdns.domain',
      'npm run aws:demo:bootstrap  # clone from GitHub, install Caddy/Postgres/API',
      'npm run aws:demo:start',
    ],
    note: 'Only ports 80/443 are public. Postgres and TigerGraph stay private. Budget hard stop $20.',
  }, null, 2));
}

function existsTg() {
  try { loadJson(TG_STATE); return true; } catch { return false; }
}

function status() {
  const state = refreshInstancePublic(loadState());
  saveJson(STATE, { ...loadState(), ...state, state: undefined });
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
  try { aws(['ec2', 'delete-security-group', '--group-id', state.securityGroupId]); } catch { /* may still be attached */ }
  saveJson(STATE, { ...state, terminatedAt: new Date().toISOString() });
  console.log(JSON.stringify({ status: 'TERMINATING', instanceId: state.instanceId }, null, 2));
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
  else if (action === 'refresh-ssh') refreshSsh();
  else throw new Error('Use create|status|stop|start|destroy|refresh-ssh');
} catch (error) {
  console.error(JSON.stringify({ status: 'FAILED', reason: error.message }, null, 2));
  process.exitCode = 1;
}
