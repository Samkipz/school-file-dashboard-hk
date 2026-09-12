# SchoolHub AI Engineering Instructions

Read [DEVELOPMENT_RULES.md](DEVELOPMENT_RULES.md), [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY_REQUIREMENTS.md](SECURITY_REQUIREMENTS.md), [ASSESSMENT_SPECIFICATION.md](ASSESSMENT_SPECIFICATION.md), [TESTING_STANDARDS.md](TESTING_STANDARDS.md), and [ROADMAP.md](ROADMAP.md) before changing relevant code.

- Inspect the existing code, schema, migrations, and tests before modifying anything. Never invent repository facts.
- Preserve the current architecture unless a documented, reviewed change justifies it. Do not change unrelated features.
- Follow migration discipline: reconcile migration history first, create reproducible migrations, and never manually assume database state.
- Authentication is not authorization. Authorize every protected resource against the current user's school, membership, role, and permitted scope.
- Never rely on client-side authorization, and never treat an ID alone as authorization.
- Preserve school/tenant isolation and teacher/learner assignment boundaries in every query, Server Action, API route, download, and mutation.
- Validate all untrusted input on the server. Apply file type, size, ownership, and object-level access checks before storage or retrieval.
- Write tests for security-sensitive behavior, especially authorization, IDOR, tenant isolation, enrolment, assignment, scoring, finalization, and publication.
- Run typecheck, lint, and relevant tests after changes. Do not mark work complete without reporting verification results.
- Update these documents whenever architecture, security boundaries, migrations, or the assessment domain changes.
