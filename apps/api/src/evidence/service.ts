import { ConflictException, ForbiddenException, Injectable, ServiceUnavailableException, StreamableFile } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { constants } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { AccessStore } from '../auth/store';
import { ApiRequest } from '../common/http';
import {
  auditEvents, cases, claimRevisions, claimSources, claims, eventClaims,
  evidenceFiles, extractionRegions, extractionRuns,
} from '../db/schema';
import { EvidenceStorage } from './storage';

const projection = { id: evidenceFiles.id, caseId: evidenceFiles.caseId, mimeType: evidenceFiles.mimeType,
  sizeBytes: evidenceFiles.sizeBytes, sha256: evidenceFiles.sha256, createdAt: evidenceFiles.createdAt };

@Injectable()
export class EvidenceService {
  constructor(private readonly access: AccessStore, private readonly storage: EvidenceStorage) {}
  async upload(request: ApiRequest) {
    const received = await this.storage.receive(request);
    let published = false; let committed = false;
    try {
      const result = await this.access.available((db) => db.transaction(async (tx) => {
        // Recheck ownership after the stream completes, before committing metadata.
        const [owned] = await tx.select({ id: cases.id }).from(cases).where(and(eq(cases.id, request.caseRecord!.id),
          eq(cases.ownerId, request.actor!.id), eq(cases.synthetic, true))).for('update');
        if (!owned) throw new ForbiddenException();
        await this.storage.publish(received.temporary, received.id); published = true;
        const [row] = await tx.insert(evidenceFiles).values({ id: received.id, caseId: owned.id,
          uploaderId: request.actor!.id, objectKey: `${received.id}.original`, sha256: received.sha256,
          sizeBytes: received.sizeBytes, mimeType: received.mimeType, ingestStatus: 'SUCCEEDED' }).returning(projection);
        await tx.insert(auditEvents).values({ actorId: request.actor!.id, action: 'EVIDENCE_UPLOADED', resourceType: 'evidence', resourceId: received.id, requestId: request.requestId });
        return row;
      }));
      committed = true;
      return result;
    } finally {
      // Cleanup only this request's UUID paths; never touch an existing source.
      await unlink(received.temporary).catch(() => undefined);
      if (published && !committed) {
        // A lost COMMIT acknowledgement is ambiguous. Only delete after confirming no row exists.
        try {
          const rows = await this.access.available((db) => db.select({ id: evidenceFiles.id }).from(evidenceFiles).where(eq(evidenceFiles.id, received.id)));
          if (!rows.length) await unlink(this.storage.path(received.id)).catch(() => undefined);
        } catch { /* Preserve private orphan for deliberate reconciliation if DB is unavailable. */ }
      }
    }
  }
  async list(request: ApiRequest) {
    const rows = await this.access.available((db) => db.select(projection).from(evidenceFiles)
      .where(eq(evidenceFiles.caseId, request.caseRecord!.id)).orderBy(evidenceFiles.createdAt, evidenceFiles.id));
    await this.access.audit(request.actor!, 'EVIDENCE_LISTED', 'case', request.caseRecord!.id, request.requestId);
    return rows;
  }
  async original(request: ApiRequest, id: string) {
    const { row, bytes } = await this.readVerified(request, id);
    await this.access.audit(request.actor!, 'EVIDENCE_READ', 'evidence', row.id, request.requestId);
    return new StreamableFile(bytes, { type: row.mimeType || 'application/octet-stream',
      disposition: `inline; filename="${row.id}.${row.mimeType === 'image/png' ? 'png' : 'jpg'}"`, length: bytes.length });
  }

  /** Victim may remove an upload only while the complaint is still a draft. */
  async remove(request: ApiRequest, id: string) {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new ForbiddenException();
    const actor = request.actor!, caseId = request.caseRecord!.id;
    if (actor.role !== 'victim') throw new ForbiddenException();
    await this.access.available((db) => db.transaction(async (tx) => {
      const [owned] = await tx.select({ id: cases.id, status: cases.status }).from(cases).where(and(
        eq(cases.id, caseId), eq(cases.ownerId, actor.id), eq(cases.synthetic, true))).for('update');
      if (!owned) throw new ForbiddenException();
      if (owned.status !== 'DRAFT') throw new ConflictException('Submitted complaints cannot remove evidence.');
      const [row] = await tx.select({ id: evidenceFiles.id }).from(evidenceFiles)
        .where(and(eq(evidenceFiles.id, id), eq(evidenceFiles.caseId, caseId))).for('update');
      if (!row) throw new ForbiddenException();

      const linked = await tx.select({ claimId: claimSources.claimId }).from(claimSources)
        .where(and(eq(claimSources.caseId, caseId), eq(claimSources.evidenceFileId, id)));
      const claimIds = [...new Set(linked.map((item) => item.claimId))];
      if (claimIds.length) {
        await tx.delete(eventClaims).where(and(eq(eventClaims.caseId, caseId), inArray(eventClaims.claimId, claimIds)));
        await tx.delete(claimSources).where(and(eq(claimSources.caseId, caseId), eq(claimSources.evidenceFileId, id)));
        await tx.delete(claimRevisions).where(inArray(claimRevisions.claimId, claimIds));
        await tx.delete(claims).where(and(eq(claims.caseId, caseId), inArray(claims.id, claimIds)));
      } else {
        await tx.delete(claimSources).where(and(eq(claimSources.caseId, caseId), eq(claimSources.evidenceFileId, id)));
      }

      const runs = await tx.select({ id: extractionRuns.id }).from(extractionRuns).where(eq(extractionRuns.evidenceFileId, id));
      if (runs.length) {
        const runIds = runs.map((run) => run.id);
        await tx.delete(extractionRegions).where(inArray(extractionRegions.runId, runIds));
        await tx.delete(extractionRuns).where(inArray(extractionRuns.id, runIds));
      }
      await tx.delete(evidenceFiles).where(and(eq(evidenceFiles.id, id), eq(evidenceFiles.caseId, caseId)));
      await tx.insert(auditEvents).values({
        actorId: actor.id, action: 'EVIDENCE_REMOVED', resourceType: 'evidence', resourceId: id, requestId: request.requestId,
      });
    }));
    await unlink(this.storage.path(id)).catch(() => undefined);
    return { removed: true, id };
  }

  async readVerified(request: ApiRequest, id: string) {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new ForbiddenException();
    const row = await this.access.available(async (db) => {
      const [record] = await db.select().from(evidenceFiles).where(and(eq(evidenceFiles.id, id), eq(evidenceFiles.caseId, request.caseRecord!.id)));
      if (!record) throw new ForbiddenException();
      return record;
    });
    await this.storage.ready();
    let handle;
    try { handle = await open(this.storage.path(row.id), constants.O_RDONLY | constants.O_NOFOLLOW); }
    catch { throw new ServiceUnavailableException(); }
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 5 * 1024 * 1024 || stat.size !== row.sizeBytes || (stat.mode & 0o777) !== 0o400) throw new ServiceUnavailableException();
      // Verify bounded original before releasing any bytes. Also detects local tampering.
      const bytes = await handle.readFile();
      if (bytes.length > 5 * 1024 * 1024 || createHash('sha256').update(bytes).digest('hex') !== row.sha256) throw new ServiceUnavailableException();
      await this.access.findCase(request.actor!, request.caseRecord!.id, 'READ');
      return { row, bytes };
    } finally { await handle.close(); }
  }
}
