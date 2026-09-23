-- Definition children share the parent's revision and immutable-open boundary.
DO $$
DECLARE t text; constraint_name text; columns_text text;
BEGIN
  FOREACH t IN ARRAY ARRAY['assessment_criteria','assessment_indicators','assessment_levels'] LOOP
    EXECUTE format('CREATE TRIGGER assessment_child_mutable BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION foundation_mutable_guard()', t);
    FOR constraint_name, columns_text IN
      SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conrelid=t::regclass AND contype='u' AND (conname LIKE '%ordinal_unique' OR conname LIKE '%score_units_unique')
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',t,constraint_name);
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s DEFERRABLE INITIALLY DEFERRED',t,constraint_name,columns_text);
    END LOOP;
  END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION assessment_definition_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; parent uuid; old_parent uuid;
BEGIN
  IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
  IF TG_TABLE_NAME='assessment_criteria' THEN
    SELECT assessment_id INTO parent FROM assessment_tasks WHERE school_id=r.school_id AND id=r.task_id;
    IF TG_OP='UPDATE' AND NEW.task_id<>OLD.task_id THEN RAISE EXCEPTION 'Criterion parent is immutable' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='assessment_indicators' THEN
    SELECT t.assessment_id INTO parent FROM assessment_tasks t JOIN assessment_criteria c ON c.school_id=t.school_id AND c.task_id=t.id WHERE c.school_id=r.school_id AND c.id=r.criterion_id;
    IF TG_OP='UPDATE' AND NEW.criterion_id<>OLD.criterion_id THEN RAISE EXCEPTION 'Indicator parent is immutable' USING ERRCODE='23514'; END IF;
  ELSE
    parent:=r.assessment_id;
    IF TG_OP='UPDATE' AND NEW.assessment_id<>OLD.assessment_id THEN RAISE EXCEPTION 'Level parent is immutable' USING ERRCODE='23514'; END IF;
  END IF;
  UPDATE assessments SET updated_by_actor_id=updated_by_actor_id WHERE school_id=r.school_id AND id=parent AND status='draft' AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Draft definition unavailable' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER assessment_criterion_revision AFTER INSERT OR UPDATE OR DELETE ON assessment_criteria FOR EACH ROW EXECUTE FUNCTION assessment_definition_revision();
CREATE TRIGGER assessment_indicator_revision AFTER INSERT OR UPDATE OR DELETE ON assessment_indicators FOR EACH ROW EXECUTE FUNCTION assessment_definition_revision();
CREATE TRIGGER assessment_level_revision AFTER INSERT OR UPDATE OR DELETE ON assessment_levels FOR EACH ROW EXECUTE FUNCTION assessment_definition_revision();
--> statement-breakpoint
CREATE FUNCTION assessment_definition_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'draft' THEN RAISE EXCEPTION 'Create a draft first' USING ERRCODE='23514'; END IF;
  ELSIF OLD.status='open' THEN
    RAISE EXCEPTION 'Open assessment definition is locked' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assessment_definition_locked BEFORE INSERT OR UPDATE OR DELETE ON assessments FOR EACH ROW EXECUTE FUNCTION assessment_definition_lock();
--> statement-breakpoint
CREATE FUNCTION assessment_structure_validate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE school uuid; a record; maximum bigint;
BEGIN
  IF TG_OP='DELETE' THEN school:=OLD.school_id; ELSE school:=NEW.school_id; END IF;
  IF EXISTS (SELECT 1 FROM assessment_criteria WHERE school_id=school GROUP BY task_id HAVING min(ordinal)<>1 OR max(ordinal)<>count(*))
    OR EXISTS (SELECT 1 FROM assessment_indicators WHERE school_id=school GROUP BY criterion_id HAVING min(ordinal)<>1 OR max(ordinal)<>count(*))
    OR EXISTS (SELECT 1 FROM assessment_levels WHERE school_id=school GROUP BY assessment_id HAVING min(ordinal)<>1 OR max(ordinal)<>count(*))
  THEN RAISE EXCEPTION 'Definition ordering must be contiguous' USING ERRCODE='23514'; END IF;
  FOR a IN SELECT * FROM assessments WHERE school_id=school LOOP
    SELECT coalesce(sum(m),0) INTO maximum FROM (
      SELECT max(i.score_units) m FROM assessment_tasks t JOIN assessment_criteria c ON c.school_id=t.school_id AND c.task_id=t.id
      JOIN assessment_indicators i ON i.school_id=c.school_id AND i.criterion_id=c.id WHERE t.school_id=school AND t.assessment_id=a.id GROUP BY c.id
    ) maxima;
    IF EXISTS (SELECT 1 FROM assessment_levels WHERE school_id=school AND assessment_id=a.id) AND (
      EXISTS (SELECT 1 FROM (SELECT lower_units,lag(upper_units,-1) OVER (ORDER BY lower_units DESC) previous FROM assessment_levels WHERE school_id=school AND assessment_id=a.id) ranges WHERE previous IS NOT NULL AND lower_units<>previous+1)
      OR (SELECT min(lower_units)<>0 OR max(upper_units)<>maximum FROM assessment_levels WHERE school_id=school AND assessment_id=a.id)
    ) THEN RAISE EXCEPTION 'Performance scale must cover maximum without gaps or overlaps' USING ERRCODE='23514'; END IF;
    IF a.status='open' AND (maximum<=0
      OR NOT EXISTS (SELECT 1 FROM assessment_tasks WHERE school_id=school AND assessment_id=a.id)
      OR EXISTS (SELECT 1 FROM assessment_tasks t WHERE t.school_id=school AND t.assessment_id=a.id AND NOT EXISTS (SELECT 1 FROM assessment_criteria c WHERE c.school_id=t.school_id AND c.task_id=t.id))
      OR EXISTS (SELECT 1 FROM assessment_tasks t JOIN assessment_criteria c ON c.school_id=t.school_id AND c.task_id=t.id WHERE t.school_id=school AND t.assessment_id=a.id AND NOT EXISTS (SELECT 1 FROM assessment_indicators i WHERE i.school_id=c.school_id AND i.criterion_id=c.id))
    ) THEN RAISE EXCEPTION 'Open assessment needs complete scoring structure' USING ERRCODE='23514'; END IF;
  END LOOP;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER assessment_structure_guard AFTER INSERT OR UPDATE OR DELETE ON assessments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assessment_structure_validate();
CREATE CONSTRAINT TRIGGER assessment_criterion_structure_guard AFTER INSERT OR UPDATE OR DELETE ON assessment_criteria DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assessment_structure_validate();
CREATE CONSTRAINT TRIGGER assessment_indicator_structure_guard AFTER INSERT OR UPDATE OR DELETE ON assessment_indicators DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assessment_structure_validate();
CREATE CONSTRAINT TRIGGER assessment_level_structure_guard AFTER INSERT OR UPDATE OR DELETE ON assessment_levels DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION assessment_structure_validate();
