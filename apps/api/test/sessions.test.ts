import { Sessions } from '../src/auth/sessions';
import { DemoConfig } from '../src/auth/config';

describe('bounded opaque demo sessions', () => {
  afterEach(() => jest.restoreAllMocks());
  it('rotates the same identity, expires on the server clock and rejects forged tokens', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(100000);
    const sessions = new Sessions({ ttlMs: 1000 } as DemoConfig);
    const first = sessions.issue('synthetic-test');
    expect(first.token).toMatch(/^[a-f0-9]{64}$/);
    const second = sessions.issue('synthetic-test');
    expect(second.token).not.toEqual(first.token);
    expect(() => sessions.resolve(`Bearer ${first.token}`)).toThrow();
    expect(sessions.resolve(`Bearer ${second.token}`).userId).toBe('synthetic-test');
    now.mockReturnValue(101000);
    expect(() => sessions.resolve(`Bearer ${second.token}`)).toThrow();
    expect(() => sessions.resolve(`Bearer ${'0'.repeat(64)}`)).toThrow();
  });
  it('revokes logout sessions and bounds sign-in attempts', () => {
    jest.spyOn(Date, 'now').mockReturnValue(100000);
    const sessions = new Sessions({ ttlMs: 1000 } as DemoConfig);
    const { token } = sessions.issue('synthetic-test');
    sessions.revoke(sessions.resolve(`Bearer ${token}`).digest);
    expect(() => sessions.resolve(`Bearer ${token}`)).toThrow();
    for (let attempt = 0; attempt < 30; attempt++) sessions.throttle();
    expect(() => sessions.throttle()).toThrow();
  });
  it('refuses production demo mode and invalid boolean configuration', () => {
    const oldMode = process.env.DEMO_MODE;
    const oldNode = process.env.NODE_ENV;
    try {
      process.env.DEMO_MODE = 'true'; process.env.NODE_ENV = 'production';
      expect(() => new DemoConfig()).toThrow(/cannot run in production/);
      process.env.DEMO_MODE = 'yes';
      expect(() => new DemoConfig()).toThrow(/true or false/);
    } finally {
      if (oldMode === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = oldMode;
      if (oldNode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNode;
    }
  });
});
