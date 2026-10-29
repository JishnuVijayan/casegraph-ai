import { loadFixtures } from '../src/db/fixtures';

describe('synthetic bootstrap fixtures', () => {
  it('contains fictional labels, 20 owned cases and separated roles', () => {
    const fixture = loadFixtures();
    expect(fixture.organization.name).toContain('Fictional');
    expect(fixture.cases).toHaveLength(20);
    expect(fixture.users.filter((user) => user.role === 'victim')).toHaveLength(2);
    expect(fixture.users.filter((user) => user.role === 'analyst')).toHaveLength(1);
    expect(fixture.cases.every((row) => row.organizationId === null)).toBe(true);
  });
  it('includes active, revoked, expired and never-shared examples without a graph result', () => {
    const fixture = loadFixtures();
    expect(fixture.grants.filter((row) => !row.revokedAt && !row.expiresAt)).toHaveLength(1);
    expect(fixture.grants.filter((row) => row.revokedAt)).toHaveLength(1);
    expect(fixture.grants.filter((row) => row.expiresAt)).toHaveLength(1);
    expect(fixture.cases.filter((row) => !fixture.grants.some((grant) => grant.caseId === row.id))).toHaveLength(17);
    expect(fixture.cases[0].scenarioNote).toContain('no financial edge');
  });
});
