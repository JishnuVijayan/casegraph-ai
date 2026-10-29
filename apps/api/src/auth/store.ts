import { BadRequestException, ForbiddenException, HttpException, Inject, Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { connect } from '../db/connection';
import { loadFixtures } from '../db/fixtures';
import { auditEvents, cases, caseAccessGrants, organizations, users } from '../db/schema';
import { Actor } from '../common/http';

export const LOCAL_DATABASE = Symbol('LOCAL_DATABASE');
export type CasePermission = 'READ' | 'INVESTIGATE' | 'OWNER';

@Injectable()
export class AccessStore implements OnModuleDestroy {
  readonly fixtures = loadFixtures();
  constructor(@Inject(LOCAL_DATABASE) private readonly connection: ReturnType<typeof connect> | undefined) {}
  async onModuleDestroy() { await this.connection?.pool.end(); }

  async available<T>(operation: (db: ReturnType<typeof connect>['db']) => Promise<T>): Promise<T> {
    try {
      if (!this.connection) throw new ServiceUnavailableException();
      return await operation(this.connection.db);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    }
  }
  async createCase(actor: Actor, title: string, category: string, requestId: string) {
    if (actor.role !== 'victim') throw new ForbiddenException();
    return this.available((db) => db.transaction(async (tx) => {
      const [row] = await tx.insert(cases).values({ ownerId: actor.id, title: `Synthetic ${title}`, category, synthetic: true }).returning();
      await tx.insert(auditEvents).values({ actorId: actor.id, action: 'CASE_CREATED', resourceType: 'case', resourceId: row.id, requestId });
      return { id: row.id, title: row.title, category: row.category, status: row.status, synthetic: row.synthetic };
    }));
  }
  async actor(id: string): Promise<Actor | undefined> {
    return this.available(async (db) => {
      const [row] = await db.select().from(users).where(eq(users.id, id));
      const fixture = this.fixtures.users.find((user) => user.id === id);
      if (!row || !fixture || !row.synthetic || row.role !== fixture.role || row.demoSubject !== fixture.demoSubject || row.organizationId !== fixture.organizationId) return;
      if (row.organizationId) {
        const [org] = await db.select({ synthetic: organizations.synthetic }).from(organizations).where(eq(organizations.id, row.organizationId));
        if (!org?.synthetic) return;
      }
      return { id: row.id, role: row.role, organizationId: row.organizationId, displayName: row.displayName };
    });
  }
  private permitted(actor: Actor, permission: CasePermission) {
    if (permission === 'INVESTIGATE' && actor.role !== 'analyst') return sql`false`;
    if (permission === 'OWNER' || actor.role === 'victim') {
      return actor.role === 'victim' ? eq(cases.ownerId, actor.id) : sql`false`;
    }
    if (actor.role !== 'analyst' || actor.organizationId !== this.fixtures.organization.id) return sql`false`;
    const scopes = permission === 'INVESTIGATE' ? ['INVESTIGATE' as const] : ['READ' as const, 'INVESTIGATE' as const];
    return sql`exists (select 1 from ${caseAccessGrants} where
      ${caseAccessGrants.caseId} = ${cases.id} and
      ${caseAccessGrants.organizationId} = ${actor.organizationId} and
      ${caseAccessGrants.grantedBy} = ${cases.ownerId} and
      ${inArray(caseAccessGrants.scope, scopes)} and ${caseAccessGrants.revokedAt} is null and
      (${caseAccessGrants.expiresAt} is null or ${caseAccessGrants.expiresAt} > now()))`;
  }
  async findCaseIn(db: Pick<ReturnType<typeof connect>['db'], 'select'>, actor: Actor, caseId: string, permission: CasePermission) {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(caseId)) throw new ForbiddenException();
    const [row] = await db.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.synthetic, true), this.permitted(actor, permission)));
    if (!row) throw new ForbiddenException();
    return row;
  }
  async findCase(actor: Actor, caseId: string, permission: CasePermission) {
    return this.available((db) => this.findCaseIn(db, actor, caseId, permission));
  }
  async investigationCaseIds(actor: Actor) {
    return this.available(async (db) => (await db.select({id:cases.id}).from(cases)
      .where(and(eq(cases.synthetic,true),this.permitted(actor,'INVESTIGATE'))).orderBy(cases.id).limit(21)).map((row)=>row.id));
  }
  async list(actor: Actor) {
    return this.available((db) => db.select({ id: cases.id, title: cases.title, status: cases.status, synthetic: cases.synthetic })
      .from(cases).where(and(eq(cases.synthetic, true), this.permitted(actor, 'READ'))).orderBy(cases.id));
  }
  async audit(actor: Actor, action: string, resourceType: string, resourceId: string, requestId: string) {
    await this.available(async (db) => {
      await db.insert(auditEvents).values({ actorId: actor.id, action, resourceType, resourceId, requestId });
    });
  }
  async grant(actor: Actor, caseId: string, scope: 'READ' | 'INVESTIGATE', organizationId: string, expiresAt: string | undefined, requestId: string) {
    if (organizationId !== this.fixtures.organization.id) throw new BadRequestException();
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) throw new BadRequestException();
    return this.available((db) => db.transaction(async (tx) => {
      const [owned] = await tx.select({ id: cases.id }).from(cases)
        .where(and(eq(cases.id, caseId), eq(cases.ownerId, actor.id), eq(cases.synthetic, true))).for('update');
      if (!owned || actor.role !== 'victim') throw new ForbiddenException();
      const [org] = await tx.select({ id: organizations.id }).from(organizations).where(and(eq(organizations.id, organizationId), eq(organizations.synthetic, true)));
      if (!org) throw new BadRequestException();
      const expiration = expiresAt ? new Date(expiresAt) : null;
      const [grant] = await tx.insert(caseAccessGrants).values({ caseId, scope, organizationId, grantedBy: actor.id, expiresAt: expiration })
        .onConflictDoUpdate({ target: [caseAccessGrants.caseId, caseAccessGrants.organizationId, caseAccessGrants.scope],
          set: { grantedBy: actor.id, revokedAt: null, expiresAt: expiration, createdAt: new Date() } }).returning();
      await tx.insert(auditEvents).values({ actorId: actor.id, action: 'SHARE_GRANTED', resourceType: 'grant', resourceId: grant.id, requestId });
      return grant;
    }));
  }
  async revoke(actor: Actor, caseId: string, grantId: string, requestId: string) {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(grantId)) throw new ForbiddenException();
    return this.available((db) => db.transaction(async (tx) => {
      const [owned] = await tx.select({ id: cases.id }).from(cases)
        .where(and(eq(cases.id, caseId), eq(cases.ownerId, actor.id), eq(cases.synthetic, true))).for('update');
      if (!owned || actor.role !== 'victim') throw new ForbiddenException();
      const [grant] = await tx.update(caseAccessGrants).set({ revokedAt: new Date() })
        .where(and(eq(caseAccessGrants.id, grantId), eq(caseAccessGrants.caseId, caseId))).returning({ id: caseAccessGrants.id });
      if (!grant) throw new ForbiddenException();
      await tx.insert(auditEvents).values({ actorId: actor.id, action: 'SHARE_REVOKED', resourceType: 'grant', resourceId: grant.id, requestId });
      return { id: grant.id, revoked: true };
    }));
  }
}
