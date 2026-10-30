import { useEffect, useState } from 'react';
import type { EvidenceItem } from '../types.v2';
import { formatBytes } from './format';
import { CopyButton, Icon, Modal, Skeleton } from './parts';
import { useBlobUrl } from './officerApi';

const fileUrl = (caseId: string, id: string) => `/cases/${caseId}/evidence/${id}/file`;
const READ: Record<EvidenceItem['readStatus'], { text: string; tone: string }> = {
  READ: { text: 'Read', tone: 'green' }, PENDING: { text: 'Reading…', tone: 'amber' }, FAILED: { text: 'Could not be read', tone: 'red' },
};

function Thumb({ caseId, item }: { caseId: string; item: EvidenceItem }) {
  const { url, failed } = useBlobUrl(item.kind === 'image' ? fileUrl(caseId, item.id) : null);
  if (item.kind !== 'image') return <div className="o-thumb o-thumb--doc"><Icon name="file" size={28} /><span>{item.name.split('.').pop()?.toUpperCase()}</span></div>;
  if (failed) return <div className="o-thumb o-thumb--doc"><Icon name="file" size={28} /><span>Preview unavailable</span></div>;
  return <div className="o-thumb">{url ? <img src={url} alt={`Preview of ${item.name}`} loading="lazy" /> : <Skeleton h={160} r={0} />}</div>;
}

export function EvidenceGrid({ caseId, items, onOpen }: { caseId: string; items: EvidenceItem[]; onOpen: (id: string) => void }) {
  if (!items.length) return <div className="o-state"><h3>No files attached</h3><p>The complainant did not upload any screenshots or documents.</p></div>;
  return (
    <ul className="o-evgrid">
      {items.map((it) => (
        <li key={it.id}>
          <button type="button" className="o-evcard" onClick={() => onOpen(it.id)} aria-label={`Open ${it.name}`}>
            <Thumb caseId={caseId} item={it} />
            <span className="o-evcard__body">
              <span className="o-strong o-clip">{it.name}</span>
              <span className="o-muted">{formatBytes(it.sizeBytes)} &middot; <span className={`o-dot o-dot--${READ[it.readStatus].tone}`} />{READ[it.readStatus].text}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Lightbox({ caseId, items, startId, onClose }: { caseId: string; items: EvidenceItem[]; startId: string; onClose: () => void }) {
  const [i, setI] = useState(Math.max(0, items.findIndex((x) => x.id === startId)));
  const item = items[i]!;
  const { url, failed } = useBlobUrl(item.kind === 'image' || item.mime === 'application/pdf' ? fileUrl(caseId, item.id) : null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, items.length - 1));
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [items.length]);

  return (
    <Modal label={`Evidence: ${item.name}`} onClose={onClose} wide>
      <div className="o-lb">
        <div className="o-lb__stage">
          {item.kind === 'image' && (url ? <img src={url} alt={item.name} /> : failed ? <p className="o-muted">The preview could not be loaded.</p> : <Skeleton h={300} />)}
          {item.mime === 'application/pdf' && (url ? <iframe src={url} title={item.name} /> : failed ? <p className="o-muted">The preview could not be loaded.</p> : <Skeleton h={300} />)}
          {item.kind !== 'image' && item.mime !== 'application/pdf' && <div className="o-state"><Icon name="file" size={32} /><p>No preview for this file type. The text read from it is shown on the right.</p></div>}
        </div>
        <aside className="o-lb__side">
          <div className="o-lb__bar">
            <span className="cg-eyebrow">File {i + 1} of {items.length}</span>
            <button type="button" className="o-icon-btn" onClick={onClose} aria-label="Close preview" data-autofocus><Icon name="close" /></button>
          </div>
          <h3 className="o-clip-wrap">{item.name}</h3>
          <p className="o-muted">{formatBytes(item.sizeBytes)} &middot; {READ[item.readStatus].text}</p>
          <div className="o-hash">
            <div className="cg-eyebrow">Fingerprint (SHA-256)</div>
            <div className="o-hash__row"><code className="mono">{item.sha256}</code><CopyButton value={item.sha256} label="SHA-256" /></div>
            <p className="o-fine">Matches the file as it was received. Any change to the file changes this value.</p>
          </div>
          <div className="cg-eyebrow">Text read from this file</div>
          <div className="o-readout" tabIndex={0}>{item.excerpt?.trim() ? item.excerpt : item.readStatus === 'FAILED' ? 'We could not read text from this file. View the original.' : 'No text was found in this file.'}</div>
          <div className="o-lb__nav">
            <button type="button" className="cg-btn cg-btn--ghost cg-btn--sm" disabled={i === 0} onClick={() => setI(i - 1)}><Icon name="back" size={14} /> Previous</button>
            <button type="button" className="cg-btn cg-btn--ghost cg-btn--sm" disabled={i === items.length - 1} onClick={() => setI(i + 1)}>Next <Icon name="next" size={14} /></button>
          </div>
        </aside>
      </div>
    </Modal>
  );
}
