Goal:
You are working on the SchoolOS repository. Your job is to continue production implementation module-by-module until you are blocked by a decision that genuinely requires human input.

Primary objective:
Read all available project documentation first, including README, PRD, FRS, BRD, TSD, SDD, AGENTS.md, architecture docs, database/schema docs, frontend docs, backend docs, API docs, and any TODO/roadmap files.

Then:
1. Build an implementation inventory.
2. Identify incomplete production modules.
3. Rank them by priority using this order:
   - Security, authentication, authorization, tenant isolation
   - Core school operations required for MVP
   - Backend API/database gaps
   - Frontend screens still using mock/fake/placeholder data
   - Audit logging and compliance gaps
   - Error handling, validation, loading states, empty states
   - Tests and verification gaps
   - UI polish only after production functionality is complete

Strict rules:
- Follow SchoolOS architecture exactly.
- Maintain tenant isolation in every database query, API route, service, and UI data flow.
- Never use fake data, mock data, placeholder data, or in-memory state for production flows.
- Replace mock flows with real backend API/database integration.
- Do not rewrite working modules unnecessarily.
- Do not break existing UI/UX flows.
- Do not remove existing features unless clearly obsolete and documented.
- Do not commit, push, merge, rebase, reset, delete branches, or run destructive git commands.
- Do not expose secrets.
- Do not weaken authentication, authorization, validation, RLS, audit logging, or security checks.
- Do not skip verification.

Implementation protocol:
For each module:
1. Read relevant docs and existing implementation.
2. Determine what is incomplete.
3. Inspect backend, frontend, database schema, API contracts, types, validation, permissions, audit logs, and tests.
4. Implement only the missing production pieces.
5. Connect frontend to real backend APIs.
6. Ensure all writes persist to the database.
7. Ensure all reads are tenant-scoped.
8. Add or update tests where appropriate.
9. Run verification before moving on.
10. Review the diff for regressions, security issues, fake data, broken flows, and tenant leakage.

Definition of done for each module:
- No fake/mock/placeholder/in-memory production data remains.
- Backend API is implemented.
- Database persistence works.
- Frontend is integrated with real API.
- Tenant isolation is enforced.
- Role/permission checks are enforced.
- Audit logging exists for important create/update/delete/status actions.
- Loading, error, empty, and success states exist.
- Validation exists on frontend and backend.
- Relevant tests pass.
- Existing working behavior is not broken.

Verification:
Before moving to the next module, run the relevant available commands from the repo. First discover the correct commands from package.json, pnpm scripts, turbo config, Makefile, README, AGENTS.md, or docs.

Run whichever apply:
- install/build checks if needed
- lint
- typecheck
- unit tests
- integration tests
- backend tests
- frontend tests
- database migration checks
- production build

If a command fails:
- Diagnose the root cause.
- Fix it if it is related to your changes or required for the current module.
- Re-run verification.
- If it requires missing credentials, external service access, unclear business rules, or destructive migration approval, stop and ask for human input.

Running progress log:
Maintain this after every major step:

Current module:
Completed items:
Remaining items:
Risks:
Verification run:
Verification result:
Next action:

Stop conditions:
Stop only when:
- A human business decision is required.
- Required credentials/env variables are missing.
- A destructive database migration requires approval.
- There are conflicting docs/specs.
- The priority order is ambiguous and choosing incorrectly could cause major rework.
- A security/tenant/audit rule is unclear.
- Verification cannot be completed because of unavailable external systems.

Final output:
When stopped or finished, provide:
- Modules completed
- Files changed
- Verification commands run
- Passing/failing results
- Remaining modules
- Blocker requiring human decision, if any
