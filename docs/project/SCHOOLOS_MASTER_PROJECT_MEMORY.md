# SchoolOS Master Project Memory

**Status:** Phase 2 implemented foundations + Phase 3 operations admin foundations
**Product:** Production-grade multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard

This is the consolidated source of truth for SchoolOS. It merges the long-term project roadmap, main phase structure, platform core memory, scalability roadmap, and current repo analysis summary.

For the full locally generated version, use the file already prepared in this conversation: `SCHOOLOS_MASTER_PROJECT_MEMORY.md`. This GitHub copy establishes the master document path and consolidates the decision surface so future updates can be made here instead of spreading context across many long files.

---

## 1. Current State

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
Current stage: Phase 2 implemented foundations + Phase 3 operations admin foundations
```

SchoolOS is ready for controlled Phase 1 pilot preparation, and the repo now contains real Phase 2 backend/web foundations plus Phase 3 operations admin foundations. The next work should harden existing modules rather than opening broad new fronts.

Recommended near-term direction:

```text
Run pilot hardening while deepening one existing vertical at a time.
Highest priority: M9 accounting correctness, tenant isolation, reports/exports, and production verification.
Keep parent/mobile portal, driver app, live map/WebSocket, full inventory/vendor workflows, and AI/ML deferred.
```

Do not expand Phase 2/3 modules broadly at once. Existing Phase 3 admin modules may be polished and hardened, but parent/mobile and driver-facing experiences remain separate future scope.

---

## 2. Core Architecture

- Monorepo: `pnpm`
- Backend: NestJS modular monolith
- Database: PostgreSQL with Prisma
- Cache/queues: Redis + BullMQ
- Shared package: `packages/core`
- Current frontend: Next.js dashboard in `apps/web`
- Future target:
  - `apps/web` = public website, SEO/admissions/public pages
  - `apps/admin` = Angular internal dashboard later

Rules:

- Keep the modular monolith first.
- Do not introduce microservices unless scale/team/deployment/compliance clearly justify it.
- Do not migrate to Angular yet.
- Do not rename `tenantId` to `schoolId` without a deliberate migration.
- Backend-first for data integrity.
- UI must consume real APIs.

---

## 3. Three-Plane SaaS Architecture

SchoolOS has three logical planes inside the same modular monolith.

### 3.1 Platform Control Plane

For SchoolOS company/operator users.

```text
Frontend: /platform/*
Backend:  /platform/*
Roles: PLATFORM_SUPER_ADMIN, PLATFORM_SUPPORT, PLATFORM_BILLING_ADMIN
```

Purpose:

- Manage schools/tenants.
- Manage plans, usage, subscriptions, billing, support access, health, audit, and platform settings.
- Keep SaaS billing separate from school fee collection.

### 3.2 Tenant Configuration Plane

For each school principal/admin.

```text
Frontend: /dashboard/settings/*
Backend:  /settings/* or /tenant-settings/*
Roles: TENANT_PRINCIPAL, TENANT_ADMIN
```

Purpose:

- School profile, branding, academic year, fiscal settings, receipt preferences, attendance rules, fee reminders, notification rules, future chat hours.
- Always tenant-scoped by `tenantId`.

### 3.3 School Operations Plane

For daily school workflows.

```text
Frontend: /dashboard/*
Backend:  module APIs such as /students, /attendance, /finance, /notices
Roles: TENANT_ADMIN, TENANT_TEACHER, TENANT_ACCOUNTANT, TENANT_STAFF, TENANT_PARENT, TENANT_STUDENT
```

Purpose:

- Students, admissions, attendance, fees, notices, activity, reports, and later academics, HR/payroll, library, transport, canteen, accounting.

---

## 4. Production Module Map

| Module | Name | Phase |
|---|---|---|
| M0 | Platform Core / SaaS Starter | Foundation + gradual rollout |
| M1 | Admissions & Student Profiles | Phase 1A/1B |
| M2 | Smart Attendance | Phase 1A/1B |
| M3 | Fees & Receipts | Phase 1A/1B |
| M4 | Exams, CAS & Report Cards | Phase 2 foundation implemented |
| M5 | Activity Feed & Milestones | Phase 1A/1B |
| M6 | Homework & Timetable | Phase 2 foundation implemented |
| M7 | HR & Payroll | Phase 2 foundation implemented |
| M8A | Library Management | Phase 3 admin foundation implemented |
| M8B | Transport Management | Phase 3 admin foundation implemented |
| M8C | Canteen Management | Phase 3 admin foundation implemented |
| M9 | Accounting & Finance | Phase 2 foundation implemented; hardening priority |
| M10 | Notices & Communication | Phase 1A/1B + parent-teacher chat foundation |

---

## 5. Main Phase Structure

### Phase 1 — Pilot-Ready Core School System

Status: Completed / Pilot-Ready.

Includes:

- Auth/RBAC/tenant isolation.
- Admissions and student profiles.
- Attendance core workflow.
- Fee collection and receipts.
- Activity feed and milestones.
- Notices, consent, and delivery records.
- Dashboard shell and Phase 1 screens.
- Phase 1B operational depth, reports, exports, detail pages, lifecycle actions, notification center, global search, cashier close, PDF polish foundation.

### Phase 2 — Academic, HR, Timetable, and Accounting Expansion

Status: Implemented foundation; production hardening in progress.

Sub-phases:

- 2A Academics, Exams, CAS, and Report Cards.
- 2B Homework and Timetable.
- 2C HR and Payroll.
- 2D Full M9 Accounting and Finance.
- 2E Parent Communication Expansion.

### Phase 3 — Extended School Operations

Status: Admin foundations implemented for Library, Transport, and Canteen. Parent/mobile, driver app, live tracking UX, full canteen inventory/vendor workflows, and deeper reports remain later.

- Library.
- Transport.
- Canteen.
- Parent/mobile expansion.

### Phase 4 — AI, Analytics, Scale, and Enterprise SaaS

Start only after reliable production data exists.

Includes:

- Attendance risk prediction.
- Fee defaulter scoring.
- Student insights.
- Activity caption assistance.
- Transport ETA prediction.
- Accounting anomaly detection.
- Analytics warehouse/read models.
- Enterprise SaaS controls.

---

## 6. M0 Platform Core Roadmap

Add platform capabilities gradually; do not copy generic SaaS modules blindly.

Priority order:

1. Platform Control Plane depth.
2. Tenant Settings foundation.
3. Generic File Registry.
4. Global API Response Envelope with PDF/file/CSV exceptions.
5. Generic Reports Foundation.
6. Safe Activity Logs Module.
7. Usage Limits and Plan Rules.
8. API Key Management.
9. Webhook System.
10. SaaS Subscription and Billing.

Important distinction:

```text
SchoolOS Finance/M3/M9 = school collects money from students/parents.
SaaS Billing = SchoolOS company charges schools for using SchoolOS.
```

---

## 7. Scalability Rules

Scalability must be implemented as development continues.

Every new feature must answer:

```text
1. Which module owns this feature: M0 or M1-M10?
2. Which backend folder/API namespace/frontend route owns it?
3. Which tenant owns this data?
4. Which role/permission can access it?
5. Is the list paginated?
6. Which index supports the main query?
7. Does the write need a transaction?
8. Is the operation idempotent?
9. Should this be sync or queued?
10. Does it require audit logging?
11. Does it affect accounting/ledger?
12. What tests prove tenant isolation and permissions?
```

Implementation order:

```text
Feature -> tenant isolation -> indexes -> pagination -> queue slow work -> audit sensitive actions -> tests -> verification
```

Core scalable runtime direction:

```text
Browser/Mobile Client
  -> Load Balancer
  -> schoolos-api instances
  -> PostgreSQL primary database
  -> Redis cache / BullMQ queue
  -> Object storage
  -> Worker processes
```

Move slow/retryable work to BullMQ workers:

- Notifications.
- Report/PDF generation.
- Batch billing.
- Defaulter reminders.
- Payroll posting/payslips.
- Media compression.
- Large CSV/PDF exports.
- Future transport ETA jobs.

---

## 8. M9 Accounting Rules

Full M9 belongs to Phase 2. Finance ledger foundation may continue before full M9 is complete.

Non-negotiable rules:

1. Immutable ledger: never edit confirmed journal entries.
2. Use reversal/correction/adjustment entries.
3. Enforce double-entry: total debit = total credit.
4. Enforce fiscal period states: OPEN, LOCKED, CLOSED.
5. Every journal links to a source document.
6. Other modules post through `AccountingPostingService` or a clear accounting boundary.
7. Use PostgreSQL numeric/Prisma Decimal; never floating point.
8. Journal/voucher/receipt numbers are unique per tenant/fiscal year.
9. Reports come from backend ledger data.
10. Audit posting, approval, reversal, closing, reopening, and exports.

---

## 9. Current Repo Analysis Summary

Repo inspection on May 6, 2026 indicates:

```text
Full SchoolOS vision: around 60–70% implemented
Phase 1 pilot product: around 90–95% implemented
```

Readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

Module estimates:

| Module | Estimated Completion |
|---|---:|
| Auth/Security/Tenant | 90–95% |
| Platform Control Plane | 45–55% |
| M1 Admissions & Student Profiles | 90–95% |
| M2 Attendance | 85–90% |
| M3 Fees & Receipts | 85–90% |
| M5 Activity Feed | 75–85% |
| M10 Notices & Communication | 85–90% |
| M4 Academics | 70–80% |
| M6 Homework & Timetable | 60–70% |
| M7 HR & Payroll | 65–75% |
| M9 Accounting | 55–65% |
| M8A Library | 45–55% |
| M8B Transport | 45–55% |
| M8C Canteen | 45–55% |
| AI/ML | 0% |

Biggest risks:

- Existing Phase 2/3 breadth without enough depth.
- Accounting complexity and ledger immutability.
- Pilot operations exposing real-world data-entry, fee, attendance, guardian-contact, PDF, slow-network, and contract-test drift issues.
- Parent/mobile portal, driver app, live map/WebSocket, full canteen inventory/vendor workflows, and AI/ML remain intentionally unbuilt.

---

## 10. Verification Commands

Run relevant checks after meaningful changes:

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

## 11. Future Codex Prompt Format

```text
Read these first:
- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- DEVELOPMENT_RULES.md
- docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md

Task:
[exact feature/change]

Constraints:
- Do not rewrite unrelated files.
- Keep NestJS modular monolith.
- Keep tenantId as the tenant/school boundary.
- Keep all tenant-owned reads/writes tenant-scoped.
- Keep platform, tenant settings, and school operations route boundaries separate.
- Add pagination/filtering for growing lists.
- Review/add indexes for high-volume queries.
- Move slow/retryable/provider/report/PDF work to BullMQ where appropriate.
- Add validation, error handling, audit logs, and tests.
- Run relevant verification commands.

Return:
- Summary
- Files changed
- Backend/API/frontend ownership decisions
- Scalability decisions
- Tests run
- Verification results
- Remaining gaps
```
