import { spawn } from 'node:child_process';
import { finalizeRegions } from './regions';
import { OcrFailure, type Region } from './types';

export { OcrFailure, type Region, type OcrErrorCode } from './types';
export const TESSERACT_BINARY = Symbol('TESSERACT_BINARY');

async function invoke(binary: string, args: string[], input?: Buffer, timeoutMs = 8000, maxOutput = 512 * 1024) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(binary, args, { shell: false, stdio: ['pipe', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH ?? '', OMP_THREAD_LIMIT: '1', LC_ALL: 'C' } });
    const output: Buffer[] = []; let length = 0; let settled = false; let limit = false; let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    const finish = (failure?: OcrFailure, value?: string) => {
      if (settled) return; settled = true; clearTimeout(timer);
      if (failure) reject(failure); else resolve(value ?? '');
    };
    child.stdout.on('data', (chunk: Buffer) => {
      length += chunk.length;
      if (length > maxOutput) { limit = true; child.kill('SIGKILL'); }
      else output.push(chunk);
    });
    // Never log or return OCR diagnostics: they may contain uploaded text.
    child.stderr.resume();
    child.on('error', () => finish(new OcrFailure('OCR_UNAVAILABLE')));
    child.on('close', (code) => {
      if (timedOut) finish(new OcrFailure('OCR_TIMEOUT'));
      else if (limit) finish(new OcrFailure('OCR_OUTPUT_LIMIT'));
      else if (code !== 0) finish(new OcrFailure('OCR_FAILED'));
      else finish(undefined, Buffer.concat(output).toString('utf8'));
    });
    if (input) child.stdin.end(input); else child.stdin.end();
    child.stdin.on('error', () => undefined);
  });
}

export async function tesseractVersion(binary: string) {
  const value = await invoke(binary, ['--version'], undefined, 3000, 4096);
  const match = /^tesseract\s+(\d+\.\d+(?:\.\d+)?)/m.exec(value);
  if (!match) throw new OcrFailure('OCR_UNAVAILABLE');
  return match[1];
}
export async function tesseractTsv(binary: string, bytes: Buffer) {
  return invoke(binary, ['stdin', 'stdout', '-l', 'eng', '--psm', '6', 'tsv'], bytes);
}

export function parseTsv(tsv: string, width: number, height: number): { outputText: string; regions: Region[] } {
  const words: Region[] = []; let outputText = '';
  for (const line of tsv.split(/\r?\n/).slice(1)) {
    const cells = line.split('\t');
    if (cells.length < 12 || cells[0] !== '5') continue;
    const text = cells.slice(11).join('\t').trim();
    const left = Number(cells[6]), top = Number(cells[7]), w = Number(cells[8]), h = Number(cells[9]), confidence = Number(cells[10]);
    if (!text || text.length > 256 || ![left, top, w, h, confidence].every(Number.isFinite) ||
      left < 0 || top < 0 || w <= 0 || h <= 0 || left + w > width || top + h > height || confidence < 0 || confidence > 100) continue;
    if (words.length >= 1000 || outputText.length + text.length + 1 > 65536) throw new OcrFailure('OCR_OUTPUT_LIMIT');
    const start = outputText.length + (outputText ? 1 : 0);
    outputText += `${outputText ? ' ' : ''}${text}`;
    words.push({ kind: 'TEXT', text, textSpan: { start, end: outputText.length },
      boundingBox: { x: left / width, y: top / height, width: w / width, height: h / height }, confidence: Math.round(confidence) });
  }
  return finalizeRegions(words, outputText);
}
