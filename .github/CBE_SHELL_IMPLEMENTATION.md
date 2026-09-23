# CBE shell and teacher workspace implementation

Date: 2026-09-20. Status: implemented and implementer-verified. Independent review and human acceptance are separate and are not claimed.

## Delivered scope

The owner approved CBE application shell → Teacher Home → My Teaching → Subject Workspace → Learners. The app now identifies itself as a teaching/learning platform. Home shows the selected school, real current academic year/term and current teacher offerings. My Teaching cards identify the subject offering, grade/class, year, term and count derived from the authorized roster.

The offering workspace has working Overview and Learners destinations. School/offering/view are encoded in URLs and revalidated on the server. No future assessment, portfolio/evidence or progress tabs are promoted. Admin Home links to existing academic administration and draft assessment setup. The existing administration forms and actions remain intact.

Teacher primary navigation is Home, My Teaching and Private Files. Admin navigation is Overview, School Administration, Assessment Setup and Private Files. Staff with both roles also get My Teaching, but it contains only their actual assignments. Deferred staff resources, calendar, community and generic media are absent from primary navigation; implementations remain intact.

Private Files is a hub for existing learner portfolio files, plus school media for administrators. It is deliberately not called My Files: the current model does not provide personal teacher storage. Teachers retain current-roster, read-only learner-file access. Upload, ownership, download, history and storage semantics are unchanged. Existing files are not relabeled as academic assessment evidence.

## Routes and components

| Path                                                                                                 | Change                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `app/page.tsx`                                                                                       | Replaces legacy activities/events with capability-aware Home and real teaching context.                        |
| `app/academics/page.tsx`                                                                             | My Teaching list and offering workspace at `?school=…&offering=…&view=overview\|learners`.                     |
| `app/files/page.tsx`                                                                                 | Private-file navigation hub, preserving existing access boundaries.                                            |
| `app/academics/loading.tsx`, `app/error.tsx`                                                         | Distinct loading and retryable unexpected-error states.                                                        |
| `app/layout.tsx`                                                                                     | CBE-oriented application metadata.                                                                             |
| `components/app-layout.tsx`                                                                          | Server wrapper deriving navigation from verified school capabilities.                                          |
| `components/app-shell.tsx`, `components/sidebar-nav.tsx`                                             | Responsive desktop/sidebar shell, school switcher, skip link, keyboard/mobile navigation.                      |
| `components/academic-workspace.tsx`                                                                  | Shared context, school-selection states and teaching cards.                                                    |
| `app/admin/academics/page.tsx`, `app/admin/assessments/page.tsx`, `components/school-files-page.tsx` | Preserve selected school in the shell; multiple schools require a choice instead of silently taking the first. |
| `lib/academic-context.ts`, `lib/academic-navigation.ts`                                              | Request-local context/read composition, URL construction, navigation and explicit period ambiguity.            |
| `lib/domain/foundation.ts`                                                                           | Current school context and assigned-only offering scope; adds grade/year identity to offering reads.           |

## Reused domain and authorization

The existing `foundationService` remains the authority for session identity, effective school roles, membership, teacher assignments, active offerings and dated learner participation. `getFoundation(school, 'assigned')` reuses the existing assignment SQL; its default accessible scope retains prior administration semantics. The workspace first resolves the offering in the assigned set and then calls the existing independently authorized `getOfferingRoster`. Counts also use `getOfferingRoster`, not wider raw enrolment totals.

`getSchoolContext` uses the same verified school transaction and the school's timezone for current-year/current-term reads. It returns capabilities rather than exposing membership or actor IDs to navigation. There is no client-authoritative permission input. Request caching is per server render, not a persistent cross-user cache.

A sole active membership may be inferred. Multiple memberships require selection; switching schools returns Home in that school rather than carrying a foreign offering. Invalid explicit school IDs never fall back. Multiple current years/terms are shown as ambiguous, and missing periods are explicit. An offering determines its academic year; term is derived from current school-local dates. This slice does not implement historical or future teaching-period selection.

Known domain errors render controlled unavailable/denied states without learner data. Unexpected database errors reach the retry boundary instead of producing misleading zero counts. Empty assignments and empty rosters have separate explanatory messages. The mobile menu hides closed links from keyboard traversal, makes the background inert while open, traps Tab and restores focus after closing.

No migrations, schema changes, authentication configuration changes or storage architecture changes were needed.

## Verification

| Executed check                      | Result                                                                                                                                                                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run typecheck`             | PASS. The later focus fix also passed production-build TypeScript checking.                                                                                                                                                            |
| `npm.cmd test`                      | PASS: 111 tests in 14 files.                                                                                                                                                                                                           |
| `npm.cmd run lint`                  | PASS: zero errors, 9 existing warnings (2 obsolete sidebar imports were removed).                                                                                                                                                      |
| `npm.cmd run build`                 | PASS after the focus fix, with network access for existing Google Fonts.                                                                                                                                                               |
| `npm.cmd run test:integration`      | PASS: 59 checks, all fixtures/mutations rolled back.                                                                                                                                                                                   |
| `npm.cmd run test:admin`            | PASS: 57 checks, all fixtures/mutations rolled back.                                                                                                                                                                                   |
| `npm.cmd run test:files`            | PASS: 23 checks, database changes rolled back; storage in memory only.                                                                                                                                                                 |
| `npm.cmd run test:teaching:browser` | PASS against the final production build: Home → My Teaching → offering → Learners, exact fixture roster, refresh, role navigation, forged context denial, draft denial, private files, 390px width, focus wrapping/Escape/restoration. |
| `npm.cmd run test:admin:browser`    | PASS against the final production build: six administration tabs, learner history, invalid action/rollover validation, mobile width, admin Home/navigation and draft assessment setup.                                                 |
| `git diff --check`                  | PASS. Historical migrations were not modified.                                                                                                                                                                                         |

Browser commands used `SMOKE_BASE_URL=http://127.0.0.1:3100`; the temporary production server used matching `BETTER_AUTH_URL`. No environment file was changed. Existing Node module-type and PostgreSQL SSL-mode warnings remain. This run used the installed Node v26.8.1; the repository recommends Node 24, so it is not a fresh Node 24 verification.

- New default tests: navigation capabilities, URL/context preservation, safe school selection, period ambiguity, missing session, foreign/revoked context and authorized roster-derived counts.
- Expanded rollback-only foundation integration: real current periods, assigned scope, malformed/foreign IDs, admin-only versus mixed-role behavior, alongside existing roster and temporal authorization checks.
- New `npm run test:teaching:browser`: actual seeded teacher journey, roster refresh, mobile layout/focus, forged contexts, draft denial and private files. No academic/storage mutation; authentication sessions are signed out.
- Existing admin browser checks additionally verify capability-aware Home/navigation and reachability of draft planning.
- Screenshots in `verification/cbe-shell/` are synthetic development data, not official school records.

Visual inspection: [desktop teacher Home](verification/cbe-shell/teacher-home-desktop.png) shows the small teacher sidebar, current school/year/term and three real assigned offerings. [390px Learners workspace](verification/cbe-shell/teacher-learners-mobile.png) shows subject/class/year/term, two usable workspace destinations and four authorized Mathematics learners without horizontal overflow. Counts differ legitimately by subject; none are invented.

Initial verification issues are retained in this record: sandbox networking prevented the first database connection and Google Fonts build fetch; network-enabled retries were used. One malformed-ID assertion initially expected a Promise rejection although the existing validator throws synchronously; the assertion was corrected without changing domain behavior. Browser runner synchronization was repaired for refresh/initial blank documents. Initial localhost runs encountered development-server ambiguity/timeouts, so final runs use an isolated production server on `127.0.0.1:3100` with matching auth origin. Mobile browser verification found a real focus-restoration bug: attempting focus before React removed `inert`. Focus now restores after the DOM update.

## Limitations and stop boundary

- Roster counts currently make one authorized roster read per offering. This favors policy reuse for the bounded slice; large assignment sets may need a policy-equivalent aggregate query and pagination in a later performance slice.
- Multi-school selection and period ambiguity have automated unit/service coverage; browser fixtures use the existing single-school seeded accounts.
- Teacher private uploads/personal storage and academic evidence linking are not available. Teacher file permissions remain read-only.
- A comprehensive accessibility audit, production RLS/deployment readiness, empty-database migration replay and live R2 mutation are outside this slice.
- Pathways/tracks/combinations, teacher assessment authoring/activation, participation, scoring, feedback, evidence associations, learner self-service/progress, DOS/principal analytics and KNEC readiness remain unimplemented.
- Assessments remain admin-only and draft-only. Referenced-task deletion/correction decisions and verified scoring policy remain prerequisites for future assessment work.

After final verification, stop. The next authorized activity is the product-design exercise for the teacher assessment journey, not its implementation. No commit, push or deployment is included.

## Additional changed-file inventory

Application/domain files are listed in the routes/components table above. Verification changes: `package.json`, `scripts/db-integration.mjs`, `scripts/admin-browser-smoke.mjs`, new `scripts/teaching-browser-smoke.mjs`, `tests/authorization/foundation.test.ts`, new `tests/authorization/academic-context.test.ts`, new `tests/unit/academic-navigation.test.ts`, and `tests/README.md`.

Project records: `.github/PROJECT_LOG.md`, `.github/ROADMAP.md`, `.github/ARCHITECTURE.md`, `.github/SECURITY_REQUIREMENTS.md`, `.github/TESTING_STANDARDS.md`, the baseline `.github/CBE_FRONTEND_ALIGNMENT.md`, this implementation record, and the two screenshots linked above. `.github/DEVELOPMENT_CHECKPOINT.md` and historical migrations remain unchanged. The pre-existing untracked `.kilo/agents/` directory is untouched.
