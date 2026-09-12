# Phase 0B - Database Audit

Audit date: 2026-09-07

Status labels used below:

- **FACT**: directly observed in checked-in files, migration metadata, or read-only database output.
- **INFERENCE**: a conclusion drawn from those observations.
- **UNKNOWN**: not established by the available evidence.
- **RECOMMENDATION**: proposed next step; not performed by this audit.

No database modification, migration command, schema edit, migration edit, application-code edit, authentication edit, or authorization edit was performed.

## 1. Executive Summary

- **FACT:** The application is configured for PostgreSQL through Drizzle ORM and the `pg` node-postgres driver. The configured connection variable is `DATABASE_URL`; its value is intentionally omitted.
- **FACT:** The checked-in Drizzle schema defines 12 application tables: four Better Auth tables (`user`, `session`, `account`, `verification`) and eight application tables (`folders`, `files`, `announcements`, `events`, `activity_logs`, `students`, `portfolioFiles`).
- **FACT:** The live connection succeeded using only bounded `SELECT` statements. The server reported PostgreSQL 17.11, database `neondb`, and default schema `public`.
- **FACT:** All 12 checked-in public application tables exist in the live database. The live database also contains nine tables in a separate `neon_auth` schema that are not represented in `lib/db/schema.ts`.
- **FACT:** Live public data exists: `user` 7, `session` 14, `account` 7, `students` 2, `files` 10, `folders` 5, `portfolioFiles` 1, `events` 3, and `activity_logs` 14 rows. `announcements` and `verification` are empty. Counts are aggregate metadata only; no record values were selected.
- **FACT:** The migration chain is incomplete: the journal references `0000_icy_squadron_sinister`, but `0000_icy_squadron_sinister.sql` is absent; `0003_add_event_color.sql` exists but has no journal entry or snapshot.
- **FACT:** `events.color` is absent from the checked-in schema and absent from the live public `events` table, although `0003_add_event_color.sql` would add it.
- **INFERENCE:** The live database contains existing data that must be preserved. The checked-in migrations alone cannot safely reconstruct the current database.
- **RECOMMENDATION:** Freeze database changes, preserve the live database, obtain an approved schema/migration export, and create a reviewed baseline-reconciliation plan before any repair migration is authored or executed.

## 2. Database Configuration

Sources: [drizzle.config.ts](../drizzle.config.ts), [lib/db/index.ts](../lib/db/index.ts), [package.json](../package.json), and environment-variable references in the application.

- **FACT:** `drizzle.config.ts` loads `.env.local` through `dotenv`, points Drizzle at `./lib/db/schema.ts`, writes migration artifacts to `./drizzle`, and declares dialect `postgresql`.
- **FACT:** Runtime access creates a `pg.Pool` from `process.env.DATABASE_URL` and passes it to `drizzle-orm/node-postgres`.
- **FACT:** `package.json` includes `drizzle-orm`, `drizzle-kit`, and `pg`. It has no migration script and no database seed script.
- **FACT:** The environment variable name used for the database connection is `DATABASE_URL`. No credential value is included in this report.
- **FACT:** The application also references deployment/auth/storage variables such as `BETTER_AUTH_URL`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `R2_ENDPOINT`, and R2 credential/bucket names, but these are not database connection settings.
- **INFERENCE:** Local and deployment environments appear to use the same `DATABASE_URL` name with environment-specific values supplied externally. No separate `DATABASE_URL` names for local, staging, and production are declared in the checked-in configuration.
- **FACT:** The sanitized probe confirmed `.env.local` loaded and `DATABASE_URL` was configured. The file contents were not printed or included.
- **FACT:** The live server identified itself as PostgreSQL 17.11 on Neon-compatible infrastructure; the presence of `neon_auth` is additional live evidence of Neon-managed authentication tables.

## 3. Drizzle Schema Inventory

Source: [lib/db/schema.ts](../lib/db/schema.ts).

The source schema defines 12 tables. Unless stated otherwise, the source declares no check constraints and no explicit secondary indexes for the application tables. Drizzle-generated primary-key and unique constraints are listed where applicable.

| Table            | Columns, nullability, and important defaults                                                                                                                                                                                                                                                                               | Keys and constraints in source                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `user`           | `id` text required; `name` text required; `email` text required; `emailVerified` boolean required default `false`; `image` text nullable; `createdAt` timestamp required default `now()`; `updatedAt` timestamp required default `now()`                                                                                   | PK `id`; unique `email`; no checks or secondary indexes                                                    |
| `session`        | `id` text required; `expiresAt` timestamp required; `token` text required; `createdAt` timestamp required default `now()`; `updatedAt` timestamp required default `now()`; `ipAddress` text nullable; `userAgent` text nullable; `userId` text required                                                                    | PK `id`; unique `token`; FK `userId` -> `user.id` with `ON DELETE CASCADE`; no checks or secondary indexes |
| `account`        | `id` text required; `accountId` text required; `providerId` text required; `userId` text required; `accessToken`, `refreshToken`, `idToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`, `scope`, `password` nullable; `createdAt` timestamp required default `now()`; `updatedAt` timestamp required default `now()` | PK `id`; FK `userId` -> `user.id` with `ON DELETE CASCADE`; no unique or check constraint declared         |
| `verification`   | `id`, `identifier`, `value`, `expiresAt` required; `createdAt` timestamp nullable default `now()`; `updatedAt` timestamp nullable default `now()`                                                                                                                                                                          | PK `id`; no unique, FK, check, or secondary index declared                                                 |
| `folders`        | `id`, `userId`, `name` required; `parentFolderId`, `description` nullable; `section` required default `staff`; `createdAt`, `updatedAt` required default `now()`                                                                                                                                                           | PK `id`; no FKs, unique constraints, checks, or secondary indexes declared                                 |
| `files`          | `id`, `filename`, `originalName`, `mimeType`, `size`, `uploadedBy`, `uploadedAt`, `bucketPath`, `folderId` required; `section` required default `staff`                                                                                                                                                                    | PK `id`; no FKs, unique constraints, checks, or secondary indexes declared                                 |
| `announcements`  | `id`, `userId`, `title`, `content` required; `category` required default `general`; `createdAt`, `updatedAt` required default `now()`                                                                                                                                                                                      | PK `id`; no FKs, unique constraints, checks, or secondary indexes declared                                 |
| `events`         | `id`, `userId`, `title`, `eventDate` required; `description`, `location` nullable; `createdAt`, `updatedAt` required default `now()`                                                                                                                                                                                       | PK `id`; no FKs, unique constraints, checks, or secondary indexes declared; no `color` column              |
| `activity_logs`  | `id`, `userId`, `actionType`, `description`, `createdAt` required; `targetId`, `targetType` nullable; `createdAt` default `now()`                                                                                                                                                                                          | PK `id`; no FKs, unique constraints, checks, or secondary indexes declared                                 |
| `students`       | `id`, `userId`, `name`, `className`, `createdAt`, `updatedAt` required; `avatarUrl` nullable; `createdAt` and `updatedAt` default `now()`                                                                                                                                                                                  | PK `id`; no FKs, unique constraints, checks, or secondary indexes declared                                 |
| `portfolioFiles` | `id`, `filename`, `originalName`, `mimeType`, `size`, `uploadedBy`, `uploadedAt`, `bucketPath`, `studentId` required; `uploadedAt` default `now()`                                                                                                                                                                         | PK `id`; no FKs, unique constraints, checks, or secondary indexes declared                                 |

**FACT:** Only `session.userId` and `account.userId` have foreign keys in the checked-in source schema. The application-table ID relationships are plain text columns without database referential constraints.

## 4. Migration Inventory

Sources: [drizzle.config.ts](../drizzle.config.ts), [drizzle/](../drizzle/), [drizzle/meta/\_journal.json](../drizzle/meta/_journal.json), and the snapshot files under [drizzle/meta/](../drizzle/meta/).

### SQL files

1. `0001_cloudy_madame_web.sql` - creates `students` and `portfolioFiles`.
2. `0002_add_section.sql` - adds required `section` columns with default `staff` to `files` and `folders`.
3. `0003_add_event_color.sql` - adds required `events.color` with default `#3b82f6`.

### Journal

- **FACT:** `_journal.json` has three entries: `0000_icy_squadron_sinister`, `0001_cloudy_madame_web`, and `0002_add_section`.
- **FACT:** No journal entry exists for `0003_add_event_color`.
- **FACT:** The journal's first entry references `0000_icy_squadron_sinister`, but no matching `0000_icy_squadron_sinister.sql` exists.
- **FACT:** The three journal entries have version `7`, PostgreSQL dialect metadata, and sequential indexes `0`, `1`, and `2`.

### Snapshots

- **FACT:** `0000_snapshot.json` describes nine public tables and has no `events.color` column.
- **FACT:** `0001_snapshot.json` describes 11 public tables, adding `students` and `portfolioFiles`; it still has no `events.color`.
- **FACT:** `0002_snapshot.json` describes the same 11 tables and reflects `files.section` and `folders.section`; it still has no `events.color`.
- **FACT:** Snapshot predecessor IDs form a chain from `0000` to `0001` to `0002`.
- **INFERENCE:** The snapshot chain is internally sequential through `0002`, but it cannot be replayed from the checked-in SQL because the baseline SQL for the journal's `0000` entry is missing.
- **INFERENCE:** `0003_add_event_color.sql` is an orphaned SQL file relative to the journal and snapshot chain. It must not be assumed applied.

### Correspondence summary

| Artifact                               | Expected/current state | Status                       |
| -------------------------------------- | ---------------------- | ---------------------------- |
| SQL migration for journal `0000`       | Missing                | CONFIRMED discrepancy        |
| SQL migration for journal `0001`       | Present                | CONFIRMED                    |
| SQL migration for journal `0002`       | Present                | CONFIRMED                    |
| SQL migration for `0003`               | Present                | CONFIRMED                    |
| Journal entry for `0003`               | Missing                | CONFIRMED discrepancy        |
| Snapshot for `0003`                    | Missing                | CONFIRMED discrepancy        |
| `events.color` in source schema        | Absent                 | CONFIRMED                    |
| `events.color` in snapshots            | Absent                 | CONFIRMED                    |
| `events.color` in live public database | Absent                 | CONFIRMED by read-only query |

## 5. Live Database Inspection

### Method and connection

- **FACT:** A bounded PostgreSQL client loaded `.env.local` without printing it, used the configured `DATABASE_URL`, and connected successfully.
- **FACT:** The inspection used only `SELECT` statements against `current_database()`, `current_schema()`, `version()`, `information_schema`, `pg_constraint`, `pg_indexes`, and aggregate `count(*)` queries. No `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `DELETE`, `UPDATE`, `INSERT`, seed, Drizzle, migration, or reset command was run.
- **FACT:** Live server metadata: database `neondb`; default schema `public`; PostgreSQL 17.11.
- **FACT:** No table matching `%drizzle%` or `%migration%` was returned by the catalog query. The standard Drizzle bookkeeping table was therefore not observed in the accessible catalogs.

### Live tables and aggregate counts

The application schema comparison below concerns the `public` schema. The `neon_auth` tables are listed separately because they are live database objects outside the checked-in application schema.

| Live schema/table          | Approximate/exact aggregate count from `count(*)` | Notes                                    |
| -------------------------- | ------------------------------------------------: | ---------------------------------------- |
| `public.account`           |                                                 7 | Checked-in application table             |
| `public.activity_logs`     |                                                14 | Checked-in application table             |
| `public.announcements`     |                                                 0 | Checked-in application table             |
| `public.events`            |                                                 3 | Checked-in application table; no `color` |
| `public.files`             |                                                10 | Checked-in application table             |
| `public.folders`           |                                                 5 | Checked-in application table             |
| `public.portfolioFiles`    |                                                 1 | Checked-in application table             |
| `public.session`           |                                                14 | Checked-in application table             |
| `public.students`          |                                                 2 | Checked-in application table             |
| `public.user`              |                                                 7 | Checked-in application table             |
| `public.verification`      |                                                 0 | Checked-in application table             |
| `neon_auth.account`        |                                                 0 | Live extra schema                        |
| `neon_auth.invitation`     |                                                 0 | Live extra schema                        |
| `neon_auth.jwks`           |                                                 0 | Live extra schema                        |
| `neon_auth.member`         |                                                 0 | Live extra schema                        |
| `neon_auth.organization`   |                                                 0 | Live extra schema                        |
| `neon_auth.project_config` |                                                 1 | Live extra schema                        |
| `neon_auth.session`        |                                                 0 | Live extra schema                        |
| `neon_auth.user`           |                                                 0 | Live extra schema                        |
| `neon_auth.verification`   |                                                 0 | Live extra schema                        |

**FACT:** The public schema contains all 12 tables declared by `lib/db/schema.ts`. The live database contains 21 non-system tables in total: 12 public application tables and nine `neon_auth` tables.

### Live public columns and constraints

- **FACT:** Every checked-in public application table has the expected primary-key column `id`.
- **FACT:** Live public foreign keys are present only for `account.userId -> user.id` and `session.userId -> user.id`, both with `ON DELETE CASCADE`.
- **FACT:** Live public unique constraints are `user.email` and `session.token`, matching the source schema.
- **FACT:** No live public check constraints were returned.
- **FACT:** `files.section` and `folders.section` exist, are required, and default to `staff`, matching the source schema and `0002`.
- **FACT:** `events.color` does not exist in the live public table.
- **FACT:** Live `user.name` is nullable, while the checked-in schema declares it required.
- **FACT:** Live `updatedAt` has no database default on `user`, `account`, `session`, `announcements`, `events`, `folders`, and `verification`; the checked-in schema declares `updatedAt` default `now()` on those tables. Live `verification.updatedAt` is nullable, as the source allows, but lacks the source default.
- **FACT:** Live `user.name` and all other public columns were inventoried through `information_schema.columns`; no record values were selected.

### Live public indexes

- **FACT:** Primary-key and unique indexes exist for the live primary/unique constraints.
- **FACT:** Additional live indexes exist on `activity_logs.createdAt` descending, `activity_logs.userId`, `announcements.createdAt` descending, `announcements.userId`, `events.eventDate`, `events.userId`, `folders.parentFolderId`, and `folders.userId`.
- **FACT:** These additional indexes are not declared in the checked-in `lib/db/schema.ts` and are not created by the three checked-in SQL files.
- **UNKNOWN:** The origin, owner, creation time, and intended retention of the additional live indexes are not established by this audit.

## 6. Existing Data Preservation Assessment

- **FACT:** The live public database is not empty. It contains 63 rows across the checked-in application tables based on exact `count(*)` aggregate queries.
- **FACT:** Non-empty public application tables are `account`, `activity_logs`, `events`, `files`, `folders`, `portfolioFiles`, `session`, `students`, and `user`.
- **FACT:** Empty public application tables are `announcements` and `verification`.
- **FACT:** The live database also contains one `neon_auth.project_config` row; other `neon_auth` tables were empty in the observed counts.
- **INFERENCE:** Existing user, session, file, folder, portfolio, student, event, and activity data must be preserved unless an authorized owner explicitly decides otherwise.
- **UNKNOWN:** Whether the database is production, staging, development, or a shared environment cannot be established from the sanitized metadata alone. The database contains real-looking application state, so it must be treated as data-bearing until proven otherwise.
- **FACT:** No names, emails, tokens, passwords, object contents, or other record values were selected or written to this report.

## 7. Schema vs Migration vs Live DB Comparison

| Object or concern                    | Drizzle source schema                                                      | Migration history                                   | Live database                                                                   | Status                                                |
| ------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `user`                               | Exists; `name` required; `updatedAt` default `now()`                       | Baseline only; baseline SQL missing                 | Exists; `name` nullable; `updatedAt` has no default; 7 rows                     | CONFIRMED mismatch                                    |
| `session`                            | Exists; FK and unique token; `updatedAt` default `now()`                   | Baseline only; baseline SQL missing                 | Exists; matching FK/unique; no `updatedAt` default; 14 rows                     | CONFIRMED mismatch                                    |
| `account`                            | Exists; FK to `user`; `updatedAt` default `now()`                          | Baseline only; baseline SQL missing                 | Exists; matching FK; no `updatedAt` default; 7 rows                             | CONFIRMED mismatch                                    |
| `verification`                       | Exists; nullable timestamps with defaults                                  | Baseline only; baseline SQL missing                 | Exists; `createdAt` default present; `updatedAt` default absent; 0 rows         | CONFIRMED mismatch                                    |
| `folders`                            | Exists; `section` required default `staff`; timestamps default `now()`     | Baseline plus `0002` section change                 | Exists; section matches; additional indexes; `updatedAt` default absent; 5 rows | CONFIRMED mismatch                                    |
| `files`                              | Exists; `section` required default `staff`                                 | Baseline plus `0002` section change                 | Exists; section matches; 10 rows                                                | No material column mismatch observed                  |
| `announcements`                      | Exists; category default `general`; timestamps default `now()`             | Baseline only; baseline SQL missing                 | Exists; category matches; `updatedAt` default absent; 0 rows                    | CONFIRMED mismatch                                    |
| `events`                             | Exists; no `color`; timestamps default `now()`                             | Baseline omits color; orphan `0003` would add color | Exists; no `color`; `updatedAt` default absent; 3 rows                          | CONFIRMED migration discrepancy                       |
| `activity_logs`                      | Exists; created timestamp default `now()`                                  | Baseline only; baseline SQL missing                 | Exists; matching columns/default; additional indexes; 14 rows                   | Source/history incomplete                             |
| `students`                           | Exists; all required fields except `avatarUrl`; timestamps default `now()` | Created by `0001`                                   | Exists; columns/defaults match; 2 rows                                          | Confirmed match                                       |
| `portfolioFiles`                     | Exists; all fields required; upload timestamp default `now()`              | Created by `0001`                                   | Exists; columns/default match; 1 row                                            | Confirmed match                                       |
| Public application FKs               | Only Better Auth user relationships                                        | Baseline history unavailable                        | Only `account` and `session` FKs to `user`                                      | Confirmed limitation                                  |
| Public application secondary indexes | None explicitly declared                                                   | Not present in checked-in SQL                       | Eight additional application indexes exist                                      | CONFIRMED discrepancy; origin UNKNOWN                 |
| Drizzle bookkeeping                  | Not an application schema table                                            | Journal is checked in                               | No table matching `%drizzle%` or `%migration%` observed                         | UNKNOWN applied migration state                       |
| Live `neon_auth` schema              | Absent                                                                     | Absent                                              | Nine extra tables, one row in `project_config`                                  | Confirmed live-only objects; ownership/origin UNKNOWN |

**INFERENCE:** The live public database is close to the intended table set but not identical to the checked-in schema in nullability/default metadata and indexes. The live-only `neon_auth` schema is a separate concern and must not be dropped or overwritten during remediation.

## 8. Migration Reconstruction Assessment

**Can we safely reconstruct the current database from the checked-in migrations alone?**

**NO.**

Reasons:

1. **FACT:** The journal requires a `0000_icy_squadron_sinister` baseline, but its SQL file is missing.
2. **FACT:** `0001_cloudy_madame_web.sql` only creates `students` and `portfolioFiles`; it cannot create the nine baseline tables described by `0000_snapshot.json`.
3. **FACT:** `0003_add_event_color.sql` is not in the journal and has no snapshot, so its application status cannot be inferred from the file's presence.
4. **FACT:** The live database has no observed Drizzle/migration bookkeeping table from the catalog search.
5. **FACT:** Live defaults, one nullability rule, and additional indexes differ from the checked-in source/migration artifacts.
6. **FACT:** The live database contains existing rows that make destructive reconstruction unacceptable.

**INFERENCE:** A fresh replay of the checked-in files cannot reproduce the observed live public database, and it provides no trustworthy applied-migration record for deciding what is safe to run.

## 9. Critical Findings

1. **CRITICAL - missing baseline:** `0000` is in the journal and snapshots but its SQL migration is absent. A reproducible migration chain does not exist.
2. **HIGH - live data:** The public database contains 63 application rows, including users, sessions, files, folders, students, portfolio files, events, and activity logs. Data preservation is mandatory.
3. **HIGH - orphan migration:** `0003_add_event_color.sql` is unjournaled, unsnapshotted, absent from source schema, and `events.color` is absent live. It must not be run or deleted as part of this audit.
4. **HIGH - source/live drift:** Live `user.name` is nullable and several `updatedAt` defaults are absent although the source schema declares otherwise.
5. **MEDIUM - untracked indexes:** Eight additional public application indexes exist live but are absent from the checked-in schema and SQL. Their origin is unknown.
6. **MEDIUM - extra auth schema:** Nine `neon_auth` tables exist outside the checked-in application schema. Their ownership and lifecycle must be established before any broad database operation.
7. **MEDIUM - migration-state unknown:** No standard migration-like bookkeeping table was observed, so applied migration state cannot be verified from the live database.

## 10. Recommended Remediation Strategy

1. **RECOMMENDATION:** Freeze all database writes and migration commands until this audit is reviewed. Do not run `0003`, generate migrations, push, migrate, reset, or drop.
2. **RECOMMENDATION:** Preserve the current database through an approved provider-native backup/export and retain the original connection/environment under secret-handling controls.
3. **RECOMMENDATION:** Obtain a provider-approved schema-only export plus a separately redacted catalog report, including all schemas, constraints, indexes, extensions, ownership, and migration bookkeeping. Include `public` and `neon_auth`; do not modify either.
4. **RECOMMENDATION:** Determine whether `neon_auth` is provider-managed and document its ownership boundary. Exclude it from application migration repair unless the provider explicitly governs it through the application workflow.
5. **RECOMMENDATION:** Reconcile the verified live public schema against source and migrations, explicitly deciding whether live defaults, nullability, and extra indexes are intentional. Preserve existing rows while deciding.
6. **RECOMMENDATION:** Create a reviewed baseline strategy from the verified live schema or an approved canonical schema. Do not create that baseline during Phase 0B.
7. **RECOMMENDATION:** Reconcile the journal, SQL files, and snapshots in a separate approved change. Decide the fate of `0003` only after confirming live behavior and application requirements.
8. **RECOMMENDATION:** Add future changes only through reviewed, generated, reproducible migrations with a verified migration bookkeeping strategy and a rollback/repair plan.
9. **RECOMMENDATION:** Before later schema work, add migration replay tests against an isolated database and a data-preservation smoke test against a sanitized fixture.

## 11. Risks

- **RISK (INFERENCE):** Running the checked-in migrations against the live database could fail, partially apply, or create an unintended schema because the baseline and applied state are unknown.
- **RISK (INFERENCE):** Applying `0003` could introduce a live column that is not represented in the current application schema or snapshots, creating further drift.
- **RISK (INFERENCE):** Replacing live defaults or nullability without checking existing rows could fail or alter future write semantics.
- **RISK (INFERENCE):** Treating `neon_auth` as application-owned could damage provider-managed authentication state.
- **RISK (INFERENCE):** Removing additional live indexes could degrade application performance; adding duplicates could increase write cost.
- **RISK (INFERENCE):** The observed data includes sessions and file metadata; careless exports or diagnostic logging could expose sensitive information.

## 12. Unknowns

- **UNKNOWN:** The original SQL contents of the missing `0000` migration.
- **UNKNOWN:** Which migrations, if any, were applied to the live database and when.
- **UNKNOWN:** Why the live database lacks a standard Drizzle migration bookkeeping table.
- **UNKNOWN:** The origin and ownership of the additional public indexes.
- **UNKNOWN:** Whether the live `neon_auth` schema is provider-managed, application-managed, or shared infrastructure.
- **UNKNOWN:** Whether the live database is development, staging, production, or shared.
- **UNKNOWN:** Whether existing live application rows satisfy every current source-schema not-null/default expectation; no record values were selected to answer this.
- **UNKNOWN:** Whether the database is covered by an existing backup/restore policy and whether a recent restore has been tested.

## 13. Phase 0B Acceptance Criteria

- [x] Database provider/type, driver, ORM configuration, migration directory, schema path, and connection variable name documented without secrets.
- [x] All 12 checked-in Drizzle tables inventoried with columns, nullability, keys, foreign keys, defaults, and source constraint/index limitations.
- [x] All three SQL files, three journal entries, and three snapshots inventoried.
- [x] Missing `0000` SQL, orphaned `0003` SQL, absent `0003` journal/snapshot, and `events.color` discrepancies documented.
- [x] Live PostgreSQL connection successfully inspected using only metadata and aggregate read-only queries.
- [x] Live tables, columns, keys, foreign keys, unique constraints, check constraints, indexes, migration-like table search, and row counts documented without record contents.
- [x] Existing data preservation requirement documented from aggregate counts.
- [x] Three-way comparison and reconstruction answer provided.
- [x] Recommended non-destructive remediation order provided; no remediation implemented.
- [x] No credentials, secret values, names, emails, tokens, passwords, or file contents written.
- [x] Only `.github/PHASE_0B_DATABASE_AUDIT.md` was created by this task; existing worktree changes were preserved.

**Conclusion:** Phase 0B is ready for remediation planning, not remediation execution. The database is data-bearing and the checked-in migration chain is not sufficient to reconstruct it safely. Any repair requires an approved live-schema baseline and explicit preservation of the separate `neon_auth` schema.
