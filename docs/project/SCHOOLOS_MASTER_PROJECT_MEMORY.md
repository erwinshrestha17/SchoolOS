# SchoolOS Master Project Memory

**Status:** 2026-06-04 implementation updates recorded: AGENTS operating rules, demo request backend/web integration, M9 bank import validation, M3 payment webhook signature hardening, M7 statutory deduction refinement, M0 platform DTO hardening, M2 mobile attendance query validation, settings audit-log depth, M6 substitution UI polish, M8C canteen UI polish, and module enhancement planning  
**Product:** Production-grade multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard, Flutter companion app

This is the consolidated source of truth for SchoolOS project memory. It records the current product/technical state and points to the active focused documents.

---

## 1. Active Documentation Set

```text
README.md
DEVELOPMENT_RULES.md
AGENTS.md

docs/product/SCHOOLOS_PRD_COMBINED_MASTER_2026.md
docs/business/SCHOOLOS_BRD_2026.md
docs/requirements/SCHOOLOS_SRS_2026.md
docs/requirements/SCHOOLOS_FRS_2026.md

docs/design/SCHOOLOS_UI_UX_GUIDE.md

docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
docs/project/SCHOOLOS_IMPLEMENTATION_STATUS_AND_PLAN.md
docs/project/SCHOOLOS_MODULE_FEATURE_ENHANCEMENT_PLAN.md
docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md
docs/project/SCHOOLOS_STORAGE_AND_FILE_REGISTRY.md
docs/project/SCHOOLOS_TRANSPORT_REALTIME_READINESS.md
docs/project/SCHOOLOS_SCALABILITY_HARDENING_POLICY.md

docs/production/deployment-runbook.md
docs/production/backup-restore-runbook.md
docs/production/phase1-pilot-readiness.md

apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md
apps/web/e2e/README.md
```

Do not recreate the old split PRD, repo-analysis, remaining-plan, deployment-checklist, Docker-VPS runbook, mobile project-instructions, mobile UI direction, or mobile development-plan docs unless the project grows enough to justify splitting them again.

---

## 2. Current State

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core: Foundation complete; provider/queue/API-key/File Registry hardening implemented; platform DTO validation and status/support-override request shaping refined on 2026-06-04; staging/object-storage/browser coverage remains
M1 Admissions & Student Profiles: Pilot-ready plus Student QR, storage/photo/logo, iEMIS artifact registration, duplicate candidate review, document audit, and mobile child profile foundation
M2 Smart Attendance: Pilot-ready plus correction/offline-draft, rejected replay regressions, correction-review UI, mobile teacher scope, real-data teacher dashboard, and mobile parent attendance summary query validation
M3 Fees & Receipts: Pilot-ready plus receipt reprint, reversal, cashier close, reconciliation, Analysis CSV exports, protected day-end PDF snapshots, transaction-race coverage, and secure online payment webhook signature verification
M4 Academics / Exams / CAS / Report Cards: Completed / Pilot-Ready with PDF/report/correction/snapshot polish
M5 Activity Feed & Milestones: Strong foundation with media privacy, consent-aware blocking, optimized previews, moderation controls, and teacher media gallery
M6 Homework / Timetable: Completed / Pilot-Ready with File Registry attachments, reminder hardening, absence/substitution conflict coverage, mobile homework/timetable views, and improved substitution slot selection / absence recording UI
M7 HR / Payroll: Completed / Pilot-Ready with posting locks, accounting integration, reversals, PII masking, payroll reports, mobile staff self-service, and active-salary-structure statutory deduction retrieval
M8A Library: Admin/backend foundation plus QR lookup, fines, staff borrowers, fine-to-fees/accounting tests, scanner-first UI, and reports/export polish
M8B Transport: Admin/trip/location/report foundation plus Redis GPS/cache/pressure/retention hardening, driver mobile surfaces, parent latest-GPS view, and trip-history exports
M8C Canteen: Admin/wallet/POS/inventory/vendor/report foundation plus receipt JSON/PDF, stock hardening, wallet guards, linked invoice handoff, parent mobile views, and canteen workspace UI polish
M9 Accounting: Production-candidate / Pilot-Ready with PDFs, snapshots, audit trail, reconciliation suggestions, File Registry export support, and validated bank statement import DTO/service hardening
M10 Notices / Communication / Chat: Strong foundation with provider modes, attachments, failure dashboard, moderation/escalation, unread-recipient follow-up, and mobile notification/chat surfaces
Public marketing/demo intake: Backend-persisted demo request API, Prisma model/migration, CSRF public allow-list, web form integration, API helper, and tests added on 2026-06-04
Settings / audit visibility: Settings audit-log access and UI depth added on 2026-06-04
M11 School Intelligence / AI: Roadmap only
SchoolOS Flutter Mobile: Active companion app with scoped parent/student/teacher/staff/driver/admin surfaces where APIs exist
```

Readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks and smoke verification
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

---

## 2.1 2026-06-04 Implementation Update

Today's commits added or updated the following:

```text
- AGENTS.md production-implementation operating instructions.
- M9 Accounting: bank statement import DTOs, reconciliation DTO, empty/invalid amount validation, UUID import batch IDs, and tests.
- M3 Finance: HMAC verification for online payment webhooks, adapter-aware gateway status, and webhook/signature tests.
- M7 Payroll: statutory deductions now derive from active salary structures, with controller delegation and tests.
- M0 Platform: structured DTOs for provider status updates, support override entry, and tenant billing status reason payloads, with validation tests.
- M2 Mobile/Attendance: parent attendance summary query DTO with month/year validation and tests.
- Web security: browser API request IDs now use secure randomness instead of Math.random.
- Public demo requests: DemoRequest Prisma model/migration, public POST API, CSRF public allow-list, backend service/controller/DTO/tests, web form API integration, marketing API helper, and public smoke/contract tests.
- Settings: settings audit-log API/UI depth and access-control tests.
- User management: web API helper foundation for school user management.
- M6 Timetable/Substitutions: substitution modal and substitutions list improved for timetable slot selection and absence recording.
- M8C Canteen: canteen workspace UI/API handling polish.
- Documentation: module-wise enhancement plan created and linked from active project docs.
```

Verification note:

```text
These updates are recorded from commit inspection. Full local/staging verification must still be run before changing readiness claims: db generate/validate, OpenAPI gate, lint, typecheck, unit tests, API E2E, web E2E, build, verify:production, and smoke:phase1.
```

---

## 3. Core Architecture

```text
Monorepo: pnpm
Backend: NestJS modular monolith
Database: PostgreSQL + Prisma
Cache/queues: Redis + BullMQ
Shared package: packages/core
Current frontend: Next.js dashboard in apps/web
Mobile app: Flutter companion app in apps/schoolos_mobile
```

Rules:

- Keep the modular monolith first.
- Do not introduce microservices unless scale/team/deployment/compliance clearly justify it and the owner explicitly requests it.
- Do not migrate to Angular yet.
- Do not rename `tenantId` to `schoolId` without a deliberate migration.
- Backend-first for data integrity.
- UI must consume real APIs.
- Mobile must consume existing SchoolOS APIs with purpose-limited, tenant-scoped, ownership-tested responses.
- Every tenant-owned query must be scoped by authenticated `tenantId`.
- Every business-critical write must be audited.

---

## 4. Product Planes

| Plane | Purpose | Frontend | Backend |
|---|---|---|---|
| Platform Control Plane | SchoolOS company/operator administration | `/platform/*` | `/platform/*` |
| Tenant Configuration Plane | School-owned settings/configuration | `/dashboard/settings/*` | `/settings/*` or `/tenant-settings/*` |
| School Operations Plane | Daily school workflows | `/dashboard/*` | Module APIs such as `/students`, `/attendance`, `/finance`, `/notices`, `/academics`, `/homework`, `/timetable`, `/payroll`, `/accounting`, `/library`, `/transport`, `/canteen` |
| Public Marketing / Demo Intake | Public lead capture and sales/demo request intake | `/request-demo` | `/demo-requests` |

Rules:

- Do not mix SchoolOS SaaS billing with school fee collection.
- School users must not access platform settings.
- Platform support/tenant override must require explicit reason and audit log.
- Keep public marketing/demo intake separate from tenant school operations.
- Keep all planes inside the modular monolith for now.

---

## 5. Non-Negotiable Product Rules

```text
1. Tenant isolation is mandatory.
2. Parent/student/mobile APIs must be purpose-limited and fail closed.
3. SchoolOS SaaS billing must not mix with school M3/M9 finance.
4. Money flows must be idempotent and auditable.
5. Confirmed financial records must use reversal/correction workflows.
6. Private files must use StorageService/FileRegistryService boundaries.
7. Provider-disabled/mock modes must be honest in UI.
8. Do not implement AI/analytics until reliable production data exists.
9. Do not introduce microservices or Angular migration without explicit owner approval.
10. Apply code-file modularization gradually in touched areas, not as a risky repo-wide rewrite.
```

---

## 6. Current Implementation Plan

Use these active plans:

```text
docs/project/SCHOOLOS_IMPLEMENTATION_STATUS_AND_PLAN.md
docs/project/SCHOOLOS_MODULE_FEATURE_ENHANCEMENT_PLAN.md
```

Mandatory near-term order:

```text
Phase Gate 0 — stabilize verification, migrations, seed data, smoke tests, stale docs
Phase 1 — harden pilot reliability for existing core
Phase 2 — finish academic/accounting staging and large-report polish
Phase 3 — harden homework/timetable and HR/payroll staging/browser/device verification
Phase 4 — harden library, transport, and canteen operation-specific QA
Phase 5 — deepen Flutter mobile only through purpose-limited APIs and ownership tests
Phase 6 — M11 intelligence only after reliable production data exists
```

The module-wise feature and enhancement backlog is maintained in:

```text
docs/project/SCHOOLOS_MODULE_FEATURE_ENHANCEMENT_PLAN.md
```

Use it for feature planning after the active phase gate allows new or deeper module work. It does not override verification, tenant-isolation, permission, File Registry, mobile ownership, or provider-disabled/mock-mode rules.

Explicitly deferred unless requested:

```text
Angular migration
AI/ML implementation
Deep parent/mobile expansion without ownership-tested APIs
Driver live-trip workflow beyond the started mobile shell
Live transport map/WebSocket/SSE UI
Microservices
Biometric workflows
```

---

## 7. Verification Commands

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

For mobile changes:

```bash
cd apps/schoolos_mobile
flutter pub get
dart format .
flutter analyze
flutter test
```

Do not claim verification passed unless the commands were actually run.

---

## 8. Future Codex Prompt Format

```text
Read these first:
- DEVELOPMENT_RULES.md
- AGENTS.md
- docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_IMPLEMENTATION_STATUS_AND_PLAN.md
- docs/project/SCHOOLOS_MODULE_FEATURE_ENHANCEMENT_PLAN.md when planning or enhancing module features
- docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md when touching platform/settings boundaries
- docs/project/SCHOOLOS_STORAGE_AND_FILE_REGISTRY.md when touching files/media/exports
- docs/design/SCHOOLOS_UI_UX_GUIDE.md when touching web UI
- apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md when touching mobile

Task:
[exact feature/change]

Constraints:
- Do not rewrite unrelated files.
- Keep NestJS modular monolith.
- Keep tenantId as the tenant/school boundary.
- Keep all tenant-owned reads/writes tenant-scoped.
- Keep platform, tenant settings, public marketing/demo intake, and school operations route boundaries separate.
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
