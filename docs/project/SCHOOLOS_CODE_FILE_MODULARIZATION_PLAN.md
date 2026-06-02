# SchoolOS Code-File Modularization Plan

**Last updated:** 2026-06-02

**Purpose:** This document defines how SchoolOS should gradually break large source files into smaller focused files while keeping the existing modular-monolith architecture.

This is **not** a microservices plan.

SchoolOS remains a NestJS modular monolith with Next.js web, Flutter mobile, PostgreSQL/Prisma, Redis/BullMQ, and shared contracts in `packages/core`.

---

## 1. Core Rule

```text
Code-file modularization means:
- Split huge services/components/controllers/helpers into focused files.
- Keep the same application/module boundaries.
- Keep the same public routes and API contracts.
- Keep the same database schema unless the feature itself requires a schema change.
- Keep the same UI/UX unless the task explicitly asks for UX change.

Code-file modularization does not mean:
- Creating microservices.
- Splitting deployment units.
- Moving modules into separate apps.
- Rewriting working features from scratch.
- Changing tenantId or product-plane boundaries.
```

When Codex works on M0-M10 or any future module, it should opportunistically improve file structure in the touched area instead of trying to modularize the whole repo at once.

---

## 2. When to Modularize a File

A file should be split when one or more of these are true:

```text
1. It is difficult to understand without scrolling through many unrelated responsibilities.
2. It mixes multiple business subdomains in one service/component.
3. It contains many unrelated React states, queries, mutations, forms, or tab screens.
4. It contains many private helper functions that belong to different subfeatures.
5. It imports many DTOs/types for unrelated workflows.
6. It is changed frequently by different features and creates merge/conflict risk.
7. A new change would make the file noticeably larger or harder to test.
```

Avoid mechanical splitting just to create more files. Split by **business responsibility** and **screen responsibility**, not by arbitrary line count only.

---

## 3. Safe Incremental Refactor Pattern

Use this pattern for every module:

```text
1. Keep the existing public controller routes unchanged.
2. Extract one responsibility at a time into a focused service/helper/hook/component.
3. Move tests or add focused tests for the extracted behavior.
4. Keep old service/controller as a thin facade temporarily if that reduces risk.
5. Run typecheck/tests after each meaningful split.
6. Do not combine file modularization with feature redesign unless explicitly requested.
```

Preferred sequence:

```text
Phase A: Extract pure helpers and formatters.
Phase B: Extract query/read services.
Phase C: Extract command/write services.
Phase D: Extract workflow/orchestration services.
Phase E: Thin down the original service/controller/component.
Phase F: Remove dead imports and duplicate helpers.
```

---

## 4. Backend File Structure Rule

For NestJS modules, prefer this shape when a module becomes large:

```text
apps/api/src/<module>/
  <module>.module.ts
  <module>.controller.ts                 # thin route layer, or split controllers by route group
  dto/
  services/
    <subfeature>-query.service.ts
    <subfeature>-command.service.ts
    <subfeature>-workflow.service.ts
  helpers/
    <module>-formatters.ts
    <module>-validators.ts
  reports/
    <module>-reports.service.ts
    <module>-exports.service.ts
  jobs/
    <module>.processor.ts
    <module>.cron.ts
```

Rules:

```text
- Controllers stay thin.
- Business rules stay in focused services.
- Cross-module writes go through explicit boundary services.
- Accounting writes go through AccountingPostingService or a clear accounting bridge.
- File/media writes go through StorageService/FileRegistryService boundaries.
- Tenant-owned reads and writes must stay tenant-scoped.
- Multi-step writes must stay transactional.
```

---

## 5. Frontend File Structure Rule

For large Next.js dashboard workspaces, prefer this shape:

```text
apps/web/components/<module>/
  <module>-workspace.tsx                 # thin tab/layout shell only
  tabs/
    <module>-overview-tab.tsx
    <module>-list-tab.tsx
    <module>-detail-tab.tsx
    <module>-reports-tab.tsx
  components/
    <module>-card.tsx
    <module>-form.tsx
    <module>-table.tsx
    <module>-dialog.tsx
  hooks/
    use-<module>-queries.ts
    use-<module>-mutations.ts
    use-<module>-forms.ts
  utils/
    <module>-formatters.ts
    <module>-constants.ts
```

Rules:

```text
- Workspace files should mostly coordinate layout and selected tab state.
- Tab files own tab-specific rendering.
- Hooks own React Query queries/mutations and repeated stateful behavior.
- Small components own reusable cards/forms/tables/dialogs.
- Utilities own pure formatting, labels, status maps, and derived calculations.
- Preserve existing UI/UX unless the task explicitly asks to redesign it.
```

---

## 6. Web API Client Rule

`apps/web/lib/api/client.ts` should stay focused on base HTTP behavior:

```text
- API_BASE_URL
- ApiRequestError
- request()
- auth refresh
- CSRF/header handling
- parseApiErrorMessage
```

Domain APIs should live in separate files:

```text
apps/web/lib/api/
  auth-api.ts
  files-api.ts
  downloads.ts
  reports-api.ts
  students-api.ts
  attendance-api.ts
  finance-api.ts
  accounting-api.ts
  canteen-api.ts
  transport-api.ts
  platform-api.ts
  mobile-api.ts
```

Do not let `client.ts` become a dumping ground for every module again.

---

## 7. Generated Files Rule

Do not directly edit generated aggregate files:

```text
apps/api/prisma/schema.prisma
packages/core/src/types.ts
packages/core/src/validation.ts
```

Edit the split source files instead, then run:

```bash
pnpm compile:artifacts
```

---

## 8. Module-by-Module Modularization Targets

### Auth / Security / Tenant Isolation

Potential split targets:

```text
- guards by concern: JWT/session, CSRF, throttling, support override
- token storage/hash helpers
- session refresh helpers
- permission/context helpers
```

Keep auth behavior stable. Do not weaken cookie-first browser auth or bearer mobile/API support.

### M0 - Platform Core

Potential split targets:

```text
- tenant management
- plans/features/entitlements
- usage counters
- SaaS billing
- provider readiness
- API keys
- webhooks
- queue inspection/retry
- File Registry/storage readiness
- platform audit/reporting
```

Keep Platform Control Plane separate from tenant school operations.

### M1 - Admissions & Students

Potential split targets:

```text
- admissions workflow
- student profile reads/writes
- guardian management
- document/photo handling
- student lifecycle actions
- duplicate candidate/merge logic
- iEMIS export
- student QR credential lifecycle
```

Keep student files private and tenant-scoped.

### M2 - Attendance

Potential split targets:

```text
- daily attendance sessions
- roster reads
- corrections/review
- offline sync submissions
- conflict handling
- monthly/history reports
- exports
- mobile teacher attendance scope
```

Keep teacher/guardian/student ownership checks server-side.

### M3 - Fees & Receipts / Finance

Potential split targets:

```text
- fee heads
- fee plans
- billing runs
- invoices/dues
- payments
- refunds/reversals
- receipts/reprints/PDFs
- cashier close
- finance reports/exports
- accounting bridge
- payment gateway/webhook handling
```

Keep money Decimal-safe and use accounting posting boundaries.

### M4 - Academics / Exams / CAS / Report Cards

Potential split targets:

```text
- academic setup
- subjects/teacher assignments
- exam terms/components
- marks entry
- CAS records
- locks/unlocks
- report card generation/PDF
- corrections/history
- publishing/promotion
- exports
```

Keep report-card and marks workflows contract-protected.

### M5 - Activity Feed & Milestones

Potential split targets:

```text
- post lifecycle
- targeting/audience resolution
- reactions/comments
- media attachments
- media privacy/consent checks
- milestones/mood logs
- moderation/audit
- gallery responses
```

Keep raw storage keys and private file IDs hidden from unsafe responses.

### M6 - Homework & Timetable

Potential split targets:

```text
- homework assignment lifecycle
- submissions/review
- attachment access
- reminders
- homework reports
- timetable versions
- periods/rooms/slots
- conflict validation
- substitutions/teacher absence integration
```

Keep parent/student homework reads fail-closed when ownership is missing.

### M7 - HR & Payroll

Potential split targets:

```text
- staff profile/lifecycle
- staff documents/contracts
- HR attendance
- leave requests/balances/accrual
- salary structures/components
- payroll runs/lines
- payslip PDF/export
- payroll accounting posting/reversal
- statutory reports
```

Keep PII masking and approval/posting locks intact.

### M8A - Library

Potential split targets:

```text
- books/copies
- borrower lookup
- issue/return workflow
- overdue/reminders
- fines
- fine-to-fees handoff
- QR/barcode scanning
- reports/exports
- history/audit
```

Keep tenant-scope and borrower ownership checks intact.

### M8B - Transport

Potential split targets:

```text
- routes/stops
- vehicles
- driver assignments
- student assignments
- trip lifecycle
- trip student statuses
- driver dashboard/manifest
- GPS ping validation
- latest-location Redis cache
- location stream/fanout
- retention cleanup
- logs/reports/exports
```

Keep GPS high-concurrency behavior in Redis and avoid overloading PostgreSQL.

### M8C - Canteen

Potential split targets:

```text
- menu items
- meal plans
- enrollments
- meal serving
- wallets/wallet transactions
- spending controls
- POS sales
- POS receipts/PDFs
- suppliers
- inventory items
- purchase bills
- stock ledger
- wastage/manual adjustments
- reports/exports
- finance/accounting bridge
```

Keep negative-balance guards, idempotency, QR safety, and accounting-source hardening intact.

### M9 - Accounting & Finance

Potential split targets:

```text
- chart of accounts
- journals
- fiscal years/periods
- posting service
- reversals/corrections
- fiscal close/reopen
- opening balances
- bank reconciliation
- report calculations
- report exports/PDFs
- report snapshots/File Registry
- audit trail viewer
```

Other modules must not write ledger rows directly.

### M10 - Notices / Communication / Chat

Potential split targets:

```text
- notice lifecycle
- event/calendar communication
- audience targeting
- provider adapter boundary
- delivery/failure dashboard
- notification center/read state
- parent-teacher chat threads
- message attachments
- moderation/escalation
- unread recipient follow-up
```

Keep guardian ownership checks and provider failure isolation intact.

### M11+ Future Modules

Every future module must start with file-level modularity from day one:

```text
- thin controller
- focused services
- separate query/write/report/job files
- frontend workspace shell plus tab components/hooks
- domain API client file
- tenant isolation tests
- permission tests
```

Do not wait until a file has thousands of lines before splitting it.

---

## 9. Codex Implementation Rule

When Codex is asked to work on a feature inside any module:

```text
1. Check whether the touched file is already too large or mixes responsibilities.
2. If yes, include a small file-level modularization step in the task.
3. Extract only the responsibility needed for the current task unless the user explicitly asks for a wider cleanup.
4. Preserve behavior and public contracts.
5. Mention the modularization in the final response under "Files changed" and "Ownership decisions".
```

Do **not** create a massive repo-wide modularization PR unless explicitly requested.

---

## 10. Verification

After modularization changes, run the most relevant subset first, then wider gates if the touched area is central:

```bash
pnpm compile:artifacts
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For backend API route/controller changes:

```bash
pnpm verify:openapi
pnpm test:e2e
```

For dashboard workspace splits:

```bash
pnpm --filter @schoolos/web lint
pnpm --filter @schoolos/web typecheck
pnpm --filter @schoolos/web test
pnpm test:web:e2e
```

For production readiness:

```bash
pnpm verify:production
```
