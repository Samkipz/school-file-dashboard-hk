# SchoolHub Assessment Specification

## Scope and status

September 16 hardening: retained draft tasks use stable UUIDs across edits and reorder. IDs must resolve to the authorized draft; new IDs are server-generated. Current draft-only removal is not a future referenced-task policy. **A referenced-task deletion/correction lifecycle must be reviewed and approved before dependent records are implemented.** See [hardening and verification](ASSESSMENT_DRAFT_HARDENING.md).

Draft planning update (2026-09-14): School Admin draft planning is implemented locally; see [implementation and verification](ASSESSMENT_FIRST_SLICE_IMPLEMENTATION.md). Configurable assessment types, draft assessments and ordered tasks reuse the existing academic foundation. Teacher release, attempts/evidence, scoring, moderation and reporting remain unimplemented.

- **FACT:** The first assessment domain slice is admin-only draft planning. The broader target workflow below is not a claim that later stages exist.
- **REQUIREMENT:** Grade 10 is the initial delivery scope; Grades 11 and 12 must use the same academic and assessment domain.
- **RECOMMENDATION:** This document is the target domain specification. Its framework-specific rules, weights, required tasks, retention periods, and approval rules require a cited official assessment framework before implementation.

## Design principles

- **REQUIREMENT:** Grade, assessment type, academic year, term, and subject are data, not schema variants or grade-specific code paths.
- **RECOMMENDATION:** All assessment records are school-scoped and tied to a specific academic context, learner enrolment, and authorized staff assignment.
- **RECOMMENDATION:** Assessment lifecycle state is explicit and transition-controlled; finalized/published data is never silently overwritten.

## Core concepts

| Concept | Target meaning |
|---|---|
| Academic Year | School-defined academic reporting period. |
| Grade | Data record such as Grade 10, 11, or 12. |
| Class / Stream | School-defined teaching grouping within grade/year. |
| Learner | School learner identity/profile. |
| Subject | Assessed curriculum subject. |
| Enrolment | Learner membership in year, grade, class/stream, and subject context. |
| Teacher Assignment | Permission-bearing allocation of staff to subject/class/stream/year. |
| Assessment | School-scoped assessment plan for subject, grade/context, term, and type. |
| Assessment Type | Configurable type; initial minimum values: `PROJECT`, `PRACTICAL`, `PERFORMANCE_TASK`, `WRITTEN_TEST`, `CLASSROOM_ASSESSMENT`. |
| Assessment Task | Deliverable/activity within an assessment, with dates, instructions, and weighting. |
| Criterion / Rubric | Measurable scoring definition, levels/bands, descriptors, and maximums. |
| Learner Attempt | The learner-specific assigned/submitted task instance. |
| Score | Authorized score against task/criterion, including assessor and audit metadata. |
| Evidence | Authorized attachment/reference supporting an attempt or score. |
| Moderation | Reviewed assessment/score decision with reviewer, outcome, reason, and audit trail. |
| Finalization | Protected confirmation that results are complete and approved. |
| Publication | Controlled release of finalized results/reports. |
| Result | Derived, versioned outcome calculated from authoritative finalized scores. |
| Report | Presentation/export derived from finalized results, not a second marks database. |

## Grade 10 SBA capability

**REQUIREMENT:** Grade 10 SBA must support projects, practicals, written tests, scoring guides/rubrics, learner evidence, electronic portfolios, teacher scoring, result finalization, and an audit trail.

**RECOMMENDATION:** Configure the exact number, weighting, rubrics, deadlines, and moderation rules from approved curriculum policy as assessment-template data; do not hard-code them in database design or UI logic.

## Workflow and permissions

**FIRST-SLICE BOUNDARY (2026-09-14):** All assessment draft reads/mutations require School Admin. Assigned teachers and moderator-only callers have no access. The teacher workflow below requires a later approved release implementation. Optional assessment/task dates fit the offering academic year and are ordered when both exist. Term is classification only, bound to that same year; dates need not fit the term. These are technical domain rules, not official SBA rules.

```text
Assessment creation
  -> Task definition
  -> Rubric / criteria
  -> Learner assignment
  -> Evidence collection
  -> Teacher scoring
  -> Moderation
  -> Finalization
  -> Publication
  -> Reporting
```

| Stage | School Admin | Teacher | Future scope |
|---|---|---|---|
| Academic structure, subjects, assignments | Configure/manage | View assigned context | Learner/parent access undefined |
| Assessment/task/rubric | Create/manage | View assigned; create only if policy grants it | — |
| Learner assignment/evidence | Manage | Work with assigned learners; upload permitted evidence | Learner self-upload undefined |
| Scoring | Review/manage | Score assigned learners | Learner/parent viewing undefined |
| Moderation | Moderate | Submit/respond where allowed | — |
| Finalization/publication | Finalize/publish | Submit for moderation only | Learner/parent delivery undefined |
| Reporting | Generate/authorize | View permitted assigned reports | Learner/parent reports undefined |

**REQUIREMENT:** Initially, School Admin configures academic structure, creates subjects, assigns teachers, creates/manages assessments, moderates, finalizes, and publishes. Teachers view assigned assessments, assess assigned learners, enter scores, upload evidence, and submit for moderation.

## Portfolio and evidence integration

- **FACT (2026-09-14):** Restored portfolios/media use school-scoped `media_assets` and `media_folders`; legacy `portfolioFiles`/`files` are not authoritative. See [portfolio implementation](PORTFOLIO_MEDIA_IMPLEMENTATION.md).
- **REQUIREMENT:** Do not duplicate file storage for assessment evidence.
- **APPROVED POLICY (2026-09-14):** Preserve referenced evidence, block asset archival while referenced, require current assignments for teacher access and retain school-admin historical access. See [evidence decisions and proposed implementation contract](ASSESSMENT_EVIDENCE_DECISIONS.md). Association implementation remains pending.
- **RECOMMENDATION:** Add an evidence association referencing the existing asset with same-school and same-learner integrity; reuse stored bytes.
- **REQUIREMENT:** Evidence supports permitted documents, images, videos, audio, and other approved educational evidence.
- **RECOMMENDATION:** Evidence access must inherit the linked school, learner enrolment, assessment task, teacher assignment, lifecycle, and role rules.

## Reporting

**REQUIREMENT:** Target reports are learner assessment, subject, class, teacher assessment, assessment completion, assessment evidence, and finalized result reports.

**RECOMMENDATION:** Generate reports from finalized results and authorized evidence/metadata. Do not create an independently editable marks store solely for reporting.

## Decisions requiring approval before implementation

1. Official framework source and the exact Grade 10 SBA rules, weighting, task count, moderation, and retention requirements.
2. Whether teachers may create assessments or only administer admin-created assessments.
3. School roles beyond School Admin and Teacher, including moderator separation-of-duties.
4. Evidence retention, permitted formats/sizes, virus scanning, and parent/learner access policy.
5. Finalization correction/reopening authority and report publication audience.
