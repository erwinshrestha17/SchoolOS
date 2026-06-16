# API Agent Instructions

Scoped instructions for `apps/api`. Root `AGENTS.md` still applies.

## Read before API work

- `../../AGENTS.md`
- `../../docs/project/SCHOOLOS_PROJECT_STATUS.md`
- `../../docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md`
- `../../docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`
- `../../docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md`
- `../../docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md`
- Existing controllers, services, DTOs, Prisma schema, tests, and OpenAPI/shared contracts for the touched module

## Backend rules

- Keep the NestJS modular monolith.
- Keep PostgreSQL/Prisma as the source of truth.
- Keep Redis/BullMQ for queued, scheduled, retryable, provider, PDF/report, export, media, and notification work.
- Controllers stay thin; business rules belong in service/domain boundaries.
- Use transactions for multi-step writes.
- Use pagination/filtering for growing list endpoints.
- Add or review indexes for high-volume tenant-scoped query paths.
- Do not introduce microservices, new databases, or new infrastructure unless explicitly approved.
- Do not rename `tenantId`.

## Access and data boundaries

- Every tenant-owned read/write must use authenticated `tenantId`.
- Background jobs must re-check tenant, feature, entity, and provider state before running.
- Suspended tenants and disabled modules must fail closed.
- Backend authorization is the source of truth.
- Parent, student, driver, staff self-service, and mobile endpoints must use purpose-limited DTOs.
- Teachers are assigned-class/section/subject scoped unless permission explicitly allows more.
- Platform support override requires reason and audit.

## Validation, audit, and files

- Validate all external input with existing DTO/pipes patterns.
- Return bounded, school-friendly errors.
- Audit important create/update/delete/status actions and sensitive workflow decisions.
- Money writes must be idempotent and auditable.
- Confirmed financial records use reversal/correction workflows.
- File operations must follow:

```text
Feature module -> FileRegistryService -> StorageService -> StorageAdapter
```

- Do not import storage provider clients inside feature modules.
- Do not store base64 files in PostgreSQL.
- Use File Registry records for protected documents, media, exports, reports, receipts, payslips, report cards, homework attachments, notice/chat attachments, and learning resources.

## API endpoint completion checklist

Before adding or changing an endpoint, confirm:

- The route is in the correct module/controller and does not bypass another module's service boundary.
- The request is authenticated where required.
- Tenant-owned data is scoped by authenticated `tenantId`.
- Module entitlement and RBAC/permission checks are enforced in the backend.
- Parent/student/driver/staff/mobile routes return purpose-limited DTOs only.
- Input DTO validates required fields, enums, dates, IDs, money values, pagination, and filters.
- Growing lists support server-side pagination and filtering.
- Multi-step writes use a transaction where consistency requires it.
- Sensitive writes are audited with actor, tenant, action, target, reason where required, and useful context.
- Retryable writes are idempotent or have deterministic duplicate guards.
- OpenAPI/shared contracts are updated when request or response shape changes.
- Tests are added or updated for success, forbidden, validation, tenant boundary, and important edge cases.

## Prisma/query checklist

For tenant-owned Prisma queries:

- Include `tenantId` in `where` clauses for reads, updates, deletes, counts, aggregates, and relation lookups.
- Avoid fetching full records when a selected projection is enough.
- Avoid unbounded `findMany` on growing tables.
- Check nested relation filters for tenant leakage.
- Prefer stable ordering for paginated lists.
- Review indexes for high-volume filters such as tenant, status, date, class/section, student, staff, receipt, invoice, job, and file lookups.

## Idempotency and job checklist

For queues, provider callbacks, imports, exports, PDFs, reports, notifications, and payment-like flows:

- Re-check tenant/module/entity/provider state inside the processor.
- Prevent duplicate processing from retries, double-clicks, refreshes, and out-of-order callbacks.
- Store durable job/export/report/file status where the UI needs to show progress.
- Return safe diagnostics and do not expose raw provider payloads in normal responses.
- Use File Registry for generated artifacts.

## File Registry checklist

For every API that creates or serves a file:

- Register file metadata through FileRegistryService.
- Store object data through StorageService only.
- Enforce tenant, owner, role, module, and purpose checks before access.
- Return app-controlled file identifiers or controlled access responses.
- Audit access where required by the workflow.
- Provide unavailable/expired/not-permitted states to the caller.

## Learning and AI

- Keep M12 Learning inside the dedicated learning domain.
- Reuse core students, staff, classes, sections, subjects, timetable, files, RBAC, audit, and communication.
- Student session access, autosave, and submit must fail closed and be idempotent.
- Parent summaries must be child-scoped, supportive, and non-comparative.
- M11 AI remains roadmap only unless explicitly approved.

## Verification matrix

Use the smallest meaningful verification set, then expand when contracts or cross-module flows change.

- Prisma/schema change: `pnpm db:generate`, `pnpm db:validate`, migration review, relevant tests.
- DTO/contract change: `pnpm verify:openapi`, API typecheck, affected tests.
- Service/controller change: API typecheck, affected unit/e2e tests.
- Queue/job/provider change: affected processor tests plus smoke where relevant.
- Finance/accounting change: relevant money/idempotency/reversal/accounting tests.
- File/export/PDF change: File Registry/storage tests plus affected UI/helper smoke where relevant.

## Verification

Run relevant checks after API changes and do not claim passing unless run:

```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm --filter @schoolos/api typecheck
pnpm --filter @schoolos/api test
pnpm test:e2e
pnpm typecheck
pnpm build
pnpm verify:production
pnpm smoke:pilot
pnpm smoke:learning
pnpm smoke:full
```

For docs-only instruction edits, runtime checks are not required.
