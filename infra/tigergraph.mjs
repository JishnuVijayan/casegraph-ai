import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { root } from './local.mjs';
import { assessGraphHost, parseGraphHealth } from './tigergraph-lib.mjs';
const compose = ['compose', '--project-name', 'casegraph-graph', '-f', join(root, 'infra/tigergraph.compose.yaml')];
function docker(args, maxBuffer = 16384) {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 20000, maxBuffer, cwd: root });
  if (result.error || result.status !== 0) throw new Error('Local Docker command unavailable');
  return result.stdout.trim();
}
function preflight() {
  const info = JSON.parse(docker(['info', '--format', '{{json .}}'], 1024 * 1024));
  return { ...assessGraphHost(info), architecture: info.Architecture, cpus: info.NCPU, memoryBytes: info.MemTotal };
}
try {
  const action = process.argv[2];
  if (action === 'config') {
    docker([...compose, 'config', '--quiet']);
    console.log(JSON.stringify({ status: 'CONFIG_VALID', runtimeVerified: false }));
  } else if (action === 'preflight') {
    const result = preflight(); console.log(JSON.stringify(result));
    if (result.status !== 'HOST_ELIGIBLE') process.exitCode = 1;
  } else if (action === 'health') {
    const eligibility = preflight();
    if (eligibility.status !== 'HOST_ELIGIBLE') { console.log(JSON.stringify(eligibility)); process.exitCode = 1; }
    else {
      const ping = docker([...compose, 'exec', '-T', '--user', 'tigergraph', 'tigergraph', 'curl', '--fail', '--silent', '--show-error', '--max-time', '5', '--max-filesize', '4096', 'http://127.0.0.1:14240/api/ping'], 4096);
      const version = docker([...compose, 'exec', '-T', '--user', 'tigergraph', 'tigergraph', 'bash', '-lc', 'gsql version']);
      console.log(JSON.stringify(parseGraphHealth(ping, version)));
    }
  } else throw new Error('Use preflight, config or health');
} catch {
  // Do not print Docker environment, service output or credentials.
  console.log(JSON.stringify({ status: 'UNAVAILABLE', ready: false, reason: 'CHECK_LOCAL_DOCKER_AND_TIGERGRAPH_SETUP' }));
  process.exitCode = 1;
}
