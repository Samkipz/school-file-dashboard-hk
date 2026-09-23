# CBE frontend alignment review

Date: 2026-09-20

Implementation follow-up: the owner subsequently approved the bounded CBE shell and teacher workspace slice. See [current implementation and verification](CBE_SHELL_IMPLEMENTATION.md) and [PROJECT_LOG.md](PROJECT_LOG.md). The capability map below records the pre-slice assessment, not a claim that the new shell remains missing. The later instruction narrows teacher navigation to Home, My Teaching and Private Files; its scope supersedes the broader target navigation proposed below.

## Scope and conclusion

**REQUIREMENT:** The owner's supplied SchoolHub CBE journey is the primary product direction: academic setup → teaching → assessment → evidence → learner progress → reporting/readiness. Unrelated existing modules are deferred from the primary experience; their future packaging is undecided.

**INFERENCE:** SchoolHub has a useful school administration, authorization and private-file foundation, but is still at an early stage of the intended frontend journey. The teacher cannot yet complete the central assessment-to-progress loop. This requires both frontend architecture and additional domain capabilities, not just visual restyling.

This is a source-code assessment, not a live browser, accessibility, database or production verification. The September 17 checkpoint records historical passing checks, not proof that unimplemented capabilities exist. National-policy statements in the supplied plan are treated as product context, not independently verified regulatory findings. No official scoring labels, weights, reporting formats or integration claims are approved by this review.

## Capability map

Built means the named bounded capability exists in application code, not that the whole CBE requirement is complete. Partial means a reusable implementation exists but the planned journey is incomplete. Missing means no implementation was found in the current application routes/domain/schema.

| Planned capability | Status | Repository evidence and remaining gap |
| --- | --- | --- |
| Academic years, terms and classes | Built | `components/academic-administration.tsx` exposes create/edit workflows. A guided setup sequence and completion overview are missing. |
| School subjects, offerings and teacher assignments | Built | Administration UI and `lib/domain/administration.ts` support these operations. This is a reusable academic foundation. |
| Admission, enrolment, placement and lifecycle | Built | Administration and `lib/domain/learner-lifecycle.ts` provide admission, subject enrolment, transfer, withdrawal, re-admission and rollover support. |
| Senior School academic identity | Partial | Year, grade, class and individual subject enrolments exist. Pathway, track, configurable subject-combination definitions and learner combination assignment are absent from `lib/db/schema.ts`. |
| Teacher knows what they teach | Partial | `lib/domain/foundation.ts` filters offerings and rosters by current teacher assignment; `/academics` renders links and learner names. No teacher home with actionable work. |
| Subject workspace | Partial | `/academics?school=…&offering=…` can show a roster. No connected overview, assessments, portfolio and reports workspace. |
| Assessment authoring | Partial | `/admin/assessments` supports types, title, instructions, optional dates/term and ordered tasks. It is School Admin only; teacher authoring is absent. |
| Activation and assessment lifecycle | Missing | `lib/db/schema.ts` constrains assessment status to `draft`; active/archive transitions are not implemented. |
| Assess each learner | Missing | No participation/attempt records, criterion results, feedback workflow or assessed/remaining roster. |
| Learner portfolio file storage | Built | Portfolio UI and `lib/domain/files.ts` provide learner-owned private files and retained learner history. Teachers have scoped read-only access; admins manage uploads. |
| Academic evidence portfolio | Partial | Existing files are reusable, but no assessment/task association, subject-based evidence history, feedback relationship or evidence-completeness workflow. |
| Learner self-service | Missing | No learner home, own-subject access, submission or progress journey. The foundation access gate supports school admin, teacher and moderator, not learner self-service. |
| DOS operational overview | Missing | No cross-subject assessment completion or actionable exception dashboard. |
| Principal overview | Missing | No dedicated leadership experience or reporting access contract. Do not infer principal permissions from the admin role. |
| Progress and reporting | Missing | No result aggregation, learner progress record or publication/report workflow. |
| KNEC readiness | Missing | No validated readiness rules, completeness checks or export workflow. This must remain internal preparation unless an official integration is established. |
| Role-aware navigation and context | Partial | Server-side school/assignment checks exist, but all users receive the same sidebar. School context is selected independently on pages; the shell carries no shared year/term/offering context. |

**FACT:** The supplied narrative overstates assessment lifecycle readiness. Current code implements drafts only, not draft/active/archive behavior. Task titles and instructions are also not a scoring rubric or curriculum competency model.

## Most consequential frontend mismatches

1. **Product identity remains file-oriented.** `components/sidebar-nav.tsx` says “File Repository”; `app/layout.tsx` describes file management and collaboration.
2. **Home does not represent current academic work.** `app/page.tsx` renders activities/events. `app/actions/dashboard.ts` uses `legacyEmptyRead()`, which currently returns true after authentication, so those feeds receive empty arrays.
3. **Navigation exposes unavailable and irrelevant destinations.** Staff Resources and Calendar are primary sidebar items even though their pages return `DeferredFeature`. Admin links appear for teachers, although the domain correctly denies unauthorized operations.
4. **The teacher journey stops at a roster.** Teachers cannot proceed from their subject to planning, conducting an assessment, attaching evidence and reviewing progress.
5. **Administration exposes separate data operations.** Creating a learner, admitting, enrolling, placing and enrolling in subjects are separate forms. The data model is useful; a guided admission flow should coordinate it and clearly show incomplete steps and recovery after partial completion.
6. **Portfolios are disconnected from learning activity.** Selecting a learner opens a file list, not subject/task evidence with results and feedback.

## Proposed information architecture

**RECOMMENDATION:** Organize the app around workspaces and user responsibilities. These are target destinations, not claims of available functionality.

| Persona | Primary navigation | Landing experience |
| --- | --- | --- |
| School Admin / DOS | Overview, Learners, Academics, Assessment Monitoring, Reports & Readiness | Setup gaps first; later assessment exceptions with direct corrective actions |
| Teacher | My Teaching, Assessment Work, Learner Progress | Assigned subject/class cards and work needing attention |
| Learner | My Learning, My Portfolio, My Progress | Own subjects, upcoming work and feedback |
| Principal | School Overview, Progress, Readiness | School-level trends and exceptions, with explicitly authorized drill-down |

Persona is a presentation concern; server-verified capabilities remain the authority. Multi-role staff need access to their authorized workspaces without requiring a new account. Learner and principal access require explicit domain policies before implementation.

The teacher's central workspace should be:

`Subject · Grade/Class · Academic Year · Term`

`Overview | Learners | Assessments | Portfolio | Reports`

Use the subject offering as the underlying identity; a subject name alone cannot distinguish classes or years. Preserve school/offering context in deep links and server-check it on every read/write. Infer teacher identity from the session and assignments. Provide explicit school selection where multiple memberships exist, and a clear year/term selection rule instead of silently choosing an arbitrary active record.

Only expose functional tabs as actionable destinations. Future tabs may appear in design artifacts with explicit planned status. Empty, loading, denied, archived and unavailable states must remain distinguishable; an unavailable aggregate must not appear as zero completed work.

## What stays core and what leaves the primary experience

**Core:** academic administration, learner identity/lifecycle, teacher assignments, subject workspaces, assessment, learner evidence, progress and readiness. Authentication, authorization, audit and private asset storage remain essential supporting infrastructure.

**Deferred from primary navigation:** generic Staff Resources, standalone Media Files browsing, generic Calendar, noticeboard, community discussions and activity feeds. Existing working code/data need not be deleted. Assessment deadlines belong in the teaching workflow; a future shared calendar can consume them. Private storage remains core even when generic media browsing is secondary.

**Portfolio remains core**, but its destination is an academic evidence record rather than a generic file repository.

## Recommended implementation sequence

1. **CBE shell and usable subject workspace.** Update product identity, use server-derived navigation capabilities, preserve academic context, replace the legacy home with role-appropriate entry points, and turn the existing offering/roster into the teacher's My Teaching → subject → learners journey. Remove deferred modules from primary navigation. Acceptance: a teacher sees only authorized offerings, opens the correct roster, and retains context on refresh and navigation; admins retain setup access. Do not fabricate pending-work counts.
2. **Complete academic setup experience.** Coordinate admission steps, show setup gaps, and add configurable pathways/tracks/combinations with provenance and school-specific availability. Resolve class versus subject-teaching-group requirements explicitly; current offerings are class-bound. Acceptance: an administrator can establish and inspect a learner's complete academic identity and identify incomplete registrations.
3. **Teacher assessment lifecycle.** Extend assignment-scoped assessment access and authoring; implement activation, learner participation and safe correction rules. Acceptance: a teacher creates and activates an assessment inside the assigned subject without selecting themselves or reconstructing context.
4. **Assessment, feedback and evidence.** Implement the verified scoring model, learner task results, feedback and associations to existing assets. Acceptance: assess one learner end to end and retrieve the same evidence through the academic portfolio without duplicating stored bytes.
5. **Learner experience and progress.** Add verified user-to-learner access, submission permissions, publication rules and progress calculations. Acceptance: a learner sees only their own authorized work and released feedback.
6. **Monitoring, leadership and readiness.** Build aggregates from actual assessment records, define denominators and required evidence, then introduce sourced/versioned readiness checks and any validated exports. Every exception should link to a corrective workflow.

Before task-dependent records are introduced, resolve deletion/versioning/correction behavior: the current draft service physically deletes removed tasks. The September 17 checkpoint explicitly identifies this dependency. Existing evidence preservation decisions in `ASSESSMENT_EVIDENCE_DECISIONS.md` should carry forward; they are policy, not implemented evidence linking.

For new workflow slices, validate server authorization as well as browser behavior, including cross-school/offering denial, stale form conflicts, mobile use, keyboard access and recovery from failed saves. This review changed documentation only; it did not rerun application tests or alter historical checkpoint records.
