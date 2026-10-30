import { useEffect, useState } from 'react';
import { fetchBlob } from '../api';
import type { EvidenceItem } from '../types.v2';
import { AlertIcon, CheckIcon, FileIcon, RefreshIcon, TrashIcon } from './icons';
import { bytes } from './format';
import type { UploadItem } from './useCase';
import { useToast } from './toast';

const previews = new Map<string, string>();

function Thumb({ item, caseId, token }: { item: EvidenceItem; caseId: string; token: string }) {
  const [url, setUrl] = useState<string | undefined>(previews.get(item.id));
  useEffect(() => {
    if (item.kind !== 'image' || previews.has(item.id)) return;
    let live = true;
    fetchBlob(`/cases/${encodeURIComponent(caseId)}/evidence/${encodeURIComponent(item.id)}/file`, token)
      .then((b) => { const u = URL.createObjectURL(b); previews.set(item.id, u); if (live) setUrl(u); })
      .catch(() => {});
    return () => { live = false; };
  }, [item.id, item.kind, caseId, token]);
  return url ? <img src={url} alt="" className="v-thumb-img" /> : <span className="v-thumb-icon"><FileIcon size={26} /></span>;
}

const READ_LABEL = { PENDING: 'Reading…', READ: 'Read', FAILED: 'Could not read' } as const;

type Props = {
  caseId: string; token: string; evidence: EvidenceItem[]; uploads: UploadItem[];
  onDelete: (id: string) => Promise<void>; onRetry: (key: string) => void; onDismiss: (key: string) => void;
};

/** Thumbnails of everything added. Each file is saved as soon as it is picked. */
export function Attachments({ caseId, token, evidence, uploads, onDelete, onRetry, onDismiss }: Props) {
  const toast = useToast();
  const [removing, setRemoving] = useState<string | null>(null);
  if (!evidence.length && !uploads.length) return null;

  async function remove(item: EvidenceItem) {
    setRemoving(item.id);
    try { await onDelete(item.id); toast(`Removed ${item.name}`); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not remove that file.', 'error'); }
    finally { setRemoving(null); }
  }

  return (
    <ul className="v-files" aria-label="Files you added">
      {uploads.map((u) => (
        <li key={u.key} className="v-file is-new">
          <div className="v-thumb">{u.previewUrl ? <img src={u.previewUrl} alt="" className="v-thumb-img" /> : <span className="v-thumb-icon"><FileIcon size={26} /></span>}</div>
          <div className="v-file-info">
            <p className="v-file-name" title={u.name}>{u.name}</p>
            {u.status === 'uploading' ? (
              <div className="v-bar-track" role="progressbar" aria-label={`Adding ${u.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(u.progress * 100)}><span style={{ width: `${Math.max(6, u.progress * 100)}%` }} /></div>
            ) : (
              <p className="v-file-err" role="alert"><AlertIcon size={14} /> {u.error}</p>
            )}
          </div>
          {u.status === 'failed' && (
            <div className="v-file-actions">
              <button type="button" className="v-icon-btn" onClick={() => onRetry(u.key)} aria-label={`Try ${u.name} again`}><RefreshIcon size={18} /></button>
              <button type="button" className="v-icon-btn" onClick={() => onDismiss(u.key)} aria-label={`Dismiss ${u.name}`}><TrashIcon size={18} /></button>
            </div>
          )}
        </li>
      ))}
      {evidence.map((e) => (
        <li key={e.id} className="v-file">
          <div className="v-thumb"><Thumb item={e} caseId={caseId} token={token} /></div>
          <div className="v-file-info">
            <p className="v-file-name" title={e.name}>{e.name}</p>
            <p className="v-file-meta">
              {bytes(e.sizeBytes)} ·{' '}
              <span className={`v-read v-read--${e.readStatus.toLowerCase()}`}>
                {e.readStatus === 'READ' && <CheckIcon size={13} />}{READ_LABEL[e.readStatus]}
              </span>
            </p>
          </div>
          <button type="button" className="v-icon-btn" disabled={removing === e.id} onClick={() => void remove(e)} aria-label={`Remove ${e.name}`}><TrashIcon size={18} /></button>
        </li>
      ))}
    </ul>
  );
}
