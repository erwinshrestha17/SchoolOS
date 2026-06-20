# API Agent Instructions

Scoped rules for `apps/api`. Root `AGENTS.md` applies first.

## Read

Before API work, read relevant parts of root `AGENTS.md`, `docs/architecture/SCHOOLOS_NAMING_CONVENTIONS.md`, project status/plan, FRS, architecture/security, platform operations, Prisma schema, touched controller/service/DTO/tests, and OpenAPI/shared contracts.

## Never break

- Keep NestJS modular monolith, Prisma/PostgreSQL, Redis/BullMQ.
- Do not rename `tenantId` or bypass module boundaries.
- Every tenant-owned read/write/job/export/report/file path must use authenticated `tenantId`.
- Backend authorization, module entitlement, and persona scope are source of truth.
- Suspended tenants and disabled modules fail closed.
- Parent/student/driver/staff/mobile APIs use purpose-limited DTOs.
- Teachers stay assigned class/section/subject scoped unless permission allows more.
- Platform support override requires reason and audit.
- Money writes are idempotent/audited; confirmed records use reversal/correction.
- Files go through FileRegistryService and StorageService only.
- M12 Learning stays in the learning domain; M11 AI stays roadmap unless approved.

## Naming and API contract rule

- New TypeScript folders/files use kebab-case; Nest framework suffixes remain `<name>.controller.ts`, `<name>.service.ts`, `<name>.module.ts`, `<name>.guard.ts`, and `<name>.dto.ts`.
- New API routes use lowercase kebab-case resource nouns, plural collections, explicit parameters such as `:studentId`, and domain-command routes only where CRUD is insufficient.
- New query parameter names use camelCase and must be DTO-validated.
- Use one canonical business term per concept; `tenantId` remains the only tenancy boundary name.
- Persisted/API lifecycle values must flow from Prisma/domain value through DTO validation, service mapping, OpenAPI, shared contracts, and consumer clients. Do not use loose duplicated status strings or accept UI-invented statuses.
- Keep stable legacy routes/identifiers unless a documented compatibility and migration plan protects all consumers.

## Missing API rule

When web/mobile/platform needs data that has no safe API, first search existing controllers, services, DTOs, OpenAPI/shared contracts, permissions, and tests. If the need is real, repeatable, production-useful, module-owned, tenant-scopable, and RBAC/entitlement-gatable, create a module-owned purpose-limited endpoint. Do not create broad cross-module shortcuts unless they only compose existing module summaries. Do not use list endpoints as official totals.

## API guardrails

- Contract first: update DTO/OpenAPI/`packages/core` where needed before frontend/mobile consumes a new shape.
- Module-owned summaries: summary endpoints belong to the source module; dashboard/composer endpoints may only compose existing module summaries.
- Query performance: use aggregate/select queries, pagination where needed, no unbounded `findMany`, no avoidable dashboard raw-table scans, and review tenant-scoped indexes.
- Error shape: return safe bounded errors; never leak Prisma, provider, storage, stack, object-key, token, or private payload details.
- Stop on unknowns: if permission, DTO, idempotency, file access, or contract behavior is not confirmed, mark it instead of guessing.

## Implementation checklist

Before adding/changing an endpoint:

- Correct module/controller/service boundary.
- Auth, RBAC, entitlement, tenant scope enforced.
- DTO validates IDs, enums, dates, money, pagination, filters, and required fields.
- Growing lists are paginated/filtered server-side with stable ordering.
- Multi-step writes use transactions where consistency requires it.
- Sensitive writes have audit and reason where required.
- Retryable writes have idempotency or duplicate guards.
- Background jobs re-check tenant/module/entity/provider state.
- Prisma queries include `tenantId` on reads, writes, counts, aggregates, relations.
- Select only needed fields; avoid unbounded `findMany` and over-fetching.
- Add/review indexes for high-volume tenant/status/date/entity filters.
- Generated files/exports/reports register File Registry artifacts.
- Responses expose safe DTOs only, never raw internals.
- OpenAPI/shared contracts updated if shape changes.
- Tests cover success, validation, permission, tenant boundary, and key edge cases.

## Files checklist

For any upload/preview/download/export/delete:

- Feature module -> FileRegistryService -> StorageService -> StorageAdapter.
- No provider client imports in feature modules.
- No base64 files in PostgreSQL.
- Access checks include tenant, owner/persona, module, and purpose.
- Return app-controlled identifiers or safe access responses.
- Audit where workflow requires it.

## Verification matrix

- Prisma/schema: `pnpm db:generate`, `pnpm db:validate`, migration review, tests.
- DTO/contract: `pnpm verify:openapi`, API typecheck, affected tests.
- Service/controller: API typecheck plus affected unit/e2e tests.
- Queue/provider/export/PDF: processor tests plus smoke where relevant.
- Finance/accounting: idempotency/reversal/accounting tests.
- File flow: File Registry/storage tests plus affected UI/helper smoke where relevant.

## Commands

Run relevant checks only and claim only what ran:

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

Docs-only changes need no runtime checks.