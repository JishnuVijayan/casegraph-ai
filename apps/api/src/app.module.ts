import { Controller, Get, Module } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

@Controller('health')
class HealthController {
  @Get('live')
  live() {
    return {
      data: { status: 'ok', scope: 'process-only', mode: 'local-synthetic' },
      requestId: randomUUID(),
    };
  }
}

@Module({ controllers: [HealthController] })
export class AppModule {}
