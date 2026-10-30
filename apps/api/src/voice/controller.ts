import { BadRequestException, Controller, Get, PayloadTooLargeException, Post, Query, Req, UnsupportedMediaTypeException } from '@nestjs/common';
import busboy from 'busboy';
import { Roles } from '../auth/guards';
import { ApiRequest, PlainError, envelope } from '../common/http';
import { AUDIO_MIME, LANGUAGE, MAX_AUDIO_BYTES, transcribe, voiceProvider } from './sarvam';

const recent = new Map<string, number[]>();
const WINDOW_MS = 60_000, MAX_PER_WINDOW = 40;

function throttle(actorId: string) {
  const now = Date.now();
  const hits = (recent.get(actorId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) throw new PlainError(429, 'Voice typing is busy. Please wait a moment and try again.', 'VOICE_BUSY');
  hits.push(now); recent.set(actorId, hits);
}

function readClip(request: ApiRequest): Promise<{ audio: Buffer; mime: string }> {
  return new Promise((resolve, reject) => {
    if (!request.headers['content-type']?.startsWith('multipart/form-data;')) return reject(new UnsupportedMediaTypeException());
    let parser: ReturnType<typeof busboy>;
    try { parser = busboy({ headers: request.headers, limits: { files: 1, fields: 0, parts: 2, fileSize: MAX_AUDIO_BYTES + 1 } }); }
    catch { return reject(new BadRequestException()); }
    const chunks: Buffer[] = []; let size = 0; let mime = ''; let failure: Error | undefined;
    parser.on('file', (field, stream, info) => {
      if (field !== 'file' || !AUDIO_MIME.test(info.mimeType)) { failure = new UnsupportedMediaTypeException(); stream.resume(); return; }
      mime = info.mimeType;
      stream.on('data', (chunk: Buffer) => { size += chunk.length; if (size > MAX_AUDIO_BYTES) { failure = new PayloadTooLargeException(); stream.resume(); } else chunks.push(chunk); });
    });
    parser.on('field', () => { failure = new BadRequestException(); });
    parser.once('error', () => reject(new BadRequestException()));
    parser.once('close', () => failure ? reject(failure) : size ? resolve({ audio: Buffer.concat(chunks), mime }) : reject(new BadRequestException()));
    request.pipe(parser);
  });
}

@Controller('voice')
@Roles('victim')
export class VoiceController {
  @Get('status')
  status(@Req() request: ApiRequest) { return envelope(request, { provider: voiceProvider() }); }

  @Post('transcribe')
  async transcribe(@Query('lang') lang: string | undefined, @Req() request: ApiRequest) {
    const language = lang && LANGUAGE.test(lang) ? lang : 'unknown';
    throttle(request.actor!.id);
    const { audio, mime } = await readClip(request);
    return envelope(request, await transcribe(audio, mime, language));
  }
}
