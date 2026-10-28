import { Route, Routes, Link } from 'react-router-dom';

export function App() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-bold">CaseGraph AI</h1>
      <section aria-labelledby="urgent" className="my-6 rounded border-2 border-amber-700 bg-amber-50 p-5">
        <h2 id="urgent" className="text-xl font-bold">Recent financial fraud? Act now.</h2>
        <p>
          Contact your bank immediately, call <a href="tel:1930">1930</a>, and use{' '}
          <a href="https://cybercrime.gov.in/">cybercrime.gov.in</a>.
          Do not wait to finish a draft.
        </p>
      </section>
      <Routes>
        <Route path="/" element={
          <section>
            <h2 className="text-xl font-bold">Local synthetic demo</h2>
            <p>Scaffold only. Case intake, evidence upload, OCR, and investigation are not implemented yet.</p>
            <p>No real victim data. No paid APIs. No official government, police, or bank affiliation.</p>
            <p>TigerGraph and optional AI integrations are not configured.</p>
          </section>
        } />
        <Route path="*" element={<p>Page not found. <Link to="/">Return home</Link></p>} />
      </Routes>
    </main>
  );
}
