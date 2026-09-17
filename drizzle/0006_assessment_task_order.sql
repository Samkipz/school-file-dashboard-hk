-- Drizzle represents the unique columns; deferrability is maintained here and
-- checked by db:verify. No referencing task-dependent tables exist yet.
ALTER TABLE assessment_tasks DROP CONSTRAINT assessment_tasks_school_id_assessment_id_ordinal_unique;
--> statement-breakpoint
ALTER TABLE assessment_tasks ADD CONSTRAINT assessment_tasks_school_id_assessment_id_ordinal_unique
UNIQUE (school_id, assessment_id, ordinal) DEFERRABLE INITIALLY DEFERRED;
-- Positive/bounded ordinals and deferred contiguous-order guards are unchanged.
