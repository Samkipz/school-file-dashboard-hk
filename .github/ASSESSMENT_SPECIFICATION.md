# SchoolHub Assessment Specification

## Scope and status

Foundation update (2026-09-10): the parent school, learner, year, class, subject and teacher-assignment schema is now implemented; see [foundation delivery](FOUNDATION_SLICE_IMPLEMENTATION.md). Assessment tables, scoring, moderation and reporting remain unimplemented and outside this slice.

- **FACT:** No assessment domain exists in the present repository.
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

- **FACT:** Existing `portfolioFiles` store learner-linked R2 object metadata; generic `files` store folder-linked metadata.
- **REQUIREMENT:** Do not duplicate file storage for assessment evidence.
- **RECOMMENDATION:** Introduce a reusable school-scoped file asset and an evidence/attachment reference. Portfolio and assessment records reference the same asset when appropriate.
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
