CREATE SEQUENCE "public"."case_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "case_analyses" (
	"case_id" uuid PRIMARY KEY NOT NULL,
	"state" text DEFAULT 'IDLE' NOT NULL,
	"summary" text,
	"total_loss" numeric(14, 2),
	"missing_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"user_category" boolean DEFAULT false NOT NULL,
	"user_title" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"started_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "case_analyses_state_allowed" CHECK ("case_analyses"."state" IN ('IDLE', 'RUNNING', 'READY', 'FAILED'))
);
--> statement-breakpoint
CREATE TABLE "file_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"evidence_file_id" uuid NOT NULL,
	"status" text NOT NULL,
	"engine" text NOT NULL,
	"excerpt" text,
	"structured_json" jsonb,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_reads_evidence_file_id_unique" UNIQUE("evidence_file_id"),
	CONSTRAINT "file_reads_status_allowed" CHECK ("file_reads"."status" IN ('READ', 'FAILED'))
);
--> statement-breakpoint
CREATE TABLE "narratives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"text" text NOT NULL,
	"channel" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "narratives_channel_allowed" CHECK ("narratives"."channel" IN ('typed', 'voice')),
	CONSTRAINT "narratives_text_bounds" CHECK (length("narratives"."text") BETWEEN 1 AND 20000)
);
--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "reference" text;--> statement-breakpoint
UPDATE "cases" SET "reference" = 'CG-' || to_char("cases"."created_at", 'YYYY') || '-' || lpad(numbered.n::text, 6, '0') FROM (SELECT "id", nextval('case_reference_seq') AS n FROM (SELECT "id" FROM "cases" ORDER BY "created_at", "id") ordered) numbered WHERE "cases"."id" = numbered."id";--> statement-breakpoint
ALTER TABLE "cases" ALTER COLUMN "reference" SET DEFAULT ('CG-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('case_reference_seq')::text, 6, '0'));--> statement-breakpoint
ALTER TABLE "cases" ALTER COLUMN "reference" SET NOT NULL;--> statement-breakpoint
UPDATE "cases" SET "category" = CASE "category" WHEN 'investment' THEN 'investment_scam' WHEN 'friendship' THEN 'romance_scam' WHEN 'payment' THEN 'upi_payment_fraud' ELSE "category" END WHERE "category" IN ('investment', 'friendship', 'payment');--> statement-breakpoint
ALTER TABLE "clarifications" ADD COLUMN "why" text;--> statement-breakpoint
ALTER TABLE "clarifications" ADD COLUMN "options_json" jsonb;--> statement-breakpoint
ALTER TABLE "clarifications" ADD COLUMN "origin" text DEFAULT 'LEGACY' NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_files" ADD COLUMN "original_name" text;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "detail" text;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "at_label" text;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "origin" text DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "sources_json" jsonb;--> statement-breakpoint
ALTER TABLE "case_analyses" ADD CONSTRAINT "case_analyses_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_reads" ADD CONSTRAINT "file_reads_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_reads" ADD CONSTRAINT "file_reads_evidence_file_id_evidence_files_id_fk" FOREIGN KEY ("evidence_file_id") REFERENCES "public"."evidence_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "narratives" ADD CONSTRAINT "narratives_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_reads_case_idx" ON "file_reads" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "narratives_case_idx" ON "narratives" USING btree ("case_id");--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_reference_unique" UNIQUE("reference");