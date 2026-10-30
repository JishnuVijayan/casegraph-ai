import { useEffect, useRef, type ReactNode } from 'react';
import type { CategoryId, EntityKind } from '../types.v2';
import { KIND_SHORT } from './format';
import { useToast } from './toast';

const CAT_TONE: Record<CategoryId, string> = {
  upi_payment_fraud: 'blue', investment_scam: 'amber', job_or_task_scam: 'teal', loan_app_harassment: 'red',
  phishing_or_kyc: 'blue', sextortion_blackmail: 'red', romance_scam: 'amber', account_hacking: 'teal',
  online_shopping: 'green', impersonation: 'amber', online_harassment: 'red', identity_theft: 'blue', malware_or_ransomware: 'teal',
  fake_profile: 'amber', other: '',
};
export function CategoryChip({ id, label }: { id: CategoryId; label: string }) {
  const tone = CAT_TONE[id];
  return <span className={`cg-chip ${tone ? `cg-chip--${tone}` : ''}`}>{label}</span>;
}

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const p: Record<string, ReactNode> = {
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></>,
    check: <path d="m5 12 5 5 9-10" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    print: <><path d="M7 9V3h10v6" /><rect x="4" y="9" width="16" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>,
    download: <><path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>,
    external: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
    back: <path d="m15 5-7 7 7 7" />,
    link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" /></>,
    file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    next: <path d="m9 5 7 7-7 7" />,
    thumb: <><path d="M7 11v9H4v-9z" /><path d="M7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.7 9H19a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 18 19H7" /></>,
    off: <><circle cx="12" cy="12" r="8" /><path d="m6.3 6.3 11.4 11.4" /></>,
    out: <><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" /><path d="m16 8 4 4-4 4" /><path d="M20 12H9" /></>,
    shield: <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {p[name]}
    </svg>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }
}
export function CopyButton({ value, label }: { value: string; label: string }) {
  const toast = useToast();
  return (
    <button type="button" className="o-icon-btn" aria-label={`Copy ${label}`} title={`Copy ${label}`}
      onClick={async () => toast((await copyText(value)) ? `${label} copied` : 'Could not copy. Select the text and copy it manually.', 'ok')}>
      <Icon name="copy" size={15} />
    </button>
  );
}

export function EntityPill({ kind, value, strength, extra }: { kind: EntityKind; value: string; strength?: 'STRONG' | 'WEAK'; extra?: string }) {
  const toast = useToast();
  return (
    <button type="button" className={`o-entity ${strength ? `o-entity--${strength.toLowerCase()}` : ''}`}
      title={`${strength === 'WEAK' ? 'Weaker match. ' : strength === 'STRONG' ? 'Strong match. ' : ''}Click to copy`}
      onClick={async () => toast((await copyText(value)) ? `${KIND_SHORT[kind]} copied` : 'Could not copy.')}>
      <span className="o-entity__kind">{KIND_SHORT[kind]}</span>
      <span className="o-entity__val mono">{value}</span>
      {extra && <span className="o-entity__extra">{extra}</span>}
    </button>
  );
}

export function Skeleton({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="cg-skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />;
}

export function ErrorState({ message, onRetry, title = 'This could not be loaded' }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <div className="o-state o-state--error" role="alert">
      <h3>{title}</h3><p>{message}</p>
      {onRetry && <button className="cg-btn cg-btn--ghost cg-btn--sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}

/** Modal dialog with focus trap, Esc to close, focus restore. */
export function Modal({ label, onClose, children, wide }: { label: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const root = ref.current!;
    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')).filter((e) => !e.hasAttribute('disabled'));
    (root.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? root).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const f = focusables(); if (!f.length) return;
        const first = f[0]!, last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="o-modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={`o-modal ${wide ? 'o-modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>{children}</div>
    </div>
  );
}
