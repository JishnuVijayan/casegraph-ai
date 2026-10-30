import { isAllowedDemoOrigin, publicOriginFromEnv } from '../src/auth/origins';

describe('demo origins', () => {
  it('accepts local Vite origins and rejects foreign hosts', () => {
    expect(isAllowedDemoOrigin(undefined, {})).toBe(true);
    expect(isAllowedDemoOrigin('http://127.0.0.1:5173', {})).toBe(true);
    expect(isAllowedDemoOrigin('http://localhost:3000', {})).toBe(true);
    expect(isAllowedDemoOrigin('https://foreign.invalid', {})).toBe(false);
  });

  it('allows exact PUBLIC_ORIGIN https host only', () => {
    const env = { PUBLIC_ORIGIN: 'https://casegraph-hhgoa.duckdns.org' };
    expect(publicOriginFromEnv(env)).toBe('https://casegraph-hhgoa.duckdns.org');
    expect(isAllowedDemoOrigin('https://casegraph-hhgoa.duckdns.org', env)).toBe(true);
    expect(isAllowedDemoOrigin('https://casegraph-hhgoa.duckdns.org/', env)).toBe(false);
    expect(isAllowedDemoOrigin('http://casegraph-hhgoa.duckdns.org', env)).toBe(false);
    expect(() => publicOriginFromEnv({ PUBLIC_ORIGIN: 'http://insecure.example' })).toThrow(/PUBLIC_ORIGIN/);
  });
});
