ALTER TABLE "clarifications" ADD COLUMN "fingerprint" text;--> statement-breakpoint
ALTER TABLE "clarifications" ADD COLUMN "context_json" jsonb;--> statement-breakpoint
ALTER TABLE "clarifications" ADD CONSTRAINT "clarifications_case_fingerprint_unique" UNIQUE("case_id","fingerprint");