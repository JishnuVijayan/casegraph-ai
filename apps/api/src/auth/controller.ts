import { Body, Controller, ForbiddenException, Get, HttpCode, Post, Req } from '@nestjs/common';
import { IsIn, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiRequest, envelope } from '../common/http';
import { DemoConfig } from './config';
import { Public, Roles } from './guards';
import { isAllowedDemoOrigin } from './origins';
import { Sessions } from './sessions';
import { AccessStore } from './store';

export class DemoLogin {
  @IsIn(['synthetic-victim-a', 'synthetic-victim-b', 'synthetic-analyst'])
  demoSubject!: string;
}

export class IntakeLogin {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 80) displayName!: string;
  @Transform(({ value }) => typeof value === 'string' ? value.replace(/\D/g, '') : value)
  @Matches(/^[6-9]\d{9}$/, { message: 'mobile must be a 10-digit Indian number' })
  mobile!: string;
}

@Controller('auth')
@Roles('victim', 'analyst')
export class AuthController {
  constructor(private readonly config: DemoConfig, private readonly store: AccessStore, private readonly sessions: Sessions) {}

  private assertLocalDemo(request: ApiRequest) {
    if (!this.config.enabled) throw new ForbiddenException();
    // Bearer sessions do not use cookies; reject cross-site demo sign-in requests too.
    // PUBLIC_ORIGIN (exact https host) is allowed for the secured DuckDNS public demo.
    if (request.headers['sec-fetch-site'] === 'cross-site' ||
      !isAllowedDemoOrigin(request.headers.origin)) throw new ForbiddenException();
    this.sessions.throttle();
  }

  @Public()
  @Post('demo')
  @HttpCode(200)
  async login(@Body() dto: DemoLogin, @Req() request: ApiRequest) {
    this.assertLocalDemo(request);
    const fixture = this.store.fixtures.users.find((user) => user.demoSubject === dto.demoSubject)!;
    const actor = await this.store.actor(fixture.id!);
    if (!actor) throw new ForbiddenException();
    await this.store.audit(actor, 'DEMO_LOGIN', 'user', actor.id, request.requestId);
    return envelope(request, { ...this.sessions.issue(actor.id), user: actor });
  }

  /** Name + mobile sign-in for people filing a complaint. Not OTP-verified. */
  @Public()
  @Post('intake')
  @HttpCode(200)
  async intake(@Body() dto: IntakeLogin, @Req() request: ApiRequest) {
    this.assertLocalDemo(request);
    const actor = await this.store.upsertIntakeVictim(dto.displayName, dto.mobile);
    await this.store.audit(actor, 'INTAKE_LOGIN', 'user', actor.id, request.requestId);
    return envelope(request, { ...this.sessions.issue(actor.id), user: actor });
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
