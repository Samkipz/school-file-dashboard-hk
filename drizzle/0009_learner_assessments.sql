CREATE TABLE "assessment_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"learner_assessment_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"task_id" uuid,
	"criterion_id" uuid,
	CONSTRAINT "assessment_evidence_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "assessment_evidence_once" UNIQUE("school_id","learner_assessment_id","asset_id"),
	CONSTRAINT "evidence_version" CHECK ("assessment_evidence"."row_version" > 0 and "assessment_evidence"."archived_at" is null)
);
--> statement-breakpoint
CREATE TABLE "criterion_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"learner_assessment_id" uuid NOT NULL,
	"criterion_id" uuid NOT NULL,
	"indicator_id" uuid NOT NULL,
	CONSTRAINT "criterion_observations_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "criterion_observation_once" UNIQUE("school_id","learner_assessment_id","criterion_id"),
	CONSTRAINT "observation_version" CHECK ("criterion_observations"."row_version" > 0 and "criterion_observations"."archived_at" is null)
);
--> statement-breakpoint
CREATE TABLE "learner_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_actor_id" uuid NOT NULL,
	"updated_by_actor_id" uuid NOT NULL,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"assessment_id" uuid NOT NULL,
	"learner_id" uuid NOT NULL,
	"status" varchar(24) DEFAULT 'in_progress' NOT NULL,
	"feedback" varchar(4000),
	"completed_at" timestamp with time zone,
	"completed_by_actor_id" uuid,
	"absent_at" timestamp with time zone,
	"absent_by_actor_id" uuid,
	CONSTRAINT "learner_assessments_school_id_id_unique" UNIQUE("school_id","id"),
	CONSTRAINT "learner_assessment_once" UNIQUE("school_id","assessment_id","learner_id"),
	CONSTRAINT "learner_assessment_version" CHECK ("learner_assessments"."row_version" > 0 and "learner_assessments"."archived_at" is null),
	CONSTRAINT "learner_assessment_state" CHECK (("learner_assessments"."status" = 'in_progress' and "learner_assessments"."completed_at" is null and "learner_assessments"."completed_by_actor_id" is null and "learner_assessments"."absent_at" is null and "learner_assessments"."absent_by_actor_id" is null) or ("learner_assessments"."status" = 'completed' and "learner_assessments"."completed_at" is not null and "learner_assessments"."completed_by_actor_id" is not null and "learner_assessments"."absent_at" is null and "learner_assessments"."absent_by_actor_id" is null) or ("learner_assessments"."status" = 'absent' and "learner_assessments"."absent_at" is not null and "learner_assessments"."absent_by_actor_id" is not null and "learner_assessments"."completed_at" is null and "learner_assessments"."completed_by_actor_id" is null and "learner_assessments"."feedback" is null))
);
--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD CONSTRAINT "assessment_evidence_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD CONSTRAINT "assessment_evidence_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD CONSTRAINT "assessment_evidence_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD CONSTRAINT "assessment_evidence_school_id_learner_assessment_id_learner_assessments_school_id_id_fk" FOREIGN KEY ("school_id","learner_assessment_id") REFERENCES "public"."learner_assessments"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD CONSTRAINT "assessment_evidence_school_id_asset_id_media_assets_school_id_id_fk" FOREIGN KEY ("school_id","asset_id") REFERENCES "public"."media_assets"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD CONSTRAINT "assessment_evidence_school_id_task_id_assessment_tasks_school_id_id_fk" FOREIGN KEY ("school_id","task_id") REFERENCES "public"."assessment_tasks"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_evidence" ADD CONSTRAINT "assessment_evidence_school_id_criterion_id_assessment_criteria_school_id_id_fk" FOREIGN KEY ("school_id","criterion_id") REFERENCES "public"."assessment_criteria"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_observations" ADD CONSTRAINT "criterion_observations_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_observations" ADD CONSTRAINT "criterion_observations_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_observations" ADD CONSTRAINT "criterion_observations_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_observations" ADD CONSTRAINT "criterion_observations_school_id_learner_assessment_id_learner_assessments_school_id_id_fk" FOREIGN KEY ("school_id","learner_assessment_id") REFERENCES "public"."learner_assessments"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_observations" ADD CONSTRAINT "criterion_observations_school_id_criterion_id_assessment_criteria_school_id_id_fk" FOREIGN KEY ("school_id","criterion_id") REFERENCES "public"."assessment_criteria"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_observations" ADD CONSTRAINT "criterion_observations_school_id_indicator_id_assessment_indicators_school_id_id_fk" FOREIGN KEY ("school_id","indicator_id") REFERENCES "public"."assessment_indicators"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_assessments" ADD CONSTRAINT "learner_assessments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_assessments" ADD CONSTRAINT "learner_assessments_created_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_assessments" ADD CONSTRAINT "learner_assessments_updated_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("updated_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_assessments" ADD CONSTRAINT "learner_assessments_completed_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("completed_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_assessments" ADD CONSTRAINT "learner_assessments_absent_by_actor_id_audit_actors_id_fk" FOREIGN KEY ("absent_by_actor_id") REFERENCES "public"."audit_actors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_assessments" ADD CONSTRAINT "learner_assessments_school_id_assessment_id_assessments_school_id_id_fk" FOREIGN KEY ("school_id","assessment_id") REFERENCES "public"."assessments"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_assessments" ADD CONSTRAINT "learner_assessments_school_id_learner_id_learners_school_id_id_fk" FOREIGN KEY ("school_id","learner_id") REFERENCES "public"."learners"("school_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_asset_idx" ON "assessment_evidence" USING btree ("school_id","asset_id");--> statement-breakpoint
CREATE INDEX "evidence_task_idx" ON "assessment_evidence" USING btree ("school_id","task_id");--> statement-breakpoint
CREATE INDEX "evidence_criterion_idx" ON "assessment_evidence" USING btree ("school_id","criterion_id");--> statement-breakpoint
CREATE INDEX "evidence_creator_idx" ON "assessment_evidence" USING btree ("created_by_actor_id");--> statement-breakpoint
CREATE INDEX "evidence_updater_idx" ON "assessment_evidence" USING btree ("updated_by_actor_id");--> statement-breakpoint
CREATE INDEX "observation_criterion_idx" ON "criterion_observations" USING btree ("school_id","criterion_id");--> statement-breakpoint
CREATE INDEX "observation_indicator_idx" ON "criterion_observations" USING btree ("school_id","indicator_id");--> statement-breakpoint
CREATE INDEX "observation_creator_idx" ON "criterion_observations" USING btree ("created_by_actor_id");--> statement-breakpoint
CREATE INDEX "observation_updater_idx" ON "criterion_observations" USING btree ("updated_by_actor_id");--> statement-breakpoint
CREATE INDEX "learner_assessment_learner_idx" ON "learner_assessments" USING btree ("school_id","learner_id");--> statement-breakpoint
CREATE INDEX "learner_assessment_creator_idx" ON "learner_assessments" USING btree ("created_by_actor_id");--> statement-breakpoint
CREATE INDEX "learner_assessment_updater_idx" ON "learner_assessments" USING btree ("updated_by_actor_id");--> statement-breakpoint
CREATE INDEX "learner_assessment_completer_idx" ON "learner_assessments" USING btree ("completed_by_actor_id");--> statement-breakpoint
CREATE INDEX "learner_assessment_absent_actor_idx" ON "learner_assessments" USING btree ("absent_by_actor_id");