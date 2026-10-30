import { useCallback, useEffect, useRef, useState } from 'react';
import { useOfficer } from './session';

export class OfficerApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function request(path: string, token: string | undefined, init: { method?: string; body?: object; accept?: string } = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: init.method ?? 'GET', cache: 'no-store',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new OfficerApiError(503, 'We could not reach the server. Check your connection and try again.');
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new OfficerApiError(res.status, payload?.error?.message ?? 'Something went wrong. Please try again.');
  }
  return res;
}

export async function jsonRequest<T>(path: string, token?: string, init: { method?: string; body?: object } = {}): Promise<T> {
  const res = await request(path, token, init);
  const payload = await res.json().catch(() => null);
  return payload?.data as T;
}
export async function blobRequest(path: string, token: string): Promise<Blob> {
  return (await request(path, token)).blob();
}

/** Authenticated API caller. A 401 signs the officer out. */
export function useOfficerApi() {
  const { session, signOut } = useOfficer();
  const token = session?.token;
  const guard = useCallback(async <T,>(run: () => Promise<T>): Promise<T> => {
    try { return await run(); } catch (e) {
      if (e instanceof OfficerApiError && e.status === 401) signOut(true);
      throw e;
    }
  }, [signOut]);
  const get = useCallback(<T,>(path: string) => guard(() => jsonRequest<T>(path, token)), [guard, token]);
  const post = useCallback(<T,>(path: string, body: object) => guard(() => jsonRequest<T>(path, token, { method: 'POST', body })), [guard, token]);
  const blob = useCallback((path: string) => guard(() => blobRequest(path, token ?? '')), [guard, token]);
  return { get, post, blob, token };
}

export type Loadable<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: T };

export function useLoad<T>(path: string | null, reloadKey = 0): { value: Loadable<T>; reload: () => void } {
  const { get } = useOfficerApi();
  const [value, setValue] = useState<Loadable<T>>({ state: 'loading' });
  const [tick, setTick] = useState(0);
  const getRef = useRef(get);
  getRef.current = get;
  useEffect(() => {
    if (!path) return;
    let live = true;
    setValue((v) => (v.state === 'ready' ? v : { state: 'loading' }));
    getRef.current<T>(path).then(
      (data) => live && setValue({ state: 'ready', data }),
      (e) => live && setValue({ state: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' }),
    );
    return () => { live = false; };
  }, [path, tick, reloadKey]);
  return { value, reload: () => { setValue({ state: 'loading' }); setTick((t) => t + 1); } };
}

/** Fetch an authenticated file as an object URL for <img>/<iframe>. */
export function useBlobUrl(path: string | null) {
  const { blob } = useOfficerApi();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const blobRef = useRef(blob);
  blobRef.current = blob;
  useEffect(() => {
    if (!path) return;
    let live = true; let made: string | null = null;
    setUrl(null); setFailed(false);
    blobRef.current(path).then((b) => { if (!live) return; made = URL.createObjectURL(b); setUrl(made); }, () => live && setFailed(true));
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [path]);
  return { url, failed };
}
