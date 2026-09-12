# Foundation slice implementation

Implemented 2026-09-10 against the owner-confirmed `schoolhub-fresh-dev` development branch (`neondb`). The task explicitly approved replacing disposable PostgreSQL data and migration history, superseding the earlier planning-only gates. Provider branch identity remains owner-confirmed; a local endpoint/database fingerprint prevents scripts from silently switching targets.

## Delivered

`lib/db/schema.ts` is the authoritative domain schema. `lib/db/auth-schema.ts` retains the four Better Auth table contracts (names, camelCase fields, timestamp types, nullability, account/session cascades). Application identities are UUIDs. All tenant relationships use `school_id` and composite foreign keys; redundant context keys bind year, grade, class, learner, admission, placement and offering where needed.

| Tables | Seed rows |
|---|---|
| schools | 1 |
| audit_actors | 4 (bootstrap service and three humans) |
| school_memberships, roles, membership_roles, staff_profiles | 3 each |
| learners, learner_admissions, learner_enrolments, class_placements | 4 each |
| academic_years, grades, class_groups | 1 each |
| terms, subject_catalogue, subject_grades, school_subjects, subject_offerings, teacher_assignments | 3 each |
| learner_subject_enrolments | 12 |
| audit_events | 1 bootstrap event |
| user, account | 3 each |
| session, verification | No persistent fixtures |

The seed creates SchoolHub Development School, School Admin / Teacher / Moderator roles, a demonstration 2026 year with three sample terms, Grade 10 East, Mathematics/English/Biology and four sample learners. Curriculum/subject codes explicitly use `DEMO`; they are not official KNEC codes or calendar rules. IDs and business data are deterministic; password hashes use Better Auth's salted hashing. Seed reruns leave existing rows and credentials unchanged, rather than overwriting later development work.

## Integrity and history

- `0000_foundation.sql` is generated from the Drizzle schema; `0001_foundation_guards.sql` supplies reviewed PostgreSQL checks, referencing-side FK indexes and triggers. Regenerate the latter with `node scripts/generate-foundation-guards.mjs` **only before applying a new baseline**. After a baseline is shared, add forward migrations instead of changing its checksums.
- Nonblank bounded descriptors, valid statuses, positive ordinals/versions, date ordering and context FKs are enforced in PostgreSQL. All 83 FKs have usable referencing indexes.
- Calendar dates are inclusive. Null academic interval ends mean the parent academic-year end for containment, while overlap checks reserve the open interval. A class transfer closes the old placement the day before the new one starts and closes dependent subject enrolments in the same transaction. Role grants use half-open timestamp intervals.
- Deferred triggers reject overlapping active years, overlapping terms, out-of-parent intervals, mismatched curricula, platform-role school grants and overlapping placement/subject/teacher/role intervals. They recheck parent edits as well as child inserts. Tenant writes lock the school row; domain operations use SERIALIZABLE transactions.
- New mutable records have UTC `timestamptz` provenance, actor references, archive timestamps and positive row versions. Updates increment versions automatically and preserve identity/creation provenance. Human mutation actors must belong to the active school; global catalogue/bootstrap operations are reserved for service tooling in this slice.
- Audit events and actors reject ordinary UPDATE, DELETE and TRUNCATE. Audit payloads are bounded objects; domain commands explicitly allowlist metadata and avoid copying names, passwords or request bodies. Identity references restrict deletion of users with academic history.

## Authorization and application behavior

`lib/domain/foundation.ts` implements session-identified, school-scoped operations with an injected database/session boundary for testing. `lib/domain/server.ts` obtains identity from Better Auth on the server. No Server Action accepts a caller-supplied user, role, actor or membership as authority.

Active school/membership, joined date, unrevoked in-date role grants and supported policy version are checked. School Admin can read school offerings and perform an audited, optimistic-version learner rename. Teachers need an active staff profile, Teacher role, current allocation, enabled subject and active class/year; rosters additionally require current learner/admission/enrolment/placement/subject participation. Moderator alone grants no teacher roster access. Forbidden/unknown context is not disclosed through raw SQL errors. Conflicts require the caller to reload and retry explicitly.

`/academics` is a usable school/subject/roster view linked from the existing navigation. Learner rename is exposed as a protected Server Action; full administration forms and onboarding are the next slice.

Legacy portfolios, staff resources, media, notices and calendar pages display an integration notice. Their preserved adapters return authenticated empty lists or reject mutations before database/R2 access. The old media byte route returns uncached HTTP 410. The dashboard's legacy feeds are empty during this transition. Original UI components and historical table definitions remain available for later integration, but `lib/db/legacy-schema.ts` is excluded from authoritative migrations. This temporary loss of legacy features is deliberate and visible, not a silent fallback to unsafe tables.

Better Auth retains email/password login and its public tables. The route now uses the installed Better Auth Next.js handler directly: arbitrary credentialed CORS reflection and development wildcard/origin-check bypass were removed. Cookies are SameSite=Lax and secure for HTTPS base URLs; local HTTP development login works. Registration creates an identity only and grants no school membership or role. No invitation/onboarding or production deployment was implemented.

## Migration and local operation

Removed old SQL artifacts `0001_cloudy_madame_web.sql`, `0002_add_section.sql`, unjournaled `0003_add_event_color.sql`, and replaced the inconsistent journal/snapshots (including the missing old 0000 SQL baseline). The new history contains exactly two journaled migrations.

Removed live legacy tables: `folders`, `files`, `announcements`, `events`, `activity_logs`, `students`, `portfolioFiles`. All four disposable auth tables were rebuilt with compatible definitions. No dummy users were migrated. No R2 listing/read/write/delete requests were performed, and `neon_auth` remains outside application migrations.

Commands (Node 24+; local execution used Node 26.8.1):

```sh
# After verifying the connection points to the development branch:
node scripts/db-pin.mjs schoolhub-fresh-dev
npm run db:reset       # Explicitly destructive to the pinned disposable target
npm run db:seed
npm run db:verify
npm run test:integration
npm run test:concurrency
```

`db:migrate` applies unapplied migrations and rejects checksum/history mismatches. `db:reset` removes only the explicit owned table list, its migration tracking table and named foundation functions, with RESTRICT. Unexpected public tables or cross-schema dependencies abort it. Reset plus migration executes in one PostgreSQL transaction: on failure the previous schema/data remain. After a committed reset, recovery is a fresh replay and seed; no production-data rollback is promised for disposable data. Neither `public` nor `neon_auth` is dropped. Scripts do not run during application startup, build, or default tests and refuse `NODE_ENV=production` or an unpinned/changed target.

Development logins: `admin@schoolhub.test`, `teacher@schoolhub.test`, `moderator@schoolhub.test`. Their generated password is only in ignored `.env.local` as `DEV_SEED_PASSWORD`. Never commit it. `DEV_DATABASE_FINGERPRINT` in the same ignored file records the owner-verified endpoint/database, not credentials. No secret values appear in this report.

For HTTP smoke testing, run the app locally with a matching `BETTER_AUTH_URL`, then `npm run test:auth`. `SMOKE_BASE_URL` defaults to `http://localhost:3000`. The test logs out its session and never prints tokens/passwords.

## Verification evidence

- `npm run typecheck`: PASS.
- `npm run lint`: PASS, zero errors; 26 existing legacy/UI warnings remain.
- `npm run test`: PASS, 41 tests across four files (validation, auth boundary and every deferred legacy action/R2 boundary).
- `npm run build`: PASS. The first sandboxed build could not download existing Google Fonts; the network-enabled rerun succeeded.
- Database integration: PASS, 51 checks against real PostgreSQL with rollback-only second-school and negative fixtures. Includes real foreign-school objects, same-school wrong-class contexts, unassigned second teacher, revoked/expired/future permissions, immutable audit/actors, stale versions, successful audited writes and rollback on audit failure.
- Concurrent overlapping-term transactions: PASS; both cannot commit; temporary rows removed.
- Better Auth HTTP smoke: PASS for unauthenticated redirect, wrong password, untrusted origin, login, session, Academics page, disabled media route, logout and invalid session.
- Migration re-entry and seed re-entry: PASS, no duplicates or credential replacement.
- Live verification: 25 public tables, 289 columns, 83 validated/indexed FKs, two matching migration checksums and expected seed counts. Nine provider `neon_auth` tables remain present.

## Remaining scope and next step

Build school-admin workflows for admissions, annual enrolment, class transfers, academic calendars, subject adoption and dated teacher/role assignments using audited domain commands. Add authorized onboarding and explicit multi-school selection UX as those workflows arrive.

No assessments, moderation workflows, results, reporting, evidence schema or R2 migration is implemented. RLS and restricted runtime DB roles remain deferred; tenant/object authorization is enforced by the server service with composite FKs as integrity support. Deferred integrity validation currently scans foundation tables, suitable for the small development slice; narrow it by affected school/context before scaling. The test calendar is fixed to 2026, so date-sensitive positive teacher-access fixtures must be advanced deliberately for later years. Full administration, legacy feature reintegration and browser automation remain future work.
