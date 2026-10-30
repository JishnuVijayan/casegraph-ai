#!/usr/bin/env node
/**
 * One-command public demo control: start/stop both EC2s, DuckDNS, SSH CIDRs, health URL.
 * Secrets stay in gitignored .local/ (never printed).
 *
 * Usage: node infra/aws/demo-control.mjs <start|stop|status|url|bootstrap|duckdns>
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from '../local.mjs';
import {
  KEY, assertNoPublicGraphOrDb, aws, loadJson, localPath, myIpCidr, pemPath,
  readSecretFile, refreshInstancePublic, refreshSshCidr, saveJson, scpTo, ssh,
} from './common.mjs';

const APP_STATE = localPath('aws-app-ec2.json');
const TG_STATE = localPath('aws-tg-ec2.json');
const DUCK_DOMAIN = localPath('duckdns.domain');
const DUCK_TOKEN = localPath('duckdns.token');

function runNode(script, action) {
  const result = spawnSync(process.execPath, [join(root, 'infra', 'aws', script), action], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${script} ${action} failed`).trim().slice(0, 500));
  }
  const text = (result.stdout || '').trim();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function publicHost() {
  return readSecretFile(DUCK_DOMAIN, 'DuckDNS domain').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function publicUrl() {
  return `https://${publicHost()}`;
}

function updateDuckDns(ip) {
  const token = readSecretFile(DUCK_TOKEN, 'DuckDNS token');
  const domain = publicHost().replace(/\.duckdns\.org$/i, '');
  if (!/^[a-z0-9-]+$/i.test(domain)) throw new Error('duckdns.domain must be a DuckDNS hostname like name.duckdns.org');
  const url = `https://www.duckdns.org/update?domains=${encodeURIComponent(domain)}&token=${encodeURIComponent(token)}&ip=${encodeURIComponent(ip)}`;
  const curl = spawnSync('curl', ['-fsS', '--max-time', '15', url], { encoding: 'utf8' });
  if (curl.status !== 0 || !/OK/i.test(curl.stdout || '')) {
    throw new Error(`DuckDNS update failed: ${(curl.stderr || curl.stdout || 'unknown').trim().slice(0, 200)}`);
  }
  return { domain: `${domain}.duckdns.org`, ip };
}

function waitHttps(url, attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    const curl = spawnSync('curl', ['-fsS', '--max-time', '10', '-o', '/dev/null', '-w', '%{http_code}', url], { encoding: 'utf8' });
    const code = (curl.stdout || '').trim();
    if (curl.status === 0 && /^[23]/.test(code)) return code;
    spawnSync('sleep', ['5']);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function ensurePemMode(path) {
  try { chmodSync(path, 0o600); } catch { /* best effort */ }
}

function start() {
  const cidr = myIpCidr();
  console.error(`Operator SSH CIDR ${cidr}`);

  const tg = runNode('ec2-tigergraph.mjs', 'start');
  runNode('ec2-tigergraph.mjs', 'harden-sg');
  const app = runNode('ec2-app.mjs', 'start');

  const appState = refreshInstancePublic(loadJson(APP_STATE));
  saveJson(APP_STATE, appState);
  const tgState = refreshInstancePublic(loadJson(TG_STATE));
  saveJson(TG_STATE, tgState);

  assertNoPublicGraphOrDb(appState.securityGroupId);
  assertNoPublicGraphOrDb(tgState.securityGroupId);
  refreshSshCidr(appState.securityGroupId, cidr);
  refreshSshCidr(tgState.securityGroupId, cidr);

  if (!appState.publicIp) throw new Error('App EC2 has no public IP yet.');
  const duck = updateDuckDns(appState.publicIp);

  // Best-effort: start TigerGraph container if present; restart tunnel + API + Caddy.
  const pem = pemPath(appState.keyName || KEY);
  ensurePemMode(pem);
  try {
    const tgHost = tgState.privateIp || tgState.publicDns || tgState.publicIp;
    ssh(appState.publicIp || appState.publicDns, pem,
      `bash -lc 'echo TG_HOST=${tgHost} | sudo tee /opt/casegraph/secrets/tunnel.env >/dev/null; sudo chmod 600 /opt/casegraph/secrets/tunnel.env; sudo systemctl restart casegraph-tg-tunnel.service casegraph-api.service caddy.service || true'`);
  } catch (error) {
    console.error(JSON.stringify({ warning: 'Remote service restart skipped (bootstrap may be needed)', reason: error.message }));
  }

  try {
    const tgHost = tgState.publicIp || tgState.publicDns;
    ssh(tgHost, pemPath(tgState.keyName || KEY),
      'bash -lc \'sg docker -c "docker start casegraph-graph-tigergraph-1" || true\'');
    // Wait briefly for RESTPP; API can still use ALLOW_DEGRADED if slow.
    for (let i = 0; i < 24; i += 1) {
      const ping = spawnSync('ssh', ['-i', pemPath(tgState.keyName || KEY), '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=15',
        `ec2-user@${tgHost}`, 'curl -fsS --max-time 3 http://127.0.0.1:14240/api/ping'], { encoding: 'utf8' });
      if (ping.status === 0 && /pong/i.test(ping.stdout || '')) break;
      spawnSync('sleep', ['5']);
    }
  } catch (error) {
    console.error(JSON.stringify({ warning: 'Could not start TigerGraph container remotely', reason: error.message }));
  }

  const url = publicUrl();
  let health = null;
  try { health = waitHttps(url); } catch (error) {
    console.error(JSON.stringify({ warning: 'HTTPS not ready yet', reason: error.message, tip: 'Run npm run aws:demo:bootstrap if first deploy' }));
  }

  console.log(JSON.stringify({
    status: 'STARTED',
    url,
    duckdns: duck,
    app: { instanceId: appState.instanceId, publicIp: appState.publicIp, state: appState.state },
    tigergraph: { instanceId: tgState.instanceId, publicIp: tgState.publicIp, state: tgState.state },
    sshCidr: cidr,
    http: health,
    tip: 'When finished: npm run aws:demo:stop',
  }, null, 2));
}

function stop() {
  const app = runNode('ec2-app.mjs', 'stop');
  const tg = runNode('ec2-tigergraph.mjs', 'stop');
  console.log(JSON.stringify({
    status: 'STOPPING',
    app,
    tigergraph: tg,
    tip: 'EBS volumes may still accrue a small charge until destroy.',
  }, null, 2));
}

function status() {
  let app = null;
  let tg = null;
  try { app = runNode('ec2-app.mjs', 'status'); } catch (error) { app = { status: 'FAILED', reason: error.message }; }
  try { tg = runNode('ec2-tigergraph.mjs', 'status'); } catch (error) { tg = { status: 'FAILED', reason: error.message }; }
  let url = null;
  try { url = publicUrl(); } catch { /* domain not configured */ }
  console.log(JSON.stringify({ status: 'OK', url, app, tigergraph: tg }, null, 2));
}

function urlOnly() {
  console.log(JSON.stringify({ url: publicUrl() }, null, 2));
}

function duckdnsOnly() {
  const app = refreshInstancePublic(loadJson(APP_STATE));
  if (!app.publicIp) throw new Error('App instance has no public IP. Start it first.');
  const duck = updateDuckDns(app.publicIp);
  console.log(JSON.stringify({ status: 'DUCKDNS_UPDATED', ...duck, url: publicUrl() }, null, 2));
}

function bootstrap() {
  const hostName = publicHost();
  readSecretFile(DUCK_TOKEN, 'DuckDNS token');
  const appState = refreshInstancePublic(loadJson(APP_STATE, 'Create the app EC2 first: npm run aws:app:create'));
  if (appState.state && appState.state !== 'running') throw new Error('App EC2 must be running. npm run aws:app:start');
  const tgState = refreshInstancePublic(loadJson(TG_STATE, 'TigerGraph state missing. npm run aws:tg:create/start'));
  const pem = pemPath(appState.keyName || KEY);
  ensurePemMode(pem);
  // Prefer IP — public DNS can lag or fail to resolve from some networks.
  const host = appState.publicIp || appState.publicDns;
  if (!host) throw new Error('App EC2 has no public IP.');

  // Prepare secrets directory on remote
  ssh(host, pem, 'bash -lc \'sudo mkdir -p /opt/casegraph/secrets && sudo chown -R ec2-user:ec2-user /opt/casegraph && chmod 700 /opt/casegraph/secrets\'');

  const tmp = localPath('deploy-staging');
  mkdirSync(tmp, { recursive: true });
  writeFileSync(join(tmp, 'duckdns.domain'), `${hostName}\n`, { mode: 0o600 });
  copyFileSync(DUCK_TOKEN, join(tmp, 'duckdns.token'));
  chmodSync(join(tmp, 'duckdns.token'), 0o600);

  const tgPem = pemPath(tgState.keyName || KEY);
  copyFileSync(tgPem, join(tmp, 'tg.pem'));
  chmodSync(join(tmp, 'tg.pem'), 0o600);
  if (existsSync(localPath('tigergraph-app.token'))) {
    copyFileSync(localPath('tigergraph-app.token'), join(tmp, 'tigergraph-app.token'));
    chmodSync(join(tmp, 'tigergraph-app.token'), 0o600);
  }

  const pgPass = process.env.POSTGRES_PASSWORD
    || (existsSync(join(root, '.env')) ? (spawnSync('node', ['-e', `
      import { readFileSync } from 'fs'; import { parseEnv } from 'util';
      const e = parseEnv(readFileSync('.env','utf8'));
      if (!e.POSTGRES_PASSWORD) process.exit(2);
      process.stdout.write(e.POSTGRES_PASSWORD);
    `], { cwd: root, encoding: 'utf8' }).stdout || '') : '');
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(pgPass)) {
    throw new Error('Set a strong POSTGRES_PASSWORD (32–128) in .env or the environment before bootstrap.');
  }

  let awsKey = process.env.AWS_ACCESS_KEY_ID || '';
  let awsSecret = process.env.AWS_SECRET_ACCESS_KEY || '';
  let awsToken = process.env.AWS_SESSION_TOKEN || '';
  // Fall back to `aws configure` shared credentials (never printed).
  if (!awsKey || !awsSecret) {
    const keyR = spawnSync('aws', ['configure', 'get', 'aws_access_key_id'], { encoding: 'utf8' });
    const secretR = spawnSync('aws', ['configure', 'get', 'aws_secret_access_key'], { encoding: 'utf8' });
    if (keyR.status === 0 && secretR.status === 0) {
      awsKey = (keyR.stdout || '').trim();
      awsSecret = (secretR.stdout || '').trim();
    }
  }
  const awsLines = [
    'DEMO_MODE=true',
    'NODE_ENV=production',
    `PUBLIC_ORIGIN=https://${hostName}`,
    `POSTGRES_PASSWORD=${pgPass}`,
    'POSTGRES_PORT=55432',
    `AWS_REGION=${process.env.AWS_REGION || 'ap-south-1'}`,
    'TEXTRACT_ENABLED=true',
    'BEDROCK_ENABLED=true',
    'BEDROCK_MODEL_ID=apac.amazon.nova-pro-v1:0',
    'TIGERGRAPH_ENABLED=true',
    'TIGERGRAPH_LOCAL_PORT=14240',
    'ALLOW_DEGRADED=true',
  ];
  // Server-only credentials for Textract/Bedrock (never VITE_ / never printed). Prefer an IAM instance profile later.
  if (awsKey && awsSecret) {
    awsLines.push(`AWS_ACCESS_KEY_ID=${awsKey}`, `AWS_SECRET_ACCESS_KEY=${awsSecret}`);
    if (awsToken) awsLines.push(`AWS_SESSION_TOKEN=${awsToken}`);
  } else {
    console.error(JSON.stringify({
      warning: 'No AWS credentials found in env or aws configure — Textract/Bedrock on the app EC2 will fail until keys or an instance profile are set',
    }));
  }
  const appEnv = `${awsLines.join('\n')}\n`;
  writeFileSync(join(tmp, 'app.env'), appEnv, { mode: 0o600 });

  const tgHost = tgState.privateIp || tgState.publicDns || tgState.publicIp;
  writeFileSync(join(tmp, 'tunnel.env'), `TG_HOST=${tgHost}\n`, { mode: 0o600 });

  for (const name of ['duckdns.domain', 'duckdns.token', 'tg.pem', 'tigergraph-app.token', 'app.env', 'tunnel.env']) {
    const local = join(tmp, name);
    if (!existsSync(local)) continue;
    scpTo(host, pem, local, `/opt/casegraph/secrets/${name}`);
  }
  ssh(host, pem, 'bash -lc \'chmod 600 /opt/casegraph/secrets/*; chmod 700 /opt/casegraph/secrets\'');

  // Copy install script from local tree (works even before first clone)
  scpTo(host, pem, join(root, 'infra/aws/deploy/install-app.sh'), '/tmp/install-app.sh');
  ssh(host, pem, 'bash -lc \'chmod +x /tmp/install-app.sh && /tmp/install-app.sh\'');

  updateDuckDns(appState.publicIp);
  const url = publicUrl();
  let health = null;
  try { health = waitHttps(url, 40); } catch (error) {
    console.error(JSON.stringify({ warning: 'Bootstrap finished but HTTPS probe failed', reason: error.message }));
  }

  console.log(JSON.stringify({
    status: 'BOOTSTRAPPED',
    url,
    http: health,
    tip: 'Day-to-day: npm run aws:demo:start / npm run aws:demo:stop',
  }, null, 2));
}

const action = process.argv[2];
try {
  if (action === 'start') start();
  else if (action === 'stop') stop();
  else if (action === 'status') status();
  else if (action === 'url') urlOnly();
  else if (action === 'duckdns') duckdnsOnly();
  else if (action === 'bootstrap') bootstrap();
  else throw new Error('Use start|stop|status|url|duckdns|bootstrap');
} catch (error) {
  console.error(JSON.stringify({ status: 'FAILED', reason: error.message }, null, 2));
  process.exitCode = 1;
}
