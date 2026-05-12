# SchoolOS Master Project Memory

**Status:** Phase 2A M4 Academics backend complete + Phase 2D M9 Accounting Production Candidate Complete + Phase 2/3 foundations in progress  
**Product:** Production-grade multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard

This is the consolidated source of truth for SchoolOS. It merges the long-term project roadmap, main phase structure, platform core memory, scalability roadmap, current repo analysis summary, M9 Accounting completion note, M11 Intelligence roadmap, and pricing/entitlements plan.

Focused companion docs:

```text
PROJECT_CONTEXT.md
ARCHITECTURE.md
DEVELOPMENT_RULES.md
docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md
docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md
```

Do not recreate separate M9, M11, or pricing roadmap files unless the project grows enough to justify splitting them again.

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

Readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

Recommended near-term direction:

```text
Repo Verification & Stabilization Sprint
→ run full verification gate
→ fix any remaining Prisma/schema/typecheck/test blockers
→ stabilize Homework/Timetable after recent verification follow-ups
→ wire Phase 2A Academics admin UI to completed APIs
→ add authenticated Playwright browser smoke tests
→ prepare controlled pilot staging
```

Do not expand Phase 2/3 modules broadly at once. Existing Phase 3 admin modules may be polished and hardened, but parent/mobile and driver-facing experiences remain separate future scope.

---

## 2. Core Architecture

```text
Monorepo: pnpm
Backend: NestJS modular monolith
Database: PostgreSQL + Prisma
Cache/queues: Redis + BullMQ
Shared package: packages/core
Current frontend: Next.js dashboard in apps/web
Future frontend target: apps/web public site + apps/admin Angular dashboard later
```

Rules:

- Keep the modular monolith first.
- Do not introduce microservices unless scale/team/deployment/compliance clearly justify it.
- Do not migrate to Angular yet.
- Do not rename `tenantId` to `schoolId` without a deliberate migration.
- Backend-first for data integrity.
- UI must consume real APIs.
- Every tenant-owned query must be scoped by authenticated `tenantId`.
- Every business-critical write must be audited.

---

## 3. Three-Plane SaaS Architecture

SchoolOS has three logical planes inside the same modular monolith.

| Plane | Purpose | Frontend | Backend |
|---|---|---|---|
| Platform Control Plane | SchoolOS company/operator administration | `/platform/*` | `/platform/*` |
| Tenant Configuration Plane | School-owned settings/configuration | `/dashboard/settings/*` | `/settings/*` or `/tenant-settings/*` |
| School Operations Plane | Daily school workflows | `/dashboard/*` | `/students`, `/attendance`, `/finance`, `/notices`, `/academics`, `/homework`, `/timetable`, `/payroll`, `/accounting`, `/library`, `/transport`, `/canteen` |

Rules:

- Do not mix SchoolOS SaaS billing with school fee collection.
- School users must not access platform settings.
- Platform support/tenant override must require an explicit reason and audit log.
- Keep all planes inside the modular monolith for now.

---

## 4. Production Module Map

| Module | Name | Current Status |
|---|---|---|
| M0 | Platform Core / SaaS Starter | Foundation depth completed; SaaS billing/API keys/webhooks later |
| M1 | Admissions & Student Profiles | Phase 1A/1B complete / pilot-ready |
| M2 | Smart Attendance | Phase 1A/1B complete / pilot-ready |
| M3 | Fees & Receipts | Phase 1A/1B complete / pilot-ready |
| M4 | Exams, CAS & Report Cards | Phase 2A backend complete / admin UI next |
| M5 | Activity Feed & Milestones | Phase 1A/1B complete with media/moderation hardening foundations |
| M6 | Homework & Timetable | Phase 2 foundation implemented; stabilization priority |
| M7 | HR & Payroll | Phase 2 foundation implemented; deeper tests and UI polish needed |
| M8A | Library Management | Phase 3 admin foundation implemented |
| M8B | Transport Management | Phase 3 admin/trip/location foundation implemented; live/driver/parent later |
| M8C | Canteen Management | Phase 3 admin/wallet/POS foundation implemented; inventory/vendor later |
| M9 | Accounting & Finance | Phase 2D production-candidate complete |
| M10 | Notices & Communication | Phase 1A/1B + parent-teacher chat foundation |
| M11 | School Intelligence & Analytics | Roadmap only; implementation deferred |

---

## 5. Phase Structure

### Phase 1 — Pilot-Ready Core School System

Status: **Completed / Pilot-Ready**.

Includes:

```text
Auth/RBAC/tenant isolation
Admissions and student profiles
Attendance core workflow
Fee collection and receipts
Activity feed and milestones
Notices, consent, and delivery records
Dashboard shell and Phase 1 screens
Phase 1B operational depth, reports, exports, lifecycle actions, notification center, global search, cashier close, and PDF polish foundation
```

### Phase 2 — Academic, HR, Timetable, Communication, and Accounting Expansion

Status: **Partially complete**.

```text
2A Academics, Exams, CAS, Report Cards — backend complete / contract-protected
2B Homework and Timetable — foundation implemented; stabilization priority
2C HR and Payroll — foundation implemented; deeper lifecycle/accounting tests needed
2D M9 Accounting and Finance — production-candidate complete
2E Parent Communication Expansion — foundation implemented / further hardening later
2F Student Identity QR Foundation — documented / staged for vertical reuse
```

### Phase 3 — Extended School Operations

Status: **Admin foundations implemented; production depth incomplete**.

```text
Library admin foundation
Transport admin/trip/location foundation
Canteen admin/wallet/POS foundation
Parent/mobile, driver app, live transport map/WebSocket/SSE, full canteen inventory/vendor/profit-loss later
```

### Phase 4 — AI, Analytics, Scale, and Enterprise SaaS

Status: **Roadmap documented; implementation deferred**.

Phase 4 is owned primarily by M11 School Intelligence & Analytics. Do not implement AI/ML until reliable production data exists and M11 foundations are approved.

---

## 6. Phase 2A — M4 Academics Backend Completion

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

---

## 7. M9 Accounting Completion and Rules

M9 Accounting is **Production Candidate Complete**.

Completed scope:

```text
- Ledger correctness and double-entry enforcement.
- Decimal-safe ledger posting with PostgreSQL numeric / Prisma Decimal.
- Immutable posted journals.
- Source-based idempotent posting.
- Database-level idempotency constraints.
- Reversal and correction workflows.
- Fiscal period lifecycle: OPEN, LOCKED, CLOSED.
- Fiscal year close/reopen workflow.
- Opening balance workflow.
- Voucher workflows for expense, payment, receipt, and contra use cases.
- Trial Balance backend.
- General Ledger backend.
- Cash Book backend.
- Income Statement backend.
- Balance Sheet backend.
- VAT/TDS/PF summaries.
- CSV accounting report exports.
- Explicit report account mappings.
- Bank reconciliation.
- Frontend Accounting workspace.
- Granular RBAC permissions.
- Audit coverage for critical accounting actions.
- Tenant-scoped accounting queries.
- AccountingPostingService ledger boundary.
```

Non-negotiable M9 rules:

```text
1. Never edit confirmed/posting financial truth directly.
2. Use reversal/correction/adjustment entries for mistakes.
3. Enforce debit = credit for posted journals.
4. Reject posting into LOCKED or CLOSED fiscal periods.
5. Keep fiscal year/period close and reopen explicit, privileged, reasoned, and audited.
6. Every source-driven journal must link to sourceModule/sourceType/sourceId/postingType.
7. Other modules must post through AccountingPostingService or an approved accounting boundary.
8. Use Prisma Decimal/PostgreSQL numeric; never JavaScript floating point for money.
9. Reports must come from backend ledger data, not frontend calculations.
10. Audit posting, approval, reversal, correction, closing, reopening, reconciliation, and exports.
```

Remaining M9 future enhancements:

```text
- PDF accounting exports.
- Saved report snapshots and File Registry integration for generated reports.
- Advanced bank reconciliation auto-match rules.
- Accounting audit log viewer UI.
- Seeded Playwright accounting workflow tests.
- Production seed review for default Chart of Accounts and report mappings.
- Optional background export workers for large reports if tenant size requires it.
```

---

## 8. M11 School Intelligence & Analytics Roadmap

Status: **Roadmap only. No implementation yet.**

M11 is the future intelligence and analytics layer. It must not be implemented as random AI features. It starts with structured data capture, safe read models, feature snapshots, explainable rules, human-reviewed recommendations, and only later ML/LLM features after reliable production data exists.

Non-negotiable M11 rules:

```text
- Documentation and roadmap updates are allowed now.
- Do not implement M11 product features until reliable production data exists.
- Start with explainable rule-based analytics, not model-first AI.
- No automated punishment from risk scores.
- No fee blocking, student suspension, payroll decision, staff discipline, or public ranking from AI/risk scores.
- Human review is required before AI output becomes an official communication, report, record, or action.
- Sensitive intelligence views are principal/admin-only unless explicitly designed otherwise.
- Cross-school analytics require anonymization, aggregation, explicit opt-in, and platform audit.
- Every intelligence read/write must remain tenant-scoped by tenantId unless it is an approved platform aggregate.
- Every sensitive insight access must be audited.
```

M11 ownership:

```text
Module: M11 — School Intelligence & Analytics
Backend: apps/api/src/intelligence/*
API: /api/v1/intelligence/*
School dashboard: /dashboard/intelligence/*
Platform/network intelligence: /platform/intelligence/*
```

M11 consumes safe events and snapshots from M1-M10. It should not bypass module boundaries or directly mutate operational records owned by other modules.

Foundation concepts for future implementation:

```text
SchoolEvent
StudentWeeklyFeatureSnapshot
TeacherWeeklyFeatureSnapshot
GuardianWeeklyFeatureSnapshot
ClassroomWeeklyFeatureSnapshot
SchoolWeeklyFeatureSnapshot
RiskScoreSnapshot
InsightAction
AiInferenceRequest
```

Phase 4 implementation order:

```text
4A — School Intelligence Foundation
4B — Rule-Based Operational Intelligence
4C — Student Risk and Academic Quality Intelligence
4D — AI Teacher Assistant and Natural Language Interface
4E — Offline-First and Network Intelligence
4F — Scale Optimization and Enterprise SaaS
```

Priority feature order:

```text
1. Teacher Workload Balance Monitor
2. Substitute Teacher Intelligence
3. Guardian Communication Health Score
4. Academic Year Momentum Tracker
5. Exam Paper Difficulty Calibration
6. Classroom-Level Heat Events
7. Sibling Academic Correlation Report
8. Predictive Dropout Engine v1, rule-based first
9. AI Teaching Assistant with human review
10. Natural Language School Management Interface using approved query templates
11. Teacher Performance Intelligence, late and sensitive
12. Curriculum Gap Detection, later
13. Offline-first AI inference, later
14. School Health Network Intelligence, enterprise/network later
```

Natural language query safety rule:

```text
Do not let an LLM generate raw SQL directly against production DB.
Use intent parser -> approved query template -> tenant/permission filter injection -> backend service query -> audited result.
```

---

## 9. Pricing Tiers and Entitlements Plan

Status: **Roadmap only. No implementation yet.**

Positioning:

```text
Nepal-ready School Operating System for modern schools.
```

Core message:

```text
Admissions, attendance, fees, exams, payroll, transport, canteen, communication, accounting, and future AI insights — all in one secure school platform.
```

Recommended commercial packaging:

```text
Tier 1: SchoolOS Core
Tier 2: SchoolOS Professional
Tier 3: SchoolOS Intelligence
Optional add-ons: Transport GPS, Canteen, Library, SMS bundle, AI credits, Branded Parent App, Advanced Accounting, Custom Reports
```

Tier guide:

```text
SchoolOS Core:
- M1 Admissions & Student Profiles
- M2 Smart Attendance
- M3 Fees & Receipts
- M5 Activity Feed basic
- M10 Notices basic
- School Settings basic
- Basic reports/PDFs

SchoolOS Professional:
- Everything in Core
- M4 Exams, CAS & Report Cards
- M6 Homework & Timetable
- M7 HR & Payroll
- M9 Accounting basic/professional
- M10 Parent-Class Teacher Chat
- Advanced reports, exports, role management, audit logs

SchoolOS Intelligence:
- Everything in Core + Professional
- M8A Library
- M8B Transport
- M8C Canteen
- M11 School Intelligence & Analytics
- AI Teacher Assistant
- Advanced dashboards and analytics
```

Important technical rule:

```text
Plan controls what the school bought.
Feature entitlement controls what the tenant can access.
RBAC controls what the user can do.
Usage limits control how much they can use.
Frontend uses entitlements only for display.
Backend enforces entitlements for security.
```

Correct access decision:

```text
Tenant plan allows feature
+ tenant subscription is active
+ tenant feature override does not disable it
+ user role has permission
+ usage limit is not exceeded
= access allowed
```

Use feature keys, not hardcoded plan names:

```text
module.students
module.attendance
module.fees
module.exams
module.homework
module.timetable
module.hr
module.payroll
module.accounting
module.library
module.transport
module.canteen
module.intelligence
feature.receipt_pdf
feature.report_card_pdf
feature.parent_teacher_chat
feature.transport_live_tracking
feature.ai_teacher_assistant
feature.ai_dropout_prediction
feature.ai_natural_language_query
```

Future entitlement implementation phases:

```text
E1 — Entitlement Foundation: Plan, PlanFeature, TenantSubscription, TenantFeatureOverride, UsageLimit, UsageCounter, EntitlementService
E2 — Platform Plan Management
E3 — Backend guards: @RequireFeature, @RequireUsage, EntitlementGuard, UsageLimitGuard
E4 — Sidebar and route gating
E5 — Usage metering
E6 — SaaS billing and subscription
```

Critical boundary:

```text
SchoolOS SaaS billing = SchoolOS company charges schools.
M3/M9 school finance = schools collect money from parents/students.
Do not mix these accounting domains.
```

Recommended early go-to-market:

```text
Annual package + setup/training fee
```

---

## 10. Scalability Rules

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

Move slow/retryable work to BullMQ workers:

```text
Notifications
Report/PDF generation
Batch billing
Defaulter reminders
Payroll posting/payslips
Media compression
Large CSV/PDF exports
Future transport ETA jobs
Future M11 intelligence snapshot generation, risk scoring, insight generation, AI inference logging, and network aggregate jobs
```

---

## 11. Current Repo Analysis Summary

```text
Full SchoolOS vision: around 70-80% implemented
Phase 1 pilot product: around 90-95% implemented
Phase 2A M4 Academics backend: complete / contract-protected
M9 Accounting: production-candidate complete
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
| M11 Intelligence / AI | 0% implementation |

Biggest risks:

```text
- Phase 2A backend is complete but still needs admin UI wiring and browser smoke tests.
- Existing Phase 2/3 breadth without enough depth outside M4 and M9.
- Homework/Timetable schema/service/test stability after recent verification follow-ups.
- Pilot operations exposing real-world data-entry, fee, attendance, guardian-contact, PDF, and slow-network issues.
- Parent/mobile portal, driver app, live map/WebSocket, full canteen inventory/vendor workflows, and AI/ML implementation remain intentionally unbuilt.
- Tiered pricing and entitlements must be enforced backend-side before broad paid rollout; sidebar hiding alone is not security.
```

---

## 12. Verification Commands

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

After recent verification follow-ups, rerun the full gate locally before treating the repo as green.

---

## 13. Future Codex Prompt Format

```text
Read these first:
- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- DEVELOPMENT_RULES.md
- docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
- docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md when planning implementation order
- docs/project/SCHOOLOS_SETTINGS_BOUNDARIES.md when touching platform/settings boundaries

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
