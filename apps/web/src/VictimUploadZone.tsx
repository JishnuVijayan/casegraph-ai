import { useEffect, useRef, useState } from 'react';
import { api } from './api';

type Evidence = { id: string; mimeType: string; sizeBytes: number; sha256: string; createdAt: string };
type Preview = {
  key: string;
  name: string;
  previewUrl: string;
  status: 'uploading' | 'ready' | 'failed';
  id?: string;
  error?: string;
};

export function VictimUploadZone({ token, caseId, busy, perform, onReadyCount }: {
  token: string; caseId: string; busy: boolean;
  perform: (operation: () => Promise<void>) => Promise<void>;
  onReadyCount: (count: number) => void;
}) {
  const [items, setItems] = useState<Preview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const urlsRef = useRef<string[]>([]);
  const readyRef = useRef(onReadyCount);
  readyRef.current = onReadyCount;

  function emitReady(next: Preview[]) {
    readyRef.current(next.filter((item) => item.status === 'ready').length);
  }

  useEffect(() => () => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await api<Evidence[]>(`/cases/${caseId}/evidence`, token);
        if (cancelled) return;
        // Do not clobber uploads that started while the initial list was in flight.
        setItems((current) => {
          if (current.length) return current;
          const next = rows.map((row) => ({
            key: row.id, name: 'Screenshot', previewUrl: '', status: 'ready' as const, id: row.id,
          }));
          emitReady(next);
          return next;
        });
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [caseId, token]);

  async function uploadFiles(fileList: FileList | File[]) {
    const files = [...fileList].filter((file) => {
      const typed = ['image/png', 'image/jpeg'].includes(file.type);
      const named = /\.(png|jpe?g)$/i.test(file.name);
      return (typed || named) && file.size > 0 && file.size <= 5 * 1024 * 1024;
    });
    if (!files.length) throw new Error('Choose PNG or JPEG images up to 5 MiB each.');
    for (const file of files) {
      const previewUrl = URL.createObjectURL(file);
      urlsRef.current.push(previewUrl);
      const key = `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`;
      setItems((current) => {
        const next = [...current, { key, name: file.name, previewUrl, status: 'uploading' as const }];
        emitReady(next);
        return next;
      });
      try {
        const data = new FormData();
        data.append('file', file);
        const uploaded = await api<Evidence>(`/cases/${caseId}/evidence`, token, data, 'POST');
        setItems((current) => {
          const next = current.map((item) => item.key === key
            ? { ...item, status: 'ready' as const, id: uploaded.id, name: file.name }
            : item);
          emitReady(next);
          return next;
        });
      } catch (failure) {
        setItems((current) => {
          const next = current.map((item) => item.key === key
            ? { ...item, status: 'failed' as const, error: failure instanceof Error ? failure.message : 'Upload failed' }
            : item);
          emitReady(next);
          return next;
        });
      }
    }
  }

  async function removeItem(item: Preview) {
    if (item.id) {
      await api(`/cases/${caseId}/evidence/${item.id}`, token, undefined, 'DELETE');
    }
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
      urlsRef.current = urlsRef.current.filter((url) => url !== item.previewUrl);
    }
    setItems((current) => {
      const next = current.filter((row) => row.key !== item.key);
      emitReady(next);
      return next;
    });
  }

  return (
    <section className="panel-block" aria-label="Evidence originals">
      <p className="panel-lead">Add screenshots or receipts. Images upload automatically.</p>
      <div className="upload-dropzone">
        <label className="upload-label" htmlFor="evidence-file">
          <span className="upload-title">Tap to add images</span>
          <span className="upload-hint">PNG or JPEG · up to 5 MiB each · multiple allowed</span>
        </label>
        <input
          id="evidence-file"
          type="file"
          accept="image/png,image/jpeg"
          multiple
          disabled={busy}
          onChange={(event) => {
            // Copy before clearing — FileList is live and empties when value is reset.
            const list = [...(event.target.files ?? [])];
            event.target.value = '';
            if (!list.length) return;
            void perform(() => uploadFiles(list));
          }}
        />
      </div>
      {loaded && !items.length && <p className="empty-hint">No screenshots yet.</p>}
      <ul className="upload-preview-grid">
        {items.map((item) => (
          <li key={item.key} className={`upload-preview-card upload-preview-${item.status}`}>
            {item.previewUrl ? (
              <img src={item.previewUrl} alt={item.name} className="upload-preview-img" />
            ) : item.id ? (
              <EvidenceThumb token={token} caseId={caseId} evidenceId={item.id} />
            ) : (
              <div className="upload-preview-img upload-preview-placeholder" />
            )}
            <p className="upload-preview-name">{item.name}</p>
            <p className="upload-preview-status">
              {item.status === 'uploading' && 'Uploading…'}
              {item.status === 'ready' && 'Ready'}
              {item.status === 'failed' && (item.error || 'Failed')}
            </p>
            <button
              type="button"
              className="btn-ghost btn-compact"
              disabled={busy || item.status === 'uploading'}
              onClick={() => void perform(() => removeItem(item))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EvidenceThumb({ token, caseId, evidenceId }: { token: string; caseId: string; evidenceId: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    void (async () => {
      const response = await fetch(`/api/v1/cases/${caseId}/evidence/${evidenceId}/view`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (!response.ok || !active || typeof response.blob !== 'function') return;
      const blob = await response.blob();
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    })();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, caseId, evidenceId]);
  if (!url) return <div className="upload-preview-img upload-preview-placeholder" aria-hidden="true" />;
  return <img src={url} alt="Uploaded screenshot" className="upload-preview-img" />;
}
