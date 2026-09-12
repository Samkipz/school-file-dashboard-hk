# Phase 0 R5A — Foundation Implementation Plan

Date: 2026-09-09. **PLAN ONLY — no implementation or execution authorization.**

## Scope, decisions and evidence

**OWNER APPROVED:** R4 is the target architecture, implemented incrementally. One membership per user/school with multi-school users; active membership plus appropriate role for school access; one grade per learner/year; dated class transfers; class-based offerings initially. Midyear grade changes must be rejected, never disguised as edits. Preserve the public Better Auth identity contract. Treat `neon_auth` as provider-owned and outside all application migrations. Use a fresh authoritative migration history and establish lint/tests/CI with server-side authorization.

**DEFERRED:** Assessment policies, tasks, attempts, marks, moderation/result/report tables, official KNEC configuration, storage/evidence, learner self-service and guardian access. The approved future workflow remains admin-created assessments, assigned-teacher marking, no self-moderation, admin finalization/publication. It creates no assessment implementation obligation in this slice. No official subject codes, SBA rules, external report identifiers or placeholder assessment tables are seeded here.

The slice includes **21 new SchoolHub tables plus four retained Better Auth tables**. Minimum `audit_events` is included because role grants, admissions, enrolments and transfers need atomic provenance. `platform_role_assignments` is deferred; first-school provisioning uses a restricted operator bootstrap, not an invented application Super Admin bypass. R4's nullable learner login mapping may remain as a dormant FK, but no self-service route, role grant or fixture enables it.

Governing documents read: [copilot-instructions.md](copilot-instructions.md), [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md), [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY_REQUIREMENTS.md](SECURITY_REQUIREMENTS.md), [ASSESSMENT_SPECIFICATION.md](ASSESSMENT_SPECIFICATION.md), [TESTING_STANDARDS.md](TESTING_STANDARDS.md), [ROADMAP.md](ROADMAP.md), [FRESH_DATABASE_REBUILD_PLAN.md](FRESH_DATABASE_REBUILD_PLAN.md), [R3 evidence](PHASE_0R3_FRESH_TARGET_EVIDENCE.md), and [approved R4 model](PHASE_0R4_DOMAIN_SCHEMA_DESIGN.md). Prior Phase 0 audit/remediation and [development baseline](PHASE_0C_DEVELOPMENT_BASELINE.md) findings inform the engineering prerequisites; the owner's newer fresh-history decision supersedes old proposals to repair the legacy chain.

Current source/configuration inspected: `lib/db/schema.ts`, `lib/db/index.ts`, `lib/auth.ts`, auth route, current action modules, `drizzle.config.ts`, migration journal/SQL, `package.json`, `tsconfig.json`, `next.config.mjs` and `vercel.json`. Installed Better Auth and Drizzle adapter code was read without invoking it. R4's full table contracts remain the reference; this plan specifies the first slice, bootstrap and rollout ordering.

**FACT:** R3 reports 11 empty public tables, not a blank public schema. Exact Neon project/branch association still needs provider-side confirmation before execution. Target is owner-reported project `broad-field-23876929`, branch `schoolhub-fresh-dev`, database `neondb`. No database connection was made for R5A; R3 row counts are historical evidence, not current preflight results.

**FACT:** Worktree already has modifications to `next-env.d.ts` and `tsconfig.tsbuildinfo`, and an untracked `.github/` directory. These are not cleaned or committed by this task. Only this document is created; R4 and other governing documents remain unchanged under the user's single-file restriction.

## A. Existing empty database treatment

### A1. Complete disposition of the 11 existing public tables

| Existing table | Classification for fresh-target bootstrap | Exact intended treatment and later mapping |
|---|---|---|
| `public.user` | Preserve as Better Auth contract | Keep existing table, text identity, camelCase fields, email uniqueness and current timestamp/nullability contract. Never repurpose it as school or learner identity. |
| `public.session` | Preserve as Better Auth contract | Keep token uniqueness and text userId FK to public.user with CASCADE; Better Auth manages session lifecycle. |
| `public.account` | Preserve as Better Auth contract | Keep provider/account/password fields and text userId FK with CASCADE. No new account uniqueness rule is assumed. |
| `public.verification` | Preserve as Better Auth contract | Keep fields/defaults and current nullable createdAt/updatedAt; test the adapter's required timestamp writes. No silent tightening. |
| `public.folders` | Remove during approved clean bootstrap | Remove this empty legacy table only on the verified fresh branch. Future school-scoped folders are deferred, not created now. |
| `public.files` | Remove during approved clean bootstrap | Remove empty legacy metadata table; no object operation or replacement asset table. Existing current-target metadata and R2 remain untouched. |
| `public.portfolioFiles` | Remove during approved clean bootstrap | Remove empty legacy metadata table with exact quoted case. Future evidence model is deferred. |
| `public.students` | Replace | Remove empty legacy structure during bootstrap. New learners/admissions/enrolments/placements are created in foundation migrations, with new identities; no dummy-row conversion or rename. |
| `public.announcements` | Remove during approved clean bootstrap | Future tenant-scoped noticeboard migration is a later slice. Current app continues against its existing target. |
| `public.events` | Remove during approved clean bootstrap | Future tenant-scoped calendar is deferred; no event/color migration in this slice. |
| `public.activity_logs` | Replace | Remove empty legacy structure; add minimum append-only audit_events for new domain operations. Do not import unverifiable dummy history. |

There is **no migrate/rename operation** in the proposed bootstrap. No auth table or schema is dropped. Removal of the seven legacy tables is a future, explicitly approved R6 operation with zero-row and dependency guards; this plan does not authorize it. If even one row now exists, stop. Never infer zero rows from catalogue estimates.

### A2. One convergent, checked initial migration

**RECOMMENDATION:** Use one immutable new history under a proposed `drizzle-foundation/` directory, with its own journal/snapshots and dedicated migration configuration. Preserve old `drizzle/` files unchanged as historical reference and exclude them from every fresh-target execution command. Proposed source modules live under `lib/db/foundation/`; an explicit foundation schema entrypoint exports only the approved four auth tables and 21 foundation tables. The old schema stays available to the unchanged legacy app until feature transitions are separately approved. The foundation application path must never choose the legacy schema as fallback.

The first migration, proposed `0000_auth_contract_and_empty_legacy_bootstrap.sql`, is a **reviewed custom convergence migration**, not blindly generated create statements or an independent second history. It recognizes exactly two pre-migration business-schema states:

| State | Required evidence | Action inside the first migration | Common postcondition |
|---|---|---|---|
| B — blank | No application/auth tables, views, routines or other unexpected objects in public; no previous application migration history | Create exactly the four canonical auth tables with explicit definitions | Four matching auth tables; no legacy application tables |
| E — existing empty legacy | Exactly the 11 listed public tables; exact approved schema manifest, zero rows in every table, no unexplained dependencies/history | Preserve four auth tables; remove exactly seven empty legacy tables in a reviewed dependency order | Same four auth tables and contract as B |

Both paths execute the **same migration file and hash**, and the normal migrator records its successful completion. Do not insert synthetic journal rows to pretend DDL ran; do not mark an auth-create migration applied by hand; do not maintain blank-target and legacy-target SQL directories. Later migrations are unconditional and identical on both paths.

The state-aware logic is bounded by exact positive assertions, not generic `IF NOT EXISTS`, catch-and-ignore duplicate errors, `CASCADE`, schema-wide drops or dynamic deletion of discovered objects. Proposed removal order: portfolioFiles, files, students, folders, announcements, events, activity_logs; the dependency manifest must prove that this named sequence is safe. An unexpected dependency aborts rather than expanding the deletion scope.

**Manifest requirement before generating/finalizing 0000:** Capture schema-qualified read-only catalogue evidence in a later authorized task: table/column names, types/typmods, nullable/default/identity attributes, PK/unique/FK/check definitions, index definitions, triggers/functions/views, RLS/policies, ownership/privileges and dependencies. Resolve names by namespace and OID, avoiding R3's identically named public/neon_auth lookup ambiguity. Define an approved canonical auth contract from current source plus this evidence; if they differ, report the exact discrepancy and obtain resolution before writing executable bootstrap logic. R3's summary is not sufficient to invent a complete physical fingerprint.

Canonical comparison can normalize OIDs, generated constraint names and environment-specific owner role names using an explicit reviewed mapping; it must never ignore semantic differences in types, nullability, defaults, FK actions, uniqueness, RLS or privileges. The blank path creates the same semantic contract that the existing path validates. Unexpected extra auth indexes or differing timestamp defaults are surfaced, not silently accepted. Any required normalization must become an explicit reviewed statement in the same migration, or execution remains blocked.

Migration 0000 then adds the same explicitly named secondary auth indexes on both paths: session(userId), session(expiresAt), account(userId), verification(identifier), verification(expiresAt). Preflight proves these new index names/definitions are absent from the two accepted starting states. Existing PK/email/token indexes remain. These are compatible access-path additions, not adapter model changes; both paths must produce identical index manifests. No provider/account composite unique constraint is introduced.

### A3. Execution mechanics, repeatability and failure behavior

Future guarded execution must:

1. Require explicit target identity, migration artifact digest and approved expected starting state, with a dedicated process-scoped connection supplied through approved secret handling. Do not load `.env.local` or fall back to the current application's URL. SQL database name `neondb` alone cannot distinguish branches.
2. Perform read-only preflight before allowing even migration-ledger initialization. Require exclusive maintenance use of the fresh branch, no app writers and only the authorized migration principal able to execute DDL. Acquire a connection-scoped advisory migration lock on a pinned connection for the full run. For E, lock all 11 tables and repeat actual zero counts and manifest checks inside 0000's transaction to close the preflight/write race.
3. Validate existing ledger hashes and ordering against the checked-in new journal, including every applied entry. Reject unknown entries, gaps, changed hashes, partial table sets or a ledger from the old chain. A valid completed/prefix new history uses normal pending migration behavior; it does not re-run the B/E classification as if the database were uninitialized.
4. Run the installed PostgreSQL migrator with the explicit new directory and ledger namespace, proposed `schoolhub_migrations.__drizzle_migrations`. Exclude this approved infrastructure schema from business-state comparison. No `neon_auth` object, owner or privilege is changed, and absence of neon_auth on a local blank PostgreSQL test database is acceptable.
5. Verify the canonical public schema, ledger and unchanged provider boundary after execution. Final structural count is **25 public tables**; the migration ledger is outside public. There are no storage, announcement, event, assessment, result or reporting tables in that count.

**Installed implementation fact:** `node_modules/drizzle-orm/pg-core/dialect.js` creates its ledger schema/table before entering its transaction and runs all pending migrations plus ledger row insertions within one transaction. It selects pending migrations using the last recorded timestamp; that is not a complete historical checksum audit. The proposed wrapper must perform the stronger prefix/hash validation and hold the pinned advisory lock. Tests must verify the pinned-connection integration and failure behavior; do not claim the ordinary migrator already does those checks.

If pending migration SQL fails, its pending DDL/data/ledger entries roll back together. An empty infrastructure ledger/schema may remain because of initialization outside the transaction; recognize only that exact known infrastructure state for retry after revalidation. Never interpret a partial business schema as resumable success. A second invocation on a fully applied valid history performs no application DDL and no seed duplication. Previously applied prefixes may contain valid data; zero-row checks apply only to initial E adoption, never to normal subsequent upgrades.

No baseline is generated in R5A. The exact fingerprint, runner and transactional custom migration remain implementation deliverables with tests. An auth-only but unjournaled target, unknown public object, new row, changed contract or foreign migration ledger is a **third state: reject**, not another implicit migration path.

## B. First migration set

Names below are proposed review units, not files created by this task. Journal entries/snapshots must describe each actual post-migration state; custom 0000's canonical snapshot contains only its four auth tables. Generated snapshot IDs/timestamps come from the later approved toolchain. No legacy snapshot is copied as the starting state. Review each migration independently even if the installed runner applies several pending files in one transaction.

### B1. Common integrity contract

Use R4's UUID business PKs; text only for references to Better Auth user IDs. Tenant tables have non-null school_id FK and unique (school_id,id); all child-to-tenant FKs include school_id. Actor references use UUID audit_actors IDs. M tables inherit created/updated timestamps and actors, row_version and nullable archive timestamp. Actor bootstrap has no recursive creator FK. All default business deletion actions are RESTRICT, retaining history; existing auth session/account CASCADE actions remain unchanged.

Create indexes for every referencing FK unless an existing left-prefix index covers it. Add school/status/year/class/offering query indexes from R4. Enforce nonblank identifiers, enumerated statuses, positive versions/ordinals, valid date intervals and uniqueness explicitly. Academic intervals use half-open `[starts_on, ends_on)` semantics; null end is open-ended. Thus a transfer on date d closes the old placement at d and starts the new placement at d without overlap. Use this interpretation consistently for years/terms/admissions/enrolments/placements and document exclusive end dates in service validation. Role grants use half-open timestamp intervals. This is a concrete implementation convention for owner review, not a KNEC calendar rule.

Parent-child date containment and cross-row nonoverlap need guarded transactions and deferred constraint triggers, not cross-table CHECK expressions. Proposed initial strategy avoids extra extensions: all temporal writes acquire the relevant stable parent-row locks in a fixed order; deferred validators check complete post-transaction state. Parent date/grade/subject edits must validate existing children too. Teacher/role duplicate intervals serialize on staff/membership parents. Concurrent transactions cannot both pass an unlocked overlap query. Tests must prove this under the runtime isolation level before rollout.

### B2. Proposed sequence and recovery

| File | Purpose and exact tables affected | Constraints / FKs / indexes | Prerequisites | Rollback / recovery |
|---|---|---|---|---|
| `0000_auth_contract_and_empty_legacy_bootstrap.sql` | Converge B/E states; create or preserve user/session/account/verification, remove seven empty legacy tables only in E, add specified auth access indexes | Canonical text PKs, email/token uniqueness, original auth FKs/defaults/nullability; guarded schema/count/dependency assertions | Approved fingerprint, explicit B/E state, target/maintenance approval and original-state recovery artifact | Transaction failure restores pre-migration business state; ledger infrastructure caveat in A3. After commit, prefer correction or replacement isolated test target. Recreating the seven empty legacy tables requires the exact approved preflight schema artifact and separate recovery approval; no auth/provider drop. |
| `0001_identity_tenancy_audit.sql` | audit_actors, schools, roles, school_memberships, membership_roles, staff_profiles, audit_events (**7**) | Membership U(school,user); role U(code); actor U(actor_code), partial U(user_id); staff U(school,membership), U(school,staff_code); composite tenant FKs; temporal role checks; minimum audit append-only protections | 0000; decide finite membership/staff/status vocabulary and role grant authority; no app traffic until seed/service readiness | Roll back pending transaction. After commit and before data, replace disposable test target if approved; after grants/audit exist, forward-fix. Do not cascade auth users or delete audit trails. |
| `0002_academic_catalogues.sql` | academic_years, terms, grades, subject_catalogue, subject_grades (**5**) | U(school,year code); terms U(school,year,code/ordinal); catalogue U(curriculum_code,code); U(subject,grade); period containment/nonoverlap; curriculum agreement; FK indexes | 0001; date interval convention; catalogue stewardship policy | Transaction rollback; once referenced, forward correction/new catalogue version or inactive status. Never remove grades/subjects already referenced. |
| `0003_learners_and_placements.sql` | learners, learner_admissions, class_groups, learner_enrolments, class_placements (**5**) | Admission U(school,admission_number), at most one active admission per learner; enrolment U(school,learner,year); class U(school,year,grade,code); placement interval constraints and context FKs | 0002; one grade per learner/year, no midyear grade rewrite, admission/re-entry convention and transfer service contract below | Transaction rollback; after operational data, correct via audited closure/new placement, not erasure/reassignment of historical IDs. A mistaken draft without descendants can be removed under explicit domain policy. |
| `0004_subjects_and_allocations.sql` | school_subjects, subject_offerings, learner_subject_enrolments, teacher_assignments (**4**) | U(school,subject), U(school,local_code); U(school,class,school_subject); offering class/year/grade/subject composite keys; subject-grade eligibility FK; learner placement/offering context FKs; no overlapping duplicate enrolment/assignment intervals | 0003; class-based offerings; no elective groups; valid staffing, enrolments and subject eligibility | Transaction rollback; otherwise end allocations/enrolments and add new intervals through audited service. Preserve referenced historical rows; no bulk cascade. |
| `0005_foundation_system_seed.sql` | Deterministic rows only in audit_actors, roles, grades and audit_events | Fixed opaque service actor and role/grade IDs; enforce natural-key identity matches, create provenance events; no credentials, schools, users or learners | All structures/guards present; approved non-official internal grade namespace and role catalogue | Transaction rollback. Applied seed becomes immutable history; corrections use another versioned data migration. Do not delete referenced catalogue rows to rerun fixtures. |

0001 creates append-only audit_events with id, school_id nullable only for platform/bootstrap events, actor_id, optional membership_id, event_type, resource_type, optional opaque resource_id, command_id/sequence, occurred_at, origin and allowlisted safe_changes/reason. Retain R4's immutable creation metadata with actor identity consistency. Composite (school_id,membership_id) FK, U(command_id,sequence), and school/time, actor/time, school/resource indexes are mandatory. Native foundation events include membership/role grant/revoke, staff change, admission, enrolment, transfer, subject adoption and teacher allocation. Resource IDs are diagnostic references, never authorization. No assessment-specific event columns or audit export subsystem.

In 0001, audit actor `user_id` is nullable text with a partial unique index and RESTRICT FK to public.user; a service actor has no auth user. Human actors initially require a user. De-identification is a future restricted retention operation, not a general API. `schools` is the tenant root even though R4 labels it G for lack of school_id; it is not globally readable to arbitrary school users. School Admin may manage its permitted school metadata; global roles/grades/subject catalogues are operator-managed.

### B3. Concrete academic context enforcement

Use ordinary composite FKs wherever equality can be enforced relationally, with additional parent unique keys matching the referenced tuples:

- learner_admissions exposes (school_id,id,learner_id); enrolment binds its admission and learner together.
- class_groups and learner_enrolments expose (school_id,id,academic_year_id,grade_id). class_placements repeats year/grade and references both full tuples, preventing same-school wrong-grade/year placements.
- school_subjects exposes (school_id,id,subject_id). subject_offerings binds that tuple plus class year/grade; (subject_id,grade_id) references subject_grades. subject_grades validates equal catalogue curriculum namespaces.
- class_placements exposes (school_id,id,enrolment_id,class_group_id,academic_year_id,grade_id). learner_subject_enrolments binds placement/enrolment/class/year/grade and the offering's matching class/year/grade tuple. Same school alone is insufficient.
- teacher_assignments binds staff and offering in the same school. Current role/membership, active staff status and valid dates remain authorization requirements in addition to FKs.

Create deferred validators and lock protocols in the migration that introduces the affected relationship. Reject school-ID updates, enrolment learner/year/grade rewrites after creation, and class/offering context rewrites after enrolment or allocation; retire/create a new record instead. Tenant assignment is immutable. Restrict operations that could shorten parent validity below child dates.

Transfers lock school/learner/year enrolment, current placement, dependent subject enrolments and relevant offerings in deterministic order. One transaction closes old subject enrolments and placement, opens new placement, adds only explicitly selected eligible subject enrolments and writes audit. Preserve old IDs; do not carry elective subjects or teacher privileges forward by inference. Midyear grade changes return an explicit unsupported-domain error.

Recommended admission convention: each admission episode gets a unique school-local number; closed numbers are never assigned to another learner. A readmission may add another admission record for the same learner. Re-entry within an existing learner-year reuses that single annual enrolment and must remain compatible with its recorded admission/date boundaries; if a new admission episode would contradict that FK, reject it pending a separately reviewed re-entry enhancement. Do not silently replace the admission FK of historical enrolment. This limitation must be approved before 0003 implementation.

## C. Better Auth compatibility and ownership

### C1. Verified from installed code, not a database smoke test

Installed `better-auth` and `@better-auth/kysely-adapter` packages are **1.6.23**. `lib/auth.ts` supplies `database: pool`; `lib/db/index.ts` constructs a pg Pool. `node_modules/better-auth/dist/db/adapter-kysely.mjs` and `node_modules/@better-auth/kysely-adapter/dist/index.mjs` show that an object with connect selects the PostgreSQL/Kysely path. SchoolHub's Drizzle schema is not the auth adapter's model configuration. No organization/admin plugin, database rate-limit storage, custom model names or numeric/UUID ID-generation setting is configured.

`node_modules/@better-auth/core/dist/db/get-tables.mjs` defines user, session, account and verification with the expected camelCase fields. `node_modules/@better-auth/core/dist/db/adapter/get-id-field.mjs` uses string IDs unless serial mode is selected. `node_modules/better-auth/dist/db/get-migration.mjs` accepts PostgreSQL text for string fields and timestamp for date fields. These files were read only; no getMigrations, adapter bootstrap or database call was invoked.

| Proposed boundary | Static compatibility finding | Required runtime evidence |
|---|---|---|
| audit_actors.user_id -> public.user.id | Nullable **text -> text**, RESTRICT, unique when present; business actor PK remains UUID | Create actor for actual adapter-created user; reject nonexistent user; preserve actor on membership changes |
| school_memberships.user_id -> public.user.id | Non-null **text -> text**, RESTRICT; U(school_id,user_id) permits same user in multiple schools | Same login joins two schools; duplicate membership in one school fails; no role/access copied across schools |
| staff_profiles.membership_id | UUID -> UUID school_memberships, tenant composite FK; no dependency on an auth organization plugin | Staff profile cannot point to another school's membership |
| learners.login_membership_id | Nullable UUID tenant FK; optional unique mapping as R4 | Remains null in initial fixtures; no login feature or automatic email/name match |
| session/account userId | Existing text -> public.user.id CASCADE is retained | Sign-in/out/session revocation behavior unchanged; account/user cleanup with business refs produces controlled refusal rather than data loss |
| Auth timestamps and verification | Existing timestamp columns accepted as dates; verification createdAt/updatedAt are nullable in source while installed model marks them required and supplies defaults/update behavior | Verify new verification records have expected timestamps and expiry behavior; keep nullable DB contract unless separately approved change |

**Conclusion:** Proposed foundation FK types and identity separation are compatible at the inspected code-contract level. This is not a claim that live auth or the future migration has passed. The permissive verification-column difference is documented, not silently fixed. No installed schema requirement indicates a providerId/accountId composite unique constraint, so it is not added. Auth ID validation must accept the installed string format and must not UUID-validate user IDs.

### C2. Ownership and lifecycle boundaries

- **Better Auth logical ownership:** public.user, public.session, public.account, public.verification. Better Auth controls identity/credential/session semantics and row operations. The single SchoolHub migration history materializes and preserves that compatible DDL; a second Better Auth CLI migration history must not run against it.
- **SchoolHub ownership:** the 21 new foundation tables, centralized authorization/domain code, migration journal and catalogue seeds. Roles/memberships live here, never in public.user fields or inferred from email. Global login and per-school authorization remain separate.
- **Provider ownership:** all neon_auth objects, including its independent user/account/session tables. No application migration, FK, seed, schema grant/revoke or search-path routing targets that schema. Treat as provider-owned per D2, without claiming independent provider-account configuration verification.

Preserve `lib/auth.ts`, auth route behavior and public field names while establishing compatibility. Explicitly verify that the future auth connection resolves public tables and cannot accidentally select a user-named schema or neon_auth; runtime must not hold CREATE privileges on public. Any necessary search-path/auth-origin change requires a separate reviewed security change. Current wildcard/development origin behavior and reflected CORS must not be certified safe for real multi-school rollout merely because auth smoke tests pass.

School Admin has no permission to enumerate credentials, mutate auth accounts or delete a user's global login. Removing access to school A revokes/deactivates membership/roles there and preserves access to school B. Foundation RESTRICT FKs intentionally block hard deletion of a referenced auth user; handle that outcome through controlled account lifecycle procedures. Do not replace those FKs with CASCADE. No registration change or auth-table mutation was performed in R5A.

## D. Deterministic seed and bootstrap data

### D1. Required system seed — versioned, not an application fixture

0005 seeds only:

- One stable service audit actor, code `schoolhub-system-bootstrap`, kind service, user_id null. It has no password, session or application route access.
- School-scoped role codes `SCHOOL_ADMIN`, `TEACHER`, `MODERATOR`, with fixed IDs and policy version. Moderator is reserved for the approved future workflow and confers no foundation administrative or marking capability. No Super Admin, Learner or Guardian grants in this slice.
- Grade rows 10, 11, 12 with labels Grade 10/11/12 and an internal curriculum namespace `SCHOOLHUB_INTERNAL`. These are product grade labels, **not official KNEC identifiers**. No official subject catalogue rows, pathways, task rules or weights.
- Minimal system audit events for these seeds, attributed to the bootstrap actor with deterministic command IDs/sequences.

Use fixed checked-in UUID constants for system rows. Apply through the migration ledger; conflict with a different identity/meaning must fail, not silently update existing records. Future policy/catalogue changes use new reviewed data migrations. Catalogue references never grant tenant authorization.

### D2. Development fixtures — separate opt-in operation

Fixture commands are not migrations, never run at app startup, and require a confirmed disposable local/test target or separately approved R7 writes on schoolhub-fresh-dev. Restrict fixture execution to explicit target allowlists; domain records use stable UUID constants and natural codes. Auth users are created via Better Auth, resolving actual returned string IDs by fixture email on reruns. Do not force IDs/password hashes by raw inserts into auth tables or modify the auth ID generator for determinism.

| Fixture | Minimum deterministic content |
|---|---|
| Primary school | Code `DEV-SCHOOL-A`, name `SchoolHub Development School A`, timezone Africa/Nairobi; active; fixed school UUID |
| School Admin | `admin.a@example.test`, created through Better Auth with runtime-supplied test secret; audit actor, active school-A membership, SCHOOL_ADMIN grant and staff profile |
| Staff | `teacher.a@example.test` with active membership/TEACHER/staff profile and a dated assignment; `teacher.unassigned@example.test` with same school role but no allocation; no moderator marking features |
| Year/terms | Synthetic year `DEV-2026`, [2026-01-01,2027-01-01); term 1 [2026-01-01,2026-05-01), term 2 [2026-05-01,2026-09-01), term 3 [2026-09-01,2027-01-01). Explicitly test dates, not an official school/KNEC calendar. Use a fixed test clock. |
| Classes | Grade 10 groups `DEV-10-A` and `DEV-10-B`; compatible grade 11/12 groups only in regression fixtures |
| Learners | `Development Learner A1` and `A2`, school-local admissions `DEV-A-0001/0002`, no DOB/national IDs/photos/logins; annual grade-10 enrolments and initial placements in DEV-10-A |
| Subjects | Internal subject_catalogue codes `DEV_SUBJECT_A`, `DEV_SUBJECT_B` within SCHOOLHUB_INTERNAL; label clearly synthetic; grade-10 eligibility, school adoption and offerings for both class groups; one learner subject enrolment/assignment scenario and one wrong-subject negative case |
| Isolation suite extension | `DEV-SCHOOL-B`, separate admin/teacher/learners with parallel codes scoped to B; one existing auth user intentionally has independent memberships in A and B; suspended/left members and expired role/assignment fixtures |
| Transfer suite | Dated transfer on 2026-09-15 closes class-A and relevant subject intervals, opens class-B and selected new offerings, leaving prior IDs intact |

Passwords/secrets are injected only into disposable test execution, never checked in or printed. Fixed fixture **business** identities and outputs are deterministic; Better Auth generated IDs and secret hashes need not be bit-for-bit identical. Re-running resolves and verifies expected records, does not silently regrant revoked roles or reset passwords. Conflicting data aborts with a safe message.

Bootstrap order: auth account creation -> confirm server-recognized identity -> audit actor -> school/membership/role/staff in one authorized foundation transaction -> calendar/catalogue/learners/offerings -> allocations. Auth calls and business transactions are not falsely treated as one cross-adapter transaction. If business bootstrap fails after auth creation, the orphan login has **no school access**; a guarded retry reconciles by known fixture identity. Record the operator/service actor and target; expose no public first-admin endpoint. Staff/learner fixtures may be grouped into independent audited transactions for diagnosis.

## E. Authorization foundation and service boundaries

Proposed modules: `lib/authz/` for policy resolution, `lib/services/foundation/` for domain commands/queries, and `lib/db/foundation/` for persistence definitions. Names are a plan, not code additions. Current Server Actions/API routes become thin adapters only in separately approved transition commits. A service receives validated actor/school context and transaction state; it does not trust a serialized client context object.

| Boundary example (conceptual signature) | Required behavior |
|---|---|
| `requireSession(requestHeaders)` | Resolve Better Auth server session through the existing mechanism; reject missing/expired session. Return minimal string user ID; accept no caller-supplied user ID as identity. |
| `requireSchoolMembership(userId, requestedSchoolId)` | Resolve active school and membership by school_id plus user_id. Requested school is a selector, not a grant. Reject invited/suspended/left memberships and suspended schools; return trusted membership/actor context. Multi-school switching runs this check every time. |
| `requireRole(context, allowedRoles, now)` | Join that membership's unrevoked, currently effective school-scoped role grants. Deny missing/expired grants and roles belonging to another school. Do not infer permissions from staff existence or another membership. |
| `requireTeacherAssignment(context, offeringId, now)` | Require TEACHER, active staff profile, same-school offering and active dated staff allocation. Bind class/year/grade/subject through offering. An assignment is not a substitute for role or membership. |
| `requireLearnerScope(context, learnerId, offeringId?)` | Admin: same-school learner and permitted operation. Teacher: active authorized offering plus learner_subject_enrolment/placement/annual enrolment in the matching context. Return only the necessary learner fields, not all school records. |
| `requireObjectScope(context, kind, objectId)` | Load using school_id and id plus required parent joins; reject same-school mismatched academic contexts too. A generic object helper cannot grant an operation without its explicit domain policy. |

Conceptual admin enrolment flow: requireSession -> requireSchoolMembership -> requireRole(SCHOOL_ADMIN) -> validate learner/admission/year/grade/class within that school -> locked enrolment transaction -> append audit -> return minimal result. Conceptual teacher roster read: session -> membership -> Teacher role -> assignment to offering -> query roster via subject enrolment/placement joins, all school-scoped. These are service examples, not implementations or assessment routes.

Initial permissions: School Admin manages that school's members, school-role grants, staff, learners, calendar structure, classes, school-subject adoption, offerings and allocations. Global catalogue editing and initial school creation remain restricted operator tasks. Teacher reads only assigned contexts and necessary learners; no foundation-wide learner CRUD, role grants or calendar-structure mutation. MODERATOR has no standalone foundation administration rights. School Admin cannot elevate to a platform role or grant another school's membership.

Within mutation transactions, recheck membership/role/assignment validity with appropriate locking so revocation cannot race a previously authorized write. Use stable lock order, row_version for mutable edits, command IDs for audit deduplication and explicit conflict errors. Keep at least one active School Admin for an active school; serialize final-admin demotion/deactivation on the school row. Cross-school counts, search, dashboard summaries and batch results are filtered before pagination, not after fetching all records. No raw Drizzle action may bypass these boundaries after it is migrated.

Historical access is not granted by an expired allocation. Default teacher reads require current allocation; a learner's prior placement is visible only when the requested record is within the approved teaching context and policy. Do not expose all earlier/future learner records through one current offering. Learner login mapping remains dormant. RLS can be added later; foundation tests must pass with RLS absent because server-side membership/role/object enforcement is mandatory.

Runtime uses a non-owner restricted DB principal; a separate migration principal owns DDL. Give the application only the required table operations, protect immutable audit rows from UPDATE/DELETE and restrict operator/bootstrap catalogue writes. Schema ownership and grants require an explicit reviewed R6 script if not in the SQL files. These controls supplement, not replace, domain authorization. No RLS policies are introduced in this slice.

## F. Existing SchoolHub feature transition

**RECOMMENDATION: parallel deployment transition, not dual database queries in one request.** Preserve the current application deployment/code path and its current database/R2 configuration while building and testing the foundation in an isolated checkout/deployment with a separate target profile. Do not repoint the existing application's DATABASE_URL to the fresh foundation: its seven legacy tables will be absent after bootstrap.

The same repository can temporarily contain legacy source definitions as behavioral reference and a dedicated foundation entrypoint. That is a transition between deployments, not two authoritative histories for the new database. Never dual-write students/learners, copy legacy tables into the new history for convenience or silently route failed foundation queries to the old database. Foundation preview must not have usable R2 credentials or expose legacy actions; route gating must happen before legacy imports/queries and be tested at direct action/route entrypoints as well as navigation.

| Current feature | While foundation is introduced | Foundation-preview behavior / later transition |
|---|---|---|
| Dashboard | Existing deployment continues its current event/activity views | New authorized summary may show only foundation data; legacy widgets gated before querying. Later map new activity feed to tenant-scoped audit projection and integrate calendar/notices only after their own slice. |
| Portfolios | Existing students and portfolioFiles remain on current target | Foundation supports learner/admission/enrolment administration only. Portfolio uploads/downloads/evidence views disabled on preview, no compatibility file table. Later adopt R4 assets/evidence under separate approval. |
| Staff resources | Existing folder/file capability stays on existing deployment | Routes/actions disabled in foundation preview; preserve UI/source for later migration, no R2 API calls or placeholder assets. |
| Media | Existing deployment retains media listings/bulk-upload/download behavior | Disable all foundation preview media entrypoints including byte route and presign/bulk actions, not only menu links. Later implement secured assets. |
| Calendar | Existing events remain on existing deployment | Calendar feature deferred/gated in preview; academic years/terms are foundation administrative records, not replacement event tables. Later school-scoped events slice. |
| Announcements | Existing private notices remain on existing deployment | Deferred/gated in preview; later school-scoped ownership/visibility slice. Do not seed/migrate announcement rows now. |

This maintains access to current functionality on the old deployment while the new deployment is intentionally a foundation preview. It does **not** claim all features work on the fresh schema or that known legacy IDOR weaknesses are fixed by leaving the old app running. Keep the old app confined to its existing disposable development use; no new real-school rollout there. Complete feature transitions, required auth-origin/security changes and regression tests before approving a shared/production cutover. Cookie/origin isolation between preview and legacy must be designed and tested in the later deployment/security task; any required auth/config changes are outside R5A.

R2 and original database remain independent preserved boundaries. Removing zero-row file metadata from the fresh branch does not authorize touching nonempty original metadata, listing a bucket or deleting an object. No R2 inventory or migration is needed for local foundation tests; R2 safety/inventory remains a prerequisite to the later asset/cutover stage. Prefer mock storage that throws on any unexpected invocation in foundation tests.

## G. Required tests before foundation rollout

No tests are claimed executed by R5A. These are acceptance requirements for future implementation, first on explicitly authorized disposable local/CI databases, then approved fresh-target verification. R6 authorization for Neon is separate from consent to create local test fixtures.

| Area | Positive and negative assertions |
|---|---|
| Blank migration replay | Empty PostgreSQL 17 -> all six files -> 25 public tables and expected system rows; exact keys/indexes/checks/triggers/ledger; second run no-op; new schema generation reports no drift after custom baseline snapshot. |
| Existing-empty replay | Reproduce exact approved 11-table legacy manifest in disposable fixture DB, all empty -> same SQL/hash chain -> same 25-table canonical schema/system seed. Four auth tables preserve identity/contract; seven listed tables absent; provider sentinel schema unchanged. No manual ledger stamps. |
| Rejection and recovery | Nonzero row in any initial legacy/auth table; extra/missing table; changed auth type/default/nullability; unexpected dependency/index; foreign ledger; altered checksum; missing journal entry; auth-only unjournaled state all fail closed. Deliberate pending-migration failure rolls back business schema/seed and ledger rows; known empty ledger infrastructure is handled on retry. Simultaneous migration runs serialize. |
| Better Auth | Installed direct pg adapter: sign-up/sign-in/server session lookup/sign-out/expired or invalid session; password login/verification timestamps; non-UUID string user IDs; duplicate email/token behavior; no unintended organization/rate-limit tables or neon_auth writes. Referenced user deletion is rejected without deleting school history. |
| Tenant isolation | Same auth user active in A and B gets only explicitly permitted current-school data. A-only member cannot access B by changing URL/body/ID. Cross-school composite FK insert/update attempts fail, not only service reads. School suspension denies access. |
| Membership/roles | No membership, invited/left/suspended membership, missing/expired/revoked role, wrong-school grant and inactive staff fail. Teacher role alone cannot administer school. Last-admin removal fails safely under concurrent requests. Revocation between initial check and write prevents commit. |
| Teacher assignment | Assigned vs unassigned teacher; other class/subject/year; expired/future assignment; disabled offering; co-teachers; wrong-school staff; withdrawn learner subject enrolment. Same-school mismatches are rejected. |
| Learner/enrolment | Duplicate school admission number; admission belonging to another learner; two annual grades; repeated year across distinct years allowed; missing parents; FK school changes; dormant learner-login mapping cannot authorize self-service; unsupported midyear grade change rejected. |
| Class transfers | Valid atomic close/open with date boundary; no overlapping placements; failed replacement/subject selection rolls back everything including audit; concurrent transfer serialization; year/grade/class mismatch; parent interval shortened beneath children; old IDs/history retained. |
| Subjects/offerings | Catalogue eligibility pair; curriculum mismatch; school adoption; class/year/grade agreement; same-school wrong-subject ID; learner placement/offering mismatch; overlapping duplicate learner subject enrolments; staff/offering mismatch. |
| Audit/transactions | Successful domain command emits correct school/actor/membership/command; failed domain command has no committed success event; duplicates cannot repeat grants/transfers; no secrets; application cannot edit/delete audit rows; creator/updater actor matches trusted caller. |
| Feature isolation | Direct legacy route/action calls in foundation preview fail before any legacy SQL or R2 call. Original deployment regression suite continues against its own disposable fixture environment, not the actual old database. |

Engineering baseline proposal: use the existing npm/package-lock workflow, select/pin a supported Node runtime during the tooling commit, configure ESLint with TypeScript/Next rules and Vitest for unit/service/integration tests, and run PostgreSQL 17 as a disposable CI service. Pin versions only after compatibility review; no package installation occurs now. Add a small browser auth/foundation smoke suite when route implementation is ready. No broad snapshot tests that merely mirror schema declarations; assert integrity with actual invalid writes and concurrent operations.

Planned scripts: lint, typecheck with noEmit and incremental disabled, unit tests, integration/migration tests, and build. CI uses locked dependency installation, no real Neon/R2 secrets, explicit disposable target configuration and no automatic migration command in build/deploy. Unit checks can run without any database; integration jobs are unable to fall back to `.env.local`. Mock external storage and block external calls. Configure CI/branch protection as a later reviewed repository operation; workflow presence alone is not proof branch protection is active.

**Current facts:** package scripts only include dev/build/start/lint; no discovered test harness, ESLint configuration or GitHub Actions workflow. `next.config.mjs` sets ignoreBuildErrors=true. Tooling implementation must make typecheck an enforced gate and remove that bypass in a separately reviewable change; do not hide violations with ignored errors or broad lint exclusions. Full checks may require targeted legacy fixes, which must be reported/scoped rather than folded into this plan as completed work. Build can generate artifacts, so it was not run for this document-only task.

## H. Exact small-step implementation order

Every item below requires a later implementation authorization. Proposed commit boundaries are review units; nothing here has been committed, generated or executed.

1. **R5B engineering baseline only:** add lint/test/typecheck/CI configuration and explicit disposable-test target safeguards, using the current npm lockfile; address required baseline failures in small commits. No schema generation or Neon/R2 access in this first commit. Confirm Node/test dependencies in that authorized task.
2. **Contract evidence:** read-only target-specific manifest capture and provider identity confirmation; review canonical auth/legacy fingerprints, allowed role/status vocabulary, admission limitation, half-open intervals and privileges. This task must receive its own permitted connection context; do not use the existing app connection by default.
3. **Migration isolation/runner:** add the dedicated foundation schema entrypoint/config, exact-target guard, ledger checksum validation and pinned migration lock wrapper. Keep legacy definitions/history and auth config unchanged. Tests assert wrong-target refusal before any DDL. No app deployment switch.
4. **Auth/bootstrap artifact commit:** create/review 0000 and canonical snapshot plus B/E fixture tests; prove local convergence, rejection and rollback. Use only separately authorized disposable local/CI DB execution. Do not invoke Better Auth's migration CLI or the old Drizzle configuration.
5. **Identity/audit artifact commit:** add 0001, corresponding schema types/guards and focused tenant/FK/audit tests. The operator bootstrap path remains non-public. Runtime writes stay disabled until seeds/services are ready.
6. **Academic catalogue commit:** add 0002 with date/curriculum/uniqueness tests.
7. **Learner/placement commit:** add 0003 with full composite context and transfer concurrency tests.
8. **Offering/allocation commit:** add 0004 with same-school wrong-context and teacher allocation tests.
9. **System seed and fixture commit:** add 0005 and separate opt-in development fixture module. Validate deterministic reruns, no credentials in repository and all cross-school fixtures. Keep real auth untouched.
10. **Central services commit(s):** implement E's policies and transactional domain services, mutation audit and revocation/last-admin controls; prove them with negative integration tests. No existing action is declared migrated merely because a helper exists.
11. **Foundation-preview routing commit:** introduce explicitly gated delivery adapters and minimal foundation management surfaces consistent with existing UI patterns; block legacy/R2 entrypoints on preview. No general UI redesign or shared app cutover. Gate code may be prepared before migration, but preview cannot serve foundation routes against missing schema.
12. **R5 readiness review:** complete clean/existing-empty replay, auth and foundation tests on local/CI targets; verify final schema and file/hash allowlist, recovery evidence and drift-free generation; assemble exact R6 execution package. No Neon execution yet.
13. **R6, only after separate approval:** preflight then execute the exact reviewed new migration set on schoolhub-fresh-dev with specified privileges and system seed. Capture schema/ledger/provider-boundary evidence. Do not run fixtures/auth writes as an implied part of schema execution.
14. **R7/R8, separately scoped:** approve disposable auth/bootstrap fixture writes and foundation verification on fresh target, then approve isolated preview availability. Full R8 storage readiness remains pending until the deferred storage slice; do not claim it passed. Shared cutover remains R9 after feature/security parity.

This ordering deliberately produces one lineage in several reviewable migration files. Running all pending files transactionally at R6 does not require merging their implementation reviews into one giant commit. Later assessment/storage/reporting work appends to this same history only when separately designed/approved for implementation.

## I. R6 execution gate — exact approval package

R4 architecture approval and R5A planning approval are not R6 execution permission. Before **any migration/schema execution on schoolhub-fresh-dev**, the owner must approve a concrete package containing all of the following:

1. **Target:** provider-confirmed project broad-field-23876929, exact branch ID for schoolhub-fresh-dev, development-only classification, neondb, dedicated connection/principal and maintenance window; explicit exclusion of main/current/shared targets. Secret delivery is outside version control/logs.
2. **Starting state and baseline contract:** freshly captured schema-qualified manifest and zero-row evidence for E, exact canonical auth contract/fingerprint, allowed infrastructure ledger state and fail-closed unknown-state rules. Approve the custom two-state 0000 behavior, not an inferred blanket reset.
3. **Precise removal scope:** named removal of only empty public.folders, files, portfolioFiles, students, announcements, events and activity_logs on this fresh branch, with dependency checks and no CASCADE. Explicitly preserve four public auth tables and all neon_auth objects. Confirm original metadata/R2 is untouched; a new row or dependency cancels execution for renewed review.
4. **Exact artifacts:** reviewed commit and SQL/journal/snapshot hashes for 0000–0005, runner/config/ledger namespace, expected 25-table postcondition, all FK/index/check/trigger and privilege statements. No wildcard future-migration approval; artifact changes require a new review.
5. **Compatibility exceptions resolved:** static-to-live auth manifest reconciliation, recorded nullable verification timestamps, text user IDs, approved new auth indexes, no plugin or credential model changes. Any needed auth contract alteration must be explicitly approved rather than hidden in convergence logic.
6. **Engineering/test evidence:** lint/typecheck/build and relevant tests green; blank vs E replay equivalence, migration failure/retry/concurrency and ledger checksum tests; auth compatibility and tenant/context/temporal negative tests from G on disposable local/CI databases. No unresolved failure waived by a successful build alone.
7. **Privilege/operational boundary:** migration vs runtime principals, search-path resolution, target lock strategy, no app writers, append-only audit protection and default-deny service boundaries. Approve exact role/grant operations if required; no provider schema grants/revokes. RLS absence is explicit and not an authorization exception.
8. **Recovery:** pre-execution schema/ledger/privilege evidence stored safely, verified recovery procedure on an isolated test database, named operator and stop criteria. Distinguish transactional rollback from a committed-state restore; no automatic branch reset/PITR touching neon_auth. After commit, use reviewed forward repair or a separately approved isolated replacement/restore. No current-target or R2 disposal.
9. **Seed and write limits:** approve fixed service actor, three role codes, internal grade rows and system audit rows in 0005. Explicitly exclude test schools/users/staff/learners and all auth sign-up/session writes unless the owner separately includes an R7 verification scope. No KNEC subject/policy data.
10. **Deployment boundary:** execution enables only a foundation database; old application remains on old target, fresh preview's legacy/R2 features are gated, no `.env.local` change, automatic deploy migration, shared cutover or real-school rollout. Any later preview connection/config or auth-origin work has its own reviewed scope.

A gate fails if the exact branch cannot be proved, state has drifted, removal is not approved, replay is unequal, any ledger/hash is unknown, auth compatibility fails or recovery is unverified. Stop and report the concrete mismatch; do not improvise a cleanup or broaden approval. Deferrals of official KNEC, evidence, guardian access and reporting **do not block this foundation slice** when their tables/routes remain excluded as specified.

## Completion and next executable step

R5A has produced the foundation scope, complete 11-table disposition, one convergent history design, six proposed migration review units, installed-adapter compatibility findings, seeds/fixtures, centralized authorization boundaries, deployment transition, tests, implementation order and R6 approval package. No database connection/mutation, SQL/migration generation, package installation, source/auth/config/environment edit, R2 operation or implementation was performed. R4 approval is recorded here without rewriting the approved R4 artifact.

Document verification completed: all sections A–I present; all 11 existing tables classified; all 21 foundation tables covered across six migration review units; internal document links resolve. Worktree status preserves the pre-existing changes, and the only write performed in this task was creation/update of this document. Runtime/typecheck/lint/build/integration verification remains future work; a planning PASS is not a test or deployment PASS.

**R5A STATUS: PASS — foundation implementation plan complete.**

**Exact next executable step, not executed:** obtain a scoped R5B implementation instruction and carry out H1: the repository-only engineering-baseline commit establishing lint, typecheck, tests, CI and disposable-target safeguards. That scope may authorize the necessary package/source tooling changes, but must continue to exclude schema generation, Neon execution, Better Auth configuration changes and R2 operations. Follow with H2's read-only manifest/target confirmation before finalizing the bootstrap migration. No R6 action is authorized by this document.
