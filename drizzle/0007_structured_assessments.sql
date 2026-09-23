CREATE TABLE "assessment_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"task_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" varchar(4000),
	CONSTRAINT "assessment_criteria_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "assessment_criteria_school_id_task_id_ordinal_unique" UNIQUE("school_id","task_id","ordinal"),
	CONSTRAINT "criterion_title" CHECK (length(btrim("assessment_criteria"."title", U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0),
	CONSTRAINT "criterion_order" CHECK ("assessment_criteria"."ordinal" between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "assessment_indicators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"criterion_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"descriptor" varchar(1000) NOT NULL,
	"score_units" integer NOT NULL,
	CONSTRAINT "assessment_indicators_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "assessment_indicators_school_id_criterion_id_ordinal_unique" UNIQUE("school_id","criterion_id","ordinal"),
	CONSTRAINT "assessment_indicators_school_id_criterion_id_score_units_unique" UNIQUE("school_id","criterion_id","score_units"),
	CONSTRAINT "indicator_descriptor" CHECK (length(btrim("assessment_indicators"."descriptor", U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0),
	CONSTRAINT "indicator_order" CHECK ("assessment_indicators"."ordinal" between 1 and 100),
	CONSTRAINT "indicator_score" CHECK ("assessment_indicators"."score_units" between 0 and 99999999)
);
--> statement-breakpoint
CREATE TABLE "assessment_levels" (
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
	"code" varchar(32),
	"descriptor" varchar(160) NOT NULL,
	"lower_units" integer NOT NULL,
	"upper_units" integer NOT NULL,
	CONSTRAINT "assessment_levels_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "assessment_levels_school_id_assessment_id_ordinal_unique" UNIQUE("school_id","assessment_id","ordinal"),
	CONSTRAINT "level_descriptor" CHECK (length(btrim("assessment_levels"."descriptor", U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0),
	CONSTRAINT "level_order" CHECK ("assessment_levels"."ordinal" between 1 and 100),
	CONSTRAINT "level_range" CHECK ("assessment_levels"."lower_units" >= 0 and "assessment_levels"."upper_units" >= "assessment_levels"."lower_units" and "assessment_levels"."upper_units" <= 99999999)
);
--> statement-breakpoint
ALTER TABLE "assessments" DROP CONSTRAINT "assessment_draft_status";--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "mode" varchar(16) DEFAULT 'structured' NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "origin" varchar(16) DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "authority" varchar(160);--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "external_reference" varchar(160);--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "opened_by_actor_id" uuid;--> statement-breakpoint
ALTER TABLE "assessment_criteria" ADD CONSTRAINT "assessment_criteria_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_criteria" ADD CONSTRAINT "assessment_criteria_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_criteria" ADD CONSTRAINT "assessment_criteria_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_criteria" ADD CONSTRAINT "assessment_criteria_school_id_task_id_assessment_tasks_school_id_id_fk" FOREIGN KEY ("school_id","task_id") REFERENCES "public"."assessment_tasks"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_indicators" ADD CONSTRAINT "assessment_indicators_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_indicators" ADD CONSTRAINT "assessment_indicators_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_indicators" ADD CONSTRAINT "assessment_indicators_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_indicators" ADD CONSTRAINT "assessment_indicators_school_id_criterion_id_assessment_criteria_school_id_id_fk" FOREIGN KEY ("school_id","criterion_id") REFERENCES "public"."assessment_criteria"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_levels" ADD CONSTRAINT "assessment_levels_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_levels" ADD CONSTRAINT "assessment_levels_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_levels" ADD CONSTRAINT "assessment_levels_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_levels" ADD CONSTRAINT "assessment_levels_school_id_assessment_id_assessments_school_id_id_fk" FOREIGN KEY ("school_id","assessment_id") REFERENCES "public"."assessments"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "criterion_creator_idx" ON "assessment_criteria" USING btree ("created_by_actor_id");--> statement-breakpoint
CREATE INDEX "criterion_updater_idx" ON "assessment_criteria" USING btree ("updated_by_actor_id");--> statement-breakpoint
CREATE INDEX "indicator_creator_idx" ON "assessment_indicators" USING btree ("created_by_actor_id");--> statement-breakpoint
CREATE INDEX "indicator_updater_idx" ON "assessment_indicators" USING btree ("updated_by_actor_id");--> statement-breakpoint
CREATE INDEX "level_creator_idx" ON "assessment_levels" USING btree ("created_by_actor_id");--> statement-breakpoint
CREATE INDEX "level_updater_idx" ON "assessment_levels" USING btree ("updated_by_actor_id");--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_opened_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("opened_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessment_opener_idx" ON "assessments" USING btree ("opened_by_actor_id");--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessment_mode" CHECK ("assessments"."mode" = 'structured');--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessment_origin" CHECK (("assessments"."origin" = 'internal' and "assessments"."authority" is null and "assessments"."external_reference" is null) or ("assessments"."origin" = 'external' and "assessments"."authority" is not null and length(btrim("assessments"."authority", U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) > 0));--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessment_open_metadata" CHECK (("assessments"."status" = 'draft' and "assessments"."opened_at" is null and "assessments"."opened_by_actor_id" is null) or ("assessments"."status" = 'open' and "assessments"."opened_at" is not null and "assessments"."opened_by_actor_id" is not null));--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessment_draft_status" CHECK ("assessments"."status" in ('draft','open'));