import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureHttp } from './common/http';
import { preflightCoreServices } from './common/preflight';

// Local settings (API keys such as SARVAM_API_KEY) come from the git-ignored .env; real environment variables win.
const envFile = resolve(__dirname, '../../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

async function bootstrap() {
  const checks = await preflightCoreServices();
  for (const check of checks) console.log(`[core] ${check.service}: ${check.ok ? 'OK' : 'DOWN'} - ${check.detail}`);
  const down = checks.filter((check) => !check.ok && !check.detail.startsWith('disabled'));
  if (down.length && process.env.ALLOW_DEGRADED !== 'true') {
    console.error(`Core services unavailable: ${down.map((check) => check.service).join(', ')}. Fix them, or set ALLOW_DEGRADED=true to start anyway (graph leads will show unavailable).`);
    process.exit(1);
  }
  const app = await NestFactory.create(AppModule);
  configureHttp(app);
  app.enableShutdownHooks();
  await app.listen(3000, '127.0.0.1');
}

void bootstrap();
