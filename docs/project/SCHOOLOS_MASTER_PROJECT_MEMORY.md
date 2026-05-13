# SchoolOS Master Project Memory

**Status:** M0 Platform Core Foundation Complete + Phase 2A M4 Academics backend complete + Phase 2D M9 Accounting Production Candidate Complete + Targeted Frontend Polish Complete
**Product:** Production-grade multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard

This is the consolidated source of truth for SchoolOS. It merges the long-term project roadmap, main phase structure, platform/settings memory, scalability roadmap, current repo analysis summary, Student Identity QR plan, M9 Accounting completion note, M11 Intelligence roadmap, and pricing/entitlements plan.

Focused companion docs:

```text
PROJECT_CONTEXT.md
ARCHITECTURE.md
DEVELOPMENT_RULES.md
docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md
docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md
```

Do not recreate separate phase structure, scalability, student QR, M9, M11, pricing, platform-core, or settings-boundary docs unless the project grows enough to justify splitting them again.

---

## 1. Current State

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core Foundation: Completed across eight sprints
Phase 2A M4 Academics backend: Completed / Contract-Protected
Phase 2D M9 Accounting: Production Candidate Complete
Current stage: Phase 2A backend complete + M0 platform foundation complete + Phase 2 foundations + M9 production-candidate completion + Phase 3 operations admin foundations + Targeted Frontend Polish Complete
```

Targeted web-admin frontend polish and Phase 2F browser smoke coverage are now present on main.

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
UI-6D Deeper Finance/Accounting Reports Visual Polish, Academics Marks/CAS Keyboard UX, and Real-Credential Manual QA
→ Polish finance/accounting report visuals
→ Implement Academics marks/CAS keyboard UX
→ Conduct manual QA with real credentials
→ Prepare controlled pilot staging
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
| M0 | Platform Core / SaaS Starter | Foundation completed across eight sprints; M0 pilot hardening next |
| M1 | Admissions & Student Profiles | Phase 1A/1B complete / pilot-ready |
| M2 | Smart Attendance | Phase 1A/1B complete / pilot-ready |
| M3 | Fees & Receipts | Phase 1A/1B complete / pilot-ready |
| M4 | Exams, CAS & Report Cards | Phase 2A backend and admin UI complete |
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

## 5. M0 Platform Core Foundation Completion

Status: **Completed across eight sprints; pilot hardening next.**

Completed sprint sequence:

```text
1. Platform Tenant Management
2. Entitlements + Usage
3. SaaS Billing
4. Providers + Queues
5. File Registry
6. Reports / Exports
7. Observability / Ops
8. Pilot Onboarding
```

Implemented M0 capabilities:

```text
- Tenant list/detail/dashboard/status flows.
- Reason-required tenant suspend/activate behavior.
- Audited support override reason.
- Plan, feature, subscription, override, and usage-counter foundations.
- Explainable entitlement checks and usage-limit surfaces.
- Manual tenant billing profile.
- SaaS invoices, invoice lines, payments, and cancellation rules.
- Provider config masking and secret-safe response shape.
- Queue health and audited retry endpoint.
- Upload validation and dangerous extension blocking.
- Private/protected file URL response shape.
- Report export history and audited export persistence where available.
- Platform health summary for DB, Redis, queues, and object storage readiness.
- Computed tenant onboarding checklist.
- School settings onboarding page.
- Platform tenant onboarding visibility.
```

Implemented M0 models:

```text
PlatformPlan
PlatformPlanFeature
TenantSubscription
TenantFeatureOverride
UsageLimit
UsageCounter
TenantBillingProfile
SaaSInvoice
SaaSInvoiceLine
SaaSPayment
ProviderConfig
ReportExport
TenantOnboardingChecklistOverride
```

M0 permission, audit, and security notes:

```text
- Granular platform permissions exist for dashboard, tenants, plans, subscriptions, usage, billing, providers, queues, audit, health, reports, and onboarding.
- Feature keys and usage keys are exposed through platform APIs.
- Platform actions affecting tenants, plans, subscriptions, overrides, billing, providers, queues, exports, and onboarding are audited.
- Reason fields are required where tenant-impacting actions need accountability.
- Provider secrets must never be returned raw.
- Queue retry actions must be permission-guarded and audited.
- Backend entitlement checks remain mandatory; frontend gating is display only.
```

Verification snapshot from the M0 completion pass:

```text
Passed:
- pnpm db:generate
- pnpm db:validate
- pnpm verify:openapi
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm test:e2e
- pnpm build
- pnpm verify:production

Notes:
- verify:production passed after rerun with approval because sandbox blocked Playwright local port binding.
- pnpm smoke:phase1 did not pass because local Postgres, Redis, and API were not running.
- Focused platform/auth/report/settings tests passed.
```

Remaining M0 hardening work:

```text
- Deeper BullMQ failed-job inspection per deployed queue topology.
- Async report/export generation expansion module by module.
- Provider test connection limitations remain intentionally conservative/no paid external calls.
- Demo Nepal tenant seed expansion.
- Credentialed web E2E coverage where seeded credentials are available.
- Platform/school route denial browser tests.
- SaaS billing lifecycle tests: invoice -> payment -> overdue/cancel/suspend.
- Entitlement enforcement tests against real school APIs.
- Object storage readiness verification against staging provider.
- Docker-backed smoke once Postgres, Redis, and API are running.
```

---

## 6. Phase Structure

### Phase 1 — Pilot-Ready Core School System

Status: **Completed / Pilot-Ready**.

Includes Auth/RBAC/tenant isolation, admissions, student profiles, attendance, fees, receipts, activity feed, notices, consent, delivery records, dashboard shell, Phase 1 screens, Phase 1B operational depth, reports, exports, lifecycle actions, notification center, global search, cashier close, and PDF polish foundation.

### Phase 2 — Academic, HR, Timetable, Communication, and Accounting Expansion

Status: **Partially complete**.

```text
2A Academics, Exams, CAS, Report Cards — complete (backend and admin UI)
2B Homework and Timetable — foundation implemented; stabilization priority
2C HR and Payroll — foundation implemented; deeper lifecycle/accounting tests needed
2D M9 Accounting and Finance — production-candidate complete
2E Parent Communication Expansion — foundation implemented / further hardening later
2F Student Identity QR Foundation — approved cross-module foundation; implement before deeper Library/Canteen/Transport QR usage
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

## 7. Phase 2A — M4 Academics Backend Completion

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

Next Phase 2A work:

```text
- Browser smoke/Playwright contracts for the full Phase 2A workflow.
- Report card PDF visual polish.
- Future locked report-card correction/regeneration workflow.
- Deeper academic reports and exports.
```

---

## 8. Student Identity QR Foundation

Status: **Approved cross-module foundation. Implementation should happen before deeper Phase 3 QR-dependent workflows.**

Student QR identity belongs to M1 Admissions & Student Profiles, not Library-only, Canteen-only, or Transport-only.

Approved near-term direction:

```text
- Immutable Student ID code generated during registration/admission.
- Revocable QR credential per student.
- QR code on student ID cards.
- Authenticated QR scan/resolve API.
- Purpose-based QR scan responses.
- Reuse QR identity in Library, Canteen, optional Transport, and parent/mobile views.
```

Biometrics are explicitly out of scope until QR identity is stable, parent trust is established, legal/privacy rules are reviewed, and the product has strong consent, retention, encryption, audit, and deletion workflows.

---

## 9. M9 Accounting Completion and Rules

M9 Accounting is **Production Candidate Complete**.

Completed scope includes ledger correctness, double-entry enforcement, Decimal-safe posting, immutable posted journals, source-based idempotent posting, reversal/correction workflows, fiscal period lifecycle, fiscal year close/reopen, opening balances, vouchers, trial balance, general ledger, cash book, income statement, balance sheet, VAT/TDS/PF summaries, CSV exports, bank reconciliation, frontend Accounting workspace, granular RBAC, audit coverage, tenant-scoped queries, and AccountingPostingService ledger boundary.

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

## 10. M11 School Intelligence & Analytics Roadmap

Status: **Roadmap only. No implementation yet.**

M11 is the future intelligence and analytics layer. It must not be implemented as random AI features. It starts with structured data capture, safe read models, feature snapshots, explainable rules, human-reviewed recommendations, and only later ML/LLM features after reliable production data exists.

Non-negotiable M11 rules:

```text
- Documentation and roadmap updates are allowed now.
- Do not implement M11 product features until reliable production data exists.
- Start with explainable rule-based analytics, not model-first AI.
- No automated punishment from risk scores.
- Human review is required before AI output becomes an official communication, report, record, or action.
- Cross-school analytics require anonymization, aggregation, explicit opt-in, and platform audit.
- Every intelligence read/write must remain tenant-scoped by tenantId unless it is an approved platform aggregate.
- Every sensitive insight access must be audited.
```

---

## 11. Pricing Tiers and Entitlements Plan

Status: **Roadmap documented. M0 now includes plan/feature/subscription/usage foundations, but broad SaaS billing automation remains future paid-rollout work.**

Technical golden rule:

```text
Plan controls what the school bought.
Feature entitlement controls what the tenant can access.
RBAC controls what the user can do.
Usage limits control how much they can use.
Frontend uses entitlements only for display.
Backend enforces entitlements for security.
```

Critical boundary:

```text
SchoolOS SaaS billing = SchoolOS company charges schools.
M3/M9 school finance = schools collect money from parents/students.
Do not mix these accounting domains.
```

---

## 12. Scalability Rules

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

---

## 13. Current Repo Analysis Summary

```text
Full SchoolOS vision: around 70-80% implemented
Phase 1 pilot product: around 90-95% implemented
M0 Platform Core: 80-90% foundation complete / pilot hardening next
Phase 2A M4 Academics backend: complete / contract-protected
M9 Accounting: production-candidate complete
```

Module estimates:

| Module | Estimated Completion |
|---|---:|
| Auth/Security/Tenant | 90-95% |
| M0 Platform Core | 80-90% |
| M1 Admissions & Student Profiles | 90-95% |
| M2 Attendance | 85-90% |
| M3 Fees & Receipts | 85-90% |
| M5 Activity Feed | 75-85% |
| M10 Notices & Communication | 85-90% |
| M4 Academics | 100% |
| M6 Homework & Timetable | 60-70% |
| M7 HR & Payroll | 65-75% |
| M9 Accounting | 95-100% |
| M8A Library | 45-55% |
| M8B Transport | 45-55% |
| M8C Canteen | 45-55% |
| M11 Intelligence / AI | 0% implementation |

Biggest risks:

```text
- Docker-backed smoke is pending because Postgres, Redis, and API must be running.
- M0 platform/school route denial, SaaS billing lifecycle, entitlement enforcement, and queue retry coverage need deeper E2E/regression tests.
- 2. Current Action Priority  
The immediate objective is to shift focus to deeper report card PDF generation, advanced accounting polish, and overall staging pilot verification, as the M4 Academics admin UI has been successfully completed and wired.
- Existing Phase 2/3 breadth without enough depth outside M4 and M9.
- Homework/Timetable schema/service/test stability after recent verification follow-ups.
- Pilot operations exposing real-world data-entry, fee, attendance, guardian-contact, PDF, and slow-network issues.
- Parent/mobile portal, driver app, live map/WebSocket, full canteen inventory/vendor workflows, and AI/ML implementation remain intentionally unbuilt.
- Tiered pricing and entitlements must be enforced backend-side before broad paid rollout; sidebar hiding alone is not security.
```

---

## 14. Verification Commands

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

After recent verification follow-ups, rerun the full gate locally before treating the repo as green.

---

## 15. Future Codex Prompt Format

```text
Read these first:
- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- DEVELOPMENT_RULES.md
- docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
- docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md when planning implementation order
- docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md when touching platform/settings boundaries

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
