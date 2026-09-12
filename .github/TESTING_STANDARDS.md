# SchoolHub Testing Standards

## Foundation verification (2026-09-10)

The [foundation implementation record](FOUNDATION_SLICE_IMPLEMENTATION.md) records 41 default tests, 51 real-PostgreSQL integration checks, a concurrent temporal-write test, migration/seed replay, live schema verification and HTTP Better Auth smoke testing. Database tools require the locally pinned, owner-verified disposable development endpoint and are never run by default tests or build. The integration suite rolls back all its data; the concurrency suite removes its temporary year/terms. See [test commands](../tests/README.md).

## Engineering baseline (historical)

- **FACT (R5B):** ESLint uses the Next.js flat presets; Vitest runs a small database-independent unit suite. GitHub Actions configuration runs typecheck, lint, tests and build. See [engineering baseline evidence](PHASE_0R5B_ENGINEERING_BASELINE.md) and [test conventions](../tests/README.md).
- **REQUIREMENT:** Run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run build`. Unit tests require no database/R2 credentials; database integration, migration replay and browser runners remain deferred.
- **RECOMMENDATION:** Establish the isolated database fixture strategy and verify hosted CI/branch protection before security-critical foundation or Assessment rollout. The baseline utility test is not authorization or integration coverage.

## Required test categories

| Category | Minimum assertions |
|---|---|
| Authentication | Unauthenticated actions/routes fail; valid session is recognized. |
| Authorization | Roles and memberships permit only intended operations. |
| IDOR | Knowing another object ID cannot read, alter, delete, download, or presign it. |
| School isolation | Cross-school queries, files, learners, scores, and reports are inaccessible. |
| Teacher assignment | Teacher access is limited to assigned subject/class/stream/year. |
| Learner enrolment | Learner can be assigned/scored only in valid school/year/subject enrolment context. |
| Assessment creation | Required context, allowed types, scopes, and lifecycle rules validate. |
| Score validation | Values, maximums, criterion/rubric bounds, assessor permissions, and duplicates validate. |
| Rubrics | Criteria/weights/levels calculate and version correctly. |
| Finalization | Incomplete/unauthorized finalization fails; finalized results resist ordinary edits. |
| Publication | Only authorized finalized results can publish; drafts remain unavailable. |
| Evidence authorization | Upload/download/delete/presign checks object relationship, school, role, and assignment. |

## Test approach

- **RECOMMENDATION:** Unit-test calculations, state transitions, and validation schemas.
- **RECOMMENDATION:** Integration-test Server Actions/API routes against an isolated test database and storage adapter.
- **RECOMMENDATION:** Use at least two schools, multiple roles, assigned/unassigned teachers, and enrolled/unenrolled learners in fixtures.
- **RECOMMENDATION:** Include regression tests for every discovered authorization defect and migration repair.

## Definition of Done

A feature is **not complete** until:

- typecheck passes;
- lint passes;
- relevant tests pass;
- authorization is tested, including negative/IDOR cases;
- validation is tested;
- database migration is reproducible and reviewed;
- documentation is updated;
- no unrelated functionality is broken.
