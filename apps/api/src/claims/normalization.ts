const currencyAmount = /^(?:₹|Rs\.?|INR)\s*((?:\d{1,2}(?:,\d{2})*,\d{3})|(?:\d{1,3}(?:,\d{3})+)|\d{1,9})(?:\.(\d{1,2}))?$/i;

export function normalizeClaimValue(type: string, rawValue: string): Record<string, string> | null {
  if (type !== 'payment_amount') return null;
  const match = currencyAmount.exec(rawValue.trim());
  if (!match) return null;
  const rupees = match[1].replaceAll(',', '');
  const paise = (match[2] ?? '').padEnd(2, '0');
  return { currency: 'INR', amountMinorUnits: String(BigInt(rupees) * 100n + BigInt(paise || '0')) };
}
