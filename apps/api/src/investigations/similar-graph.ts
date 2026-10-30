import { Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { AccessStore } from '../auth/store';
import { caseAccessGrants, caseAnalyses, cases, claims, graphLeads } from '../db/schema';
import { SimilarCasesProvider } from '../intake/similar';
import { SimilarCase, SimilarStatus, normalizeCategory, categoryLabel as labelOf, SharedEntity } from '../intake/types';
import { TigerGraphClient } from './client';
import { ENTITY_CLAIM_TYPES, NormalizedEntity, entitiesFromClaims } from './entities';
import { GraphRow, MatchedRow, parseGraphRow } from './scoring';

export type SimilarResult = { status: SimilarStatus; cases: SimilarCase[] };
export type PairReview = 'USEFUL' | 'NOT_RELATED';
const MAX_RESULTS = 10;
const UNAVAILABLE: SimilarResult = { status: 'UNAVAILABLE', cases: [] };

/** Build the RESTPP upsert body for one complaint and its entities. Pure; unit-tested. */
export function buildUpsert(complaint: { caseId: string; category: string; reference: string; submittedAt: string; lossAmount: number }, entities: NormalizedEntity[]) {
  const vertices: Record<string, Record<string, unknown>> = {
    Complaint: { [complaint.caseId]: {
      category: { value: complaint.category }, reference: { value: complaint.reference },
      submitted_at: { value: complaint.submittedAt }, loss_amount: { value: complaint.lossAmount },
    } },
  };
  if (entities.length) {
    vertices.Entity = Object.fromEntries(entities.map((e) => [e.id, { entity_kind: { value: e.kind }, entity_value: { value: e.value } }]));
  }
  const edges = entities.length ? { Complaint: { [complaint.caseId]: { MENTIONS: { Entity: Object.fromEntries(
    entities.map((e) => [e.id, { entity_kind: { value: e.kind } }])) } } } } : undefined;
  return { vertices, ...(edges ? { edges } : {}) };
}

/**
 * Case network over TigerGraph (graph CaseGraphV2). findSimilar upserts the complaint then asks
 * for similar complaints. It never invents results: any failure => UNAVAILABLE.
 */
@Injectable()
export class SimilarGraphService implements SimilarCasesProvider {
  constructor(private readonly access: AccessStore, private readonly graph: TigerGraphClient) {}

  get enabled() { return this.graph.enabled; }

  async entitiesOf(caseId: string): Promise<NormalizedEntity[]> {
    const rows = await this.access.available((db) => db.select({ type: claims.type, rawValue: claims.rawValue }).from(claims)
      .where(and(eq(claims.caseId, caseId), inArray(claims.type, ENTITY_CLAIM_TYPES))));
    return entitiesFromClaims(rows);
  }

  private async complaint(caseId: string) {
    const [row] = await this.access.available((db) => db.select({
      id: cases.id, reference: cases.reference, category: cases.category, status: cases.status, updatedAt: cases.updatedAt,
      synthetic: cases.synthetic, totalLoss: caseAnalyses.totalLoss,
    }).from(cases).leftJoin(caseAnalyses, eq(caseAnalyses.caseId, cases.id)).where(eq(cases.id, caseId)));
    return row;
  }

  /** Push one Postgres case into the case network (replaces its mentions). */
  async upsertCase(caseId: string, signal: AbortSignal = AbortSignal.timeout(15000)): Promise<number> {
    const row = await this.complaint(caseId);
    if (!row || !row.synthetic) throw new Error('Unknown case');
    const entities = await this.entitiesOf(caseId);
    await this.graph.clearMentionsV2(caseId, signal).catch(() => undefined); // none yet on first upsert
    await this.graph.upsertV2(buildUpsert({
      caseId, category: normalizeCategory(row.category), reference: row.reference,
      submittedAt: row.updatedAt.toISOString(), lossAmount: row.totalLoss ? Number(row.totalLoss) : 0,
    }, entities), signal);
    return entities.length;
  }

  /** Query only (no upsert). Throws when the graph cannot answer. */
  async query(caseId: string, signal: AbortSignal = AbortSignal.timeout(12000)): Promise<SimilarResult> {
    const blocks = await this.graph.queryV2('similar_cases', { case_id: caseId, max_results: MAX_RESULTS }, signal);
    // The query prints one vertex set; take the first array in the result whatever its key.
    const rows = blocks.flatMap((b) => Object.values(b)).find((v) => Array.isArray(v)) as GraphRow[] | undefined;
    if (!rows) throw new Error('Unexpected graph response');
    const matched = rows.map(parseGraphRow).filter((m) => m.caseId !== caseId);
    const cases_ = await this.hydrate(matched);
    return { status: cases_.length ? 'READY' : 'NONE', cases: cases_ };
  }

  /** Only submitted complaints the demo consortium can investigate are ever shown. */
  private async hydrate(matched: MatchedRow[]): Promise<SimilarCase[]> {
    if (!matched.length) return [];
    const organizationId = this.access.fixtures.organization.id!;
    const ids = matched.map((m) => m.caseId);
    const rows = await this.access.available((db) => db.select({
      id: cases.id, reference: cases.reference, category: cases.category, title: cases.title, updatedAt: cases.updatedAt,
      summary: caseAnalyses.summary, totalLoss: caseAnalyses.totalLoss,
    }).from(cases).leftJoin(caseAnalyses, eq(caseAnalyses.caseId, cases.id))
      .where(and(inArray(cases.id, ids), eq(cases.synthetic, true), eq(cases.status, 'REVIEW_REQUIRED'), sql`exists (select 1 from ${caseAccessGrants} where
        ${caseAccessGrants.caseId} = ${cases.id} and ${caseAccessGrants.organizationId} = ${organizationId} and
        ${caseAccessGrants.grantedBy} = ${cases.ownerId} and ${caseAccessGrants.scope} = 'INVESTIGATE' and ${caseAccessGrants.revokedAt} is null and
        (${caseAccessGrants.expiresAt} is null or ${caseAccessGrants.expiresAt} > now()))`)));
    const byId = new Map(rows.map((r) => [r.id, r]));
    const out: SimilarCase[] = [];
    for (const m of matched) {
      const row = byId.get(m.caseId);
      if (!row) continue;
      const category = normalizeCategory(row.category);
      const loss = row.totalLoss && Number(row.totalLoss) > 0 ? { amount: Number(row.totalLoss), currency: 'INR' as const } : null;
      out.push({ caseId: row.id, reference: row.reference, category, categoryLabel: labelOf(category), title: row.title,
        summary: row.summary ?? '', loss, submittedAt: row.updatedAt.toISOString(), score: m.score, shared: m.shared, reason: m.reason });
    }
    return out.sort((a, b) => b.score - a.score || b.submittedAt.localeCompare(a.submittedAt));
  }

  /** Contract entry point used by submit: upsert, then query, then persist. */
  async findSimilar(caseId: string): Promise<SimilarResult> {
    if (!this.graph.enabled) return this.remember(caseId, UNAVAILABLE);
    try {
      await this.upsertCase(caseId);
      return await this.remember(caseId, await this.query(caseId));
    } catch {
      return this.remember(caseId, UNAVAILABLE);
    }
  }

  /** Officer view: fresh answer from the graph; UNAVAILABLE rather than stale or invented data. */
  async refresh(caseId: string): Promise<SimilarResult> {
    if (!this.graph.enabled) return UNAVAILABLE;
    try {
      const fresh = await this.query(caseId);
      return await this.remember(caseId, fresh);
    } catch {
      return UNAVAILABLE;
    }
  }

  // --- persistence in graph_leads (json; no migration) -------------------------------------

  private async remember(caseId: string, result: SimilarResult): Promise<SimilarResult> {
    try {
      const organizationId = this.access.fixtures.organization.id!;
      const snapshot = { version: 2, kind: 'SIMILAR_SNAPSHOT', status: result.status, capturedAt: new Date().toISOString(), cases: result.cases };
      await this.access.available(async (db) => {
        const [existing] = await db.select({ id: graphLeads.id }).from(graphLeads)
          .where(and(eq(graphLeads.caseId, caseId), sql`${graphLeads.path}->>'kind' = 'SIMILAR_SNAPSHOT'`));
        if (existing) await db.update(graphLeads).set({ path: snapshot, createdAt: new Date() }).where(eq(graphLeads.id, existing.id));
        else await db.insert(graphLeads).values({ caseId, organizationId, path: snapshot, reviewStatus: 'NEEDS_REVIEW' });
      });
    } catch { /* persistence is best-effort; the live answer is still returned */ }
    return result;
  }

  /** Stored snapshot status and count per case, for the officer list. */
  async storedCounts(caseIds: string[]): Promise<Map<string, { status: SimilarStatus; count: number }>> {
    const out = new Map<string, { status: SimilarStatus; count: number }>();
    if (!caseIds.length) return out;
    const rows = await this.access.available((db) => db.select({ caseId: graphLeads.caseId, path: graphLeads.path }).from(graphLeads)
      .where(and(inArray(graphLeads.caseId, caseIds), sql`${graphLeads.path}->>'kind' = 'SIMILAR_SNAPSHOT'`)));
    for (const row of rows) {
      const p = row.path as { status?: SimilarStatus; cases?: unknown[] };
      if (p?.status && Array.isArray(p.cases)) out.set(row.caseId, { status: p.status, count: p.cases.length });
    }
    return out;
  }

  async reviews(caseId: string): Promise<Map<string, PairReview>> {
    const rows = await this.access.available((db) => db.select({ path: graphLeads.path }).from(graphLeads)
      .where(and(eq(graphLeads.caseId, caseId), sql`${graphLeads.path}->>'kind' = 'SIMILAR_REVIEW'`)));
    const out = new Map<string, PairReview>();
    for (const row of rows) {
      const p = row.path as { otherId?: string; status?: PairReview };
      if (p?.otherId && (p.status === 'USEFUL' || p.status === 'NOT_RELATED')) out.set(p.otherId, p.status);
    }
    return out;
  }

  async review(caseId: string, otherId: string, status: PairReview): Promise<void> {
    const organizationId = this.access.fixtures.organization.id!;
    const path = { version: 2, kind: 'SIMILAR_REVIEW', otherId, status };
    const reviewStatus = status === 'USEFUL' ? 'REVIEWED' as const : 'NOT_RELEVANT' as const;
    await this.access.available(async (db) => {
      const [existing] = await db.select({ id: graphLeads.id }).from(graphLeads)
        .where(and(eq(graphLeads.caseId, caseId), sql`${graphLeads.path}->>'kind' = 'SIMILAR_REVIEW'`, sql`${graphLeads.path}->>'otherId' = ${otherId}`));
      if (existing) await db.update(graphLeads).set({ path, reviewStatus }).where(eq(graphLeads.id, existing.id));
      else await db.insert(graphLeads).values({ caseId, organizationId, path, reviewStatus });
    });
  }
}

export const sharedBetween = (a: SharedEntity[], b: SharedEntity[]) => a.filter((x) => b.some((y) => y.kind === x.kind && y.value === x.value));
