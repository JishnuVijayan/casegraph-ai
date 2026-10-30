#!/usr/bin/env node
/** Shared AWS helpers for CaseGraph demo EC2 scripts. Never prints secrets. */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from '../local.mjs';

export const REGION = process.env.AWS_REGION || 'ap-south-1';
export const KEY = process.env.CASEGRAPH_TG_KEY_NAME || 'casegraph-tg-aps1';

export function localPath(...parts) {
  return join(root, '.local', ...parts);
}

export function pemPath(keyName = KEY) {
  const candidates = [
    localPath(`${keyName}.pem`),
    join(process.env.HOME || '', '.ssh', `${keyName}.pem`),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error(`SSH key not found. Place ${keyName}.pem in .local/ (mode 0600).`);
}

export function aws(args) {
  const result = spawnSync('aws', [...args, '--region', REGION, '--output', 'json'], {
    encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
  });
  if (result.error) throw new Error('AWS CLI is not installed or not on PATH. Install AWS CLI v2 and run aws configure.');
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'aws command failed').trim().slice(0, 400));
  const text = (result.stdout || '').trim();
  return text ? JSON.parse(text) : null;
}

export function myIpCidr() {
  const override = process.env.CASEGRAPH_SSH_CIDR;
  if (override) {
    if (!/^\d{1,3}(\.\d{1,3}){3}\/32$/.test(override)) throw new Error('CASEGRAPH_SSH_CIDR must be x.x.x.x/32');
    return override;
  }
  const curl = spawnSync('curl', ['-4', '-s', '--max-time', '8', 'https://checkip.amazonaws.com'], { encoding: 'utf8' });
  if (curl.status !== 0 || !curl.stdout?.trim()) throw new Error('Could not detect public IP. Set CASEGRAPH_SSH_CIDR=x.x.x.x/32');
  return `${curl.stdout.trim()}/32`;
}

export function loadJson(path, hint) {
  if (!existsSync(path)) throw new Error(hint || `Missing ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function saveJson(path, data) {
  mkdirSync(join(root, '.local'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  try { chmodSync(path, 0o600); } catch { /* best effort */ }
}

export function readSecretFile(path, label) {
  if (!existsSync(path)) throw new Error(`Missing ${label} at ${path} (mode 0600, gitignored).`);
  const value = readFileSync(path, 'utf8').trim();
  if (!value) throw new Error(`${label} is empty.`);
  return value;
}

export function latestAl2023Ami() {
  const image = aws(['ec2', 'describe-images', '--owners', 'amazon', '--filters',
    'Name=name,Values=al2023-ami-*-x86_64', 'Name=state,Values=available',
    '--query', 'sort_by(Images,&CreationDate)[-1].ImageId']);
  return typeof image === 'string' ? image : image;
}

export function defaultVpcSubnet() {
  const vpc = aws(['ec2', 'describe-vpcs', '--filters', 'Name=isDefault,Values=true']).Vpcs?.[0];
  if (!vpc) throw new Error('No default VPC in region.');
  const subnet = aws(['ec2', 'describe-subnets', '--filters', `Name=vpc-id,Values=${vpc.VpcId}`]).Subnets?.[0];
  if (!subnet) throw new Error('No subnet in default VPC.');
  return { vpc, subnet };
}

export function refreshInstancePublic(state) {
  const desc = aws(['ec2', 'describe-instances', '--instance-ids', state.instanceId]);
  const inst = desc.Reservations?.[0]?.Instances?.[0];
  if (!inst) throw new Error(`Instance ${state.instanceId} not found.`);
  return {
    ...state,
    state: inst.State?.Name,
    publicDns: inst.PublicDnsName || '',
    publicIp: inst.PublicIpAddress || '',
    privateIp: inst.PrivateIpAddress || state.privateIp || '',
  };
}

/** Replace SSH/22 CIDR rules with the current operator /32. Keeps non-22 rules. */
export function refreshSshCidr(securityGroupId, cidr = myIpCidr()) {
  const sg = aws(['ec2', 'describe-security-groups', '--group-ids', securityGroupId]).SecurityGroups?.[0];
  if (!sg) throw new Error(`Security group ${securityGroupId} not found.`);
  for (const perm of sg.IpPermissions || []) {
    if (perm.FromPort !== 22 || perm.ToPort !== 22 || perm.IpProtocol !== 'tcp') continue;
    for (const range of perm.IpRanges || []) {
      if (!range.CidrIp) continue;
      try {
        aws(['ec2', 'revoke-security-group-ingress', '--group-id', securityGroupId, '--protocol', 'tcp', '--port', '22', '--cidr', range.CidrIp]);
      } catch { /* already gone */ }
    }
  }
  aws(['ec2', 'authorize-security-group-ingress', '--group-id', securityGroupId, '--protocol', 'tcp', '--port', '22', '--cidr', cidr]);
  return cidr;
}

/** Ensure no inbound rule opens TigerGraph REST (14240) or Postgres. */
export function assertNoPublicGraphOrDb(securityGroupId) {
  const sg = aws(['ec2', 'describe-security-groups', '--group-ids', securityGroupId]).SecurityGroups?.[0];
  for (const perm of sg?.IpPermissions || []) {
    const from = perm.FromPort ?? 0;
    const to = perm.ToPort ?? 0;
    for (let port of [14240, 5432, 9000]) {
      if (from <= port && to >= port) {
        throw new Error(`Security group ${securityGroupId} must not expose port ${port}. Revoke that rule before continuing.`);
      }
    }
  }
}

export function allowSshFromGroup(targetSgId, sourceSgId) {
  try {
    aws(['ec2', 'authorize-security-group-ingress', '--group-id', targetSgId, '--protocol', 'tcp', '--port', '22',
      '--source-group', sourceSgId]);
  } catch (error) {
    if (!/already exists|InvalidPermission\.Duplicate/i.test(String(error.message))) throw error;
  }
}

export function ssh(host, pem, remoteCommand, opts = {}) {
  const args = ['-i', pem, '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=20',
    '-o', 'BatchMode=yes', `ec2-user@${host}`];
  if (remoteCommand) args.push(remoteCommand);
  const result = spawnSync('ssh', args, {
    encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    stdio: opts.stdio || 'pipe',
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || 'ssh failed').trim().slice(0, 500));
  }
  return result.stdout || '';
}

export function scpTo(host, pem, localFile, remotePath) {
  const result = spawnSync('scp', ['-i', pem, '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=20',
    localFile, `ec2-user@${host}:${remotePath}`], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'scp failed').trim().slice(0, 400));
}
