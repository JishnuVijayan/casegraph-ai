import { inArray } from 'drizzle-orm';
import { Database } from './connection';
import { loadFixtures } from './fixtures';
import { organizations, users, cases, caseAccessGrants, claims, timelineEvents, eventClaims } from './schema';

export async function seedSynthetic(db: Database) {
  const fixtures = loadFixtures();
  const createdAt = new Date('2026-10-28T00:00:00Z');
  await db.transaction(async (tx) => {
    // Do not silently adopt a non-synthetic row colliding with a fixture identity.
    const existing = [
      ...await tx.select({ synthetic: organizations.synthetic }).from(organizations).where(inArray(organizations.id, [fixtures.organization.id!])),
      ...await tx.select({ synthetic: users.synthetic }).from(users).where(inArray(users.id, fixtures.users.map((row) => row.id!))),
      ...await tx.select({ synthetic: cases.synthetic }).from(cases).where(inArray(cases.id, fixtures.cases.map((row) => row.id!))),
    ];
    if (existing.some((row) => !row.synthetic)) throw new Error('Seed identity collision with a non-synthetic record.');
    await tx.insert(organizations).values({ ...fixtures.organization, createdAt }).onConflictDoNothing({ target: organizations.id });
    await tx.insert(users).values(fixtures.users.map((row) => ({ ...row, createdAt }))).onConflictDoNothing({ target: users.id });
    await tx.insert(cases).values(fixtures.cases.map((row) => ({ id: row.id, ownerId: row.ownerId, organizationId: row.organizationId, status: row.status, category: row.category, title: row.title, synthetic: row.synthetic, createdAt, updatedAt: createdAt })))
      .onConflictDoNothing({ target: cases.id });
    await tx.insert(caseAccessGrants).values(fixtures.grants.map((row) => ({
      ...row, createdAt, revokedAt: row.revokedAt ? new Date(row.revokedAt) : null,
      expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
    }))).onConflictDoNothing({ target: caseAccessGrants.id });

    // Optional recollection-only enrichment for denser officer demos (insert-only).
    for (const row of fixtures.enrichment ?? []) {
      await tx.insert(claims).values(row.claims.map((claim) => ({
        id: claim.id, caseId: row.caseId, type: claim.type, rawValue: claim.rawValue,
        sourceKind: claim.sourceKind as 'VICTIM_RECOLLECTION', verificationStatus: 'UNVERIFIED' as const, createdAt,
      }))).onConflictDoNothing({ target: claims.id });
      await tx.insert(timelineEvents).values({
        id: row.event.id, caseId: row.caseId, eventType: row.event.eventType,
        occurredAt: new Date(row.event.occurredAt), precision: row.event.precision,
        uncertainty: row.event.uncertainty, createdAt,
      }).onConflictDoNothing({ target: timelineEvents.id });
      await tx.insert(eventClaims).values(row.claims.map((claim) => ({
        caseId: row.caseId, eventId: row.event.id, claimId: claim.id,
      }))).onConflictDoNothing();
    }
  });
}
