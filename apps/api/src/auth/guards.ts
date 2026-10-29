import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiRequest } from '../common/http';
import { DemoConfig } from './config';
import { Sessions } from './sessions';
import { AccessStore, CasePermission } from './store';

export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: ('victim' | 'analyst')[]) => SetMetadata('roles', roles);
export const RequireCaseScope = (permission: CasePermission) => SetMetadata('casePermission', permission);

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly config: DemoConfig,
    private readonly sessions: Sessions, private readonly store: AccessStore) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('public', [context.getHandler(), context.getClass()])) return true;
    if (!this.config.enabled) throw new ForbiddenException();
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const session = this.sessions.resolve(request.headers.authorization);
    const actor = await this.store.actor(session.userId);
    if (!actor) { this.sessions.revoke(session.digest); throw new UnauthorizedException(); }
    request.actor = actor;
    request.sessionDigest = session.digest;
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>('public', [context.getHandler(), context.getClass()])) return true;
    const roles = this.reflector.getAllAndOverride<string[]>('roles', [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest<ApiRequest>();
    if (!roles?.includes(request.actor!.role)) throw new ForbiddenException();
    return true;
  }
}

@Injectable()
export class CaseScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly store: AccessStore) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const permission = this.reflector.getAllAndOverride<CasePermission>('casePermission', [context.getHandler(), context.getClass()]) ?? 'READ';
    request.caseRecord = await this.store.findCase(request.actor!, String(request.params.caseId), permission);
    return true;
  }
}
