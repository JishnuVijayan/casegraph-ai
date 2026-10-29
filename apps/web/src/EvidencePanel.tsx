import { useEffect, useState } from 'react';
import { api, ApiFailure } from './api';

type Evidence = { id: string; mimeType: string; sizeBytes: number; sha256: string; createdAt: string };
type Region = { id: string; kind: 'TEXT' | 'AMOUNT'; text: string; confidence: number };
type Extraction = { status: string; errorCode?: string | null; outputText?: string | null; amountStatus: string; regions: Region[] };

export function EvidencePanel({ token, caseId, owner, busy, perform, onClaimAdded }: {
  token: string; caseId: string; owner: boolean; busy: boolean; perform: (operation: () => Promise<void>) => Promise<void>;
  onClaimAdded?: () => void;
}) {
  const [rows, setRows] = useState<Evidence[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [extractions, setExtractions] = useState<Record<string, Extraction>>({});
  const [savedRegions, setSavedRegions] = useState<Record<string, boolean>>({});
  const [crop, setCrop] = useState<{ url: string; text: string } | null>(null);
  useEffect(() => { if (!crop) return; return () => URL.revokeObjectURL(crop.url); }, [crop?.url]);

  const refresh = async () => {
    setRows([]); setLoaded(false);
    const result = await api<Evidence[]>(`/cases/${caseId}/evidence`, token);
    setRows(result); setLoaded(true);
  };

  return (
    <section aria-label="Evidence originals">
      <h3 className="text-lg font-bold m-0">Add evidence</h3>
      <p className="mt-2" style={{ color: 'var(--muted)' }}>Upload PNG or JPEG screenshots (max 5 MiB). Run OCR to pull out amounts and text.</p>

      {owner && (
        <form onSubmit={(event) => {
          event.preventDefault();
          void perform(async () => {
            if (!file || !['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) {
              throw new Error('Choose a PNG/JPEG up to 5 MiB.');
            }
            const data = new FormData();
            data.append('file', file);
            await api(`/cases/${caseId}/evidence`, token, data, 'POST');
            setFile(null);
            await refresh();
          });
        }}>
          <label htmlFor="evidence-file">Image file</label>
          <input
            id="evidence-file"
            type="file"
            accept="image/png,image/jpeg"
            disabled={busy}
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <div className="mt-2">
            <button className="btn-primary" type="submit" disabled={busy || !file}>Upload</button>
          </div>
        </form>
      )}

      <button disabled={busy} onClick={() => void perform(refresh)}>Refresh evidence</button>
      {loaded && !rows.length && <p>No evidence uploaded yet.</p>}

      <ul>
        {rows.map((row) => (
          <li key={row.id} className="my-3 break-all rounded border p-3" style={{ borderColor: 'var(--line)' }}>
            <p className="m-0">Source ID: {row.id} · {row.mimeType} · {row.sizeBytes} bytes</p>
            <p className="m-1">SHA-256: <code>{row.sha256}</code></p>
            <p className="m-1">Uploaded: {row.createdAt}</p>
            <button disabled={busy} onClick={() => void perform(async () => {
              const result = await api<Extraction>(`/cases/${caseId}/extractions`, token, { evidenceId: row.id }, 'POST');
              setExtractions((current) => ({ ...current, [row.id]: result }));
            })}>Run local OCR</button>

            {extractions[row.id] && (
              <div aria-label={`OCR review ${row.id}`} className="mt-2">
                <p>OCR status: {extractions[row.id].status}{extractions[row.id].errorCode ? ` · ${extractions[row.id].errorCode}` : ''}</p>
                <p>Candidate status: {extractions[row.id].amountStatus} · verification: UNVERIFIED</p>
                {extractions[row.id].outputText && <p>Text observed in upload: {extractions[row.id].outputText}</p>}
                {!extractions[row.id].regions.some((region) => region.kind === 'AMOUNT') && (
                  <p>Amount: UNKNOWN — no readable amount candidate was found.</p>
                )}
                {extractions[row.id].regions.filter((region) => region.kind === 'AMOUNT').map((region) => (
                  <button key={region.id} disabled={busy} onClick={() => void perform(async () => {
                    const response = await fetch(`/api/v1/cases/${caseId}/extractions/${row.id}/regions/${region.id}/crop`, {
                      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
                    });
                    if (!response.ok) throw new ApiFailure(response.status, response.status === 403 ? 'Access denied.' : 'Source region unavailable.');
                    const url = URL.createObjectURL(await response.blob());
                    setCrop({ url, text: region.text });
                  })}>Review source region for {region.text} (OBSERVED_IN_UPLOAD · UNVERIFIED)</button>
                ))}
                {owner && extractions[row.id].regions.filter((region) => region.kind === 'AMOUNT').map((region) => (
                  <button
                    key={`claim-${region.id}`}
                    disabled={busy || savedRegions[region.id]}
                    onClick={() => void perform(async () => {
                      await api(`/cases/${caseId}/claims`, token, {
                        type: 'payment_amount',
                        sourceKind: 'OBSERVED_IN_UPLOAD',
                        evidenceId: row.id,
                        regionId: region.id,
                      }, 'POST');
                      setSavedRegions((current) => ({ ...current, [region.id]: true }));
                      onClaimAdded?.();
                    })}
                  >
                    {savedRegions[region.id] ? 'Observed amount claim saved' : `Save observed amount claim for ${region.text}`}
                  </button>
                ))}
              </div>
            )}

            <button disabled={busy} onClick={() => void perform(async () => {
              const response = await fetch(`/api/v1/cases/${caseId}/evidence/${row.id}/view`, {
                headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
              });
              if (!response.ok) {
                setRows([]); setLoaded(false);
                throw new ApiFailure(response.status, response.status === 403 ? 'Access denied.' : 'Original unavailable. Retry or sign in again.');
              }
              const url = URL.createObjectURL(await response.blob());
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = `${row.id}.${row.mimeType === 'image/png' ? 'png' : 'jpg'}`;
              anchor.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            })}>Download original</button>
          </li>
        ))}
      </ul>

      {crop && (
        <figure>
          <figcaption>Source crop for “{crop.text}”</figcaption>
          <img src={crop.url} alt={`Source crop containing ${crop.text}`} />
          <button onClick={() => setCrop(null)}>Close source crop</button>
        </figure>
      )}
    </section>
  );
}
