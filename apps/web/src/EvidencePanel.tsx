import { useEffect, useRef, useState } from 'react';
import { api, ApiFailure } from './api';

type Evidence = { id: string; mimeType: string; sizeBytes: number; sha256: string; createdAt: string };
type Region = { id: string; kind: 'TEXT' | 'AMOUNT'; text: string; confidence: number };
type Extraction = { status: string; errorCode?: string | null; outputText?: string | null; amountStatus: string; regions: Region[] };

export function EvidencePanel({ token, caseId, owner, busy, perform, onClaimAdded, autoOcr = false, autoLoad = false, compact = false, mode = 'full' }: {
  token: string; caseId: string; owner: boolean; busy: boolean; perform: (operation: () => Promise<void>) => Promise<void>;
  onClaimAdded?: () => void; autoOcr?: boolean; autoLoad?: boolean; compact?: boolean;
  mode?: 'full' | 'victim';
}) {
  const victim = mode === 'victim' || compact;
  const [rows, setRows] = useState<Evidence[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [extractions, setExtractions] = useState<Record<string, Extraction>>({});
  const [savedRegions, setSavedRegions] = useState<Record<string, boolean>>({});
  const [crop, setCrop] = useState<{ url: string; text: string } | null>(null);
  const performRef = useRef(perform);
  useEffect(() => { performRef.current = perform; });
  useEffect(() => { if (!crop) return; return () => URL.revokeObjectURL(crop.url); }, [crop?.url]);

  const refresh = async () => {
    setRows([]); setLoaded(false);
    const result = await api<Evidence[]>(`/cases/${caseId}/evidence`, token);
    setRows(result); setLoaded(true);
  };

  useEffect(() => {
    if (!autoLoad) return;
    void performRef.current(refresh);
  }, [autoLoad, caseId, token]);

  return (
    <section className={victim ? 'panel-block' : undefined} aria-label="Evidence originals">
      {!victim && <h3 className="text-lg font-bold m-0">Add evidence</h3>}
      <p className={victim ? 'panel-lead' : 'mt-2'} style={victim ? undefined : { color: 'var(--muted)' }}>
        {victim
          ? 'Upload PNG or JPEG screenshots or receipts (max 5 MiB each).'
          : 'Upload PNG or JPEG screenshots (max 5 MiB). OCR runs after each upload to pull out amounts and text.'}
      </p>

      {owner && (
        <form className="upload-zone" onSubmit={(event) => {
          event.preventDefault();
          void perform(async () => {
            if (!file || !['image/png', 'image/jpeg'].includes(file.type) || file.size > 5 * 1024 * 1024) {
              throw new Error('Choose a PNG/JPEG up to 5 MiB.');
            }
            const data = new FormData();
            data.append('file', file);
            const uploaded = await api<{ id: string }>(`/cases/${caseId}/evidence`, token, data, 'POST');
            setFile(null);
            await refresh();
            if (autoOcr && !victim && uploaded?.id) {
              const result = await api<Extraction>(`/cases/${caseId}/extractions`, token, { evidenceId: uploaded.id }, 'POST');
              setExtractions((current) => ({ ...current, [uploaded.id]: result }));
            }
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
          <p className="upload-hint m-0">
            {file ? `Selected: ${file.name}` : 'PNG or JPEG · up to 5 MiB'}
          </p>
          <div className="action-row">
            <button className="btn-primary" type="submit" disabled={busy || !file}>Upload</button>
            {!victim && (
              <button className="btn-ghost" type="button" disabled={busy} onClick={() => void perform(refresh)}>
                Refresh evidence
              </button>
            )}
          </div>
        </form>
      )}

      {!owner && (
        <button className="btn-ghost" disabled={busy} onClick={() => void perform(refresh)}>Refresh evidence</button>
      )}
      {loaded && !rows.length && <p className="empty-hint">No evidence uploaded yet.</p>}

      <ul className="evidence-list">
        {rows.map((row) => (
          <li key={row.id} data-evidence-id={row.id} className="evidence-card">
            <p className="m-0 evidence-card-title">
              {victim ? 'Screenshot uploaded' : `Source ID: ${row.id}`}
              {victim ? '' : ` · ${row.mimeType} · ${(row.sizeBytes / 1024).toFixed(1)} KiB`}
            </p>
            {!victim && <p className="m-1">SHA-256: <code>{row.sha256}</code></p>}
            {!victim && <p className="m-1 evidence-meta">Uploaded: {row.createdAt}</p>}
            {victim && <p className="m-1 evidence-meta empty-hint-ok" style={{ display: 'inline-block', padding: '0.25rem 0.6rem' }}>Ready</p>}

            {!victim && (
              <>
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
              </>
            )}
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
