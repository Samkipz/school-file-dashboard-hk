CREATE TABLE "assessment_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"assessment_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"title" varchar(160) NOT NULL,
	"instructions" varchar(4000),
	"starts_on" date,
	"due_on" date,
	CONSTRAINT "assessment_tasks_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "assessment_tasks_school_id_assessment_id_ordinal_unique" UNIQUE("school_id","assessment_id","ordinal"),
	CONSTRAINT "assessment_task_ordinal" CHECK ("assessment_tasks"."ordinal" between 1 and 100),
	CONSTRAINT "assessment_task_title" CHECK (length(btrim("assessment_tasks"."title")) > 0),
	CONSTRAINT "assessment_task_dates" CHECK ("assessment_tasks"."starts_on" is null or "assessment_tasks"."due_on" is null or "assessment_tasks"."starts_on" <= "assessment_tasks"."due_on"),
	CONSTRAINT "assessment_task_version" CHECK ("assessment_tasks"."row_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "assessment_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"code" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "assessment_types_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "assessment_types_school_id_code_unique" UNIQUE("school_id","code"),
	CONSTRAINT "assessment_type_code" CHECK ("assessment_types"."code" ~ '^[A-Z][A-Z0-9_]{0,63}$'),
	CONSTRAINT "assessment_type_name" CHECK (length(btrim("assessment_types"."name")) > 0),
	CONSTRAINT "assessment_type_version" CHECK ("assessment_types"."row_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"offering_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"term_id" uuid,
	"assessment_type_id" uuid NOT NULL,
	"title" varchar(160) NOT NULL,
	"instructions" varchar(4000),
	"starts_on" date,
	"due_on" date,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	CONSTRAINT "assessments_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "assessment_draft_status" CHECK ("assessments"."status" = 'draft'),
	CONSTRAINT "assessment_title" CHECK (length(btrim("assessments"."title")) > 0),
	CONSTRAINT "assessment_dates" CHECK ("assessments"."starts_on" is null or "assessments"."due_on" is null or "assessments"."starts_on" <= "assessments"."due_on"),
	CONSTRAINT "assessment_version" CHECK ("assessments"."row_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "subject_offerings" ADD CONSTRAINT "offering_year_context_unique" UNIQUE("school_id","id","academic_year_id");
--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "term_year_context_unique" UNIQUE("school_id","id","academic_year_id");
--> statement-breakpoint
ALTER TABLE "assessment_tasks" ADD CONSTRAINT "assessment_tasks_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_tasks" ADD CONSTRAINT "assessment_tasks_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_tasks" ADD CONSTRAINT "assessment_tasks_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_tasks" ADD CONSTRAINT "assessment_tasks_school_id_assessment_id_assessments_school_id_id_fk" FOREIGN KEY ("school_id","assessment_id") REFERENCES "public"."assessments"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_types" ADD CONSTRAINT "assessment_types_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_types" ADD CONSTRAINT "assessment_types_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_types" ADD CONSTRAINT "assessment_types_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_school_id_assessment_type_id_assessment_types_school_id_id_fk" FOREIGN KEY ("school_id","assessment_type_id") REFERENCES "public"."assessment_types"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessment_offering_year_fk" FOREIGN KEY ("school_id","offering_id","academic_year_id") REFERENCES "public"."subject_offerings"("school_id","id","academic_year_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessment_term_year_fk" FOREIGN KEY ("school_id","term_id","academic_year_id") REFERENCES "public"."terms"("school_id","id","academic_year_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessment_task_creator_idx" ON "assessment_tasks" USING btree ("created_by_actor_id");--> statement-breakpoint
CREATE INDEX "assessment_task_updater_idx" ON "assessment_tasks" USING btree ("updated_by_actor_id");--> statement-breakpoint
CREATE INDEX "assessment_type_creator_idx" ON "assessment_types" USING btree ("created_by_actor_id");--> statement-breakpoint
CREATE INDEX "assessment_type_updater_idx" ON "assessment_types" USING btree ("updated_by_actor_id");--> statement-breakpoint
CREATE INDEX "assessment_offering_idx" ON "assessments" USING btree ("school_id","offering_id","academic_year_id");--> statement-breakpoint
CREATE INDEX "assessment_term_idx" ON "assessments" USING btree ("school_id","term_id","academic_year_id");--> statement-breakpoint
CREATE INDEX "assessment_type_idx" ON "assessments" USING btree ("school_id","assessment_type_id");--> statement-breakpoint
CREATE INDEX "assessment_year_idx" ON "assessments" USING btree ("school_id","academic_year_id");--> statement-breakpoint
CREATE INDEX "assessment_creator_idx" ON "assessments" USING btree ("created_by_actor_id");--> statement-breakpoint
CREATE INDEX "assessment_updater_idx" ON "assessments" USING btree ("updated_by_actor_id");--> statement-breakpoint

