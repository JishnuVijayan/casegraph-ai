import { entitiesFromClaims, guessKind, maskMobile, normalizeEntity, strengthOf } from '../src/investigations/entities';
import { parseGraphRow, reasonFor, scoreMatch } from '../src/investigations/scoring';
import { SimilarGraphService, buildUpsert } from '../src/investigations/similar-graph';
import { SEED_SPECS, seedIds } from '../src/db/seed-v2';

const id = '7000000a-0000-4000-8000-00000000000a';

describe('entity normalization', () => {
  it('normalizes phone, UPI, URL host and bank account so the same value always matches', () => {
    expect(normalizeEntity('phone', '+91 90000 11111')?.value).toBe('9000011111');
    expect(normalizeEntity('phone', '09000011111')?.id).toBe('phone:9000011111');
    expect(normalizeEntity('phone', '12345')).toBeNull();
    expect(normalizeEntity('upi', ' TaskHR.Desk@OKFictBank ')?.id).toBe('upi:taskhr.desk@okfictbank');
    expect(normalizeEntity('url', 'https://WWW.TradePro-Global.example/login?x=1')?.value).toBe('tradepro-global.example');
    expect(normalizeEntity('url', 'tradepro-global.example')?.value).toBe('tradepro-global.example');
    expect(normalizeEntity('url', 'https://www.google.com/search')).toBeNull(); // too common to link anyone
    expect(normalizeEntity('bank_account', '5010 0000-1234 56')?.value).toBe('50100000123456');
    expect(normalizeEntity('ifsc', 'fict0000123')?.value).toBe('FICT0000123');
    expect(normalizeEntity('social_handle', 'https://instagram.com/DealsBazaar_X')?.value).toBe('@dealsbazaar_x');
    expect(normalizeEntity('email', 'KYC@Bank.example')?.value).toBe('kyc@bank.example');
    expect(normalizeEntity('person_name', 'Mr Rahul  Sharma')?.value).toBe('rahul sharma');
  });
  it('reads claims defensively and de-duplicates', () => {
    const list = entitiesFromClaims([
      { type: 'phone', rawValue: '90000 11111' }, { type: 'phone', rawValue: '+919000011111' },
      { type: 'upi_id', rawValue: 'a.b@okfictbank' }, { type: 'statement', rawValue: 'ignored' }, { type: 'payment_amount', rawValue: '500' },
      { type: 'contact_identifier', rawValue: 'c.d@okfictpay' }, { type: 'url', rawValue: '%%%%' }, { type: 'bank_account', rawValue: 'abc' },
    ]);
    expect(list.map((e) => e.id).sort()).toEqual(['phone:9000011111', 'upi:a.b@okfictbank', 'upi:c.d@okfictpay']);
    expect(guessKind('x@y.example')).toBe('email');
  });
  it('masks mobiles', () => { expect(maskMobile('9812345678')).toBe('98****5678'); expect(maskMobile('1')).toBe('******'); });
  it('classifies strength', () => { expect(strengthOf('phone')).toBe('STRONG'); expect(strengthOf('app_name')).toBe('WEAK'); expect(strengthOf('person_name')).toBe('WEAK'); });
});

describe('scoring', () => {
  const S = { strength: 'STRONG' as const }, W = { strength: 'WEAK' as const };
  it('ranks strong entities above weak ones; weak and category alone never reach strong level', () => {
    expect(scoreMatch([S, S], true)).toBeGreaterThan(scoreMatch([S], true));
    expect(scoreMatch([S], false)).toBeGreaterThan(scoreMatch([W, W], true));
    expect(scoreMatch([W], false)).toBeLessThan(30);
    expect(scoreMatch([], true)).toBe(0);
    expect(scoreMatch([S, S, S, S, S, W, W], true)).toBeLessThanOrEqual(100);
  });
  it('parses a graph row into shared entities with plain wording', () => {
    const m = parseGraphRow({ v_id: id, attributes: { case_id: id, category: 'job_or_task_scam', '@category_match': 1, '@shared': ['app_name|telegram', 'phone|9000011111'] } } as never);
    expect(m.shared.map((s) => s.kind)).toEqual(['phone', 'app_name']); // strong first
    expect(m.shared[0].strength).toBe('STRONG');
    expect(m.reason).toMatch(/^Shares the same phone number/);
    expect(reasonFor([{ kind: 'app_name', value: 'telegram', strength: 'WEAK' }], false, 'other')).toMatch(/weak match/);
  });
  it('rejects malformed rows rather than guessing', () => {
    expect(() => parseGraphRow({ case_id: 'nope' } as never)).toThrow();
    expect(() => parseGraphRow({ case_id: id, '@shared': ['badkind|x'] } as never)).toThrow();
  });
});

describe('graph upsert body', () => {
  it('creates the Complaint, Entities and MENTIONS edges', () => {
    const body = buildUpsert({ caseId: id, category: 'other', reference: 'CG-1', submittedAt: '2026-10-28T00:00:00.000Z', lossAmount: 5 },
      [{ kind: 'phone', value: '9000011111', id: 'phone:9000011111' }]) as never as { vertices: Record<string, Record<string, unknown>>; edges: never };
    expect(Object.keys(body.vertices.Complaint)).toEqual([id]);
    expect(body.vertices.Entity['phone:9000011111']).toMatchObject({ entity_kind: { value: 'phone' }, entity_value: { value: '9000011111' } });
    expect(JSON.stringify(body.edges)).toContain('MENTIONS');
  });
  it('omits edges when there are no entities', () => {
    expect(buildUpsert({ caseId: id, category: 'other', reference: 'CG-1', submittedAt: 'x', lossAmount: 0 }, [])).not.toHaveProperty('edges');
  });
});

describe('SimilarGraphService availability', () => {
  const access = { fixtures: { organization: { id: '10000000-0000-4000-8000-000000000001' } }, available: jest.fn().mockRejectedValue(new Error('db')) };
  it('reports UNAVAILABLE (never invented results) when the graph is disabled', async () => {
    const graph = { enabled: false, queryV2: jest.fn(), upsertV2: jest.fn(), clearMentionsV2: jest.fn() };
    const svc = new SimilarGraphService(access as never, graph as never);
    await expect(svc.findSimilar(id)).resolves.toEqual({ status: 'UNAVAILABLE', cases: [] });
    expect(graph.queryV2).not.toHaveBeenCalled();
    await expect(svc.refresh(id)).resolves.toEqual({ status: 'UNAVAILABLE', cases: [] });
  });
  it('reports UNAVAILABLE when the graph call fails', async () => {
    const graph = { enabled: true, queryV2: jest.fn().mockRejectedValue(new Error('503')), upsertV2: jest.fn().mockRejectedValue(new Error('503')), clearMentionsV2: jest.fn() };
    const svc = new SimilarGraphService(access as never, graph as never);
    await expect(svc.findSimilar(id)).resolves.toEqual({ status: 'UNAVAILABLE', cases: [] });
    await expect(svc.refresh(id)).resolves.toEqual({ status: 'UNAVAILABLE', cases: [] });
  });
});

describe('synthetic seed', () => {
  it('has fictional complaints with the intended clusters', () => {
    expect(SEED_SPECS.length).toBeGreaterThanOrEqual(70);
    const phones = (s: typeof SEED_SPECS[number]) => s.ents.filter(([t]) => t === 'phone').map(([, v]) => normalizeEntity('phone', v)?.id);
    const job = SEED_SPECS.filter((s) => s.cat === 'job_or_task_scam' && phones(s).includes('phone:9000011111'));
    expect(job.length).toBe(3);
    const trading = SEED_SPECS.filter((s) => s.ents.some(([t, v]) => t === 'url' && normalizeEntity('url', v)?.value === 'tradepro-global.example'));
    expect(trading.length).toBe(6); // 4 investors plus a romance and a second investment victim pulled into the same site
    expect(new Set(SEED_SPECS.map((s) => s.mobile)).size).toBe(SEED_SPECS.length);
    expect(seedIds(0).case).not.toBe(seedIds(1).case);
  });

  const KIND: Record<string, 'phone' | 'upi' | 'bank_account' | 'url' | 'email' | 'person_name' | 'app_name' | 'social_handle' | 'ifsc'> = {
    upi_id: 'upi', phone: 'phone', bank_account: 'bank_account', url: 'url', email: 'email', person_name: 'person_name', app_name: 'app_name', social_handle: 'social_handle', ifsc: 'ifsc',
  };
  const idsOf = (s: typeof SEED_SPECS[number]) => new Set(s.ents.map(([t, v]) => normalizeEntity(KIND[t], v)?.id).filter(Boolean) as string[]);
  const share = (a: typeof SEED_SPECS[number], b: typeof SEED_SPECS[number]) => [...idsOf(a)].filter((x) => idsOf(b).has(x) && !x.startsWith('app_name:') && !x.startsWith('person_name:'));

  it('covers every crime type the product supports', () => {
    const covered = new Set(SEED_SPECS.map((s) => s.cat));
    for (const c of ['upi_payment_fraud', 'investment_scam', 'job_or_task_scam', 'loan_app_harassment', 'phishing_or_kyc', 'sextortion_blackmail', 'romance_scam', 'account_hacking',
      'online_shopping', 'impersonation', 'online_harassment', 'identity_theft', 'malware_or_ransomware', 'fake_profile', 'other']) expect(covered.has(c as never)).toBe(true);
  });
  it('has one bank account used across three different crime types', () => {
    const mule = SEED_SPECS.filter((s) => idsOf(s).has('bank_account:50100000123456'));
    expect(new Set(mule.map((s) => s.cat)).size).toBeGreaterThanOrEqual(3);
  });
  it('has a chain: the first and last complaint share nothing, but each neighbour shares a detail', () => {
    const by = (name: string) => SEED_SPECS.find((s) => s.name === name)!;
    const [p1, p2, p3, p4] = ['Leela Krishnan', 'Vinod Pillai', 'Teresa Dias', 'Harish Nambiar'].map(by);
    expect(share(p1, p4)).toEqual([]);
    expect(share(p1, p2).length).toBeGreaterThan(0); expect(share(p2, p3).length).toBeGreaterThan(0); expect(share(p3, p4).length).toBeGreaterThan(0);
  });
});
