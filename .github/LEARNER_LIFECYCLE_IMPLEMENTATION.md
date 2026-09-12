# Learner lifecycle and academic-year rollover

Implemented on 2026-09-11, extending the existing foundation and administration service. No assessments, moderation, results, reporting, or R2 object operations were added.

## Delivered workflows

- School Admin can withdraw or complete a learner using a required reason and inclusive effective last day. The learner becomes `left` (displayed as Withdrawn) or `completed`; their open admission closes, and enrolments, placements and subject enrolments covering that date end together. Current roster access and active learner lists exclude the learner.
- Explicit re-admission accepts only withdrawn/completed learners, requires a reason and new unique admission number, and creates a new admission after every prior admission ends. It never reopens prior enrolments or admissions.
- Academic Year Rollover lets the administrator choose active source/destination years and explicitly select promote, repeat, complete or withdraw for each candidate. Destination dates must follow source-year dates. Promotion requires the next grade ordinal in the same curriculum; repetition requires the same grade. Class/year/grade references are validated on the server.
- A read-only server preview shows each outcome, destination class, dates, carried subjects, omitted subjects and optional teacher assignment changes. Nothing is automatically selected. An explicit confirmation checkbox enables execution.
- Commit rebuilds the preview snapshot and checks its digest, actor and school. Changes since preview require another preview. Execution uses the existing SERIALIZABLE transaction: all selected learners, placements, subjects, teacher assignments and audit events commit together or all roll back. Serialization conflicts require preview/retry rather than silent retries.
- Subject rollover carries subjects held at the end of the source enrolment only when the destination has an active offering for the same enabled school subject and an active, grade-applicable catalogue subject. Omissions appear in the preview for explicit review.
- Teacher copying is opt-in and limited to carried subject offerings and source-end assignments. Staff must currently hold an effective Teacher grant. Identical full-year destination assignments are retained; incompatible overlapping assignments block rollover. Shared assignments are deduplicated across selected learners. Source assignments are unchanged.

## Files and authorization

- `lib/domain/learner-lifecycle.ts`: lifecycle validation, closure/re-admission, preview, snapshot confirmation, atomic rollover and audit history.
- `lib/domain/administration.ts`: dispatches the new operations inside the existing verified school transaction, reads lifecycle audit history, and records before/after date/status values for updates.
- `app/actions/administration.ts`: bounded rollover payloads, preview responses, execution summary and route revalidation.
- `components/academic-administration.tsx`: status filters, lifecycle actions, re-admission and history.
- `components/academic-rollover.tsx`: source/destination selection, candidate decisions, preview and confirmation.
- Existing `/admin/academics` remains the administration route. `/academics` current rosters continue to enforce learner/admission/enrolment/subject status and dates.

Every new read/command enters `administrationService` and requires School Admin in the selected school. Identity comes from the server session. All tenant lookups are school-scoped; teacher/moderator roles confer no general administration permissions. Existing composite foreign keys, temporal guards and uniqueness constraints remain authoritative.

## History and schema

No schema or migration changes were necessary. Existing learner statuses, admission/enrolment intervals, append-only `audit_events`, tenant foreign keys and annual enrolment uniqueness support this slice.

Closure changes only records covering the effective date, preserving IDs, starts, creation provenance and earlier records. Closed historical rows are not reopened or reassigned. Each closure mutation records previous/next status or end date; a grouped `learner.lifecycle` event preserves reason, effective date and status transition. Promotion/repetition insert destination rows without updating source academic records. `learner.rollover` events link source enrolment, destination enrolment, outcome and confirmation digest. A prior rollover event prevents rolling the same source enrolment again, even toward another destination year. Destination uniqueness independently prevents duplicate annual enrolments.

## Operational limits

- Batches contain 1–100 explicitly selected learners. Both years must be active; rollover does not close the source year automatically.
- Lifecycle dates must be on or before the school's current date. Future scheduled enrolments/placements/subjects that would require inverted intervals block closure; future cancellation/scheduled lifecycle processing needs a separate workflow.
- Re-admission preserves the foundation rule of one enrolment per learner per academic year. Returning learners cannot create a second enrolment in that same year; same-year re-entry needs an approved schema/workflow extension.
- Administrators prepare destination classes and offerings first. New subjects that were not held in the source enrolment are added through normal subject administration. Preview omissions must be reviewed.
- Teacher eligibility is checked when copying; current access still depends on effective grants and assignments at request time.
- Preview currently snapshots school administration rows and catalogue rows conservatively. Unrelated changes can invalidate it, and data loading/temporal guards need narrowing and pagination before large-school scale.
- Current roster views and history panels are provided; historical reporting is outside this phase.

## Verification

- `npm run typecheck`: PASS.
- `npm run lint`: PASS, zero errors and 26 existing warnings outside the new workflow code.
- `npm run test`: PASS, 65 tests across six files.
- `npm run build`: PASS after retrying transient Google Fonts download failures with network access.
- `npm run test:lifecycle`: PASS, 41 live PostgreSQL checks, all fixture mutations rolled back. Covers closure, dates/reasons, history, roster exclusion, completion, explicit re-admission, promotion/repeat, placement, subject/teacher copying, duplicate prevention, stale/absent confirmation, late-failure rollback, future-record rejection, cross-school rejection and all new commands denied to Teacher/Moderator/anonymous callers.
- `npm run test:admin`: PASS, all 57 existing administration regression checks; fixture mutations rolled back.
- `npm run test:admin:smoke`: PASS, anonymous redirect, admin page, invalid-school handling, and Teacher/Moderator denial without learner disclosure.
- `npm run test:admin:browser`: PASS against the production build in headless Chrome: all six tabs, lifecycle controls/history, no default rollover outcome, explicit outcome and destination selection, rejected same-year preview with no confirmation button, real Server Action validation and 390px mobile layout. Successful commits are exercised by PostgreSQL integration tests; browser smoke submits no valid mutations.
- Final `npm run db:verify`: PASS, 25 public tables, 289 columns, 83 validated/indexed foreign keys, two matching migration checksums, nine provider tables present, and original foundation seed counts (four learners/admissions/enrolments/placements, twelve subject enrolments, three teacher assignments, one audit event).

Development database tests use the pre-existing owner-pinned endpoint/database fingerprint for `schoolhub-fresh-dev`; they do not reset, migrate or reseed the database. The pin is owner verification, not a new provider-control-plane assertion. No credentials are included in test output or this record.

Recommended next implementation step: address same-year re-entry and scheduled cancellation requirements, then validate the lifecycle/rollover UX with school administrators before beginning the separately approved assessment phase.
