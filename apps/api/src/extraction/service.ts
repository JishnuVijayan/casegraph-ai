import { ForbiddenException, Inject, Injectable, Optional, StreamableFile } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import sharp from 'sharp';
import { AccessStore } from '../auth/store';
import { ApiRequest } from '../common/http';
import { auditEvents, extractionRegions, extractionRuns } from '../db/schema';
import { EvidenceService } from '../evidence/service';
import { OcrFailure, parseTsv, TESSERACT_BINARY, tesseractTsv, tesseractVersion, type Region } from './tesseract';
import { runTextract, TEXTRACT_CLIENT, textractEnabled, type TextractClientLike, createDefaultTextractClient } from './textract';

@Injectable()
export class ExtractionService {
  private active = false;
  private textractClient: TextractClientLike | null | undefined;
  constructor(private readonly access: AccessStore, private readonly evidence: EvidenceService,
    @Inject(TESSERACT_BINARY) private readonly binary: string,
    @Optional() @Inject(TEXTRACT_CLIENT) private readonly injectedTextract?: TextractClientLike | null) {}
  private async result(run: typeof extractionRuns.$inferSelect) {
    const regions = run.status === 'SUCCEEDED' ? await this.access.available((db) => db.select({
      id: extractionRegions.id, kind: extractionRegions.kind, text: extractionRegions.text,
      textSpan: extractionRegions.textSpan, boundingBox: extractionRegions.boundingBox,
      confidence: extractionRegions.confidence,
    }).from(extractionRegions).where(eq(extractionRegions.runId, run.id)).orderBy(extractionRegions.id)) : [];
    return { id: run.id, evidenceId: run.evidenceFileId, engine: run.engine, version: run.version,
      status: run.status, errorCode: run.errorCode, outputText: run.outputText, regions,
      amountStatus: regions.some((region) => region.kind === 'AMOUNT') ? 'OBSERVED_IN_UPLOAD' : 'UNKNOWN',
      verificationStatus: 'UNVERIFIED', createdAt: run.createdAt };
  }
  private async textract(): Promise<TextractClientLike | null> {
    if (!textractEnabled()) return null;
    if (this.injectedTextract !== undefined) return this.injectedTextract;
    if (this.textractClient !== undefined) return this.textractClient;
    try { this.textractClient = await createDefaultTextractClient(); }
    catch { this.textractClient = null; }
    return this.textractClient;
  }
  async get(request: ApiRequest, evidenceId: string) {
    await this.evidence.readVerified(request, evidenceId);
    const [run] = await this.access.available((db) => db.select().from(extractionRuns)
      .where(eq(extractionRuns.evidenceFileId, evidenceId)).orderBy(desc(extractionRuns.createdAt), desc(extractionRuns.id)).limit(1));
    const response = run ? await this.result(run) : { evidenceId, status: 'PENDING', amountStatus: 'UNKNOWN', regions: [] };
    await this.access.findCase(request.actor!, request.caseRecord!.id, 'READ');
    await this.access.audit(request.actor!, 'EXTRACTION_READ', 'evidence', evidenceId, request.requestId);
    return response;
  }
  async crop(request: ApiRequest, evidenceId: string, regionId: string) {
    const { row, bytes } = await this.evidence.readVerified(request, evidenceId);
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(regionId)) throw new ForbiddenException();
    const [region] = await this.access.available((db) => db.select({
      box: extractionRegions.boundingBox,
    }).from(extractionRegions).innerJoin(extractionRuns, eq(extractionRegions.runId, extractionRuns.id))
      .where(and(eq(extractionRegions.id, regionId), eq(extractionRuns.evidenceFileId, row.id))));
    if (!region) throw new ForbiddenException();
    const metadata = await sharp(bytes, { limitInputPixels: 16_000_000 }).metadata();
    const widthPx = metadata.width ?? 0, heightPx = metadata.height ?? 0, box = region.box;
    const left = Math.floor(box.x * widthPx), top = Math.floor(box.y * heightPx);
    const right = Math.ceil((box.x + box.width) * widthPx), bottom = Math.ceil((box.y + box.height) * heightPx);
    const width = Math.min(widthPx, right) - left, height = Math.min(heightPx, bottom) - top;
    if (width < 1 || height < 1 || left < 0 || top < 0) throw new ForbiddenException();
    const image = await sharp(bytes, { limitInputPixels: 16_000_000 }).extract({ left, top, width, height }).png().toBuffer();
    await this.access.findCase(request.actor!, request.caseRecord!.id, 'READ');
    await this.access.audit(request.actor!, 'EXTRACTION_REGION_READ', 'evidence', row.id, request.requestId);
    return new StreamableFile(image, { type: 'image/png', length: image.length });
  }
  private async persist(request: ApiRequest, evidenceId: string, engine: string, version: string,
    failure: OcrFailure | undefined, outputText: string | null, regions: Region[]) {
    await this.access.findCase(request.actor!, request.caseRecord!.id, 'READ');
    const row = await this.access.available((db) => db.transaction(async (tx) => {
      const [inserted] = await tx.insert(extractionRuns).values({ evidenceFileId: evidenceId,
        engine, version, status: failure ? 'FAILED' : 'SUCCEEDED',
        errorCode: failure?.code, outputText }).onConflictDoNothing().returning();
      const [run] = inserted ? [inserted] : await tx.select().from(extractionRuns).where(and(
        eq(extractionRuns.evidenceFileId, evidenceId), eq(extractionRuns.engine, engine), eq(extractionRuns.version, version)));
      if (inserted && regions.length) await tx.insert(extractionRegions).values(regions.map((region) => ({ runId: run.id, ...region })));
      await tx.insert(auditEvents).values({ actorId: request.actor!.id, action: 'EXTRACTION_RUN',
        resourceType: 'evidence', resourceId: evidenceId, requestId: request.requestId });
      return run;
    }));
    const response = await this.result(row);
    await this.access.findCase(request.actor!, request.caseRecord!.id, 'READ');
    return response;
  }
  async run(request: ApiRequest, evidenceId: string) {
    const { bytes } = await this.evidence.readVerified(request, evidenceId);
    if (this.active) return { evidenceId, status: 'RUNNING', amountStatus: 'UNKNOWN', regions: [] };
    this.active = true;
    try {
      const client = await this.textract();
      if (client) {
        try {
          const extracted = await runTextract(client, bytes);
          const [prior] = await this.access.available((db) => db.select().from(extractionRuns).where(and(
            eq(extractionRuns.evidenceFileId, evidenceId), eq(extractionRuns.engine, 'textract'),
            eq(extractionRuns.version, extracted.version))).limit(1));
          if (prior) {
            const response = await this.result(prior);
            await this.access.findCase(request.actor!, request.caseRecord!.id, 'READ');
            return response;
          }
          return await this.persist(request, evidenceId, 'textract', extracted.version, undefined, extracted.outputText, extracted.regions);
        } catch {
          // Fall through to local Tesseract; never invent OCR content.
        }
      }

      let version = 'unavailable'; let failure: OcrFailure | undefined;
      try { version = await tesseractVersion(this.binary); }
      catch (error) { failure = error instanceof OcrFailure ? error : new OcrFailure('OCR_UNAVAILABLE'); }
      const [prior] = await this.access.available((db) => db.select().from(extractionRuns).where(and(
        eq(extractionRuns.evidenceFileId, evidenceId), eq(extractionRuns.engine, 'tesseract'), eq(extractionRuns.version, version))).limit(1));
      if (prior) {
        const response = await this.result(prior);
        await this.access.findCase(request.actor!, request.caseRecord!.id, 'READ');
        return response;
      }
      let outputText: string | null = null;
      let regions: Region[] = [];
      if (!failure) {
        try {
          const metadata = await sharp(bytes, { limitInputPixels: 16_000_000 }).metadata();
          if (!metadata.width || !metadata.height) throw new OcrFailure('OCR_FAILED');
          const result = parseTsv(await tesseractTsv(this.binary, bytes), metadata.width, metadata.height);
          outputText = result.outputText; regions = result.regions;
        } catch (error) { failure = error instanceof OcrFailure ? error : new OcrFailure('OCR_FAILED'); }
      }
      return await this.persist(request, evidenceId, 'tesseract', version, failure, outputText, regions);
    } finally { this.active = false; }
  }
}
