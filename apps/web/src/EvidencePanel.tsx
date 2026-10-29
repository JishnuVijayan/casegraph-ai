import { useState } from 'react';
import { api, ApiFailure } from './api';

type Evidence = { id: string; mimeType: string; sizeBytes: number; sha256: string; createdAt: string };
export function EvidencePanel({ token, caseId, owner, busy, perform }: {
  token: string; caseId: string; owner: boolean; busy: boolean; perform: (operation: () => Promise<void>) => Promise<void>;
}) {
  const [rows, setRows] = useState<Evidence[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const refresh = async () => {
    setRows([]); setLoaded(false);
    const result = await api<Evidence[]>(`/cases/${caseId}/evidence`, token);
    setRows(result); setLoaded(true);
  };
  return <section aria-label="Evidence originals">
    <h4 className="font-bold">Original evidence — synthetic files only</h4>
    <p>PNG/JPEG, maximum 5 MiB and 16 million pixels. No real financial records or personal images. PDF and OCR are not available.</p>
    <p>SHA-256 records integrity after upload; it does not prove screenshot authenticity.</p>
    {owner && <form onSubmit={(event) => { event.preventDefault(); void perform(async () => {
      if (!file || !['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choose a PNG/JPEG up to 5 MiB.');
      const data = new FormData(); data.append('file', file);
      await api(`/cases/${caseId}/evidence`, token, data, 'POST');
      await refresh();
    }); }}>
      <label htmlFor="evidence-file">Synthetic PNG/JPEG file</label>
      <input id="evidence-file" type="file" accept="image/png,image/jpeg" disabled={busy} required onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      <label><input type="checkbox" required disabled={busy} /> This file is entirely fictional/synthetic.</label>
      <button type="submit" disabled={busy || !file}>Upload immutable original</button>
    </form>}
    <button disabled={busy} onClick={() => void perform(refresh)}>Refresh evidence manifest</button>
    {loaded && !rows.length && <p>No evidence uploaded.</p>}
    <ul>{rows.map((row) => <li key={row.id} className="my-3 break-all">
      <p>Source ID: {row.id} · {row.mimeType} · {row.sizeBytes} bytes</p>
      <p>SHA-256: <code>{row.sha256}</code></p>
      <p>Uploaded: {row.createdAt}</p>
      <button disabled={busy} onClick={() => void perform(async () => {
        const response = await fetch(`/api/v1/cases/${caseId}/evidence/${row.id}/view`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
        });
        if (!response.ok) {
          setRows([]); setLoaded(false);
          throw new ApiFailure(response.status, response.status === 403 ? 'Access denied.' : 'Original unavailable. Retry or sign in again.');
        }
        const url = URL.createObjectURL(await response.blob());
        const anchor = document.createElement('a'); anchor.href = url;
        anchor.download = `${row.id}.${row.mimeType === 'image/png' ? 'png' : 'jpg'}`;
        anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      })}>Download original</button>
    </li>)}</ul>
  </section>;
}
