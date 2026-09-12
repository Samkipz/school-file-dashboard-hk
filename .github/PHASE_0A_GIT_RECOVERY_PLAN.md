# Phase 0A — Git Recovery Plan

## 1. Current Git State

All observations below were made without moving, deleting, restoring, overwriting, or committing files.

- **FACT:** Current working directory: `C:\Users\Sam\Documents\Backup\codezone\school-cloud`.
- **FACT:** The usable Git root is `C:\Users\Sam\Documents\Backup\codezone\school-cloud`.
- **FACT:** `school-cloud\.git` exists and is a valid Git repository.
- **FACT:** The current branch in `school-cloud` is `main`.
- **FACT:** The current `HEAD` is `181ff20` (`Added school event calendar1`). The repository contains 25 commits across its local history.
- **FACT:** The configured remote is `https://github.com/Samkipz/school-file-dashboard-hk.git`. No credential-bearing remote value is recorded in this plan.
- **FACT:** `codezone\.git` exists as an empty directory, but Git does not recognize `C:\Users\Sam\Documents\Backup\codezone` as a repository. It has no usable repository metadata or history.
- **FACT:** The nested repository has no deleted tracked paths.
- **FACT:** The nested repository has two modified tracked paths: `next-env.d.ts` and `tsconfig.tsbuildinfo`.
- **FACT:** The nested repository has untracked `.github` project instruction/audit documents, including the source documents read for this phase and this plan.
- **FACT:** `.env.local`, `.next`, and `node_modules` are ignored by the nested repository. Their contents were not inspected.
- **FACT:** The parent-level `Credentials` directory was not inspected. Its contents must remain outside the repository and must not be printed, copied, or committed.

The earlier `PHASE_0_AUDIT.md` describes a parent-root deletion/untracked-tree state. That is not the current executable state: the parent Git marker is now empty/unusable, while `school-cloud` has a valid repository containing the application. The historical audit remains useful context, but current commands are the authority for recovery planning.

## 2. Repository Topology

Current physical layout:

```text
C:\Users\Sam\Documents\Backup\codezone\
├── .git\                 empty, unusable marker; not a Git repository
├── Credentials\          untracked parent-level directory; not inspected
└── school-cloud\         valid Git repository; canonical application candidate
    ├── .git\
    ├── app\
    ├── components\
    ├── lib\
    ├── drizzle\
    ├── public\
    ├── .github\
    └── package/configuration files
```

- **FACT:** There is no parent-level `app`, `components`, `lib`, `drizzle`, `public`, `package.json`, or comparable project copy available for comparison.
- **FACT:** The application is tracked at repository-root-relative paths inside `school-cloud`, including `app/`, `components/`, `lib/`, `drizzle/`, `public/`, `package.json`, `drizzle.config.ts`, `next.config.mjs`, `postcss.config.mjs`, `tsconfig.json`, and `vercel.json`.
- **FACT:** The only Git history discovered for the application is the history in `school-cloud\.git`.
- **INFERENCE:** The empty parent `.git` directory is likely leftover filesystem state, not a recoverable parent repository. This must be verified by a human before any cleanup or relocation.

## 3. Parent vs school-cloud Comparison

There are not two application copies to merge. The parent contains no project files at the paths listed in the audit, so an identical/newer/older file comparison cannot be performed for a parent application copy.

The usable `school-cloud` worktree was compared with its own `HEAD` as the available baseline:

- **MATCH:** `package.json`, `drizzle.config.ts`, `next.config.mjs`, `postcss.config.mjs`, `tsconfig.json`, `vercel.json`, and `app/`, `components/`, `lib/`, `drizzle/`, and `public/` have the expected tracked file counts and the checked configuration files match `HEAD` by SHA-256.
- **DIFFERENCE:** `next-env.d.ts` differs from `HEAD` and is modified in the worktree. It is generated/tooling-related and must be preserved until a human decides whether to keep or regenerate it.
- **DIFFERENCE:** `tsconfig.tsbuildinfo` differs from `HEAD` and is modified in the worktree. It is generated compiler state and must not be used as evidence of application-source divergence.
- **UNTRACKED:** `.github/` contains eight audit/instruction documents in the worktree and none of those files are present in `HEAD`. These documents are work that must be preserved and reviewed before any staging decision.
- **NOT INSPECTED:** `.env.local`, `node_modules`, `.next`, and parent `Credentials` were excluded from inspection because they may contain secrets, generated state, or dependency output.

### Requested high-risk areas

`app/`, `components/`, `lib/`, `drizzle/`, and `public/` contain the same tracked file counts as `HEAD`; no parent copy exists to compare against. The important configuration files listed above also match `HEAD`, except for the generated `next-env.d.ts` and `tsconfig.tsbuildinfo` differences noted above. No database, migration, application source, authentication, or authorization file was changed during this inspection.

## 4. Risks

- **Risk: accidental loss of untracked work.** The `.github` audit/instruction documents are untracked in `school-cloud`. Any recovery operation that replaces or recreates the directory could lose them.
- **Risk: loss of local generated changes.** `next-env.d.ts` and `tsconfig.tsbuildinfo` differ from `HEAD`. They may be regenerated, but that decision has not been made and they must be backed up first.
- **Risk: credential exposure.** `Credentials` and `.env.local` may contain secrets. They must not be copied into Git, included in archives shared with others, or printed in diagnostics.
- **Risk: remote/deployment confusion.** The nested repository remote points to `school-file-dashboard-hk.git`, while the local folder is named `school-cloud`. A human must confirm that this remote is the intended GitHub project before pushing or changing repository metadata.
- **Risk: Vercel project association.** `vercel.json` is present and matches `HEAD`, but Vercel project linkage may exist outside the file. Changing repository location or GitHub linkage can affect deployment triggers and project settings.
- **Risk: parent marker cleanup.** Removing or repurposing the empty parent `.git` directory is not needed to use `school-cloud` as the canonical repository and should not happen until a human verifies it contains no recoverable metadata.
- **Risk: assumptions from the historical audit.** The parent deletion/untracked-tree state described in `PHASE_0_AUDIT.md` is not reproducible in the current filesystem. Recovery actions must use the current state, not blindly execute historical assumptions.

## 5. Recovery Options

### Option A

**Make `school-cloud` the Git repository root.**

- **Benefits:** This is already the current valid Git topology. The application is at repository root, the existing Git history is preserved, and future Codex, CI, GitHub, and deployment paths are predictable.
- **Files affected:** No application files need to move. The human would only need to preserve/review the current untracked `.github` documents and decide how to handle the two modified generated files. The parent empty `.git` marker can remain untouched until separately approved.
- **History:** Preserved in `school-cloud\.git`, including the current `main` branch and local commit history.
- **Untracked-work risk:** Low if the current directory is first copied or archived without secrets and the `.github` files are explicitly accounted for. High if the directory is recreated or replaced without a manifest and backup.
- **GitHub/Vercel risk:** Lowest of the options because the existing remote and `vercel.json` remain in place. GitHub/Vercel association must still be confirmed before any push or deployment setting change.
- **Assessment:** Recommended, subject to human confirmation that the configured remote is intended and that the empty parent marker is not needed.

### Option B

**Keep `codezone` as the Git repository root and treat `school-cloud` as a subdirectory.**

- **Benefits:** This could support a deliberate monorepo or backup container layout if other repositories or projects are intended to live under `codezone`.
- **Files affected:** It would require creating or repairing valid parent Git metadata and deciding how the nested `.git` repository is handled. It may require tracking the project under `school-cloud/` and updating CI, GitHub checkout paths, Vercel root-directory settings, and local tooling assumptions.
- **History:** The nested application history would not automatically become parent-root history. Preserving it would require an approved history-preserving Git operation or a carefully documented import; no such operation should be inferred or performed now.
- **Untracked-work risk:** High. The nested repository, its untracked `.github` documents, ignored local files, and any parent `Credentials` material could be confused during import or cleanup.
- **GitHub/Vercel risk:** Medium to high. Repository-root assumptions, Vercel root directory, CI paths, build commands, and GitHub workflows could change.
- **Assessment:** Not recommended unless `codezone` is intentionally being designed as a multi-project monorepo and a separate migration plan is approved.

### Option C

**Recover the parent-level project into a clean repository elsewhere.**

- **Benefits:** Provides an isolated recovery copy and a strong rollback point before any future repository cleanup. It is useful if forensic preservation of the historical parent layout is required.
- **Files affected:** A full non-destructive copy/archive would be created elsewhere, excluding secrets or protecting them separately. The current `school-cloud` repository would remain untouched.
- **History:** The nested repository history can be preserved by copying its `.git` directory with the project, but a new clean location must not be initialized over it without approval. The empty parent `.git` has no history to preserve based on current inspection.
- **Untracked-work risk:** Low if the copy is verified with a manifest and hashes before any further action; otherwise generated files and untracked `.github` work could be omitted.
- **GitHub/Vercel risk:** Low to the current application if no remote or deployment settings are changed. A separately recovered copy must not be pushed or connected to deployment until explicitly approved.
- **Assessment:** A useful backup/rollback step, but not a replacement for Option A. It is recommended as a precaution before later cleanup, not as the canonical layout by itself.

## 6. Recommended Recovery Strategy

**RECOMMENDATION:** Adopt **Option A**: keep `C:\Users\Sam\Documents\Backup\codezone\school-cloud` as the canonical Git repository and application root.

This prioritizes zero data loss, preserves the only usable Git history, keeps the current working application in place, avoids an unnecessary parent-level import, and gives future Codex/CI/deployment work a normal repository-root layout. Option C should be used as a non-destructive backup measure before any later cleanup. Do not adopt Option B unless a separate monorepo decision is made.

The recommendation does not authorize execution. In particular, it does not authorize deletion of the empty parent `.git`, staging/committing the untracked `.github` documents, discarding generated-file differences, changing the remote, or touching credentials.

## 7. Exact Safe Steps

The following steps are for human review and approval only. They were **not executed** during Phase 0A.

1. Freeze repository-changing activity. Do not run `git clean`, `git reset`, checkout/restore commands, deletion commands, or migration commands.
2. Confirm that `school-cloud` is the intended application and that `https://github.com/Samkipz/school-file-dashboard-hk.git` is the intended remote. Confirm this without exposing any remote credential material.
3. Make a non-destructive backup of the entire `school-cloud` directory, including its `.git` directory and untracked `.github` documents. Keep the backup outside `codezone` and verify that its file manifest and hashes are complete. Handle `.env.local`, `node_modules`, `.next`, and `Credentials` according to a separate secret-handling policy; do not publish them.
4. Record the current `school-cloud` commit, branch, remote name, status, and file manifest in the recovery record. Do not stage or commit as part of this step.
5. Review the two modified tracked files, `next-env.d.ts` and `tsconfig.tsbuildinfo`, and decide whether each is intentional, disposable generated state, or required local work. Preserve both in the backup before making any decision.
6. Review the untracked `.github` documents and decide which are intended project documentation. Do not delete or overwrite any of them. If approved for version control, stage them in a later, separate documentation change; do not mix that decision with repository recovery.
7. Leave `school-cloud` as the repository root. Do not move its contents to the parent and do not initialize another repository.
8. Leave the empty parent `codezone\.git` untouched until a human separately verifies it is empty and approves its removal or retention. Its removal is not required for Option A.
9. After explicit approval, run only non-destructive verification from `school-cloud`: repository root, branch, status, tracked/untracked/deleted path listings, and remote-name inspection with credentials redacted.
10. Only after the verification record is accepted should the human approve any later documentation commit, generated-file cleanup, parent-marker cleanup, GitHub operation, or Vercel configuration change as separate tasks.

## 8. Verification Steps

Before any future change is considered complete, a human should verify:

- `git -C school-cloud rev-parse --show-toplevel` resolves to `school-cloud`.
- `git -C school-cloud branch --show-current` remains `main` unless a branch change is explicitly approved.
- `git -C school-cloud status --short --untracked-files=all` is understood line by line; no deletion or untracked application tree appears unexpectedly.
- The tracked path list still includes `app/`, `components/`, `lib/`, `drizzle/`, `public/`, `package.json`, and the required configuration files.
- The untracked `.github` documents are present and accounted for.
- `Credentials`, `.env.local`, `node_modules`, and `.next` are not tracked or included in any shared recovery artifact.
- The remote URL is the approved GitHub repository, inspected only in sanitized form.
- The backup can be opened as an independent copy and contains the same repository history and worktree files as the pre-recovery manifest.
- No GitHub push, Vercel deployment, database migration, application-code change, authentication change, or authorization change occurred during recovery planning.

## 9. Rollback Strategy

Because this phase performs no recovery operation, the immediate rollback is simply to leave the current filesystem unchanged. If a later approved recovery step causes concern:

1. Stop immediately; do not run cleanup or reset commands.
2. Preserve the affected worktree and capture sanitized status output.
3. Keep the verified pre-change backup and use it as the restoration source only after human review.
4. Restore by replacing the affected working directory from the verified backup through an explicitly approved file-recovery procedure, preserving the backup itself. Do not use `git reset --hard`, `git clean`, or checkout/restore as a substitute for the backup.
5. Re-run the verification steps above and compare manifests/hashes before considering the repository recovered.
6. If GitHub or Vercel settings were changed, roll them back through their respective reviewed administrative controls; do not infer deployment settings from local files.

## 10. Human Approval Required

Before changing anything, a human with authority over the project must explicitly approve:

- `school-cloud` as the canonical Git repository root.
- The configured GitHub remote as the intended remote, or a separately reviewed remote change.
- Creation and verification of a complete non-destructive backup of the current repository and untracked work.
- Treatment of modified `next-env.d.ts` and `tsconfig.tsbuildinfo`.
- Treatment and eventual version-control status of the untracked `.github` documents.
- Retention or separately approved cleanup of the empty parent `codezone\.git` marker.
- Any later Git staging, commit, push, branch, GitHub repository, CI, or Vercel configuration operation.
- Confirmation that no credentials, environment files, tokens, passwords, API keys, or secret-bearing directories are copied into Git or shared recovery artifacts.

No recovery action is authorized by this document itself. Phase 0A ends with inspection and this reviewable plan.
