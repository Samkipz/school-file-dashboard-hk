# Portfolio/media migration review and repair

FACT: Before generation, `db:verify` passed against pinned `schoolhub-fresh-dev`: 25 public tables, 2 matching migration hashes, 289 columns, 83 foreign keys, no invalid constraints or unindexed foreign keys. No legacy tables exist on this target.

Decision: `0002_portfolio_media.sql` is generated from `lib/db/schema.ts`. Reviewed SQL adds only `media_assets` and `media_folders`, six restrictive foreign keys, scoped keys/indexes and target/size/state/category checks. It does not change academic/auth tables, copy data, or touch R2. New tables are necessary because the authoritative schema has no file records; legacy tables lack school identity and use removed students.

Verification: `node scripts/files-integration.mjs` applies this migration inside its rollback-only transaction when absent, then tests domain operations and school foreign keys with in-memory storage. Existing migrations remain byte-for-byte unchanged. Regeneration must report no drift.

Repair: before application, ordinary transaction failure rolls back DDL and ledger together. After application, prefer a forward repair and retain all rows/objects. To revert application code, disable portfolio/media routes and keep the additive tables. Do not drop populated tables, erase ledger entries, or delete objects. A later removal migration requires a separate data-preservation review.

Upload recovery: reserved metadata commits before object PUT. PUT failure marks the record failed where possible; finalization failure leaves a pending record and logs its asset ID. Both are excluded from ordinary downloads and lists. Operators must reconcile pending/failed records against the exact recorded private key, validate size/type and authorization, then perform an audited forward repair. No automatic deletion, retry of an ambiguous PUT, or legacy mapping is attempted.
