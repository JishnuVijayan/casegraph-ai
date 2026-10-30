// Installs the v2 "case network" graph (CaseGraphV2) + similar_cases query on the EC2 TigerGraph host.
// Local-only helper: uses .local/aws-tg-ec2.json, the SSH key and the DB password file. Prints no secrets.
// Existing CaseGraphDemoV1 is never touched; re-running only replaces the query.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from '../infra/local.mjs';

const key = join(root, '.local/casegraph-tg-aps1.pem'), pw = join(root, '.local/tigergraph-db.password');
const meta = join(root, '.local/aws-tg-ec2.json');
const files = ['schema_v2.gsql', 'similar_cases.gsql'].map((f) => join(root, 'graph/gsql', f));
try {
  for (const f of [key, pw, meta, ...files]) if (!existsSync(f)) throw new Error('Missing local file for install.');
  const host = `ec2-user@${JSON.parse(readFileSync(meta, 'utf8')).publicDns}`;
  if (!/^ec2-user@[a-z0-9.-]+\.amazonaws\.com$/.test(host)) throw new Error('Instance is not running; run npm run aws:tg:start first.');
  const ssh = ['-i', key, '-o', 'ConnectTimeout=20'];
  const run = (cmd, args, input) => spawnSync(cmd, args, { encoding: 'utf8', input, timeout: 240_000 });
  for (const f of [...files, pw]) {
    const target = f === pw ? '/tmp/tg-db-pw' : `~/casegraph/bundle/${f.split('/').pop()}`;
    const r = run('scp', [...ssh, f, `${host}:${target}`]);
    if (r.status !== 0) throw new Error('Copy to the graph host failed (is your IP allowed on the SSH security group?).');
  }
  const remote = `set -euo pipefail; chmod 600 /tmp/tg-db-pw
COMPOSE='docker compose -p casegraph-graph -f /home/ec2-user/casegraph/infra/tigergraph.compose.yaml'
CID=$(sg docker -c "$COMPOSE ps -q tigergraph")
GSQL=/home/tigergraph/tigergraph/app/4.2.5/cmd/gsql
PW=$(tr -d '\\n' </tmp/tg-db-pw)
x() { sg docker -c "$COMPOSE exec -T --user tigergraph -e HOME=/home/tigergraph tigergraph $GSQL -u tigergraph -p $PW $*"; }
for f in schema_v2 similar_cases; do
  sg docker -c "docker cp /home/ec2-user/casegraph/bundle/$f.gsql $CID:/home/tigergraph/casegraph-t10/$f.gsql"
  sg docker -c "$COMPOSE exec -T --user root tigergraph chown tigergraph:tigergraph /home/tigergraph/casegraph-t10/$f.gsql"
done
if x -g CaseGraphV2 ls >/dev/null 2>&1; then echo SCHEMA_EXISTS; else x /home/tigergraph/casegraph-t10/schema_v2.gsql 2>&1 | tail -15; fi
x /home/tigergraph/casegraph-t10/similar_cases.gsql 2>&1 | tail -15
rm -f /tmp/tg-db-pw; echo INSTALL_FINISHED`;
  const r = run('ssh', [...ssh, host, 'bash -s'], remote);
  // Never echo password material or long tokens.
  console.log(`${r.stdout}${r.stderr}`.replace(/-p \S+/g, '-p ***').replace(/[A-Za-z0-9+/=_-]{24,}/g, '***'));
  if (r.status !== 0) throw new Error('Install did not finish.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
