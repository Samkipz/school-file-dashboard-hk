# Phase 0B Database Remediation Plan

**Date:** 2026-09-07  
**Status:** PLANNING ONLY  
**Scope:** Reconcile the checked-in Drizzle migration history with the existing live PostgreSQL/Neon database without losing data.

## 0. Non-Goals and Operating Rules

This document authorizes no implementation. No application source, `lib/db/schema.ts`, migration SQL, `drizzle.config.ts`, authentication, package manifest, Git history, or database state is changed by this plan. No migration, schema push, reset, drop, package installation, or database mutation is authorized.

All statements use the following labels:

- **FACT:** Directly observed in the repository, checked-in migration artifacts, or the Phase 0B read-only database audit.
- **INFERENCE:** A conclusion drawn from those facts.
- **UNKNOWN:** Not established by available evidence.
- **RECOMMENDATION:** A proposed future action requiring the approval gates in this document.

The live database must be treated as production-like and valuable until its environment and recovery policy are proven otherwise.

## 1. Current Database State

### 1.1 Provider and connection

- **FACT:** The application uses PostgreSQL through `pg` and Drizzle ORM.
- **FACT:** `drizzle.config.ts` uses the PostgreSQL dialect, schema path `./lib/db/schema.ts`, output directory `./drizzle`, and loads `.env.local` with `DATABASE_URL`.
- **FACT:** Runtime access uses a `pg.Pool` constructed from `process.env.DATABASE_URL`.
- **FACT:** The Phase 0B audit connected successfully using bounded read-only metadata and aggregate queries.
- **FACT:** The server reported PostgreSQL 17.11, database `neondb`, and default schema `public` on Neon-compatible infrastructure.
- **UNKNOWN:** Whether this is production, staging, development, or a shared database.
- **UNKNOWN:** Whether a current provider-native backup, point-in-time recovery policy, or tested restore exists.
- **UNKNOWN:** The exact connection value, and it must remain secret.

### 1.2 Live schemas and tables

- **FACT:** The live `public` schema contains all 12 tables declared by the checked-in Drizzle schema:
  - Better Auth: `user`, `session`, `account`, `verification`.
  - Application: `folders`, `files`, `announcements`, `events`, `activity_logs`, `students`, `portfolioFiles`.
- **FACT:** The live database also contains nine tables in `neon_auth`: `account`, `invitation`, `jwks`, `member`, `organization`, `project_config`, `session`, `user`, and `verification`.
- **FACT:** The observed live database therefore contains 21 non-system tables: 12 in `public` and nine in `neon_auth`.
- **UNKNOWN:** Whether `neon_auth` is provider-managed, application-managed, or shared infrastructure. Its ownership must be established before any broad operation.
- **RECOMMENDATION:** Treat `neon_auth` as out of scope for application migration repair unless Neon/provider documentation and an owner explicitly establish otherwise. Do not drop, rename, alter, or recreate it.

### 1.3 Existing row counts

The Phase 0B audit used aggregate `count(*)` queries only; no record values were selected. The counts below are exact counts at the time of that audit and may change if the application continues writing.

| Schema/table                      | Rows observed | Data-preservation status                       |
| --------------------------------- | ------------: | ---------------------------------------------- |
| `public.user`                     |             7 | Preserve                                       |
| `public.session`                  |            14 | Preserve                                       |
| `public.account`                  |             7 | Preserve                                       |
| `public.verification`             |             0 | Preserve structure; currently empty            |
| `public.folders`                  |             5 | Preserve                                       |
| `public.files`                    |            10 | Preserve                                       |
| `public.announcements`            |             0 | Preserve structure; currently empty            |
| `public.events`                   |             3 | Preserve                                       |
| `public.activity_logs`            |            14 | Preserve                                       |
| `public.students`                 |             2 | Preserve                                       |
| `public.portfolioFiles`           |             1 | Preserve                                       |
| `neon_auth.project_config`        |             1 | Preserve/provider-owned until proven otherwise |
| Other observed `neon_auth` tables |        0 each | Preserve structure/provider boundary           |

- **FACT:** The non-empty public application tables are `user`, `session`, `account`, `folders`, `files`, `events`, `activity_logs`, `students`, and `portfolioFiles`.
- **FACT:** The public application tables contain 63 rows in aggregate.
- **INFERENCE:** Existing users, sessions, auth accounts, folders, files, events, activity logs, students, and portfolio metadata must not be discarded as part of reconciliation.
- **UNKNOWN:** Whether rows satisfy every current source-schema nullability/default expectation because record values were deliberately not inspected.

### 1.4 Current Drizzle source schema

**FACT:** `lib/db/schema.ts` declares the following 12 PostgreSQL tables. It defines primary keys for every table and only two application-visible foreign-key relationships: `session.userId -> user.id` and `account.userId -> user.id`, both with `ON DELETE CASCADE`.

| Table            | Relevant source shape                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`           | Required `id`, `name`, `email`, `emailVerified`, `createdAt`, `updatedAt`; nullable `image`; unique `email`; defaults `emailVerified=false`, timestamps `now()` |
| `session`        | Required `id`, `expiresAt`, `token`, `createdAt`, `updatedAt`, `userId`; nullable `ipAddress`, `userAgent`; unique `token`; FK to `user` with cascade           |
| `account`        | Required `id`, `accountId`, `providerId`, `userId`, `createdAt`, `updatedAt`; nullable token/provider fields; FK to `user` with cascade                         |
| `verification`   | Required `id`, `identifier`, `value`, `expiresAt`; nullable `createdAt`, `updatedAt`; timestamp defaults `now()`                                                |
| `folders`        | Required `id`, `userId`, `name`, `section`, `createdAt`, `updatedAt`; nullable `parentFolderId`, `description`; `section` defaults to `staff`                   |
| `files`          | Required `id`, `filename`, `originalName`, `mimeType`, `size`, `uploadedBy`, `uploadedAt`, `bucketPath`, `folderId`, `section`; `section` defaults to `staff`   |
| `announcements`  | Required `id`, `userId`, `title`, `content`, `category`, `createdAt`, `updatedAt`; `category` defaults to `general`                                             |
| `events`         | Required `id`, `userId`, `title`, `eventDate`, `createdAt`, `updatedAt`; nullable `description`, `location`; no `color`                                         |
| `activity_logs`  | Required `id`, `userId`, `actionType`, `description`, `createdAt`; nullable `targetId`, `targetType`; `createdAt` defaults to `now()`                           |
| `students`       | Required `id`, `userId`, `name`, `className`, `createdAt`, `updatedAt`; nullable `avatarUrl`; timestamp defaults `now()`                                        |
| `portfolioFiles` | Required `id`, `filename`, `originalName`, `mimeType`, `size`, `uploadedBy`, `uploadedAt`, `bucketPath`, `studentId`                                            |

**FACT:** No application-table foreign keys, check constraints, or explicit secondary indexes are declared for ownership, folder/file, student/portfolio, uploader, activity, or hierarchy relationships. The source comments explicitly describe application IDs as unconstrained text IDs.

### 1.5 Checked-in migrations, journal, and snapshots

- **FACT:** SQL files present are:
  - `drizzle/0001_cloudy_madame_web.sql`: creates `students` and `portfolioFiles`.
  - `drizzle/0002_add_section.sql`: adds required `section` columns with default `staff` to `files` and `folders`.
  - `drizzle/0003_add_event_color.sql`: adds required `events.color` with default `#3b82f6`.
- **FACT:** `drizzle/meta/_journal.json` contains entries `0000_icy_squadron_sinister`, `0001_cloudy_madame_web`, and `0002_add_section`, with sequential indexes 0, 1, and 2.
- **FACT:** `drizzle/0000_icy_squadron_sinister.sql` is missing.
- **FACT:** Snapshots exist through `drizzle/meta/0002_snapshot.json`, with predecessor IDs chaining `0000 -> 0001 -> 0002`.
- **FACT:** No `0003` journal entry or `0003` snapshot exists.
- **FACT:** The `0000`, `0001`, and `0002` snapshots do not contain `events.color`; the current source schema also does not contain it.
- **FACT:** The audit observed no table matching `%drizzle%` or `%migration%` in the accessible catalogs. A standard Drizzle bookkeeping table was not observed.
- **UNKNOWN:** Which, if any, migration process created the live database, and when.

### 1.6 Known source/live differences

- **FACT:** Live `user.name` is nullable, while the source declares it non-null.
- **FACT:** Live `updatedAt` has no database default on `user`, `account`, `session`, `announcements`, `events`, `folders`, and `verification`, while the source declares `now()` defaults for those columns. `verification.updatedAt` is also nullable in source/live, but the live default is absent.
- **FACT:** Live `files.section` and `folders.section` are required with default `staff`, matching source and `0002`.
- **FACT:** Live `events.color` is absent.
- **FACT:** Live has additional indexes on `activity_logs.createdAt DESC`, `activity_logs.userId`, `announcements.createdAt DESC`, `announcements.userId`, `events.eventDate`, `events.userId`, `folders.parentFolderId`, and `folders.userId`. These are not represented in source or checked-in SQL.
- **FACT:** Live public foreign keys are only `account.userId -> user.id` and `session.userId -> user.id`; live unique constraints are `user.email` and `session.token`; no live public check constraints were returned.
- **UNKNOWN:** Origin, owner, intended retention, and operational importance of the additional indexes.
- **UNKNOWN:** Whether other metadata not covered by the audit differs, including sequences/identity, extensions, triggers, policies, grants, ownership, collation, storage parameters, or partitioning.

## 2. Migration History Problem

### 2.1 Missing `0000`

The journal identifies `0000_icy_squadron_sinister` as the base migration, and `0000_snapshot.json` describes the initial public tables. The corresponding SQL file is absent. The next checked-in SQL file, `0001_cloudy_madame_web.sql`, creates only `students` and `portfolioFiles`; it cannot create the nine tables represented by the baseline snapshot. Therefore the checked-in SQL sequence cannot be replayed from an empty database into the checked-in snapshot state.

**INFERENCE:** The missing base SQL breaks reproducibility and prevents a reviewer or deployment process from knowing exactly how the initial schema was created.

### 2.2 Unjournaled and unsnapshotted `0003`

`0003_add_event_color.sql` is a standalone SQL file that would add a required `events.color` column and default. It is absent from `_journal.json`, has no successor snapshot, and is absent from `schema.ts`. The live `public.events` table also lacks `color`.

**INFERENCE:** The file's presence is not evidence that it ran. Applying it now would create schema drift from both source and live state; deleting or silently incorporating it would also erase evidence before its origin and intended product behavior are understood.

### 2.3 Trust and reconstruction conclusion

- **INFERENCE:** The existing migration chain cannot be trusted as a complete record of live applied state.
- **FACT:** There is no observed Drizzle bookkeeping table from which applied migration state could be verified.
- **FACT:** The live database contains non-empty tables and source/live metadata drift.
- **CONCLUSION:** Drizzle cannot safely reconstruct the live database from the checked-in migrations alone. A fresh replay would be an isolated reconstruction experiment only after a complete export and review, never a live repair procedure.

## 3. Live Database Preservation

### 3.1 Data that must be preserved

Preserve all rows in the non-empty public tables: `user` (7), `session` (14), `account` (7), `folders` (5), `files` (10), `events` (3), `activity_logs` (14), `students` (2), and `portfolioFiles` (1). Preserve the empty public table definitions as well. Preserve all `neon_auth` objects and the one observed `neon_auth.project_config` row unless the provider and owner explicitly direct otherwise.

### 3.2 Required backup/export before mutation

**RECOMMENDATION:** Before any database-changing approval, obtain:

1. A provider-native backup or point-in-time recovery reference covering the target database.
2. A verified logical export containing schema and data, handled under secret/access controls. It must include the relevant schemas and not expose credentials in this report.
3. A separate schema-only export/catalog report for `public` and `neon_auth`.
4. Pre-change row counts for every table, using a repeatable read-only script.
5. Checksums or another approved verification of the backup/export, plus a documented restore test against an isolated target.
6. A record of the target environment, database identity, backup timestamp, and restore point without recording connection secrets.

A backup that has not been restored or otherwise verified is not sufficient evidence of recoverability.

### 3.3 Prohibited operations before approval

Do not run `drizzle-kit drop`, `push`, `migrate`, `up`, or any ad hoc `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `DELETE`, `UPDATE`, or `INSERT` against the live target. Do not run the orphaned `0003` manually. Do not reset or recreate `public`. Do not drop or alter `neon_auth`. Do not delete the missing-history evidence, overwrite snapshots, or regenerate migration artifacts during this planning phase.

Potentially destructive or high-risk actions include dropping/recreating tables, changing nullable columns to `NOT NULL`, adding defaults with changed write semantics, adding foreign keys when orphaned values exist, adding unique constraints when duplicates exist, dropping live indexes, applying an unknown migration sequence, and changing provider-managed auth objects.

## 4. Schema Reconciliation Evidence

Before authoring a baseline or reconciliation migration, collect a read-only, versioned inventory from the exact target database. Do not infer this inventory from `schema.ts`, snapshots, or row counts.

Required evidence for every relevant schema and table:

- Schema/table names, table kind, ownership, and privileges.
- Every column's name, ordinal position, PostgreSQL data type, domain/enum identity, precision/scale, length, collation, generated status, identity status, nullability, and exact default expression.
- Primary keys, unique constraints, exclusion constraints, check constraints, and their definitions.
- Foreign keys, referenced tables/columns, actions on delete/update, deferrability, and validation status.
- All indexes, key columns, included columns, ordering, predicates, uniqueness, validity, and definitions, including the eight unexplained live indexes.
- Sequence/identity configuration, ownership, current values, and default linkage where applicable.
- Views, materialized views, functions, triggers, rules, extensions, row-level security policies, grants, and schema/database ownership relevant to the application.
- Provider-managed objects and the ownership boundary for `neon_auth`.
- Migration bookkeeping tables, if any, including their schema and contents only to the extent approved; do not print credentials or token values.
- Pre-change aggregate row counts and, where needed for constraint decisions, privacy-preserving duplicate/orphan reports rather than raw record dumps.

The evidence must be captured from read-only catalog queries and approved exports. It must identify the database and timestamp while excluding `DATABASE_URL`, passwords, tokens, emails, file contents, and object-storage credentials.

## 5. Baseline Strategy Options

### A. Repair the existing migration chain

**Description:** Recover or recreate the missing `0000` history, reconcile journal/snapshots, and decide how to represent `0003`.

- **Advantages:** Preserves the apparent historical naming and could restore a conventional sequence if the original `0000` SQL is recovered from authoritative history.
- **Disadvantages:** The original `0000` contents are unknown; rebuilding it from snapshots or current live state may falsely claim historical provenance. The absence of migration bookkeeping remains unresolved. `0003` conflicts with source and live evidence.
- **Data-loss risk:** High if repaired files are replayed against the live database or if inferred history causes destructive diffing. Low only as an offline documentation exercise.
- **Migration-history risk:** High because reconstructed history may not be the history that created the database.
- **Operational complexity:** High; requires forensic recovery, isolated replay, and careful journal/snapshot validation.

### B. Create a new baseline representing the verified live database

**Description:** Freeze the existing live state through export and metadata capture, produce a clearly named baseline/reconciliation point from the verified live schema, and establish a new forward-only history after review. Keep historical artifacts as evidence rather than pretending the missing `0000` was recovered.

- **Advantages:** Starts from what actually exists, preserves data, makes unknown applied state explicit, and avoids replaying incomplete history against the live target. It can preserve intentional live indexes and provider boundaries.
- **Disadvantages:** Requires an explicit policy for how the new baseline relates to the old journal; future developers must understand that old artifacts are historical evidence. It does not automatically resolve source/live drift or ownership semantics.
- **Data-loss risk:** Lowest of the practical options when the baseline is created from a verified schema export and no destructive diff is executed.
- **Migration-history risk:** Medium; risk is controlled by naming, documentation, isolated replay, and explicit bookkeeping/bootstrap review, but historical provenance remains incomplete.
- **Operational complexity:** Medium to high; requires backup, export, comparison, baseline review, and deployment sequencing.

### C. Create reconciliation migrations from live schema to intended source schema

**Description:** Keep the live schema as the starting point, then author narrowly scoped, reviewed migrations to align only approved differences such as nullability/defaults/index declarations.

- **Advantages:** Makes each intended change explicit and reviewable; can preserve useful live indexes and avoid broad replacement.
- **Disadvantages:** Requires a trustworthy starting migration state first. Nullability/default changes may fail or alter behavior; constraints require orphan/duplicate analysis. It cannot repair the absent historical baseline by itself.
- **Data-loss risk:** Medium to high depending on each operation, especially `NOT NULL`, uniqueness, foreign keys, and index drops.
- **Migration-history risk:** Medium to high if applied without a new authoritative baseline/bookkeeping strategy.
- **Operational complexity:** High when many metadata differences and unknown provider objects are involved.

### D. Rebuild or reset the live database from checked-in migrations

- **Advantages:** A clean replay would be simple only for a disposable empty environment.
- **Disadvantages:** It cannot reproduce the observed live database because `0000` is missing, `0003` is orphaned, live indexes differ, and source/live defaults/nullability differ. It would discard data and risk provider-auth damage.
- **Data-loss risk:** Catastrophic.
- **Migration-history risk:** High; it creates a new state while concealing the original uncertainty.
- **Operational complexity:** Superficially low but operationally unacceptable for a data-bearing target.

### Recommendation

**RECOMMENDATION:** Choose **Option B**, followed only later by narrowly scoped Option C migrations where each difference is approved. Do not repair history by inventing the missing `0000`. Preserve the old journal, SQL, and snapshots as historical evidence, create a reviewed live-schema baseline/reconciliation boundary from verified exports, and establish how future Drizzle bookkeeping will be bootstrapped without replaying the old chain onto the live database.

This recommendation must not be implemented until Gates A-C are approved and the complete metadata comparison is available.

## 6. Drizzle-Specific Safety

### 6.1 Actual configured tooling

- **FACT:** `drizzle-kit` 0.31.10 is installed as a dev dependency and its local command is available.
- **FACT:** The configured schema is `./lib/db/schema.ts`, output is `./drizzle`, dialect is `postgresql`, and credentials come from `DATABASE_URL` in `.env.local`.
- **FACT:** `package.json` exposes no database npm scripts; commands are manually invokable through the local Drizzle binary.

### 6.2 Command classification for this phase

| Command/action                               | Classification now           | Reason and future condition                                                                                                                                                                                       |
| -------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read files, `git diff`, `git status --short` | **SAFE FOR INSPECTION**      | Local read-only evidence; do not stage or commit as part of this plan.                                                                                                                                            |
| Local `drizzle-kit --help` / `--version`     | **SAFE FOR INSPECTION**      | Does not inspect or mutate the database.                                                                                                                                                                          |
| Approved catalog `SELECT` queries            | **SAFE FOR INSPECTION**      | Read-only when reviewed and bounded; never print secrets or record values.                                                                                                                                        |
| `drizzle-kit introspect`                     | **CAUTION**                  | Intended to read the database but writes generated schema/artifacts in the configured output and may expose metadata. Use only on a disposable copy or approved workspace after backup; do not run in this phase. |
| `drizzle-kit export`                         | **CAUTION**                  | Can export schema/data depending on invocation; treat output as sensitive and verify exact flags/target before use. Prefer provider-approved export/backup.                                                       |
| `drizzle-kit check`                          | **CAUTION**                  | It may inspect or validate local migration metadata, but conclusions are not live applied-state evidence. Run only against a copy or approved local artifacts after this plan.                                    |
| `drizzle-kit generate`                       | **FORBIDDEN UNTIL APPROVED** | Writes migration files and could encode a destructive or false diff from an untrusted source/live comparison. It is not a read-only inspection command for this phase.                                            |
| `drizzle-kit migrate`                        | **FORBIDDEN UNTIL APPROVED** | Applies migrations to the configured database; the chain is incomplete and live state is unknown.                                                                                                                 |
| `drizzle-kit push`                           | **FORBIDDEN UNTIL APPROVED** | Directly changes the database without the reviewed migration artifact and can perform destructive diffs.                                                                                                          |
| `drizzle-kit up`                             | **FORBIDDEN UNTIL APPROVED** | Applies migration-related changes and must not be used to probe the live database.                                                                                                                                |
| `drizzle-kit drop`                           | **FORBIDDEN UNTIL APPROVED** | Destructive table removal; prohibited for this data-bearing database.                                                                                                                                             |

No Drizzle mutation command was run for this plan. `introspect` is not treated as automatically safe merely because its purpose is nominally read-oriented, because the configured tool writes local artifacts and would exceed this phase's authorized file scope.

## 7. `events.color` Discrepancy

Evidence is consistent on the current live state but not on the orphaned file's intent:

- `0003_add_event_color.sql` would add required `events.color` with default `#3b82f6`.
- `_journal.json` has no `0003` entry.
- No `0003` snapshot exists.
- `schema.ts`, `0000_snapshot.json`, `0001_snapshot.json`, and `0002_snapshot.json` do not contain `events.color`.
- The live `public.events` table does not contain `color` and has three rows.
- Calendar UI code maintains color state, but the audit found that the calendar action does not accept or persist color. This is application behavior evidence, not proof of a database decision.

**RECOMMENDATION:** Keep `events.color` **DEFERRED**. Do not apply or delete `0003` yet. The current evidence does not justify adding it to the live schema, and silently deleting it would lose provenance. During the approved schema/product review, decide whether color is a supported persisted event property. If approved, add it through a new reviewed migration after data/default/backfill analysis; if rejected, archive/document the orphaned file's disposition in a separate approved migration-history change. No decision is implemented here.

## 8. Data and Relationship Risks

### A. Migration reconciliation work

These are required to understand and safely preserve the current database, not permission to redesign it:

- Verify all live columns, defaults, nullability, keys, constraints, indexes, sequences/identity, triggers, policies, grants, and ownership.
- Explain the live `user.name` nullability difference and decide whether source or live behavior is authoritative before any constraint change.
- Explain absent `updatedAt` defaults before attempting to add or retain them.
- Identify the origin and necessity of the eight live secondary indexes; preserve them unless an approved performance review says otherwise.
- Determine whether any existing rows would block future `NOT NULL`, unique, or foreign-key changes using privacy-preserving reports.
- Determine the real migration bookkeeping/bootstrap procedure without assuming Drizzle has recorded applied migrations.
- Establish whether `neon_auth` is provider-managed and exclude it from application repair unless explicitly governed.
- Preserve existing unconstrained relationships while documenting orphan/duplicate checks needed before any future integrity migration.

### B. Future SchoolHub domain redesign

These weaknesses are known but belong to later phases and must not be bundled automatically into the reconciliation baseline:

- Missing foreign keys between students and users, portfolio files and students, files and folders, folders and parent folders, uploaders and users, announcements/events/activity logs and users.
- Missing or incomplete indexes for tenant, ownership, relationship, and query paths, subject to workload review.
- Missing uniqueness and check constraints for future domain invariants.
- No school/tenant or membership model.
- No role model or explicit staff profile.
- No normalized learner/enrolment relationship.
- No teacher assignment relationship linking staff to subject/class/stream/year.
- Existing per-user ownership fields are not a substitute for school scope or authorization.

**Boundary:** Phase 0B reconciliation should preserve and accurately model the current live state. It must not automatically add School, Membership, Role, Learner, Enrolment, TeacherAssignment, assessment, authorization, report, or portfolio redesign tables. Those are Phase 1 onward dependencies and require separate reviewed plans and tests.

## 9. Rollback and Recovery Requirements

Before any future database-changing operation is approved, all of the following must exist and be verified:

1. An approved provider-native backup/restore point and a logical export of the relevant database state.
2. A restore test in an isolated database or equivalent provider verification, with timestamps and checksums recorded.
3. A schema-only export and catalog inventory for `public` and `neon_auth`.
4. A reviewed migration/reconciliation script with a precise statement-level impact assessment and a rollback or forward-repair strategy for each non-reversible operation.
5. A dry run or isolated replay against a sanitized fixture that contains the same table shapes, representative nulls, duplicates/orphans where relevant, indexes, and row-count classes.
6. Pre-change row counts for every table and post-change count comparisons, with expected changes explicitly listed.
7. Pre/post schema verification covering columns, types, nullability, defaults, keys, foreign keys, indexes, sequences/identity, triggers, policies, and provider-managed objects.
8. Application smoke tests for authentication/session continuity, event/calendar reads and writes, file/folder metadata, portfolio/student reads, and activity logging, with no secret or personal record values placed in logs.
9. A maintenance window or write-free interval if required by the operation, plus a plan for handling concurrent writes.
10. Named owners for database approval, application approval, provider/auth boundary approval, and verification sign-off.

A rollback is not assumed to mean replaying the broken checked-in chain. Depending on the operation, recovery may require restoring the verified backup, using provider point-in-time recovery, or applying a reviewed forward repair. The chosen path must be tested before execution.

## 10. Exact Future Execution Plan

This sequence stops before live mutation unless the required approval is later granted.

### Step 1 — Freeze and identify the target

- **Purpose:** Stop uncontrolled migration/schema activity and establish whether the target is production-like.
- **Mode:** Read-only/documentation; no database mutation.
- **Approval:** Project owner confirms the freeze and target environment.
- **Verification:** Sanitized database identity, branch/worktree state, and active-writer inventory are recorded.

### Step 2 — Capture recovery artifacts

- **Purpose:** Make data recovery possible before any schema operation.
- **Mode:** Backup/export; operationally non-mutating to the target, but produces sensitive artifacts.
- **Approval:** **Gate A — approve database backup/export.**
- **Verification:** Backup completion, checksum, retention location, access controls, and isolated restore test are recorded.

### Step 3 — Capture authoritative live metadata

- **Purpose:** Produce the complete schema/ownership/index/migration-state evidence listed in Section 4.
- **Mode:** Read-only.
- **Approval:** Database owner approves catalog queries and handling of exports.
- **Verification:** Two independent checks or a reviewed report agree on tables, columns, constraints, indexes, sequences, row counts, and `neon_auth` boundary.

### Step 4 — Compare live state with source artifacts

- **Purpose:** Build a three-way comparison of verified live state, `schema.ts`, and checked-in SQL/journal/snapshots.
- **Mode:** Read-only analysis.
- **Approval:** **Gate B — approve schema reconciliation design.**
- **Verification:** Every difference has a disposition: preserve, intentionally reconcile, defer, or unknown requiring evidence. No silent repairs remain.

### Step 5 — Decide migration-history/bootstrap policy

- **Purpose:** Decide whether the old chain remains historical evidence and how a new live baseline will be represented/bookkept without replaying unknown history.
- **Mode:** Design only.
- **Approval:** Database owner and project owner approve the policy; provider owner approves the `neon_auth` boundary.
- **Verification:** An isolated replay of the proposed baseline succeeds, and its starting schema matches the verified live export without data loss.

### Step 6 — Author the approved baseline/reconciliation artifact

- **Purpose:** Produce the reviewed migration/baseline artifacts and any documentation needed for future deployments.
- **Mode:** Mutating repository files, but not the database.
- **Approval:** **Gate C — approve migration creation.**
- **Verification:** Generated/reviewed SQL is inspected statement by statement; `drizzle-kit check` or equivalent is run only in an approved isolated context; old artifacts are preserved; no `neon_auth` mutation is included.

### Step 7 — Rehearse execution

- **Purpose:** Validate the exact artifact against a restored copy or sanitized equivalent and test rollback/recovery.
- **Mode:** Mutating an isolated database only; live target unchanged.
- **Approval:** Database owner approves the rehearsal target.
- **Verification:** Schema diff, row counts, representative application smoke tests, and recovery procedure pass.

### Step 8 — Approve and execute on the live target

- **Purpose:** Apply only the approved, rehearsed reconciliation artifact.
- **Mode:** Mutating live database.
- **Approval:** **Gate D — approve migration execution**, with an explicit maintenance/write-free decision.
- **Verification:** Command output, transaction/statement result, migration bookkeeping state, and immediate error handling are captured without secrets.

### Step 9 — Verify and sign off

- **Purpose:** Confirm preservation and application continuity.
- **Mode:** Read-only verification plus application smoke testing.
- **Approval:** **Gate E — approve post-migration verification.**
- **Verification:** Row counts, schema metadata, indexes/constraints, auth/session continuity, calendar, file/folder, portfolio/student, and activity workflows pass. Any unexpected difference blocks sign-off and triggers the approved recovery path.

## 11. Human Approval Gates

- **GATE A — Approve database backup/export:** Confirm target identity, backup scope, export handling, checksum, retention, and restore test before schema work.
- **GATE B — Approve schema reconciliation design:** Confirm authoritative live metadata, source/live dispositions, index treatment, `neon_auth` boundary, and `events.color` deferral/decision.
- **GATE C — Approve migration creation:** Permit creation of only the reviewed baseline/reconciliation artifacts. This does not approve execution.
- **GATE D — Approve migration execution:** Permit the exact rehearsed artifact on the named live target during an approved window. Explicitly reject `push`, `drop`, and unreviewed ad hoc SQL.
- **GATE E — Approve post-migration verification:** Accept row-count, schema, recovery, and application smoke-test evidence, or reject and invoke the recovery plan.

Each gate must name the approver, timestamp, target, artifact/version, and evidence reviewed. Approval of this planning document alone is not approval of any mutation.

## 12. Separation from Future Phases

This plan does not implement Grade 10 assessment, learner enrolment, teacher allocation, school tenancy, roles, authorization redesign, reports, or portfolio redesign. It identifies only the dependency that those phases require a trustworthy, data-preserving schema baseline and explicit ownership/tenant transition strategy.

The current unconstrained user/learner/file relationships and authorization defects must be carried forward as known risks. They must not be “fixed” opportunistically by a baseline migration, because adding foreign keys or tenant columns without an approved data-mapping and authorization design could block existing rows or create false ownership.

## 13. Final Recommendation

**Recommended remediation strategy:** Use a verified live-database baseline/reconciliation boundary (Option B), followed by narrowly scoped, separately approved reconciliation migrations (Option C) only where the source/live comparison and data checks justify them. Preserve the incomplete `0000`/`0001`/`0002` history and orphaned `0003` as historical evidence; do not replay or silently rewrite them. Keep `events.color` deferred. Exclude `neon_auth` from application repair until its provider ownership is confirmed.

**Why this is safest:** It starts from the database that actually contains the 63 observed public application rows, avoids pretending that missing migration history is known, preserves live indexes and provider objects until their owners are established, and requires backup, isolated rehearsal, explicit approvals, and post-change verification before mutation.

**Evidence still missing:** A verified provider-native backup and restore test; authoritative schema/data export; complete live catalog metadata including sequences, triggers, policies, grants, ownership, and index definitions; migration bookkeeping origin; target-environment identity; `neon_auth` ownership; row-level null/duplicate/orphan analysis; and an approved decision on source/live defaults, `user.name`, and eventual `events.color` behavior.

**Next exact action:** Obtain Gate A approval, then perform only a secret-safe backup/export and read-only metadata capture against the confirmed target. Stop after the evidence package is verified; do not create or execute a migration until Gates B and C are separately approved.
