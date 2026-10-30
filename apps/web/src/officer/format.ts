import type { EntityKind, Money } from '../types.v2';

export const KIND_LABEL: Record<EntityKind, string> = {
  phone: 'Phone number', upi: 'UPI ID', bank_account: 'Bank account', url: 'Website', email: 'Email',
  person_name: 'Name', app_name: 'App', ifsc: 'IFSC code', social_handle: 'Social handle',
};
export const KIND_SHORT: Record<EntityKind, string> = {
  phone: 'Phone', upi: 'UPI', bank_account: 'Account', url: 'Website', email: 'Email',
  person_name: 'Name', app_name: 'App', ifsc: 'IFSC', social_handle: 'Handle',
};

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
export function formatMoney(m: Money | null | undefined): string {
  return m ? `₹${inr.format(m.amount)}` : 'Not stated';
}
export function formatCompactMoney(amount: number): string {
  if (amount >= 1e7) return `₹${(amount / 1e7).toFixed(2)} Cr`;
  if (amount >= 1e5) return `₹${(amount / 1e5).toFixed(2)} L`;
  return `₹${inr.format(amount)}`;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.round((now - t) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? 'yesterday' : `${d} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function exactTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function isToday(iso: string, now = new Date()): boolean {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';
}
