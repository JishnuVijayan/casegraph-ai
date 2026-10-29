import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureHttp } from './common/http';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureHttp(app);
  app.enableShutdownHooks();
  await app.listen(3000, '127.0.0.1');
}

void bootstrap();
