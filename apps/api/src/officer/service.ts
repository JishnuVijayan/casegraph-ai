import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { AccessStore } from '../auth/store';
import { ApiRequest } from '../common/http';
import { caseAnalyses, cases, users } from '../db/schema';
import { renderDossierHtml } from '../exports/dossier';
import { ExportsService } from '../exports/service';
import { Brief, SharedEntity, SimilarCase, Victim, categoryLabel, isCategoryId, normalizeCategory } from '../intake/types';
import { maskMobile, strengthOf } from '../investigations/entities';
import { PairReview, SimilarGraphService } from '../investigations/similar-graph';
import { BRIEF_READER, BriefReader } from './brief-reader';

const SORTS = ['newest', 'loss', 'similar'] as const;
type ListQuery = { q?: string; category?: string; sort?: string };

/** Mobile is stored on the intake victim's demo subject (`intake:<mobile>`); seeded fixture users have none. */
export const mobileOf = (demoSubject: string): string | null => (demoSubject.startsWith('intake:') ? demoSubject.slice(7) : null);

@Injectable()
export class OfficerService {
  constructor(private readonly access: AccessStore, private readonly similar: SimilarGraphService,
    @Inject(BRIEF_READER) private readonly briefs: BriefReader, private readonly exports: ExportsService) {}

  private analyst(req: ApiRequest) {
    if (req.actor?.role !== 'analyst' || !req.actor.organizationId) throw new ForbiddenException();
    return req.actor;
  }

  async list(req: ApiRequest, query: ListQuery) {
    const actor = this.analyst(req);
    const visible = await this.access.list(actor); // submitted only, org grant required
    if (!visible.length) return [];
    const ids = visible.map((v) => v.id);
    const rows = await this.access.available((db) => db.select({
      id: cases.id, reference: cases.reference, title: cases.title, category: cases.category, updatedAt: cases.updatedAt,
      victimName: users.displayName, demoSubject: users.demoSubject, totalLoss: caseAnalyses.totalLoss, missing: caseAnalyses.missing,
    }).from(cases).innerJoin(users, eq(users.id, cases.ownerId)).leftJoin(caseAnalyses, eq(caseAnalyses.caseId, cases.id))
      .where(inArray(cases.id, ids)));
    // Prefer live fill when submit-time graph was down so the inbox matches the case page.
    const counts = await this.similar.ensureCounts(ids);
    // Same number the case file shows, so the inbox and the case page never disagree.
    const percents = new Map<string, number>();
    await Promise.all(ids.slice(0, 200).map(async (id) => {
      try { percents.set(id, (await this.briefs.briefFor(id)).completeness.percent); } catch { /* fall back below */ }
    }));
    let items = rows.map((r) => {
      const category = normalizeCategory(r.category);
      const mobile = mobileOf(r.demoSubject);
      const loss = r.totalLoss && Number(r.totalLoss) > 0 ? { amount: Number(r.totalLoss), currency: 'INR' as const } : null;
      return { id: r.id, reference: r.reference, title: r.title, category, categoryLabel: categoryLabel(category),
        victimName: r.victimName, victimMobileMasked: mobile ? maskMobile(mobile) : '', loss, submittedAt: r.updatedAt.toISOString(),
        similarCount: counts.get(r.id)?.count ?? 0,
        completenessPercent: percents.get(r.id) ?? Math.max(0, 100 - (Array.isArray(r.missing) ? r.missing.length : 0) * 20), _mobile: mobile ?? '' };
    });
    const category = query.category?.trim();
    if (category && isCategoryId(category)) items = items.filter((i) => i.category === category);
    const q = query.q?.trim().toLowerCase().slice(0, 100);
    if (q) {
      const digits = q.replace(/\D/g, '');
      items = items.filter((i) => [i.reference, i.title, i.victimName, i.categoryLabel].some((v) => v.toLowerCase().includes(q))
        || (digits.length >= 4 && i._mobile.includes(digits)));
    }
    const sort = (SORTS as readonly string[]).includes(query.sort ?? '') ? query.sort : 'newest';
    items.sort((a, b) => sort === 'loss' ? (b.loss?.amount ?? 0) - (a.loss?.amount ?? 0)
      : sort === 'similar' ? b.similarCount - a.similarCount || b.submittedAt.localeCompare(a.submittedAt)
        : b.submittedAt.localeCompare(a.submittedAt));
    return items.map(({ _mobile, ...rest }) => rest);
  }

  private async submittedBrief(caseId: string): Promise<Brief> {
    const brief = await this.briefs.briefFor(caseId);
    if (brief.status !== 'SUBMITTED') throw new ForbiddenException(); // officers never see drafts
    return brief;
  }
  private async victimOf(caseId: string): Promise<Victim> {
    const [row] = await this.access.available((db) => db.select({ name: users.displayName, subject: users.demoSubject })
      .from(cases).innerJoin(users, eq(users.id, cases.ownerId)).where(eq(cases.id, caseId)));
    return { name: row?.name ?? 'Unknown', mobile: row ? mobileOf(row.subject) : null };
  }

  async detail(req: ApiRequest) {
    const actor = this.analyst(req);
    const caseId = req.caseRecord!.id;
    const brief = await this.submittedBrief(caseId);
    const [victim, similar, reviews] = await Promise.all([this.victimOf(caseId), this.similar.refresh(caseId), this.similar.reviews(caseId).catch(() => new Map<string, PairReview>())]);
    await this.access.audit(actor, 'OFFICER_CASE_VIEWED', 'case', caseId, req.requestId);
    return { brief, victim, similar: { ...similar, reviews: Object.fromEntries(reviews) } };
  }

  async pair(req: ApiRequest, otherId: string) {
    const actor = this.analyst(req);
    const caseId = req.caseRecord!.id;
    await this.access.findCase(actor, otherId, 'READ'); // same org-grant check on the other case
    const [brief, mine, theirs] = await Promise.all([this.submittedBrief(otherId), this.similar.entitiesOf(caseId), this.similar.entitiesOf(otherId)]);
    const shared: SharedEntity[] = mine.filter((m) => theirs.some((t) => t.id === m.id)).map((m) => ({ kind: m.kind, value: m.value, strength: strengthOf(m.kind) }))
      .sort((a, b) => (a.strength === b.strength ? a.kind.localeCompare(b.kind) : a.strength === 'STRONG' ? -1 : 1));
    await this.access.audit(actor, 'OFFICER_SIMILAR_VIEWED', 'case', otherId, req.requestId);
    return { brief, shared };
  }

  async review(req: ApiRequest, otherId: string, status: PairReview) {
    const actor = this.analyst(req);
    const caseId = req.caseRecord!.id;
    if (otherId === caseId) throw new ForbiddenException();
    await this.access.findCase(actor, otherId, 'READ');
    await this.similar.review(caseId, otherId, status);
    await this.access.audit(actor, status === 'USEFUL' ? 'SIMILAR_MARKED_USEFUL' : 'SIMILAR_MARKED_NOT_RELATED', 'case', caseId, req.requestId);
    return { caseId, otherId, status };
  }

  async dossier(req: ApiRequest): Promise<string> {
    const actor = this.analyst(req);
    const caseId = req.caseRecord!.id;
    const brief = await this.submittedBrief(caseId);
    const [victim, similar] = await Promise.all([this.victimOf(caseId), this.similar.refresh(caseId)]);
    await this.access.audit(actor, 'OFFICER_DOSSIER_VIEWED', 'case', caseId, req.requestId);
    return renderDossierHtml(brief, victim, similar, new Date(), await this.exports.images(req, brief));
  }
}
export type { SimilarCase };
