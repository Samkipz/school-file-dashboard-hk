-- Existing approved retention policy applies to every live evidence reference.
-- In-progress associations may still be explicitly removed and audited.
CREATE OR REPLACE FUNCTION learner_evidence_asset_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM assessment_evidence WHERE school_id=OLD.school_id AND asset_id=OLD.id) THEN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Referenced evidence cannot be deleted' USING ERRCODE='23514'; END IF;
    IF ROW(NEW.id,NEW.school_id,NEW.learner_id,NEW.folder_id,NEW.object_key,NEW.mime_type,NEW.size,NEW.uploaded_at,NEW.uploaded_by_actor_id) IS DISTINCT FROM ROW(OLD.id,OLD.school_id,OLD.learner_id,OLD.folder_id,OLD.object_key,OLD.mime_type,OLD.size,OLD.uploaded_at,OLD.uploaded_by_actor_id) THEN RAISE EXCEPTION 'Referenced asset identity is immutable' USING ERRCODE='23514'; END IF;
    IF NEW.state IS DISTINCT FROM OLD.state OR NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN RAISE EXCEPTION 'Referenced evidence cannot be withdrawn' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
