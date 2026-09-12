# Phase 0 R5B — Engineering Baseline

Date: 2026-09-09. **R5B STATUS: PASS.** Repository tooling implemented; final typecheck, lint, unit test and production build all exited 0. Lint retains 28 visible warnings. This is not foundation-schema readiness, auth/security verification or R6 approval.

## Scope and governing evidence

Followed copilot-instructions.md, DEVELOPMENT_RULES.md, ARCHITECTURE.md, SECURITY_REQUIREMENTS.md, TESTING_STANDARDS.md, ROADMAP.md, FRESH_DATABASE_REBUILD_PLAN.md, approved R4 and the R5A foundation plan. Inspected package/scripts/lockfile, Next/TypeScript configuration, source structure, Drizzle configuration, Git tracking/ignore settings and Vercel configuration. No implementation of the proposed foundation tables was attempted.

The owner authorized development dependencies, tooling/tests/CI and small safe source fixes necessary for lint. Existing auth configuration, auth route, schema, migrations, DB client and R2 code were left unchanged. No UI redesign or application feature removal. The final source changes address typing, effect-driven state resets and stale calendar responses.

## Tooling and dependencies

| Tool | Choice and reason |
|---|---|
| TypeScript | Existing 5.7.3 retained. Strict configuration retained; explicit route-type generation followed by no-emit typecheck without incremental cache. |
| ESLint | Added exact development dependency `eslint@9.39.5`, compatible with the installed Next preset's React/accessibility plugin peer ranges. |
| Next ESLint presets | Added exact `eslint-config-next@16.2.6`, matching installed Next 16.2.6. Flat core-web-vitals and TypeScript presets; no legacy next lint command or FlatCompat dependency. |
| Test runner | Added exact `vitest@4.1.11`. Node environment handles existing TypeScript utilities and future pure domain/policy tests without booting Next, auth or storage. No jsdom, coverage package or browser framework added. |
| Runtime/package manager | `.nvmrc` and CI select Node 24; npm and package-lock.json remain authoritative. Local verification used the installed Node 26.8.1. No runtime replacement was installed. |

The flat-config choice follows the official [Next.js ESLint guidance](https://nextjs.org/docs/app/api-reference/config/eslint); Vitest's Node/TypeScript test use is described in its [v4 guide](https://v4.vitest.dev/guide/). Actual peer requirements were also read from installed package manifests. React ESLint plugin 7.37.5 accepts ESLint through ^9.7 and jsx-a11y 6.10.2 through ^9; this baseline does not force an unsupported ESLint 10 peer resolution.

No direct dependency removed and no application dependency declaration changed. npm resolved three previously installed lockfile versions during development-tool installation: js-yaml 4.3.0 -> 4.3.2, nanoid 3.3.15 -> 3.3.18 and postcss 8.5.16 -> 8.5.28. PostCSS remains an existing development dependency. Lockfile changes also include the new tooling dependency graph and npm metadata normalization; they are not an application/framework migration. No Better Auth version/configuration change.

Warnings from installation: npm deprecated ESLint 9.39.5; a future compatible Next/plugin upgrade should address its support status. npm also warned about install scripts lacking allowScripts decisions (esbuild versions, sharp and unrs-resolver). No blanket script approval or security-audit fix was run. Installed tooling and build succeeded in this environment; hosted Node-24/npm installation is still to be exercised by CI.

## Scripts and configuration

| Command | Implemented behavior |
|---|---|
| `npm run typecheck` | `next typegen && tsc --noEmit --incremental false`; generates ignored Next declarations on a fresh checkout, then enforces the existing strict TypeScript rules. |
| `npm run lint` | `eslint .`; flat Next core-web-vitals + TypeScript presets. Existing command repaired by supplying actual dependencies/configuration. |
| `npm run test` | `vitest run`; deterministic one-shot default suite; zero discovered tests is a failure. |
| `npm run test:watch` | `vitest`; optional local watch mode, not used by CI. |
| `npm run build` | Existing `next build`; removed `typescript.ignoreBuildErrors: true` from next.config.mjs. Production compilation now includes real TypeScript checking. |

dev/start scripts unchanged. tsconfig.json remains unchanged: strict and noEmit are enabled; editor/build incremental behavior remains available, while the explicit check disables incremental caching. No unsafe casts, ignored TypeScript errors or build-only bypass were introduced.

`eslint.config.mjs` ignores generated .next/out/build/coverage and next-env.d.ts. All normal source remains covered, including auth and legacy actions. The only rule-severity exception is **no-explicit-any as warning** for `app/api/auth/**/route.ts`: two pre-existing wrapper annotations remain visible because auth changes are excluded from R5B. It is not disabled globally or hidden by a file ignore. Other error rules retain the preset severities. A passing lint exit does not mean warnings or legacy authorization defects are resolved.

## Lint findings and small source corrections

Initial configured run: seven errors and 29 warnings (after removing the calendar page's unnecessary any cast). Errors were addressed without globally weakening rules:

| Classification | Finding / response |
|---|---|
| Configuration/tooling | Missing ESLint dependencies/config fixed with matching presets. Vitest config moved to `.mjs` to remove its ESM-in-CommonJS warning without changing the application's package module type. |
| Small code defect / redundant rendering | Upload forms reset multiple state values synchronously inside effects. Each exported upload component now mounts its internal form only while open, keyed to the selected folder/learner, and initializes selection from props. Opening or changing target resets form state without a cascading effect. Upload/server/storage functions remain unchanged. |
| Small code defect / stale response | Calendar month fetch now updates state in promise callbacks and ignores responses from an obsolete/unmounted effect. Removed the unused loading state/callback and unnecessary Event[] cast; loading had no rendered use. |
| Small code defect / redundant rendering | Activity pagination's bounded page reset occurs during the guarded render adjustment rather than a post-render effect. The next render resets an out-of-range page to 1. |
| Typing/JSX hygiene | Removed unnecessary `as any` from calendar page props. Escaped the two JSX quotation marks in calendar deletion text; displayed text remains the same. |
| Reasonable visible warning / deferred debt | Unused imports/variables remain across legacy files; these are not evidence their session calls may safely be removed. Raw img warnings remain for media displays, and sidebar hook-dependency stability remains flagged. No broad cleanup or media redesign performed. |
| Out-of-scope auth typing | Two explicit-any warnings on the legacy auth wrapper retained under the file-scoped severity exception; auth code untouched. |
| Generated-file issue | Next declaration and TypeScript incremental artifacts are ignored and removed from Git tracking while preserving local files. |

Final lint: **0 errors, 28 warnings**: 23 unused-variable/import warnings, two explicit-any auth warnings, two raw-img performance warnings and one sidebar exhaustive-deps warning. The baseline unit test does not exercise these component changes in a browser; browser/interaction coverage remains deferred per the small-test scope. Typecheck, lint and production compilation validate the changed components' static/build behavior.

## Test framework and structure

`vitest.config.mjs` includes only tests/unit/**/*.test.ts and tests/authorization/**/*.test.ts in a Node environment. It does not load Next or dotenv configuration. tests/setup.ts blocks initialization of pg, Better Auth and the S3 client through Vitest mocks, so accidental imports fail instead of opening those live service clients. These are import guardrails, not an operating-system network sandbox; future test authors must still use explicit mocked service boundaries.

The single test in tests/unit/utils.test.ts exercises the existing cn utility: conditional class merging plus caller override of conflicting Tailwind utilities. It provides useful regression behavior rather than an arithmetic placeholder or invented foundation test. **One test file / one test passed.** No coverage percentage claim.

Future layout, documented in [tests/README.md](../tests/README.md):

- tests/unit/: pure domain/utilities.
- tests/authorization/: policies with mocked session/repository boundaries, included in the default runner when tests exist.
- tests/integration/: future database integration runner, excluded from the default unit command.
- tests/migrations/: future replay/bootstrap runner, excluded from the default unit command.
- tests/e2e/: future browser runner; no browser dependency/configuration now.

Empty placeholder directories are not created. No database fixtures, auth sign-up/session tests, migrations, coverage inflation or R2 tests run. Future integration configuration must explicitly require an approved disposable target and must never fall back to DATABASE_URL or load .env.local.

## CI and deployment boundary

[.github/workflows/ci.yml](workflows/ci.yml) runs for pushes and pull requests: checkout -> setup Node 24/npm cache -> npm ci -> typecheck -> lint -> test -> build. It has read-only contents permission, a 15-minute job limit, concurrency cancellation and Next telemetry disabled. There is no deployment step, database service, migration command or repository-secret reference. npm ci uses the committed lockfile. No workflow dispatch, push, deployment or branch-protection change was performed from this task; hosted CI has not yet run.

Existing Vercel configuration is unchanged: next build with .next output. Removing the TypeScript bypass applies to that build too. The build still uses the existing Google Font imports, so it needs outbound font download access; no font replacement/UI change was made. Local builds automatically read the existing .env.local through Next's normal loader, without edits or printing its values. The workflow supplies no DB/R2 credentials; a clean hosted run remains required to confirm that environment. Dynamic application routes were compiled, not exercised with signed-in requests.

## Generated files and Git/security hygiene

Both previously modified files were generated: next-env.d.ts changed its route-type import between Next dev/build output; tsconfig.tsbuildinfo is an incremental compiler cache. They were already tracked, so .gitignore alone would not resolve the churn. `git rm --cached -- next-env.d.ts tsconfig.tsbuildinfo` removed them from the index **without removing local files**. Git therefore shows staged deletions of those tracked artifacts; this is intentional and is not application-code deletion. Their local presence and ignore matches were checked after build. No commit was created.

.gitignore now covers next-env.d.ts, *.tsbuildinfo, coverage, .env and .env.* while permitting a future .env.example. Existing node_modules/.next/Vercel ignores remain. No environment example containing secrets was created. Existing core.autocrlf=true and the origin remote remain unchanged; remote names only were printed. No custom hooks path was found. LF-to-CRLF notices are Git conversion notices, not failed validation.

Tracked-path checks found no .env, .env.*, PEM/key/P12/PFX files. A filename-only high-confidence scan found no tracked private-key blocks, credential-bearing PostgreSQL URLs or AWS access-key IDs. No matching secret values were printed, and no secret file contents were displayed. This is a current tracked-tree check, not an exhaustive credential audit of all Git history or all possible token formats.

Protected-file SHA-256 fingerprints matched before/after verification for lib/db/schema.ts, lib/auth.ts, lib/db/index.ts, lib/r2.ts, drizzle.config.ts, all existing drizzle files and .env.local. Hash comparison did not disclose file values. Git differences also show no schema/migration/auth/R2 source changes. Pre-existing `.github/` documents remain untracked unless the owner later stages them; this report does not claim that old documentation is newly created R5B work.

## Database safety policy

No db:push/reset/drop or other database script was added. Existing drizzle.config.ts still loads .env.local and targets the legacy schema/history; it is **not an approved entrypoint for future foundation work**. R5B does not invoke any Drizzle command, SQL, database connection, Neon operation, R2 API or migration generation.

Future database tools need their own approved slice, explicit target/profile, provider identity check, complete manifest, migration hash verification, locked execution and disposable-test safeguards from R5A. Never attach schema writes to install, dev, tests or build. R5B's default suite is database-independent; integration/replay commands remain deferred. R6 execution needs separate approval of the concrete SQL/package and target evidence.

## Commands and results

PowerShell's execution policy blocks npm.ps1 here, so local commands used **npm.cmd**; these invoke the same npm scripts named above. No execution-policy change was made.

| Command / operation | Result |
|---|---|
| node --version; source/package/config/Git inspections | Node 26.8.1; current npm scripts and protected boundaries reviewed. npm without .cmd failed under PowerShell script policy; switched to npm.cmd. |
| npm.cmd install --save-dev --save-exact eslint@9 eslint-config-next@16.2.6 vitest@4 | Initial sandbox download stalled and was cancelled. Bounded retry failed EACCES on registry/cache; requested escalation. |
| Same install with --fetch-retries=0 --fetch-timeout=15000, elevated | Failed registry idle timeout; cleanup EPERM warning. No package/client source workaround or global install. |
| Same install with --fetch-retries=2 --fetch-timeout=120000 --maxsockets=5 --no-audit --no-fund, elevated | Exit 0; added 267 packages and changed three existing resolutions. Warnings recorded above. No npm audit fix or blanket install-script approval. |
| git rm --cached -- next-env.d.ts tsconfig.tsbuildinfo | Sandbox denied index.lock; approved retry exited 0. Local generated files preserved. |
| Initial/intermediate lint | Failed on the errors described above; rerun after small fixes. No failures hidden. |
| Initial unit test | Passed; Vite module-format warning fixed by using vitest.config.mjs. |
| Initial sandbox npm.cmd run build | Failed to download Geist/Geist Mono from Google Fonts. Approved network-enabled rerun passed; no environment/auth/font substitution. |
| Final npm.cmd run typecheck | **PASS, exit 0**; route types generated and actual tsc check completed. |
| Final npm.cmd run lint | **PASS, exit 0**; 0 errors, 28 visible warnings. |
| Final npm.cmd run test | **PASS, exit 0**; 1 file, 1 test; no Vite config warning. |
| Final npm.cmd run build, network-enabled | **PASS, exit 0**; compiled, TypeScript completed, static generation 11/11 and route optimization completed. |
| Git diff/status/ignore checks and protected-file fingerprints | No whitespace errors; intended source/tooling and generated-index changes only; protected files unchanged. |

Final four checks ran in the required order after the last executable-source fix. Documentation updates afterward do not alter their runtime behavior. Some read-only inspection attempts encountered PowerShell JSON/quoting or package export limitations; corrected read-only Node/file inspections provided the final dependency/peer evidence. No such inspection error was treated as a passing runtime check.

## Files created and changed

Created:

- .nvmrc
- eslint.config.mjs
- vitest.config.mjs
- tests/setup.ts
- tests/unit/utils.test.ts
- tests/README.md
- .github/workflows/ci.yml
- .github/PHASE_0R5B_ENGINEERING_BASELINE.md

Modified:

- package.json and package-lock.json
- next.config.mjs and .gitignore
- app/calendar/page.tsx
- components/activity-feed.tsx
- components/calendar-client.tsx
- components/media-files-upload.tsx
- components/portfolios-upload.tsx
- components/staff-resources-upload.tsx
- .github/TESTING_STANDARDS.md (replace obsolete missing-tooling baseline with current commands and remaining integration requirements)

Removed from Git tracking only, retained locally: next-env.d.ts and tsconfig.tsbuildinfo. Temporary initial vitest.config.ts was renamed to the final .mjs configuration; there is no duplicate test configuration.

## Remaining debt and next step

Visible lint warnings, ESLint-9 support/peer upgrade planning, hosted Node-24 CI verification, npm install-script policy, browser interaction regression, stronger secret-history scanning, actual authorization/DB integration/replay tests and branch protection remain. Known legacy IDOR/CORS/storage consistency risks are not fixed or certified by this engineering baseline. No dependency vulnerability audit or real service smoke test is claimed. Google Fonts remain a build-network dependency.

**No database/schema/migration/Neon/R2 operation, .env.local edit, auth configuration change, deployment or R6 execution occurred.** Next read existing environment configuration during local build; no values were printed and no environment file was changed.

**R5B STATUS: PASS.** Exact next recommended step: separately authorize the R5A H2 read-only contract-evidence task (R5C): provider-confirm the fresh target and capture its full schema-qualified manifest to resolve the canonical auth/legacy fingerprint. Do not generate migrations or implement the foundation schema until that evidence and the scoped next implementation authorization are in place. R5C/R6 has not started.
