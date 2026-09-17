# Assessment draft hardening — 2026-09-16

Bounded follow-up to the original September 14–15 draft-planning implementation. The owner supplied an independent **PASS WITH CONCERNS** finding: database nonblank checks admitted tab/newline-only values, and the administration regression assumed no historical admission audit events. This record separates that independent finding from implementer verification of the repairs. No later assessment feature is included; no commit or push is authorized.

## Implementation

- `0005_assessment_nonblank.sql`, generated from the authoritative schema, replaces only the three assessment title/task title/type name checks. Its explicit Unicode trim set matches ECMAScript `String.trim()` whitespace, independently of PostgreSQL locale. It checks nonblank text without normalizing stored rows. NEL (U+0085) and zero-width space (U+200B) remain nonblank, consistent with the application; unrelated text handling is unchanged.
- `0006_assessment_task_order.sql`, generated as a custom companion migration, replaces only the task ordinal unique constraint with the same columns/name, `DEFERRABLE INITIALLY DEFERRED`. Drizzle does not represent that deferrability; `db:verify` checks it explicitly. Existing positive/bounded ordinals and deferred contiguous-order guards remain in force. Applied migrations 0000–0004 are not edited.
- Draft input carries optional task UUID claims, canonicalizes UUID case, rejects malformed/duplicate claims, and discards temporary client keys. Within the authorized school and parent revision transaction, the service accepts a claimed ID only if it belongs to the loaded draft. Unknown, other-assessment and cross-school claims fail before parent/task mutation. Create rejects all supplied task IDs. Omitted task IDs mean new tasks, generated on the server.
- Saves update changed retained tasks in place, leave unchanged task rows untouched, insert genuinely new tasks, and remove omitted existing tasks. Retained creation actors/timestamps and immutable school/assessment identity survive. Reorder uses deferred uniqueness; parent optimistic revisions, SERIALIZABLE isolation and controlled concurrency conflicts remain intact.
- Audit events include created/updated/deleted IDs and old/new ordinal changes, including new-task positions. No task title, instruction text or request body is included. Audit failure rolls back the entire aggregate change.
- UI keys use persisted task IDs or temporary browser UUID keys for unsaved rows. Field edits preserve identity and reordered rows keep their component identity. Temporary keys never become database IDs.
- The administration suite selects complete commands through the admission, transferred placement and replacement assignment IDs created by its own fixture. It retains exact expected event counts and also verifies the admitted fixture resource, command grouping, sequence, actor and membership. Historical or concurrent unrelated events cannot alter those counts. Historical audit rows are read only. Its later injected audit-failure test and final rollback checks remain enabled.

**Required future approval:** Before attempts, evidence, scores or any other dependent task records are implemented, the owner must review and approve a referenced-task deletion/correction lifecycle. Today's draft-only removal behavior does not establish that future policy.

## Migration preflight and preservation

The initial live `db:verify` passed: 30 public tables, 353 columns, 102 foreign keys, five matching migrations, zero unvalidated constraints and zero unindexed foreign keys. The read-only preflight found no existing whitespace-only protected text. It captured row counts and content fingerprints for all 30 public and nine provider tables, plus exact task identities/provenance, without copying private row contents into evidence.

September 16 preflight counts: five learners, five admissions/enrolments/placements, four media assets, two media folders, five assessment types, three assessments, five tasks and 35 audit events. These are a new dated state, not a revision of the September 15 snapshot. See [before state](verification/assessment-hardening/before.json).

Forward migrations are transactional. Invalid existing rows would abort constraint validation without rewriting them. After deployment, repair forward; do not delete populated tables, reset/reseed, remove ledger entries or revert application code to task replacement. No R2 operation is part of this slice.

## Verification

Both forward migrations were applied after the successful rollback review. The post-migration comparison asserted equality of **all 39 public/provider table counts and content fingerprints**, all original task identities/provenance and the original five ledger entries. All matched. Only the two migration ledger entries were added; no data row was rewritten by migration. See [migration output](verification/assessment-hardening/migrate.txt) and [after-migration state](verification/assessment-hardening/after-migration.json).

| Check actually rerun | Result | Evidence |
| --- | --- | --- |
| Forward migration + service/direct SQL rollback review | PASS, 160 checks; DDL and fixtures rolled back | [review](verification/assessment-hardening/migration-review.txt) |
| Assessment integration after deployment | PASS, 160 checks; fixtures/audit rolled back | [assessment](verification/assessment-hardening/assessment-integration.txt) |
| Foundation integration | PASS, 51 checks; rolled back | [foundation](verification/assessment-hardening/db-integration.txt) |
| Administration integration | PASS, 57 checks, including safe grouped audit success and injected audit-failure rollback | [administration](verification/assessment-hardening/admin-integration.txt) |
| Lifecycle integration | PASS, 41 checks; rolled back | [lifecycle](verification/assessment-hardening/lifecycle-integration.txt) |
| Portfolio/media integration | PASS, 23 checks; database rolled back, storage in memory | [files](verification/assessment-hardening/files-integration.txt) |
| Temporal concurrency regression | PASS, one overlapping transaction rejected; native exit 0; temporary year/terms removed by runner | [concurrency](verification/assessment-hardening/db-concurrency.txt) |
| Real production browser/actions | PASS, native exit 0; create/reload/task text edit/add/reorder/removal, retained UUIDs, stale action conflict, competing SERIALIZABLE edits, role/school/anonymous denial and mobile widths | [browser](verification/assessment-hardening/browser.txt), [mobile](verification/assessment-hardening/mobile.png) |
| Typecheck | PASS | [typecheck](verification/assessment-hardening/typecheck.txt) |
| Unit/action tests | PASS, 96 tests / 12 files | [tests](verification/assessment-hardening/test.txt) |
| Lint | PASS, zero errors and 11 existing warnings | [lint](verification/assessment-hardening/lint.txt) |
| Production build | PASS | [build](verification/assessment-hardening/build.txt) |
| Schema regeneration/drift | PASS, no schema changes | [drift](verification/assessment-hardening/drift.txt) |
| `db:verify` | PASS, 30 tables / 353 columns / 102 FKs / seven matching migrations; explicit whitespace and deferred uniqueness checks | [schema](verification/assessment-hardening/db-verify.txt) |

The first rollback migration review failed because the old duplicate-ordinal test expected only SQLSTATE 23505; with two deferred guards, the contiguous-order guard correctly reported 23514 first. The test now accepts either guard for that invalid final state and separately forces the ordinal unique constraint to prove it raises 23505. The failed run is retained as [first-run evidence](verification/assessment-hardening/migration-review-first-run.txt), not presented as a pass. No production guard was relaxed in response.

The combined regression PowerShell wrapper ended with status 1 after all five Node suites reported PASS; each native nonzero exit would have stopped the loop before the next suite. Merged Node warnings produced PowerShell `NativeCommandError` records; wrapper success is not claimed. The final administration/concurrency wrapper explicitly recorded both native exits as zero and itself exited zero. Existing Node module-type and PostgreSQL SSL warnings are retained in the logs.

Migration reproducibility consists of generated SQL/snapshots, rollback-only incremental replay from the live 0004 state, regeneration with no drift, and applied hash/guard verification. No empty-database whole-chain replay, reset/reseed, provider control-plane inspection or production deployment is claimed.

The browser ran against the verified production build at `http://localhost:3001`, with matching process-local `BETTER_AUTH_URL`. It used real Better Auth sessions and form Server Actions. The temporary production server was stopped after the passing run. The 390px screenshot was inspected; document/control widths passed. This is not a comprehensive accessibility audit. No environment file was edited and no R2 object was accessed or mutated. Captured output is in [assessment-hardening evidence](verification/assessment-hardening/).

Representative rollback-only service identities from the deployed-schema test:

- Original tasks: `53bf8202-cc84-408e-9e03-13b51a57f2f0`, `60b1493e-5f7c-4400-be86-8b8028d23505`.
- Unchanged save and task text edit: those same two IDs, with identical creation provenance.
- Reorder: `60b1493e-5f7c-4400-be86-8b8028d23505`, `53bf8202-cc84-408e-9e03-13b51a57f2f0`.
- Addition created only `d0622ab8-4462-4f19-b8b7-8fa833f59ef0`; removing it left both retained IDs unchanged. All these fixture rows were rolled back.

Real form/action identities, retained draft `9aada269-bdb0-4c0b-9c03-c8787d6f18a5`:

| Operation | Task IDs in ordinal order |
| --- | --- |
| Create | `bf656840-7577-4fe6-b8e5-48e0e5d605e1`, `f5367b8c-2441-4f46-beb6-9bc0aec9cf53` |
| Text edit and reorder | `f5367b8c-2441-4f46-beb6-9bc0aec9cf53`, `bf656840-7577-4fe6-b8e5-48e0e5d605e1` |
| Add | The same two IDs followed by new `0161cc99-38a5-444d-a8e9-b56ff08cd200` |
| Remove first task | `bf656840-7577-4fe6-b8e5-48e0e5d605e1`, `0161cc99-38a5-444d-a8e9-b56ff08cd200` |
| Stale form / concurrent edits | Both remaining IDs unchanged; stale form rejected, one concurrent save committed and one returned controlled conflict |

## Review boundary and limitations

Final September 16 state: five learners, four media assets, two media folders, five assessment types, **four drafts, seven tasks and 41 audit events**, with seven matching migration entries. Browser verification retained one synthetic draft, two final tasks and six assessment audit events. No types were added because the five standard types already existed. See [final state](verification/assessment-hardening/final.json).

All 36 tables outside `assessments`, `assessment_tasks` and `audit_events` retain identical preflight counts and content fingerprints, including all auth/provider and media tables. For those three changed tables, a separate read-only check excluded only browser draft `9aada269-bdb0-4c0b-9c03-c8787d6f18a5` and its own task/audit rows and asserted identical preflight counts/fingerprints. It passed for all three: [original-row preservation](verification/assessment-hardening/preservation.txt). The five pre-existing tasks retain their exact UUIDs, parent/school, ordinal, creation actor/time and version. Original data and history are preserved; no R2 objects were added, changed or removed.

Both independent-verification concerns are resolved by implementation and rerun tests. The working tree is suitable for another independent verification, then owner review and an explicitly authorized development checkpoint commit. No independent acceptance of these repairs or human acceptance is claimed. No commit or push was performed and no later assessment feature was started.

No new application integrity defect was discovered. The deferred-guard test expectation and PowerShell wrapper status described above were verification issues, with the failed output retained. Existing limits remain: broad school-level validation/locking, no production RLS/runtime-privilege or deployment verification, no full text-revision archive, and no approved referenced-task deletion/correction lifecycle. Stable identity is preparatory work; it does not authorize dependent features.

## Exact files for this follow-up

Application/schema: `lib/db/schema.ts`, `lib/domain/assessment-validation.ts`, `lib/domain/assessments.ts`, `components/assessment-planning.tsx`.

Migrations: `drizzle/0005_assessment_nonblank.sql`, `drizzle/0006_assessment_task_order.sql`, `drizzle/meta/0005_snapshot.json`, `drizzle/meta/0006_snapshot.json`, `drizzle/meta/_journal.json`.

Verification: `scripts/admin-integration.mjs`, `scripts/assessment-integration.mjs`, `scripts/assessment-browser-smoke.mjs`, `scripts/assessment-hardening-state.mjs`, `scripts/db-verify.mjs`, `tests/unit/assessment-validation.test.ts`, `tests/authorization/assessment-action.test.ts`, and the captured evidence directory above.

Records: this file, `.github/PROJECT_LOG.md`, `.github/ASSESSMENT_FIRST_SLICE_IMPLEMENTATION.md`, `.github/ASSESSMENT_FIRST_SLICE_DELIVERABLES.md`, `.github/ASSESSMENT_SPECIFICATION.md`, `.github/ARCHITECTURE.md`, `.github/SECURITY_REQUIREMENTS.md`, `.github/TESTING_STANDARDS.md`, `.github/ROADMAP.md`, and `tests/README.md`.

The working tree already contained the original assessment implementation and portfolio changes. They are preserved; the above list describes this follow-up, not every uncommitted file relative to HEAD.
