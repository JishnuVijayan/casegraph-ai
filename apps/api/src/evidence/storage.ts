import { BadRequestException, HttpException, Inject, Injectable, PayloadTooLargeException, ServiceUnavailableException, UnsupportedMediaTypeException } from '@nestjs/common';
import busboy from 'busboy';
import sharp from 'sharp';
import { createHash, randomUUID } from 'node:crypto';
import { constants, createWriteStream } from 'node:fs';
import { chmod, link, lstat, mkdir, open, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ApiRequest } from '../common/http';

export const EVIDENCE_DIRECTORY = Symbol('EVIDENCE_DIRECTORY');
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class EvidenceStorage {
  private active = false;
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
    if (this.active) throw new HttpException('Upload busy', 429);
    this.active = true;
    const id = randomUUID();
    const temporary = join(this.directory, `${id}.part`);
    let ownsTemporary = false;
    try {
      await this.ready();
      if (!request.headers['content-type']?.startsWith('multipart/form-data;')) throw new UnsupportedMediaTypeException();
      if (Number(request.headers['content-length'] ?? 0) > MAX_FILE_BYTES + 16384) throw new PayloadTooLargeException();
      let mime = ''; let size = 0; let files = 0;
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
          if (field !== 'file' || !['image/png', 'image/jpeg'].includes(info.mimeType)) {
            failure = new UnsupportedMediaTypeException(); stream.resume(); return;
          }
          mime = info.mimeType;
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
      try { header = Buffer.alloc(8); await handle.read(header, 0, 8, 0); } finally { await handle.close(); }
      const png = header.equals(Buffer.from([137,80,78,71,13,10,26,10]));
      const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
      if ((mime === 'image/png' && !png) || (mime === 'image/jpeg' && !jpeg)) throw new UnsupportedMediaTypeException();
      try {
        const image = sharp(temporary, { limitInputPixels: 16_000_000, failOn: 'warning' }).timeout({ seconds: 5 });
        const metadata = await image.metadata();
        if (!['png', 'jpeg'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1 ||
          !metadata.width || !metadata.height || metadata.width > 8192 || metadata.height > 8192) throw new Error('Invalid image');
        // Decode a working view only. Its output is discarded; originals are never transformed.
        await image.raw().toBuffer();
      } catch { throw new UnsupportedMediaTypeException(); }
      return { id, temporary, mimeType: mime, sizeBytes: size, sha256: hash.digest('hex') };
    } catch (error) {
      request.res?.setHeader('Connection', 'close');
      if (ownsTemporary) await unlink(temporary).catch(() => undefined);
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    } finally { this.active = false; }
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
