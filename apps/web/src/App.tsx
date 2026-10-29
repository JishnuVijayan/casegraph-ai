import { SafetyNotice } from './SafetyNotice';
import { Route, Routes, Link } from 'react-router-dom';
import { OfficerInboxPage } from './OfficerInboxPage';
import { VictimFilingPage } from './VictimFilingPage';

export function App() {
  return (
    <><SafetyNotice /><Routes>
      <Route path="/" element={<VictimFilingPage />} />
      <Route path="/officer" element={<OfficerInboxPage />} />
      <Route path="*" element={
        <main className="workspace">
          <p>Page not found. <Link to="/">File a complaint</Link> or <Link to="/officer">open the officer workspace</Link>.</p>
        </main>
      } />
    </Routes></>
  );
}
