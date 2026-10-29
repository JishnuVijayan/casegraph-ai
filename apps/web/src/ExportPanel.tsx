import { useState } from 'react';
import { api, ApiFailure } from './api';

type ExportRow = { id: string; version: number; sha256: string | null; createdAt: string };

export function ExportPanel({ token, caseId, busy, perform }: {
  token: string; caseId: string; busy: boolean; perform: (operation: () => Promise<void>) => Promise<void>;
}) {
  const [rows, setRows] = useState<ExportRow[]>([]);
  const [preview, setPreview] = useState<{ html: string; version: number } | null>(null);

  async function refresh() {
    setRows([]);
    setPreview(null);
    setRows(await api<ExportRow[]>(`/cases/${caseId}/exports`, token));
  }

  return (
    <section aria-label="Draft export">
      <h3 className="text-lg font-bold m-0">Export complaint draft</h3>
      <p className="mt-2" style={{ color: 'var(--muted)' }}>
        Freeze a versioned HTML draft with chronology, claims, and hash manifest. Use your browser’s Print / Save as PDF if needed.
      </p>
      <button
        className="btn-primary"
        disabled={busy}
        onClick={() => void perform(async () => {
          setPreview(null);
          setRows([]);
          await api(`/cases/${caseId}/exports`, token, { draftAcknowledged: true }, 'POST');
          await refresh();
        })}
      >
        Generate draft version
      </button>
      <button disabled={busy} onClick={() => void perform(refresh)}>Refresh draft versions</button>
      <ul>
        {rows.map((row) => (
          <li key={row.id} className="my-2">
            Version {row.version} · {row.createdAt} · SHA-256: {row.sha256 ?? 'Unavailable'}
            <button disabled={busy} onClick={() => void perform(async () => {
              setPreview(null);
              const response = await fetch(`/api/v1/cases/${caseId}/exports/${row.id}/download`, {
                headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
              });
              if (!response.ok) {
                setRows([]);
                throw new ApiFailure(response.status, response.status === 403 ? 'Access denied.' : 'Draft unavailable. Retry or sign in again.');
              }
              setPreview({ html: await response.text(), version: row.version });
            })}>Review draft v{row.version}</button>
          </li>
        ))}
      </ul>
      {preview && (
        <>
          <iframe
            title={`Draft preview v${preview.version}`}
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={preview.html}
            className="h-96 w-full border"
          />
          <button disabled={busy} onClick={() => {
            const url = URL.createObjectURL(new Blob([preview.html], { type: 'text/html;charset=utf-8' }));
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `casegraph-draft-v${preview.version}.html`;
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}>Download reviewed HTML</button>
          <button onClick={() => setPreview(null)}>Close draft preview</button>
        </>
      )}
    </section>
  );
}
