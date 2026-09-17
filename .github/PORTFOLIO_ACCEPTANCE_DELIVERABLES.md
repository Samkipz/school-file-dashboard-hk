# Portfolio/media acceptance follow-up

Started 2026-09-14 following the request to implement the next part of the project log.

## Deliverables for this working slice

- Add an explicit browser smoke command using the existing installed-Chrome/CDP approach, with no new browser dependency.
- Exercise hydrated portfolio and media UI: learner selection, upload, metadata edit, private byte download, folder creation/editing, archive and mobile layout.
- Check teacher read-only UI and moderator denial using existing development identities.
- Use only synthetic, uniquely named test uploads on the pinned development target; preserve stored bytes and archive only records created by this run. Never reset/reseed or change migration history.
- Record actual results and any defects repaired. Automated browser checks do not constitute human acceptance or independent verification.
- Prepare a concrete assessment evidence decision record and bounded first assessment deliverables. Pending policy choices remain proposals until answered.
- Update PROJECT_LOG.md with exact progress and remaining decisions.

## Validation and exclusions

Run the browser smoke against a locally started application using the pinned development configuration. Require an explicit opt-in for retained synthetic uploads. Run typecheck, lint, unit tests and build for code changes; capture outputs. Browser tests remain outside default tests and CI. No assessment schema, score calculation, official curriculum rules, production deployment or destructive object operations belong to this slice.
