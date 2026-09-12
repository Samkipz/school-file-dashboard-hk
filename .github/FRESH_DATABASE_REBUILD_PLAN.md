# SchoolHub Fresh Database Rebuild Plan

**Date:** 2026-09-08  
**Status:** PLANNING ONLY  
**Decision context:** The owner confirms that the current PostgreSQL rows are dummy development data and may be lost. This changes the data-preservation requirement for PostgreSQL rows, but does not authorize destructive commands or permit accidental loss of source code, R2 objects, Better Auth dependencies, or provider-managed database objects.

## 0. Scope and Safety Rules

This document does not modify the database, application source, `lib/db/schema.ts`, migrations, Drizzle journal/snapshots, authentication configuration, packages, Git history, or Cloudflare R2. No database mutation, R2 deletion, migration creation, migration execution, or application cutover is authorized by this plan.

The current PostgreSQL rows are **DISPOSABLE DEVELOPMENT DATA**, based on the owner's explicit decision. That does not prove that the current R2 objects are disposable, because object storage has an independent lifecycle and the repository does not contain an object inventory. Existing R2 objects must therefore be treated as **UNKNOWN / PRESERVE UNTIL CLASSIFIED**.

Status language follows the repository rules:

- **FACT:** Directly observed in source, checked-in artifacts, or prior read-only evidence.
- **INFERENCE:** A conclusion drawn from those facts.
- **UNKNOWN:** Not established by available evidence.
- **RECOMMENDATION:** A proposed future action requiring explicit approval.

## 1. Current Database as Disposable Development State

### 1.1 Target and provider

- **FACT:** The application connects through `pg` and Drizzle ORM using `DATABASE_URL`.
- **FACT:** `drizzle.config.ts` uses PostgreSQL, reads `./lib/db/schema.ts`, and writes Drizzle artifacts to `./drizzle`.
- **FACT:** The connected database is PostgreSQL 17.11, database `neondb`, default schema `public`, on Neon-compatible infrastructure.
- **FACT:** The live database contains 12 public application/auth tables and nine tables in `neon_auth`.
- **FACT:** The owner classifies the current PostgreSQL rows as dummy development data whose loss is acceptable.
- **UNKNOWN:** The exact Neon project/branch and whether `neondb` is development-only from the provider's perspective. The owner decision governs row disposability, but target identity must still be confirmed before any destructive operation.

### 1.2 Current tables and relationships

The current checked-in public schema contains four Better Auth tables and eight application tables:

- Better Auth: `user`, `session`, `account`, `verification`.
- Application: `folders`, `files`, `announcements`, `events`, `activity_logs`, `students`, `portfolioFiles`.

Current declared/live relationships are limited:

- `session.userId -> user.id`, cascade delete.
- `account.userId -> user.id`, cascade delete.
- Application relationships are text IDs without live foreign keys: student owner, portfolio file student/uploader, file folder/uploader, folder owner/parent folder, announcement/event/activity actor.
- The prior read-only audit found no live orphan candidates for these relationships at capture time, but this does not make the old design suitable for the new domain.

The current database also contains `neon_auth.account`, `invitation`, `jwks`, `member`, `organization`, `project_config`, `session`, `user`, and `verification`. Their ownership is not conclusively established from repository metadata. They must remain outside application rebuild operations until the Neon/Better Auth boundary is confirmed.

### 1.3 Current migration inconsistencies

- The journal references `0000_icy_squadron_sinister`, but its SQL file is missing.
- `0001_cloudy_madame_web.sql` creates `students` and `portfolioFiles`.
- `0002_add_section.sql` adds `section` to `files` and `folders`.
- `0003_add_event_color.sql` exists but is not journaled, has no snapshot, is absent from `schema.ts`, and `events.color` is absent from the live table.
- Snapshots stop at `0002`.
- No standard Drizzle migration bookkeeping table was observed in the prior catalog audit.
- The live schema also differs from source in `user.name` nullability, several timestamp defaults, and additional indexes.

**RECOMMENDATION:** Abandon the old migration chain for future rebuild purposes. Do not repair, replay, rename, delete, or silently incorporate `0000` or `0003`. Keep the old files and snapshots unchanged as historical evidence until a separate repository-documentation decision disposes of them.

### 1.4 Structures that may be abandoned

Because PostgreSQL development rows are disposable, the following old application structures may be abandoned as part of a future clean rebuild, subject to the cutover gates:

- Existing application rows and their old ownership assumptions.
- Existing `folders`, `files`, `announcements`, `events`, `activity_logs`, `students`, and `portfolioFiles` tables, if the new design replaces them.
- The old public-schema indexes whose purpose is not carried into the new design.
- The incomplete migration journal/snapshots as an execution history for the new database.

Abandoning a structure means it is excluded from the new authoritative schema after review; it does not authorize dropping it now.

### 1.5 Structures that must be understood first

Before any rebuild or application cutover, confirm:

- The exact Neon project, branch, database, and environment classification.
- Whether `neon_auth` is Neon Managed Better Auth or another provider/application boundary.
- Whether Better Auth is expected to recreate `public.user`, `public.session`, `public.account`, and `public.verification` in a fresh database, or whether an approved Better Auth schema/bootstrap procedure is required.
- The R2 bucket, object prefixes, object inventory, and relationship between object keys and PostgreSQL metadata.
- Which current application workflows must survive the rebuild: authentication, calendar, announcements, folders, media, staff resources, portfolios, and activity logging.
- The current environment variables and deployment target without exposing their values.

## 2. R2 and File Storage Safety

### 2.1 Current R2 integration

**FACT:** `lib/r2.ts` creates an S3-compatible client using `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`. Values are loaded from the environment and are not included in this plan.

**FACT:** The helper exposes four operations:

- `uploadToR2(key, body, contentType)` writes an object.
- `deleteFromR2(key)` deletes an object.
- `getR2PresignedUrl(key)` creates a temporary download URL.
- `getR2ObjectBytes(key)` reads object bytes for the media route.

### 2.2 Where objects are created and referenced

**FACT:** Portfolio uploads in `app/actions/portfolios.ts` write objects under `uploads/` and store the key in `public.portfolioFiles.bucketPath`.

**FACT:** Staff-resource uploads in `app/actions/staff-resources.ts` also write objects under `uploads/` and store the key in `public.files.bucketPath`.

**FACT:** Media uploads in `app/actions/media-files.ts` write objects under `media/` and store the key in `public.files.bucketPath`.

**FACT:** The database records that reference R2 objects are:

- `public.portfolioFiles.bucketPath`, linked conceptually to `students` through `studentId` and to `user` through `uploadedBy`.
- `public.files.bucketPath`, linked conceptually to `folders` through `folderId`, and to `user` through `uploadedBy`; `section` distinguishes staff and media use.

**FACT:** Presigned URLs and media byte downloads resolve the object key by first looking up the PostgreSQL metadata row.

### 2.3 Current consistency risks

- Uploads write to R2 before inserting the PostgreSQL metadata row. A database insert failure can leave an R2 object with no row.
- Deletes attempt R2 deletion before or alongside metadata deletion, and errors are suppressed in the current actions. This can leave either an object or a row behind.
- The media byte route and presigned URL paths depend on the database row to discover the R2 key.
- The current application does not provide a repository-side authoritative inventory of all R2 objects.
- The prior PostgreSQL counts showed 10 `public.files` rows and one `public.portfolioFiles` row, but that does not prove the bucket contains exactly 11 objects. Orphaned objects may exist, and duplicate or historical objects may exist.

### 2.4 Effect of a PostgreSQL rebuild

Rebuilding or replacing PostgreSQL would not automatically delete R2 objects. It would delete the metadata lookup rows if the old public schema is dropped or replaced. Existing R2 objects could then become unreachable through the application and operationally orphaned, even though they remain in the bucket.

The reverse risk also exists: if the new application reuses old R2 prefixes without an inventory and ownership policy, new metadata could accidentally point at old development objects or collide with existing keys. The current UUID-prefixed filenames reduce collision likelihood but are not a policy boundary.

**UNKNOWN:** Whether existing R2 objects are development-only. The owner classified PostgreSQL rows, not independently stored objects. No safe conclusion may be drawn from database row counts.

### 2.5 R2 preservation requirements before rebuild

Before any PostgreSQL replacement or application cutover:

1. Confirm the exact R2 bucket and environment without printing credentials.
2. Produce a metadata-only object inventory outside the repository containing key, size, content type, last-modified time, and checksum/ETag where available. Do not place object bytes or secrets in the repository.
3. Export a sanitized mapping of database file rows to R2 keys, including `files.section`, `files.folderId`, `portfolioFiles.studentId`, and uploader IDs only as approved opaque identifiers.
4. Decide whether existing objects will be archived, retained under an immutable legacy prefix, or deliberately abandoned by an explicitly authorized owner.
5. Do not delete or overwrite any R2 object during the database rebuild.
6. Use a separate namespace/prefix or separate development bucket for the fresh database until the new asset model is proven. The current code uses fixed `uploads/` and `media/` prefixes, so this requires a separately approved application/configuration change later; it is not implemented here.
7. Define repair handling for objects whose old metadata rows disappear. Do not silently reuse them as new evidence.

**RECOMMENDATION:** Preserve the existing bucket and objects, but do not make the fresh application depend on the old metadata. Treat old objects as a quarantined legacy set until an explicit asset-migration or abandonment decision is made.

## 3. Better Auth and Database Boundary

### 3.1 Current Better Auth configuration

**FACT:** `lib/auth.ts` configures Better Auth with the shared `pg` pool from `lib/db`, email/password enabled, automatic sign-in enabled, seven-day sessions, one-day update age, and a computed base URL from deployment/runtime environment variables.

**FACT:** `app/api/auth/[...all]/route.ts` exposes the Better Auth handler for GET and POST and adds development-oriented credentialed CORS behavior. The route and auth configuration are security-sensitive and must remain unchanged during database planning.

**FACT:** Protected pages and Server Actions call `auth.api.getSession({ headers: await headers() })` to identify the current session.

### 3.2 Better Auth tables and application dependencies

The current public Better Auth tables are:

- `user`: identity records used by session checks and `userId` columns throughout application tables.
- `session`: active session records used by `auth.api.getSession`.
- `account`: Better Auth account/provider/password data.
- `verification`: Better Auth verification state.

Application dependencies include:

- All protected pages and actions depend on a valid session.
- Application records store unconstrained user IDs in folders, students, files, portfolio files, announcements, events, and activity logs.
- `lib/activity.ts` resolves the current session and writes `activity_logs.userId`.
- Existing user IDs therefore function as application references even where the database lacks foreign keys.

### 3.3 Fresh database recreation

**INFERENCE:** Better Auth can use a fresh PostgreSQL database only if its required public tables and exact configuration contract are recreated correctly. This cannot be assumed to happen merely because a database is empty.

**RECOMMENDATION:** On an isolated fresh branch/database, preserve `lib/auth.ts`, `lib/db/index.ts`, `app/api/auth/[...all]/route.ts`, environment variable names, Better Auth table names, and Better Auth column compatibility until an approved bootstrap procedure verifies them. The bootstrap procedure must be tested by signing up a disposable development account, signing in, establishing a session, reading the session server-side, signing out, and confirming expired/invalid sessions fail. Do not reuse old user/session/account rows unless separately approved; the stated rebuild decision allows them to be discarded.

The application’s new school/membership model must not overload Better Auth’s `user` table with authorization meaning. Keep authentication identity in `user`; use explicit school membership, role, staff, learner, and assignment relationships for authorization.

### 3.4 `neon_auth` boundary

**UNKNOWN:** The repository cannot conclusively prove whether `neon_auth` is Neon Managed Better Auth for this project. Its name and table set are consistent with provider-managed authentication, and Neon documentation indicates that managed Better Auth data branches and restores with the database.

**RECOMMENDATION:** Keep `neon_auth` outside the application-owned fresh schema. Do not drop, recreate, migrate, or manually seed it. Confirm its provider ownership in the Neon project before creating or switching branches. A fresh branch may clone provider-managed `neon_auth`; that behavior must be observed and documented, not assumed.

## 4. Fresh Database Strategy

### 4.1 Options

#### Option A — Drop/recreate the current development database or schema

**Advantages:** Fastest apparent route; no old PostgreSQL rows need to be retained.

**Disadvantages:** Removes the immediate rollback reference, can break Better Auth state, can erase metadata needed to understand R2 objects, and may affect `neon_auth` if a branch/database-level operation is broader than intended. It also risks pointing the application at an empty or partially initialized target before verification.

**Data-loss risk:** Acceptable for current PostgreSQL dummy rows by owner decision, but still unacceptable for unclassified R2 objects, source code, or provider-managed auth state.

**Operational risk:** High. The target identity and provider boundary must be proven first, and a mistake is difficult to reverse.

#### Option B — Create a separate fresh database/branch first, validate, then cut over

**Advantages:** Preserves the current database as a rollback/reference point; isolates schema experiments; allows Better Auth bootstrap testing; allows R2 namespace and application smoke testing before any cutover; supports side-by-side comparison and controlled rollback.

**Disadvantages:** Requires temporary provider resources and environment/connection management; the fresh branch may include provider-managed `neon_auth` state that must be understood; the application must be pointed to the new target only in an isolated development configuration first.

**Data-loss risk:** Lowest overall because the disposable PostgreSQL rows remain available until the new target is verified. R2 is still protected by a separate inventory and namespace decision.

**Operational complexity:** Medium, but the complexity is visible and reversible rather than concentrated in one destructive action.

### 4.2 Recommendation

**RECOMMENDATION: Choose Option B.** Create a separate fresh Neon development branch or database first, with an explicit environment label and separate connection configuration. Do not drop or reset `neondb` at the start.

The new target should be empty from the application-schema perspective, but the team must verify what Neon automatically provides, especially `neon_auth`. Treat provider-managed objects as outside application migrations. Point an isolated development deployment or local process at the fresh target only after the bootstrap and smoke-test plan is approved.

Once the new target is verified and the old database is no longer needed, a separate owner-approved disposal decision may be made. That later decision is not part of this plan and must not be conflated with creating the clean target.

### 4.3 Proposed target flow

```text
Current neondb (disposable rows, retained temporarily)
          |
          | provider-approved isolated branch/database creation
          v
Fresh SchoolHub development target
          |
          | Better Auth bootstrap + clean schema validation
          v
Authoritative new schema and migration history
          |
          | foundation and authorization tests
          v
School / academic foundation
          |
          | generic lifecycle and security tests
          v
Assessment engine
          |
          | approved Grade 10 configuration
          v
Grade 10 SBA, then Grades 11-12 through the same model
```

## 5. New SchoolHub Domain Foundation

This section is design guidance only. It does not authorize schema changes.

### 5.1 Identity and tenancy

- `user`: Better Auth identity; retain authentication-purpose fields and avoid embedding school roles in this table.
- `school` or `institution`: tenant identity, status, display metadata, and lifecycle fields.
- `membership`: links a user to a school with status, joined/created timestamps, and a school-scoped role assignment. A user may belong to multiple schools only if that product decision is approved.
- `role`: explicit role catalog or controlled role values; minimum initial roles are School Admin, Teacher, and a future Moderator/Reviewer as policy requires.
- `membership_role` or equivalent: supports one or more roles without encoding authorization in free text.
- `staff`: school-scoped staff profile linked to a membership/user; contains staff identity and employment/profile metadata only.

Recommended integrity:

- Foreign keys from membership to user and school.
- Unique membership per `(school_id, user_id)`.
- Unique role name within its scope if roles are configurable.
- Indexes on membership `(user_id, status)` and `(school_id, status, role)` or equivalent query shapes.
- Explicit deletion behavior. Prefer restricted deletion for schools/users with academic history; use deactivation/status where records must remain auditable.

### 5.2 Academic structure

- `academic_year`: school-scoped reporting year; unique `(school_id, code)` and/or bounded dates.
- `grade`: reusable grade data, including Grade 10, 11, and 12; unique within the approved scope.
- `class` or `class_group`: school/year/grade teaching group.
- `stream`: optional school/class subdivision; uniqueness must reflect the chosen class model.
- `learner`: school-scoped learner profile, separate from Better Auth `user` unless learner login is explicitly designed.
- `enrolment`: links learner to school, academic year, grade, class/stream, and lifecycle status.
- `subject`: school-scoped or approved shared curriculum subject.
- `teacher_assignment`: links staff to school, academic year, subject, and class/stream with active dates/status.

Recommended integrity:

- Foreign keys for every ownership and academic-context relationship.
- Unique learner identifier within school where policy permits; avoid relying on names.
- Unique enrolment for `(learner_id, academic_year_id, grade/class context)` according to the approved re-enrolment model.
- Unique teacher assignment for `(staff_id, subject_id, class/stream, academic_year)` where duplicate active assignments are invalid.
- Indexes on every foreign key and common authorization predicate: school, membership, learner, academic year, grade, class/stream, subject, staff, and status.
- Check constraints or controlled values for statuses and date ranges where stable and policy-approved.
- Deliberate `ON DELETE` behavior: restrict or soft-delete academic records; do not cascade away assessment history accidentally.

### 5.3 Ownership model

Every business row must be directly school-scoped or reachable through a school-scoped parent. Authorization queries should be able to prove:

1. The actor is authenticated.
2. The actor has an active membership in the target school.
3. The actor's role permits the operation.
4. The target belongs to that school.
5. A teacher has an active assignment covering the subject/class/learners involved.
6. A learner, if supported as an actor, can reach only their own authorized records.

These checks belong in reviewed policy/service functions used by Server Actions and routes, not only in page code or client filters.

## 6. Assessment Readiness

The clean foundation must support one generic assessment model for Grades 10-12. Grade is data, not a separate schema or code branch.

Recommended future entities:

- `assessment`: school, academic year, grade/context, subject, term, type, owner, lifecycle state, dates.
- `assessment_task`: deliverable within an assessment, with weighting, deadlines, instructions, and state.
- `rubric` / `criterion` / `criterion_level`: versioned scoring definitions, descriptors, bands, maximums, and weights.
- `learner_attempt` or assignment: links an assessment task to a valid enrolment and tracks submission/state.
- `score` / `result`: authorized assessor, criterion/task scores, calculation inputs, version, and audit metadata.
- `evidence`: references a reusable asset and the authorized learner attempt/task/score relationship.
- `moderation`: reviewer, decision, reason, timestamps, and audit trail.
- `finalization`: immutable or versioned approval event for a complete result set.
- `publication`: controlled release of finalized results and audience/scope.
- `report`: derived output metadata or query boundary, not a second editable marks store.
- `audit_event`: append-only security and lifecycle events.

Required design properties:

- Grade 10, 11, and 12 use the same tables and workflow; configuration supplies grade-specific policy.
- Assessment types such as project, practical, performance task, written test, and classroom assessment are data/configuration, not table variants.
- Scoring and rubric versions are immutable once used by a finalized result.
- Finalized results cannot be silently overwritten; corrections create controlled versions/reopening events.
- Evidence inherits school, learner/enrolment, assignment, assessment, and lifecycle authorization.
- Reports read authorized finalized results and must not expose draft/unpublished outcomes.
- Official framework rules, weights, task counts, moderation, retention, and publication policy require approval before implementation.

## 7. Security Design Requirements for the Rebuild

The rebuild is an opportunity to remove the current IDOR and ownership weaknesses, but it must not mix implementation with this planning document.

### 7.1 Tenant and authorization controls

- Every business table must have a direct `school_id` or an unambiguous school-scoped parent.
- Every protected query and mutation must use server-side membership, role, and object-scope predicates.
- Authentication from Better Auth establishes identity only; it does not authorize school access.
- Teacher queries must join through active teacher assignments and valid enrolments/class/subject context.
- Learner queries must be restricted to the learner's own authorized records if learner access is enabled.
- No route, Server Action, download, presign, or mutation may authorize solely by object ID.
- Unauthorized objects should return controlled not-found/forbidden outcomes without leaking existence unnecessarily.

### 7.2 Files and evidence

- Replace unconstrained `files`/`portfolioFiles` ownership with a reusable school-scoped asset plus attachment/reference model.
- Store immutable object metadata, uploader/membership, school, content type, size, checksum where available, and lifecycle state.
- Validate target relationship, file type, extension, size, and actor authorization before upload.
- Use a transactional or compensating strategy for R2/database consistency; failed metadata persistence must trigger a controlled cleanup or repair queue, not an ignored error.
- Downloads, presigned URLs, deletion, and metadata reads must authorize through the linked school/domain object.
- Keep R2 keys opaque and avoid treating bucket paths as authorization.

### 7.3 Better Auth and security controls

- Preserve Better Auth configuration while validating a fresh target.
- Restrict trusted origins and credentialed CORS in a separate reviewed security change; do not carry the current wildcard-development behavior into production by accident.
- Separate authentication tables from school membership and roles.
- Add negative tests for unauthenticated access, cross-school IDs, unassigned teacher access, wrong learner, wrong assessment state, and unauthorized file/evidence download.

## 8. Migration Strategy for the Clean Rebuild

### 8.1 Authoritative sources

**RECOMMENDATION:** Establish one reviewed authoritative source schema for the new target and one new migration directory/history. The new history starts at a fresh baseline; it does not claim to reconstruct the missing `0000`.

The existing `0000` journal entry, missing SQL, `0001`, `0002`, snapshots, and orphaned `0003` are not inputs to the new execution chain. Preserve them unchanged as historical evidence until a separate approved documentation decision. Do not use `drizzle-kit migrate` against the fresh target with the old directory.

The clean history should:

1. Be generated only after the new schema design is reviewed.
2. Be reviewed statement by statement before execution.
3. Be applied to the isolated fresh target through the approved migration mechanism, not uncontrolled `push`.
4. Record the migration bookkeeping state deliberately and verify it after application.
5. Be replayed from empty against an isolated database to prove reproducibility.
6. Be validated by typecheck, application startup, Better Auth flows, and focused authorization tests.

### 8.2 Better Auth bootstrap ordering

The exact ordering must be confirmed in an isolated branch:

1. Create/obtain the fresh target without altering the current database.
2. Confirm provider-managed `neon_auth` behavior and exclude it from application-owned schema operations.
3. Establish the Better Auth-compatible public tables using the approved Better Auth procedure or reviewed schema definition.
4. Verify sign-up, sign-in, session lookup, sign-out, and invalid-session behavior with disposable test accounts.
5. Add the reviewed SchoolHub foundation around the auth identity.
6. Verify that membership/role authorization does not depend on client state or raw user IDs.

Do not assume that Better Auth automatically creates tables in the exact shape required, and do not assume a Neon branch is an empty database in every schema.

### 8.3 Handling old application functionality

Existing useful workflows should be preserved deliberately, not by copying the old weak schema unchanged:

- Calendar/events and announcements should be reimplemented or mapped onto school-scoped ownership.
- Staff/media files and portfolios should use the reviewed asset/attachment model while preserving valid user-facing capabilities.
- Activity logging should become school-aware and append-only.
- Existing UI and Server Actions are behavioral references; they are not authorization evidence and must not be carried forward without review.
- The orphaned `events.color` feature remains deferred until the product decision confirms whether it is part of the new event model.

## 9. Staged Execution Phases and Gates

### Phase A — Fresh database planning

- **Mode:** Planning/read-only.
- **Database mutation:** No.
- **Deliverables:** Approved target identity, R2 preservation decision, Better Auth boundary, clean schema/domain design, migration/test plan.
- **Gate:** Owner approves this rebuild strategy and confirms current PostgreSQL data is disposable while R2 objects remain classified.

### Phase B — Create isolated fresh development target

- **Mode:** Provider operation; mutating provider infrastructure, not the current application database.
- **Database mutation:** Yes, isolated target only.
- **Controls:** Confirm project/branch/database identity, label the target as development, record connection configuration without committing secrets, and confirm `neon_auth` behavior.
- **Verification:** Target connects; current `neondb` remains unchanged; provider ownership boundary is documented.

### Phase C — Establish clean schema and migrations

- **Mode:** Repository and isolated-target work.
- **Database mutation:** Repository artifact creation and isolated database migration are allowed only after explicit approval; current target remains untouched.
- **Controls:** Design/approve new schema; create a fresh migration history; never use old `0000` or orphaned `0003`; prohibit `push` as the authoritative deployment path.
- **Verification:** Empty-target replay succeeds, migration bookkeeping is correct, schema metadata matches the approved design, and no `neon_auth` mutation occurred.

### Phase D — Verify Better Auth

- **Mode:** Isolated-target verification.
- **Database mutation:** Disposable Better Auth test rows may be created only in the fresh target after approval; no current database mutation.
- **Controls:** Keep auth code/config unchanged during bootstrap; use disposable credentials and do not record them.
- **Verification:** Sign-up, sign-in, server session lookup, sign-out, invalid session rejection, and protected-page behavior pass.

### Phase E — Establish SchoolHub foundation

- **Mode:** Implementation and reviewed migration work.
- **Database mutation:** Fresh target only, after schema/migration approval.
- **Controls:** Implement School/Institution, membership, roles, staff, learner, academic year, grade, class/stream, enrolment, subject, and teacher assignment with deliberate keys, indexes, foreign keys, statuses, and deletion behavior.
- **Verification:** At least two schools, multiple roles, assigned/unassigned teachers, enrolled/unenrolled learners, uniqueness, and school-isolation tests pass.

### Phase F — Authorization and security

- **Mode:** Application implementation and isolated database testing.
- **Database mutation:** Fresh target test data only.
- **Controls:** Central policy/service boundary; server-side authorization on every action/route/download; secure R2 consistency; restrictive origin policy.
- **Verification:** Negative IDOR, cross-school, wrong-assignment, wrong-learner, and unauthorized-file tests pass.

### Phase G — Assessment foundation

- **Mode:** Reviewed design and implementation.
- **Database mutation:** Fresh target only after approved assessment schema and official framework decisions.
- **Controls:** Generic assessment/task/rubric/attempt/score/evidence/moderation/finalization/publication model; no grade-specific tables.
- **Verification:** Grade 10, 11, and 12 fixtures use the same schema and lifecycle; finalized results are protected and reports read finalized data.

### Phase H — Grade 10 SBA

- **Mode:** Configuration and feature implementation.
- **Database mutation:** Fresh target only.
- **Controls:** Use approved framework rules for projects, practicals, written tests, scoring guides, evidence, moderation, finalization, and audit.
- **Verification:** End-to-end Grade 10 scenarios and negative authorization tests pass.

### Phase I — Testing and operational readiness

- **Mode:** Verification and CI/tooling work.
- **Database mutation:** Isolated fixtures/branches only.
- **Controls:** Establish missing lint/test/CI gates; test migration replay, backup/restore, auth, R2 consistency, authorization, assessment integrity, and build/typecheck.
- **Verification:** All required testing standards pass; no live-target mutation is needed for test evidence.

### Phase J — Grades 11-12 generalization

- **Mode:** Configuration and regression testing.
- **Database mutation:** Fresh development/test target only.
- **Controls:** Add Grade 11/12 as data/configuration, never duplicated schema or business logic.
- **Verification:** Cross-grade regression confirms shared authorization, scoring, finalization, publication, and reporting behavior.

### Current stop point

This task ends at planning. No phase above is authorized for execution by this document. In particular, Phase B requires an explicit provider-operation approval, and Phase C requires a separate schema/migration approval.

## 10. Rebuild Gates

At minimum, require these explicit approvals:

- **Gate R1 — Target and ownership:** Confirm exact Neon project/branch/database, development classification, `neon_auth` ownership, and R2 bucket/environment.
- **Gate R2 — R2 safety:** Approve object inventory, legacy-object retention/quarantine, namespace/bucket plan, and no-delete policy.
- **Gate R3 — Fresh target creation:** Approve creation of the separate development branch/database and isolated connection configuration.
- **Gate R4 — Clean schema design:** Approve Better Auth compatibility and the new SchoolHub foundation schema, including keys, constraints, indexes, and deletion behavior.
- **Gate R5 — Migration creation:** Approve creation of the new migration history and review every generated statement.
- **Gate R6 — Isolated migration execution:** Approve applying the clean migrations to the fresh target.
- **Gate R7 — Authentication verification:** Approve sign-up/sign-in/session smoke-test evidence.
- **Gate R8 — Security/foundation readiness:** Approve school isolation, role, assignment, learner, and R2 authorization tests before assessment work.
- **Gate R9 — Cutover/disposal:** Separately approve pointing any shared application environment at the new target and, later, disposing of the old development database. No disposal is implied by this plan.

## 11. Final Recommendation

**Recommended approach:** Create a separate fresh Neon development branch/database first, leave the current `neondb` untouched, and build a new authoritative schema and migration history from approved Better Auth compatibility plus the SchoolHub school/academic foundation. Treat the existing migration chain as abandoned historical evidence, not a repair input. Keep `neon_auth` outside application-owned migrations until provider ownership is confirmed. Preserve and quarantine current R2 objects until an object inventory and namespace decision are complete.

**Why:** This accepts the owner's decision that current PostgreSQL rows are disposable while retaining a reversible reference point, avoiding accidental invalidation of R2 metadata and Better Auth dependencies. It also creates a clean path to school isolation, authorization, and grade-agnostic assessment without carrying forward the old unconstrained relationships.

**What we should do next:** Obtain Gate R1 and Gate R2 approvals, confirm the Neon target/provider boundaries, and complete a metadata-only R2 inventory plus Better Auth fresh-target bootstrap design. Then obtain Gate R3 approval to create the isolated fresh development target.

**Exact next action:** An authorized administrator should confirm the Neon project/branch/database and R2 bucket/environment, and record a sanitized target map. No database or R2 mutation is needed for this action.

**Exact thing Codex must NOT do yet:** Do not run `drizzle-kit drop`, `push`, `migrate`, `up`, or any SQL mutation; do not create migrations; do not modify `schema.ts`, authentication, application source, package files, or R2 objects; do not point the current application at a new database; and do not delete or reset `neondb`.
