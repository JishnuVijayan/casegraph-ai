import { Body, Controller, ForbiddenException, Get, HttpCode, Post, Req } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { ApiRequest, envelope } from '../common/http';
import { DemoConfig } from './config';
import { Public, Roles } from './guards';
import { Sessions } from './sessions';
import { AccessStore } from './store';

export class DemoLogin {
  @IsIn(['synthetic-victim-a', 'synthetic-victim-b', 'synthetic-analyst'])
  demoSubject!: string;
}
@Controller('auth')
@Roles('victim', 'analyst')
export class AuthController {
  constructor(private readonly config: DemoConfig, private readonly store: AccessStore, private readonly sessions: Sessions) {}

  @Public()
  @Post('demo')
  @HttpCode(200)
  async login(@Body() dto: DemoLogin, @Req() request: ApiRequest) {
    if (!this.config.enabled) throw new ForbiddenException();
    // Bearer sessions do not use cookies; reject cross-site demo sign-in requests too.
    if (request.headers['sec-fetch-site'] === 'cross-site' ||
      (request.headers.origin && !/^http:\/\/(127\.0\.0\.1|localhost):(5173|3000|15173)$/.test(request.headers.origin))) throw new ForbiddenException();
    this.sessions.throttle();
    const fixture = this.store.fixtures.users.find((user) => user.demoSubject === dto.demoSubject)!;
    const actor = await this.store.actor(fixture.id!);
    if (!actor) throw new ForbiddenException();
    await this.store.audit(actor, 'DEMO_LOGIN', 'user', actor.id, request.requestId);
    return envelope(request, { ...this.sessions.issue(actor.id), user: actor, mode: 'LOCAL_SYNTHETIC_DEMO' });
  }
  @Get('me')
  me(@Req() request: ApiRequest) { return envelope(request, request.actor); }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: ApiRequest) {
    this.sessions.revoke(request.sessionDigest!);
    await this.store.audit(request.actor!, 'DEMO_LOGOUT', 'user', request.actor!.id, request.requestId);
    return envelope(request, { signedOut: true });
  }
}
