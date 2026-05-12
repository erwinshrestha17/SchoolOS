# SchoolOS Development Rules

This file is the short operating rulebook for coding tasks. Full context lives in:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Also read the current audit before major backend/module work:

```text
docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
```

---

## Current Stage

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core Foundation Depth: Completed
Phase 2A M4 Academics backend: Completed / Contract-Protected
Phase 2D M9 Accounting: Production Candidate Complete
Current stage: Backend Sprints 1-4 hardening complete on top of Phase 2A backend + M0 platform foundation + M9 production-candidate completion
```

The repo is broad and advanced. Work must focus on stabilization, correctness, scale, permissions, tests, and UX/API polish for existing modules rather than broad new product expansion.

Preferred next work:

```text
Docker/staging pilot readiness sprint
→ run Docker-backed smoke with Postgres, Redis, and API running
→ add seeded authenticated Playwright credentials
→ Phase 2A Academics admin UI against completed backend APIs
→ deeper M6/M7/M8 vertical hardening one module at a time
→ controlled pilot staging readiness
```

Hardening priorities after stabilization:

```text
1. Phase 2A Academics frontend/admin UI and browser workflow contracts.
2. M6 Homework/Timetable service/schema/test depth.
3. M7 HR/Payroll deeper lifecycle/accounting tests.
4. M8A Library reports/fines/service tests.
5. M8B Transport parent/driver/live tracking boundaries later.
6. M8C Canteen inventory/vendor/accounting later.
7. M10 parent-teacher chat service tests and provider callback depth.
```

Explicitly deferred unless requested:

```text
Angular migration
Parent/mobile portal
Driver app
Live transport map/WebSocket UI
Full canteen inventory/vendor workflows
AI/ML implementation
Microservices
```

---

## Working Mode

- Prefer small, focused changes.
- Do not rewrite unrelated files.
- Do not change architecture without explicit instruction.
- Do not start broad new Phase 3 or Phase 4 scope unless explicitly requested.
- Treat existing Phase 3 Library/Transport/Canteen admin workspaces as foundations to polish and harden, not as permission to build parent/mobile or driver experiences.
- Do not start AI/ML features until reliable production data exists.
- Use `docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md` as the long-term source of truth.
- Use `docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md` for current repo risk/completion estimates.
- Keep legacy roadmap files as pointers/summaries unless explicitly asked to expand them.
- Homework/Timetable compile/schema/test stability is currently passing; keep it protected while adding depth incrementally.

---

## Architecture Rules

- Keep NestJS modular monolith.
- Do not introduce microservices unless explicitly justified and requested.
- Keep PostgreSQL with Prisma.
- Keep Redis with BullMQ for queues and background jobs.
- Keep current Next.js dashboard in `apps/web` for now.
- Do not migrate to Angular yet.
- Do not rename `tenantId` to `schoolId`.
- Keep Platform Control Plane, Tenant Configuration Plane, and School Operations Plane separated by route, permission, and responsibility.

---

## Backend Rules

- Backend-first for data integrity.
- Controllers should stay thin.
- Business rules belong in services/domain boundaries.
- Validate all external input.
- Use transactions for multi-step business writes.
- Every tenant-owned query must be scoped by authenticated `tenantId`.
- Every business-critical write must be audited.
- Super-admin/platform support tenant override must be explicit, validated, and audited.
- List endpoints for growing data must use pagination and filtering.
- Add/review indexes for high-volume tenant-scoped query patterns.
- Move slow/retryable/provider/report/PDF jobs to BullMQ where appropriate.
- Do not bypass service boundaries by writing another module's internal tables directly.
- Do not bypass `AccountingPostingService` for ledger writes.

---

## Frontend Rules

- UI must consume real APIs.
- Do not use fake production data for implemented workflows.
- Preserve cookie-first browser auth.
- Do not store raw access/refresh tokens in browser storage.
- Show loading, empty, error, and permission-denied states.
- Parse API errors into readable messages.
- Keep Nepal school staff workflows fast and practical.
- Use server-side filtering/pagination; do not fetch all rows and filter in browser for growing datasets.
- Route boundaries must stay clear:
  - `/platform/*` for SchoolOS operators.
  - `/dashboard/settings/*` for school/tenant settings.
  - `/dashboard/*` for school operations.
- Phase 2A Academics admin UI must use the completed backend APIs and should be covered by browser smoke tests.

---

## Security Rules

- Tenant isolation is mandatory.
- Parent/student views must only expose own child/self data.
- Teacher views must only expose assigned data unless role permissions allow more.
- Sensitive data and files must use private access patterns.
- Use signed URLs or protected API URLs for private files/media.
- Avoid permanent public URLs for student media and documents.
- Platform users must not enter tenant data silently; support override requires an explicit reason and audit log.
- UI visibility is not security; backend guards and tenant filters enforce access.

---

## Money and Accounting Rules

- Use Decimal/numeric money handling.
- Do not use floating point for money calculations.
- Confirmed financial records should not be silently edited.
- Use reversal/correction workflows for payment mistakes.
- Receipt, invoice, journal, and voucher numbers must be tenant/fiscal-year safe.
- M9 Accounting is production-candidate complete but remains inside the modular monolith.
- Other modules must not directly write ledger rows; use `AccountingPostingService` or a clear accounting boundary.
- Reports must come from backend ledger/report services, not frontend calculations.
- Audit posting, approval, reversal, closing, reopening, bank reconciliation, and exports.

---

## Scalability Gate for Every Feature

Before implementing a feature, answer:

```text
1. Which module owns this feature: M0 or M1-M11?
2. Which backend folder/API namespace/frontend route owns it?
3. Which tenant owns this data?
4. Which role/permission can access it?
5. Is the list paginated?
6. Which index supports the main query?
7. Does the write need a transaction?
8. Is the operation idempotent?
9. Should this be sync or queued?
10. Does it require audit logging?
11. Does it affect accounting/ledger?
12. What tests prove tenant isolation and permissions?
13. If pricing/tiered access is involved, which feature key, entitlement, and usage limit controls access?
14. If intelligence/AI is involved, is the output explainable and human-reviewed?
```

Feature is not production-ready until these are answered.

---

## Verification Commands

Run relevant checks after meaningful changes:

```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
pnpm smoke:phase1
```

For the immediate stabilization sprint, run the full gate before marking the repo healthy.

---

## Final Response Format for Codex Tasks

Return:

- Summary
- Files changed
- Backend/API/frontend ownership decisions
- Scalability decisions
- Tests run
- Verification results
- Remaining gaps
