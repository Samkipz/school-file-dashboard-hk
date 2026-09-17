# Assessment evidence decisions

Date: 2026-09-14.

## Approved policy

The owner selected “Use these rules (recommended)” in response to: “preserving linked evidence, blocking archive while it is referenced, and keeping teacher access tied to current assignments (admins retain historical access).” This approval covers those policy choices; it does not approve unspecified curriculum rules or constitute implemented assessment functionality.

1. Preserve assessment-linked evidence and its stored bytes.
2. Reject asset archival while an assessment evidence reference exists.
3. Teachers require current assignments; historical assignment alone does not retain access.
4. School Admin retains historical access within their currently authorized school.

## Proposed implementation contract

These details translate the approved policy into a reviewable design. No assessment association or archive guard has been implemented yet.

- An evidence association connects a learner attempt to an existing `media_assets` row. It stores the school, attempt, learner, asset and audit provenance, never a copied object or public URL.
- Use the existing `(school_id, id)` asset key for a composite FK. Bind the attempt and learner to the same school and enforce that the asset's `learner_id` equals the attempt's learner at the database boundary as well as in the service. A school-only FK does not prove same-learner identity. Review the exact additional composite key/FK or constraint trigger when generating the migration.
- Only ready, unarchived learner assets can be attached. Folder-only media, pending/failed uploads and another learner's asset cannot be attached. No automatic relabeling or movement of existing assets.
- Allow an asset to support more than one attempt through separate associations; prevent duplicate association of the same asset with the same attempt. Keep existing portfolio identity and bytes unchanged.
- Check the association and asset together in a transaction. The attach operation and archive operation must lock the same asset row in a consistent order so a concurrent archive cannot invalidate an attachment. Add database enforcement for both directions, including direct SQL archive attempts. Require a concurrency test.
- Treat any retained reference, including a superseded historical reference, as a retention hold. Ordinary application operations cannot delete evidence history merely to unblock archive. A future reviewed retention/disposal workflow must govern release; no automatic expiry or deletion period is invented here.
- Keep asset bytes and learner ownership immutable. Ordinary title/description/category edits can remain permitted and audited; the evidence association should preserve the descriptive snapshot used when linked. Corrections to evidence associations must be explicit and audited, not silent replacement. Exact correction commands are outside the first slice.

## Access behavior

| Caller/state | Intended behavior |
| --- | --- |
| Active School Admin in the evidence school | May inspect historical evidence even after learner withdrawal or a teaching assignment ends; still requires a ready asset and a valid association. |
| Active Teacher | Requires current school membership, Teacher role, active staff profile, current assignment to the assessment's offering and the applicable current learner participation. An unrelated current teaching assignment is insufficient for assessment access. |
| Assignment expired/revoked, learner withdrawn or school membership inactive | Teacher access is denied; asset/reference history remains retained. |
| Moderator-only, anonymous or another school | No new access is granted by this decision. Moderation permissions require a separately specified workflow. |

Reuse the existing private byte transport. Authorize assessment association access before resolving the asset; the portfolio download policy alone cannot stand in for assessment/offering authorization. Do not widen the existing portfolio route to grant historical teacher access. Inaccessible resources must use controlled error responses without exposing storage keys.

## Required future verification

- Same-school/same-learner attachment succeeds without a second R2 PUT.
- Foreign school, wrong learner, folder target, duplicate, pending, failed and archived asset cases fail.
- Referenced asset archive fails through UI/service and direct SQL; unreferenced asset archive still works.
- Concurrent attach/archive cannot both commit an invalid final state.
- Historical admin access and denied expired-teacher/withdrawn-learner access follow the table above.
- Association creation and audit commit together; late failure rolls both back.
- Existing portfolio, media, administration and lifecycle tests remain passing.

## Still outside this approval

Official retention duration, curriculum framework/weights, expanded formats or malware scanning, teacher upload implementation, moderation separation of duties, finalization corrections and publication audiences remain separate scope decisions. The current file service still permits only administrators to upload; approved future teacher evidence workflows will need assessment-scoped commands rather than general media mutation permission.
