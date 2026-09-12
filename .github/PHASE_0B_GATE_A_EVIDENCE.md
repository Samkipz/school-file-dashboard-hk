# Phase 0B Gate A Evidence

**Date:** 2026-09-07  
**Status:** GATE A BLOCKED  
**Scope:** Target confirmation, recovery evidence, and read-only PostgreSQL/Neon metadata capture. No migration execution.

## 1. Target Identity

- **VERIFIED:** A read-only PostgreSQL connection succeeded using the repository's configured local connection mechanism.
- **VERIFIED:** Database name: `neondb`.
- **VERIFIED:** Default schema: `public`.
- **VERIFIED:** Server: PostgreSQL 17.11, 64-bit Linux build.
- **VERIFIED:** The database is Neon-compatible and contains the `neon_auth` schema.
- **UNKNOWN:** Whether the target is development, staging, production, or shared. No repository or database metadata conclusively identifies the environment.
- **UNKNOWN:** Neon project, branch, plan, history-window setting, and target-owner identity. These require access to the Neon Console/API by an authorized administrator.

All queries used for this evidence were read-only `SELECT` statements. No record values were selected.

## 2. Backup/PITR Status

**NOT VERIFIED.** No provider-native backup, restore point, or PITR artifact was created by this task.

No local `neon`/`neonctl` CLI or `pg_dump`/`psql` executable was available in the inspected command path. No provider API credential was available to this task, and no provider operation was attempted. The repository's connection can prove database connectivity but cannot prove recoverability.

Official Neon documentation indicates that instant restore/PITR is available only within the project's history window and restores a root branch by overwriting the branch timeline. It replaces all data and schema on all databases on that branch, including managed Better Auth data in `neon_auth`; it is therefore not a harmless backup action. Neon creates a backup branch for an instant restore, but the actual project's branch type, history window, and permissions remain **UNKNOWN**.

**REQUIRED MANUAL ACTION:** An authorized database administrator must identify the exact Neon project/branch and confirm the current history window, then create or designate a provider-native recovery point under the project's approved recovery policy. The administrator must return the project/branch identity, recovery-point timestamp or identifier, retention, access controls, and evidence that recovery is available. Do not restore or reset the live branch as part of this action.

## 3. Logical Export Status

**NOT VERIFIED.** No schema-plus-data logical export was created by this task. The existing connection was used only for metadata and aggregate counts.

**REQUIRED MANUAL ACTION:** Using an approved secret manager or administrator workstation, create a logical export of the exact target database without printing the connection value. The export must include the `public` and `neon_auth` schemas, schema definitions, data, constraints, indexes, ownership/privilege metadata where supported, and required provider-managed objects. Keep the export in an access-controlled recovery location. Do not paste its contents into this report.

A suitable administrator procedure is:

1. Confirm the target database and branch in the provider console.
2. Obtain a short-lived read-capable connection through the secret manager.
3. Run the provider-approved PostgreSQL dump procedure with schema and data included, directing output to an access-controlled file outside the repository.
4. Generate a checksum and record file size, timestamp, target identity, and retention policy.
5. Restore the dump into an isolated database or Neon branch, never the live target, and compare schema and row counts.
6. Return only sanitized evidence: artifact identifier, checksum, restore-test result, target identity, and timestamps.

Do not place connection strings, credentials, tokens, emails, raw rows, file contents, or storage keys in the export report.

## 4. Restore-Test Status

**NOT VERIFIED.** No restore test was run because no backup/export artifact was available and no isolated restore target was provisioned by this task.

A successful connection and a count query do not establish recoverability. Gate A cannot pass until an administrator provides evidence that the backup/export can be restored into an isolated target and that its schema and counts are usable.

## 5. Schema Metadata Status

**PARTIALLY VERIFIED; COMPLETE EVIDENCE PACKAGE NOT VERIFIED.** The Phase 0B audit and this task used read-only PostgreSQL catalog queries against both `public` and `neon_auth`. The queries covered tables, columns, constraints, indexes, sequences, table ownership/RLS flags, privileges, triggers, views, functions, extensions, policies, schema ownership, database ownership, and aggregate row counts. No record values were selected.

The following results are verified from the audit and repeatable read-only checks:

- `public` contains the 12 checked-in tables: `account`, `activity_logs`, `announcements`, `events`, `files`, `folders`, `portfolioFiles`, `session`, `students`, `user`, and `verification`.
- `neon_auth` contains nine tables: `account`, `invitation`, `jwks`, `member`, `organization`, `project_config`, `session`, `user`, and `verification`.
- All public application tables have primary keys on `id`.
- Live public foreign keys are limited to `account.userId -> user.id` and `session.userId -> user.id`, both with `ON DELETE CASCADE`.
- Live public unique constraints are `user.email` and `session.token`.
- No live public check constraints were returned by the catalog query.
- `files.section` and `folders.section` are required with default `staff`.
- `user.name` is nullable live, unlike the current source schema.
- Several live `updatedAt` columns have no database default even though the source schema declares `now()` defaults.
- `events.color` is absent live.
- No application sequences or identity sequences were returned for `public` or `neon_auth`.
- No live public RLS policies were returned by the audit query.
- The audit observed no migration-like table matching `%drizzle%` or `%migration%`.

### Required detailed metadata still to be retained as an administrator evidence artifact

The live catalog queries must be exported and reviewed in a durable, sanitized artifact before Gate B. For every table in both schemas, that artifact must retain:

- column order, names, PostgreSQL types, domains/enums, lengths/precision, collation, generated/identity state, nullability, and exact defaults;
- primary, unique, exclusion, check, and foreign-key definitions, including update/delete actions and validation state;
- all index definitions, predicates, included columns, ordering, uniqueness, and validity;
- sequences/identity ownership and default linkage;
- table/schema/database ownership and privileges;
- triggers, views, materialized views, functions, extensions, RLS policies, grants, and provider-managed object boundaries.

The report records the results that can be safely summarized here, but it does not claim that a complete exported catalog artifact has been verified.

## 6. Index Inventory

**VERIFIED:** The eight indexes identified by the Phase 0B audit exist with these exact definitions. They were inspected only; none was modified.

| Table                  | Index                         | Exact definition                                                                                  |
| ---------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `public.activity_logs` | `idx_activity_logs_createdat` | `CREATE INDEX idx_activity_logs_createdat ON public.activity_logs USING btree ("createdAt" DESC)` |
| `public.activity_logs` | `idx_activity_logs_userid`    | `CREATE INDEX idx_activity_logs_userid ON public.activity_logs USING btree ("userId")`            |
| `public.announcements` | `idx_announcements_createdat` | `CREATE INDEX idx_announcements_createdat ON public.announcements USING btree ("createdAt" DESC)` |
| `public.announcements` | `idx_announcements_userid`    | `CREATE INDEX idx_announcements_userid ON public.announcements USING btree ("userId")`            |
| `public.events`        | `idx_events_eventdate`        | `CREATE INDEX idx_events_eventdate ON public.events USING btree ("eventDate")`                    |
| `public.events`        | `idx_events_userid`           | `CREATE INDEX idx_events_userid ON public.events USING btree ("userId")`                          |
| `public.folders`       | `idx_folders_parentfolderid`  | `CREATE INDEX idx_folders_parentfolderid ON public.folders USING btree ("parentFolderId")`        |
| `public.folders`       | `idx_folders_userid`          | `CREATE INDEX idx_folders_userid ON public.folders USING btree ("userId")`                        |

**UNKNOWN:** Origin, owner, creation time, intended retention, and workload justification for these indexes. They must be preserved unless a separately approved performance decision says otherwise.

## 7. Sequence/Identity Inventory

**VERIFIED:** `information_schema.sequences` returned no sequences in `public` or `neon_auth`.

**VERIFIED:** The checked-in application tables use text identifiers rather than serial/identity columns. No sequence values were read or changed.

**UNKNOWN:** Whether provider-internal objects outside these schemas use sequences, and whether any sequence-like behavior is hidden in provider-managed objects. This is outside application reconciliation unless the provider owner supplies evidence.

## 8. Constraint Safety Diagnostics

These diagnostics returned counts only. They did not select or print record values.

### Duplicate candidates

| Candidate              | Affected duplicate groups |
| ---------------------- | ------------------------: |
| `public.user.email`    |                         0 |
| `public.session.token` |                         0 |

**VERIFIED:** No duplicate groups were found for the existing source unique keys at capture time.

### NULL candidates

| Column checked                   | Affected rows |
| -------------------------------- | ------------: |
| `public.user.name`               |             0 |
| `public.session.updatedAt`       |             0 |
| `public.account.updatedAt`       |             0 |
| `public.announcements.updatedAt` |             0 |
| `public.events.updatedAt`        |             0 |
| `public.folders.updatedAt`       |             0 |
| `public.verification.updatedAt`  |             0 |

**VERIFIED:** No NULLs were found in these reviewed columns at capture time. A zero count does not approve changing any live constraint or default.

### Orphan candidates

| Relationship checked                      | Affected rows |
| ----------------------------------------- | ------------: |
| `session.userId -> user.id`               |             0 |
| `account.userId -> user.id`               |             0 |
| `students.userId -> user.id`              |             0 |
| `portfolioFiles.studentId -> students.id` |             0 |
| `portfolioFiles.uploadedBy -> user.id`    |             0 |
| `files.folderId -> folders.id`            |             0 |
| `files.uploadedBy -> user.id`             |             0 |
| `folders.userId -> user.id`               |             0 |
| `folders.parentFolderId -> folders.id`    |             0 |
| `announcements.userId -> user.id`         |             0 |
| `events.userId -> user.id`                |             0 |
| `activity_logs.userId -> user.id`         |             0 |

**VERIFIED:** No orphan rows were found in these checks at capture time. These diagnostics do not establish that adding foreign keys is approved or safe; duplicate semantics, ownership mapping, concurrent writes, and future tenant design remain unresolved.

## 9. Row Counts

**Capture timestamp:** 2026-09-07; counts are exact aggregate counts at query time and may change as the application writes. No rows were selected.

| Schema/table               | Rows |
| -------------------------- | ---: |
| `public.account`           |    7 |
| `public.activity_logs`     |   14 |
| `public.announcements`     |    0 |
| `public.events`            |    3 |
| `public.files`             |   10 |
| `public.folders`           |    5 |
| `public.portfolioFiles`    |    1 |
| `public.session`           |   14 |
| `public.students`          |    2 |
| `public.user`              |    7 |
| `public.verification`      |    0 |
| `neon_auth.account`        |    0 |
| `neon_auth.invitation`     |    0 |
| `neon_auth.jwks`           |    0 |
| `neon_auth.member`         |    0 |
| `neon_auth.organization`   |    0 |
| `neon_auth.project_config` |    1 |
| `neon_auth.session`        |    0 |
| `neon_auth.user`           |    0 |
| `neon_auth.verification`   |    0 |

**VERIFIED:** The public application tables contain 63 rows in aggregate. The live database is data-bearing. The `neon_auth.project_config` table contains one row and must be treated as provider-managed until ownership is proven otherwise.

## 10. `neon_auth` Ownership and Boundary

**UNKNOWN:** Repository evidence and SQL metadata do not conclusively establish the owner of `neon_auth` for this project.

**INFERENCE:** The schema name and table set are consistent with Neon Managed Better Auth. Official Neon documentation states that managed Better Auth data in `neon_auth` branches with database data and is included in branch restore operations. This supports treating it as provider-managed, but documentation alone does not prove the actual project has enabled or owns that service.

**REQUIRED MANUAL ACTION:** Confirm the Neon project’s Managed Better Auth configuration and ownership with the project/provider administrator. Until confirmed, keep every `neon_auth` object outside application migrations and do not alter, drop, rename, export publicly, or recreate it.

## 11. Missing Evidence

The following evidence is required before Gate B:

1. Verified provider-native backup/PITR recovery point and retention details.
2. Logical schema-plus-data export checksum and isolated restore-test evidence.
3. Conclusive target environment classification and named database owner.
4. Durable complete catalog export for both schemas, including exact columns, constraints, indexes, sequences/identity, ownership, privileges, triggers, views, functions, extensions, policies, grants, and migration bookkeeping.
5. Exact Neon project/branch identity, history-window capability, and Managed Better Auth ownership confirmation.
6. Origin and applied-state explanation for the missing `0000` migration, orphaned `0003`, and absent migration bookkeeping.
7. Privacy-preserving duplicate/orphan diagnostics for every proposed future constraint, including any additional uniqueness or relationship checks.
8. Approved disposition for source/live differences: nullable `user.name`, absent `updatedAt` defaults, unexplained indexes, and deferred `events.color`.
9. A write-free window or concurrency strategy for any later operation.
10. A reviewed isolated rehearsal plan and application smoke-test plan.

## 12. Risks

- The target environment is unknown and may be production-like.
- No verified backup or restore path exists in this evidence package.
- Neon PITR overwrites a branch timeline and includes `neon_auth`; it cannot be treated as a selective application-schema backup.
- A logical export may contain sensitive authentication and application data and requires strict access control.
- The migration chain is incomplete: journaled `0000` SQL is missing and `0003` is unjournaled/unsnapshotted.
- Applying checked-in migrations, generating against an untrusted live state, or using direct schema push could fail, drift, or destroy data.
- Adding foreign keys or `NOT NULL`/unique constraints later can fail or change behavior despite current zero-count diagnostics.
- Altering `neon_auth` could damage authentication state.
- Existing object-storage contents are not recovered by a database backup/PITR operation; R2/object storage requires a separate inventory and recovery policy.
- Counts are point-in-time evidence and do not prevent concurrent writes after capture.

## 13. Gate A Recommendation

**GATE A: BLOCKED.**

Read-only target identity, row counts, exact unexplained index definitions, sequence status, and count-only duplicate/null/orphan diagnostics were successfully verified. The target is PostgreSQL 17.11 on Neon-compatible infrastructure with `public` and `neon_auth`, and the public application data is non-empty.

Gate A cannot be marked ready because backup/PITR, logical export, restore testing, complete retained catalog evidence, target environment classification, and `neon_auth` ownership are not verified. Do not proceed to Gate B, create a migration, run Drizzle mutation commands, or alter either schema.

**Exact next action:** An authorized database administrator must confirm the target branch/environment, obtain the provider-native recovery artifact, create and verify a schema-plus-data logical export in an isolated restore target, and return sanitized evidence for the missing-evidence list above. After that evidence is reviewed, reassess Gate A; only then may schema reconciliation design begin.

## Safety Check

- No connection string or credential value is included.
- No raw user, authentication, file, event, or storage record values are included.
- No tokens, email addresses, object contents, or storage credentials are included.
- No database mutation command was executed.
- No migration command was executed.
- No repository file other than this report was created by this task.
