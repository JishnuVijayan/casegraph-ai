import { Injectable } from '@nestjs/common';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

@Injectable()
export class DemoConfig {
  readonly enabled: boolean;
  readonly database?: { port: number; password: string };
  readonly ttlMs = 30 * 60 * 1000;

  constructor() {
    const path = resolve(__dirname, '../../../../.env');
    let file: Record<string, string | undefined> = {};
    if (existsSync(path)) {
      const stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new Error('Local .env must be a regular owner-only file.');
      file = parseEnv(readFileSync(path, 'utf8'));
    }
    const mode = process.env.DEMO_MODE ?? file.DEMO_MODE ?? 'false';
    if (!['true', 'false'].includes(mode)) throw new Error('DEMO_MODE must be true or false.');
    this.enabled = mode === 'true';
    if (this.enabled && process.env.NODE_ENV === 'production') throw new Error('Demo authentication cannot run in production.');
    if (this.enabled) {
      const port = Number(file.POSTGRES_PORT ?? '55432');
      const password = file.POSTGRES_PASSWORD ?? '';
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(password) || !Number.isInteger(port) || port < 1024 || port > 65535) {
        throw new Error('Demo mode requires validated local PostgreSQL configuration. Run infra:init first.');
      }
      this.database = { port, password };
    }
  }
}
