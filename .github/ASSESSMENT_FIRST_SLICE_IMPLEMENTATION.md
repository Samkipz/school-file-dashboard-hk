# Assessment draft planning implementation

September 16 follow-up: the owner supplied independent **PASS WITH CONCERNS** findings about whitespace-only database checks and administration audit-test isolation. The original record below is historical. Repairs and stable-task-identity hardening are tracked separately in [the hardening record](ASSESSMENT_DRAFT_HARDENING.md); its current behavior supersedes the task-replacement limitation below. A referenced-task deletion/correction lifecycle requires owner approval before dependent records are implemented.

Implemented 2026-09-14; implementer verification completed 2026-09-15 after an automatic approval usage-limit interruption. Independent fresh-session verification and human acceptance are pending. This record covers only School Admin draft planning. Implementation and verification changes remain local/uncommitted.

## Delivered contract

- Three school-scoped tables: `assessment_types`, `assessments`, `assessment_tasks`. UUID identities, restrictive references, creation/update actors and timestamps, positive row versions, and existing lifecycle column conventions. No grade-specific schema or branches.
- Types are school configuration, not an enum or curriculum formula. Admin can explicitly add the five specification types (`PROJECT`, `PRACTICAL`, `PERFORMANCE_TASK`, `WRITTEN_TEST`, `CLASSROOM_ASSESSMENT`), add custom types, rename/change codes, and disable selection. Initialization is idempotent and audited; it never runs during reads or migration. Codes match `[A-Z][A-Z0-9_]{0,63}`; names are nonblank, at most 160 characters. Referenced disabled types remain visible on historical drafts; saving requires an enabled type.
- Assessment titles and task titles are nonblank, at most 160 characters. Optional instructions are at most 4,000 characters. Drafts may contain 0–100 tasks. Ordinals are unique, contiguous and start at 1, enforced at commit; the 100-task ceiling follows from bounded unique ordinals. These are technical limits, not official task counts.
- `starts_on` and `due_on` are optional on assessments and tasks. When both exist, start must not follow due. Supplied dates fit the offering's academic year. The optional term belongs to that same year, but dates may span terms. There is no task-within-assessment-date restriction. This is the owner's approved first-slice technical rule, not an official SBA policy.
- The offering supplies the academic year; callers cannot independently choose the year/grade/subject. Active, unarchived offerings/classes, enabled school subjects, and unarchived draft/active years are eligible for planning. Reads retain existing admin historical visibility; a closed context must be changed to an eligible offering before saving.
- Only `draft` is accepted by the database status constraint. No release, learner attempt, evidence link, scoring, rubric, moderation, finalization, publication or reporting operation exists.

## Application, authorization and concurrency

`lib/domain/assessments.ts` composes the existing `foundationService.inSchool` transaction and authorization boundary. Every read, individual lookup, type command and draft command requires an effective School Admin grant in the requested school. Better Auth identity is supplied only by `lib/domain/server.ts`. Teachers, including assigned teachers, moderator-only callers, anonymous callers and unauthorized memberships gain no draft access.

`/admin/assessments` uses the existing AppLayout and navigation. It provides school selection, draft list/detail/create/edit, ordered task add/remove/move controls, optional date/term inputs, and expandable type configuration. Server Actions bound payloads and return controlled errors; page gating is not the mutation authorization boundary. Forms use explicit submit buttons and preserve an opened version until save/reload.

Draft/task changes and one safe aggregate audit event share a SERIALIZABLE transaction. Events record field names, offering/term IDs, task count and resulting version; they omit titles/instructions and request bodies. Type changes are likewise audited transactionally. Audit insertion failure rolls back all associated writes.

Every draft save requires the opened `row_version` on edits. Existing provenance guards increment versions. Task INSERT/UPDATE/DELETE also advances the parent assessment version, so direct task changes invalidate old forms. Versions are monotonic revision tokens, not user-visible edit counts. Serialization/deadlock failures become controlled conflicts without automatic overwrite/retry.

Task definitions are atomically replaced on draft save, producing new task IDs even for unchanged definitions. No attempts/evidence reference tasks in this slice. The safe audit event retains mutation provenance/counts, not complete old task text. Before adding dependent records, replace this draft-only replacement strategy with stable task identity and reviewed correction rules.

## Migration review and preservation

Preflight read-only verification passed against the already pinned `schoolhub-fresh-dev`: 27 public tables, 311 columns, 89 foreign keys, three matching migration hashes, zero unvalidated constraints and zero unindexed FKs. No new provider control-plane branch identity assertion was performed.

- `0003_assessment_drafts.sql` was generated from authoritative `lib/db/schema.ts`. It adds the three tables, 42 columns, 13 foreign keys, indexes/checks and two parent unique keys: `offering_year_context_unique` and `term_year_context_unique`. Review moved the two generated parent-key statements before their referencing FKs; Drizzle initially emitted them afterward. No definitions were altered by that ordering correction.
- `0004_assessment_draft_guards.sql` is a Drizzle-created custom forward migration. PostgreSQL triggers implement cross-row year containment (including parent-year edits), contiguous ordering, existing actor/provenance guards and aggregate task revision. These triggers are outside Drizzle's schema representation. An initial rollback review caught a constraint-trigger/check naming collision; it was corrected before application.
- Rollback-only incremental replay of both migrations and all 54 assessment integration checks passed. The review rolled back its DDL, fixtures and audit events.
- `node scripts/db-migrate.mjs` then committed both migrations. Original `0000`–`0002` SQL files remain unchanged. Regeneration reports no schema changes. Post-commit `db:verify` passed: 30 tables, 353 columns, 102 foreign keys, five matching migrations, no invalid constraints or unindexed FKs. Nine provider tables are present; their content was not compared byte-for-byte.
- No reset, reseed, table rebuild, baseline migration rewrite or R2 mutation was performed. The migration adds no type/data fixtures. The migration transaction rolls back on failure. After deployment, repair forward and preserve rows/history; disabling the new routes is the application rollback. Do not drop populated tables or remove ledger entries.

## Verification evidence

Captured command output lives in [verification/assessment-drafts](verification/assessment-drafts/). Commands used `npm.cmd` on Windows. September 14 database regressions completed while the final engineering command was blocked by automatic approval review's account usage limit. The owner resumed work September 15; final engineering/browser verification then completed.

| Command / check | Observed result | Evidence |
| --- | --- | --- |
| `node scripts/assessment-integration.mjs --review-migration` (September 14, before application) | PASS, 54 checks; incremental migration DDL and all fixtures rolled back | [migration review](verification/assessment-drafts/migration-review.txt) |
| `node scripts/db-migrate.mjs` | PASS; both additive migrations committed | [migration](verification/assessment-drafts/migrate.txt) |
| `npm.cmd run db:generate` | PASS; no schema changes | [drift](verification/assessment-drafts/drift.txt) |
| `node scripts/assessment-integration.mjs` | PASS, 54 checks against applied tables; fixtures rolled back | [assessment](verification/assessment-drafts/assessment-integration.txt) |
| `node scripts/db-integration.mjs` | PASS, 51 foundation/authorization checks; fixtures rolled back | [foundation](verification/assessment-drafts/db-integration.txt) |
| `node scripts/admin-integration.mjs` | PASS, 57 checks; fixtures rolled back | [administration](verification/assessment-drafts/admin-integration.txt) |
| `node scripts/lifecycle-integration.mjs` | PASS, 41 checks; fixtures rolled back | [lifecycle](verification/assessment-drafts/lifecycle-integration.txt) |
| `node scripts/files-integration.mjs` | PASS, 23 checks; database rollback and in-memory storage | [files](verification/assessment-drafts/files-integration.txt) |
| `node scripts/db-concurrency.mjs` | PASS; overlapping temporal transactions cannot both commit; temporary year/terms removed by existing runner | [concurrency](verification/assessment-drafts/db-concurrency.txt) |
| `npm.cmd run typecheck` (final September 15) | PASS | [typecheck](verification/assessment-drafts/typecheck.txt) |
| `npm.cmd run test` (final September 15) | PASS, 89 tests across 12 files | [tests](verification/assessment-drafts/test.txt) |
| `npm.cmd run lint` (final September 15) | PASS, zero errors, 11 existing warnings | [lint](verification/assessment-drafts/lint.txt) |
| `npm.cmd run build` (network enabled, final September 15) | PASS; production assessment route generated | [build](verification/assessment-drafts/build.txt) |
| `node scripts/assessment-browser-smoke.mjs --retain-test-evidence` | PASS on final run; real production forms/actions, stale edit, competing transactions, denied pages and mobile controls | [browser](verification/assessment-drafts/browser.txt), [mobile screenshot](verification/assessment-drafts/mobile.png) |
| `node scripts/auth-smoke.mjs` | All auth assertions PASS, including corrected private-media invalid-input assertion | [auth](verification/assessment-drafts/auth-smoke.txt) |
| `node scripts/admin-smoke.mjs` | All HTTP/page assertions PASS | [admin HTTP](verification/assessment-drafts/admin-smoke.txt) |
| `node scripts/admin-browser-smoke.mjs` | All six tabs, lifecycle/rollover validation, real action and mobile assertions PASS | [admin browser](verification/assessment-drafts/admin-browser-smoke.txt) |
| `node scripts/files-http-smoke.mjs` | PASS, confirmed native exit 0; existing retained PDF bytes match for admin/teacher; moderator/anonymous denied | [file HTTP](verification/assessment-drafts/files-http-smoke.txt) |
| `node scripts/db-verify.mjs` (final September 15) | PASS, 30 tables / 353 columns / 102 FKs / five matching migrations; seven assessment triggers enabled with expected deferred settings | [schema](verification/assessment-drafts/db-verify.txt) |
| Read-only final record/count inspection | PASS; exact retained rows below | [final database](verification/assessment-drafts/final-database.txt) |

The final engineering run followed the last application edit: payload validation allows JSON escaping at documented task/field limits and rejects NUL text. Later changes were runner hydration checks, verifier trigger assertions and documentation; the final lint includes those runner/verifier edits. There was no subsequent application-code change requiring another build.

The first browser run timed out waiting for title edit/reordering. Database inspection showed reordered tasks and a committed revision, but the original title: the runner had entered the title before React attached its input handlers after reload. The runner now waits for hydrated inputs and confirms hidden form payload state after each field entry. The successful rerun verified the title edit and task order through real actions. [First-run output](verification/assessment-drafts/browser-first-run.txt) is retained and is not labeled a passing test. No application code was changed for this runner timing fix.

All September 15 browser/HTTP checks targeted the final production build at `http://localhost:3001`, with a matching process-local `BETTER_AUTH_URL`. The temporary server was stopped afterward. No environment file was edited. Login uses actual Better Auth HTTP sessions installed into Chrome; the login form itself is not automated. The 390px screenshot was inspected, and document/control widths were asserted; this is not a comprehensive accessibility/responsive audit. The browser stale case creates a newer version through the real service, then submits the old form through its actual action. The competing-transaction case runs two real SERIALIZABLE service transactions and observes one commit and one controlled conflict.

The first combined HTTP wrapper reported a nonzero PowerShell exit after all smoke assertions printed PASS. The file HTTP check was rerun independently and explicitly recorded native exit 0; the original wrapper status is not presented as a successful exit. Existing Node module/pg SSL warnings remain visible in the captured logs.

## Retained evidence and stopping point

Final database counts: four learners, four media assets and one media folder (unchanged counts), five assessment types, two synthetic drafts, four current task rows and 26 audit events. Assessment activity added eleven audit events: five type creations, two draft creations and four draft updates. No new R2 objects were created, modified, archived or deleted; the file HTTP regression only read the existing PDF. Existing portfolio objects remain retained.

- First browser run: `76787ae9-0844-445c-862c-bffc8efdcab0`, draft revision 8, two tasks. Its partial-run data remains available for inspection.
- Successful browser run: `829f9860-7ba1-41d3-bfc2-dd29d2a1a7fc`, draft revision 18, two tasks. The final title identifies the winning concurrent-edit case.
- Five standard planning type rows were created by the first run's real initialization action; the rerun did not duplicate them.

No Grade 11 fixtures were retained: Grade 10/11 reuse was verified in rollback-only integration transactions. Existing temporal concurrency test fixtures were removed by that runner. Auth smoke tests exercised normal login/session activity and sign-out; database counts are not a byte-for-byte comparison of every auth/provider row. Migration reproducibility evidence is incremental rollback replay plus schema regeneration/ledger checks, not a new whole-chain empty-database replay.

Implementation and implementer-run verification are complete. Independent fresh-session verification, hosted CI/deployment verification and human acceptance have not been claimed. Stop here; no subsequent assessment phase has been started.

## Limits and review boundary

The date/ordering guards currently inspect records within the affected school, following the existing small-school integrity approach. Broad read lists and repeated task writes need pagination/performance work before large-school scale. No production RLS/runtime privilege or deployment claim is made. Ordinary audit records are not a full draft-text revision archive.

The existing auth smoke script still expected the pre-restoration media route's HTTP 410. It now checks the restored route's controlled invalid-input HTTP 400 and private no-store response; this changes a stale regression assertion, not media authorization.

Fresh-session verification and human acceptance remain separate. Review the date behavior across terms, ordered task editing/removal, reload conflict handling, type configuration, and denied Teacher/Moderator views before approving another bounded slice. Evidence policy remains approved; evidence implementation is still deferred.

## Files changed for this slice

New implementation files:

- `lib/domain/assessment-validation.ts`
- `lib/domain/assessments.ts`
- `app/actions/assessments.ts`
- `app/admin/assessments/page.tsx`
- `components/assessment-planning.tsx`
- `drizzle/0003_assessment_drafts.sql`
- `drizzle/0004_assessment_draft_guards.sql`
- `drizzle/meta/0003_snapshot.json`
- `drizzle/meta/0004_snapshot.json`
- `scripts/assessment-integration.mjs`
- `scripts/assessment-browser-smoke.mjs`
- `tests/unit/assessment-validation.test.ts`
- `tests/authorization/assessments.test.ts`
- `tests/authorization/assessment-action.test.ts`

Updated integration points and checks:

- `lib/db/schema.ts`
- `lib/domain/server.ts`
- `components/sidebar-nav.tsx`
- `drizzle/meta/_journal.json`
- `scripts/db-common.mjs`
- `scripts/db-verify.mjs`
- `scripts/auth-smoke.mjs` (stale media assertion reconciled)
- `package.json`
- `tests/README.md`

Project records: this implementation record; `.github/PROJECT_LOG.md`, `ASSESSMENT_FIRST_SLICE_DELIVERABLES.md`, `ASSESSMENT_SPECIFICATION.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `SECURITY_REQUIREMENTS.md`, `TESTING_STANDARDS.md`; and captured outputs/screenshots under `.github/verification/assessment-drafts/`.

All changes are local/uncommitted. Pre-existing portfolio changes in `components/file-list.tsx`, `components/media-files-client.tsx`, `scripts/files-browser-smoke.mjs`, portfolio records/evidence, and the assessment evidence-policy record were preserved. Pre-existing additions to shared documentation, package scripts and the test README were retained. No commit or push was performed.
