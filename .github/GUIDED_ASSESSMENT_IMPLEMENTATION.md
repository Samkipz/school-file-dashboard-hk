# Guided teacher assessment preparation

## Scope (2026-09-22)

Teacher assessment lists now separate draft preparation from learner assessment. Creation starts only after choosing **Create assessment**. The assigned subject/class/year remain visible in the workspace header. The dedicated preparation screen has Details, Tasks and scoring, Result descriptions, and Review steps. Step changes retain local edits without saving. Session storage remembers only the step; assessment content is never stored there.

Task summaries expand one task at a time. Existing task fields, origin/authority/reference, optional term/dates, criterion/indicator ordering, range ordering/codes, and exact server scoring rules are retained. Result descriptions are optional and removing entered descriptions requires confirmation. Review renders the complete scoring guide as readable content with maxima and links to steps with detected issues. Opening explains the permanent definition lock and requires confirmation; the opened definition links to Assess learners.

Saving uses the existing server action and original revision. Inputs are disabled while saving; duplicate submission is guarded. Successful saves reload the committed definition to obtain authoritative child IDs and revision. Failed saves retain local fields. A conflicting save cannot silently replace the original revision or overwrite the competing edit. Reloading a failed draft explicitly confirms discarding local changes. Incomplete definitions remain saveable under existing domain rules (a name and type are still required; tasks/criteria may be absent).

Application links are guarded in capture phase. Browser unloading has the native unsaved warning. Browser Back/Forward uses cancellable Navigation API events where supported; browsers without this API retain application-link and unload protection. Native browser restrictions still apply. This is not crash recovery or offline persistence.

## Changed files

- `components/teacher-assessment-preparation.tsx`: teacher list, dedicated preparation, state, review and navigation protection.
- `app/academics/page.tsx`: teacher preparation route selection (`prepare=new`, existing `draft` URLs).
- `components/assessment-planning.tsx`: export the existing field group for reuse; administrator workflow retained.
- `components/scoring-guide-editor.tsx`: opt-in teacher guidance; administrator labels remain compatible.
- Browser runners updated to exercise the new journey and allow slower development database responses.

No domain service, authorization, revision/audit, learner assessment, schema, or migration changes are part of this work. Pre-existing uncommitted implementation work was preserved. No commit, push, deployment, reset or migration execution was performed.

## Verification

- Typecheck: PASS.
- Unit/action/authorization tests: PASS, 158 tests in 18 files.
- Lint: PASS, zero errors; nine pre-existing warnings.
- Final production build: PASS. Initial sandbox build failed to fetch Google Fonts; the network-enabled rerun passed.
- Administrator browser smoke: PASS, six tabs, lifecycle/history, validation, mobile and assessment setup.
- Teacher structured browser: PASS on the final product build for incomplete draft save/resume, two tasks, criteria/indicators, exact fractional maxima/ranges, keyboard indicator reorder, 390px layout, rejected range save retaining fields, cancelled description removal and application navigation, backward step navigation, real competing revision/stale save rejection with local values retained, explicit reload, review/open, readable locked summary, roster route, and forged/cross-school URLs. A further run adds network failure and browser Back cancellation; its result is pending.
- Administrator assessment browser: repeated create-stage timeout under investigation; not reported as passed.

Earlier browser attempts: isolated port login rejected until matching BETTER_AUTH_URL was set; sandbox database access then caused login failure until the verification server received network permission. A teacher navigation wait timed out. A subsequent teacher run reached a successfully opened definition but failed the runner's corrupted dash text assertion; its captured DOM confirms the opened summary, but that whole run is not a pass. An administrator assessment run timed out awaiting committed creation. Tests are being rerun against the final production build with corrected assertions and longer transition waits.

Synthetic browser assessment records and append-only audits are retained under the existing regression convention. No evidence uploads or R2 writes are performed. Browser screenshots are under `verification/guided-assessment/`. Human acceptance and comprehensive accessibility certification are not claimed.
