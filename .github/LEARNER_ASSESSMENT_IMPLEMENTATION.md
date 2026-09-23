# Learner assessment implementation

Authorized September 21, 2026. Final verification state recorded September 21, 2026. This record does not claim independent review, human acceptance, production readiness or KNEC compliance.

## Scope and domain

Open assessment -> current authorized roster -> learner observations -> Save in progress -> feedback and existing-file evidence -> Complete & Next. The previous structured-definition architecture and migrations 0000-0008 are preserved. No correction, reopening, moderation, Close/Archive, analytics, reporting, arbitrary score entry or additional participation statuses are introduced.

`learner_assessments` has permanent school/assessment/learner identity, unique across that combination, actor/time provenance, aggregate revision, feedback, completion and absence metadata. `criterion_observations` retains one selected configured indicator per criterion. `assessment_evidence` relates an existing media asset to one learner assessment with optional task/criterion scope. All child references have tenant FKs; triggers verify the full indicator/criterion/task/assessment chain and evidence ownership. Parent academic context is not copied into child records. No score totals or descriptor snapshots are stored: selected indicators plus the database-locked definition reproduce every score and interpretation.

## Status, scoring and completion

Not started is derived from eligible roster membership with no participation row; reads never create results. In progress is stored after a mutation; partial scores are informational. Completed requires explicit intent and every configured criterion. Absent is explicitly recorded with actor/time and has no score. Only these three states are stored. Absence resumes explicitly to In progress with the same UUID. Marking absence cannot silently discard saved observations, feedback or evidence; the teacher must first review and clear that work. Audit history preserves transitions.

Scoring uses existing exact integer hundredths, deriving criterion scores, ordered task totals and assessment total. Browser values are previews; the server rejects submitted arbitrary totals/scores and resolves selected IDs against the immutable definition. Configured performance ranges supply interpretation only when observations are complete. No scale means no descriptor. No completed-result averages or other analytics exist.

Completion runs in the existing SERIALIZABLE school transaction: current role/assignment/roster authorization, open-state and revision checks, indicator validation, evidence checks, reconciliation, feedback, completion metadata and safe audit all commit together. Completed parents and their observations/evidence are database-locked against ordinary updates/deletion; truncation is also blocked. Existing opened-definition guards remain intact. A future correction lifecycle requires a separately authorized forward migration and domain design.

## Roster and authorization

The verified foundation roster query is extracted to a server-only composition helper without changing its predicates or ordering. Eligibility uses the school-local current date, active admission/learner/enrolment, dated placement and subject participation in the offering's academic year. Assignment authorization requires the current active year, offering, class, subject, staff and teacher assignment. Every read/write rechecks these conditions.

This slice deliberately follows current roster semantics, not an invented historical opening roster. Definition start/due dates remain planning metadata, not historical eligibility authority. New joiners become eligible when their dated participation is current; transferred/withdrawn learners lose access through their former offering. Existing results remain stored unchanged but are not exposed in this current-roster workflow. Historical-result retrieval and makeup work after transfer/year closure remain limitations. No backdated membership is fabricated.

Result entry and viewing require an actual current teacher assignment, including for mixed admin/teacher staff. Admin-only setup authority does not imply academic result-entry authority. DOS/Principal/moderator privileges are not added. My Teaching continues to list actual assignments only. School, assessment, learner, criterion and asset IDs are always claims requiring complete server validation.

## Evidence and storage

The teacher can associate/remove existing ready, unarchived files belonging to that eligible learner, at assessment/task/criterion scope. The assigned offering and current roster checks imply the existing file-service teacher read policy; downloads use an assessment-scoped route that checks the association before reusing the independently authorized private file transport. Teachers do not gain upload privileges. New-file upload remains an administrator operation through existing Private Files and is deferred within the teacher assessment flow.

Associations and academic work save atomically; invalid evidence causes the attempted save to roll back, preserving prior saved work and current unsaved browser state. No R2 calls occur during association or completion. A storage download failure remains isolated from academic data. There is no distributed transaction with object storage. Linked asset identity/object key cannot change; all currently referenced evidence is protected from archival or availability changes through normal media operations. Unrelated private files retain their existing behavior. Available-file titles remain media metadata, not a new immutable metadata snapshot.

## Concurrency and audit

Revision zero represents no participation. Creation uniqueness plus SERIALIZABLE isolation prevents competing first saves. Existing writes check the browser's loaded revision and acquire the parent row lock; child mutations advance its revision using the existing mutable provenance guard. Completed/stale/absence conflicts return controlled errors. Reload is explicit; unsaved changes are not automatically retried or overwritten.

Aggregate events are `learner_assessment.saved`, `.completed`, `.absent` and `.begun`. Safe metadata includes academic IDs, state/revision, counts and evidence association changes; full feedback and observation text are omitted. Audit failure rolls back the entire academic mutation. The selected indicators remain in authoritative observation rows; speculative amendment history is not introduced.

## Migrations and UI

Generated `0009_learner_assessments.sql` adds three tables and indexes. Custom `0010_learner_result_guards.sql` adds aggregate revisions, cross-parent checks, result locking and scoped linked-asset protection. No reset/reseed or historic migration edits are authorized. A subsequent forward migration, `0011_evidence_retention.sql`, tightens asset archival protection to every live reference in accordance with the earlier approved evidence policy; applied files 0009-0010 were not rewritten. Each change was reviewed in a rollback-only transaction before application; verifier checks the latest snapshot, all FKs/indexes, enabled guards and ledger hashes.

`/academics?school=...&offering=...&view=assessments&assessment=...[&learner=...]` supplies the roster and learner experience. Open assessment links lead to the roster; the locked scoring editor remains available separately. The learner page uses native radios, task anchor navigation, missing-observation labels, feedback and existing-file selection. Save and Complete & Next are separate commands. Completion/absence use explicit browser confirmation. Completed controls are disabled and clearly labeled read-only. Next follows the existing name/UUID roster order regardless of status; the last learner returns to the roster without wrapping.

Reads use bounded query counts for roster status/observations, not a transaction per learner. Learner detail currently loads the assessment's participant/observation set and filters it, and evidence writes validate up to 100 assets individually. Large definitions/rosters need future pagination and query optimization. Mobile and keyboard verification is targeted, not comprehensive accessibility certification.

## Verification and final state

Final verification is complete for checks that reached a definitive result. Earlier interrupted and failed attempts remain in retained logs and are not counted as final passes.

| Check | Final result and exact reported count |
| --- | --- |
| File/storage regression (`files-integration.mjs`) | PASS: 23 checks; in-memory storage only. |
| Learner lifecycle regression | PASS: 41 checks. |
| Concurrency regression | PASS: one overlapping SERIALIZABLE race; one commit and one controlled conflict. |
| Teaching browser regression | PASS: four named browser checkpoints plus the summary journey; no academic/storage mutations. |
| Admin browser regression | PASS: summary journey covering six tabs, lifecycle/history, rollover, validation, mobile layout and assessment setup. |
| Legacy assessment browser regression | PASS: retained synthetic draft; create/reload/edit/reorder, stale conflict, concurrent transactions, role/foreign/anonymous denial and 390px form coverage. |
| Structured-assessment browser regression | INCOMPLETE: first final-server attempt was throttled (HTTP 429); clean retry timed out waiting for the Assessments destination. No assertion or throttling was changed. |
| Learner assessment browser journey against final production build | PASS: full teacher -> My Teaching -> authorized offering -> Assessments -> Open assessment -> roster -> learner -> partial observations -> Save -> refresh/persistence -> finish -> feedback -> existing-file association -> Complete & Next -> exact score -> descriptor -> Completed/read-only -> next learner -> Mark absent -> no zero -> Begin assessment -> In progress path. Also covered forged URLs, cross-school/unauthorized offering denial, stale save, competing first save, absence/save concurrency, stale save after completion, 390px layout and real concurrent writes. Synthetic result/audit records were intentionally retained. |
| Learner assessment integration | PASS: 28 checks; all fixtures rolled back; no object-storage calls. |
| Structured assessment integration | PASS: 19 checks; all mutations rolled back. |
| Legacy assessment integration | PASS: 158 checks; all fixture mutations and audit events rolled back. |
| Foundation integration | PASS: 59 checks; all fixtures/mutations rolled back. |
| Administration integration | PASS: 57 checks; database state verified; all test changes rolled back. |
| Unit/authorization tests | PASS: 158 tests in 18 files. |
| Typecheck | PASS: final recorded run; route types generated and `tsc --noEmit --incremental false` completed. |
| Production build | PASS: final recorded build includes the page change removing the redundant roster read. |
| Lint | PASS: zero errors, nine existing warnings. |
| `git diff --check` | PASS; only Git's LF/CRLF normalization warnings were emitted. |

The initial learner browser timeout and the earlier nonzero PowerShell wrapper are retained as historical INCOMPLETE/ambiguous attempts and are superseded by the elevated final-production rerun. The four supporting browser reruns first hit Chrome cookie setup timeouts in the sandbox; teaching/admin/legacy assessment then passed against the elevated production server. Structured browser remains INCOMPLETE because the retry timed out after the throttle cleared. Throttling, timeouts, assertions, authentication, authorization and database guards were not weakened.

The browser smoke scripts report named coverage and exit status rather than a numeric assertion total; the table preserves those exact emitted summaries instead of inventing counts.

## Final database and storage evidence

The final read-only verifier reports 36 public tables, 436 columns, 135 foreign keys, zero unvalidated constraints and zero unindexed foreign keys, with zero unexpected schema drift. The migration ledger contains 12 entries. Migrations 0009, 0010 and 0011 each appear exactly once with their applied hashes and timestamps; their applied files were not rewritten. Historical hashes for 0000-0008 match `historical-hashes.json`, and the migration review confirms the historical files were unchanged. Provider tables remain untouched (9). Pre-existing learner and media rows retain their recorded fingerprints; retained synthetic assessment work is isolated to the learner-assessment verification fixtures.

Retained synthetic data at the final inventory is 8 `learner_assessments` rows, 8 `criterion_observations` rows, 2 `assessment_evidence` associations, 7 synthetic assessment definitions in addition to the six pre-existing definitions, and 84 total audit events. The evidence inventory made no object-storage API calls: no R2 objects were created, modified, deleted or inventoried, so no live R2 bucket inventory is claimed.

Known limitations remain: current-roster rather than historical-opening-roster semantics; completed-result correction/amendment is unsupported; teacher new-file upload is unsupported in this flow; historical results after transfer/year closure are not exposed; large definitions/rosters need pagination and query optimization; Node's module-type and PostgreSQL SSL compatibility warnings remain; accessibility verification is targeted rather than certification; and there has been no independent review, production-readiness sign-off or KNEC compliance review. The implementation stops at Completed read-only learner results.

See `verification/learner-assessments/` for retained outputs. The existing uncommitted shell, structured-assessment and learner-assessment work is preserved. No commit, push or deployment was made.
