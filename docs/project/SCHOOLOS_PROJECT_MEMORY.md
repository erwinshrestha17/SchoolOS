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

## Updated Production Module List

SchoolOS is organized into these production modules:

| Module | Name | Core Scope | Phase Position |
|---|---|---|---|
| M1 | Admissions & Student Profiles | Enrollment, guardian records, documents, student photo, student lifecycle, transfers, ID cards, certificates, and iEMIS-ready student data. | Phase 1A/1B |
| M2 | Smart Attendance | 3-tap attendance, absence/late/leave tracking, correction workflow, monthly attendance history, parent alerts, and attendance reports. | Phase 1A/1B |
| M3 | Fees & Receipts | Fee setup, billing runs, invoices, dues, discounts, waivers, payments, receipts, defaulter tracking, cashier/day-end reports, and fee ledger foundation. | Phase 1A/1B |
| M4 | Exams, CAS & Report Cards | Exam setup, marks entry, CAS tracking, grading, report cards, academic reports, promotion support, and parent result notifications. | Phase 2 |
| M5 | Activity Feed & Milestones | Classroom photos, child-specific posts, daily updates, developmental milestones, signed media preview, parent engagement, and future AI captions after media stability. | Phase 1A/1B |
| M6 | Homework & Timetable | Homework assignments, reminders, submission tracking, timetable planning, teacher schedule conflict detection, and substitution support. | Phase 2 |
| M7 | HR & Payroll | Staff profiles, staff attendance, leave, salary structures, payroll processing, salary slips, PF/TDS support, and payroll-to-accounting integration. | Phase 2 |
| M8A | Library Management | Book catalog, QR/barcode copy tracking, issue/return workflow, overdue fines, lost book charges, book history, and library reports. | Phase 3 |
| M8B | Transport Management | Routes, stops, vehicles, drivers, student transport enrollment, boarding/drop tracking, parent notifications, live GPS tracking, ETA, and trip history. | Phase 3 |
| M8C | Canteen Management | Menu management, meal plans, student meal enrollment, QR/student ID meal serving, wallet/POS sales, parent controls, allergy warnings, inventory, vendor purchases, and fee/accounting integration. | Phase 3 |
| M9 | Accounting & Finance | Double-entry ledger, chart of accounts, journal posting, receipt/payment linkage, reversal/correction workflow, trial balance, day-end reports, audit-ready records, and full Phase 2 accounting expansion. | Phase 2 |
| M10 | Notices & Communication | Notices, announcements, notification center, read/unread tracking, consent management, delivery records, retry/resend UI, real SMS/FCM/email provider integration later, and Parent–Class Teacher Chat with school-configured chat hours. | Phase 1A/1B + Phase 2/3 chat expansion |

Public website / landing-page module card order:

1. Admissions & Student Profiles
2. Smart Attendance
3. Fees & Receipts
4. Exams, CAS & Report Cards
5. Activity Feed & Milestones
6. Notices & Communication
7. Homework & Timetable
8. HR & Payroll
9. Library Management
10. Transport Management
11. Canteen Management
12. Accounting & Finance


## Complete Module Details and Feature Scope

### M1 — Admissions & Student Profiles
- Enrollment and admission workflow.
- Student profile: English/Nepali name, DOB, gender, blood group, nationality, religion, ethnicity, mother tongue, disability confirmation, and photo.
- Guardian records: relation, phone, email, occupation, address, primary guardian flag, and app login linkage.
- Academic placement: academic year, class, section, roll number, admission date, system-generated student ID.
- Student lifecycle: active, inactive, transferred, graduated, alumni.
- Student edit/update, guardian edit/update, transfer workflow, document manager, document history.
- Student ID card, enrollment confirmation, transfer certificate, leaving certificate, character certificate.
- Bulk CSV import, duplicate detection, class roster CSV/PDF export, student photo upload, iEMIS export.
- Audit trail for profile, guardian, lifecycle, and document actions.
- Integrates with M2 roster, M3 fees, M4 academics, M5 activity visibility, M8B transport, M8C canteen, and M10 guardian notifications.

### M2 — Smart Attendance
- Teacher-first 3-tap attendance: open class, tap exceptions, submit.
- Present-by-default attendance with absent, late, sick leave, excused leave, and unexcused leave statuses.
- Teacher-specific assigned class filtering.
- 6-hour edit lock, admin/principal override, conflict review.
- Monthly attendance register and student attendance history inside profile.
- Attendance correction requests, CSV/PDF export, parent-facing attendance summary.
- Consecutive absence alerts and below-threshold attendance risk alerts.
- Offline sync envelope and later true offline draft persistence.
- Integrates with M1 roster, M4 report cards/promotion, M7 staff attendance/payroll later, and M10 alerts.

### M3 — Fees & Receipts
- Fee heads, fee plans, billing runs, invoices, dues, and fee-head/period-level dues table.
- Invoice detail page with line items and student fee ledger.
- Discounts, concessions, scholarships, sibling discount, staff child discount, waivers.
- Partial/full payments, overpayment prevention, duplicate reference prevention.
- Fiscal-year invoice/receipt numbering.
- Receipt PDF, receipt reprint history, payment reversal/correction workflow.
- Cashier close/day-end report, fee collection reports, defaulter aging filters and reminders.
- Online payment gateway readiness later.
- Integrates with M1 students/guardians, M8A library fines, M8B transport fees, M8C canteen meal charges/wallet receipts, M9 accounting events, and M10 fee notifications.

### M4 — Exams, CAS & Report Cards
- Exam setup by academic year, class, section, term, and subject.
- Theory/practical marks configuration and subject-teacher marks entry.
- Absent/withheld marks handling.
- Nepal grading/GPA calculation on the server.
- CAS tracking: participation, projects, observation, behavior, unit tests.
- Report cards: standard, CAS, progress card, SEE-format mark sheet.
- Marks lock/unlock workflow with audit trail.
- Academic reports, promotion eligibility, report card PDF generation.
- Optional fee-defaulter block for report card/hall ticket.
- Integrates with M1 roster/promotion, M2 attendance percentage, M3 defaulter controls, and M10 result notifications.

### M5 — Activity Feed & Milestones
- Activity post creation by teacher/admin.
- Class, section, and child-specific targeting.
- 1–5 image validation, signed image preview/download, real object storage/direct upload.
- Image compression for Nepal low-bandwidth usage.
- Post edit/delete/soft delete, moderation/approval, teacher media gallery, activity detail page.
- Daily mood logs and Montessori/ECE developmental milestone tracking.
- Parent reactions and engagement tracking.
- Consent-aware media delivery.
- AI captions later only after media storage/privacy is stable.
- Integrates with M1 student/guardian scope and M10 parent notifications.

### M6 — Homework & Timetable
- Homework assignment by subject, class, section, or individual student.
- Due dates, attachments, remarks, recurring homework.
- Submission tracking: submitted, late, not submitted.
- Teacher review and correction remarks.
- Parent/student reminders and missed-homework alerts.
- Weekly timetable builder with period, subject, teacher, class, section, and room.
- Teacher conflict detection, timetable versions, substitution management, holiday override.
- Teacher, parent, and student timetable views.
- Integrates with M1 class/section data, M4 academic reporting later, M7 teacher assignments, and M10 reminders.

### M7 — HR & Payroll
- Staff profile and employment records.
- Teacher registry, PAN, citizenship, bank details with encryption where needed.
- Role, subject, and class assignment.
- Staff attendance and leave management with approval workflow.
- Salary structures, payroll processing, PF/TDS support, salary advances.
- Payroll approval/lock, salary slip PDF, payroll register, disbursement tracking.
- Staff child discount linkage and contract termination workflow.
- Integrates with M2 staff attendance, M6 teacher schedules, M3 staff-child discount, M9 payroll posting, and M10 staff alerts.

### M8A — Library Management
- Book catalog: title, author, ISBN, publisher, year, category, class suitability.
- Copy tracking with barcode/QR per copy.
- Copy statuses: available, issued, lost, damaged, reserved.
- Issue/return workflow for students and staff.
- Due-date rules, overdue reminders, fine calculation, lost-book replacement charge.
- Book history, borrower history, overdue list, issued books, popular books, damaged/lost books, fine summary.
- Integrates with M1 student borrower, M7 staff borrower later, M3 fines, M9 library asset purchase later, and M10 reminders.

### M8B — Transport Management
- Route setup and stop setup with latitude/longitude and stop sequence.
- Vehicle setup with registration, capacity, document expiry, and status.
- Driver profile and assignment.
- Student stop assignment and transport enrollment.
- Pickup/drop route direction.
- Driver trip start/complete workflow.
- Student boarded/dropped/absent-from-stop status.
- Parent notification on boarding/drop.
- Admin route dashboard.
- Driver-app GPS live tracking.
- Redis latest-location cache.
- WebSocket/SSE real-time updates.
- Parent child-specific bus tracking.
- Basic ETA, trip history, and transport attendance report.
- Future premium GPS device, geofence, overspeed, route-deviation, driver behavior, and predictive ETA.
- Integrates with M1 students/guardians, M3 transport billing, and M10 transport alerts.

### M8C — Canteen Management
- Menu management for breakfast, lunch, snacks, dinner, hostel meals, and special menus.
- Daily/weekly menu calendar.
- Veg, non-veg, eggless, and allergy-friendly options.
- Meal plan/subscription setup: daily, weekly, monthly, snacks-only, lunch-only, hostel meal plan, staff meal plan.
- Student meal enrollment with start date, end date, pause/resume/cancel.
- QR/student ID scan meal serving and manual student search.
- Duplicate serving prevention and meal not taken/absent marking.
- Daily meal count report and student/class-wise consumption report.
- Student canteen wallet, parent/manual top-up, wallet purchase deduction, low-balance alerts.
- POS item catalog for snacks, food, drinks, and optional stationery.
- Cash sale, wallet sale, staff sale, and receipt generation.
- Parent spending limits, item/category restrictions, and purchase history.
- Dietary preference and allergy warnings from M1 health/allergy profile.
- Inventory later: ingredients, stock in/out, expiry alerts, wastage tracking.
- Vendor purchase later: supplier profile, purchase bill, credit purchase, payment status.
- Reports: daily sales, item-wise sales, wallet balances, low balance, inventory usage, wastage, vendor purchase, profit/loss.
- Integrates with M1 student/health data, M3 meal plan charges/wallet receipts, M9 canteen accounting later, and M10 menu/wallet/meal notifications.
- Rules: tenant-scoped, Decimal/numeric money handling, server-side parent controls, auditable financial corrections, allergy warning during serving.

### M9 — Accounting & Finance
- Chart of accounts and double-entry journal posting.
- AccountingPostingService boundary for all module postings.
- Source document linkage to invoice, receipt, payment, waiver, refund, payroll, expense, canteen sale, transport fee, and library fine.
- Immutable confirmed ledger with reversal/correction/adjustment workflow.
- Fiscal year and fiscal period setup with open/locked/closed states.
- Journal/voucher/receipt numbering per tenant/fiscal year.
- Manual journals, expense vouchers, bank/cash accounts, bank reconciliation.
- Trial balance, general ledger, cash book, income statement, balance sheet, VAT summary, TDS/PF reports.
- Budget vs actual, accounting approval workflow, audit logs for post/approve/reverse/close/reopen/export.
- Integrates with M3 fees, M7 payroll, M8A library later, M8C canteen later.

### M10 — Notices & Communication
- Notice creation, scheduling, publishing, and targeting.
- Emergency notices and event notices.
- Audience targeting by role, class, section, student, guardian, staff, route, and custom group.
- Notification center/dropdown, notice detail page, read/unread tracking, unread recipient list.
- Delivery records, delivery status, retry/resend UI.
- Consent capture/revoke, consent text/version templates, marketing opt-out.
- Real SMS/FCM/email providers later.
- Parent–Class Teacher Chat as a Phase 2/Phase 3 communication expansion after Phase 1B notification center/read tracking is stable.
- Event RSVP later.
- Integrates with all modules as the notification delivery layer.

#### M10 Parent–Class Teacher Chat Scope
- One conversation thread per student per academic year.
- Guardian/parent can message only the assigned primary class teacher for their child.
- Class teacher can reply only to guardians of students in their assigned class/section.
- Principal/admin can view, moderate, close, or escalate conversations based on school policy.
- Threads are linked to `tenantId`, `academicYearId`, `studentId`, `guardianId`, and `classTeacherId`.
- Message statuses: sent, delivered, read.
- Read receipts for both parent and teacher.
- Attachment support later with strict file controls: images/PDF only, size limits, virus scanning, private object storage, and signed URLs.
- No open parent-to-any-teacher messaging in the early release.
- No student-to-teacher private chat in the early release.
- Abuse/report/block controls for inappropriate communication.
- Escalation workflow to principal/admin for serious issues.
- Audit and retention rules for message threads and moderation actions.
- Tenant-scoped access checks on every thread/message query.
- Consent-aware communication and notification delivery.

#### Recommended Chat Days and Time
Default Nepal-friendly school chat availability should be configurable per school:

```text
Sunday–Thursday: 4:00 PM–7:00 PM
Friday: 2:00 PM–5:00 PM
Saturday: Closed
Public holidays: Closed
Outside hours: Emergency-only notifications
```

Reasoning:
- Teachers should not be interrupted during class hours.
- After-school windows allow teachers to respond without affecting teaching.
- Friday uses an earlier and shorter window because many schools have shorter working hours.
- Saturday and public holidays should protect teacher work-life balance.
- Parents may still send messages outside hours, but the system should clearly show that replies are expected during school chat hours.

#### Chat Availability Rules
- Chat availability must be school-configurable.
- Default time zone: Nepal time.
- Messages can be accepted outside chat hours but marked as queued/outside-hours.
- Teacher push notifications should be muted outside chat hours unless an admin marks a case as emergency.
- Parents should see a clear notice before or after sending outside hours.
- Teachers should not be shown as instantly available.
- Use SLA wording such as: `Usually replies within 1 school day`.
- Emergency override should be controlled by admin/principal, not freely by parents.

Example outside-hours parent notice:

```text
Your message has been sent. The class teacher usually replies during school chat hours: Sunday–Thursday, 4 PM–7 PM, and Friday, 2 PM–5 PM.
```

#### Parent–Class Teacher Chat Entities
```text
ParentTeacherThread
- id
- tenantId
- academicYearId
- studentId
- guardianId
- classTeacherId
- status: OPEN | CLOSED | ESCALATED
- createdAt
- closedAt

ParentTeacherMessage
- id
- tenantId
- threadId
- senderUserId
- senderRole: PARENT | TEACHER | ADMIN
- message
- attachmentObjectKey nullable
- priority: NORMAL | IMPORTANT | EMERGENCY
- status: SENT | DELIVERED | READ
- sentAt
- deliveredAt nullable
- readAt nullable

ChatAvailabilityRule
- id
- tenantId
- dayOfWeek
- enabled
- startTime
- endTime
- appliesToRole: TEACHER | PARENT | BOTH

ChatEscalation
- id
- tenantId
- threadId
- escalatedByUserId
- escalatedToUserId
- reason
- status: OPEN | RESOLVED
- createdAt
- resolvedAt nullable
```

#### Parent–Class Teacher Chat Implementation Order
1. Thread model: one thread per student per academic year.
2. Guardian-to-primary-class-teacher access rules.
3. Message send/read APIs with tenant and student ownership checks.
4. Read receipts and message status.
5. School-configured chat availability and quiet hours.
6. Outside-hours queued message notice.
7. Teacher notification rules through M10 delivery system.
8. Admin/principal moderation and escalation.
9. Attachment support with signed URLs and size/type restrictions.
10. Retention, audit, abuse reporting, and closure workflow.


## Current Project Stage

Current stage:

```text
Phase 1A completed → Phase 1B completed → Phase 2 Transition Readiness
```

Phase meaning:

- Phase 1A = core live-school workflows working end-to-end.
- Phase 1B = complete Phase 1 operational depth, reports, detail pages, management actions, exports, polish, and stronger real-world UX.
- Phase 2 = Academics, Timetable/Homework, HR/Payroll, full M9 Accounting.
- Phase 3 = Library, Transport including live GPS tracking, Canteen Management, parent child-specific vehicle tracking, and parent/mobile expansion.
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

## Phase 1B Completed / Pilot-Ready

Phase 1B operational depth, reports, detail pages, management actions, exports, polish, and real-world UX are now stable for pilot use.

### M1 Student Management Depth (Phase 1B)
- Full student detail route: `/dashboard/students/[studentId]`.
- Student edit/update and Guardian edit/update.
- Student status lifecycle: active, transferred, graduated, inactive.
- Transfer, Archive, Delete, and Alumni workflows.
- Student document manager and document history.
- Class roster export CSV/PDF.
- Improved ID card/certificate generation with branding support.

### M2 Attendance Depth (Phase 1B)
- Monthly attendance register view.
- Student attendance history inside profile.
- Attendance CSV/PDF export.
- Teacher-specific assigned class filtering foundation.

### M3 Fee/Finance Depth (Phase 1B)
- Invoice detail page with line items.
- Student fee ledger view.
- Payment reversal/correction foundation.
- Cashier close/day-end reports.
- Fee collection and Defaulter aging reports.
- PDF Receipt visual polish (School name, PAN, branding).

### M10 Communications & Global UX (Phase 1B)
- Header notification center/dropdown with unread counts.
- Notice detail page with read tracking.
- Delivery retry / Resend UI.
- Global student search in header.
- Global academic year context.
- School branding and settings.

### Known Gaps / Deferred Phase 1B Items
- **Student Photo Upload:** Deferred to Phase 2 for better storage-backed implementation. Current avatars use student initials.
- **Logo Upload:** Deferred to Phase 2.
- **iEMIS Export Format:** Deferred.
- **Duplicate Merge Workflow:** Deferred.
- **Playwright Smoke Tests:** Stabilized foundation exists; full coverage deferred.

## Phase 2 — Academic, HR, Timetable, and Accounting Expansion (Next)

Transport Management remains inside the NestJS modular monolith. Do not move it to a microservice yet.

### Core Transport Scope

- Route setup.
- Stop setup with latitude/longitude and stop sequence.
- Vehicle setup.
- Driver profile and driver assignment.
- Student stop assignment.
- Student transport enrollment.
- Driver trip start/complete workflow.
- Student boarded/dropped status.
- Parent notification on boarding/drop.
- Admin route dashboard.
- Driver-app GPS live tracking.
- Redis latest-location cache.
- WebSocket/SSE real-time updates.
- Parent child-specific bus tracking.
- Basic ETA.
- Trip history.
- Future premium GPS device integration.
- Future geofence, overspeed, route-deviation, driver-behavior, and predictive ETA features.

### Live Vehicle Tracking Architecture

Use a driver-device GPS model first:

```text
Driver Mobile App
→ GPS latitude/longitude every 5–15 seconds
→ NestJS Transport API
→ Redis latest-location cache
→ WebSocket/SSE live updates
→ Admin dashboard and parent app map
```

Recommended storage and processing:

- PostgreSQL stores routes, vehicles, drivers, stops, student transport enrollments, trips, boarding/drop events, and periodic location history.
- Redis stores latest active vehicle/trip location for fast live reads.
- BullMQ handles parent notifications, delay alerts, and background transport jobs.
- WebSocket/SSE streams live updates to admin and parent views.
- PostgreSQL location history should be sampled, not written every second forever.

Privacy and tenant isolation rules:

- Track vehicles only during an active pickup/drop trip.
- Parents can only view the active vehicle assigned to their own child.
- Admins can only view vehicles within their own tenant.
- Drivers can only update trips assigned to themselves.
- Every transport-owned query must be tenant-scoped by `tenantId`.
- Boarding/drop, trip start/complete, route changes, and vehicle assignment changes should be audited.

Recommended implementation order:

1. Route, stop, vehicle, driver, and student transport enrollment setup.
2. Driver trip start/complete workflow.
3. Boarding/drop status and parent notifications.
4. Admin route dashboard.
5. Driver GPS location ingestion.
6. Redis latest-location cache.
7. WebSocket/SSE live tracking.
8. Parent child-specific tracking view.
9. Basic ETA and trip history.
10. Premium GPS device/geofence/overspeed/route-deviation later.


## M8C Canteen Management Scope

Canteen Management remains inside the NestJS modular monolith. Do not move it to a microservice yet.

### Core Canteen Scope

- Menu management.
- Daily/weekly menu calendar.
- Meal plan setup: breakfast, lunch, snacks, dinner, hostel meals, staff meals.
- Student meal enrollment.
- Meal pause/resume/cancel workflow.
- QR/student ID meal serving.
- Manual student search serving.
- Duplicate serving prevention.
- Meal not taken/absent marking.
- Student canteen wallet.
- Parent/manual top-up.
- Wallet purchase deduction.
- POS item sales.
- Cash sale and staff sale.
- Parent spending limits.
- Item/category restrictions.
- Low-balance alerts.
- Allergy and dietary warnings using M1 health data.
- Daily meal count report.
- Student/class-wise consumption report.
- Item-wise sales report.
- Wallet balance report.
- Inventory tracking later.
- Vendor purchase tracking later.
- Canteen profit/loss report later.
- Fee and accounting integration.

### Canteen Accounting Events Later

All confirmed accounting events must go through `AccountingPostingService`.

- Wallet top-up: Dr Cash/Bank, Cr Student Canteen Wallet Liability.
- Wallet purchase: Dr Student Canteen Wallet Liability, Cr Canteen Sales Income.
- Cash POS sale: Dr Cash, Cr Canteen Sales Income.
- Monthly meal plan billing: Dr Student Receivable, Cr Canteen Income.
- Vendor purchase: Dr Canteen Inventory/Expense, Cr Cash/Bank/Supplier Payable.
- Inventory wastage: Dr Canteen Wastage Expense, Cr Canteen Inventory.
- Refund/correction: reversal/correction entry, not silent edit.

### Canteen Implementation Order

1. Menu setup and meal plan setup.
2. Student meal enrollment.
3. Daily meal served tracking with manual search.
4. QR/student ID scan serving.
5. Daily meal count and consumption reports.
6. Student canteen wallet and manual top-up.
7. POS item catalog and sales counter.
8. Parent controls, low-balance alerts, and purchase history.
9. Allergy/dietary warning enforcement.
10. Inventory, vendors, profit/loss, and accounting integration later.


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


## Phase-Wise Development Plan

### Phase 0 — Foundation and Production Base

Status: Completed / continuously hardened.

Scope:
- pnpm monorepo, NestJS modular monolith, PostgreSQL + Prisma, Redis + BullMQ.
- Tenant context and tenant-scoped queries.
- Auth/RBAC/permission guards.
- Cookie-first browser auth with httpOnly cookies.
- Audit logging foundation.
- Docker development environment.
- Production verification scripts.
- PDF response validation.
- API error handling improvements.

Deliverable:
- Secure, tenant-isolated foundation ready for real school workflows.

### Phase 1A — Core Live-School Workflows

Status: Mostly completed and pilot-candidate.

Modules:
- M1 Admissions & Student Profiles.
- M2 Smart Attendance.
- M3 Fees & Receipts.
- M5 Activity Feed & Milestones.
- M10 Notices & Communication.

Deliverable:
- A school can enroll students, manage guardians, mark attendance, collect fees, generate receipts, post activity updates, and send notices using real APIs.

### Phase 1B — Operational Depth Completion Sprint

Status: Current priority. Do not skip before Phase 2.

Priority order:
1. Student Management depth.
2. Fee/Finance depth.
3. Attendance reports/history.
4. Notification center/read/retry UI.
5. Activity media storage/signed preview.
6. Global search + header actions.
7. Playwright browser smoke tests.
8. PDF visual polish.

Detailed scope:
- M1: full student detail page, edit/update, guardian edit, lifecycle, transfer workflow, document manager, document history, roster export, photo upload, ID/certificate polish, iEMIS export, duplicate merge.
- M2: teacher-specific class filtering, monthly register, student attendance history, correction request workflow, CSV/PDF export, parent attendance summary, true offline draft persistence.
- M3: invoice detail, line items, fee-head dues table, student fee ledger, payment reversal/correction, receipt reprint history, cashier close/day-end, reports, defaulter aging, receipt PDF polish.
- M5: signed media preview/download, object storage/direct upload, image compression, edit/delete/soft delete, moderation, parent view, teacher gallery, activity detail.
- M10: notification center, notice detail, read/unread, unread recipient list, retry/resend, consent templates, marketing opt-out. Parent–Class Teacher Chat comes after these basics are stable.
- Global UX: student search, academic year context, notification bell, profile page, role switcher, branding/logo settings.

Deliverable:
- Phase 1 modules become operationally complete enough for pilot schools, not just demo workflows.

### Phase 2 — Academics, Timetable, HR/Payroll, Full Accounting

Status: Start only after Phase 1B is completed or explicitly deferred.

Modules:
- M4 Exams, CAS & Report Cards.
- M6 Homework & Timetable.
- M7 HR & Payroll.
- M9 Accounting & Finance.

Scope:
- Build exams, CAS, marks entry, report cards, academic reports, promotion workflow.
- Build homework assignment, submission tracking, reminders, timetable builder, conflict detection, substitution, and Parent–Class Teacher Chat foundation if notification center is stable.
- Build staff profiles, leave, attendance, salary structures, payroll, salary slips, PF/TDS support.
- Build M9 chart of accounts, ledger, journals, expense vouchers, bank/cash, reconciliation, trial balance, GL, cash book, income statement, balance sheet, VAT/TDS/PF reports, fiscal period closing.
- Connect M3 fee payments and M7 payroll to M9 through AccountingPostingService.

Deliverable:
- Full academic and financial operating system for schools.

### Phase 3 — Auxiliary Operations and Parent/Mobile Expansion

Status: Future phase after Phase 2 base is stable.

Modules:
- M8A Library Management.
- M8B Transport Management.
- M8C Canteen Management.
- Parent/mobile expansion.

Scope:
- M8A: catalog, copy tracking, QR/barcode issue-return, fines, lost/damaged books, library reports, fee/accounting integration later.
- M8B: routes, stops, vehicles, drivers, student enrollment, trip start/complete, boarding/drop, parent notifications, live GPS, Redis latest location, WebSocket/SSE, child-specific tracking, ETA, trip history.
- M8C: menus, meal plans, student meal enrollment, QR meal serving, wallet, POS, parent controls, allergy warnings, inventory, vendors, reports, fee/accounting integration later.
- Parent/mobile: parent-facing attendance, fees, report cards, activity, transport tracking, canteen wallet/menu, notices, and Parent–Class Teacher Chat with school chat hours.

Deliverable:
- Complete operational ecosystem beyond core administration, with stronger parent-facing value.

### Phase 4 — AI/ML/Data Science and Scale Optimization

Status: Later only after reliable production data exists.

Scope:
- Activity caption assistance after media safety is stable.
- Developmental milestone narrative generation.
- Attendance risk prediction.
- Fee default prediction.
- Canteen demand forecasting and wastage prediction.
- Transport ETA prediction and route optimization.
- Accounting anomaly detection.
- Smart notice/message templates.
- Infrastructure scaling, query optimization, observability, analytics warehouse/lake later.

Deliverable:
- AI-assisted SchoolOS built on real production data, not fake/demo data.


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
