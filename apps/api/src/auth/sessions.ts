import { Injectable, UnauthorizedException, HttpException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DemoConfig } from './config';

@Injectable()
export class Sessions {
  private readonly records = new Map<string, { userId: string; expiresAt: number }>();
  private windowStart = 0;
  private attempts = 0;
  constructor(private readonly config: DemoConfig) {}

  throttle() {
    if (Date.now() - this.windowStart >= 60_000) { this.windowStart = Date.now(); this.attempts = 0; }
    if (++this.attempts > 30) throw new HttpException('Rate limited', 429);
  }
  issue(userId: string) {
    this.prune();
    for (const [key, value] of this.records) if (value.userId === userId) this.records.delete(key);
    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + this.config.ttlMs;
    this.records.set(this.digest(token), { userId, expiresAt });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }
  resolve(header: string | undefined) {
    this.prune();
    if (!header || !/^Bearer [a-f0-9]{64}$/.test(header)) throw new UnauthorizedException();
    const digest = this.digest(header.slice(7));
    const session = this.records.get(digest);
    if (!session) throw new UnauthorizedException();
    return { ...session, digest };
  }
  revoke(digest: string) { this.records.delete(digest); }
  private digest(token: string) { return createHash('sha256').update(token).digest('hex'); }
  private prune() {
    for (const [key, value] of this.records) if (value.expiresAt <= Date.now()) this.records.delete(key);
  }
}
