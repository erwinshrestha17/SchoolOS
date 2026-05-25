# SchoolOS Master Project Memory

**Status:** M0 Platform Core Provider/Queue Hardening + M10 Provider/Attachment Depth + Phase 2 Academics/Accounting Production Polish + Student QR Foundation + M2 Attendance Hardening Slice + M3 Fees/Receipts Hardening Slice + Phase 3/4 Operations Depth Hardened
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
docs/project/SCHOOLOS_TRANSPORT_REALTIME_READINESS.md
```

Do not recreate separate phase structure, scalability, student QR, M9, M11, pricing, platform-core, or settings-boundary docs unless the project grows enough to justify splitting them again.

---

## 1. Current State

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core Foundation: Completed across eight sprints; provider/queue pilot hardening implemented; broader pilot hardening remains
M10 Communication provider/attachment/retry depth: Implemented for admin web scope
Phase 2A M4 Academics backend/admin UI: Completed
Phase 2 Academics production polish: Completed (report-card PDFs, corrections/history, exports, snapshots, and smoke coverage)
Student QR Foundation: Implemented; release hardening remains
Phase 2D M9 Accounting: Completed
Phase 2 Accounting production polish: Completed (report PDFs, snapshots, reconciliation suggestions, audit trail, and smoke coverage)
SchoolOS Flutter mobile app: Started under apps/schoolos_mobile with auth/API wiring now in progress
Current stage: M0 platform foundation complete with provider/queue hardening + M10 provider/attachment/retry depth + Phase 1 pilot-ready core + M2 attendance correction/offline-draft hardening slice + M3 fees/receipts reprint/reversal/close/readiness hardening slice + Phase 2 Academics/Accounting complete + Student QR foundation implemented + Phase 3/4 operations feature-depth hardening for M6, M7, M8A, M8C, and M8B + mobile companion app foundation started
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
Strict Phase Gate 0 from docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md
→ keep verification, migrations, seed data, smoke tests, and stale docs stable
→ continue controlled pilot reliability across M0, M10, and Phase 1 core
→ run staging browser/manual QA for Homework/Timetable, HR/Payroll, Library, Canteen, and Transport
→ then add remaining depth only where pilot evidence shows risk
```

Do not expand Phase 2/3 modules broadly at once. Existing Phase 3 admin modules may be polished and hardened. The Flutter mobile companion app has started, but parent/driver-facing feature depth must stay purpose-limited, tenant-scoped, and backed by ownership tests before release.

---

## 2. Core Architecture

```text
Monorepo: pnpm
Backend: NestJS modular monolith
Database: PostgreSQL + Prisma
Cache/queues: Redis + BullMQ
Shared package: packages/core
Current frontend: Next.js dashboard in apps/web
Mobile app: Flutter companion app in apps/schoolos_mobile
Future frontend target: apps/web public site + apps/admin Angular dashboard later
```

Rules:

- Keep the modular monolith first.
- Do not introduce microservices unless scale/team/deployment/compliance clearly justify it.
- Do not migrate to Angular yet.
- Do not rename `tenantId` to `schoolId` without a deliberate migration.
- Backend-first for data integrity.
- UI must consume real APIs.
- Mobile must consume the existing modular-monolith APIs with bearer tokens and secure refresh-token storage; do not create mobile-only response shapes without versioning.
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
| M0 | Platform Core / SaaS Starter | Foundation completed across eight sprints; provider/queue pilot hardening implemented; entitlement/SaaS/staging depth remains |
| M1 | Admissions & Student Profiles | Phase 1A/1B complete / pilot-ready with Student QR, storage-hardened student photo and school logo uploads, document audit visibility, iEMIS export artifact registration, duplicate candidate review, and generated PDF storage-route hardening foundations |
| M2 | Smart Attendance | Phase 1A/1B complete / pilot-ready plus correction/offline-draft hardening slice |
| M3 | Fees & Receipts | Phase 1A/1B complete / pilot-ready plus receipt reprint, reversal, cashier-close, reconciliation, and gateway-readiness hardening slice |
| M4 | Exams, CAS & Report Cards | Phase 2 backend/admin UI plus production PDF/report/correction/snapshot polish implemented |
| M5 | Activity Feed & Milestones | Phase 1A/1B complete with media/moderation hardening foundations, backend-backed web post detail, and web lifecycle/moderation controls |
| M6 | Homework & Timetable | Phase 3 operational hardening complete plus parent/student homework access fail-closed depth |
| M7 | HR & Payroll | Phase 3 operational hardening complete plus run-scoped register/PF/TDS/component reporting depth |
| M8A | Library Management | Phase 3 admin/backend foundation plus fine-to-fees/accounting tests, staff borrower support, bounded history, and QR lookup |
| M8B | Transport Management | Phase 3 admin/trip/location/report foundation plus GPS pressure guard, Redis cache/fanout tests, and retention cleanup bounds; live/driver/parent later |
| M8C | Canteen Management | Phase 3 admin/wallet/POS/inventory/vendor/report foundation plus POS receipt JSON/PDF reprint endpoints, supplier/item admin UI, wallet negative-balance guards, and meal-plan-to-M3 invoice linkage; parent views later |
| M9 | Accounting & Finance | Phase 2D production-candidate complete plus PDF/snapshot/reconciliation polish implemented |
| M10 | Notices & Communication | Phase 1A/1B + parent-teacher chat foundation plus provider modes, File Registry attachments, and failure-dashboard depth |
| M11 | School Intelligence & Analytics | Roadmap only; implementation deferred |

---

## 5. M0 Platform Core Foundation Completion

Status: **Completed across eight sprints; provider/queue pilot hardening implemented; broader pilot hardening remains.**

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
- Tenant-scoped platform API key management with server-generated one-time secrets, SHA-256 hashed storage, masked metadata responses, revoke flow, and audit records.
- Provider readiness detail API with dry-run validation, disabled-mode warnings, masked secret reporting, and S3-compatible object-storage readiness checks without paid external calls by default.
- Shared storage service now uses a provider-neutral adapter contract with normalized local/s3/r2/minio/gcp config, local and S3-compatible adapters, backward-compatible R2 env aliases, private-by-default writes, and short-lived signed URL helpers while keeping provider secrets out of API responses.
- Queue health, failed-job detail inspection, sanitized payload visibility, stack/timing detail, retry audit history, and audited retry endpoint.
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
PlatformApiKey
ProviderConfig
ReportExport
TenantOnboardingChecklistOverride
```

M0 permission, audit, and security notes:

```text
- Granular platform permissions exist for dashboard, tenants, plans, subscriptions, usage, billing, providers, API keys, queues, audit, health, reports, and onboarding.
- Feature keys and usage keys are exposed through platform APIs.
- Platform actions affecting tenants, plans, subscriptions, overrides, billing, providers, API keys, queues, exports, and onboarding are audited.
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

Current M0 pilot-hardening snapshot:

```text
Implemented:
- Provider readiness detail and dry-run validation.
- Tenant API key create/list/revoke backend endpoints with hashed secrets and safe summaries.
- Object-storage readiness checks for normalized local/S3/MinIO/R2-style provider configuration without unsafe external calls by default.
- M0 storage readiness now starts from normalized StorageService config and no longer requires a legacy ProviderConfig row to report env-backed readiness.
- Queue failed-job detail with sanitized payload, failure metadata, stack trace, and retry audit history.
- Platform settings provider readiness and queue job detail surfaces.

Verified:
- Targeted platform API tests passed.
- Web contract tests passed.
- Storage Sprint 1 passed pnpm db:generate, pnpm db:validate, pnpm verify:openapi, pnpm lint, pnpm typecheck, and pnpm test.
- API-key M0 slice passed pnpm db:generate, pnpm db:validate, pnpm verify:openapi, focused platform tests, pnpm lint, pnpm typecheck, pnpm test, and pnpm build.

Blocked:
- Current storage rollout pnpm test:e2e is blocked by existing non-storage e2e failures: SaaS invoice Decimal string formatting, finance/M9 suspended-tenant setup, and missing student lifecycle tenant fixture.
- pnpm verify:production is still blocked at pnpm test:e2e by existing non-API-key e2e failures: SaaS invoice Decimal string formatting, finance/M9 suspended-tenant setup, and missing student lifecycle tenant fixture.
- pnpm smoke:phase1 still requires local Postgres, Redis, API, and web services.
```

Remaining M0 hardening work:

```text
- Async report/export generation expansion module by module.
- Provider test connection must remain conservative/no paid external calls unless explicitly configured.
- Demo Nepal tenant seed expansion.
- Credentialed web E2E coverage where seeded credentials are available.
- Platform/school route denial browser tests.
- API key management UI and browser regression coverage.
- Webhook system: endpoint registry, signed delivery, retries, and delivery audit history.
- SaaS billing lifecycle tests: invoice -> payment -> overdue/cancel/suspend.
- Entitlement enforcement tests against real school APIs.
- Object storage readiness verification against explicit staging provider.
- File Registry signed URL/direct-upload hardening and M1-M10 module-by-module storage migration audit.
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
2A Academics, Exams, CAS, Report Cards — complete for backend/admin UI and production PDF/report/correction/snapshot polish
2B Homework and Timetable — Completed / Pilot-Ready
2C HR and Payroll — Completed / Pilot-Ready
2D M9 Accounting and Finance — production-candidate complete with PDF/snapshot/reconciliation polish
2E Parent Communication Expansion — foundation implemented / provider, moderation, retention, and mobile depth remains
2F Student Identity QR Foundation — implemented foundation; release QA, ID-card PDF verification, and deeper scan tests remain
```

### Phase 3 — Extended School Operations

Status: **Operations (Homework, Timetable, HR, Payroll) hardened; others in admin-foundation state.**

```text
Library admin/backend foundation with fines, reports, history, and QR lookup
Transport admin/trip/location/report foundation
Canteen admin/wallet/POS/inventory/vendor/report foundation
Homework, Timetable, HR, and Payroll operational depth complete (Phase 3)
Parent/mobile, driver app, live transport map/WebSocket/SSE, and deeper accounting/billing integrations later
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

Remaining Phase 2A polish:

```text
- Run browser smoke in local/staging where web ports, credentials, Postgres, Redis, and API are available.
- Embed configured raster logos in PDFs if/when the simple PDF engine supports image embedding.
- Add optional CAS summary, failed-threshold, and promotion-readiness exports only if product rules require them.
```

---

## 8. Student Identity QR Foundation

Status: **Implemented foundation with credential history hardening; release QA remains.**

Student QR identity belongs to M1 Admissions & Student Profiles, not Library-only, Canteen-only, or Transport-only.

Implemented foundation:

```text
- StudentQrCredential model and StudentQrStatus enum.
- Secure QR credential generation with token hashing.
- Generate, rotate, revoke, resolve, and safe status/history API.
- Transactional QR rotation now marks the old credential ROTATED and creates a new ACTIVE credential, preserving audit-safe credential history instead of overwriting the old row.
- Purpose-based scan responses for general, Library, Canteen, Transport, and Attendance contexts.
- Student profile QR management card.
- Shared QR resolver UI foundation.
- Library borrower QR lookup.
- Canteen QR resolve endpoint.
```

Remaining hardening:

```text
- Verify immutable student identity code behavior across all admission paths.
- ID-card PDF generation has backend integration coverage for opaque QR payload rendering paths without tokenHash exposure; visual QR rendering still needs manual/staging verification with real generated cards.
- Add deeper QR tenant, permission, role-purpose, and audit/browser tests.
- Add QR manual QA across Student profile, Library issue/return, and Canteen serving/POS.
- Add optional Transport QR usage only where it improves operator flow.
- Add parent/mobile QR-related views later, after Phase 5 opens.
```

Biometrics are explicitly out of scope until QR identity is stable, parent trust is established, legal/privacy rules are reviewed, and the product has strong consent, retention, encryption, audit, and deletion workflows.

---

## 9. M9 Accounting Completion and Rules

M9 Accounting is **Production Candidate Complete** with Phase 2 production polish implemented.

Completed scope includes ledger correctness, double-entry enforcement, Decimal-safe posting, immutable posted journals, source-based idempotent posting, reversal/correction workflows, fiscal period lifecycle, fiscal year close/reopen, opening balances, vouchers, trial balance, general ledger, cash book, income statement, balance sheet, VAT/TDS/PF summaries, CSV/PDF exports, File Registry report snapshots, deterministic bank reconciliation suggestions, frontend Accounting workspace, granular RBAC, audit coverage, tenant-scoped queries, and AccountingPostingService ledger boundary.

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
- Dedicated bank-reconciliation PDF export.
- Accounting audit log viewer UI.
- Browser smoke execution in local/staging where web ports and credentials are available.
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
M0 Platform Core: 85-90% foundation complete with provider/queue pilot hardening; entitlement/SaaS/staging depth remains
Phase 2A M4 Academics: backend/admin UI plus PDF/report/correction/snapshot polish implemented
Student QR Foundation: implemented / release hardening remains
M9 Accounting: production-candidate complete plus PDF/snapshot/reconciliation polish implemented
```

Module estimates:

| Module | Estimated Completion |
|---|---:|
| Auth/Security/Tenant | 90-95% |
| M0 Platform Core | 85-90% |
| M1 Admissions & Student Profiles | 90-95% |
| M2 Attendance | 85-90% |
| M3 Fees & Receipts | 90-95% |
| M5 Activity Feed | 75-85% |
| M10 Notices & Communication | 85-90% |
| M4 Academics | 100% |
| M6 Homework & Timetable | 95-100% |
| M7 HR & Payroll | 95-100% |
| M9 Accounting | 98-100% |
| M8A Library | 65-75% |
| M8B Transport | 60-70% |
| M8C Canteen | 85-91% |
| M11 Intelligence / AI | 0% implementation |

Biggest risks:

```text
- Docker-backed smoke is pending because Postgres, Redis, and API must be running.
- M0 platform/school route denial, SaaS billing lifecycle, entitlement enforcement, and queue retry coverage need deeper E2E/regression tests.
- Phase Gate 0 in the remaining implementation plan must be completed before broad new scope.
- Existing Phase 2/3 breadth needs vertical hardening outside M4 and M9.
- Student QR foundation exists, but QR-in-PDF release behavior and cross-module manual QA still need verification.
- Homework/Timetable schema/service/test stability after recent verification follow-ups.
- Pilot operations exposing real-world data-entry, fee, attendance, guardian-contact, PDF, and slow-network issues.
- Deep parent/mobile workflows beyond the started Flutter companion app, driver live-trip workflow, live map/WebSocket, full canteen purchase-bill/wastage/vendor workflows, and AI/ML implementation remain intentionally unbuilt.
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
