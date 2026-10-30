import { OcrFailure, type Region } from './types';

/** Shared amount detection over word-level OCR regions (Tesseract or Textract). */
export function detectAmounts(words: Region[]): Region[] {
  const amounts: Region[] = [];
  for (let i = 0; i < words.length; i++) {
    const current = words[i], previous = words[i - 1];
    const number = /^(?:₹|Rs\.?|INR)?\s?\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?$|^(?:₹|Rs\.?|INR)?\s?\d{4,9}(?:\.\d{1,2})?$/i.test(current.text);
    const currencyPrefix = /^(?:₹|Rs\.?|INR)$/i.test(current.text);
    const next = words[i + 1];
    if (currencyPrefix && next && /^\d[\d,.]{0,12}$/.test(next.text)) {
      const a = current.boundingBox, b = next.boundingBox;
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      amounts.push({ kind: 'AMOUNT', text: `${current.text} ${next.text}`,
        textSpan: { start: current.textSpan.start, end: next.textSpan.end },
        boundingBox: { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x,
          height: Math.max(a.y + a.height, b.y + b.height) - y },
        confidence: Math.min(current.confidence, next.confidence) });
      i++; continue;
    }
    if (number && (/[₹]/.test(current.text) || /^(?:Rs\.?|INR)/i.test(current.text) ||
      (previous && /^(?:₹|Rs\.?|INR)$/i.test(previous.text)))) {
      amounts.push({ ...current, kind: 'AMOUNT' });
    }
  }
  return amounts;
}

export function finalizeRegions(words: Region[], outputText: string): { outputText: string; regions: Region[] } {
  if (outputText.length > 65536 || words.length > 1000) throw new OcrFailure('OCR_OUTPUT_LIMIT');
  return { outputText, regions: [...words, ...detectAmounts(words)] };
}
