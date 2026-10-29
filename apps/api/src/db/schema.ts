import { sql } from 'drizzle-orm';
import {
  boolean, check, foreignKey, index, integer, jsonb, pgEnum, pgTable,
  primaryKey, text, timestamp, unique, uuid,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').defaultRandom().primaryKey();
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();

export const role = pgEnum('user_role', ['victim', 'analyst', 'admin']);
export const caseStatus = pgEnum('case_status', ['DRAFT', 'REVIEW_REQUIRED', 'READY_FOR_EXPORT', 'EXPORTED']);
export const sourceKind = pgEnum('source_kind', [
  'OBSERVED_IN_UPLOAD', 'VICTIM_RECOLLECTION', 'SYSTEM_INFERENCE', 'AUTHORIZED_EXTERNAL_RECORD',
]);
export const verificationStatus = pgEnum('verification_status', [
  'UNVERIFIED', 'USER_CONFIRMED', 'EXTERNALLY_VERIFIED', 'DISPUTED', 'NEEDS_REVIEW',
]);
export const processingStatus = pgEnum('processing_status', ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED']);
export const reviewStatus = pgEnum('review_status', ['NEEDS_REVIEW', 'NOT_RELEVANT', 'REVIEWED']);
export const clarificationStatus = pgEnum('clarification_status', ['OPEN', 'ANSWERED', 'UNKNOWN']);
export const shareScope = pgEnum('share_scope', ['READ', 'INVESTIGATE']);

export const organizations = pgTable('organizations', {
  id: id(), name: text('name').notNull(), kind: text('kind').notNull(),
  synthetic: boolean('synthetic').default(true).notNull(), createdAt: createdAt(),
});

export const users = pgTable('users', {
  id: id(), role: role('role').notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  demoSubject: text('demo_subject').unique().notNull(), displayName: text('display_name').notNull(),
  synthetic: boolean('synthetic').default(true).notNull(), createdAt: createdAt(),
}, (t) => [index('users_organization_idx').on(t.organizationId)]);

export const cases = pgTable('cases', {
  id: id(), ownerId: uuid('owner_id').notNull().references(() => users.id),
  organizationId: uuid('organization_id').references(() => organizations.id),
  status: caseStatus('status').default('DRAFT').notNull(), category: text('category').notNull(),
  title: text('title').notNull(), synthetic: boolean('synthetic').default(true).notNull(),
  incidentStartAt: timestamp('incident_start_at', { withTimezone: true }),
  incidentEndAt: timestamp('incident_end_at', { withTimezone: true }),
  createdAt: createdAt(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('cases_owner_idx').on(t.ownerId), index('cases_organization_idx').on(t.organizationId),
  check('cases_incident_order', sql`${t.incidentEndAt} IS NULL OR ${t.incidentStartAt} IS NULL OR ${t.incidentEndAt} >= ${t.incidentStartAt}`),
]);

export const caseAccessGrants = pgTable('case_access_grants', {
  id: id(), caseId: uuid('case_id').notNull().references(() => cases.id),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  scope: shareScope('scope').notNull(), grantedBy: uuid('granted_by').notNull().references(() => users.id),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }), createdAt: createdAt(),
}, (t) => [unique('grants_case_organization_scope_unique').on(t.caseId, t.organizationId, t.scope)]);

export const evidenceFiles = pgTable('evidence_files', {
  id: id(), caseId: uuid('case_id').notNull().references(() => cases.id),
  objectKey: text('object_key').unique().notNull(), sha256: text('sha256').notNull(),
  mimeType: text('mime_type').notNull(), sizeBytes: integer('size_bytes').notNull(),
  uploaderId: uuid('uploader_id').notNull().references(() => users.id),
  ingestStatus: processingStatus('ingest_status').default('PENDING').notNull(), createdAt: createdAt(),
}, (t) => [
  index('evidence_case_idx').on(t.caseId), unique('evidence_id_case_unique').on(t.id, t.caseId),
  check('evidence_size_positive', sql`${t.sizeBytes} > 0`),
  check('evidence_sha256_format', sql`${t.sha256} ~ '^[0-9a-f]{64}$'`),
]);

export const extractionRuns = pgTable('extraction_runs', {
  id: id(), evidenceFileId: uuid('evidence_file_id').notNull().references(() => evidenceFiles.id),
  engine: text('engine').notNull(), version: text('version').notNull(),
  status: processingStatus('status').default('PENDING').notNull(),
  errorCode: text('error_code'), createdAt: createdAt(),
}, (t) => [index('extraction_evidence_idx').on(t.evidenceFileId)]);

export const claims = pgTable('claims', {
  id: id(), caseId: uuid('case_id').notNull().references(() => cases.id), type: text('type').notNull(),
  rawValue: text('raw_value').notNull(), normalizedValue: jsonb('normalized_value_json'),
  sourceKind: sourceKind('source_kind').notNull(),
  verificationStatus: verificationStatus('verification_status').default('UNVERIFIED').notNull(),
  createdAt: createdAt(),
}, (t) => [index('claims_case_idx').on(t.caseId), unique('claims_id_case_unique').on(t.id, t.caseId)]);

export const claimSources = pgTable('claim_sources', {
  id: id(), caseId: uuid('case_id').notNull(), claimId: uuid('claim_id').notNull(),
  evidenceFileId: uuid('evidence_file_id').notNull(), page: integer('page'),
  textSpan: jsonb('text_span').$type<{ start: number; end: number }>(),
  boundingBox: jsonb('bbox_json').$type<{ x: number; y: number; width: number; height: number }>(),
  audioOffsetMs: integer('audio_offset_ms'),
}, (t) => [
  index('claim_sources_claim_idx').on(t.claimId),
  foreignKey({ name: 'source_claim_same_case', columns: [t.claimId, t.caseId], foreignColumns: [claims.id, claims.caseId] }),
  foreignKey({ name: 'source_evidence_same_case', columns: [t.evidenceFileId, t.caseId], foreignColumns: [evidenceFiles.id, evidenceFiles.caseId] }),
  check('source_page_positive', sql`${t.page} IS NULL OR ${t.page} > 0`),
  check('source_audio_nonnegative', sql`${t.audioOffsetMs} IS NULL OR ${t.audioOffsetMs} >= 0`),
]);

export const claimRevisions = pgTable('claim_revisions', {
  id: id(), claimId: uuid('claim_id').notNull().references(() => claims.id),
  before: jsonb('before_json').notNull(), after: jsonb('after_json').notNull(),
  changedBy: uuid('changed_by').notNull().references(() => users.id),
  changedAt: timestamp('changed_at', { withTimezone: true }).defaultNow().notNull(), reason: text('reason'),
}, (t) => [index('revisions_claim_idx').on(t.claimId)]);

export const timelineEvents = pgTable('timeline_events', {
  id: id(), caseId: uuid('case_id').notNull().references(() => cases.id),
  eventType: text('event_type').notNull(), occurredAt: timestamp('occurred_at', { withTimezone: true }),
  precision: text('precision').notNull(), uncertainty: text('uncertainty').notNull(), createdAt: createdAt(),
}, (t) => [index('timeline_case_idx').on(t.caseId), unique('events_id_case_unique').on(t.id, t.caseId)]);

export const eventClaims = pgTable('event_claims', {
  caseId: uuid('case_id').notNull(), eventId: uuid('event_id').notNull(), claimId: uuid('claim_id').notNull(),
}, (t) => [
  primaryKey({ columns: [t.eventId, t.claimId] }),
  foreignKey({ name: 'event_claim_event_same_case', columns: [t.eventId, t.caseId], foreignColumns: [timelineEvents.id, timelineEvents.caseId] }),
  foreignKey({ name: 'event_claim_claim_same_case', columns: [t.claimId, t.caseId], foreignColumns: [claims.id, claims.caseId] }),
]);

export const clarifications = pgTable('clarifications', {
  id: id(), caseId: uuid('case_id').notNull().references(() => cases.id), kind: text('kind').notNull(),
  prompt: text('prompt').notNull(), answer: jsonb('answer_json'),
  status: clarificationStatus('status').default('OPEN').notNull(), priority: integer('priority').default(0).notNull(),
  createdAt: createdAt(),
}, (t) => [index('clarifications_case_idx').on(t.caseId)]);

export const graphLeads = pgTable('graph_leads', {
  id: id(), caseId: uuid('case_id').notNull().references(() => cases.id),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  path: jsonb('path_json').notNull(), reviewStatus: reviewStatus('review_status').default('NEEDS_REVIEW').notNull(),
  createdAt: createdAt(),
}, (t) => [index('graph_leads_case_org_idx').on(t.caseId, t.organizationId)]);

export const reportExports = pgTable('exports', {
  id: id(), caseId: uuid('case_id').notNull().references(() => cases.id), version: integer('version').notNull(),
  objectKey: text('object_key').unique().notNull(), createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: createdAt(),
}, (t) => [unique('exports_case_version_unique').on(t.caseId, t.version), check('exports_version_positive', sql`${t.version} > 0`)]);

export const auditEvents = pgTable('audit_events', {
  id: id(), actorId: uuid('actor_id').references(() => users.id),
  action: text('action').notNull(), resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id').notNull(), requestId: uuid('request_id').notNull(), createdAt: createdAt(),
}, (t) => [index('audit_created_idx').on(t.createdAt)]);
