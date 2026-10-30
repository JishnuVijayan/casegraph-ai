import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import '../ui/tokens.css';
import './officer.css';
import { OfficerProvider, useOfficer } from './session';
import { ToastProvider } from './toast';
import { SignIn } from './SignIn';
import { Inbox } from './Inbox';
import { CaseFile } from './CaseFile';
import { ComparePage } from './Compare';
import { Icon } from './parts';
import { initials } from './format';

function Shell() {
  const { session, signOut } = useOfficer();
  if (!session) return <SignIn />;
  return (
    <div className="o-app">
      <a className="o-skip" href="#o-main">Skip to content</a>
      <header className="o-topbar">
        <NavLink to="/officer" end className="o-brand"><img className="o-logo" src="/icon-192.png" alt="" width={28} height={28} /> <strong>CaseGraph</strong><span>Investigation workspace</span></NavLink>
        <nav aria-label="Primary" className="o-topnav">
          <NavLink to="/officer" end>Inbox</NavLink>
        </nav>
        <div className="o-user">
          <span className="o-avatar" aria-hidden="true">{initials(session.displayName)}</span>
          <span className="o-user__name">{session.displayName}</span>
          <button className="o-icon-btn o-icon-btn--light" onClick={() => signOut()} aria-label="Sign out" title="Sign out"><Icon name="out" size={17} /></button>
        </div>
      </header>
      <div id="o-main" className="o-main" tabIndex={-1}>
        <Routes>
          <Route index element={<Inbox />} />
          <Route path="cases/:caseId" element={<CaseFile />} />
          <Route path="cases/:caseId/compare/:otherId" element={<ComparePage />} />
          <Route path="*" element={<Navigate to="/officer" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function OfficerApp() {
  return (
    <OfficerProvider>
      <ToastProvider>
        <div className="o-root"><Shell /></div>
      </ToastProvider>
    </OfficerProvider>
  );
}
