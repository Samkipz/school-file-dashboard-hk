# SchoolHub Development Rules

## Status language

- **FACT** — directly observed in the repository.
- **INFERENCE** — conclusion drawn from repository evidence.
- **REQUIREMENT** — project requirement supplied for SchoolHub; framework provenance must be linked when implemented.
- **RECOMMENDATION** — proposed architectural decision, pending approval where applicable.

## 1. Repository discipline

- Inspect the worktree, relevant files, existing migrations, and tests before a change.
- Keep changes narrow. Do not modify unrelated features or generated artifacts.
- Preserve a coherent repository root and never commit credentials, local environment files, or build output.

## 2. Architecture discipline

- Keep App Router pages, reusable UI components, domain actions/services, schema, and storage concerns clearly separated.
- Current direct database access from Server Actions is a **FACT**. New assessment work should introduce reviewed domain boundaries without duplicating business rules per grade.
- Grade, term, subject, and academic year are data, not source-code branches.

## 3. Database changes

- Reconcile the current migration journal, migration files, snapshots, and target database before adding migrations.
- Every schema change requires a generated, reviewed, reproducible migration and rollback/repair plan where applicable.
- Add foreign keys, uniqueness constraints, indexes, and deletion behavior deliberately. Do not rely on application code for essential integrity.

## 4. Authentication

- Use the configured session mechanism to identify the current user on the server.
- Registration, session settings, trusted origins, and authentication routes are security changes and require review and tests.

## 5. Authorization

**Authentication != Authorization.**

Every protected resource must be authorized against the current user's school, role, and permitted scope. Never use an ID alone as proof of authorization. Queries and mutations must enforce tenant/school scope, membership, object ownership or assignment, and state-transition permissions.

## 6. Server Actions

- Treat every Server Action argument and `FormData` value as untrusted.
- Establish identity, validate input, authorize the object and relationship, execute the domain operation, and return controlled errors.
- Server Actions must not depend on page-level redirects or client-side filtering for protection.

## 7. API routes

- Authenticate and authorize each route independently.
- Limit methods, origins, response fields, cache behavior, and error details deliberately.
- Do not reflect arbitrary origins with credentialed CORS. Do not expose internal storage keys or secrets.

## 8. File/object storage

- Verify target ownership/scope before upload, download, presigning, deletion, or metadata access.
- Validate type, extension, content where feasible, file size, filename, and permitted evidence category server-side.
- Use a reusable asset/attachment model; do not duplicate objects for portfolio and assessment evidence.
- Handle database/storage consistency explicitly and retain auditable metadata.

## 9. Validation

- Validate all server inputs using shared schemas or equivalent explicit checks.
- Enforce required fields, lengths, allowed values, dates, numeric ranges, relationships, state transitions, and score/rubric rules.

## 10. Error handling

- Return controlled not-found, forbidden, validation, and conflict outcomes; do not dereference absent query results.
- Do not silently suppress storage or persistence failures. Log safe diagnostic context without leaking sensitive data.

## 11. Testing

- Add focused unit, integration, and authorization tests with every new domain capability.
- Security-sensitive changes require negative tests for cross-school, cross-teacher, and ID-based access attempts.

## 12. TypeScript

- Maintain strict type safety. Do not use `any`, unsafe casts, or ignored build errors to bypass domain correctness.
- Typecheck must pass in CI; production builds must not mask TypeScript failures.

## 13. Documentation

- Update architecture, security, assessment specification, roadmap, and testing standards when their governed behavior changes.
- Label repository observations versus decisions accurately.

## 14. AI-assisted development

- AI assistants must inspect before editing, cite relevant file paths in handoff, follow these rules, and verify their changes.
- AI-generated code is subject to the same migration, authorization, validation, testing, and review standards as human-authored code.
