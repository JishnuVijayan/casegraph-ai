export type OcrErrorCode = 'OCR_UNAVAILABLE' | 'OCR_TIMEOUT' | 'OCR_OUTPUT_LIMIT' | 'OCR_FAILED';
export class OcrFailure extends Error { constructor(readonly code: OcrErrorCode) { super(code); } }
export type Region = { kind: 'TEXT' | 'AMOUNT'; text: string; textSpan: { start: number; end: number };
  boundingBox: { x: number; y: number; width: number; height: number }; confidence: number };
