# SchoolOS Current UI Progress

This file records the latest web-admin UI/UX implementation progress so large roadmap files do not need broad rewrites for every sprint update.

## Current UI Sprint

```text
Current UI sprint: UI-6C HR/Payroll QA, Browser Smoke Tests, and Payroll PDF Polish.
```

## Next Recommended Sprint

```text
UI-6C: HR/Payroll QA, Browser Smoke Tests, and Payroll PDF Polish.
```

## Following Sprint

```text
UI-7A: Operations UX Foundation — Library, Transport, Canteen.
```

## Completed / Foundation-Complete UI Work

### UI-5A — Homework and Timetable Web Admin Foundation

Status: **Completed / foundation-complete**.

Completed:

- `/dashboard/academics` academic overview hub.
- `/dashboard/homework`.
- `/dashboard/homework/new`.
- `/dashboard/homework/[id]`.
- `/dashboard/timetable`.
- Homework command center.
- Homework create/detail/submissions/reminders UI.
- Timetable command center.
- Weekly grid.
- Versions.
- Weekly requirements.
- Conflicts.
- Substitutions.
- Academic sidebar grouping.
- Typed homework/timetable API helpers.

### UI-5B — Exams, Marks Entry, Results, and Report Cards UX

Status: **Completed / foundation-complete**.

Completed/foundation-complete:

- Exams UX.
- Marks Entry UX.
- Results publishing UX.
- Report Cards UX.
- Academic overview links updated.
- Academic API helpers updated where backend supports endpoints.

### UI-5C — Academic Workflow QA, Browser Smoke Tests, and UX Polish

Status: **Completed**.

Completed:

- Academic navigation/routing hardened.
- Next.js `useRouter` used instead of `window.location` where needed.
- Broken academic sidebar links fixed.
- Loading, empty, confirmation, and validation states improved.
- `api.ts` type safety improved.
- Playwright academic smoke spec added.
- Seed data extended for academic smoke reliability.
- TypeScript verification passed.

### UI-6A — Finance and Accounting UX Foundation

Status: **Completed / foundation-complete**.

Completed:

- `/dashboard/accounting`.
- `/dashboard/accounting/journals`.
- `/dashboard/accounting/accounts`.
- `/dashboard/accounting/reports`.
- `/dashboard/accounting/reconciliation`.
- `/dashboard/accounting/management`.
- Routed Accounting workspace.
- Old monolithic accounting workspace removed.
- Accounting dashboard, journal entries, chart of accounts, reports views.
- Accounting API helpers added/updated.
- Double-entry guard UX.
- Fiscal period warning UX.
- Posted journal immutability UX.
- Reversal/correction workflow direction.
- Backend-driven accounting reports.

### UI-6B — Payroll and Staff Self-Service UX Foundation

Status: **Completed / foundation-complete**.

Completed:

- `/dashboard/hr`.
- `/dashboard/hr/staff`.
- `/dashboard/hr/staff/[id]`.
- HR attendance route/view.
- HR leave workflow route/view.
- `/dashboard/payroll`.
- Payroll dashboard.
- Payroll runs lifecycle UI.
- Salary structures UI.
- Payslip management/download UI.
- Payroll reports shell.
- HR and Payroll separated in sidebar.
- 15+ HR/payroll API helpers added/updated.
- Core `@schoolos/core` types used.
- Payroll posting/read-only guards aligned with M9 accounting rules.

## Seed Issue Fix

Status: **Completed**.

Completed:

- `apps/api/prisma/seed.ts` compile errors fixed.
- Subject seed aligned with actual unique key.
- Subject required `type` field fixed.
- ExamTerm seed idempotency fixed.
- Homework seed uses correct Prisma delegate.
- API dev watch no longer blocked by `seed.ts`.

## Remaining Gaps

- HR/Payroll browser smoke tests.
- Payroll PDF/payslip visual polish.
- Staff self-service `/dashboard/my-profile` finalization.
- Staff lifecycle audit logs.
- Accounting browser smoke tests.
- Journal correction workflow final wiring.
- Trial Balance / Balance Sheet PDF export styling.
- Homework file attachments after File Registry.
- Advanced timetable conflict visualization.
- Full mobile/PWA later.

## Architecture Rules Unchanged

- Keep NestJS modular monolith.
- Keep PostgreSQL with Prisma.
- Keep Redis with BullMQ.
- Keep current Next.js dashboard in `apps/web` for now.
- Do not migrate to Angular yet.
- Do not introduce microservices yet.
- Keep `tenantId` as the tenant/school boundary.

## Verification Notes

This update is documentation-only. Runtime application code is unchanged.

Recommended verification after documentation updates:

```bash
pnpm lint
pnpm typecheck
```
