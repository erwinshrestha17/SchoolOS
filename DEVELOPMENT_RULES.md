# SchoolOS Development Rules

This file is the short operating rulebook for coding tasks. Full context lives in:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

---

## Current Stage

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
Current stage: Phase 2 implemented foundations + Phase 3 operations admin foundations
```

Phase 2 is underway in the repo, and Phase 3 operations admin foundations now exist. Work must focus on hardening, correctness, scale, permissions, tests, and UX polish for the existing modules rather than broad new product expansion.

Preferred next work:

```text
Harden one existing vertical at a time.
Priority areas: M9 Accounting correctness, production verification, reports/exports, tenant isolation, and Phase 2/3 admin UX completeness.
```

Explicitly deferred unless requested:

```text
Parent/mobile portal, driver app, live transport map/WebSocket UI, full canteen inventory/vendor workflows, AI/ML.
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
- Keep legacy roadmap files as pointers/summaries only unless explicitly asked to expand them again.

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

---

## Security Rules

- Tenant isolation is mandatory.
- Parent/student views must only expose own child/self data.
- Teacher views must only expose assigned data unless role permissions allow more.
- Sensitive data and files must use private access patterns.
- Use signed URLs for private files/media.
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
- Full M9 Accounting is Phase 2, but finance ledger foundations may continue.
- Other modules must not directly write ledger rows; use `AccountingPostingService` or a clear accounting boundary.
- Reports must come from backend ledger/report services, not frontend calculations.

---

## Scalability Gate for Every Feature

Before implementing a feature, answer:

```text
1. Which module owns this feature: M0 or M1-M10?
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
