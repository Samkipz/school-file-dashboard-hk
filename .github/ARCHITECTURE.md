# SchoolHub Architecture

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
