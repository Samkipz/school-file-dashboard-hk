# First assessment slice: school-admin draft planning

September 16: independent verification returned **PASS WITH CONCERNS**. See [bounded repairs and stable-task hardening](ASSESSMENT_DRAFT_HARDENING.md) for the follow-up and actual rerun results. The original delivery description below is retained as history. Future task-dependent models require an approved deletion/correction lifecycle before implementation.

Prepared 2026-09-14. Update 2026-09-15: the bounded slice is implemented locally and implementer-run verification is complete. See [implementation and actual results](ASSESSMENT_FIRST_SLICE_IMPLEMENTATION.md). Independent verification and human acceptance remain pending. Evidence policy is approved in [the decision record](ASSESSMENT_EVIDENCE_DECISIONS.md).

The owner approved optional assessment/task start and due dates, ordered when both exist and contained in the offering academic year. Term is classification only, constrained to the same year; no term-date containment or cross-term restriction applies. This is a first-slice technical rule, not official Grade 10 SBA policy. The implementation record gives field limits, task limits and schema details; the proposed scope below is retained as the delivery checklist.

## Result for the school

A School Admin can create and edit a draft assessment for an existing subject offering and optional term. Drafts remain admin-only in this proposed slice. The workflow uses the same tables and services for any configured grade. It does not yet collect marks, publish results or claim Grade 10 SBA compliance.

## Bounded deliverables

- Review a small assessment schema for configurable assessment types, draft assessments and ordered task definitions. Reuse school, offering, year, grade and subject identity; bind optional term to the offering's year. Review field limits, task maximums and dates explicitly before migration generation.
- Generate an additive forward migration from the authoritative Drizzle schema; inspect current target/ledger first. Preserve all three existing migration hashes, auth/provider tables, learner history and media objects. Include a forward repair plan and reproducibility checks.
- Add session-bound domain commands for admin draft creation/editing and scoped reads. Keep actions thin; validate all input, reject invalid school/context links, enforce optimistic version conflicts, and write safe audit events in the mutation transaction.
- Add admin draft planning forms using the existing application layout. Show draft status explicitly. No teacher, scoring or official result controls should appear.
- Add targeted PostgreSQL checks for integrity, role/assignment isolation, stale edits and atomic audit failure; cover real actions/pages and mobile behavior. Run the established engineering checks and relevant regressions.
- Record evidence and remaining limits, then obtain fresh-session verification and human review before moving to attempts/evidence or scoring.

## Acceptance examples

1. An admin creates a Mathematics assessment in a valid school offering; reload shows the saved draft and tasks.
2. Teachers (including assigned teachers), moderator-only callers, anonymous callers and another school's admin cannot read or modify the admin-only draft.
3. A term from another year and an offering from another school fail at the database boundary, not just in the form.
4. Stale edits return a reload conflict, and failed audit writes leave the draft unchanged.
5. Grade 10 and another configured grade use the same operations without grade-specific code.

## Deliberately deferred

Release to assigned teachers, learner attempts, evidence association implementation, teacher uploads, rubrics/scoring calculations, moderation, finalization, publication, reports and official weighting/task-count rules. Do not invent official rules for a draft-only feature. Framework-specific behavior requires a cited approved policy before its own implementation.

Before starting implementation, review the field/schema contract and this proposed admin-only draft boundary. The existing specification grants teachers assigned-assessment viewing but does not define draft visibility. An explicit release transition and teacher viewing belong in the following slice; review those state/access rules before their implementation.
