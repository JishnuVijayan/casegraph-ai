CREATE TYPE "public"."case_status" AS ENUM('DRAFT', 'REVIEW_REQUIRED', 'READY_FOR_EXPORT', 'EXPORTED');--> statement-breakpoint
CREATE TYPE "public"."clarification_status" AS ENUM('OPEN', 'ANSWERED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('NEEDS_REVIEW', 'NOT_RELEVANT', 'REVIEWED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('victim', 'analyst', 'admin');--> statement-breakpoint
CREATE TYPE "public"."share_scope" AS ENUM('READ', 'INVESTIGATE');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('OBSERVED_IN_UPLOAD', 'VICTIM_RECOLLECTION', 'SYSTEM_INFERENCE', 'AUTHORIZED_EXTERNAL_RECORD');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('UNVERIFIED', 'USER_CONFIRMED', 'EXTERNALLY_VERIFIED', 'DISPUTED', 'NEEDS_REVIEW');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"scope" "share_scope" NOT NULL,
	"granted_by" uuid NOT NULL,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grants_case_organization_scope_unique" UNIQUE("case_id","organization_id","scope")
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"organization_id" uuid,
	"status" "case_status" DEFAULT 'DRAFT' NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"synthetic" boolean DEFAULT true NOT NULL,
	"incident_start_at" timestamp with time zone,
	"incident_end_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cases_incident_order" CHECK ("cases"."incident_end_at" IS NULL OR "cases"."incident_start_at" IS NULL OR "cases"."incident_end_at" >= "cases"."incident_start_at")
);
--> statement-breakpoint
CREATE TABLE "claim_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"before_json" jsonb NOT NULL,
	"after_json" jsonb NOT NULL,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "claim_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"evidence_file_id" uuid NOT NULL,
	"page" integer,
	"text_span" jsonb,
	"bbox_json" jsonb,
	"audio_offset_ms" integer,
	CONSTRAINT "source_page_positive" CHECK ("claim_sources"."page" IS NULL OR "claim_sources"."page" > 0),
	CONSTRAINT "source_audio_nonnegative" CHECK ("claim_sources"."audio_offset_ms" IS NULL OR "claim_sources"."audio_offset_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"type" text NOT NULL,
	"raw_value" text NOT NULL,
	"normalized_value_json" jsonb,
	"source_kind" "source_kind" NOT NULL,
	"verification_status" "verification_status" DEFAULT 'UNVERIFIED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "claims_id_case_unique" UNIQUE("id","case_id")
);
--> statement-breakpoint
CREATE TABLE "clarifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"prompt" text NOT NULL,
	"answer_json" jsonb,
	"status" "clarification_status" DEFAULT 'OPEN' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_claims" (
	"case_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	CONSTRAINT "event_claims_event_id_claim_id_pk" PRIMARY KEY("event_id","claim_id")
);
--> statement-breakpoint
CREATE TABLE "evidence_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"sha256" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploader_id" uuid NOT NULL,
	"ingest_status" "processing_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_files_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "evidence_id_case_unique" UNIQUE("id","case_id"),
	CONSTRAINT "evidence_size_positive" CHECK ("evidence_files"."size_bytes" > 0),
	CONSTRAINT "evidence_sha256_format" CHECK ("evidence_files"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"object_key" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exports_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "exports_case_version_unique" UNIQUE("case_id","version"),
	CONSTRAINT "exports_version_positive" CHECK ("exports"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "extraction_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evidence_file_id" uuid NOT NULL,
	"engine" text NOT NULL,
	"version" text NOT NULL,
	"status" "processing_status" DEFAULT 'PENDING' NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graph_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"path_json" jsonb NOT NULL,
	"review_status" "review_status" DEFAULT 'NEEDS_REVIEW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"synthetic" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"occurred_at" timestamp with time zone,
	"precision" text NOT NULL,
	"uncertainty" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_id_case_unique" UNIQUE("id","case_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" NOT NULL,
	"organization_id" uuid,
	"demo_subject" text NOT NULL,
	"display_name" text NOT NULL,
	"synthetic" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_demo_subject_unique" UNIQUE("demo_subject")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_access_grants" ADD CONSTRAINT "case_access_grants_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_access_grants" ADD CONSTRAINT "case_access_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_access_grants" ADD CONSTRAINT "case_access_grants_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_revisions" ADD CONSTRAINT "claim_revisions_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_revisions" ADD CONSTRAINT "claim_revisions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_sources" ADD CONSTRAINT "source_claim_same_case" FOREIGN KEY ("claim_id","case_id") REFERENCES "public"."claims"("id","case_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_sources" ADD CONSTRAINT "source_evidence_same_case" FOREIGN KEY ("evidence_file_id","case_id") REFERENCES "public"."evidence_files"("id","case_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clarifications" ADD CONSTRAINT "clarifications_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_claims" ADD CONSTRAINT "event_claim_event_same_case" FOREIGN KEY ("event_id","case_id") REFERENCES "public"."timeline_events"("id","case_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_claims" ADD CONSTRAINT "event_claim_claim_same_case" FOREIGN KEY ("claim_id","case_id") REFERENCES "public"."claims"("id","case_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_files" ADD CONSTRAINT "evidence_files_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_files" ADD CONSTRAINT "evidence_files_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_evidence_file_id_evidence_files_id_fk" FOREIGN KEY ("evidence_file_id") REFERENCES "public"."evidence_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_leads" ADD CONSTRAINT "graph_leads_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_leads" ADD CONSTRAINT "graph_leads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cases_owner_idx" ON "cases" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "cases_organization_idx" ON "cases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "revisions_claim_idx" ON "claim_revisions" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "claim_sources_claim_idx" ON "claim_sources" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "claims_case_idx" ON "claims" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "clarifications_case_idx" ON "clarifications" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "evidence_case_idx" ON "evidence_files" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "extraction_evidence_idx" ON "extraction_runs" USING btree ("evidence_file_id");--> statement-breakpoint
CREATE INDEX "graph_leads_case_org_idx" ON "graph_leads" USING btree ("case_id","organization_id");--> statement-breakpoint
CREATE INDEX "timeline_case_idx" ON "timeline_events" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "users_organization_idx" ON "users" USING btree ("organization_id");