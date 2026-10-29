CREATE TABLE "extraction_regions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"text_span" jsonb NOT NULL,
	"bbox_json" jsonb NOT NULL,
	"confidence" integer NOT NULL,
	CONSTRAINT "extraction_regions_kind" CHECK ("extraction_regions"."kind" IN ('TEXT', 'AMOUNT')),
	CONSTRAINT "extraction_regions_confidence" CHECK ("extraction_regions"."confidence" >= 0 AND "extraction_regions"."confidence" <= 100),
	CONSTRAINT "extraction_regions_text_nonempty" CHECK (length("extraction_regions"."text") > 0),
	CONSTRAINT "extraction_regions_span_bounds" CHECK (jsonb_typeof("extraction_regions"."text_span") = 'object' AND ("extraction_regions"."text_span"->>'start')::integer >= 0 AND ("extraction_regions"."text_span"->>'end')::integer > ("extraction_regions"."text_span"->>'start')::integer),
	CONSTRAINT "extraction_regions_bbox_bounds" CHECK (jsonb_typeof("extraction_regions"."bbox_json") = 'object' AND ("extraction_regions"."bbox_json"->>'x')::numeric >= 0 AND ("extraction_regions"."bbox_json"->>'y')::numeric >= 0 AND ("extraction_regions"."bbox_json"->>'width')::numeric > 0 AND ("extraction_regions"."bbox_json"->>'height')::numeric > 0 AND ("extraction_regions"."bbox_json"->>'x')::numeric + ("extraction_regions"."bbox_json"->>'width')::numeric <= 1 AND ("extraction_regions"."bbox_json"->>'y')::numeric + ("extraction_regions"."bbox_json"->>'height')::numeric <= 1)
);
--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD COLUMN "output_text" text;--> statement-breakpoint
ALTER TABLE "extraction_regions" ADD CONSTRAINT "extraction_regions_run_id_extraction_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."extraction_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extraction_regions_run_idx" ON "extraction_regions" USING btree ("run_id");--> statement-breakpoint
ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_file_engine_version_unique" UNIQUE("evidence_file_id","engine","version");