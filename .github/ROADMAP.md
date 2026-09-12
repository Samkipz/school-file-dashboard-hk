# SchoolHub Roadmap

## Foundation delivery update — 2026-09-10

The [first foundation slice](FOUNDATION_SLICE_IMPLEMENTATION.md) implements the school/academic schema portions of Phases 1–3, clean development migrations/seeds, server authorization and an Academics read view. Full onboarding and academic administration workflows remain. Legacy feature reintegration, R2, assessments, moderation and reporting are not delivered by this slice. The next implementation step is audited school-admin academic workflows and forms.

No phase is marked complete. Dependencies and acceptance criteria are targets, not claims about current delivery status.

## Phase 0 — Repository and migration stabilization

- **Objective:** Establish a trustworthy repository and reproducible schema baseline.
- **Scope:** Resolve repository-root/worktree state; reconcile Drizzle journal, migrations, snapshots, schema, and target database; establish CI/typecheck/lint/test baseline.
- **Dependencies:** None.
- **Deliverables:** Documented migration repair plan, verified migration chain, CI checks, test harness decision.
- **Acceptance criteria:** Clean understood repository state; migration reconstruction works from an approved baseline; typecheck/lint/test commands are defined and executable.
- **Tests required:** Migration reproducibility and baseline smoke tests.
- **Out of scope:** Assessment features or production data redesign.

## Phase 1 — School foundation

- **Objective:** Create the tenant and identity domain.
- **Scope:** School, membership, roles, staff profile, approved onboarding/invitation policy.
- **Dependencies:** Phase 0.
- **Deliverables:** School-scoped identity schema and role model.
- **Acceptance criteria:** No user accesses a school without active membership and explicit role.
- **Tests required:** Authentication, membership, role, cross-school isolation tests.
- **Out of scope:** Assessment scoring and reports.

## Phase 2 — Authorization and security

- **Objective:** Eliminate ID-only authorization and secure existing protected data.
- **Scope:** Central policies; action/route authorization; secure CORS; file authorization/validation; storage consistency strategy; registration restrictions.
- **Dependencies:** Phases 0–1.
- **Deliverables:** Object-level authorization rules and secured existing portfolio/media/staff paths.
- **Acceptance criteria:** Cross-school/cross-user IDOR attempts fail for all protected actions and downloads.
- **Tests required:** Authorization, IDOR, file/evidence, tenant isolation, CORS regression tests.
- **Out of scope:** New assessment schema.

## Phase 3 — Academic structure

- **Objective:** Model reusable Grade 10–12 academic context.
- **Scope:** Academic years, terms, grades, classes/streams, learners, enrolments, subjects, teacher assignments.
- **Dependencies:** Phases 0–2.
- **Deliverables:** Normalized academic domain with integrity rules and administration workflow.
- **Acceptance criteria:** Grade 10 is configurable as data and the same model can configure 11/12.
- **Tests required:** Enrolment, assignment, uniqueness, school isolation, academic-context validation tests.
- **Out of scope:** Finalized results and public reports.

## Phase 4 — Assessment engine

- **Objective:** Build grade-agnostic assessment lifecycle and scoring engine.
- **Scope:** Assessment types, assessments, tasks, criteria/rubrics, learner attempts, score calculation, state transitions, audit logging.
- **Dependencies:** Phases 0–3 and approved framework rules.
- **Deliverables:** Authorized assessment creation/scoring/moderation-ready domain.
- **Acceptance criteria:** Configured assessment types and rubrics operate without grade-specific schema/code.
- **Tests required:** Creation, rubric, score validation/calculation, assignment, audit, authorization tests.
- **Out of scope:** Evidence upload and formal report publication.

## Phase 5 — Grade 10 SBA

- **Objective:** Configure and deliver approved Grade 10 SBA workflows.
- **Scope:** Projects, practicals, written tests, scoring guides/rubrics, teacher scoring, moderation submission, finalization controls.
- **Dependencies:** Phases 0–4 and approved Grade 10 framework requirements.
- **Deliverables:** Grade 10 SBA templates/configuration and governed workflows.
- **Acceptance criteria:** Required SBA activities can be configured, assigned, scored, moderated, finalized, and audited.
- **Tests required:** SBA scenario, authorization, score, moderation, finalization, audit tests.
- **Out of scope:** Grade-specific duplicated schema or Grade 11/12 business rules.

## Phase 6 — Portfolio/evidence integration

- **Objective:** Attach secure reusable evidence to learner attempts and portfolios.
- **Scope:** Asset/attachment references, allowed evidence categories, evidence authorization, lifecycle/retention policy.
- **Dependencies:** Phases 2–5 and approved file policy.
- **Deliverables:** Reusable evidence linkage without duplicated object storage.
- **Acceptance criteria:** Evidence is available only through authorized learner/assessment scope and survives valid portfolio linkage.
- **Tests required:** Upload/download/presign/delete authorization, storage failure, retention, cross-school tests.
- **Out of scope:** Parent/learner self-service upload unless separately approved.

## Phase 7 — Reporting and publication

- **Objective:** Produce authorized reports from finalized outcomes.
- **Scope:** Learner, subject, class, teacher assessment, completion, evidence, and finalized-result reports; publication rules.
- **Dependencies:** Phases 4–6 and approved finalization/publication policy.
- **Deliverables:** Derived reporting queries/exports and controlled publication.
- **Acceptance criteria:** Reports use finalized results only and drafts remain inaccessible as official outputs.
- **Tests required:** Finalization, publication, report accuracy, role/school isolation tests.
- **Out of scope:** A separate editable reporting marks database.

## Phase 8 — Grade 11 support

- **Objective:** Configure Grade 11 using the existing shared model.
- **Scope:** Grade 11 academic/assessment configuration and approved rules.
- **Dependencies:** Phases 3–7 and Grade 11 policy approval.
- **Deliverables:** Grade 11 configuration/templates without grade-specific schema duplication.
- **Acceptance criteria:** Grade 11 works through the same workflows, security model, and reporting path.
- **Tests required:** Grade 11 configuration and regression tests across grades.
- **Out of scope:** Grade 12-specific rules.

## Phase 9 — Grade 12 support

- **Objective:** Configure Grade 12 using the existing shared model.
- **Scope:** Grade 12 academic/assessment configuration and approved rules.
- **Dependencies:** Phases 3–8 and Grade 12 policy approval.
- **Deliverables:** Grade 12 configuration/templates without grade-specific schema duplication.
- **Acceptance criteria:** Grade 12 works through the same domain, authorization, finalization, and reporting model.
- **Tests required:** Grade 12 configuration and full multi-grade regression tests.
- **Out of scope:** Parallel grade-specific assessment engines.
