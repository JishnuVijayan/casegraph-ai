import { loadFixtures } from '../src/db/fixtures';

describe('synthetic bootstrap fixtures', () => {
  it('contains fictional labels, 200 owned cases and separated roles', () => {
    const fixture = loadFixtures();
    expect(fixture.organization.name).toContain('Fictional');
    expect(fixture.cases).toHaveLength(200);
    expect(fixture.users.filter((user) => user.role === 'victim')).toHaveLength(2);
    expect(fixture.users.filter((user) => user.role === 'analyst')).toHaveLength(1);
    expect(fixture.cases.every((row) => row.organizationId === null)).toBe(true);
  });
  it('includes active, revoked, expired, never-shared and older officer-inbox grants', () => {
    const fixture = loadFixtures();
    expect(fixture.grants.filter((row) => row.revokedAt)).toHaveLength(1);
    expect(fixture.grants.filter((row) => row.expiresAt)).toHaveLength(1);
    expect(fixture.grants.filter((row) => !row.revokedAt && !row.expiresAt).length).toBeGreaterThan(40);
    expect(fixture.cases.filter((row) => !fixture.grants.some((grant) => grant.caseId === row.id))).toHaveLength(2);
    expect(fixture.cases[0].scenarioNote).toContain('no financial edge');
    expect(fixture.enrichment?.length).toBeGreaterThanOrEqual(4);
  });
});
