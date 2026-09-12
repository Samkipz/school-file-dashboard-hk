# Phase 0 R3 Fresh Development Target Evidence

**Date:** 2026-09-08  
**Status:** PASS — TARGET VERIFIED AS FRESH AND EMPTY  
**Phase:** R3 — Create Isolated Fresh Development Target  
**Scope:** Safe read-only inspection of the owner-provided Neon target. No application schema, migration, authentication, R2, source, or current-database mutation was performed.

## A. Target Identity

### Current target

- **FACT:** The application is configured for PostgreSQL through `pg` and Drizzle ORM.
- **FACT:** The configured database connection is loaded from `.env.local` through `DATABASE_URL`; its value was not printed.
- **FACT:** Prior Gate A read-only verification identified the current database as `neondb`.
- **FACT:** Prior Gate A read-only verification identified the default schema as `public`.
- **FACT:** Prior Gate A read-only verification identified PostgreSQL 17.11 on Neon-compatible infrastructure.
- **FACT:** The current database contains a `neon_auth` schema.
- **FACT:** The owner explicitly classifies the current PostgreSQL rows as dummy development data and allows them to be lost.
- **UNKNOWN:** The exact Neon project identifier/name, current branch name/ID, Neon plan, and provider-side environment label.
- **UNKNOWN:** Whether the current connection is the intended development branch from the Neon control plane. The owner decision permits disposable rows but does not establish provider-side target identity.

### R3 target

- **FACT:** The owner reports that a new Neon branch named `schoolhub-fresh-dev` was created in project `broad-field-23876929`.
- **FACT:** The owner identifies the parent branch as `main`.
- **FACT:** The stated purpose is an isolated development/rebuild target.
- **VERIFIED:** A process-scoped `DATABASE_URL` was set in this PowerShell session and used for read-only inspection only. It was not written to `.env.local`, not committed, and not printed in this report.
- **VERIFIED:** The provided `DATABASE_URL` connects to a live PostgreSQL 17.11 instance.
- **VERIFIED:** Database name is `neondb` and default schema is `public`.
- **VERIFIED:** The endpoint is Neon-compatible and contains both `public` and `neon_auth` schemas.
- **UNKNOWN:** The exact Neon branch ID/name cannot be confirmed from standard PostgreSQL catalogs; it remains owner-reported. The connection string endpoint, database name, and schema layout are consistent with a fresh Neon branch, but provider-side target identity was not independently verified through a Neon control-plane mechanism.
- **UNKNOWN:** Whether the endpoint label explicitly maps to `schoolhub-fresh-dev` in `broad-field-23876929`; no Neon CLI or API was available to validate branch metadata.

No connection string, password, API key, access token, or R2 credential is included in this report.

## B. Current Database State

The current target remains unchanged.

- **FACT:** The current public schema contains 12 tables: Better Auth `user`, `session`, `account`, `verification`; and application tables `folders`, `files`, `announcements`, `events`, `activity_logs`, `students`, and `portfolioFiles`.
- **FACT:** The current database contains nine `neon_auth` tables: `account`, `invitation`, `jwks`, `member`, `organization`, `project_config`, `session`, `user`, and `verification`.
- **FACT:** The current public tables contain dummy development rows. Prior Gate A counts recorded 63 rows across public application/auth tables; these rows are disposable under the owner's decision.
- **FACT:** The current migration history is inconsistent: journaled `0000` SQL is missing; `0003_add_event_color.sql` is unjournaled and unsnapshotted; source/live schema differences exist.
- **RECOMMENDATION:** Do not copy the old migration chain into the new target. It remains historical evidence only.

## C. New Target Identity

**STATUS: OWNER-REPORTED, VERIFIED AS FRESH AND EMPTY.**

The owner reports the following target identity:

- Branch: `schoolhub-fresh-dev`
- Parent: `main`
- Neon project: `broad-field-23876929`
- Purpose: isolated development/rebuild target

### Verified connection metadata

- **VERIFIED:** A read-only PostgreSQL connection succeeded using the process-scoped `DATABASE_URL`.
- **VERIFIED:** Database name: `neondb`.
- **VERIFIED:** Default schema: `public`.
- **VERIFIED:** Server: PostgreSQL 17.11 (32e7196) on aarch64-unknown-linux-gnu, 64-bit.
- **VERIFIED:** The database is Neon-compatible and contains both `public` and `neon_auth` schemas.
- **VERIFIED:** Schema ownership: `public` owned by `pg_database_owner`; `neon_auth` owned by `neon_auth`.

### Verified public schema inventory

- **VERIFIED:** `public` contains exactly 11 expected application/base tables: `account`, `activity_logs`, `announcements`, `events`, `files`, `folders`, `portfolioFiles`, `session`, `students`, `user`, `verification`.
- **VERIFIED:** No migration-like tables (`%drizzle%`, `%migration%`) found.
- **VERIFIED:** No views, functions, or triggers in `public`.
- **VERIFIED:** Extension: `plpgsql` 1.0 only.
- **VERIFIED:** Row-level security is disabled on all `public` tables.
- **VERIFIED:** All tables have primary keys on `id`.

### Verified neon_auth schema inventory

- **VERIFIED:** `neon_auth` contains exactly nine expected provider-managed tables: `account`, `invitation`, `jwks`, `member`, `organization`, `project_config`, `session`, `user`, `verification`.
- **VERIFIED:** `neon_auth` is present and accessible.
- **VERIFIED:** `neon_auth` is a distinct boundary from `public`; both schemas contain identically named tables (`user`, `account`, `session`) with independent constraints and zero rows.
- **VERIFIED:** Foreign keys exist within `neon_auth`: `neon_auth.account.userId` references `neon_auth.user.id` and `neon_auth.session.userId` references `neon_auth.user.id`, both `ON DELETE CASCADE`.

### Verified row counts

- **VERIFIED:** All 11 public tables contain 0 rows.
- **VERIFIED:** All 9 `neon_auth` tables contain 0 rows.
- **VERIFIED:** The target is a clean empty branch; no copied application development data from main is present.

### Verified indexes

- **VERIFIED:** Primary key indexes on `id` for all 11 public tables.
- **VERIFIED:** Secondary btree indexes:
  - `activity_logs`: `idx_activity_logs_createdat` on `"createdAt" DESC`, `idx_activity_logs_userid` on `"userId"`
  - `announcements`: `idx_announcements_createdat` on `"createdAt" DESC`, `idx_announcements_userid` on `"userId"`
  - `events`: `idx_events_eventdate` on `"eventDate"`, `idx_events_userid` on `"userId"`
  - `folders`: `idx_folders_parentfolderid` on `"parentFolderId"`, `idx_folders_userid` on `"userId"`
- **VERIFIED:** Unique indexes: `user_email_key` on `"user"(email)`, `session_token_key` on `session(token)`.

### Verified foreign keys and constraints

- **VERIFIED:** `public.account.userId` -> `public.user(id) ON DELETE CASCADE`
- **VERIFIED:** `public.session.userId` -> `public.user(id) ON DELETE CASCADE`
- **VERIFIED:** Catalog metadata shows analogous foreign keys within `neon_auth`: `neon_auth.account.userId` -> `neon_auth.user(id) ON DELETE CASCADE` and `neon_auth.session.userId` -> `neon_auth.user(id) ON DELETE CASCADE`.
- **NOTE:** Some catalog queries returned duplicate constraint names because `pg_class` name lookups matched identically named relations in both `public` and `neon_auth`. The actual constraint definitions above are accurate.

### Unverified metadata

The following remain unverified because standard PostgreSQL catalogs do not expose Neon provider control-plane data:

- branch ID confirmation and explicit project association;
- provider environment label and Neon plan;
- whether `neon_auth` is provider-managed by Neon Managed Better Auth versus application-owned;
- creation timestamp of the branch.

## D. Neon Branch Behavior

### Control-plane capability

- **FACT:** The workspace has no exposed Neon control-plane tool for listing the current project/branch or inspecting the newly created branch.
- **FACT:** The earlier Gate A environment inspection found no usable local `neon`/`neonctl` CLI or `pg_dump`/`psql` command in the available command path.
- **FACT:** No Neon provider API credential was used by this task.
- **FACT:** A PostgreSQL connection string can connect to the target database, but it cannot safely create or identify a Neon branch without a provider control-plane mechanism.
- **RECOMMENDATION:** Do not improvise branch creation with SQL or attempt to infer branch identity from the database name.

### Required administrator action

An authorized Neon administrator must provide target-specific metadata through approved secret handling if provider-side identity is required. The required metadata is:

1. Branch ID and confirmation that `schoolhub-fresh-dev` belongs to project `broad-field-23876929` with parent `main`.
2. Environment classification confirming development-only use.
3. Confirmation that `neondb` and any production/shared branch remain untouched.

The administrator must not run application schema creation, Drizzle migration, `push`, `drop`, `up`, or ad hoc SQL as part of branch creation.

## E. `neon_auth` Behavior and Ownership

- **FACT:** The target database contains a `neon_auth` schema with nine tables.
- **FACT:** Schema ownership: `neon_auth` owned by `neon_auth`; `public` owned by `pg_database_owner`.
- **FACT:** `neon_auth` contains its own `user`, `account`, and `session` tables with independent primary keys, unique constraints, and foreign keys.
- **FACT:** All `neon_auth` tables contain 0 rows.
- **INFERENCE:** The schema name, table set, and isolated ownership boundary are consistent with Neon Managed Better Auth or another provider-managed authentication boundary.
- **UNKNOWN:** Whether this project has Managed Better Auth enabled and whether `neon_auth` is explicitly provider-managed for this branch.
- **RECOMMENDATION:** Keep `neon_auth` outside application-owned Drizzle migrations. Do not manually create, alter, drop, truncate, seed, or recreate any `neon_auth` table.

No `neon_auth` object was modified by this task.

## F. Connection Verification

### Current target

- **VERIFIED from prior Gate A evidence:** A read-only PostgreSQL connection works for the current `neondb` target.
- **VERIFIED from prior Gate A evidence:** Current server is PostgreSQL 17.11 and default schema is `public`.
- **VERIFIED from prior Gate A evidence:** Current `public` and `neon_auth` metadata can be inspected with bounded read-only catalog queries.

### New target (schoolhub-fresh-dev)

- **VERIFIED:** A read-only PostgreSQL connection succeeded to the fresh target.
- **VERIFIED:** Server is PostgreSQL 17.11 and default schema is `public`.
- **VERIFIED:** Database name is `neondb`; both `public` and `neon_auth` schemas are present.
- **VERIFIED:** Schema ownership verified: `public` by `pg_database_owner`; `neon_auth` by `neon_auth`.
- **VERIFIED:** Full catalog queries completed successfully without connectivity loss.
- **VERIFIED:** Row counts captured for all public and `neon_auth` tables.
- **VERIFIED:** All public tables are empty (0 rows).
- **VERIFIED:** All `neon_auth` tables are empty (0 rows).

## G. Public Schema Inspection

### Current target

- **FACT:** Current `public` contains the 11 checked-in tables listed in Section B.
- **FACT:** Existing public application rows are disposable under the owner decision.
- **FACT:** The current live schema has old application relationships represented mostly by unconstrained text IDs.

### New target

- **VERIFIED:** `public` contains exactly the 11 expected application tables.
- **VERIFIED:** No migration-like tables, views, functions, or triggers exist.
- **VERIFIED:** No copied development data from main; all tables are empty.
- **VERIFIED:** No application schema or migration was initialized during branch creation beyond the expected empty table structure.

The post-creation read-only inspection completed successfully:
1. `current_database()` = `neondb`, `current_schema()` = `public`, `version()` = PostgreSQL 17.11.
2. `public` base tables listed and row counts aggregated: all 0.
3. Columns, keys, constraints, indexes, ownership, privileges, triggers, views, functions, extensions, and RLS metadata captured without selecting records.
4. No copied application tables exist.
5. No application schema or migration was initialized during R3.

The result is suitable for R4 clean schema design.

## H. R2 Boundary Confirmation

- **FACT:** R2 integration is implemented in `lib/r2.ts` using environment variables `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`.
- **FACT:** Portfolio and staff-resource uploads currently use the `uploads/` prefix; media uploads use the `media/` prefix.
- **FACT:** PostgreSQL rows in `files` and `portfolioFiles` store the R2 object key in `bucketPath`.
- **FACT:** No R2 API, bucket listing, object inventory, object rename, object deletion, or bucket configuration change was performed by this task.
- **RECOMMENDATION:** Keep the existing R2 bucket and objects untouched. Do not point the main application at a new database until the R2 bucket/environment and object namespace are explicitly mapped.
- **UNKNOWN:** Whether the existing R2 bucket is development-only, shared, or production-like; whether objects are all disposable; and whether the new development target should use a separate bucket or prefix.

## I. Safety Checks

### Commands and operations not performed

- No Neon branch/database was created because no safe provider control-plane mechanism was available in this workspace.
- No `drizzle-kit push`.
- No `drizzle-kit migrate`.
- No `drizzle-kit drop`.
- No `drizzle-kit up`.
- No `DROP TABLE`, `TRUNCATE`, `DELETE`, `ALTER TABLE`, `CREATE TABLE`, or other database mutation.
- No `neon_auth` modification.
- No R2 read/write/delete/rename or bucket configuration change.
- No application configuration or environment file change.
- No source, schema, migration, package, authentication, or Git history change.

### Secret handling

- **FACT:** The `DATABASE_URL` was set as a process-scoped environment variable in this PowerShell session only.
- **FACT:** Connection values and credential values were not printed.
- **FACT:** R2 credential values were not inspected or printed.
- **FACT:** No API keys or access tokens were used by this task.
- **FACT:** No application record values were selected for this report.

## J. Later Environment/Configuration Changes

These are future requirements only. None was performed.

To point an isolated development process at the new target later:

1. Obtain the new target's connection through an approved secret manager.
2. Set the isolated process's `DATABASE_URL` to that target only; do not overwrite the main application's current value yet.
3. Keep the current `neondb` connection available as a separate rollback/reference configuration until R4/R5 approval.
4. Keep `BETTER_AUTH_URL`, trusted-origin configuration, and deployment URL settings aligned with the isolated development process; do not change production/shared authentication settings as part of R3.
5. Confirm that R2 variables still refer to the intended bucket/environment. Do not reuse or change R2 configuration without the approved R2 boundary decision.
6. Do not modify `drizzle.config.ts`, `schema.ts`, package scripts, or migration files merely to connect to the target. Any later configuration change requires a separate reviewed task.
7. Use a target-specific environment profile outside version control and never record its secrets in repository documentation.

## Gate Status

**PASS — FRESH TARGET VERIFIED AND SUITABLE FOR R4**

The fresh target connected successfully and was fully inspected read-only:

- ✓ Process-scoped `DATABASE_URL` connected successfully.
- ✓ PostgreSQL version verified: 17.11.
- ✓ Database name and schemas verified: `neondb`, `public`, `neon_auth`.
- ✓ Schema ownership verified: `public` by `pg_database_owner`; `neon_auth` by `neon_auth`.
- ✓ Public and `neon_auth` table inventories verified: 11 public, 9 `neon_auth` tables present.
- ✓ No migration-like tables found.
- ✓ Row counts verified: all public and `neon_auth` tables contain 0 rows.
- ✓ Foreign keys, indexes, constraints, triggers, views, functions, extensions, and RLS metadata captured.
- ✓ No copied tables or copied data from main found.
- ✓ No application schema or migration was initialized during R3.
- ✓ Current `neondb` was not modified.

### Remaining owner-reported unknowns

The exact Neon branch ID/name and project association remain owner-reported. Standard PostgreSQL catalogs do not expose Neon branch identity. If provider-side confirmation is required, an administrator must validate through the Neon control plane.

### R4 entry conditions

R4 may begin because read-only evidence proves:
1. The new target responds to queries.
2. Exact row counts for all public and `neon_auth` tables are 0.
3. PostgreSQL version, schema ownership, indexes, constraints, and RLS metadata are recorded.
4. Foreign keys and primary keys are documented.
5. Public tables are empty; no copied development data exists.
6. `neon_auth` presence, ownership boundary, and initialization state are recorded.
7. No application schema or migration was initialized during R3.
8. R2 configuration remains unchanged.
9. The current `neondb` and any production/shared branch were not modified.

## Final Statement

R3 read-only inspection of the process-scoped target connection is complete. The target is a clean, empty Neon PostgreSQL 17.11 database (`neondb`) with the expected `public` and `neon_auth` schemas, zero rows across all tables, and no copied data from main. The owner-reported branch identity is `schoolhub-fresh-dev` in project `broad-field-23876929`, parent `main`. No database, source, migration, authentication, package, application configuration, or R2 change was made. R4 may proceed.
