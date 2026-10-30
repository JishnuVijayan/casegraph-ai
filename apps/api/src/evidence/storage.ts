import { BadRequestException, HttpException, Inject, Injectable, PayloadTooLargeException, ServiceUnavailableException, UnsupportedMediaTypeException } from '@nestjs/common';
import busboy from 'busboy';
import sharp from 'sharp';
import { createHash, randomUUID } from 'node:crypto';
import { constants, createWriteStream } from 'node:fs';
import { chmod, link, lstat, mkdir, open, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ApiRequest } from '../common/http';

export const EVIDENCE_DIRECTORY = Symbol('EVIDENCE_DIRECTORY');
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', DOCX];
/** Plain, bounded display name: no path, no control characters. */
export function cleanFileName(name: string | undefined): string | null {
  const base = (name ?? '').split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120);
  return base || null;
}

/** A few files at once is normal (people add several screenshots together); more than this waits and retries. */
const MAX_PARALLEL_UPLOADS = 4;

@Injectable()
export class EvidenceStorage {
  private active = 0;
  constructor(@Inject(EVIDENCE_DIRECTORY) readonly directory: string) {}
  async ready() {
    for (const path of [join(this.directory, '..'), this.directory]) {
      try { await mkdir(path, { mode: 0o700 }); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new ServiceUnavailableException();
      }
      const stat = await lstat(path);
      if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o700) throw new ServiceUnavailableException();
    }
  }
  async receive(request: ApiRequest) {
    if (this.active >= MAX_PARALLEL_UPLOADS) throw new HttpException('Upload busy', 429);
    this.active++;
    const id = randomUUID();
    const temporary = join(this.directory, `${id}.part`);
    let ownsTemporary = false;
    try {
      await this.ready();
      if (!request.headers['content-type']?.startsWith('multipart/form-data;')) throw new UnsupportedMediaTypeException();
      if (Number(request.headers['content-length'] ?? 0) > MAX_FILE_BYTES + 16384) throw new PayloadTooLargeException();
      let mime = ''; let size = 0; let files = 0; let originalName: string | null = null;
      let failure: Error | undefined;
      let fileTask: Promise<void> = Promise.resolve();
      const hash = createHash('sha256');
      let parser: ReturnType<typeof busboy>;
      try { parser = busboy({ headers: request.headers, limits: { files: 1, fields: 0, parts: 2, fileSize: MAX_FILE_BYTES + 1, headerPairs: 32 } }); }
      catch { throw new BadRequestException(); }
      const abort = new AbortController();
      const timer = setTimeout(() => { abort.abort(); parser.destroy(new BadRequestException()); }, 15000);
      try {
        parser.on('file', (field, stream, info) => {
          files++;
          if (field !== 'file' || !ALLOWED_MIME.includes(info.mimeType)) {
            failure = new UnsupportedMediaTypeException(); stream.resume(); return;
          }
          mime = info.mimeType; originalName = cleanFileName(info.filename);
          stream.on('limit', () => { failure = new PayloadTooLargeException(); });
          const meter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
            size += chunk.length;
            if (size > MAX_FILE_BYTES) { failure = new PayloadTooLargeException(); return callback(failure); }
            hash.update(chunk); callback(null, chunk);
          } });
          // Open exclusively before writing; cleanup never targets a pre-existing file.
          fileTask = (async () => {
            const handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
            ownsTemporary = true;
            try {
              await pipeline(stream, meter, createWriteStream(temporary, { fd: handle.fd, autoClose: false }), { signal: abort.signal });
              await handle.sync();
            } finally { await handle.close().catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EBADF') throw error; }); }
          })().catch((error: Error) => { failure ??= error; parser.destroy(error); });
        });
        parser.on('field', () => { failure = new BadRequestException(); });
        parser.on('fieldsLimit', () => { failure = new BadRequestException(); });
        parser.on('filesLimit', () => { failure = new BadRequestException(); });
        parser.on('partsLimit', () => { failure = new BadRequestException(); });
        await new Promise<void>((resolve, reject) => {
          let total = 0;
          const count = (chunk: Buffer) => {
            total += chunk.length;
            if (total > MAX_FILE_BYTES + 16384) parser.destroy(new PayloadTooLargeException());
          };
          const aborted = () => parser.destroy(new BadRequestException());
          request.on('data', count); request.once('aborted', aborted);
          const cleanup = () => { request.off('data', count); request.off('aborted', aborted); request.unpipe(parser); };
          parser.once('close', () => { cleanup(); resolve(); });
          parser.once('error', (error) => { cleanup(); request.resume(); reject(error); });
          request.pipe(parser);
        });
        await fileTask;
      } catch (error) {
        await fileTask;
        if (failure instanceof HttpException) throw failure;
        if (error instanceof HttpException) throw error;
        throw new BadRequestException();
      } finally { clearTimeout(timer); }
      if (failure) throw failure;
      if (files !== 1 || !size || !mime) throw new BadRequestException();
      const handle = await open(temporary, constants.O_RDONLY | constants.O_NOFOLLOW);
      let header: Buffer;
      try { header = Buffer.alloc(12); await handle.read(header, 0, 12, 0); } finally { await handle.close(); }
      const png = header.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
      const webp = header.subarray(0, 4).toString('latin1') === 'RIFF' && header.subarray(8, 12).toString('latin1') === 'WEBP';
      const pdf = header.subarray(0, 5).toString('latin1') === '%PDF-';
      const zip = header[0] === 0x50 && header[1] === 0x4b && header[2] === 3 && header[3] === 4;
      const magic: Record<string, boolean> = { 'image/png': png, 'image/jpeg': jpeg, 'image/webp': webp, 'application/pdf': pdf, [DOCX]: zip };
      if (mime in magic && !magic[mime]) throw new UnsupportedMediaTypeException();
      if (mime.startsWith('image/')) {
        try {
          const image = sharp(temporary, { limitInputPixels: 16_000_000, failOn: 'warning' }).timeout({ seconds: 5 });
          const metadata = await image.metadata();
          if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1 ||
            !metadata.width || !metadata.height || metadata.width > 8192 || metadata.height > 8192) throw new Error('Invalid image');
          // Decode a working view only. Its output is discarded; originals are never transformed.
          await image.raw().toBuffer();
        } catch { throw new UnsupportedMediaTypeException(); }
      } else {
        const whole = await readFile(temporary);
        if (mime === 'text/plain') {
          // Must be UTF-8 text without NUL bytes.
          if (whole.includes(0) || Buffer.from(whole.toString('utf8'), 'utf8').compare(whole) !== 0) throw new UnsupportedMediaTypeException();
        } else if (mime === DOCX) {
          // A Word document is a zip that carries word/document.xml.
          if (!whole.includes('word/document.xml')) throw new UnsupportedMediaTypeException();
        } else if (!whole.subarray(Math.max(0, whole.length - 2048)).includes('%%EOF')) throw new UnsupportedMediaTypeException();
      }
      return { id, temporary, mimeType: mime, sizeBytes: size, sha256: hash.digest('hex'), originalName };
    } catch (error) {
      request.res?.setHeader('Connection', 'close');
      if (ownsTemporary) await unlink(temporary).catch(() => undefined);
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    } finally { this.active--; }
  }
  async publish(temporary: string, id: string) {
    const path = this.path(id);
    await chmod(temporary, 0o400);
    await link(temporary, path); // Atomic and exclusive: never replace an existing original.
    try { await unlink(temporary); } catch (error) { await unlink(path).catch(() => undefined); throw error; }
    return path;
  }
  path(id: string) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new ServiceUnavailableException();
    return join(this.directory, `${id}.original`);
  }
}
