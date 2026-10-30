import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '../types.v2';

const KEY = 'cg.officer.session.v2';
export type OfficerSession = { token: string; officerId: string; displayName: string };
type Ctx = {
  session: OfficerSession | null;
  signIn: (s: Session, officerId: string) => void;
  signOut: (expired?: boolean) => void;
  expired: boolean;
};
const OfficerContext = createContext<Ctx | null>(null);

function read(): OfficerSession | null {
  try { const raw = sessionStorage.getItem(KEY); return raw ? (JSON.parse(raw) as OfficerSession) : null; } catch { return null; }
}
function write(s: OfficerSession | null) {
  try { if (s) sessionStorage.setItem(KEY, JSON.stringify(s)); else sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

export function OfficerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<OfficerSession | null>(read);
  const [expired, setExpired] = useState(false);
  const signIn = useCallback((s: Session, officerId: string) => {
    const next = { token: s.token, officerId: officerId.trim(), displayName: officerId.trim() || 'Investigating officer' };
    write(next); setSession(next); setExpired(false);
  }, []);
  const signOut = useCallback((wasExpired = false) => { write(null); setSession(null); setExpired(wasExpired); }, []);
  const value = useMemo(() => ({ session, signIn, signOut, expired }), [session, signIn, signOut, expired]);
  return <OfficerContext.Provider value={value}>{children}</OfficerContext.Provider>;
}
export function useOfficer(): Ctx {
  const c = useContext(OfficerContext);
  if (!c) throw new Error('OfficerProvider missing');
  return c;
}
