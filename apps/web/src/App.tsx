import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import VictimApp from './victim/VictimApp';

const OfficerApp = lazy(() => import('./officer/OfficerApp'));

export function App() {
  return (
    <Routes>
      <Route path="/officer/*" element={<Suspense fallback={<p className="sr-only" role="status">Loading…</p>}><OfficerApp /></Suspense>} />
      <Route path="/*" element={<VictimApp />} />
    </Routes>
  );
}
