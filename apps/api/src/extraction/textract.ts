import { finalizeRegions } from './regions';
import { OcrFailure, type Region } from './types';

export const TEXTRACT_CLIENT = Symbol('TEXTRACT_CLIENT');
export type TextractWordBlock = {
  BlockType?: string;
  Text?: string;
  Confidence?: number;
  Geometry?: { BoundingBox?: { Left?: number; Top?: number; Width?: number; Height?: number } };
};
export type TextractDetectResult = { Blocks?: TextractWordBlock[]; DetectDocumentTextModelVersion?: string };

export type TextractClientLike = {
  send: (command: { input: { Document: { Bytes: Uint8Array } } }) => Promise<TextractDetectResult>;
};

export function textractEnabled(): boolean {
  const flag = process.env.TEXTRACT_ENABLED ?? 'false';
  if (!['true', 'false'].includes(flag)) throw new Error('TEXTRACT_ENABLED must be true or false.');
  return flag === 'true';
}

export function parseTextractBlocks(blocks: TextractWordBlock[] | undefined): { outputText: string; regions: Region[]; version: string } {
  const words: Region[] = [];
  let outputText = '';
  for (const block of blocks ?? []) {
    if (block.BlockType !== 'WORD' || !block.Text) continue;
    const text = block.Text.trim();
    const box = block.Geometry?.BoundingBox;
    const left = Number(box?.Left), top = Number(box?.Top), w = Number(box?.Width), h = Number(box?.Height);
    const confidence = Number(block.Confidence ?? 0);
    if (!text || text.length > 256 || ![left, top, w, h, confidence].every(Number.isFinite) ||
      left < 0 || top < 0 || w <= 0 || h <= 0 || left + w > 1.0001 || top + h > 1.0001 || confidence < 0 || confidence > 100) continue;
    if (words.length >= 1000 || outputText.length + text.length + 1 > 65536) throw new OcrFailure('OCR_OUTPUT_LIMIT');
    const start = outputText.length + (outputText ? 1 : 0);
    outputText += `${outputText ? ' ' : ''}${text}`;
    words.push({
      kind: 'TEXT', text, textSpan: { start, end: outputText.length },
      boundingBox: {
        x: Math.max(0, Math.min(1, left)), y: Math.max(0, Math.min(1, top)),
        width: Math.max(0, Math.min(1 - left, w)), height: Math.max(0, Math.min(1 - top, h)),
      },
      confidence: Math.round(confidence),
    });
  }
  const finalized = finalizeRegions(words, outputText);
  return { ...finalized, version: 'detect-document-text' };
}

export async function runTextract(client: TextractClientLike, bytes: Buffer): Promise<{ outputText: string; regions: Region[]; version: string }> {
  if (bytes.length > 5 * 1024 * 1024) throw new OcrFailure('OCR_FAILED');
  try {
    const response = await client.send({ input: { Document: { Bytes: bytes } } });
    return parseTextractBlocks(response.Blocks);
  } catch (error) {
    if (error instanceof OcrFailure) throw error;
    throw new OcrFailure('OCR_UNAVAILABLE');
  }
}

/** Lazy AWS SDK client; only constructed when TEXTRACT_ENABLED=true. */
export async function createDefaultTextractClient(): Promise<TextractClientLike> {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const { TextractClient, DetectDocumentTextCommand } = await import('@aws-sdk/client-textract');
  const client = new TextractClient({ region });
  return {
    send: async (command) => client.send(new DetectDocumentTextCommand(command.input)),
  };
}
