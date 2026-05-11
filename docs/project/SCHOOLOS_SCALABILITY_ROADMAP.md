# SchoolOS Scalability Roadmap

**Repository:** `erwinshrestha17/SchoolOS`  
**Stage:** Phase 2D M9 Accounting Production Candidate Complete + Phase 2/3 foundations in progress  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard  
**Purpose:** Define how SchoolOS scales phase by phase while development continues across the SaaS starter/platform core and school-domain modules.

---

## 1. Executive Summary

SchoolOS should scale by strengthening the current modular monolith first.

The correct scalability path remains:

```text
1. Keep the modular monolith.
2. Make module boundaries strict.
3. Align backend/API/frontend structure with M0 Platform Core + M1-M10 school modules.
4. Make tenant isolation impossible to bypass.
5. Make PostgreSQL queries/indexes production-safe.
6. Move slow work into Redis/BullMQ workers.
7. Add observability, readiness, backup, and smoke gates.
8. Scale API and workers horizontally.
9. Split only proven high-pressure modules later.
```

Do **not** jump to microservices now. The repo already has a strong foundation: NestJS modules, Prisma, Redis/BullMQ, throttling, CLS tenant context, health/readiness endpoints, production verification scripts, Docker PostgreSQL/Redis, and Phase 1 smoke/preflight work.

M9 Accounting is now production-candidate complete. The main scaling risk has shifted from accounting correctness to broad Phase 2/3 module depth, authenticated browser workflow coverage, seed/migration readiness, queue visibility, file/report handling, parent/mobile boundaries, and operational observability.

---

## 2. Source Documents

Keep this roadmap aligned with:

```text
PROJECT_CONTEXT.md
ARCHITECTURE.md
DEVELOPMENT_RULES.md
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
docs/project/SCHOOLOS_PROJECT_MEMORY.md
docs/project/SCHOOLOS_PHASE_STRUCTURE.md
docs/project/SCHOOLOS_PLATFORM_CORE_MEMORY.md
docs/project/SCHOOLOS_M9_ACCOUNTING_COMPLETION.md
docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
```

Important current findings:

```text
- Phase 1A/1B are pilot-ready.
- Phase 2 foundations exist.
- Phase 2D M9 Accounting is production-candidate complete.
- Phase 3 operations admin foundations exist for Library, Transport, and Canteen.
- M0 Platform Core contains reusable SaaS starter/platform capabilities.
- Current frontend stays in apps/web Next.js for now.
- Future apps/admin Angular dashboard is deferred.
- Microservices are deferred until scale/team/deployment/compliance justify them.
- Parent/mobile portal, driver app, live transport map/WebSocket UI, full canteen inventory/vendor workflows, and AI/ML remain deferred.
```

---

## 3. Product Module Map

| Module | Name | Phase / Status | Scaling Notes |
|---|---|---|---|
| M0 | Platform Core / SaaS Starter | Foundation + gradual rollout | Platform-only permissions, audit support actions, plan/entitlement enforcement later. |
| M1 | Admissions & Student Profiles | Phase 1A/1B complete | Keep student directory paginated, storage-backed docs/photos, and lifecycle audit. |
| M2 | Smart Attendance | Phase 1A/1B complete | Keep attendance queries tenant/date/class indexed and offline sync bounded. |
| M3 | Fees & Receipts | Phase 1A/1B complete | Keep Decimal money, transactional payments, cashier close, and M9 posting boundaries. |
| M4 | Exams, CAS & Report Cards | Phase 2 foundation implemented | Need deeper reports/PDF queue hardening and marks lock audit coverage. |
| M5 | Activity Feed & Milestones | Phase 1A/1B complete | Need object storage/media compression hardening for broader media use. |
| M6 | Homework & Timetable | Phase 2 foundation implemented | Need timetable conflict/index hardening and attachment storage boundaries. |
| M7 | HR & Payroll | Phase 2 foundation implemented | Need payroll run/report hardening and continued accounting boundary tests. |
| M8A | Library Management | Phase 3 admin foundation implemented | Need issue/return depth, borrower reports, fines, and QR reuse hardening. |
| M8B | Transport Management | Phase 3 admin foundation implemented | Live GPS/driver/parent tracking deferred; Redis/WebSocket strategy remains future. |
| M8C | Canteen Management | Phase 3 admin foundation implemented | Inventory/vendor/parent controls/accounting integration later. |
| M9 | Accounting & Finance | **Phase 2D Production Candidate Complete** | Preserve immutable ledger, AccountingPostingService boundary, tenant isolation, and backend-ledger reports. |
| M10 | Notices & Communication | Phase 1 + chat foundation | Queue provider delivery, quiet hours, read tracking, and parent-teacher moderation. |
| M11 | School Intelligence & Analytics | Phase 4 roadmap only | Do not implement AI/ML until reliable production data exists. |

---

## 4. M9 Accounting Scaling Baseline

M9 is now a production-candidate accounting module. Completed scale-relevant safeguards:

```text
- AccountingPostingService ledger boundary.
- Immutable posted journals.
- Reversal/correction workflows.
- Idempotent source posting with database-level constraints.
- Fiscal period and fiscal year controls.
- Opening balances and voucher workflows.
- Backend Trial Balance, General Ledger, Cash Book, Income Statement, Balance Sheet, VAT/TDS/PF summaries.
- CSV report exports.
- Explicit report account mappings.
- Bank reconciliation.
- Frontend Accounting workspace.
- Granular permissions and audit coverage.
- Full production verification passing.
```

M9 scaling rules:

```text
- Never edit confirmed journal financial truth.
- Use reversal/correction entries for mistakes.
- Use Decimal/numeric only.
- Enforce period/year state before posting.
- Reports must come from backend ledger data.
- Heavy exports/PDF snapshots should move to BullMQ/File Registry when tenant size requires it.
- Consider fiscal-year partitioning only after real volume proves the need.
```

Remaining M9 future scalability enhancements:

```text
- PDF accounting exports.
- Saved report snapshots and File Registry integration.
- Advanced bank auto-match rules.
- Accounting audit log viewer UI.
- Seeded Playwright accounting workflow tests.
- Production seed review for default Chart of Accounts and report mappings.
- Background export jobs for very large reports.
```

---

## 5. Scalable Repository Structure

Current monorepo direction:

```text
SchoolOS/
  apps/
    api/         NestJS modular monolith backend
    web/         Current Next.js dashboard + platform console + public/root pages
    admin/       Future Angular internal dashboard, not now
  packages/
    core/        Shared contracts, validation, permissions, types
  docs/
    project/     project memory, roadmap, scalability docs
    production/  deployment/runbook/backup docs
  scripts/       verification, smoke, deploy checks
```

Backend module rule:

```text
Each module should own controller, service, DTOs, permissions, events/jobs where needed, and tests.
Modules communicate through public services, domain events, queues, or explicit integration boundaries.
```

Good examples:

```text
finance -> AccountingPostingService -> journal entries
payroll -> AccountingPostingService -> journal entries
notices -> notification queue -> delivery worker
transport -> Redis latest location cache -> parent/admin tracking API later
reports -> module report service -> background export worker later
```

Bad examples:

```text
Any module writes another module's internal tables directly.
Frontend calculates business-critical totals.
Long-running PDF/report generation happens inside request-response.
TenantId comes from frontend input instead of authenticated context.
```

---

## 6. Tenant Isolation and API Scaling Rules

Every tenant-owned table must include `tenantId` unless it is explicitly global/platform metadata.

Required query pattern:

```ts
where: {
  tenantId: tenantContext.tenantId,
  id,
}
```

Forbidden pattern:

```ts
where: {
  id,
}
```

Every new feature must include:

```text
1. Tenant scope check.
2. Permission check.
3. Pagination/filtering for lists.
4. Index review.
5. Audit/logging review.
6. Queue decision: sync or async?
7. Cache decision: cache or not?
8. Report/export decision: immediate or background?
9. Frontend route/API-client impact.
10. Test coverage.
11. Production verification command.
```

---

## 7. Runtime Scaling Direction

Near-term target:

```text
Browser / Mobile Client
        |
        v
Reverse Proxy / Load Balancer
        |
        v
NestJS API instances 1..N
        |
        +--> PostgreSQL primary database
        +--> Redis cache / BullMQ queue
        +--> Object storage
        +--> Worker processes
```

Important process separation:

```text
schoolos-api       Handles HTTP requests only
schoolos-worker    Handles queues: notifications, reports, PDFs, imports, exports
schoolos-scheduler Handles scheduled jobs: reminders, summaries, cleanup
```

At first these can run from the same codebase. They should eventually become separate process entrypoints or separate container commands.

---

## 8. Queue and Worker Discipline

Move to BullMQ workers where workflows become heavy or retryable:

```text
notification delivery
SMS/email/push provider calls
report card PDF generation
receipt/certificate batch generation
monthly attendance summary generation
fee invoice batch generation
defaulter reminder jobs
payroll posting jobs
large CSV/PDF exports
activity media processing/compression
future transport ETA jobs
future canteen low-balance alerts
```

Recommended queues:

```text
notifications.delivery
reports.generate
pdf.generate
finance.billing
finance.defaulters
payroll.posting
academics.report-cards
activity.media
transport.location
platform.maintenance
```

---

## 9. File Storage and Report Snapshot Scaling

Use object storage + File Registry for:

```text
student documents
student photos
school logos
activity media
homework attachments
receipts
certificates
report cards
salary slips
exports
accounting PDF/snapshot reports later
```

Rules:

```text
- Store object keys, not permanent public URLs.
- Generate signed URLs for preview/download.
- Add file size/type validation.
- Add tenantId, module, entityId to file metadata.
- Audit sensitive downloads/exports.
- Queue heavy report/PDF generation.
```

---

## 10. Verification Gate

Minimum deployment gate:

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

M9 completion verification passed:

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

Latest browser smoke status:

```text
Public Playwright smoke passed. Seeded authenticated accounting workflow tests remain future work once stable credentials/seed data are available.
```

---

## 11. Immediate Next Implementation Order

Do next:

```text
1. Add seeded Playwright Accounting UI workflow tests.
2. Review production migrations and default Chart of Accounts/report mapping seeds.
3. Harden one existing vertical at a time: Academics, Homework/Timetable, HR/Payroll, Library, Transport, Canteen.
4. Add request/correlation ID logging if not fully wired.
5. Add queue failure visibility for notifications/reports/payroll/PDF work.
6. Harden File Registry/object storage before uploads expand.
```

Avoid now:

```text
❌ Angular migration
❌ AI/ML features
❌ Parent/mobile portal before admin foundations are stable
❌ Driver app or live transport map/WebSocket UI before Redis/WebSocket scaling plan
❌ Full canteen inventory/vendor workflows before menu, wallet, POS, reports, and accounting boundaries are hardened
❌ Microservices
❌ Broad expansion across every module at once
```

---

## 12. Final Rule

SchoolOS becomes scalable by making every development phase production-aware.

```text
Build feature -> identify M0/M1-M10 owner -> align backend/API/frontend route -> enforce tenant isolation -> keep module boundary -> index queries -> paginate lists -> queue slow work -> audit sensitive actions -> verify with tests -> only then move to next feature.
```

Scalability is not a separate final task. It is a rule applied during every module implementation from this point onward.
