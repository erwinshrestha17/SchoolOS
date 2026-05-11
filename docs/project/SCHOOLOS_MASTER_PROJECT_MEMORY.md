# SchoolOS Master Project Memory

**Status:** Phase 2A M4 Academics backend complete + Phase 2D M9 Accounting Production Candidate Complete + Phase 2/3 foundations in progress  
**Product:** Production-grade multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard

This is the consolidated source of truth for SchoolOS. It merges the long-term project roadmap, main phase structure, platform core memory, scalability roadmap, and current repo analysis summary.

Focused companion plans:

```text
PROJECT_CONTEXT.md
docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md
docs/project/SCHOOLOS_SCALABILITY_ROADMAP.md
docs/project/SCHOOLOS_M11_INTELLIGENCE_ROADMAP.md
docs/project/SCHOOLOS_PRICING_TIERS_AND_ENTITLEMENTS_PLAN.md
docs/project/SCHOOLOS_M9_ACCOUNTING_COMPLETION.md
```

---

## 1. Current State

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core Foundation Depth: Completed
Phase 2A M4 Academics backend: Completed / Contract-Protected
Phase 2D M9 Accounting: Production Candidate Complete
Current stage: Phase 2A backend complete + Phase 2 foundations + M9 production-candidate completion + Phase 3 operations admin foundations
```

SchoolOS is ready for controlled Phase 1 pilot preparation, and the repo now contains real Phase 2 backend/web foundations plus Phase 3 operations admin foundations. M4 Academics Phase 2A backend is complete and contract-protected. M9 Accounting has moved from hardening priority to production-candidate complete after full verification passed.

Recommended near-term direction:

```text
Run pilot hardening while deepening one existing vertical at a time.
Next priority: build the Phase 2A Academics frontend/admin UI against the completed backend APIs, then add browser smoke/Playwright contracts for the full Phase 2A workflow.
After Phase 2A UI, stabilize and browser-test the completed Accounting UI, then continue focused hardening for Homework/Timetable, HR/Payroll, Library, Transport, and Canteen.
Keep parent/mobile portal, driver app, live map/WebSocket, full canteen inventory/vendor workflows, and AI/ML implementation deferred.
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

- Students, admissions, attendance, fees, notices, activity, reports, academics, HR/payroll, library, transport, canteen, accounting, and future intelligence dashboards.

---

## 4. Production Module Map

| Module | Name | Phase |
|---|---|---|
| M0 | Platform Core / SaaS Starter | Foundation + gradual rollout |
| M1 | Admissions & Student Profiles | Phase 1A/1B |
| M2 | Smart Attendance | Phase 1A/1B |
| M3 | Fees & Receipts | Phase 1A/1B |
| M4 | Exams, CAS & Report Cards | Phase 2A backend complete / contract-protected; admin UI next |
| M5 | Activity Feed & Milestones | Phase 1A/1B |
| M6 | Homework & Timetable | Phase 2 foundation implemented |
| M7 | HR & Payroll | Phase 2 foundation implemented |
| M8A | Library Management | Phase 3 admin foundation implemented |
| M8B | Transport Management | Phase 3 admin foundation implemented |
| M8C | Canteen Management | Phase 3 admin foundation implemented |
| M9 | Accounting & Finance | Phase 2D Production Candidate Complete |
| M10 | Notices & Communication | Phase 1A/1B + parent-teacher chat foundation |
| M11 | School Intelligence & Analytics | Phase 4 roadmap documented; implementation deferred |

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

Status: Phase 2A backend is complete and contract-protected; M9 Accounting is production-candidate complete; other Phase 2 foundations are implemented and need vertical hardening.

Sub-phases:

- 2A Academics, Exams, CAS, and Report Cards — **backend complete / contract-protected**.
- 2B Homework and Timetable — foundation implemented.
- 2C HR and Payroll — foundation implemented.
- 2D Full M9 Accounting and Finance — **Production Candidate Complete**.
- 2E Parent Communication Expansion — foundation implemented / further hardening later.
- 2F Student Identity QR Foundation — foundation documented / staged for vertical reuse.

#### Phase 2A — M4 Academics Backend Completion

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

Latest verified Phase 2A backend results:

```text
pnpm --filter @schoolos/api test src/academics/phase2a-flow.contract.spec.ts
  PASS: 1 suite / 9 tests

pnpm --filter @schoolos/api test src/integrity/production-contracts.spec.ts
  PASS: 1 suite / 11 tests

pnpm typecheck
  PASS: API + web

pnpm test
  PASS: API 76 suites / 494 tests
  PASS: Web 71 tests
```

Next Phase 2A work:

```text
- Phase 2A frontend/admin UI wired to real APIs.
- Browser smoke/Playwright contracts for the full Phase 2A workflow.
- Report card PDF visual polish.
- Future locked report-card correction/regeneration workflow.
- Deeper academic reports and exports.
```

### Phase 3 — Extended School Operations

Status: Admin foundations implemented for Library, Transport, and Canteen. Parent/mobile, driver app, live tracking UX, full canteen inventory/vendor workflows, and deeper reports remain later.

- Library.
- Transport.
- Canteen.
- Parent/mobile expansion.

### Phase 4 — AI, Analytics, Scale, and Enterprise SaaS

Status: Roadmap documented; implementation later.

Phase 4 is owned primarily by **M11 School Intelligence & Analytics**. The detailed plan lives in:

```text
docs/project/SCHOOLOS_M11_INTELLIGENCE_ROADMAP.md
```

Phase 4 must start with intelligence foundations, not model-first AI.

M11 safety rules:

```text
- No automated punishment.
- No fee blocking, student suspension, payroll decision, staff discipline, or public teacher ranking from AI/risk scores.
- Human review is required before AI output becomes official communication, report, record, or action.
- Sensitive intelligence views are principal/admin-only unless explicitly designed otherwise.
- Cross-school analytics require anonymization, aggregation, explicit opt-in, and platform audit.
- Every intelligence read/write must remain tenant-scoped by tenantId unless it is an approved platform aggregate.
- Every sensitive insight access must be audited.
```

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
8. Pricing Tiers and Entitlements Foundation.
9. API Key Management.
10. Webhook System.
11. SaaS Subscription and Billing.

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
1. Which module owns this feature: M0 or M1-M11?
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
13. If intelligence/AI is involved, is the output explainable and human-reviewed?
14. If pricing/tiered access is involved, which feature key, entitlement, and usage limit controls access?
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
- Future M11 intelligence snapshot generation, risk scoring, insight generation, AI inference logging, and network aggregate jobs.

---

## 8. M9 Accounting Rules and Completion Status

Full M9 belongs to Phase 2D and is now **Production Candidate Complete**.

Completed M9 scope:

```text
- Ledger correctness and double-entry enforcement.
- Decimal-safe money handling with PostgreSQL numeric / Prisma Decimal.
- Immutable posted journals.
- Source-based idempotent posting.
- Database-level idempotency constraints.
- Reversal and correction workflows.
- Fiscal period lifecycle: OPEN, LOCKED, CLOSED.
- Fiscal year close/reopen workflow.
- Opening balance workflow.
- Voucher workflows for expense/payment/receipt/contra use cases.
- Trial Balance backend.
- General Ledger backend.
- Cash Book backend.
- Income Statement backend.
- Balance Sheet backend.
- VAT/TDS/PF summaries.
- CSV report exports.
- Explicit report account mappings.
- Bank reconciliation.
- Frontend Accounting workspace.
- Granular RBAC permissions.
- Audit coverage for critical accounting actions.
- Tenant-scoped accounting queries.
- AccountingPostingService ledger boundary.
```

Non-negotiable rules remain:

1. Immutable ledger: never edit confirmed journal entries.
2. Use reversal/correction/adjustment entries.
3. Enforce double-entry: total debit = total credit.
4. Enforce fiscal period states: OPEN, LOCKED, CLOSED.
5. Every journal links to a source document.
6. Other modules post through `AccountingPostingService` or a clear accounting boundary.
7. Use PostgreSQL numeric/Prisma Decimal; never floating point.
8. Journal/voucher/receipt numbers are unique per tenant/fiscal year.
9. Reports come from backend ledger data.
10. Audit posting, approval, reversal, closing, reopening, bank reconciliation, and exports.

Remaining M9 future enhancements:

```text
- PDF accounting exports.
- Saved report snapshots / File Registry integration for generated reports.
- Advanced bank auto-match rules.
- Accounting audit log viewer UI.
- Seeded Playwright accounting workflow tests.
- Production seed review for default Chart of Accounts and report mappings.
```

---

## 9. Current Repo Analysis Summary

Repo status after Phase 2A backend completion and M9 completion:

```text
Full SchoolOS vision: around 70-80% implemented
Phase 1 pilot product: around 90-95% implemented
Phase 2A M4 Academics backend: complete / contract-protected
M9 Accounting: production-candidate complete
```

Readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks
M4 Academics backend-ready: Yes
M9 Accounting production-candidate: Yes
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

Module estimates:

| Module | Estimated Completion |
|---|---:|
| Auth/Security/Tenant | 90-95% |
| Platform Control Plane | 65-75% |
| M1 Admissions & Student Profiles | 90-95% |
| M2 Attendance | 85-90% |
| M3 Fees & Receipts | 85-90% |
| M5 Activity Feed | 75-85% |
| M10 Notices & Communication | 85-90% |
| M4 Academics | 80-90% |
| M6 Homework & Timetable | 60-70% |
| M7 HR & Payroll | 65-75% |
| M9 Accounting | 95-100% |
| M8A Library | 45-55% |
| M8B Transport | 45-55% |
| M8C Canteen | 45-55% |
| M11 School Intelligence & Analytics / AI | 0%; roadmap documented, implementation deferred |

Biggest risks:

- Phase 2A backend is complete but still needs admin UI wiring and browser smoke tests.
- Existing Phase 2/3 breadth without enough depth outside M4 and M9.
- Pilot operations exposing real-world data-entry, fee, attendance, guardian-contact, PDF, and slow-network issues.
- Parent/mobile portal, driver app, live map/WebSocket, full canteen inventory/vendor workflows, and AI/ML implementation remain intentionally unbuilt.
- Tiered pricing and entitlements must be enforced backend-side before broad paid rollout; sidebar hiding alone is not security.

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

M9 completion verification passed with:

```text
pnpm db:generate
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
```

Phase 2A backend completion verification passed with:

```text
pnpm --filter @schoolos/api test src/academics/phase2a-flow.contract.spec.ts
  PASS: 1 suite / 9 tests

pnpm --filter @schoolos/api test src/integrity/production-contracts.spec.ts
  PASS: 1 suite / 11 tests

pnpm typecheck
  PASS: API + web

pnpm test
  PASS: API 76 suites / 494 tests
  PASS: Web 71 tests
```

Latest verified results included API unit tests, web tests, API E2E, API build, web build, and Playwright browser smoke. Authenticated Playwright accounting workflow tests should be added once seeded credentials are available. Phase 2A browser smoke tests should be added after the frontend/admin UI is wired.

Documentation-only roadmap changes do not require runtime verification, but should still be reviewed for consistency.

---

## 11. Future Codex Prompt Format

```text
Read these first:
- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- DEVELOPMENT_RULES.md
- docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md
- docs/project/SCHOOLOS_M11_INTELLIGENCE_ROADMAP.md when touching Phase 4/intelligence/AI work
- docs/project/SCHOOLOS_PRICING_TIERS_AND_ENTITLEMENTS_PLAN.md when touching plans, pricing, subscriptions, feature access, usage limits, or UI gating

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
- Move slow/retryable/provider/report/PDF/intelligence jobs to BullMQ where appropriate.
- Add validation, error handling, audit logs, and tests.
- Do not implement AI features until reliable production data and M11 foundations exist.
- Enforce plan/feature access backend-side; frontend gating is display only.
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
