# SchoolOS Main Phase Structure

This phase structure has been consolidated into the master SchoolOS memory.

Current source of truth:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Current repo audit:

```text
docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
```

Related focused plans:

```text
docs/project/SCHOOLOS_STUDENT_IDENTITY_QR_PLAN.md
docs/project/SCHOOLOS_M11_INTELLIGENCE_ROADMAP.md
docs/project/SCHOOLOS_M9_ACCOUNTING_COMPLETION.md
```

Keep this file as a phase compatibility pointer for older prompts that still reference `SCHOOLOS_PHASE_STRUCTURE.md`.

---

## Current Position

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core Foundation Depth: Completed
Phase 2A M4 Academics backend: Complete / Contract-Protected
Phase 2D M9 Accounting: Production Candidate Complete
Current stage: Phase 2A backend complete + Phase 2 foundations + M9 production-candidate completion + Phase 3 operations admin foundations
```

Current readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

---

## Main Phase Summary

| Phase | Name | Goal | Status |
|---|---|---|---|
| Phase 0 | Technical/SaaS Foundation | Establish monorepo, auth/RBAC, tenant context, database, queues, and verification foundations. | Completed |
| Phase 1 | Pilot-Ready Core School System | Make the system usable for real live-school daily operations and polish it for pilot use. | Completed / Pilot-Ready |
| Phase 2 | Academic, HR, Timetable, Communication, and Accounting Expansion | Add academic depth, timetable/homework, HR/payroll, full M9 accounting, controlled parent communication expansion, and cross-module hardening such as QR-based Student Identity. | Phase 2A backend complete; M9 Accounting production-candidate complete; other foundations implemented |
| Phase 3 | Extended School Operations | Add library, transport, canteen, and parent/mobile expansion using shared foundations such as Student QR Identity. | Admin foundations implemented for Library/Transport/Canteen; parent/mobile and driver/live tracking later |
| Phase 4 | AI, Analytics, Scale, and Enterprise SaaS | Add M11 School Intelligence & Analytics, AI/ML features, analytics platform, scale optimizations, and enterprise SaaS controls. | Roadmap documented; implementation later |

---

## Current Recommended Order

```text
1. Repo Verification & Stabilization Sprint.
2. Fix any remaining Prisma/schema/typecheck/test blockers.
3. Stabilize Homework/Timetable after recent verification follow-ups.
4. Wire Phase 2A Academics admin UI to completed backend APIs.
5. Add authenticated Playwright browser smoke tests.
6. Prepare controlled pilot staging.
7. Harden one existing vertical at a time after the repo is green.
```

Do not begin broad new product fronts until this is clean.

---

## Phase 1 — Pilot-Ready Core School System

Status: **Completed / Pilot-Ready**.

### Phase 1A — Core Live-School Workflows

Completed:

```text
Auth/RBAC/Tenant Isolation
M1 Admissions and Student Creation
M2 Attendance Core Workflow
M3 Fee Collection and Receipts
M5 Activity Feed and Milestones Core
M10 Notices, Consent, and Delivery Records
Dashboard Shell and Core Frontend Screens
Production Hardening Foundation
```

### Phase 1B — Operational Depth and Pilot Polish

Completed / pilot-ready:

```text
Student detail, edit, guardian edit, lifecycle, transfer, documents, roster exports
Attendance history, monthly register, correction guardrails, CSV/PDF export foundation
Invoice detail, student ledger, payment reversal/correction, cashier close, reports
Notification center, read tracking, delivery retry/resend, notice detail
Activity media access, lifecycle/moderation foundation
Global search, academic year context, settings/branding foundation
Functional student ID/receipt PDFs
```

Remaining polish:

```text
Final iEMIS export mapping
Duplicate merge operational depth
Logo/photo UX polish
Final PDF visual polish
Authenticated Playwright browser smoke coverage
```

---

## Phase 2 — Academic, HR, Timetable, Communication, and Accounting Expansion

Status: **Partially complete**.

Sub-phases:

- 2A Academics, Exams, CAS, and Report Cards — **backend complete / contract-protected**.
- 2B Homework and Timetable — foundation implemented; stabilization priority.
- 2C HR and Payroll — foundation implemented; deeper lifecycle/accounting tests needed.
- 2D Full M9 Accounting and Finance — **Production Candidate Complete**.
- 2E Parent Communication Expansion — foundation implemented / further hardening later.
- 2F Student Identity QR Foundation — foundation documented / staged for vertical reuse.

### Phase 2A — M4 Academics, Exams, CAS, and Report Cards

Status: **Backend Complete / Contract-Protected**.

Completed backend sequence:

```text
Step 1 — Exam Terms + Assessment Components foundation
Step 2 — Subject Marks Entry
Step 3 — CAS Records
Step 4 — Nepal Grading/GPA Result Preview
Step 5 — Marks Lock/Unlock Workflow Hardening
Step 6 — Report Card Generation Backend Hardening
Step 7 — Promotion Readiness Backend Hardening
Step 8 — Result Publishing + Parent Notification Backend Hardening
Step 9 — Backend Final Hardening + Phase 2A Flow Contract
```

Completed backend scope:

```text
- Tenant-scoped exam term and assessment component APIs.
- Transactional marks bulk upsert with max-mark, absent, withheld, and lock validation.
- CAS create/list/update/delete and bulk upsert.
- Server-side Nepal grading/GPA result preview for student/class results.
- Marks lock request/review/unlock workflow with audit logs.
- Report card generation requiring locked marks and rejecting incomplete/withheld outcomes.
- Promotion readiness based on generated/locked report cards instead of raw marks.
- Result publishing, unpublishing, and parent notification hardening.
- Consent-aware result notification through CommunicationsService.
- Phase 2A flow contract test covering the full backend chain.
```

Next Phase 2A work:

```text
- Phase 2A frontend/admin UI wired to real APIs.
- Browser smoke/Playwright contracts for the full Phase 2A workflow.
- Report card PDF visual polish.
- Future locked report-card correction/regeneration workflow.
- Deeper academic reports and exports.
```

### Phase 2B — Homework and Timetable

Status: **Foundation implemented; stabilization priority**.

Implemented foundation:

```text
Homework assignment/submission/review/correction foundation
Timetable setup/versioning foundation
Teacher/room/class conflict service foundation
Timetable lifecycle validation service foundation
Homework attachment access boundaries
Database guardrails and indexes
Controller/contract tests
```

Current priority:

```text
Resolve any remaining Prisma/schema/service/test drift.
Run full local verification.
Add deeper integration tests for locked timetable edits, teacher/room conflicts, substitute availability, homework late/correction/reminder idempotency.
```

### Phase 2C — HR and Payroll

Status: **Foundation implemented**.

Implemented foundation:

```text
Staff profile lifecycle
Contracts
Salary structures
Payroll lifecycle
Payslip/report aliases
Payroll-to-accounting integration tests
Database guardrails and indexes
```

Remaining:

```text
Leave/payroll deduction depth
Payroll void/reversal workflows
Payslip batch generation/storage
More service/integration tests
UI polish
```

### Phase 2D — Full M9 Accounting and Finance

Status: **Production Candidate Complete**.

Completed scope:

```text
- Ledger correctness and double-entry enforcement.
- Decimal-safe ledger posting.
- Immutable posted journals.
- Source-based idempotent posting.
- Database-level idempotency constraints.
- Reversal and correction workflows.
- Fiscal period lifecycle: OPEN, LOCKED, CLOSED.
- Fiscal year close/reopen workflow.
- Opening balance workflow.
- Expense/payment/receipt/contra voucher workflows.
- Trial Balance, General Ledger, Cash Book, Income Statement, Balance Sheet.
- VAT/TDS/PF summaries.
- CSV report exports.
- Explicit report account mappings.
- Bank reconciliation.
- Frontend Accounting workspace.
- Granular RBAC permissions, audit coverage, and tenant isolation.
```

Remaining future enhancements:

```text
- PDF accounting exports.
- Saved report snapshots and File Registry integration.
- Advanced bank auto-match rules.
- Accounting audit log viewer UI.
- Seeded Playwright accounting workflow tests.
- Production seed review for default Chart of Accounts and report mappings.
```

### Phase 2E — Parent Communication Expansion

Status: **Foundation implemented / deeper hardening later**.

Implemented foundation:

```text
Parent-class teacher thread model foundation
Guardian/class-teacher access direction
Message/read receipt aliases
Quiet hours/chat availability direction
Moderation/escalation aliases
Consent/versioning/marketing preference foundations
```

Remaining:

```text
Guardian cannot message unrelated teacher integration tests
Teacher cannot view unrelated class thread tests
Quiet-hours/emergency override tests
Provider callback handling
Scheduled outside-hours release worker if required
```

### Phase 2F — Student Identity QR Foundation

Ownership: **M1 Admissions & Student Profiles**.

Goal: create a reusable student identity foundation before Library, Canteen, Transport, and Parent/Mobile workflows depend on it.

Scope:

```text
- Immutable Student ID code generated during student registration/admission.
- Revocable QR credential per student.
- QR code on student ID card PDF/profile.
- QR generation, rotation, and revocation APIs.
- Authenticated QR scan/resolve API.
- Purpose-based scan responses: LIBRARY, CANTEEN, TRANSPORT, ATTENDANCE, GENERAL_STUDENT_LOOKUP.
- Tenant-scoped and permission-scoped QR access.
- Audit logs for generate, rotate, revoke, resolve, and scan actions.
- Biometrics intentionally deferred.
```

---

## Phase 3 — Extended School Operations

Status: **Admin foundations implemented; production depth incomplete**.

Sub-phases:

- 3A Library Management.
- 3B Transport Management.
- 3C Canteen Management.
- 3D Parent and Mobile Expansion.

### Phase 3A — Library Management

Implemented foundation:

```text
Book catalog
Copy/barcode tracking
Issue/return workflow
Overdue/report endpoints
Admin UI foundation
Permissions/indexes/guardrails
```

Remaining:

```text
Deeper reports
Fine/accounting depth
Barcode/QR UX
Service-level integration tests
Popular-books/borrower-history depth
```

### Phase 3B — Transport Management

Implemented foundation:

```text
Route/stop/vehicle/driver setup
Student assignments
Trip lifecycle
Boarding/drop status
Redis latest-location foundation
Parent child-specific active-trip endpoint foundation
Reports/CSV foundation
```

Deferred / remaining:

```text
Driver app
Parent live map
WebSocket/SSE live tracking UI
GPS retention/sampling policy
ETA/geofence/overspeed/route-deviation premium features
```

### Phase 3C — Canteen Management

Implemented foundation:

```text
Menu setup
Meal plans
Student enrollments
Meal serving
Wallets/top-up/transactions
POS sales
Spending controls
Reports/CSV foundation
```

Deferred / remaining:

```text
Inventory/vendor/profit-loss
Canteen accounting posting integration
Parent wallet UI
Low-balance notification integration tests
Allergy warning tests from real student health fields
```

### Phase 3D — Parent and Mobile Expansion

Status: **Deferred**.

Do not build broad parent/mobile portal until admin foundations, permission boundaries, and browser smoke coverage are stable.

---

## Phase 4 — AI, Analytics, Scale, and Enterprise SaaS

Status: **Roadmap documented; implementation deferred**.

Phase 4 is owned primarily by **M11 School Intelligence & Analytics**.

Detailed M11 plan:

```text
docs/project/SCHOOLOS_M11_INTELLIGENCE_ROADMAP.md
```

Do not start AI/ML implementation until reliable production data exists and the M11 event/snapshot/risk-score foundation is approved.

M11 outputs must never automatically punish students, block fees, suspend access, make payroll/staff discipline decisions, or publicly rank teachers.

---

## Verification Gate

Run the full gate after major backend/module changes:

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

---

## Rule

Do not expand every Phase 2/3 module at once. Keep existing Phase 2 and Phase 3 admin foundations focused, tenant-scoped, tested, production-aware, and clear about deferred parent/mobile, driver app, live map/WebSocket, inventory/vendor, AI implementation, and biometric scope.
