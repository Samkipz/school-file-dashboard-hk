-- Companion to the generated Drizzle schema: cross-row integrity and provenance.
CREATE TRIGGER assessment_type_mutable BEFORE INSERT OR UPDATE ON assessment_types
FOR EACH ROW EXECUTE FUNCTION foundation_mutable_guard();
--> statement-breakpoint
CREATE TRIGGER assessment_mutable BEFORE INSERT OR UPDATE ON assessments
FOR EACH ROW EXECUTE FUNCTION foundation_mutable_guard();
--> statement-breakpoint
CREATE TRIGGER assessment_task_mutable BEFORE INSERT OR UPDATE ON assessment_tasks
FOR EACH ROW EXECUTE FUNCTION foundation_mutable_guard();
--> statement-breakpoint
CREATE FUNCTION assessment_task_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_school uuid; target_assessment uuid; actor uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.assessment_id <> OLD.assessment_id THEN
    RAISE EXCEPTION 'Task parent is immutable' USING ERRCODE='23514';
  END IF;
  IF TG_OP = 'DELETE' THEN
    target_school := OLD.school_id; target_assessment := OLD.assessment_id;
    -- The aggregate update establishes the command actor before task replacement.
    SELECT updated_by_actor_id INTO actor FROM assessments WHERE school_id=target_school AND id=target_assessment;
  ELSE
    target_school := NEW.school_id; target_assessment := NEW.assessment_id; actor := NEW.updated_by_actor_id;
  END IF;
  UPDATE assessments SET updated_by_actor_id=actor
    WHERE school_id=target_school AND id=target_assessment AND status='draft' AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft task parent unavailable' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER assessment_task_revision AFTER INSERT OR UPDATE OR DELETE ON assessment_tasks
FOR EACH ROW EXECUTE FUNCTION assessment_task_revision();
--> statement-breakpoint
CREATE FUNCTION assessment_dates_validate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Recheck both child changes and academic-year edits at transaction completion.
  -- The foundation mutable guard serializes writes on the same school row.
  IF EXISTS (
    SELECT 1 FROM assessments a JOIN academic_years y ON y.school_id=a.school_id AND y.id=a.academic_year_id
    WHERE a.school_id=NEW.school_id AND (
      a.starts_on NOT BETWEEN y.starts_on AND y.ends_on OR a.due_on NOT BETWEEN y.starts_on AND y.ends_on)
  ) OR EXISTS (
    SELECT 1 FROM assessment_tasks t JOIN assessments a ON a.school_id=t.school_id AND a.id=t.assessment_id
    JOIN academic_years y ON y.school_id=a.school_id AND y.id=a.academic_year_id
    WHERE a.school_id=NEW.school_id AND (
      t.starts_on NOT BETWEEN y.starts_on AND y.ends_on OR t.due_on NOT BETWEEN y.starts_on AND y.ends_on)
  ) THEN RAISE EXCEPTION 'Assessment dates must fit offering academic year' USING ERRCODE='23514'; END IF;
  IF EXISTS (
    SELECT 1 FROM assessment_tasks WHERE school_id=NEW.school_id GROUP BY assessment_id
    HAVING min(ordinal) <> 1 OR max(ordinal) <> count(*)
  ) THEN RAISE EXCEPTION 'Task ordering must be contiguous' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER assessment_dates_guard AFTER INSERT OR UPDATE ON assessments
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assessment_dates_validate();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER assessment_task_dates_guard AFTER INSERT OR UPDATE ON assessment_tasks
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assessment_dates_validate();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER assessment_year_dates_guard AFTER INSERT OR UPDATE ON academic_years
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assessment_dates_validate();
