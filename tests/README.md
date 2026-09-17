# Tests

Assessment additions: `npm run test:assessments` requires the applied `0003`/`0004` forward migrations and rolls back its fixtures/audit events. `--review-migration` is a pre-application incremental replay mode that requires the assessment tables to be absent; it rolls back DDL too and must not be used after application. `npm run test:assessments:browser -- --retain-test-evidence` uses installed Chrome and a running app, retaining one synthetic draft with two tasks plus audit history per successful invocation, and initializing the five planning types if missing through a real action. Failed runs retain any created rows. It tests create/reload/edit/reorder, cross-term dates, a real stale action, competing transactions, denied role/school pages and 390px controls. Screenshots/output are in `.github/verification/assessment-drafts/`. Set `SMOKE_BASE_URL` to the running app URL; its server must use a matching `BETTER_AUTH_URL`. No new R2 objects are created by this runner. Independent verification and human acceptance are separate.

Use Node 24 (see `.nvmrc`) and the committed npm lockfile. Install with `npm ci`.

- `npm run test`: run database-independent tests once; missing tests are an error.
- `npm run test:watch`: watch the same suite locally.
- `tests/unit/**/*.test.ts`: pure utilities and future domain logic.
- `tests/authorization/**/*.test.ts`: session-boundary and disabled legacy/R2 adapter tests with explicit mocked boundaries.
- `tests/integration/`: reserved for future database integration tests, excluded from the default runner.
- `tests/migrations/`: reserved for future clean replay/bootstrap tests, excluded from the default runner.
- `tests/e2e/`: reserved for future browser tests; no browser framework installed.

Only directories with actual tests need to exist. The default suite covers the existing `cn` utility, foundation input validation, session rejection/transaction cleanup, and every deferred legacy action without touching R2 or removed tables.

The default Vitest configuration uses Node, does not load Next or dotenv configuration, and blocks initialization of pg, Better Auth and the S3 client through test setup mocks. Test pure functions or explicitly mock service boundaries; do not import the live application entrypoint. No database credentials or R2 configuration are needed. These import guards are guardrails, not an OS network sandbox.

Database tests use separate explicit commands against the owner-authorized disposable `schoolhub-fresh-dev`. They load `.env.local` only in these explicit scripts and require `DEV_DATABASE_FINGERPRINT` to match the endpoint/database of `DATABASE_URL`. Pin only after verifying the branch with `node scripts/db-pin.mjs schoolhub-fresh-dev`. A production NODE_ENV or changed/unpinned target is rejected. Default unit tests never load these scripts or credentials.

- `npm run db:verify`: inspect live table/column/FK/index coverage, migration checksums and seed counts.
- `npm run test:integration`: 51 PostgreSQL/domain checks, including transient second-school and unassigned-teacher fixtures, all rolled back.
- `npm run test:admin`: 57 administration service/database checks covering admissions, yearly enrolment, placements, transfers, subject eligibility, assignments, setup, authorization and atomic audit history. All mutations are rolled back.
- `npm run test:lifecycle`: PostgreSQL lifecycle and rollover checks, including dated closure, immutable source history, re-admission, promotion/repeat, subject/teacher copying, stale confirmation, duplicate prevention, late-failure rollback, and school/role isolation. All fixture mutations are rolled back. Dates use the 2026 demonstration year.
- `npm run test:admin:smoke`: with `npm run build` and `npm run start`, check the admin HTTP page and teacher/moderator denial using the seeded accounts.
- `npm run test:admin:browser`: against the same running app, exercise all six tabs, lifecycle controls/history, explicit rollover outcome and class selection, rejected same-year preview, real Server Action validation and mobile width in headless Chrome. Uses the installed Windows Chrome by default; set `CHROME_PATH` for another installation. Uses a temporary browser profile, signs out, and does not submit valid mutations. Both smoke scripts accept `SMOKE_BASE_URL` (default `http://localhost:3000`).
- `npm run test:files:browser -- --retain-test-evidence`: opt-in Chrome interaction check against a locally running app and the pinned development database. Exercises portfolio/media upload, real Download links and byte hashes, metadata and folder editing, teacher read-only access, moderator denial, archive guards and 390px layout. Creates two synthetic PNG objects and one folder; archives only this run's records and retains objects/audit history. On failure, any created records remain for inspection. Saves screenshots under `.github/verification/portfolio-browser/`. Requires existing dev identities and R2 configuration; never resets, seeds or migrates. Each rerun creates additional retained evidence. This is automated coverage, not human acceptance.
- `npm run test:concurrency`: concurrent overlapping-term commits; creates then removes a temporary year/terms.
- `npm run test:auth`: with a running local app and seeded accounts, verify login/session/logout, invalid sessions/passwords, origin rejection, `/academics` and disabled media access. Reads the local seed password without printing it.

See the [implementation record](../.github/FOUNDATION_SLICE_IMPLEMENTATION.md) for migration/reset/seed commands and evidence. Database tests are intentionally outside the default CI job. Positive teaching-access fixtures use the fixed demonstration year 2026; update those fixtures deliberately when testing another calendar year. Node 24+ native TypeScript stripping runs the integration service module; no extra test transpiler is required.
# Assessment draft hardening follow-up (2026-09-16)

`node scripts/assessment-hardening-state.mjs` reads the pinned development database and reports counts, content fingerprints, matching applied ledger entries, task identities and whitespace preflight. It does not expose row content or mutate data. `node scripts/assessment-integration.mjs --review-forward` reviews migrations 0005/0006 against the 0004 state and rolls back all DDL/fixtures; run without that flag after deployment. The browser runner verifies stable task IDs through real add/edit/reorder/remove actions and retains synthetic evidence when explicitly invoked with `--retain-test-evidence`. See [actual results](../.github/ASSESSMENT_DRAFT_HARDENING.md).
