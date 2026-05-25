# SchoolOS Project Context

This file gives Codex and other coding assistants a short, stable context file so repeated prompts can stay small.

For full project memory, read:

- `docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md`
- `docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md`
- `docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md`
- `docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md`
- `ARCHITECTURE.md`
- `DEVELOPMENT_RULES.md`

Merged into master memory:

```text
Phase structure
Scalability roadmap
M9 Accounting completion details
M11 Intelligence / AI roadmap
Pricing tiers and entitlements plan
```

Do not recreate separate Phase Structure, Scalability, M9, M11, or Pricing/Entitlements docs unless the project becomes large enough to justify splitting them again.

## Product

SchoolOS is a production-grade, multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10.

## Current Stage

Current delivery stage:

```text
Phase 0 completed
Phase 1A completed / pilot-ready
Phase 1B completed / pilot-ready
M0 Platform Core Foundation Depth completed with provider/queue/API-key pilot hardening
M10 Communication/provider/attachment depth implemented for admin web scope
Phase 2A M4 Academics backend/admin UI completed
Phase 2 Academics production polish completed
Student QR Foundation implemented with credential history hardening / release QA remains
M1 photo/logo/iEMIS/document audit/duplicate candidate hardening slice implemented
Phase 2D M9 Accounting completed
Phase 2 Accounting production polish completed
SchoolOS Flutter mobile app started in apps/schoolos_mobile with auth/API wiring underway
Current stage: M0 platform foundation complete with provider readiness, queue failed-job detail hardening, tenant-scoped API key management, and cloud-agnostic storage adapter/config Sprint 1 implemented + M1 photo/logo/iEMIS/document audit/duplicate candidate hardening slice implemented + M2 attendance correction/offline-draft hardening slice implemented + M3 fees/receipts reprint/reversal/close/readiness hardening slice implemented + M10 provider/attachment/retry hardening + M6/M7/M8A/M8C/M8B focused feature-depth hardening + Phase 1 pilot-ready core + Phase 2 Academics/Accounting complete + Student QR foundation plus credential history hardening implemented + mobile companion app foundation started
```

Targeted web-admin polish and Phase2F smoke coverage have been completed. The latest feature-depth pass hardened M10 notifications/attachments, M6 homework parent/student scoping, M7 payroll reporting, M8A library fine/accounting tests, M8C POS/wallet receipts plus supplier/inventory item admin surfaces, and M8B GPS pressure/retention guards. Next focus is staging smoke/manual QA and remaining controlled-pilot reliability work in `docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md`.

The repo is ahead of older Phase 1B/Phase 2-transition notes. Phase 2A Academics backend/admin UI is complete and Phase 2 Academics polish is completed. M9 Accounting is completely finished. Student QR foundation is implemented. Foundations now exist for Homework/Timetable, HR/Payroll, Parent Communication/Messaging, Library, Transport, and Canteen.

Current work should focus on stabilization, correctness, scale, permissions, tests, verification, and admin UX polish for existing modules rather than opening broad new product fronts.

Recommended near-term direction:

```text
Strict Phase Gate 0
→ keep verification, migrations, seed data, smoke tests, and stale docs stable
→ continue controlled pilot reliability across M0, M10, and Phase 1 core
→ run staging browser/manual QA for Homework/Timetable, HR/Payroll, Library, Canteen, and Transport
→ then add remaining depth only where pilot evidence shows risk
```

Explicitly deferred unless requested:

```text
Deep parent/mobile module expansion beyond the started Flutter companion app
Driver live-trip workflow beyond the started mobile shell
Live transport map/WebSocket UI
Broad SaaS billing automation
AI/ML implementation
Microservices
Angular migration
```

## Stack

- Monorepo: `pnpm`
- Backend: NestJS modular monolith
- Database: PostgreSQL with Prisma
- Cache/queues: Redis + BullMQ
- Shared package: `packages/core`
- Current frontend: Next.js dashboard in `apps/web`
- Mobile app: Flutter companion app in `apps/schoolos_mobile`
- Future frontend target:
  - `apps/web` = public website, SEO/admissions/public pages
  - `apps/admin` = Angular internal dashboard later

Do not migrate to Angular yet.
Do not introduce microservices unless clearly justified.
Do not rename `tenantId` to `schoolId`.

## Current Backend/API Module Snapshot

Implemented or registered backend foundations now include:

- Auth/RBAC/Tenant Isolation
- Mobile API foundation: bearer-token auth, refresh-token storage, tenant slug login, and role-aware Flutter shell in `apps/schoolos_mobile`
- M0 Platform Core: platform tenant control, tenant settings, file registry, reports, usage service, plan service foundations, provider readiness detail, queue failed-job detail, retry audit history, and tenant-scoped API key management with hashed secrets
- M0 Storage Foundation: provider-neutral StorageAdapter contract, normalized local/s3/r2/minio/gcp config, R2 alias compatibility, local and S3-compatible adapters, private-by-default writes, and M0 readiness wired to normalized storage config
- M1 Admissions & Student Profiles, including student photos/documents through File Registry, safe image validation for student photos and school logos, iEMIS CSV export artifact registration, duplicate candidate review, and generated student PDFs stored behind protected SchoolOS API routes instead of adapter public URLs
- M2 Smart Attendance
- M3 Fees & Receipts
- M4 Academics, Exams, CAS, Report Cards backend/admin UI plus Phase 2 PDF/report/correction/snapshot polish
- M5 Activity Feed & Milestones
- M6 Homework & Timetable depth: File Registry attachment workflows, reminders, timetable/substitution hardening, and parent/student fail-closed assignment listing
- M7 Staff/HR and Payroll depth: posting locks, reversal/accounting integration, PII masking, and run-scoped PF/TDS/component reporting
- Student QR identity foundation with token hashing, purpose-based resolve, transactional rotate-to-history, and safe status/history API
- M8A Library Management admin/backend foundation with fine-to-fees/accounting boundary tests, staff borrower coverage, reports, bounded history, and QR lookup
- M8B Transport Management admin/trip/location/report foundation with Redis latest-location cache, throttled persistence, GPS pressure guard, retention cleanup bounds, and parent active-trip ownership tests
- M8C Canteen Management admin/wallet/POS/inventory/vendor/report foundation with POS receipt JSON/PDF reprint endpoints, meal-plan-to-M3 invoice linkage, supplier/inventory item admin UI, wallet reversal/correction negative-balance guards, idempotency, stock, and accounting-source hardening
- M9 Accounting & Finance production-candidate completion plus Phase 2 PDF/snapshot/reconciliation polish
- M10 Notices, Notifications, Communications, Messaging / Parent-Class Teacher foundation
- M11 School Intelligence & Analytics roadmap only

Treat Phase 2/3 modules as foundation/admin-ready unless verified locally. Several GitHub-connector PRs noted that full local verification was not run in the connector environment. Production readiness still requires local/staging verification.

## Readiness

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

## Module Completion Estimate

```text
Full SchoolOS vision: around 70-80% implemented
Phase 1 pilot product: around 90-95% implemented
M4 Academics backend/admin UI and Phase 2 polish: complete
Student QR Foundation: implemented with credential history hardening / release QA remains
M9 Accounting: production-candidate complete with Phase 2 polish
```

Approximate module status:

```text
Auth/Security/Tenant: 90-95%
M0 Platform Core: 85-90%
M1 Students: 90-95%
M2 Attendance: 85-90%
M3 Fees: 90-95%
M4 Academics: 95-100%
M5 Activity: 75-85%
M6 Homework/Timetable: 95-100%
M7 HR/Payroll: 95-100%
M8A Library: 80-90%
M8B Transport: 75-85%
M8C Canteen: 80-90%
M9 Accounting: 95-100%
M10 Communications: 85-90%
M11 Intelligence/AI: 0% implementation
```

## Three-Plane SaaS Architecture

SchoolOS has three logical planes inside the same modular monolith.

```text
Platform Control Plane: /platform/*
Tenant Configuration Plane: /dashboard/settings/*
School Operations Plane: /dashboard/*
```

Rules:

- Platform Control Plane is for SchoolOS company administration.
- Tenant Configuration Plane is for a school to configure itself.
- School Operations Plane is for school workflows.
- Do not mix SchoolOS SaaS billing with school fee collection.
- Platform support/tenant override must be explicit and audited.
- For the full school-settings vs platform-settings boundary, read `docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md`.

## Tenant Boundary

`tenantId` is the current database and Prisma tenant/school boundary.
Do not rename `tenantId` to `schoolId` unless a future migration is explicitly planned.

## Scalability Rule

SchoolOS scalability is now documented in the master memory and must be applied during development, not postponed to the end.

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
13. If pricing/tiered access is involved, which feature key, entitlement, and usage limit controls access?
14. If intelligence/AI is involved, is the output explainable and human-reviewed?
```

Scalability implementation order:

```text
Feature -> tenant isolation -> indexes -> pagination -> queue slow work -> audit sensitive actions -> tests -> verification.
```

## M9 Accounting Rules

M9 Accounting is production-candidate complete, but all rules remain strict:

```text
- Immutable posted journals.
- Reversal/correction instead of silent edits.
- Double-entry debit = credit enforcement.
- OPEN/LOCKED/CLOSED fiscal period control.
- Source document linkage for every journal.
- AccountingPostingService boundary for other modules.
- Decimal/numeric money only.
- Backend ledger reports only.
- Audit posting, approval, reversal, closing, reopening, reconciliation, and exports.
```

## M11 School Intelligence & Analytics Roadmap

M11 is documented in the master memory as the Phase 4 intelligence and analytics layer. Do not implement M11 product features yet.

Rules:

```text
- Roadmap/documentation can be updated now.
- Implementation waits until reliable production data exists.
- Start with explainable rule-based analytics, not model-first AI.
- No automated punishment, fee blocking, suspension, payroll decision, or public teacher ranking from AI/risk scores.
- Human review is required before AI output becomes official communication or record.
- Cross-school analytics require anonymization, aggregation, explicit opt-in, and platform audit.
```

## Pricing and Entitlement Rules

Pricing tiers and entitlement rules are documented in the master memory.

Golden rule:

```text
Plan controls what the school bought.
Feature entitlement controls what the tenant can access.
RBAC controls what the user can do.
Usage limits control how much they can use.
Frontend uses entitlements only for display.
Backend enforces entitlements for security.
```

Do not hardcode plan names into feature access logic. Use feature keys.

## Core Rules

- Backend-first for data integrity.
- UI must consume real APIs, not fake production data.
- Every tenant-owned query must be tenant-scoped.
- Every list endpoint must use pagination/filtering for growing data.
- Every new high-volume query must include an index review.
- Every business-critical write must be audited.
- Platform actions affecting tenants must be audited.
- Keep the modular monolith structure.
- Prefer small, focused tasks over broad rewrites.
- Move slow, retryable, provider, report, and PDF work to BullMQ workers.
- Redis is for cache, queue, latest-value, and rate-limit style use cases; PostgreSQL remains source of truth.
- Do not start AI feature implementation until the M11 event/snapshot/risk-score foundation is approved and reliable production data exists.
- Do not start broad SaaS billing automation until platform plan/subscription boundaries are approved.
- Do not copy generic SaaS-template modules blindly; adapt reusable platform pieces into SchoolOS only when they strengthen production readiness.

## Verification Gate

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

## Recommended Codex Prompt Format

```text
Read these files first:
- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- DEVELOPMENT_RULES.md
- docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
- docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md when planning execution order
- docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md when touching platform/settings boundaries

Task:
[Exact feature/change]

Constraints:
- Do not rewrite unrelated files.
- Keep the NestJS modular monolith structure.
- Keep all tenant-owned queries tenant-scoped by tenantId.
- Keep platform routes separated from tenant/school routes.
- Add pagination/filtering for growing list endpoints.
- Add or review indexes for new high-volume query patterns.
- Move slow/retryable/provider/report/PDF work to BullMQ where appropriate.
- Add validation, error handling, audit logs, and tests where needed.
- Run the relevant verification commands.
- Return summary, files changed, scalability decisions, tests, verification results, and remaining gaps only.
```
