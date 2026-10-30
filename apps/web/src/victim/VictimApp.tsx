import { useCallback, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import type { Session } from '../types.v2';
import { Home } from './Home';
import { clearSession, loadSession, saveSession } from './session';
import { ToastProvider } from './toast';
import { Welcome } from './Welcome';
import { Workspace } from './Workspace';
import './victim.css';

export default function VictimApp() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const navigate = useNavigate();
  const signIn = useCallback((s: Session) => { saveSession(s); setSession(s); navigate('/'); }, [navigate]);
  const signOut = useCallback(() => { clearSession(); setSession(null); navigate('/'); }, [navigate]);

  return (
    <ToastProvider>
      {!session ? <Welcome onSession={signIn} /> : (
        <Routes>
          <Route path="/" element={<Home session={session} onSignOut={signOut} />} />
          <Route path="/complaint/:caseId" element={<Workspace session={session} onAuthLost={signOut} />} />
          <Route path="*" element={<Home session={session} onSignOut={signOut} />} />
        </Routes>
      )}
    </ToastProvider>
  );
}
