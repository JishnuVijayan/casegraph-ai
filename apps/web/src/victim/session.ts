import type { Session } from '../types.v2';

const KEY = 'cg.session';

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed?.token && parsed.user?.role === 'victim' ? parsed : null;
  } catch { return null; }
}
export function saveSession(session: Session): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(session)); } catch { /* private mode: session lives in memory only */ }
}
export function clearSession(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
