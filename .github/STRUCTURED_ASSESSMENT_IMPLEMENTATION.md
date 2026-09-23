# Structured assessment definition and opening

Implementation date: 2026-09-20. Final verification: 2026-09-21. Owner-authorized scope: Subject Workspace → Assessments → structured definition → scoring guide → Open. Status: implemented and implementer-verified. Independent review, human acceptance, production readiness and official KNEC compliance are not claimed.

## Domain and migration decisions

The existing assessment/type/task model is extended, not replaced. `0007_structured_assessments.sql` is a generated additive schema migration; `0008_structured_guards.sql` supplies cross-row integrity, deferred ordering, aggregate revision and open-definition locking. Historical migrations 0000–0006 remain untouched. The upgrade review checks their SHA-256 ledger entries and compares existing task rows byte-for-byte before/after, inside a rolled-back transaction. Existing assessments default to internal structured drafts, retaining their tasks, dates and UUIDs. No criteria or default scoring rules are fabricated.

New tenant-scoped entities: `assessment_criteria` belongs to one task; `assessment_indicators` belongs to one criterion; `assessment_levels` belongs to one assessment. Composite school/parent foreign keys prevent cross-school relationships, with restrictive deletion. Ordinals are bounded to 1–100 per parent, unique and contiguous. Retained children preserve IDs and creation provenance; submitted IDs must already belong to their claimed parent. Draft removals explicitly delete nested definitions in dependency order. Future learner references will require an approved correction/deletion lifecycle.

Each indicator awards a nonnegative exact number with at most two decimal places. API/UI values are decimal strings; PostgreSQL stores integer hundredths (`score_units`, `lower_units`, `upper_units`). Arithmetic sums exact bounded integers, not binary floating-point score values. Individual scores and scale bounds are limited to 999999.99. One indicator is intended per criterion; equivalent duplicate values such as 1 and 1.00 are rejected. Criterion maximum is its largest indicator value; task/assessment maxima are sums, calculated in server domain logic. No redundant maximum columns or learner totals are stored.

Performance interpretation is optional. Teachers supply all descriptors, optional text/numeric codes, ordering and boundaries. Ranges are inclusive on a hundredth grid, must cover zero through the derived maximum, and cannot overlap or leave gaps. For example, 0–4.00 is followed by 4.01–8.00. Array order controls display; boundaries determine interpretation independently. An empty scale means no interpretation is configured. A configured scale must be valid at draft save as well as opening. This deliberately favors a valid saved scale over persisting contradictory ranges. No universal KNEC/EE/ME/AE/BE values are installed.

Origin is internal or external; external definitions require an authority name and may include a reference. These are descriptive metadata, not claims of official integration. Mode is explicitly structured in this release. A later forward migration can add simple mode and its maximum field without fake tasks or criteria: the base assessment can already exist without children. Simple authoring/results and Close/Archive are not enabled or represented as available actions.

## Lifecycle, authorization and audit

Only draft → open is implemented. Drafts may be incomplete. Opening revalidates academic context/type availability, current offering authorization, complete tasks/criteria/indicators, ordering, exact scoring, positive maximum, optional scale and expected aggregate revision. Opening adds actor/time metadata and `assessment.opened` audit in one SERIALIZABLE transaction. No learner participation/results are created.

The foundation service exposes its existing offering authorization SQL for use inside the same verified school transaction. Teachers require active membership/role, current staff and assignment, an active offering/class/subject, and an active current school-local academic year. Both old and proposed offerings are authorized during edits; teachers cannot move definitions between offerings. School Admin retains school-wide management, including teacher-created drafts. Mixed-role users retain admin authority in assessment commands; My Teaching still lists actual assignments only. Type configuration and `/admin/assessments` remain admin-only. URL/context claims never authorize a write.

All definition mutations advance the existing parent revision. Child ordering is deferred until transaction completion. Stale save/open requests return a controlled conflict. PostgreSQL guards independently block changes/deletions to opened parents and their task/criterion/indicator/scale descendants, and reject incomplete open structure. There is no normal reopen/correction route. Audit failures roll back structure and lifecycle writes. Safe audit data records parent/version, task changes, scoring child identities/order and level identities without teacher-authored text. Opening records the derived maximum in hundredths.

## UI and files

`/academics?school=…&offering=…&view=assessments&draft=…` extends the existing Overview/Learners workspace. The real offering list, shared `AssessmentPlanning` component and actions preserve teacher context without asking teachers to reselect school/class/subject. Admin uses the same editor and domain model. `scoring-guide-editor.tsx` provides nested criteria/indicators and optional performance ranges, explicit labels, native input validation, keyboard up/down buttons and destructive confirmations. Server errors remain authoritative. Opening requires confirmation, explains locking, and is disabled until pending form changes are saved. Open definitions render disabled controls and no opening action; their saved server-derived maximum is visible.

Implementation files: `lib/db/schema.ts`; forward SQL/snapshots/journal; `lib/domain/{foundation,assessments,scoring-guide,scoring-persistence}.ts`; `app/actions/assessments.ts`; `app/academics/page.tsx`; `app/admin/assessments/page.tsx`; `components/{assessment-planning,scoring-guide-editor}.tsx`.

Verification files: scoring unit tests, assessment action/authorization tests, structured integration/browser runners, existing assessment/teaching browser and assessment integration updates, `scripts/db-common.mjs`, `scripts/db-verify.mjs`, `package.json`, and test documentation. Existing uncommitted CBE shell work is preserved.

## Final verification results — 2026-09-21

The resumed task performed verification only. No product functionality, authorization policy, database guard, timeout or assertion was weakened or changed. Completed September 20 regression outputs were recovered and retained where the tested implementation was unchanged; interrupted checks were rerun. The latest outcomes below supersede the interrupted attempts, not their history.

| Check | Final outcome | Evidence and coverage |
| --- | --- | --- |
| `npm.cmd run db:verify` | PASS, September 21 | 33 public tables, 397 columns, 115 FKs; expected schema/constraints/indexes/assessment triggers verified; zero unvalidated constraints and zero unindexed FKs; nine matching migration hashes. |
| Separate ledger and database-state verification | PASS, September 21 | Every file hash and journal timestamp matches exactly one ledger row; pre/post-browser inventories and fingerprints linked below. |
| `npm.cmd run test:assessments:structured` | PASS: 19 checks, September 21 | Assigned/unassigned teachers, real foreign-school offering, forged child IDs, mixed roles, admin editing, stable ordering, exact scores/maxima, generic origin, scale guards, stale opening, incomplete opening, audit rollback and database-enforced open locking. All mutations rolled back. |
| `npm.cmd run test:assessments` | PASS: 158 checks, completed September 20 run | Legacy draft planning, task identity/provenance, dates, Unicode whitespace, school boundaries, stale saves, type management and audit rollback. The prior 160-test count changes because two blanket teacher-write-denial cases are superseded by assigned-teacher authorization coverage. |
| `npm.cmd run test:integration` | PASS: 59 checks, completed September 20 run | Foundation/assignment/roster authorization, actual foreign-school and same-school unassigned offerings, mixed roles, revoked/expired access and audit rollback. |
| `npm.cmd run test:admin` | PASS: 57 checks, recovered completed output | Academic administration, role denial, assignment/class history, validation and transactional audit; rollback verified. |
| `npm.cmd run test:files` | PASS: 23 checks, recovered completed output | Existing teacher/admin/foreign-school file permissions, failure handling and retained portfolio history. Database changes rolled back; object storage was an in-memory adapter. |
| `npm.cmd run test:lifecycle` | PASS: 41 checks, September 21 rerun | Existing learner-lifecycle regression only; all fixtures rolled back. No new learner functionality. |
| `npm.cmd run test:concurrency` | PASS, recovered completed output | Competing overlapping term transactions cannot both commit. Assessment save concurrency was separately verified in the legacy browser runner. |
| `npm.cmd run test:teaching:browser` | PASS, September 21 | Home, My Teaching, offering tabs, exact authorized roster, refresh, 390px layout, focus/Tab/Escape, forged contexts, denied admin drafts and unchanged Private Files permissions. |
| `npm.cmd run test:admin:browser` | PASS, September 21 | Six administration tabs, lifecycle controls/history, invalid action/rollover validation, mobile layout and assessment setup reachability. |
| `npm.cmd run test:assessments:browser -- --retain-test-evidence` | PASS, September 21 | Actual admin create/reload/edit/add/remove/reorder, stable task IDs, stale save, teacher/moderator/anonymous/foreign-school denial, and two real competing saves producing one commit and one controlled conflict. |
| `npm.cmd run test:assessments:structured:browser -- --retain-test-evidence` | PASS, September 21 final rerun | Teacher → My Teaching → authorized offering → Assessments → New assessment → task/criterion/indicators and exact fractional scores → performance scale → save → refresh/persistence → confirm Open → locked controls → locked refresh. Also keyboard indicator reorder, 390px layout and forged/cross-school assessment URL denial. |
| `npm.cmd run typecheck` | PASS, September 21 | Final product code. |
| `npm.cmd test` | PASS: 130 tests in 15 files, September 21 | Default unit/action/authorization suite. |
| `npm.cmd run lint` | PASS, September 21 | Zero errors; nine pre-existing unused-variable/import warnings. Rerun after the final browser-harness corrections. |
| `npm.cmd run build` | PASS, September 21 | Final production build; browser journeys use this build. Subsequent edits are verification scripts/evidence/documentation only. |
| `git diff --check` and historical migration comparison | PASS | Historical SQL 0000–0006 also compared byte-for-byte with `git show HEAD:<path>`; all seven are unchanged. |

### Interrupted and corrected attempts

Earlier database verification, expanded structured integration and lifecycle runs experienced connection termination, ECONNRESET or query-read timeout. Those attempts are **INCOMPLETE due to infrastructure/connection problems**, never passes. The earlier teaching-browser `fetch failed` attempt is likewise incomplete. The initial rollback-only upgrade review did finish successfully with 14 checks and preserved existing task rows byte-for-byte; the later expanded final suite passed all 19 checks. No migration was reapplied, reset or reseeded during the verification-only resumption.

The first structured browser attempt **FAILED** its keyboard-reorder check before any draft save. Investigation reproduced the harness defect on an isolated native HTML button: CDP Enter without its character generated zero clicks, while the complete Enter key event generated one. The runner now includes the character, verifies focus, waits for submitted React state and captures failure diagnostics. Product code and assertions are unchanged. One subsequent attempt was **INCOMPLETE** at login with HTTP 429 after the adjacent browser suites; the authentication rate limit was left intact and its existing window was allowed to expire. The complete final rerun passed. No unresolved FAIL or INCOMPLETE verification remains.

Screenshots from this run use the new evidence directory so historical shell/hardening screenshots are preserved. Visual inspection confirmed the nested scoring editor fits at 390px and the keyboard reorder control has visible focus. See [mobile scoring editor](verification/structured-assessments/teacher-authoring-mobile.png), [opened offering workspace](verification/structured-assessments/teacher-open-mobile.png), [legacy admin editor](verification/structured-assessments/legacy-admin-mobile.png), and [teacher shell evidence](verification/structured-assessments/teaching-shell/teacher-learners-mobile.png). The blank failure screenshot/JSON in this directory belongs to the throttled pre-login attempt, not the passing journey.

### Final database and storage state

The pinned development database remains on nine migration entries, each applied exactly once. No unexpected schema drift was found under the repository verifier's schema, column, FK/index, constraint and trigger checks. All expected assessment guards are enabled with their required deferrability. Public constraints comprise 99 checks, 115 foreign keys, 33 primary keys, 62 unique constraints and 26 constraint triggers; none are unvalidated. The nine provider-owned tables were left untouched.

| Migration | SHA-256 |
| --- | --- |
| `0007_structured_assessments` | `b1889091c9e320ea909ed4f80fff9bc41f341972030afd082a3d5d661bea8102` |
| `0008_structured_guards` | `17a5faf58ce62b75ec7e16f10d9eadd61a27e292cfa8890a9fd64d8f0481637b` |

All nine hashes and inventories are captured in the [pre-browser state](verification/structured-assessments/db-before-browser.json) and [final state](verification/structured-assessments/db-final.json). Final totals: six assessments (five draft, one open), ten tasks, one criterion, two indicators, one performance level and 49 audit events. The passing browser runners retained two synthetic definitions, three tasks and eight audit events under the established append-only evidence convention. Database integration fixtures were rolled back.

There are no learner-result/participation/observation tables or records introduced by this slice. Five learners, four media assets and two media folders remain; full-row learner/media fingerprints match before and after browser verification. No R2 write/delete operations were performed by these verification journeys; storage failure tests used memory only. This is not a separate live bucket inventory audit.

Remaining tooling warnings: nine existing ESLint warnings, Node's module-type warning and PostgreSQL SSL-mode alias warning. Verification used installed Node v26.8.1, not a fresh run on the repository-recommended Node 24. The temporary production server is stopped after verification. No commit, push or deployment was performed; all pre-existing uncommitted shell/assessment work is preserved.

## Limits and stop boundary

This is not production deployment or official assessment compliance verification. Exact scores are limited to hundredths; arbitrary higher precision is unsupported and rejected. Per-parent counts are bounded; large nested definitions and offering lists still need future pagination/query optimization. Comprehensive accessibility certification and independent review are not claimed. The existing append-only audit/browser convention retains synthetic browser definitions and audit evidence, while database integration fixtures roll back. No existing academic data or R2 objects are reset or removed.

Intentionally deferred: learner participation/roster assessment, observations, results/totals/descriptors, absent/exempt states, feedback, evidence/portfolio links, Save & Next, progress, curriculum catalogs, KNEC integration/submission, DOS/principal reporting, learner self-service, Close and Archive. Stop at Open; do not automatically implement the next planned learner-scoring slice.

## Guided teacher preparation follow-up (2026-09-22)

The teacher list and definition editor now use the dedicated four-step journey described in [GUIDED_ASSESSMENT_IMPLEMENTATION.md](GUIDED_ASSESSMENT_IMPLEMENTATION.md). That record contains current verification results and limitations; historical passing executions above do not substitute for rerunning the changed journey. Domain scoring, lifecycle, authorization, revisions, audits, and applied migrations are unchanged by this follow-up.
