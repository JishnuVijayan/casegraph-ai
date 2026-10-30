import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Brief } from '../types.v2';
import { CheckIcon, DownloadIcon, PhoneIcon, PrintIcon } from './icons';
import { useToast } from './toast';

type Props = { brief: Brief; fresh: boolean; onDownload: () => Promise<void>; onPrint: () => Promise<void>; busy: boolean };

export function Submitted({ brief, fresh, onDownload, onPrint, busy }: Props) {
  const toast = useToast();
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus({ preventScroll: true }); }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(brief.reference); toast('Reference number copied.', 'ok'); }
    catch { toast('Could not copy. Please write it down.', 'error'); }
  }
  return (
    <div className="v-screen v-done">
      <span className="v-success-mark" aria-hidden="true"><CheckIcon size={32} /></span>
      <h1 className="v-h1" ref={head} tabIndex={-1}>{fresh ? 'Your complaint has been sent' : 'Your complaint was sent'}</h1>
      <p className="v-lead">Keep this reference number. You will need it when you talk to the police or your bank.</p>
      <div className="v-ref">
        <span className="v-ref-num mono" aria-label={`Reference number ${brief.reference}`}>{brief.reference}</span>
        <button type="button" className="cg-btn cg-btn--soft cg-btn--sm" onClick={() => void copy()}>Copy</button>
      </div>
      <div className="v-actions">
        <button type="button" className="cg-btn v-primary" disabled={busy} onClick={() => void onDownload()}><DownloadIcon size={18} /> Download my report</button>
        <button type="button" className="v-link" disabled={busy} onClick={() => void onPrint()}><PrintIcon size={16} /> Print it</button>
      </div>

      <h2 className="v-h2">What happens next</h2>
      <ol className="v-steps">
        <li><strong>An officer reads your complaint.</strong> They look at your story, timeline and proof.</li>
        <li><strong>They may call you.</strong> Please keep your phone on.</li>
        <li><strong>Keep your proof safe.</strong> Do not delete messages, call records or payment receipts.</li>
      </ol>

      <aside className="v-urgent" aria-label="If you lost money just now">
        <PhoneIcon size={22} />
        <p><strong>Lost money just now?</strong> Call <a href="tel:1930">1930</a> right away and tell your bank. You can also report at{' '}
          <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer">cybercrime.gov.in</a>.</p>
      </aside>
      <p className="v-fix"><Link to="/" className="v-link">Back to my complaints</Link></p>
    </div>
  );
}
