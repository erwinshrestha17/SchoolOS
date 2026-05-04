# SchoolOS Main Phase Structure

This document defines the main roadmap phases, sub-phases, and implementation sprint slices for SchoolOS.

Use this document together with `docs/project/SCHOOLOS_PROJECT_MEMORY.md`. The project memory remains the long-term source of truth for module scope and architectural rules. This document gives the phase-by-phase execution structure.

## Current Position

```text
Current stage: Phase 2 Transition Readiness
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
Phase 2: Next (Academic, HR, Timetable, and Accounting Expansion)
```

## Main Phase Summary

| Phase 1 | Pilot-Ready Core School System | Make the system usable for real live-school daily operations and polish it for pilot use. | Completed |
| Phase 2 | Academic, HR, Timetable, and Accounting Expansion | Add academic depth, timetable/homework, HR/payroll, and full M9 accounting. | Next |
| Phase 3 | Extended School Operations | Add library, transport, canteen, and parent/mobile expansion. | Later |
| Phase 4 | AI, Analytics, Scale, and Enterprise SaaS | Add AI/ML features, analytics platform, scale optimizations, and enterprise SaaS controls. | Later |

## Phase 1 — Pilot-Ready Core School System

Phase 1 is split into Phase 1A and Phase 1B.

### Phase 1A — Core Live-School Workflows

**Goal:** Make core school operations work end-to-end.

**Status:** Mostly completed.

#### 1A.1 Auth, RBAC, and Tenant Isolation

- Tenant context through auth/CLS.
- JWT guard hardening.
- Cookie-first browser auth.
- HttpOnly access/refresh cookies.
- RBAC and permission guards.
- Super-admin tenant override validation and audit.
- Bearer token support for future mobile/API clients.

#### 1A.2 Admissions and Student Creation

- Tenant-scoped admission creation.
- Student profile creation.
- Guardian linking.
- Academic placement.
- Student system ID generation.
- Duplicate detection.
- Bulk CSV import foundation.
- Admission audit logging.

#### 1A.3 Attendance Core Workflow

- Attendance roster.
- Present-by-default flow.
- Exception-based attendance submission.
- Absent/late/leave status support.
- 6-hour edit lock.
- Admin/principal override.
- Conflict review foundation.
- Attendance analytics foundation.

#### 1A.4 Fee Collection and Receipts

- Fee heads.
- Fee plans.
- Billing runs.
- Invoices.
- Payment collection.
- Partial/full payment.
- Overpayment prevention.
- Receipt generation.
- Receipt PDF opening.
- Defaulter foundation.

#### 1A.5 Activity Feed and Milestones Core

- Activity post creation.
- Class/section/student targeting.
- Private media metadata foundation.
- 1–5 image validation.
- Mood logs.
- Developmental milestones.
- Parent visibility rules.
- Reactions.
- Consent-aware delivery foundation.

#### 1A.6 Notices, Consent, and Delivery Records

- Notices and events.
- Audience targeting.
- Notification delivery records.
- Consent capture and revoke.
- Consent-aware delivery.
- Delivery status foundation.
- Domain notification events from admissions, attendance, fees, and activity.

#### 1A.7 Dashboard Shell and Core Frontend Screens

- Dashboard layout.
- Role-aware sidebar.
- Admin dashboard.
- Students/admissions workspace.
- Attendance screen.
- Fee collection counter.
- Activity feed screen.
- Notices/communications screen.
- Consent management screen.

#### 1A.8 Production Hardening

- Docker Postgres/Redis smoke setup.
- Production verification script.
- PDF response validation.
- API error parsing improvements.
- Browser auth no longer stores raw tokens.
- Basic smoke script foundation.

## Phase 1B — Operational Depth and Pilot Polish

**Goal:** Make Phase 1A production/pilot-grade by adding operational depth, reports, exports, management actions, UX polish, and browser verification.

**Status:** Current phase, around 65–70% implemented.

### 1B.1 Student Management Depth

**Completed / Pilot-Ready:**

- Full student detail route: `/dashboard/students/[studentId]`.
- Student profile detail API.
- Student edit/update.
- Guardian edit/update.
- Lifecycle actions: transfer/archive/delete/alumni.
- Student fee clearance view.
- Student attendance history in profile.
- Student document manager implementation.
- Class roster CSV/PDF export.
- Improved ID card/certificate generation.

**Deferred to Phase 2 / Stabilization:**

- **Proper storage-backed student photo upload:** Current implementation uses initials-only avatars. Real photo management requires backend alignment with file-registry/storage services.
- iEMIS export format.
- Duplicate merge workflow.

### 1B.2 Fee and Finance Depth

**Completed / Pilot-Ready:**

- Invoice detail endpoint/page.
- Student fee ledger.
- Payment reversal/refund/correction foundation.
- Cashier close/day-end UI.
- Fee collection report.
- Defaulter aging report.
- Fee report export implementation.
- Receipt PDF visual polish (branding, PAN, metadata).

**Deferred to Phase 2 / Stabilization:**

- Receipt reprint history polish.
- Fee-head/period-level dues table polish.
- Online payment gateways.

### 1B.3 Attendance Reports and History

**Completed / Pilot-Ready:**

- Attendance summary and analytics.
- Attendance conflict review.
- Student attendance history inside student profile.
- Monthly attendance register view.
- Teacher-specific assigned class filtering foundation.
- Attendance CSV/PDF export.
- Offline sync envelope foundation.

**Deferred to Phase 2 / Stabilization:**

- Attendance correction request workflow.
- Parent-facing attendance summary.
- True offline draft persistence.

### 1B.4 Notification Center, Read Tracking, and Retry UI

**Completed / Pilot-Ready:**

- Header notification bell/dropdown.
- Recent notifications list with unread count.
- Mark as read / Mark all as read.
- Notice detail page with read tracking.
- Delivery retry / Resend UI.
- Tenant-scoped delivery access control.

**Deferred to Phase 2 / Stabilization:**

- Event RSVP.
- Parent-teacher messaging.
- Real SMS/FCM/email provider integration.
- Consent text/version templates.
- Marketing opt-out rules.

### 1B.5 Activity Media Preview and Download

**Completed / Pilot-Ready:**

- Backend activity media service.
- Tenant-scoped attachment preview and download.
- Frontend Preview and Download support.
- Image loading/error state handling.
- Audit records for media access.

**Deferred to Phase 2 / Stabilization:**

- Real object storage integration (beyond local/signed storage pattern).
- Direct upload workflow.
- Image compression for low-bandwidth.
- Post moderation/approval.
- Activity detail page.

### 1B.6 Global Search and Header Actions

**Completed / Pilot-Ready:**

- Backend global student search (ID, name, phone).
- Header debounced search with dropdown results.
- Permission-gated search by `students:read`.

**Deferred to Phase 2 / Stabilization:**

- Result ranking polish.
- Broader global search (notices, receipts).

### 1B.7 Playwright Browser Smoke Tests

**Started but deferred:**

- Playwright config added.
- Basic Phase 1B smoke spec added.
- Generated reports/test-results ignored.

**Remaining:**

- Stabilize login selectors.
- Stabilize authenticated smoke flow.
- Cover dashboard, students, student detail, attendance, finance, notices, notice detail, notification bell, and global search.
- Add these browser checks to final Phase 1B verification workflow.

### 1B.8 PDF Visual Polish

**Functional but not polished:**

- Receipt PDF opens.
- Student ID card PDF opens.
- PDF response validation exists.

**Remaining:**

- Better receipt PDF header, school branding, PAN/address, receipt metadata, cashier, totals, and footer.
- Better student ID card layout.
- Student photo/placeholder.
- QR/student ID block.
- Class/section/roll details.
- Certificate visual polish.
- Consistent PDF branding.

### 1B.9 Settings, Branding, and Final UX Cleanup

**Completed / Pilot-Ready:**

- School branding settings (School Name, PAN, Address).
- Global academic year selector context.
- Role switcher / User profile foundation.
- PDF Visual Polish (Receipts, Student ID Cards).

**Deferred to Phase 2 / Stabilization:**

- Logo upload (storage-backed).
- Platform vs School admin shell visual polish.
- Playwright smoke tests stabilization.

### 1B.10 Final Pilot QA and Deployment Readiness

**Status: Ready for Pilot**

- [x] Full verification commands (lint, typecheck, test, build) passed.
- [x] Manual UI walkthrough of Phase 1 workflows completed.
- [x] Tenant isolation spot checks passed.
- [x] PDF generation (Receipts, ID Cards) verified.
- [x] Branding and Settings verified.

**Pilot QA Checklist:**

1. **Authentication**: Verify cookie-first login/logout and session refresh.
2. **Admissions**: Enroll a student, link guardians, and verify SCH ID generation.
3. **Attendance**: Mark a class present, add exceptions, and verify analytics.
4. **Finance**: Search student, collect fee, and verify Receipt PDF layout.
5. **Detail Page**: Edit student details and verify lifecycle transfer/archive actions.
6. **Communications**: Create a notice, verify delivery records, and check notification bell.
7. **Security**: Confirm one tenant cannot see student/notice data from another tenant.

---

## Phase 2 — Academic, HR, Timetable, and Accounting Expansion

**Status: Next Phase**

Do not start Phase 2 until Phase 1B is stable or explicitly deferred.

### Phase 2A — Academics, Exams, CAS, and Report Cards

- 2A.1 Exam term setup.
- 2A.2 Assessment component setup.
- 2A.3 Subject marks entry.
- 2A.4 CAS records.
- 2A.5 Grade/GPA calculation.
- 2A.6 Marks lock/unlock workflow.
- 2A.7 Report card generation.
- 2A.8 Promotion readiness.
- 2A.9 Result publishing and parent notifications.

### Phase 2B — Homework and Timetable

- 2B.1 Homework assignment.
- 2B.2 Homework reminders.
- 2B.3 Submission tracking.
- 2B.4 Teacher review and correction remarks.
- 2B.5 Timetable setup.
- 2B.6 Teacher conflict detection.
- 2B.7 Teacher availability and workload limits.
- 2B.8 Room/period conflict checks.
- 2B.9 Timetable versioning, effective-from dates, publish/lock/archive workflow.
- 2B.10 Substitution workflow for absent teachers.
- 2B.11 Notifications through M10.

### Phase 2C — HR and Payroll

- 2C.1 Staff profile depth.
- 2C.2 Staff attendance.
- 2C.3 Leave management.
- 2C.4 Salary structure.
- 2C.5 Payroll run.
- 2C.6 Payroll review/approval/posting.
- 2C.7 Payslip PDF.
- 2C.8 Payroll register and reports.
- 2C.9 Payroll-to-accounting integration.

### Phase 2D — Full M9 Accounting and Finance

- 2D.1 Chart of accounts finalization.
- 2D.2 AccountingPostingService boundary.
- 2D.3 Double-entry journal posting.
- 2D.4 Fiscal years and fiscal periods.
- 2D.5 Immutable ledger rules.
- 2D.6 Reversal/correction workflow.
- 2D.7 Trial balance and general ledger.
- 2D.8 Income statement and balance sheet.
- 2D.9 Cash book, VAT summary, TDS/PF reports.
- 2D.10 Audit-ready exports.

### Phase 2E — Parent Communication Expansion

- 2E.1 Parent-class teacher thread model.
- 2E.2 Guardian-to-primary-class-teacher access rules.
- 2E.3 Message send/read APIs.
- 2E.4 Read receipts and message status.
- 2E.5 Chat availability and quiet hours.
- 2E.6 Outside-hours queued message notice.
- 2E.7 Teacher notification rules through M10.
- 2E.8 Admin/principal moderation and escalation.
- 2E.9 Attachment support later with signed URLs.
- 2E.10 Retention, audit, abuse reporting, and closure workflow.

## Phase 3 — Extended School Operations

### Phase 3A — Library Management

- 3A.1 Book catalog.
- 3A.2 Copy/barcode/QR tracking.
- 3A.3 Issue workflow.
- 3A.4 Return workflow.
- 3A.5 Overdue fines.
- 3A.6 Lost/damaged books.
- 3A.7 Borrower history.
- 3A.8 Library reports.
- 3A.9 Integration with M3 fees and M10 reminders.

### Phase 3B — Transport Management

- 3B.1 Route, stop, vehicle, and driver setup.
- 3B.2 Student transport enrollment.
- 3B.3 Driver trip start/complete workflow.
- 3B.4 Boarding/drop status.
- 3B.5 Parent notifications.
- 3B.6 Admin route dashboard.
- 3B.7 Driver GPS location ingestion.
- 3B.8 Redis latest-location cache.
- 3B.9 WebSocket/SSE live tracking.
- 3B.10 Parent child-specific tracking.
- 3B.11 Basic ETA and trip history.
- 3B.12 Premium GPS device/geofence/overspeed/route-deviation later.

### Phase 3C — Canteen Management

- 3C.1 Menu setup.
- 3C.2 Meal plan setup.
- 3C.3 Student meal enrollment.
- 3C.4 Daily meal served tracking.
- 3C.5 QR/student ID scan serving.
- 3C.6 Daily meal count and consumption reports.
- 3C.7 Student canteen wallet and manual top-up.
- 3C.8 POS item catalog and sales counter.
- 3C.9 Parent controls, low-balance alerts, and purchase history.
- 3C.10 Allergy/dietary warning enforcement.
- 3C.11 Inventory, vendors, profit/loss, and accounting integration later.

### Phase 3D — Parent and Mobile Expansion

- 3D.1 Parent dashboard.
- 3D.2 Parent attendance view.
- 3D.3 Parent fee and receipt view.
- 3D.4 Parent activity feed view.
- 3D.5 Parent notices and consent view.
- 3D.6 Push notifications.
- 3D.7 Mobile/API client stabilization.
- 3D.8 Parent payment gateway readiness.

## Phase 4 — AI, Analytics, Scale, and Enterprise SaaS

Start Phase 4 only after reliable production data exists.

### Phase 4A — AI/ML Features

- 4A.1 Attendance risk prediction.
- 4A.2 Fee defaulter risk scoring.
- 4A.3 Student learning/behavior insights.
- 4A.4 Activity caption assistance.
- 4A.5 Parent engagement analytics.
- 4A.6 School performance dashboards.

### Phase 4B — Advanced Data Platform

- 4B.1 Analytics warehouse.
- 4B.2 Event tracking.
- 4B.3 Longitudinal student data.
- 4B.4 School benchmarking.
- 4B.5 Cohort analysis.

### Phase 4C — Scale Optimization

- 4C.1 Query optimization.
- 4C.2 Redis cache expansion.
- 4C.3 Queue scaling.
- 4C.4 Read replicas if needed.
- 4C.5 Observability and performance dashboards.
- 4C.6 Modular extraction only if scale/team/deployment/compliance justify it.

### Phase 4D — Enterprise SaaS

- 4D.1 Multi-school group support.
- 4D.2 Advanced subscription and billing.
- 4D.3 White-label branding.
- 4D.4 Compliance exports.
- 4D.5 SLA, monitoring, and observability.
- 4D.6 Enterprise onboarding and support tooling.

## Phase Count Summary

```text
4 main phases
15 major sub-phases
110–130 practical implementation slices/sprints
```

Breakdown:

```text
Phase 1: 2 major sub-phases, around 18 smaller sprints
Phase 2: 5 major sub-phases, around 35–40 smaller sprints
Phase 3: 4 major sub-phases, around 35–40 smaller sprints
Phase 4: 4 major sub-phases, around 25–30 smaller sprints
```

## Current Recommended Phase 1B Remaining Order

1. Stabilize Activity media frontend preview/download.
2. PDF visual polish: receipt + student ID card.
3. Attendance monthly register/report/export.
4. Student photo upload/storage.
5. Class roster export CSV/PDF.
6. School branding/logo settings.
7. Playwright smoke tests stabilization.
8. Final Phase 1B browser QA pass.
