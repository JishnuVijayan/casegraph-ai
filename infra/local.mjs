import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { lstatSync, mkdirSync, chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const evidenceDirectory = join(root, '.local', 'evidence');

function statIfPresent(path) {
  try { return lstatSync(path); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  }
}

export function privateDirectory(path) {
  const current = statIfPresent(path);
  if (current) {
    if (!current.isDirectory() || current.isSymbolicLink() || (current.mode & 0o777) !== 0o700) {
      throw new Error(`Expected an owner-only real directory: ${path}`);
    }
    return;
  }
  mkdirSync(path, { mode: 0o700 });
  chmodSync(path, 0o700);
}

export function initialize(base = root) {
  privateDirectory(join(base, '.local'));
  privateDirectory(join(base, '.local', 'evidence'));
  const envPath = join(base, '.env');
  if (!statIfPresent(envPath)) {
    writeFileSync(envPath,
      `# Generated local development credentials. Never commit.\nPOSTGRES_PASSWORD=${randomBytes(32).toString('hex')}\nPOSTGRES_PORT=55432\n`,
      { flag: 'wx', mode: 0o600 });
  }
  readConfiguration(base);
}

export function readConfiguration(base = root) {
  const envPath = join(base, '.env');
  const file = statIfPresent(envPath);
  if (!file) throw new Error('Missing .env. Run npm run infra:init first.');
  if (!file.isFile() || file.isSymbolicLink() || (file.mode & 0o077) !== 0) {
    throw new Error('.env must be a regular owner-only file (chmod 600 .env).');
  }
  const values = parseEnv(readFileSync(envPath, 'utf8'));
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(values.POSTGRES_PASSWORD ?? '')) {
    throw new Error('POSTGRES_PASSWORD must contain 32–128 letters, digits, underscores or hyphens. Run infra:init on a new checkout or set a strong local value.');
  }
  const port = Number(values.POSTGRES_PORT ?? '55432');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('POSTGRES_PORT must be an integer between 1024 and 65535.');
  }
  return { POSTGRES_PASSWORD: values.POSTGRES_PASSWORD, POSTGRES_PORT: String(port) };
}

export function compose(args, { capture = false, input } = {}) {
  const config = readConfiguration();
  const result = spawnSync('docker', [
    'compose', '--project-name', 'casegraph-local', '--env-file', join(root, '.env'),
    '-f', join(root, 'infra', 'compose.yaml'), ...args,
  ], {
    cwd: root, env: { ...process.env, ...config }, encoding: 'utf8',
    stdio: capture ? ['pipe', 'pipe', 'pipe'] : 'inherit', input,
    timeout: 180_000,
  });
  if (result.error || result.status !== 0) {
    // Do not print captured Docker configuration, credentials or database output.
    throw new Error(`Docker Compose ${args[0]} failed. Check Docker is running, local configuration and port availability.`);
  }
  return result.stdout?.trim();
}
