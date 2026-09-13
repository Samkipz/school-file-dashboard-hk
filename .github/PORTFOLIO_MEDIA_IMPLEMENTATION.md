# Portfolio/media implementation and live verification

Verified 2026-09-13, following checkpoint `0d288fb127f4546e87f05b4646a5a48c9074b673`. This new record supplements, and does not replace, `PORTFOLIO_MEDIA_MIGRATION.md`. No Assessment/Grade 10 SBA implementation was undertaken.

## Architecture actually found

Direct inspection: the checkpoint already contains the restored portfolio/media implementation. `lib/domain/files.ts` supplies school-scoped file operations; `lib/domain/server.ts` binds real session identity and the existing `lib/r2.ts` upload/read adapter. Portfolio and Media Files routes retain the SchoolHub layout and shared UI components. This verification task changed test scripts and documentation, not the feature implementation.

Historical definitions in `lib/db/legacy-schema.ts` use `students`, `portfolioFiles`, and user-owned `files`/`folders` with `bucketPath` and a staff/media section. They do not provide authoritative school/learner identity. Those definitions are excluded from current migration schema; `lib/legacy-boundary.ts` disables old adapters. Staff Resources remains deferred. Old storage helper functions still exist, but restored download and archive paths do not invoke public URLs or object deletion.

Reusable pieces: R2 SDK transport, existing page/navigation style, portfolio/media action entry points, upload components and file UI. Adapted pieces: authoritative learner listing, memberships/roles, roster authorization, shared metadata, school-aware folders, private ID-based download and archive semantics. Obsolete/unsafe legacy user/student identity and unscoped storage paths remain unavailable. No automatic legacy mapping was attempted; legacy tables are absent on this pinned target. Files on other targets or existing R2 objects were not inventoried or mapped.

## Delivered workflows and data model

School Admin can list learners (including withdrawn/completed history), open portfolios, upload, list/download files, edit title/description/category, archive metadata, and manage Media Files folders. The UI displays learner status, latest academic context, original filename/type/size/category, uploader and upload date. UI behavior was inspected; HTTP rendering and download were exercised, but interactive browser click/upload automation was not run.

`media_assets` is the reusable physical-object metadata record. Its school-scoped target is exactly one authoritative `learner_id` or `folder_id`; `media_folders` represents general school media. Portfolio assets have no academic-year foreign key, so a learner's identity persists across years and re-admissions. Composite school/learner and school/folder foreign keys prevent cross-school associations. There is no second portfolio/learner identity table. Sharing one asset through multiple additional feature associations is not yet implemented.

## Step 2: committed migration evidence

In the preceding Step 2 execution, the pinned `developmentPool()` fingerprint check succeeded. Before application there were 25 public tables and exactly two ledger entries matching the repository hashes and timestamps. Only `0002_portfolio_media` was pending. `node scripts/db-migrate.mjs` returned exit 0 and:

```text
Migration PASS: authoritative foundation history applied
```

A new connection then confirmed 27 public tables, three matching committed ledger hashes/timestamps, and zero rows in each new media table. This was a real COMMIT, not rollback-only DDL. The SQL adds only the two media tables, their checks/indexes and six restrictive foreign keys; the runner records one migration ledger entry. No seed/reset or academic/auth table DDL was run. The repository SQL/journal already existed in the checkpoint and required no further migration-state file changes.

The full Step 2 console transcript remains in the task conversation; it was not reconstructed into an invented raw log. Step 3 independently rechecked the committed schema and hashes (links below). The pin validates the configured connection fingerprint; no separate Neon control-plane branch lookup was performed.

## Step 3: exact verification and full output

All output files below retain complete captured stdout/stderr, including runtime warnings. On Windows, `npm.cmd` was used because PowerShell blocks the `npm.ps1` shim. The sandboxed build failed fetching Google Fonts; its network-enabled retry passed without source changes.

| Command | Result | Full captured output |
| --- | --- | --- |
| `node scripts/files-integration.mjs` | Exit 0; 23 checks on applied tables; test mutations rolled back, in-memory storage | [output](verification/portfolio-media/files-integration.txt) |
| `node scripts/files-live-integration.mjs --retain-test-evidence` | Exit 0; actual service transactions COMMIT, real R2 PUT/GET | [output](verification/portfolio-media/files-live-integration.txt) |
| `npm.cmd run typecheck` | Exit 0 | [output](verification/portfolio-media/typecheck.txt) |
| `npm.cmd run lint` | Exit 0; 0 errors, 11 existing warnings | [output](verification/portfolio-media/lint.txt) |
| `npm.cmd run test` | Exit 0; 9 files, 62 tests passed | [output](verification/portfolio-media/test.txt) |
| `npm.cmd run build` (sandboxed) | Exit 1; Google Fonts network failure | [output](verification/portfolio-media/build.txt) |
| `npm.cmd run build` (network enabled) | Exit 0; production routes generated | [output](verification/portfolio-media/build-network-enabled.txt) |
| `node scripts/admin-integration.mjs` | Exit 0; 57 checks; test changes rolled back | [output](verification/portfolio-media/admin-integration.txt) |
| `node scripts/lifecycle-integration.mjs` | Exit 0; 41 checks; fixture changes rolled back and baseline counts restored | [output](verification/portfolio-media/lifecycle-integration.txt) |
| `node scripts/files-http-smoke.mjs` | Exit 0; built app, real sessions and R2 route | [output](verification/portfolio-media/files-http-smoke.txt) |
| `node scripts/db-verify.mjs` | Exit 0; 27 tables, 311 columns, 89 FKs, 3 matching migrations; zero unvalidated constraints/unindexed FKs | [output](verification/portfolio-media/db-verify.txt) |
| `node scripts/db-inspect.mjs` | Exit 0; complete public/ledger table list | [output](verification/portfolio-media/db-tables.txt) |

Final read-only verification after all regression rollbacks again matched the exact 27-table set: 1 retained media asset, 0 media folders, 4 learners, 3 audit events (existing seed event plus two upload events), and 3 migrations. [Full final database output](verification/portfolio-media/final-database.txt). The temporary production HTTP server was stopped after testing.

The existing security suite now refuses missing media tables instead of applying migration DDL inside its test transaction. Its rollback-only fault/lifecycle scenarios are supplementary; they are explicitly not evidence of committed R2 integration. The new opt-in live script uses the actual `fileService`, real pg pool and the exact R2 adapter used by the app, with the development admin identity injected at the service boundary. The HTTP script separately verifies real session identity through the production application.

### Real retained R2 evidence

- Existing test school `DEV-SCHOOL` / SchoolHub Development School; existing `Sample Learner 1`; uploader `Development Admin`. No fixtures were seeded.
- One synthetic `schoolhub-live-check.pdf`, 76 bytes, uploaded through `fileService.upload`, retained as asset `7c302433-402a-43cd-b931-1724f36cf7ef` in ready state.
- Object pattern: `schools/<school-uuid>/assets/<asset-uuid>.pdf`. No credentials, bucket endpoint or complete object key are reported.
- Title `Live R2 integration verification`, description `Synthetic retained integration evidence`, category `work`, MIME `application/pdf`; school/learner/uploader/timestamp/size/key validated from committed metadata.
- Admin and assigned teacher service downloads returned identical bytes. SHA-256: `511bc7366993fc4914f11863d3756f234299b98d08ec8fec1a0a8696e0f902a4`.
- Actual HTTP `/media-files/file/<asset-id>?school=<school-id>` downloads returned 200 and the same digest for admin/teacher; anonymous returned 401 and moderator 403. Private no-store, nosniff and attachment headers were asserted. Invalid school input returned 400.
- Two retained service audit events: `media.upload_reserved`, `media.upload_completed`. The R2 object and metadata were not deleted or archived. The PDF is a synthetic signature-valid byte fixture; PDF rendering was not tested.

### Authorization and upload controls

Direct inspection plus integration/unit tests establish school membership checks, admin-only mutation/general-media access, and read-only Teacher access restricted to the current active assignment/offering/learner roster. Revoked assignments and learner withdrawal remove teacher access. Moderator receives no general access; learner self-service is absent. Cross-school learner/file/folder IDs, foreign school without membership, unknown IDs and arbitrary key-shaped inputs are rejected. A user with memberships in two schools still cannot mix their IDs.

Upload validation enforces a nonempty file up to 10 MiB, extension/MIME/signature agreement, sanitized basename, bounded title/description and known category. Portfolio permits PDF/PNG/JPEG/WebP/MP4; general media excludes PDF. Signature checks are not malware scanning or full format parsing. Keys are server-generated; download accepts an asset ID and authorizes metadata before reading R2. Metadata listings omit storage keys. Ready/unarchived assets only are downloadable. PDF is attachment-only; permitted image/video inline paths were inspected, not live-tested.

Reservation failure prevents PUT; PUT failure marks metadata failed where possible; finalization failure retains pending metadata/object for reconciliation. Failure cases were tested with injected faults and in-memory storage, not destructive R2 fault injection. Archive preserves object/history. These states are excluded from ordinary download/list access.

## Preservation, limitations and next step

No existing objects were renamed, deleted, bulk-migrated, made public or reseeded. Durable additions from Step 3 are the synthetic asset/object and its two audit records; real HTTP authentication also exercised normal session/user activity. Consequently this record does not claim that every row in the database is byte-for-byte unchanged. Administration/lifecycle fixture mutations are rollback-only; schema verification shows exactly the expected 27 public tables. Nine provider tables were counted; their full definitions/content were not compared before/after, despite the verifier's historical `providerTablesUntouched` output label.

Remaining limitations: Staff Resources and legacy automatic mapping remain deferred; no real browser click/upload smoke, inline image/video smoke, malware scan, pending-object reconciliation UI, large-school pagination or concurrent R2 failure testing. Same-year learner re-entry, scheduled lifecycle operations and large-school rollover optimization remain deferred. Existing lint warnings and Node module/pg SSL-mode warnings are retained in logs. Future runs of the opt-in live test intentionally retain another test object.

Future Assessment Evidence integration point: a future evidence association should reference existing `media_assets.id`, constrained to the same school (the existing `(school_id,id)` unique key supports a composite FK), and verify `learner_id` equals the evidence learner. Require a ready, authorized asset and define retention/archive policy for referenced evidence. Reuse the existing private download authorization and recorded object, without copying R2 bytes or creating another learner identity. No assessment-specific table or FK is needed now and none was added.

Recommended next step: review this live verification and retained test asset, then perform an interactive UI acceptance pass and agree evidence retention/reference semantics before authorizing a separate assessment implementation phase.
