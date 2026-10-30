/** Exact public demo origin (https://host, no path/trailing slash) or empty when local-only. */
export function publicOriginFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = (env.PUBLIC_ORIGIN ?? '').trim().replace(/\/$/, '');
  if (!raw) return null;
  if (!/^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(raw)) {
    throw new Error('PUBLIC_ORIGIN must be https://hostname with no path (e.g. https://casegraph.duckdns.org).');
  }
  return raw;
}

const LOCAL_DEMO_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost):(5173|3000|15173)$/;

/** True when Origin is absent, a local Vite/API origin, or exactly PUBLIC_ORIGIN. */
export function isAllowedDemoOrigin(origin: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!origin) return true;
  if (LOCAL_DEMO_ORIGIN.test(origin)) return true;
  const pub = publicOriginFromEnv(env);
  return Boolean(pub && origin === pub);
}
