# SchoolOS Development Rules

This file is the short operating rulebook for coding tasks. Full context lives in:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Also read the current audit before major backend/module work:

```text
docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
```

For gradual code-file modularization rules, read:

```text
docs/project/SCHOOLOS_CODE_FILE_MODULARIZATION_PLAN.md
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
Current stage: Phase 2A backend complete + Phase 2 foundations + M9 production-candidate completion + Phase 3 operations admin foundations
```

The repo is broad and advanced. Work must focus on stabilization, correctness, scale, permissions, tests, UX/API polish for existing modules, and gradual code-file modularization of touched areas rather than broad new product expansion.

Preferred next work:

```text
Repo Verification & Stabilization Sprint
→ full verification gate
→ Homework/Timetable schema/service/test alignment
→ Phase 2A Academics admin UI against completed backend APIs
→ authenticated Playwright browser smoke tests
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
Deep parent/mobile module expansion beyond the started Flutter companion app
Driver live-trip workflow beyond the started mobile shell
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
- Treat existing Phase 3 Library/Transport/Canteen admin workspaces as foundations to polish and harden; mobile screens must use purpose-limited APIs and must not reuse admin-shaped data directly.
- Do not start AI/ML features until reliable production data exists.
- Use `docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md` as the long-term source of truth.
- Use `docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md` for current repo risk/completion estimates.
- Use `docs/project/SCHOOLOS_CODE_FILE_MODULARIZATION_PLAN.md` before editing large services, controllers, dashboard workspaces, API clients, hooks, helpers, or future module files.
- Keep legacy roadmap files as pointers/summaries unless explicitly asked to expand them.
- After recent verification follow-ups, treat Homework/Timetable compile/schema/test stability as a high-priority gate before new module expansion.

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
- Code-file modularization is required as modules grow: split large files into focused files inside the same modular monolith.
- Code-file modularization is not microservices, not route rewriting, not separate deployment, and not a reason to change public contracts.

---

## Code-File Modularization Rules

- When touching a large file, check whether the current change should extract a focused service, component, hook, helper, or API client file.
- Modularize gradually in the touched area only unless the user explicitly asks for a wider cleanup.
- Split by business/screen responsibility, not arbitrary line count alone.
- Keep existing behavior, routes, API contracts, UI/UX, tenant boundaries, and database behavior stable during modularization.
- It is acceptable to keep the old service/controller/component as a thin facade during a safe migration.
- Do not create a massive repo-wide modularization PR unless explicitly requested.
- Future modules after M10/M11 must start with focused files from day one.

Backend split preference:

```text
services/<subfeature>-query.service.ts
services/<subfeature>-command.service.ts
services/<subfeature>-workflow.service.ts
reports/<module>-reports.service.ts
reports/<module>-exports.service.ts
helpers/<module>-formatters.ts
helpers/<module>-validators.ts
jobs/<module>.processor.ts
jobs/<module>.cron.ts
```

Frontend split preference:

```text
<module>-workspace.tsx       # thin shell only
tabs/<module>-*-tab.tsx
components/<module>-*.tsx
hooks/use-<module>-queries.ts
hooks/use-<module>-mutations.ts
hooks/use-<module>-forms.ts
utils/<module>-formatters.ts
utils/<module>-constants.ts
```

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
- `apps/schoolos_mobile` must consume the existing SchoolOS API with bearer auth, secure refresh-token storage, tenant slug login, and human-readable mobile error mapping.
- Do not use fake production data for implemented workflows.
- Preserve cookie-first browser auth.
- Do not store raw access/refresh tokens in browser storage.
- Show loading, empty, error, and permission-denied states.
- Parse API errors into readable messages.
- Keep Nepal school staff workflows fast and practical.
- Use server-side filtering/pagination; do not fetch all rows and filter in browser for growing datasets.
- Large dashboard workspaces should become thin shells with tab files, hooks, smaller components, and pure utilities.
- `apps/web/lib/api/client.ts` should remain the base HTTP client; domain-specific APIs belong in separate files.
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
15. Is the touched code already too large, and should this task include a small file-level modularization step?
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
- File-level modularization decisions, if any
- Tests run
- Verification results
- Remaining gaps
