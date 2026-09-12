# Phase 0 Audit

## Status language

- **FACT** — directly observed from the repository, commands, or non-mutating database-connection attempt.
- **INFERENCE** — conclusion reasonably derived from the observed evidence.
- **RECOMMENDATION** — a proposed remediation action; it has not been implemented by this audit.
- **RISK (INFERENCE)** — potential impact derived from the preceding facts.

## 1. Repository Root and Git State

- **FACT:** The Git root is `C:\Users\Sam\Documents\Backup\codezone`, reported by `git rev-parse --show-toplevel` while working in `C:\Users\Sam\Documents\Backup\codezone\school-cloud`.
- **FACT:** `school-cloud` is physically nested directly below that root. The parent directory contains `.git`, `Credentials`, and `school-cloud`; it does not contain the root-level `app`, `lib`, `drizzle`, `package.json`, or other tracked project paths.
- **FACT:** `git ls-tree -r HEAD` lists the SchoolHub project at root-relative paths such as `app/actions/calendar.ts`, `lib/db/schema.ts`, and `package.json`.
- **FACT:** `git status --short` reports those root-level paths as deleted (`D ../app/...`, `D ../package.json`, etc.) and reports `?? ./`, meaning the entire nested `school-cloud` directory is untracked.
- **FACT:** The parent root contains an untracked `Credentials/` directory. Its contents were not inspected.
- **INFERENCE:** The project files were copied or moved into the nested `school-cloud` directory without a corresponding Git move/commit. There is one checked-out physical application copy—the untracked nested copy—and one tracked Git-tree copy recorded in `HEAD` but absent from the root worktree. The audit found no second physical checked-out application copy at the parent root.
- **RISK (INFERENCE):** Normal commits from the present worktree could record root-level deletions plus an untracked nested project, rather than the intended source changes.
- **RECOMMENDATION:** Before any implementation, have a human approve the canonical repository layout and a non-destructive recovery/move plan. Confirm whether `Credentials/` must be retained outside Git and ensure it remains ignored.

## 2. Database and Migration State

### Configuration and intended schema

- **FACT:** Drizzle is configured for PostgreSQL, schema `./lib/db/schema.ts`, output `./drizzle`, and a `DATABASE_URL` loaded from `.env.local`. Source: `drizzle.config.ts`.
- **FACT:** Runtime database access uses a `pg` `Pool` with `DATABASE_URL`, passed to Drizzle. Source: `lib/db/index.ts`.
- **FACT:** There are no migration commands in `package.json`; its scripts are only `dev`, `build`, `start`, and `lint`.
- **FACT:** The current Drizzle schema declares `user`, `session`, `account`, `verification`, `folders`, `files`, `announcements`, `events`, `activity_logs`, `students`, and `portfolioFiles`. Source: `lib/db/schema.ts`.

### Migration inventory and consistency

- **FACT:** SQL files present are `drizzle/0001_cloudy_madame_web.sql`, `drizzle/0002_add_section.sql`, and `drizzle/0003_add_event_color.sql`.
- **FACT:** The journal has only `0000_icy_squadron_sinister`, `0001_cloudy_madame_web`, and `0002_add_section`; there is no `0003` entry. Source: `drizzle/meta/_journal.json`.
- **FACT:** There is no `drizzle/0000_icy_squadron_sinister.sql`, even though the journal records it.
- **FACT:** Snapshots exist only through `drizzle/meta/0002_snapshot.json`; no `0003` snapshot exists.
- **FACT:** `0001` creates `students` and `portfolioFiles`. `0002` adds `section` to `files` and `folders`. `0003` adds non-null `events.color` with default `#3b82f6`.
- **FACT:** `lib/db/schema.ts` contains `files.section` and `folders.section`, but does not define `events.color`.
- **FACT:** `components/calendar-client.tsx` maintains color and end-date UI state; `app/actions/calendar.ts` accepts neither color nor end date and does not persist them.
- **FACT:** `0002_snapshot.json` reflects the `section` columns. It does not reflect `events.color`.
- **INFERENCE:** The migration history is internally inconsistent: the base migration required to reconstruct the pre-`0001` schema is missing, and `0003` is not part of Drizzle's recorded journal/snapshot chain.
- **INFERENCE:** The intended source schema does not include `events.color`, notwithstanding the standalone `0003` SQL file. Therefore no conclusion can be drawn from code alone that the live database contains that column.

### Live database verification boundary

- **FACT:** A non-mutating PostgreSQL metadata query was attempted using the configured `DATABASE_URL`; it exited with code 1 and returned no database error message. No database write, migration, reset, or destructive command was run.
- **INFERENCE:** This audit cannot confirm the live table set, the presence of `events.color`, or applied migration records. The failing metadata connection must be diagnosed separately without exposing credentials.
- **INFERENCE — Conclusion:** The database cannot be safely reconstructed from the checked-in migrations alone.
- **RECOMMENDATION:** Preserve the live database, obtain an approved schema-only backup or read-only metadata export, compare it to the intended schema, then create a reviewed recovery baseline. Do not edit, delete, or run the existing migration files until that comparison is approved.

## 3. TypeScript / Build / Lint / Test State

- **FACT:** `cmd /c node_modules\.bin\tsc.cmd --noEmit --incremental false` exited 0. TypeScript checking currently passes.
- **FACT:** `tsconfig.json` enables `strict` and `noEmit`.
- **FACT:** `next.config.mjs` sets `typescript.ignoreBuildErrors: true`; a production build is configured to ignore TypeScript errors even though the standalone typecheck currently passes.
- **FACT:** `npm run lint` exits 1: the script is `eslint .`, but `eslint` is not installed/available; `node_modules/.bin/eslint.cmd` does not exist. Sources: `package.json`, command output.
- **FACT:** No ESLint configuration file was found in the project.
- **FACT:** `npm run build` exits 1 in the current environment. Next.js 16.2.6/Turbopack fails fetching the Google-hosted `Geist` and `Geist Mono` fonts imported by `app/layout.tsx`.
- **INFERENCE:** This recorded build failure is environment/network-dependent rather than evidence of an application type failure; the build cannot currently be used as a reliable local verification gate.
- **FACT:** There is no `test` script in `package.json`, and no test/spec files or Jest/Vitest/Playwright configuration were found.
- **RECOMMENDATION:** Phase 0 remediation must define working lint, test, and build verification commands; do not add Assessment work until they are reproducible in the intended CI environment.

## 4. Authentication State

### Current authentication

- **FACT:** Better Auth uses the same PostgreSQL pool, enables email/password and automatic sign-in, and sets sessions to seven days. Source: `lib/auth.ts`.
- **FACT:** The browser client exports Better Auth `signIn`, `signUp`, `signOut`, and `useSession`. Source: `lib/auth-client.ts`.
- **FACT:** Protected page components directly call `auth.api.getSession({ headers: await headers() })` and redirect to `/sign-in` where absent. Examples: `app/page.tsx`, `app/portfolios/page.tsx`, `app/media-files/page.tsx`, `app/staff-resources/page.tsx`, and `app/calendar/page.tsx`.
- **FACT:** Server Actions obtain the same session from request headers. Examples: `app/actions/portfolios.ts`, `app/actions/media-files.ts`, `app/actions/staff-resources.ts`, `app/actions/calendar.ts`, `app/actions/noticeboard.ts`, and `lib/activity.ts`.
- **FACT:** There is no middleware file and no shared authorization policy/helper beyond action-local session checks.
- **FACT:** The Better Auth route is `app/api/auth/[...all]/route.ts`; it wraps GET/POST and OPTIONS responses with credentialed CORS that reflects the request origin.
- **FACT:** The sign-up page exposes self-service registration through `authClient.signUp.email`. Sources: `app/sign-up/page.tsx`, `components/auth-form.tsx`.

### Authentication used as authorization

- **FACT:** Portfolio queries/mutations authenticate but do not scope `students` to `students.userId`: `getStudents` selects all rows; student updates/deletes and portfolio operations use IDs without the session user's ownership condition. Source: `app/actions/portfolios.ts`.
- **FACT:** Media and staff folder/file operations commonly require only any session and do not query against `folders.userId` or `files.uploadedBy`. `getMediaFolders`, `getMediaFiles`, `getRootFolders`, and `getFilesInFolder` do not require a session at all. Sources: `app/actions/media-files.ts`, `app/actions/staff-resources.ts`.
- **FACT:** The media byte route checks only for a session, then selects `files` by ID and `section = 'media'`; it does not authorize the caller against folder owner or another scope. Source: `app/media-files/file/[id]/route.ts`.
- **FACT:** Calendar and announcement actions do add `events.userId`/`announcements.userId` conditions to most reads and mutations. Sources: `app/actions/calendar.ts`, `app/actions/noticeboard.ts`.
- **INFERENCE:** Portfolio, staff-resource, and media paths contain obvious IDOR/cross-user exposure paths; the current system lacks the school, membership, role, learner-enrolment, and teacher-assignment primitives required for future authorization.
- **RECOMMENDATION:** Do not add the new authorization system in Phase 0. Define and approve it as Phase 1/2 remediation, then migrate every protected action/route to centralized object-level checks.

## 5. Existing Data Relationships

| Relationship | Intended/application assumption | Actual database constraint | Observed application behavior |
|---|---|---|---|
| `session.userId` → `user.id` | Better Auth session owner | FK with cascade | Auth uses this relationship. |
| `account.userId` → `user.id` | Better Auth account owner | FK with cascade | Auth uses this relationship. |
| `students.userId` → `user.id` | Creator/owner of student | No FK or index | Set on create, but not used to scope portfolio reads/mutations. |
| `portfolioFiles.studentId` → `students.id` | Portfolio evidence belongs to student | No FK or index | Used for select/delete; no owner scope. |
| `portfolioFiles.uploadedBy` → `user.id` | File uploader | No FK or index | Set on upload; never used for authorization. |
| `files.folderId` → `folders.id` | Generic file belongs to folder | No FK or index | Used for queries; uploads do not verify target folder. |
| `files.uploadedBy` → `user.id` | Generic file uploader | No FK or index | Set on upload; not used for authorization. |
| `folders.userId` → `user.id` | Folder creator/owner | No FK or index | Set on create; not used in staff/media access predicates. |
| `folders.parentFolderId` → `folders.id` | Optional folder hierarchy | No FK or index | Current create paths set it to `null`; no hierarchy traversal is implemented. |
| `announcements.userId` → `user.id` | Announcement creator/owner | No FK or index | Used in read/update/delete predicates. |
| `events.userId` → `user.id` | Event creator/owner | No FK or index | Used in read/update/delete predicates. |
| `activity_logs.userId` → `user.id` | Action actor | No FK or index | Set by `lib/activity.ts`; dashboard filters to user. |

- **FACT:** All relationship facts above are declared in `lib/db/schema.ts`; query behavior is in the listed action modules.
- **FACT:** Application tables have primary keys, but no application foreign keys, secondary indexes, RLS policies, check constraints, or enums are declared in the current Drizzle schema/snapshots.
- **INFERENCE:** Missing referential integrity permits dangling student, file, folder, uploader, activity, and parent-folder IDs. Missing indexes will become a performance and reliability concern as records grow.

## 6. Critical Findings

1. **FACT:** Git's recorded root layout and physical project layout differ, creating a deletion/untracked-tree state. See Section 1. **RISK (INFERENCE):** source recovery and commits are unsafe until layout is decided.
2. **FACT:** Base migration `0000` is missing; `0003` is unjournaled and absent from schema snapshots. See Section 2. **RISK (INFERENCE):** migration replay cannot safely reconstruct a known schema.
3. **FACT:** Live database metadata could not be read through the configured connection in this audit. **RISK (INFERENCE):** migration repair cannot safely assume actual production/development state.
4. **FACT:** Lint is non-functional, test infrastructure is absent, and the local build fails on remote font acquisition. See Section 3. **RISK (INFERENCE):** there is no complete reliable quality gate.
5. **FACT:** Multiple file and portfolio actions authenticate but fail to authorize ownership/scope; no school/role primitives exist. See Section 4. **RISK (INFERENCE):** existing users can potentially access or alter other users' data by ID.
6. **FACT:** Application relationships are unconstrained and uploads can write R2 before database persistence; storage delete failures are ignored. Sources: `lib/db/schema.ts`, `lib/r2.ts`, file action modules. **RISK (INFERENCE):** dangling records and orphaned R2 objects.

## 7. Safe Fixes Required Before Phase 1

1. **RECOMMENDATION:** Approve the canonical Git root/layout, preserve all physical files, and carry out a reviewed non-destructive repository recovery plan.
2. **RECOMMENDATION:** Acquire read-only live database schema/migration metadata and reconcile it with the schema, snapshots, journal, and SQL files; produce an approved migration-baseline repair plan.
3. **RECOMMENDATION:** Establish reproducible quality commands: standalone typecheck, a configured lint tool, a test runner, and a build strategy that works in CI without relying on uncontrolled font-network availability.
4. **RECOMMENDATION:** Document the intended data ownership model for existing students/files/folders before Phase 1 introduces school membership and roles.
5. **RECOMMENDATION:** Preserve the documented authorization defects as regression cases; implement their remediation only in the approved authorization phase.

## 8. Risks

- **FACT:** No safe migration reconstruction path is available from checked-in artifacts.
- **FACT:** The currently configured build masks TypeScript errors and local lint does not run.
- **FACT:** Existing auth checks are insufficient for object-level access in portfolio/media/staff-resource paths.
- **INFERENCE:** Adding school/assessment tables before resolving migrations and ownership semantics could compound data-repair, authorization, and deployment risk.
- **INFERENCE:** Moving/deleting files to repair Git without preserving the nested copy could cause data loss; this audit intentionally made no such change.

## 9. Recommended Order of Remediation

1. Freeze feature work and approve the canonical repository layout/recovery approach.
2. Preserve and inspect the actual database through approved read-only access; inventory tables, columns, constraints, indexes, and Drizzle migration records.
3. Reconcile the migration baseline and source schema, including the missing `0000` migration and unregistered `0003`; approve a repair plan before executing it.
4. Restore reliable verification: lint, tests, CI build, and typecheck enforcement.
5. Define the existing-data transition strategy from per-user ownership fields to school/membership-scoped authorization.
6. Begin Phase 1 only after the repository and migration baselines are approved; implement no Assessment domain before Phases 1–3 dependencies are satisfied.

## 10. Phase 0 Acceptance Criteria

- [x] **FACT:** Git root and nested-worktree condition are identified.
- [x] **FACT:** Migration files, journal, snapshots, schema mismatches, and missing base migration are identified.
- [x] **FACT:** Typecheck, lint, build, and test states are recorded.
- [x] **FACT:** Authentication checks and evident authorization/IDOR paths are documented.
- [x] **FACT:** Existing relationships, missing constraints, and application assumptions are documented.
- [x] **FACT:** No schema, migration, auth, feature, or destructive database operation was performed by this audit.
- [ ] **RECOMMENDATION:** Before Phase 0 can be closed as a stable baseline, a human must approve repository recovery and a live-database/migration-baseline remediation plan.

**INFERENCE — Conclusion:** The repository state is sufficiently understood to define remediation safely, so Phase 0 is ready for remediation planning. It is not yet a stable, reconstructible baseline for Phase 1 implementation.
