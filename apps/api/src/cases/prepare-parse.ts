/** Deterministic text heuristics for prepare — not bank verification. */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

const AMOUNT = /(?:₹|Rs\.?|INR)\s*((?:\d{1,2}(?:,\d{2})*,\d{3})|(?:\d{1,3}(?:,\d{3})+)|\d{1,9})(?:\.(\d{1,2}))?/gi;
/** Bare currency-looking amounts common when OCR drops the symbol onto another line. */
const BARE_AMOUNT = /(?:^|[^\d])((?:\d{1,2}(?:,\d{2})*,\d{3})|(?:\d{1,3}(?:,\d{3})+)|[1-9]\d{2,5})(?:\.(\d{2}))?(?!\d)/g;
const LABELED_REF = /\b(?:UPI\s*(?:transaction\s*)?(?:id|ref(?:erence)?)?|Txn(?:\s*id)?|Transaction\s*(?:id|ref(?:erence)?)?|Ref(?:erence)?(?:\s*(?:no|number|id))?|UTR|RRN|Order\s*id)[:\s#.-]*([A-Z0-9]{8,24})\b/gi;
const UPI_SLASH = /\bUPI[/-]([A-Z0-9]{8,24})\b/gi;
const ISO_DATE = /\b(20\d{2}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}(?::\d{2})?)(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?)?\b/g;
const SLASH_DATE = /\b(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2}|\d{2})\b/g;
const DAY_MONTH_YEAR = /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?,?\s+(20\d{2}|\d{2})\b/gi;
const MONTH_DAY_YEAR = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2}),?\s+(20\d{2}|\d{2})\b/gi;
const CLOCK = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?\b/gi;

export type ParsedHints = {
  amounts: string[];
  references: string[];
  incidentTimes: string[];
};

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    out.push(key);
  }
  return out;
}

function expandYear(year: string): string {
  if (year.length === 4) return year;
  const n = Number(year);
  return String(2000 + n);
}

function validCalendarDay(isoDate: string): boolean {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === isoDate;
}

function toIncidentTime(isoDate: string, hour = 0, minute = 0, second = 0): string | null {
  if (!validCalendarDay(isoDate)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const stamp = `${isoDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.000Z`;
  const parsed = Date.parse(stamp);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function parseClock(match: RegExpMatchArray): { hour: number; minute: number; second: number } | null {
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? '0');
  const meridiem = (match[4] ?? '').toLowerCase();
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

function formatAmount(rupees: string, paise?: string): string {
  const clean = rupees.replaceAll(',', '');
  return paise ? `INR ${clean}.${paise}` : `INR ${clean}`;
}

function nearestClock(text: string, around: number): { hour: number; minute: number; second: number } | null {
  CLOCK.lastIndex = 0;
  let best: { hour: number; minute: number; second: number; distance: number } | null = null;
  for (const match of text.matchAll(CLOCK)) {
    const clock = parseClock(match);
    if (!clock || match.index === undefined) continue;
    const distance = Math.abs(match.index - around);
    // Prefer a clock within ~40 chars of the date (same screenshot line / block).
    if (distance > 40) continue;
    if (!best || distance < best.distance) best = { ...clock, distance };
  }
  return best ? { hour: best.hour, minute: best.minute, second: best.second } : null;
}

export function parsePrepareHints(...chunks: Array<string | null | undefined>): ParsedHints {
  // Collapse OCR noise while keeping word boundaries for labeled fields.
  const text = chunks.filter(Boolean).join('\n').replace(/[^\S\n]+/g, ' ').trim();
  const amounts: string[] = [];
  const references: string[] = [];
  const incidentTimes: string[] = [];

  for (const match of text.matchAll(AMOUNT)) {
    amounts.push(formatAmount(match[1], match[2]));
  }
  if (!amounts.length) {
    for (const match of text.matchAll(BARE_AMOUNT)) {
      const whole = match[1];
      // Skip years and obvious non-amount digit runs.
      if (/^20\d{2}$/.test(whole.replaceAll(',', ''))) continue;
      amounts.push(formatAmount(whole, match[2]));
    }
  }

  for (const match of text.matchAll(LABELED_REF)) {
    const value = match[1].toUpperCase();
    // Avoid capturing the word TRANSACTION as the id when OCR splits lines badly.
    if (/^(TRANSACTION|REFERENCE|NUMBER|ORDER)$/i.test(value)) continue;
    references.push(value.startsWith('UPI') ? value : value);
  }
  for (const match of text.matchAll(UPI_SLASH)) {
    references.push(`UPI/${match[1].toUpperCase()}`);
  }
  // Common 12-digit UPI transaction ids when a label appeared nearby but capture missed.
  if (!references.length) {
    const labeledWindow = /(?:UPI|Txn|Transaction|UTR|RRN|Ref)[\s\S]{0,40}?(\d{12})\b/gi;
    for (const match of text.matchAll(labeledWindow)) references.push(match[1]);
  }

  const pushDate = (iso: string, index: number, explicitClock?: { hour: number; minute: number; second: number }) => {
    const clock = explicitClock ?? nearestClock(text, index);
    const time = clock
      ? toIncidentTime(iso, clock.hour, clock.minute, clock.second)
      : toIncidentTime(iso);
    if (time) incidentTimes.push(time);
  };

  for (const match of text.matchAll(ISO_DATE)) {
    if (match.index === undefined) continue;
    if (match[2]) {
      const [h, m, s] = match[2].split(':').map(Number);
      pushDate(match[1], match.index, { hour: h, minute: m, second: s || 0 });
    } else {
      pushDate(match[1], match.index);
    }
  }

  for (const match of text.matchAll(SLASH_DATE)) {
    if (match.index === undefined) continue;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = expandYear(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    pushDate(iso, match.index);
  }

  for (const match of text.matchAll(DAY_MONTH_YEAR)) {
    if (match.index === undefined) continue;
    const day = Number(match[1]);
    const month = MONTHS[match[2].toLowerCase()];
    const year = expandYear(match[3]);
    if (!month || day < 1 || day > 31) continue;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    pushDate(iso, match.index);
  }

  for (const match of text.matchAll(MONTH_DAY_YEAR)) {
    if (match.index === undefined) continue;
    const month = MONTHS[match[1].toLowerCase()];
    const day = Number(match[2]);
    const year = expandYear(match[3]);
    if (!month || day < 1 || day > 31) continue;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    pushDate(iso, match.index);
  }

  return {
    amounts: unique(amounts).slice(0, 3),
    references: unique(references).slice(0, 3),
    incidentTimes: unique(incidentTimes).slice(0, 2),
  };
}
