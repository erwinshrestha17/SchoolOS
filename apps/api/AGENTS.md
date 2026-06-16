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

## Learning and AI

- Keep M12 Learning inside the dedicated learning domain.
- Reuse core students, staff, classes, sections, subjects, timetable, files, RBAC, audit, and communication.
- Student session access, autosave, and submit must fail closed and be idempotent.
- Parent summaries must be child-scoped, supportive, and non-comparative.
- M11 AI remains roadmap only unless explicitly approved.

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
