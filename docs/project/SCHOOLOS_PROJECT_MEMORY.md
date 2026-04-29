# SchoolOS Project Memory and Roadmap

This document is the long-term project memory for SchoolOS. Keep it updated as modules, features, architecture decisions, and priorities change.

## Project Identity

SchoolOS is a production-grade, multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10.

The system should be designed as a scalable, secure, maintainable product using clean architecture, SOLID principles, and modular-monolith-first development. Microservices should only be considered after scale, team size, deployment needs, or compliance isolation justify the added complexity.

## Core Architecture

- Monorepo: pnpm.
- Backend: NestJS modular monolith.
- Database: PostgreSQL with Prisma.
- Cache/queues: Redis + BullMQ.
- Shared package: `packages/core` for contracts, validation, permissions, and types.
- Current frontend: Next.js dashboard in `apps/web`.
- Future frontend target:
  - `apps/web` = public website, SEO pages, admissions portal.
  - `apps/admin` = Angular internal dashboard.
- Do not migrate to Angular yet.
- Continue current dashboard in Next.js until Phase 1B and pilot validation are complete.
- `tenantId` is the current Prisma/database school boundary. It maps to product-language `schoolId`.
- Do not rename `tenantId` to `schoolId` unless doing a deliberate future migration.

## Current Project Stage

Current stage:

```text
Phase 1A completed → Phase 1B Completion Sprint next → Phase 2 after that
```

Phase meaning:

- Phase 1A = core live-school workflows working end-to-end.
- Phase 1B = complete Phase 1 operational depth, reports, detail pages, management actions, exports, polish, and stronger real-world UX.
- Phase 2 = Academics, Timetable/Homework, HR/Payroll, full M9 Accounting.
- Phase 3 = Library, Transport, parent/mobile expansion.
- Phase 4 = AI/ML features and scale optimizations.

## Standard Verification Commands

Run these after meaningful changes:

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

## Completed Foundation

- Tenant context seeded through auth/CLS.
- JWT auth guard hardened.
- Super-admin tenant override validated and audited.
- Cookie-first browser auth added with httpOnly access + refresh cookies.
- Browser dashboard no longer stores raw tokens in localStorage/sessionStorage.
- API supports both httpOnly cookie auth and bearer tokens for future mobile/API clients.
- CORS/credentials adjusted for browser auth.
- Docker Postgres/Redis smoke script added.
- `verify:production` script exists and passes.
- PDF response validation added.
- Student ID card and receipt PDFs open successfully after manual test.
- API error parsing improved to avoid raw JSON blobs in UI.

## Phase 1A Backend Completed / Hardened

### Auth / RBAC / Tenant Isolation

- Cookie-first auth, refresh, logout.
- Tenant-scoped request context.
- RBAC/permission-aware behavior.
- Super-admin override rules.

### M1 Admissions / Student Management

- Tenant-scoped admission creation.
- Transactional admission creation.
- Guardian linking.
- Duplicate detection.
- Roll conflict validation.
- Section-class validation.
- Academic year/class/section tenant validation.
- Student system ID generation.
- iEMIS disability/no-disability confirmation.
- Bulk CSV import.
- Audit logging.
- Fee invoice side effect through finance boundary.
- Student document PDF endpoints.
- Student profile detail endpoint added.

### M2 Attendance

- Tenant-scoped roster.
- Active enrolled student validation.
- Present-by-default attendance.
- Exception-based submission.
- Statuses: PRESENT, ABSENT, LATE, SICK_LEAVE, EXCUSED_LEAVE, UNEXCUSED_LEAVE.
- 6-hour edit lock.
- Admin/principal override.
- Conflict review.
- Attendance analytics and summary.
- Notification events through M10.
- Offline sync envelope foundation.

### M3 Fee Management

- Fee heads.
- Fee plans.
- Billing runs.
- Invoices.
- Payments.
- Receipts.
- Partial/full payment.
- Overpayment rejection.
- Duplicate reference rejection.
- Fiscal-year invoice/receipt numbering.
- Discounts with reason.
- Waivers.
- Defaulters.
- Defaulter reminder events.
- Ledger posting integration/event seam.
- Receipt PDF generation.

### M5 Activity Feed / Milestones

- Tenant-scoped activity posts.
- Class/section/student targeting.
- Private media objectKey metadata.
- No permanent public URLs.
- Guardian notification via M10.
- Parent visibility rules.
- Teacher/admin write scope.
- Mood logs.
- Developmental milestones.
- Reactions.
- Consent-aware delivery.

### M10 Notices / Communications / Consent

- Notices.
- Events.
- Audience targeting.
- Notification delivery records.
- BullMQ/provider foundation.
- Domain event handlers from admissions, attendance, fees, and activity.
- Consent capture/revoke.
- Consent-aware delivery.
- Delivery status updates.
- Idempotent source delivery behavior.
- Provider failures do not crash business transactions.

## Phase 1A Frontend Completed / Polished

### Dashboard Shell

- Role-aware sidebar.
- Phase 1-first navigation.
- Future modules shown as disabled/later where appropriate.
- Header with tenant metadata, academic year display, notification badge query.
- Breadcrumbs.
- Cookie-first logout behavior.

### Admin Dashboard

- Replaced static implementation notes.
- Uses real Phase 1 APIs.
- Setup alerts.
- KPIs.
- Operational alerts.
- Recent activity.
- Quick actions.
- Empty/loading/error states.

### Students / Admissions Workspace

- Student Directory default tab.
- Academic year/class/section filters.
- Search by name or SCH ID.
- Student roster cards.
- Student profile viewer.
- Multi-step enrollment.
- Guardian management in enrollment.
- iEMIS disability/no-disability confirmation.
- Document upload.
- Duplicate warning/create-anyway.
- Bulk import tab.
- Recent admissions tab.
- PDF actions for ID card/certificates.

### Attendance

- Teacher-first 3-tap flow.
- Present-by-default.
- Tap exceptions only.
- Full status cycle including leave types.
- Sticky summary bar.
- Future date blocked.
- Offline sync secondary.
- Analytics/conflict review preserved.

### Fee Collection

- Accountant-first Collection Counter.
- Invoice/student search.
- Outstanding invoice summary.
- Payment method/reference handling.
- Client-side overpayment block.
- Receipt success panel.
- Open receipt PDF.
- Preview-only ledger entry.
- Fee setup, billing runs, discounts, waivers, defaulters, receipts, ledger preserved in tabs.

### Activity Feed

- Corrected wrong Transport title.
- Create Post tab.
- Feed Preview.
- Mood Logs.
- Milestones.
- Delivery Records.
- Class/section/student targeting.
- 1 to 5 image validation.
- Private media placeholders.
- Reactions disabled safely if no actor context.
- No AI captions yet.

### Notices / Communications

- Notices tab.
- Events tab.
- Delivery Records tab.
- Consent Management tab.
- Emergency warning.
- Audience targeting.
- Class/section filtering.
- Publish/schedule notice.
- Create event.
- Delivery filters/status badges.
- Consent capture/revoke.

## Additional Items Added Beyond Original Plan

- Student Directory + Profile viewer.
- Cookie-first browser auth.
- Phase 1 browser QA documentation.
- Smoke script for Postgres/Redis/API readiness.
- PDF response validation.
- Student profile detail endpoint.
- Delivery record status tracking.
- Consent-aware M10 behavior.
- iEMIS disability/no-disability confirmation.
- Better API error parsing.
- `.gitignore` updated for generated PDF artifacts.

## Remaining Phase 1B Work Before Phase 2

Priority order:

1. Student Management depth.
2. Fee/Finance depth.
3. Attendance reports/history.
4. Notifications center/read/retry UI.
5. Activity media storage/signed preview.
6. Global search + header actions.
7. Playwright browser smoke tests.
8. PDF visual polish.

### Phase 1B Student Management Remaining

- Full student detail route: `/dashboard/students/[studentId]`.
- Student edit/update form.
- Guardian edit/update.
- Student status lifecycle: active, transferred, graduated, inactive.
- Transfer workflow.
- Student document manager.
- Document history.
- Class roster export CSV/PDF.
- Better student photo upload/storage.
- Better ID card/certificate visual layout.
- iEMIS export format.
- Duplicate merge workflow.

### Phase 1B Attendance Remaining

- Teacher-specific assigned class filtering.
- Monthly attendance register view.
- Student attendance history inside profile.
- Attendance correction request workflow.
- Attendance CSV/PDF export.
- Parent-facing attendance summary.
- True offline draft persistence.

### Phase 1B Fee Management Remaining

- Invoice detail endpoint/page with line items.
- Fee-head/period-level dues table.
- Student fee ledger.
- Payment reversal/correction workflow.
- Receipt reprint history.
- Cashier close/day-end report.
- Fee collection reports.
- Defaulter aging filters.
- Better receipt PDF layout.
- Online payment gateways later.

### Phase 1B Activity Feed Remaining

- Signed image preview/download endpoint.
- Real object storage/direct upload workflow.
- Image compression for Nepal low-bandwidth usage.
- Post edit/delete/soft delete.
- Moderation/approval workflow.
- Parent view.
- Teacher media gallery.
- Activity detail page.
- AI captions later only after core media is stable.

### Phase 1B Notices/Communications Remaining

- Header notification center/dropdown.
- Notice detail page.
- Read/unread tracking.
- Unread recipient list.
- Delivery retry/resend UI.
- Event RSVP later.
- Parent-teacher messaging later.
- Real SMS/FCM/email providers later.
- Consent text/version templates.
- Marketing opt-out rules.

### Global UX Remaining

- Global student search.
- Academic year selector affecting global page context.
- Notification bell dropdown.
- User profile page.
- Role switcher.
- School branding/logo settings.
- Playwright smoke tests.

## M9 Accounting Stack Decision

Keep the current stack:

- Backend: NestJS.
- Database: PostgreSQL.
- ORM: Prisma.
- Architecture: modular monolith.
- Queue/events: BullMQ/domain events.
- Frontend: current Next.js dashboard for now.
- Do not move Accounting into a microservice yet.
- Full M9 Accounting belongs to Phase 2.
- Finance ledger foundation can continue in Phase 1B.

Why the current stack is good for M9:

- Accounting needs ACID transactions, relational integrity, immutable records, unique fiscal numbering, reporting queries, and auditability.
- PostgreSQL is strong for accounting because of transactions, numeric/decimal support, indexes, constraints, and reporting queries.
- NestJS modular monolith is better than microservices at this stage because Accounting must stay consistent with Fees, Payroll, Expenses, Receipts, Waivers, Refunds, and Period Closing.
- Microservices would add distributed transaction complexity too early.

## Strict M9 Accounting Design Rules

1. Immutable ledger.
   - Never edit confirmed journal entries directly.
   - Use reversal, correction, or adjustment entries.
   - Reason: preserves audit trail and prevents silent financial manipulation.

2. Double-entry enforcement.
   - Every journal must satisfy total debit = total credit.
   - Enforce in service logic and tests.
   - Reason: prevents invalid accounting data.

3. Fiscal period control.
   - Period statuses: OPEN, LOCKED, CLOSED.
   - No posting into closed periods.
   - Reopening requires privileged approval/audit.
   - Reason: prevents backdated manipulation after reports are finalized.

4. Source document linkage.
   - Every auto-posted entry links to source: invoiceId, paymentId, receiptId, payrollRunId, expenseVoucherId, waiverId, refundId, etc.
   - Reason: every journal must be traceable to an operational event.

5. AccountingPostingService boundary.
   - Other modules must not directly write ledger rows.
   - Fees, payroll, expenses should post through an accounting service/domain event boundary.
   - Reason: keeps accounting rules centralized and consistent.

6. Decimal money handling.
   - Use PostgreSQL numeric/Prisma Decimal.
   - Never use floating point for money.
   - Reason: avoids rounding errors.

7. Fiscal sequence control.
   - Journal numbers, voucher numbers, receipt numbers must be unique per tenant/fiscal year.
   - Reason: audit, legal, and reporting correctness.

8. Correction/reversal workflow.
   - Mistakes are fixed by reversing or adjusting entries, not editing old entries.
   - Reason: supports audit and compliance.

9. Reports come from ledger, not frontend calculations.
   - Trial balance, general ledger, cash book, income statement, balance sheet, VAT/TDS reports should be backend-generated.
   - Reason: prevents inconsistent reporting.

10. Audit everything.
   - Post, approve, reverse, close period, reopen period, and export reports must be audited.
   - Reason: schools need accountability and financial traceability.

## M9 Accounting Phase 2 Scope

- Chart of Accounts.
- Manual Journal Entry.
- Expense Vouchers.
- Bank/Cash Accounts.
- Bank Reconciliation.
- Trial Balance.
- General Ledger.
- Cash Book.
- Income Statement.
- Balance Sheet.
- VAT Summary.
- TDS/PF reports.
- Period Closing.
- Fiscal year setup.
- Budget vs actual.
- Accounting approval workflow.

## Next Recommended Work

Do not start Phase 2 yet.

Start Phase 1B Completion Sprint with:

1. Student Detail full page + student edit/guardian edit/document manager.
2. Invoice detail + student fee ledger + payment reversal.
3. Monthly attendance register + student attendance history.
4. Notification center + delivery retry/read status.
5. Signed media preview + activity edit/delete.
6. Global student search.
7. Playwright browser smoke tests.
8. PDF visual polish.

## Development Rules Going Forward

- Backend-first for data integrity.
- UI should consume real APIs, not fake production data.
- Every tenant-owned table and query must be tenant-scoped.
- All write operations should be auditable where business-critical.
- Keep Phase 1B focused before starting Phase 2.
- Do not start AI features until reliable production data exists.
- Do not migrate to Angular until the product workflow stabilizes.
- Avoid microservices until operational scale justifies them.
