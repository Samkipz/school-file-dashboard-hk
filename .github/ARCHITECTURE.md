# SchoolHub Architecture

## Learner assessments (2026-09-21)

`learner-assessments.ts` composes the existing SERIALIZABLE school transaction, assigned-offering policy and extracted unchanged foundation roster query. `learner-result.ts` derives exact criterion/task/assessment scores from selected immutable indicators. Three tenant tables hold participation, observations and evidence associations; PostgreSQL guards lock completed academic records and protect referenced assets. The teacher workflow uses `/academics` and a separately authorized private assessment-evidence route. See [implementation and verification status](LEARNER_ASSESSMENT_IMPLEMENTATION.md). No result correction or historical teacher authority is introduced.

## Structured assessment definitions (2026-09-20)

The existing assessment aggregate now includes tenant-scoped criteria, indicators and performance levels, exact integer-hundredth scoring, generic origin and a draft ? open transition. Shared teacher/admin authoring uses the foundation offering policy inside the existing SERIALIZABLE school transaction. Child mutations advance aggregate revisions; open definitions are locked at service and PostgreSQL boundaries. See [decisions, migrations and verification](STRUCTURED_ASSESSMENT_IMPLEMENTATION.md). Earlier draft-only statements below are historical.

## CBE frontend shell (2026-09-20)

`components/app-layout.tsx` is now a server wrapper that resolves school capabilities; `app-shell.tsx` and `sidebar-nav.tsx` render the responsive shell. Request-local cached school context uses the session-bound foundation service. Navigation is presentation only: domain checks remain authoritative. A single membership may be selected automatically; multiple memberships require explicit selection, and invalid explicit context never falls back to another school.

Home (`/`) and My Teaching (`/academics`) use current assigned offerings, including for mixed admin/teacher users. The existing `getFoundation` gains an explicit assigned scope without changing its default admin-access behavior. `getSchoolContext` returns effective capabilities and current years/terms using school-local dates. `/academics?school=…&offering=…&view=overview|learners` identifies workspaces by offering ID and reuses the authorized roster service. Counts reuse that same roster query; no assessment aggregates exist. Multiple/no current periods are reported explicitly.

`/files` links to existing learner portfolio files and, for administrators, school media. It introduces no personal-storage ownership model or evidence associations. Existing admin pages retain their forms and actions. Only Overview and Learners are implemented subject destinations. See [implementation record](CBE_SHELL_IMPLEMENTATION.md); no schema/migration change is needed.

## Draft identity hardening (2026-09-16)

Draft saves reconcile retained/new/removed tasks inside the existing parent revision and SERIALIZABLE transaction, preserving retained UUIDs and creation provenance. An additive custom migration defers ordinal uniqueness while retaining the final positive/unique/contiguous 1–100 ordering contract. Application and database nonblank checks share the ECMAScript whitespace set. Future task dependents require an approved deletion/correction lifecycle. See [implementation and checks](ASSESSMENT_DRAFT_HARDENING.md).

## Assessment draft planning (2026-09-14)

School Admin draft planning now composes the existing session-bound foundation transaction in `lib/domain/assessments.ts`, with `/admin/assessments` and thin Server Actions. The shared grade-agnostic schema adds `assessment_types`, `assessments`, and ordered `assessment_tasks`. Composite offering/year and optional term/year FKs enforce context; PostgreSQL guards enforce year-bound dates and aggregate revision changes. Dates may span terms. Only draft status and admin access exist. See [implementation, migration and verification record](ASSESSMENT_FIRST_SLICE_IMPLEMENTATION.md); later assessment phases remain deferred.

## Current progress index

Read [PROJECT_LOG.md](PROJECT_LOG.md) for current delivery state. Later administration, lifecycle and portfolio/media implementation records supersede the foundation-only snapshot below. `lib/domain/server.ts` binds session identity to the foundation, administration and file services; `media_assets` and `media_folders` are authoritative storage metadata. The approved future [assessment evidence policy](ASSESSMENT_EVIDENCE_DECISIONS.md) reuses those assets; assessment associations are not yet implemented.

## Evidence labels

**FACT** is observed code. **INFERENCE** is a conclusion from that code. **REQUIREMENT** is supplied project direction. **RECOMMENDATION** is a proposed design decision.

## Implemented foundation (2026-09-10)

The [foundation implementation record](FOUNDATION_SLICE_IMPLEMENTATION.md) supersedes the historical baseline below. The application now has 21 R4 foundation tables plus four compatible Better Auth tables, composite tenant/context FKs, temporal integrity triggers, deterministic development fixtures and a session-backed domain service. `/academics` exposes authorized offerings/rosters. Legacy feature UI code is retained behind disabled adapters until school integration is implemented. No assessment or R2 migration is included.

## Pre-foundation state (historical)

### Stack

- **FACT:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, and shadcn-style local UI components. Sources: `package.json`, `app/`, `components/`.
- **FACT:** PostgreSQL through `pg` and Drizzle ORM; schema is in `lib/db/schema.ts`, with Drizzle metadata/migrations in `drizzle/`.
- **FACT:** Better Auth provides email/password authentication through `app/api/auth/[...all]/route.ts` and `lib/auth.ts`.
- **FACT:** Cloudflare R2-compatible S3 object access is implemented in `lib/r2.ts`.
- **FACT:** Vercel deployment configuration is in `vercel.json`; Vercel Analytics is rendered in production by `app/layout.tsx`.

### Application shape

```text
app/                 App Router pages, Server Actions, API routes
  actions/           Direct auth + Drizzle + R2 application operations
  api/               Better Auth route; media byte route
components/          Client feature components and reusable UI primitives
lib/                 Authentication, database, R2, activity helpers
drizzle/             SQL migrations and Drizzle snapshots/journal
public/              Static visual assets
```

- **FACT:** Protected pages check a Better Auth session then redirect to `/sign-in`; interactive components call Server Actions.
- **FACT:** There is no separate repository/service layer; action modules call Drizzle and R2 directly.
- **FACT:** Current reusable UI includes buttons, cards, inputs, labels, avatars, toast, and confirmation modal under `components/ui/`.

### Current models and file architecture

- **FACT:** Auth models: `user`, `session`, `account`, `verification`.
- **FACT:** Application models: `folders`, `files`, `announcements`, `events`, `activity_logs`, `students`, `portfolioFiles`.
- **FACT:** Only Better Auth account/session rows have database foreign keys to `user`; application relations are represented by unconstrained text IDs.
- **FACT:** `students` holds `name`, free-text `className`, and `userId`. `portfolioFiles` stores R2 metadata and `studentId`.
- **FACT:** `files` stores R2 metadata and `folderId`; `folders.section` separates `staff` and `media` use cases.
- **INFERENCE:** The existing portfolio/file system is useful as a starting point for reusable assets, but it is not yet a safe or normalized attachment architecture.

## Target architecture

**REQUIREMENT:** Grade 10 is the first implementation target; the same academic and assessment model must support Grades 11 and 12 without grade-specific schemas or duplicated business logic.

```text
School
 └─ Membership ─ User ─ Staff profile / roles
 └─ Academic year ─ Grade ─ Class / Stream ─ Enrolment ─ Learner
 └─ Subject ─ Teacher assignment (staff + subject + class/stream/year)
 └─ Assessment ─ Task ─ Criterion/Rubric
                         └─ Learner attempt/result ─ Score / Evidence
                                                    └─ Moderation / finalization / publication
                                                       └─ Reports derived from finalized results
```

### Target domain components

- **RECOMMENDATION:** Make `School`, `Membership`, `Role`, `Staff`, `Learner`, `AcademicYear`, `Grade`, `Class`, `Stream`, `Enrolment`, `Subject`, and `TeacherAssignment` the authorization and academic foundation.
- **RECOMMENDATION:** Make `Assessment`, `AssessmentTask`, `Criterion`, `Rubric`, `LearnerAttempt`, `Score`, `Evidence`, `Moderation`, `Finalization`, `Publication`, `Result`, and `Report` the assessment domain.
- **RECOMMENDATION:** Persist grade, subject, term, type, academic year, scope, and lifecycle state as data. Reuse one assessment schema across Grades 10–12.
- **RECOMMENDATION:** Use a policy/service boundary for assessment commands and queries, with Server Actions/API routes as delivery mechanisms only.
- **RECOMMENDATION:** Use a reusable file asset plus attachment/reference model for portfolios, media, and evidence; access must be checked against the linked domain object.
