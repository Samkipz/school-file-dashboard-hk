# SchoolHub Security Requirements

## Stable task identity (2026-09-16)

Submitted task UUIDs are untrusted claims: syntax alone is insufficient. Resolve every claimed ID against the authorized school/draft, reject duplicates and foreign/unknown IDs, and preserve parent/creation identity. Structural task audit data excludes text and commits with all parent/child writes. Referenced-task deletion/correction policy requires approval before task dependents exist. See [hardening verification](ASSESSMENT_DRAFT_HARDENING.md).

## Admin-only assessment drafts (2026-09-14)

The draft slice uses the existing verified school/session boundary and requires effective School Admin for every assessment/type read and command. Teachers (including assigned teachers), moderator-only and cross-school callers receive no draft permission. Composite tenant/year FKs, cross-row date guards, aggregate optimistic revisions and transactional audit protect planning writes. See [implementation and actual verification](ASSESSMENT_FIRST_SLICE_IMPLEMENTATION.md). Evidence associations and retention/archive guards are still deferred.

## Portfolio/media and evidence policy update (2026-09-14)

The restored file service enforces school membership, admin-only mutations and current-roster teacher reads; private downloads authorize the asset before reading R2. See [portfolio implementation](PORTFOLIO_MEDIA_IMPLEMENTATION.md). The older foundation-only and pre-foundation descriptions below are historical.

The owner approved preserving assessment-linked evidence, blocking archive while referenced, current-assignment teacher access and historical school-admin access. See [evidence decisions](ASSESSMENT_EVIDENCE_DECISIONS.md) for proposed integrity/concurrency requirements. Assessment associations and their archive guards remain unimplemented; this policy approval is not a claim of existing protection for a future assessment feature.

## Implemented foundation controls (2026-09-10)

See the [foundation implementation record](FOUNDATION_SLICE_IMPLEMENTATION.md) for verified controls and limits. Active school/membership/role, dated staff allocation and learner participation now gate domain access. Composite school/context FKs reject invalid relationships; mutations and safe audit events share a transaction. All legacy table/R2 actions are disabled before access. Better Auth uses its native Next.js handler without credentialed origin reflection or wildcard bypass. RLS, production runtime DB privileges, onboarding and secured asset workflows remain deferred. Registration alone grants no school access.

## Pre-foundation audit baseline (historical)

- **FACT:** No role, membership, staff, school, tenant, learner enrolment, or teacher-assignment model exists in `lib/db/schema.ts`.
- **FACT:** Self-service email/password registration is exposed by `app/sign-up/page.tsx` and enabled in `lib/auth.ts`.
- **FACT:** Portfolio operations authorize session existence but do not scope students/files to `students.userId`; ID-based cross-user access is possible from `app/actions/portfolios.ts`.
- **FACT:** Staff/media folder and file operations generally authorize only a signed-in user, not folder ownership or tenant scope. Some list actions have no session check. Sources: `app/actions/staff-resources.ts`, `app/actions/media-files.ts`.
- **FACT:** The media download route allows any signed-in user to fetch a media object by ID without object ownership/scope authorization: `app/media-files/file/[id]/route.ts`.
- **FACT:** File upload has no server-side MIME/type/size policy and does not validate target folder ownership/existence before write. Sources: `app/actions/portfolios.ts`, `app/actions/staff-resources.ts`, `app/actions/media-files.ts`.
- **FACT:** R2 writes precede database records, and deletion failures are suppressed; object/database consistency is weak. Source: `lib/r2.ts` and the file action modules.
- **FACT:** The auth route reflects the request `Origin` while enabling credentialed CORS. Source: `app/api/auth/[...all]/route.ts`.
- **INFERENCE:** These findings create material IDOR, cross-user data exposure, orphan-object, and authorization-bypass risk if the system is used by multiple school users.

## Target security model

### Identity and tenancy

- **RECOMMENDATION:** Every business resource belongs to exactly one school/tenant or is linked through a school-scoped parent.
- **RECOMMENDATION:** A user accesses a school only through an explicit membership with active status and one or more explicit roles.
- **RECOMMENDATION:** Restrict onboarding to approved school creation/invitation policy; do not leave unrestricted registration enabled for production school data.

### Authorization

- **REQUIREMENT:** Authentication is not authorization.
- **REQUIREMENT:** Every protected resource must be authorized server-side against current membership, school, role, and permitted object scope.
- **REQUIREMENT:** Never authorize solely because a caller knows an ID.
- **RECOMMENDATION:** School Admin may configure academic structure, assignments, assessments, moderation, finalization, and publication. Teachers may access only their assigned subjects/classes/learners and permitted assessment states.
- **RECOMMENDATION:** Queries must include school scope and, where relevant, teacher assignment/enrolment conditions. Mutations must load and authorize the target before altering it.

### Files and evidence

- **REQUIREMENT:** Upload, download, presigning, metadata, and deletion require object-level authorization.
- **RECOMMENDATION:** Validate file size, permitted category, media type, extension, content where feasible, filename, target relationship, and actor scope server-side.
- **RECOMMENDATION:** Evidence inherits authorization from its linked learner/assessment/task; storage paths alone never grant access.
- **RECOMMENDATION:** Record immutable asset metadata, uploader, school scope, attachments, and lifecycle events. Handle R2/database failures explicitly with transaction/outbox/repair strategy.

### Assessment integrity

- **REQUIREMENT:** Scores, moderation actions, finalization, publication, and evidence access must be auditable.
- **RECOMMENDATION:** Finalized results are immutable to ordinary teacher edits. Corrections require privileged, logged reopening/versioning rather than silent mutation.
- **RECOMMENDATION:** Reports read finalized results; draft or unpublished results must not be exposed as official reports.

### Platform controls

- **RECOMMENDATION:** Restrict trusted origins and credentialed CORS to approved origins and methods.
- **RECOMMENDATION:** Use controlled forbidden/not-found/validation errors, avoid sensitive response fields, rate-limit sensitive endpoints as appropriate, and test negative authorization paths.
