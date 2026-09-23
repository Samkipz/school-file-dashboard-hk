-- Forward-only result integrity; the opened definition guards remain unchanged.
CREATE FUNCTION learner_result_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Result identity is permanent' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.status='completed' THEN RAISE EXCEPTION 'Completed result is read-only' USING ERRCODE='23514'; END IF;
    IF NEW.assessment_id<>OLD.assessment_id OR NEW.learner_id<>OLD.learner_id THEN RAISE EXCEPTION 'Immutable result parent' USING ERRCODE='23514'; END IF;
    IF OLD.status='absent' AND NEW.status<>'in_progress' THEN RAISE EXCEPTION 'Begin absent assessment first' USING ERRCODE='23514'; END IF;
  ELSIF NEW.status='completed' THEN RAISE EXCEPTION 'Begin before completing' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM assessments WHERE school_id=NEW.school_id AND id=NEW.assessment_id AND status='open' AND archived_at IS NULL) THEN RAISE EXCEPTION 'Open assessment required' USING ERRCODE='23514'; END IF;
  IF NEW.status='completed' AND EXISTS (SELECT 1 FROM assessment_tasks t JOIN assessment_criteria c ON c.school_id=t.school_id AND c.task_id=t.id
    WHERE t.school_id=NEW.school_id AND t.assessment_id=NEW.assessment_id AND NOT EXISTS (SELECT 1 FROM criterion_observations o WHERE o.school_id=NEW.school_id AND o.learner_assessment_id=NEW.id AND o.criterion_id=c.id)) THEN
    RAISE EXCEPTION 'All criteria require observations' USING ERRCODE='23514'; END IF;
  IF NEW.status='absent' AND (EXISTS (SELECT 1 FROM criterion_observations WHERE school_id=NEW.school_id AND learner_assessment_id=NEW.id) OR EXISTS (SELECT 1 FROM assessment_evidence WHERE school_id=NEW.school_id AND learner_assessment_id=NEW.id)) THEN
    RAISE EXCEPTION 'Absence cannot discard work' USING ERRCODE='23514'; END IF;
  IF NEW.status='completed' AND EXISTS (SELECT 1 FROM assessment_evidence e JOIN media_assets f ON f.school_id=e.school_id AND f.id=e.asset_id WHERE e.school_id=NEW.school_id AND e.learner_assessment_id=NEW.id AND (f.state<>'ready' OR f.archived_at IS NOT NULL)) THEN RAISE EXCEPTION 'Completion evidence unavailable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER learner_result_locked BEFORE INSERT OR UPDATE OR DELETE ON learner_assessments FOR EACH ROW EXECUTE FUNCTION learner_result_guard();
CREATE TRIGGER learner_result_mutable BEFORE INSERT OR UPDATE ON learner_assessments FOR EACH ROW EXECUTE FUNCTION foundation_mutable_guard();
--> statement-breakpoint
CREATE FUNCTION learner_result_child_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; parent learner_assessments; task uuid;
BEGIN
  IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
  SELECT * INTO parent FROM learner_assessments WHERE school_id=r.school_id AND id=r.learner_assessment_id FOR UPDATE;
  IF NOT FOUND OR parent.status<>'in_progress' THEN RAISE EXCEPTION 'In-progress result required' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND NEW.learner_assessment_id<>OLD.learner_assessment_id THEN RAISE EXCEPTION 'Immutable child parent' USING ERRCODE='23514'; END IF;
  IF TG_OP<>'DELETE' THEN
    IF TG_TABLE_NAME='criterion_observations' THEN
      IF TG_OP='UPDATE' AND NEW.criterion_id<>OLD.criterion_id THEN RAISE EXCEPTION 'Immutable observation criterion' USING ERRCODE='23514'; END IF;
      IF NOT EXISTS (SELECT 1 FROM assessment_indicators i JOIN assessment_criteria c ON c.school_id=i.school_id AND c.id=i.criterion_id JOIN assessment_tasks t ON t.school_id=c.school_id AND t.id=c.task_id
        WHERE i.school_id=r.school_id AND i.id=r.indicator_id AND c.id=r.criterion_id AND t.assessment_id=parent.assessment_id) THEN RAISE EXCEPTION 'Indicator/criterion/assessment mismatch' USING ERRCODE='23514'; END IF;
    ELSE
      IF TG_OP='UPDATE' AND NEW.asset_id<>OLD.asset_id THEN RAISE EXCEPTION 'Immutable evidence asset' USING ERRCODE='23514'; END IF;
      PERFORM 1 FROM media_assets WHERE school_id=r.school_id AND id=r.asset_id AND learner_id=parent.learner_id AND state='ready' AND archived_at IS NULL FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Evidence unavailable for learner' USING ERRCODE='23514'; END IF;
      IF r.task_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM assessment_tasks WHERE school_id=r.school_id AND id=r.task_id AND assessment_id=parent.assessment_id) THEN RAISE EXCEPTION 'Evidence task mismatch' USING ERRCODE='23514'; END IF;
      IF r.criterion_id IS NOT NULL THEN
        SELECT c.task_id INTO task FROM assessment_criteria c JOIN assessment_tasks t ON t.school_id=c.school_id AND t.id=c.task_id WHERE c.school_id=r.school_id AND c.id=r.criterion_id AND t.assessment_id=parent.assessment_id;
        IF NOT FOUND OR (r.task_id IS NOT NULL AND r.task_id<>task) THEN RAISE EXCEPTION 'Evidence criterion mismatch' USING ERRCODE='23514'; END IF;
      END IF;
    END IF;
  END IF;
  UPDATE learner_assessments SET updated_by_actor_id=updated_by_actor_id WHERE school_id=r.school_id AND id=parent.id;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER learner_observation_guard BEFORE INSERT OR UPDATE OR DELETE ON criterion_observations FOR EACH ROW EXECUTE FUNCTION learner_result_child_guard();
CREATE TRIGGER learner_observation_mutable BEFORE INSERT OR UPDATE ON criterion_observations FOR EACH ROW EXECUTE FUNCTION foundation_mutable_guard();
CREATE TRIGGER learner_evidence_guard BEFORE INSERT OR UPDATE OR DELETE ON assessment_evidence FOR EACH ROW EXECUTE FUNCTION learner_result_child_guard();
CREATE TRIGGER learner_evidence_mutable BEFORE INSERT OR UPDATE ON assessment_evidence FOR EACH ROW EXECUTE FUNCTION foundation_mutable_guard();
--> statement-breakpoint
-- Only linked assets acquire additional protection; unrelated private files are unchanged.
CREATE FUNCTION learner_evidence_asset_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM assessment_evidence WHERE school_id=OLD.school_id AND asset_id=OLD.id) THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Referenced evidence cannot be deleted' USING ERRCODE='23514'; END IF;
    IF ROW(NEW.id,NEW.school_id,NEW.learner_id,NEW.folder_id,NEW.object_key,NEW.mime_type,NEW.size,NEW.uploaded_at,NEW.uploaded_by_actor_id) IS DISTINCT FROM ROW(OLD.id,OLD.school_id,OLD.learner_id,OLD.folder_id,OLD.object_key,OLD.mime_type,OLD.size,OLD.uploaded_at,OLD.uploaded_by_actor_id) THEN RAISE EXCEPTION 'Referenced asset identity is immutable' USING ERRCODE='23514'; END IF;
    IF (NEW.state IS DISTINCT FROM OLD.state OR NEW.archived_at IS DISTINCT FROM OLD.archived_at) AND EXISTS (SELECT 1 FROM assessment_evidence e JOIN learner_assessments a ON a.school_id=e.school_id AND a.id=e.learner_assessment_id WHERE e.school_id=OLD.school_id AND e.asset_id=OLD.id AND a.status='completed') THEN RAISE EXCEPTION 'Completed evidence cannot be withdrawn' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER learner_evidence_asset_locked BEFORE UPDATE OR DELETE ON media_assets FOR EACH ROW EXECUTE FUNCTION learner_evidence_asset_guard();
--> statement-breakpoint
CREATE TRIGGER learner_result_no_truncate BEFORE TRUNCATE ON learner_assessments FOR EACH STATEMENT EXECUTE FUNCTION foundation_immutable_guard();
CREATE TRIGGER learner_observation_no_truncate BEFORE TRUNCATE ON criterion_observations FOR EACH STATEMENT EXECUTE FUNCTION foundation_immutable_guard();
CREATE TRIGGER learner_evidence_no_truncate BEFORE TRUNCATE ON assessment_evidence FOR EACH STATEMENT EXECUTE FUNCTION foundation_immutable_guard();
