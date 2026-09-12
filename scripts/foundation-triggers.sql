-- No extensions required. Dates are inclusive; a transfer starts the day after
-- the previous placement ends. Role grants use half-open timestamp intervals.
CREATE FUNCTION foundation_mutable_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE school uuid; actor uuid; actor_user text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id OR NEW.created_at <> OLD.created_at OR NEW.created_by_actor_id <> OLD.created_by_actor_id THEN
      RAISE EXCEPTION 'Immutable identity/provenance' USING ERRCODE = '23514';
    END IF;
    IF to_jsonb(NEW)->>'school_id' IS DISTINCT FROM to_jsonb(OLD)->>'school_id' THEN
      RAISE EXCEPTION 'Cannot change tenant' USING ERRCODE = '23514';
    END IF;
    NEW.row_version := OLD.row_version + 1;
    NEW.updated_at := clock_timestamp();
  END IF;
  school := (to_jsonb(NEW)->>'school_id')::uuid;
  IF school IS NOT NULL THEN
    -- Serializes temporal writes per school. Services additionally use SERIALIZABLE.
    PERFORM 1 FROM schools WHERE id = school FOR UPDATE;
  END IF;
  FOREACH actor IN ARRAY CASE WHEN TG_OP = 'INSERT' THEN ARRAY[NEW.created_by_actor_id, NEW.updated_by_actor_id] ELSE ARRAY[NEW.updated_by_actor_id] END LOOP
    SELECT user_id INTO actor_user FROM audit_actors WHERE id = actor;
    IF actor_user IS NOT NULL AND (school IS NULL OR NOT EXISTS (
      SELECT 1 FROM school_memberships WHERE school_id = school AND user_id = actor_user
        AND status = 'active' AND archived_at IS NULL AND joined_at <= now() AND ended_at IS NULL
    )) THEN
      RAISE EXCEPTION 'Actor is outside active school membership' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE FUNCTION foundation_immutable_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Append-only history' USING ERRCODE = '23514'; END $$;
--> statement-breakpoint
CREATE FUNCTION foundation_validate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM schools s WHERE NOT EXISTS (SELECT 1 FROM pg_timezone_names z WHERE z.name = s.timezone)) THEN
    RAISE EXCEPTION 'Invalid school timezone' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM membership_roles m JOIN roles r ON r.id = m.role_id WHERE r.scope <> 'school') THEN
    RAISE EXCEPTION 'Platform role cannot grant school access' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM subject_grades sg JOIN grades g ON g.id = sg.grade_id JOIN subject_catalogue s ON s.id = sg.subject_id WHERE g.curriculum_code <> s.curriculum_code) THEN
    RAISE EXCEPTION 'Subject and grade curriculum mismatch' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM academic_years a JOIN academic_years b ON a.school_id = b.school_id AND a.id < b.id WHERE a.status = 'active' AND b.status = 'active' AND daterange(a.starts_on,a.ends_on,'[]') && daterange(b.starts_on,b.ends_on,'[]')) THEN
    RAISE EXCEPTION 'Overlapping active academic years' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM terms t JOIN academic_years y ON y.id = t.academic_year_id WHERE t.starts_on < y.starts_on OR t.ends_on > y.ends_on) OR EXISTS (
    SELECT 1 FROM terms a JOIN terms b ON a.school_id = b.school_id AND a.academic_year_id = b.academic_year_id AND a.id < b.id WHERE daterange(a.starts_on,a.ends_on,'[]') && daterange(b.starts_on,b.ends_on,'[]')
  ) THEN RAISE EXCEPTION 'Terms must fit year without overlap' USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM learner_enrolments e JOIN learner_admissions a ON a.id = e.admission_id JOIN academic_years y ON y.id = e.academic_year_id
    WHERE e.starts_on < greatest(a.admitted_on,y.starts_on) OR coalesce(e.ends_on,y.ends_on) > least(coalesce(a.left_on,y.ends_on),y.ends_on)) THEN
    RAISE EXCEPTION 'Enrolment outside admission or year' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM class_placements p JOIN learner_enrolments e ON e.id = p.enrolment_id JOIN academic_years y ON y.id = e.academic_year_id
    WHERE p.starts_on < e.starts_on OR coalesce(p.ends_on,y.ends_on) > coalesce(e.ends_on,y.ends_on)) THEN
    RAISE EXCEPTION 'Placement outside enrolment' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM class_placements a JOIN class_placements b ON a.school_id = b.school_id AND a.enrolment_id = b.enrolment_id AND a.id < b.id
    WHERE daterange(a.starts_on,a.ends_on,'[]') && daterange(b.starts_on,b.ends_on,'[]')) THEN
    RAISE EXCEPTION 'Overlapping class placements' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM learner_subject_enrolments s JOIN class_placements p ON p.id = s.placement_id JOIN academic_years y ON y.id = p.academic_year_id
    WHERE s.starts_on < p.starts_on OR coalesce(s.ends_on,y.ends_on) > coalesce(p.ends_on,y.ends_on)) THEN
    RAISE EXCEPTION 'Subject enrolment outside placement' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM learner_subject_enrolments a JOIN learner_subject_enrolments b ON a.school_id = b.school_id AND a.enrolment_id = b.enrolment_id AND a.offering_id = b.offering_id AND a.id < b.id
    WHERE daterange(a.starts_on,a.ends_on,'[]') && daterange(b.starts_on,b.ends_on,'[]')) THEN
    RAISE EXCEPTION 'Overlapping subject enrolments' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM teacher_assignments a JOIN teacher_assignments b ON a.school_id = b.school_id AND a.staff_id = b.staff_id AND a.offering_id = b.offering_id AND a.id < b.id
    WHERE a.status <> 'revoked' AND b.status <> 'revoked' AND daterange(a.starts_on,a.ends_on,'[]') && daterange(b.starts_on,b.ends_on,'[]')) THEN
    RAISE EXCEPTION 'Overlapping teacher assignments' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM teacher_assignments t JOIN subject_offerings o ON o.id = t.offering_id JOIN academic_years y ON y.id = o.academic_year_id
    WHERE t.starts_on < y.starts_on OR coalesce(t.ends_on,y.ends_on) > y.ends_on) THEN
    RAISE EXCEPTION 'Teacher assignment outside year' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM membership_roles a JOIN membership_roles b ON a.school_id = b.school_id AND a.membership_id = b.membership_id AND a.role_id = b.role_id AND a.id < b.id
    WHERE a.revoked_at IS NULL AND b.revoked_at IS NULL AND tstzrange(a.valid_from,a.valid_until,'[)') && tstzrange(b.valid_from,b.valid_until,'[)')) THEN
    RAISE EXCEPTION 'Overlapping role grants' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE FUNCTION foundation_audit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor_user text;
BEGIN
  SELECT user_id INTO actor_user FROM audit_actors WHERE id = NEW.actor_id;
  IF actor_user IS NOT NULL AND NEW.school_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM school_memberships WHERE id = NEW.membership_id AND school_id = NEW.school_id AND user_id = actor_user AND status = 'active' AND archived_at IS NULL
  ) THEN RAISE EXCEPTION 'Audit actor/membership mismatch' USING ERRCODE = '23514'; END IF;
  IF jsonb_typeof(NEW.safe_changes) <> 'object' OR octet_length(NEW.safe_changes::text) > 8192 THEN
    RAISE EXCEPTION 'Audit payload must be a bounded safe object' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'row_version' LOOP
    EXECUTE format('CREATE TRIGGER mutable_guard BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION foundation_mutable_guard()', t);
    EXECUTE format('CREATE CONSTRAINT TRIGGER foundation_integrity AFTER INSERT OR UPDATE OR DELETE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION foundation_validate()', t);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_events FOR EACH STATEMENT EXECUTE FUNCTION foundation_immutable_guard();
--> statement-breakpoint
CREATE TRIGGER actor_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_actors FOR EACH STATEMENT EXECUTE FUNCTION foundation_immutable_guard();
--> statement-breakpoint
CREATE TRIGGER audit_actor_guard BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION foundation_audit_guard();
