# SchoolOS Remaining Implementation Plan

**Last updated:** 2026-06-02

**Status source:** `docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md` and `docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md`

**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard

**Code-file modularization source:** `docs/project/SCHOOLOS_CODE_FILE_MODULARIZATION_PLAN.md`

This is the strict implementation order for SchoolOS from the current repo state. It records what is already implemented, what remains in backend and frontend, and the phase gates future work must follow.

---

## 1. Current Product Position

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core: Foundation complete; provider/queue pilot hardening implemented; broader pilot hardening remains
M4 Academics: Completed / Pilot-Ready
M6 Homework/Timetable: Completed / Pilot-Ready
M7 HR/Payroll: Completed / Pilot-Ready
M8A Library: Admin/backend foundation plus fine/accounting/staff-borrower depth implemented
M8B Transport: Admin/trip/location foundation plus GPS pressure/cache/retention depth implemented
M8C Canteen: Admin/wallet/POS/inventory foundation plus receipt/wallet-guard depth implemented
M9 Accounting: Completed / Pilot-Ready
M10 Communication/Chat: Foundation plus provider/attachment/retry depth implemented
SchoolOS Flutter mobile app: Started in apps/schoolos_mobile with auth/API connection, parent and teacher attendance, notification center read state, and staff self-service API/PDF wiring in progress
M11 Intelligence/AI: Not started
```

Current practical readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks, `verify:production`, and smoke verification in a local/staging environment that can bind browser-test ports
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

Important working-tree note:

```text
Phase Gate 0 verification was green before M0 and feature-depth work started.
M0 provider/queue/API-key pilot hardening and M10/M6/M7/M8A/M8C/M8B feature-depth hardening have now been implemented and verified through build during their sprint gates.
M0/File Registry storage hardening now includes a provider-neutral `StorageAdapter` contract, normalized local/s3/r2/minio/gcp config, backward-compatible R2 aliases, private-by-default object writes, short-lived signed URL helpers, and StorageService delegation through local and S3-compatible adapters. M0 platform storage readiness has started using the normalized config; staging bucket verification remains environment-gated.
Current local M0-M10 backend hardening added peppered HMAC refresh/API-key token storage with legacy-hash validation fallback, Accounting PDF control-total summaries, Student QR tenant-filtered lookup regressions, timetable Sunday/normalized-date conflict coverage, guardian-owned chat scope coverage, activity media upload-completion, CSRF/JWT guard regressions, attendance rejected-offline replay coverage, library tenant-scope regressions, and cashier-close duplicate race coverage.
Current admin web polish added dashboard shell/card typography cleanup, accounting audit context, transport location freshness, scanner-first Library/Canteen QR flows, and a global Toast/ConfirmDialog feedback pass that removes browser-native `alert()`/`confirm()` from `apps/web/app` and `apps/web/components`.
`pnpm verify:production` must be rerun in local/staging if the current sandbox blocks browser E2E local-port binding.
`pnpm smoke:phase1` still requires local Postgres, Redis, API, and web services.
```

Near-term rule:

```text
Do not start broad new modules.
Follow the phase gates below.
Stabilize and harden existing modules one vertical at a time.
Apply code-file modularization gradually in touched M0-M10 areas instead of doing one large repo-wide refactor.
```

Code-file modularization rule:

```text
This plan requires code-file modularization, not microservices.
When Codex works on any existing M0-M10 module or any future module, it must check whether the touched service/controller/component/API-client file is too large or mixes unrelated responsibilities.
If yes, Codex should extract focused files only for the touched area while preserving behavior, routes, UI/UX, API contracts, tenant boundaries, database behavior, and tests.
Do not create a massive repo-wide modularization PR unless explicitly requested.
Use docs/project/SCHOOLOS_CODE_FILE_MODULARIZATION_PLAN.md as the source of truth.
```

Explicitly deferred until the plan allows it:

```text
Deep parent/mobile module expansion beyond the started Flutter companion app
Driver live-trip workflow beyond the started mobile shell
Live transport map/WebSocket/SSE UI
AI/ML features
Angular migration
Microservices
Biometric workflows
```

---

## 2. Module Completion Snapshot

| Module | Current Status | Estimated Completion |
|---|---|---:|
| Auth / Security / Tenant Isolation | Strong foundation | 90-95% |
| M0 Platform Core | Foundation complete with provider/queue pilot hardening; broader pilot hardening remains | 85-90% |
| M1 Admissions & Student Profiles | Pilot-ready plus Student QR foundation, tenant-scope QR hardening, and photo/logo upload UX polish | 92-96% |
| M2 Smart Attendance | Pilot-ready plus correction/offline-draft, correction-review UI, and real-data Flutter teacher dashboard hardening | 93-97% |
| M3 Fees & Receipts | Pilot-ready plus focused finance hardening slice and active Analysis export polish | 92-96% |
| M4 Academics / Exams / CAS / Report Cards | Completed / Pilot-Ready | 100% |
| M5 Activity Feed & Milestones | Strong Phase 1 foundation plus media privacy, optimized media variants, and teacher gallery hardening | 90-95% |
| M6 Homework & Timetable | Completed / Pilot-Ready | 100% |
| M7 HR & Payroll | Completed / Pilot-Ready | 100% |
| M8A Library Management | Admin/backend foundation plus controlled fine-to-fees posting, Finance counter invoice handoff, accounting-boundary tests, staff borrowers, QR lookup, and report/export UI polish implemented | 92-96% |
| M8B Transport Management | Admin/trip/location foundation plus route operations dashboard, trip report export polish, billing guard, GPS pressure guard, Redis cache/fanout tests, cleanup bounds, Flutter driver route board/manifest actions/manual GPS ping, and parent latest-GPS transport view implemented | 91-95% |
| M8C Canteen Management | Admin/wallet/POS/receipt/inventory foundation plus idempotency, negative-balance guards, supplier, stock operation UI/tests, report/export polish, linked-invoice handoff, parent mobile canteen views, and accounting-source hardening implemented | 93-97% |
| M9 Accounting & Finance | Completed / Pilot-Ready | 100% |
| M10 Notices & Communication | Strong Phase 1 + chat foundation with provider modes, attachment access, failure-dashboard API depth, and parent mobile chat UI | 92-96% |
| M11 School Intelligence / AI | Roadmap only | 0% |

---

## 3. Implemented vs Remaining by Module

### Auth / Security / Tenant Isolation

Implemented:

- Cookie-first browser auth with bearer support for the active Flutter mobile app and future API clients.
- RBAC and tenant context foundations.
- Platform vs tenant route separation.
- Super-admin tenant override audit behavior.
- App-level throttling and production verification scripts.
- Request/correlation ID propagation through response headers, response envelopes, structured request logs, and audit records.
- Production secret, cookie, and same-site runtime validation.
- JWT issuer/audience regressions now reject invalid web/mobile tokens before tenant lookup, mobile Flutter tokens require the mobile audience, and support tenant overrides require an active support session plus an explicit reason before tenant context is changed.
- CSRF guard regressions now cover safe method bypass, bearer API-client bypass, public auth/register route bypass, development and production cookie names, cookie/header mismatch denial, and signed-token validation.
- Dashboard direct-route permission-denied gating before protected module pages load.
- Dashboard slow-session recovery with retry/sign-in actions when cookie validation or permission loading stalls.

Remaining backend:

- Final production credential review during deployment.

Remaining frontend:

- Browser coverage for permission-denied states across all dashboard/platform routes.
- Deeper expired-session and slow-network recovery browser coverage.

### M0 - Platform Core / SaaS Starter

Implemented:

- Platform tenant list/detail/dashboard/status flows.
- Reason-required tenant suspend/activate behavior.
- Plans, features, tenant subscriptions, feature overrides, usage limits/counters.
- SaaS billing records: profiles, invoices, invoice lines, payments.
- Tenant-scoped platform API key management with generated one-time secrets, peppered HMAC hashed storage, legacy SHA-256 validation upgrade, masked list responses, revoke flow, and audit records.
- Platform API key management UI with one-time secret reveal and audited revoke actions on tenant detail.
- SaaS billing lifecycle automation now generates due renewal invoices, advances free-plan renewals without school finance postings, and records lifecycle audit entries.
- Webhook endpoint registry and signed delivery-history surfaces are implemented for platform operators.
- Provider configuration masking.
- Provider readiness detail API with dry-run validation, masked secrets, disabled-mode warnings, and S3-compatible object-storage readiness checks without paid external calls by default.
- Env-backed cloud-agnostic storage adapter boundary for local, R2, S3, and MinIO-compatible providers, with fail-closed config checks and R2 alias compatibility.
- Queue health, failed-job detail inspection, sanitized payload visibility, stack/timing detail, retry audit history, and audited retry endpoint.
- File Registry, report exports/history, health summary, onboarding checklist.
- Entitlement regression coverage now denies real school module controllers for accounting, mobile parent, library, transport, canteen, and homework when a tenant plan lacks the required feature, even if RBAC permissions are present.
- M1-M10 storage migration audit now expands the M0 file/report boundary contract across settings, finance, reports, library, canteen, transport, homework attachment access, and other file/report modules to prevent direct provider SDK or filesystem assumptions outside the storage boundary.
- Platform dashboard/schools/settings/audit routes.

Remaining backend:

- Object-storage readiness verification against an explicit staging provider.
- File Registry signed read/download/upload API hardening is implemented; staging provider verification remains.
- [x] M1-M10 module-by-module migration audit to remove any remaining direct file/provider assumptions.
- Provider real connection checks only where safe, configured, and non-paid.

Remaining frontend:

- Platform tenant-action manual QA.
- Broader browser coverage for queue/provider failure detail surfaces.
- Browser coverage for suspend/activate, overrides, billing, API keys, webhooks, providers, and queue retry.
- App-controlled confirmation/status feedback is implemented locally; staging/browser coverage still needs to exercise the critical platform mutations.

### M1 - Admissions & Student Profiles

Implemented:

- Admissions, student profiles, guardians, lifecycle, documents, student search.
- Student photo/document access boundaries.
- Student photo uploads now enforce MIME, extension, size, safe filename, image signature, tenant-scoped storage keys, File Registry metadata, short-lived preview/download URLs, replace/remove audit actions, and profile edit UI controls.
- School logo uploads now use the same private object storage + File Registry pattern with tenant-scoped preview/download URLs, validation, update/remove audit logs, and PDF-safe file asset IDs in `school_logo`.
- Student profile photo and settings logo upload UX now mirrors backend image limits before upload, loads signed school-logo previews/downloads, and uses app-controlled remove confirmation/status feedback instead of a dead File Registry placeholder.
- Flutter parent-safe child profile views now render backend mobile profile identity, admission, lifecycle, privacy-consent, and consent-gated health fields instead of placeholder profile text.
- Student document audit trail API and profile visibility, with sanitized document list responses that avoid raw storage keys and read-history entries for preview/download access.
- Student identity models.
- Student QR credential model, secure token hashing, generate/rotate/revoke/resolve API, tenant-filtered QR resolution, transactional rotation that preserves old credentials as ROTATED history, safe status/history API, QR admin card, and Library/Canteen QR resolver foundations.
- Student QR regressions now cover tenant-filtered scan lookup, inactive/expired/rotated/revoked scan denial, last-scan metadata, purpose-limited responses, parent/teacher ownership checks, cross-tenant status denial, cross-tenant rotation denial, and cross-tenant revocation denial.
- iEMIS export now persists a tenant-scoped CSV artifact through File Registry/report export history and exposes a directory export action.
- Duplicate review now has an admin-only candidate list endpoint and directory UI based on name, guardian phone, DOB, admission number, and previous-school signals.

Remaining backend:

- iEMIS final export mapping still needs staging validation against a real Nepal iEMIS template; unsupported schema fields must stay blank/documented until modeled.
- Duplicate merge execution remains implemented but still needs broader linked-module staging verification before enabling aggressive admin workflows.
- Staging verification for storage-backed student photo/document/logo flows.
- QR scan release verification and browser coverage.
- ID-card QR PDF behavior has backend integration coverage for opaque QR payload support; visual/manual PDF QR rendering still needs staging verification with real generated cards.

Remaining frontend:

- QR manual QA in student, library, and canteen flows.
- [x] Student photo/logo upload UX polish beyond the current profile-edit/settings API foundations and app-controlled photo removal dialog.
- [x] Student document audit trail visibility.
- [x] Student directory duplicate candidate review visibility for lifecycle admins.
- [x] Admissions document preview, ID-card, and checklist feedback no longer uses browser-native alerts.
- [x] Parent-safe student profile views in Flutter mobile.

### M2 - Smart Attendance

Implemented:

- Attendance sessions and records.
- Correction requests, sync submissions/conflicts, drafts.
- Monthly/history analytics and exports.
- Teacher-scope and correction/sync tests.
- Attendance daily and register routes.
- M2 hardening slice: correction requests now persist previous status and reason-required review metadata, correction lists are paginated, teacher lock-window failures use the school-friendly correction message, parent/student attendance access checks correctly honor guardian-owned children, attendance register exports register generated artifacts through File Registry when available, and the web attendance form has tenant/user/class/date-scoped local draft recovery plus sync/conflict states.
- Parent mobile attendance now uses the purpose-limited `/mobile/students/:id/attendance-summary` API with month-history data instead of admin-shaped attendance endpoints or hard-coded child fallbacks.
- Teacher mobile attendance now uses purpose-limited `/mobile/teacher/attendance/classes`, `/mobile/teacher/attendance/roster`, and `/mobile/teacher/attendance/submit` APIs backed by existing teacher-scope attendance validation.
- Flutter teacher dashboard now consumes the teacher attendance controller instead of fixed demo periods/messages, showing assigned classes, selected roster counts, sync/offline status, and quick links to attendance/notices.
- Mobile teacher attendance permission regressions now deny unassigned class/section roster access and attendance submission before roster exposure or attendance writes.
- Correction review permission regressions now deny non-reviewers, return not-found for cross-tenant correction lookups, persist rejection reasons without attendance writes, and deny parent attendance summaries outside guardian links.
- Offline sync regressions now persist rejected submissions with rejection reason/audit payloads and replay the same `clientSubmissionId` without resubmitting attendance.
- Attendance Conflicts now includes a pending correction-review queue backed by `/attendance/corrections`, with required audit reasons for approve/reject and real correction API wiring.

Remaining backend:

- Broader attendance report/export staging verification against real object storage.

Remaining frontend:

- Browser/manual QA for offline reload recovery and reconnect conflict choices.
- Mobile teacher attendance/dashboard device smoke with seeded teacher assignments.
