# Phase 0 R5C — Target and bootstrap manifest verification

**R5C STATUS: BLOCKED.** Inspection attempt: 2026-09-09T19:13:22Z (UTC). The required process-scoped `DATABASE_URL` is absent. No connection was established, no PostgreSQL query executed, and no current database manifest or immutable before-change fingerprint can be certified. Historical R3 observations below are explicitly not current verification.

## Scope and evidence

Reviewed the governing instructions, development rules, architecture, security, testing standards, roadmap, rebuild plan and R3–R5B evidence, together with the supplied R4 design. Inspected current `lib/db/schema.ts`, `lib/db/index.ts`, `lib/auth.ts`, `drizzle.config.ts`, package scripts, migration SQL/journal and snapshot metadata read-only. Process environment names were inspected without values; `DATABASE_URL` was absent. No dotenv loader, application module, auth adapter or Drizzle command was invoked. `.env.local` was not used as a fallback or modified.

Owner-specified target: Neon project `broad-field-23876929`, branch `schoolhub-fresh-dev`, database `neondb`. These are intended target identifiers, not newly verified connection metadata. PostgreSQL catalogs cannot independently establish the Neon branch name/project association. Provider confirmation remains a separate evidence requirement.

## A. Current database verification coverage

All live items are **UNVERIFIED in R5C**: PostgreSQL version, database/role, schemas, public and neon_auth table inventory, exact counts, column types/typmods/nullability/defaults, PK/FK/unique/check constraints, indexes, sequences/identity, triggers/routines, views/materialized views, enums/custom types, extensions, RLS/policies, owners/grants and dependencies. Migration metadata presence is also unverified. Missing connection context must not be interpreted as zero rows or absent objects.

R3 previously recorded PostgreSQL 17.11, 11 empty public tables and nine empty neon_auth tables. That evidence does not establish today's state and is insufficient for executable bootstrap guards.

## B. Public-table classification and intended treatment

The following is the complete **source-declared** public inventory, reconciled with R5A. Every row's current live count is unknown; R3 reported zero for each.

| Table | Ownership/contract classification | Future R5A disposition, subject to R6 |
|---|---|---|
| public.user | Better Auth contract | Preserve; validate canonical compatibility |
| public.session | Better Auth contract | Preserve; validate canonical compatibility |
| public.account | Better Auth contract | Preserve; validate canonical compatibility |
| public.verification | Better Auth contract | Preserve; validate canonical compatibility |
| public.folders | Legacy SchoolHub | Remove only after exact empty-state/dependency verification; replacement deferred |
| public.files | Legacy SchoolHub | Remove empty metadata structure; storage model deferred, no R2 operation |
| public."portfolioFiles" | Legacy SchoolHub | Remove empty metadata structure with exact quoted case; evidence deferred |
| public.students | Legacy SchoolHub | Replace with new learner/admission/enrolment/placement structures |
| public.announcements | Legacy SchoolHub | Remove empty structure; notice replacement deferred |
| public.events | Legacy SchoolHub | Remove empty structure; calendar replacement deferred |
| public.activity_logs | Legacy SchoolHub | Replace with transactional audit_events |

No source-declared table has uncertain classification. Any additional live table must be classified explicitly and blocks automatic recognition of the expected state. Classification identifies application responsibility, not verified PostgreSQL ownership roles.

## C. Better Auth and provider boundary

Current configuration passes the shared pg pool to Better Auth, uses the four public identity models, and configures no alternate provider schema/model names. Source IDs are text. `user.email` and `session.token` are unique; every table has an id PK. Session/account userId references public.user with ON DELETE CASCADE. Source verification.createdAt/updatedAt remain nullable with now() defaults; the other auth creation/update timestamps are required. No provider/account composite uniqueness is declared. These are source facts, not a substitute for catalog definitions or auth smoke tests.

R5A proposes additional common auth indexes on session(userId), session(expiresAt), account(userId), verification(identifier), verification(expiresAt). Their current physical presence is unknown. Preserve the auth contract and resolve every source/live discrepancy before constructing the canonical fingerprint; do not treat these tables as disposable business tables.

R3 reports neon_auth tables account, invitation, jwks, member, organization, project_config, session, user and verification, each formerly zero rows. Current existence, counts and owner roles are unknown. Owner policy treats neon_auth as provider-owned and excludes it from SchoolHub migrations. Current schema and repository migration artifacts contain no neon_auth management or references. No current source FK targets neon_auth; the live cross-schema FK check remains pending. Never create, normalize, drop or change provider objects as part of foundation convergence.

## D. Old historical migration chain

| Artifact | Repository finding |
|---|---|
| 0000_icy_squadron_sinister | Journal idx 0, timestamp 1784300783789; SQL missing; 0000_snapshot.json present |
| 0001_cloudy_madame_web.sql | Journal idx 1, timestamp 1784310916038; creates students and portfolioFiles; 0001_snapshot.json present |
| 0002_add_section.sql | Journal idx 2, timestamp 1784362383863; adds files/folders section; 0002_snapshot.json present |
| 0003_add_event_color.sql | SQL present but unjournaled; no corresponding snapshot; source events has no color column |
| meta/_journal.json | Version 7, PostgreSQL, exactly the three entries above |

The old chain is **not reproducible as supplied**: the initial SQL is absent, and the color file is orphaned. Snapshots do not replace missing executable migration history. R3 reported no migration metadata tables; R5C has not rechecked that claim. No history repair, generation or execution occurred.

The **future authoritative SchoolHub baseline** is R5A's separate proposed drizzle-foundation history and reviewed ledger contract. The current Drizzle configuration loads .env.local and selects the old schema/history; it is not an authorized entrypoint for that baseline. Do not replay the old chain, manually stamp missing work as applied, or mix it into the new history.

## E. Two starting states, one resulting schema

**Case 1 — blank application database:** Prove the expected blank public namespace and absence of application migration history/unexpected objects. The future common 0000 migration creates the four canonical public auth tables. A local blank PostgreSQL database need not contain neon_auth; application migrations do not create it.

**Case 2 — existing empty target:** Prove the complete expected 11-table fingerprint and exact zero counts, including preserved auth tables. Validate ownership/grants, semantic definitions and dependencies; preserve the four compatible auth tables and remove only the seven named empty legacy structures, with no CASCADE. No data conversion, rename or auth transformation is currently proposed. Any required normalization requires explicit discrepancy resolution and reviewed statements.

Both paths use the same 0000 file/hash, common auth access indexes and normal successful migration recording, then identical foundation migrations. The planned first slice results in 21 new business tables plus four public auth tables. Provider structures remain outside that equivalence comparison. Auth-only unjournaled state, unexpected objects, changed contracts, rows or unknown ledger states must fail closed. Neither path was executed or authored here.

## F. Before-change safety manifest — incomplete

This dated record preserves repository findings and the failed connection prerequisite. It is **not sufficient as an immutable database before-image**, and must not be used as the E-state fingerprint.

To complete R5C, capture in a read-only PostgreSQL transaction: sanitized version/database/role and inspection timestamp; schema-qualified objects resolved by namespace/OID; exact counts for all public/provider tables; complete column, constraint, index, sequence, trigger, view, routine, type, extension, ownership/privilege, dependency and RLS definitions; migration-ledger inventory across schemas. Verify read-only mode before catalog work and do not query credential-bearing auth rows. Redact sensitive literals or endpoints in catalog definitions; do not silently omit semantic discrepancies. Record an explicit approved normalization policy for environment-specific identifiers and a stable comparison fingerprint. Preserve that completed pre-change record for later comparison, and recheck state immediately before any separately authorized execution.

## G. Entry conditions and verification

**Local migration artifact creation: not yet recommended.** R5A requires the full live manifest and resolution of canonical auth/legacy differences before generating/finalizing bootstrap SQL. R5C cannot satisfy that prerequisite without the authorized process connection. No R5D work starts from this blocked status.

**Database execution remains prohibited.** R5C cannot grant R6 approval. Later execution needs separately approved target identity, current empty-state/dependency evidence, exact artifacts/hashes, recovery plan, replay/auth/integrity tests and scoped permissions/seed limits.

Exact next phase: **resume R5C** with `DATABASE_URL` for schoolhub-fresh-dev supplied to the agent's process environment. Do not paste the credential into chat or commit it. After R5C passes, request the scoped R5D foundation migration artifact creation/review phase; execution remains a separate R6 gate.

Only intentional R5C repository write: this document. Pre-existing changes preserved: .gitignore; app/calendar/page.tsx; components/activity-feed.tsx, calendar-client.tsx, media-files-upload.tsx, portfolios-upload.tsx, staff-resources-upload.tsx; next.config.mjs; package.json/package-lock.json; staged tracking removals of next-env.d.ts and tsconfig.tsbuildinfo; untracked .github documents/workflow, .nvmrc, eslint.config.mjs, tests/ and vitest.config.mjs. No source/configuration/package/environment/migration/R2 mutation or database connection occurred. Runtime checks were not rerun for this documentation-only blocked preflight.

**R5C STATUS: BLOCKED — required process-scoped DATABASE_URL absent; live target manifest pending.**
