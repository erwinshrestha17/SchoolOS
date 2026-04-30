# SchoolOS Development Rules

Use these rules for all SchoolOS coding tasks.

## Working Mode

- Prefer small, focused changes.
- Do not rewrite unrelated files.
- Do not change architecture without explicit instruction.
- Do not start Phase 2 work unless explicitly requested.
- Use `docs/project/SCHOOLOS_PROJECT_MEMORY.md` as the long-term source of truth.

## Current Phase

Current stage: Phase 1B Completion Sprint.

Priority order:

1. Student Management depth
2. Fee/Finance depth
3. Attendance reports/history
4. Notification center/read/retry UI
5. Activity media storage/signed preview
6. Global search/header actions
7. Playwright browser smoke tests
8. PDF visual polish

## Architecture Rules

- Keep NestJS modular monolith.
- Do not introduce microservices unless explicitly justified and requested.
- Keep PostgreSQL with Prisma.
- Keep Redis with BullMQ for queues and background jobs.
- Keep current Next.js dashboard in `apps/web` for now.
- Do not migrate to Angular yet.
- Do not rename `tenantId` to `schoolId`.

## Backend Rules

- Backend-first for data integrity.
- Controllers should stay thin.
- Business rules belong in services/domain boundaries.
- Validate all external input.
- Use transactions for multi-step business writes.
- Every tenant-owned query must be scoped by `tenantId`.
- Every business-critical write must be audited.
- Super-admin tenant override must be explicit, validated, and audited.

## Frontend Rules

- UI must consume real APIs.
- Do not use fake production data for implemented workflows.
- Preserve cookie-first browser auth.
- Show loading, empty, and error states.
- Parse API errors into readable messages.
- Keep Nepal school staff workflows fast and practical.

## Security Rules

- Tenant isolation is mandatory.
- Parent/student views must only expose own child/self data.
- Teacher views must only expose assigned data unless role permissions allow more.
- Sensitive data and files must use private access patterns.
- Use signed URLs for private files/media.
- Avoid permanent public URLs for student media and documents.

## Money and Accounting Rules

- Use Decimal/numeric money handling.
- Do not use floating point for money calculations.
- Confirmed financial records should not be silently edited.
- Use reversal/correction workflows for payment mistakes.
- Receipt, invoice, journal, and voucher numbers must be tenant/fiscal-year safe.
- Full M9 Accounting is Phase 2, but Phase 1B finance ledger foundations may continue.

## Verification Commands

Run relevant checks after meaningful changes:

```bash
pnpm db:generate
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
pnpm smoke:phase1
```

## Final Response Format for Codex Tasks

Return:

- Summary
- Files changed
- Tests run
- Verification results
- Remaining gaps
