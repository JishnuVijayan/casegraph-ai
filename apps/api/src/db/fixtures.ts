import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { organizations, users, cases, caseAccessGrants } from './schema';

type Grant = Omit<typeof caseAccessGrants.$inferInsert, 'createdAt' | 'revokedAt' | 'expiresAt'> & {
  revokedAt: string | null; expiresAt: string | null;
};
export interface Fixtures {
  label: string;
  organization: typeof organizations.$inferInsert;
  users: (typeof users.$inferInsert)[];
  cases: (typeof cases.$inferInsert & { scenarioNote: string })[];
  grants: Grant[];
}

export function loadFixtures(): Fixtures {
  const fixture: Fixtures = JSON.parse(readFileSync(resolve(__dirname, '../../../../data/synthetic/bootstrap.json'), 'utf8'));
  const ids = new Set<string>();
  const records = [fixture.organization, ...fixture.users, ...fixture.cases, ...fixture.grants];
  for (const record of records) {
    if (!record.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/.test(record.id) || ids.has(record.id)) {
      throw new Error('Invalid or duplicate synthetic fixture ID.');
    }
    ids.add(record.id);
  }
  if (!fixture.label.includes('SYNTHETIC') || fixture.users.length !== 3 || fixture.cases.length !== 20 ||
    [fixture.organization, ...fixture.users, ...fixture.cases].some((record) => record.synthetic !== true)) {
    throw new Error('Expected the explicitly synthetic T02 bootstrap fixture.');
  }
  for (const record of fixture.cases) {
    if (!record.title.startsWith('Synthetic ') || record.status !== 'DRAFT' ||
      !fixture.users.some((user) => user.id === record.ownerId && user.role === 'victim')) {
      throw new Error('Invalid synthetic case ownership or label.');
    }
  }
  for (const grant of fixture.grants) {
    if (grant.organizationId !== fixture.organization.id ||
      !fixture.cases.some((record) => record.id === grant.caseId && record.ownerId === grant.grantedBy)) {
      throw new Error('Invalid synthetic sharing fixture.');
    }
  }
  return fixture;
}
