# SchoolOS Agent Instructions

Root guidance for developer agents working in SchoolOS. Keep this file compact; detailed product behavior belongs in the active docs.

## Read first

Before implementation, read the relevant active docs:

1. `README.md`
2. `docs/README.md`
3. `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`
4. `docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`
5. `docs/project/SCHOOLOS_PROJECT_STATUS.md`
6. `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md`
7. `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md`
8. `docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md`
9. `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` for web work
10. `docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md` for mobile work
11. `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md` for staging/production work
12. `apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md` for Flutter work
13. `apps/web/e2e/README.md` for browser smoke/E2E work

Do not recreate old split PRDs, repo-analysis docs, deployment checklists, mobile planning docs, or duplicate design docs. Update the smallest active source of truth when docs need changes.

## Current product stance

SchoolOS is a Nepal-first multi-tenant KG-12 school operating SaaS, not a generic CRUD dashboard.

- Treat the product as demo/internal-QA/controlled-pilot stage, not full multi-school production-ready.
- Do not claim production-ready until staging migration, provider/storage checks, browser E2E, pilot smoke, and real school workflow validation pass.
- Frontend standardization and real API-backed workspaces are the next priority.
- Flutter mobile is a companion app, not a mini web dashboard.
- M12 Learning has a separate implemented foundation and must remain its own domain.
- M11 Intelligence/AI is roadmap only. Do not add AI/ML/LLM runtime unless explicitly approved.

## Core architecture

- Keep the NestJS modular monolith.
- Keep PostgreSQL with Prisma.
- Keep Redis/BullMQ for queues, retries, scheduled jobs, exports, report/PDF generation, provider work, and media processing.
- Keep web in `apps/web` with Next.js App Router.
- Keep mobile in `apps/schoolos_mobile` with Flutter.
- Keep shared contracts/types in `packages/core` where available.
- Do not migrate to Angular.
- Do not introduce microservices, new databases, Kubernetes, search clusters, GPU workers, or separate deployment units unless explicitly approved with a measured reason.
- Do not rename `tenantId` to `schoolId`.
- Optimize tenant-scoped queries, indexes, pagination, payload size, file variants, summaries, and queued jobs before increasing infrastructure.

## Product planes

Keep the three planes separate:

- `/platform/*` = SchoolOS SaaS/operator control plane.
- `/dashboard/settings/*` = one school's configuration.
- `/dashboard/*` = daily school operations.

School users must not access platform controls. Platform support override requires explicit reason, expiry where supported, and audit. Do not mix SchoolOS SaaS billing with school fee collection.

## Global safety rules

- `tenantId` is the strict tenant/school boundary.
- Every tenant-owned query, mutation, job, export, report, cache key, file, and mobile response must be tenant-scoped.
- Backend authorization is the source of truth. Frontend hiding is only UX.
- Disabled modules and suspended tenants must fail closed across API, web, mobile, jobs, exports, files, providers, and learning sessions.
- Parents access only linked children.
- Students access only own allowed/session-scoped records.
- Teachers access only assigned classes/sections/subjects unless explicitly permitted.
- Drivers access only assigned trips.
- Staff self-service accesses only own staff data.
- Sensitive responses must never reveal internal errors, storage internals, provider internals, private staff/finance fields, or unsafe debug details.
- Sensitive writes require permission, validation, audit, and reason where policy requires it.

## File and storage rules

All files must follow:

```text
Feature module -> FileRegistryService -> StorageService -> StorageAdapter
```

Do not import provider SDKs inside feature modules. Do not store base64 files in PostgreSQL. Do not use raw browser opens for private files. Web must use protected file helpers/components. Mobile must use authenticated download/share helpers.

Protected files include receipts, cashier close PDFs, report cards, payslips, student docs/photos, activity media, notice/chat attachments, homework attachments, learning resources, accounting reports, exports, snapshots, and generated documents.

## Finance/accounting rules

- Money flows must be idempotent and auditable.
- Official totals come from backend/database only.
- Do not use JavaScript floating-point calculations as financial truth.
- Confirmed financial records use reversal/correction workflows, not silent mutation.
- Do not bypass accounting posting boundaries.
- No offline financial writes on mobile unless explicitly approved with backend idempotency and reconciliation.

## Web rules

- Web is the daily school operating desk.
- One screen = one main job.
- Use real backend APIs only.
- No fake dashboard data, placeholder metrics, mock production data, or browser-only production state.
- Every screen must handle loading, empty, error, success, permission denied, module locked, validation, file unavailable, queued job, and partial failure states where relevant.
- Growing lists must use server-side pagination/filtering.
- Use shared UI primitives and protected file helpers.
- Use school-friendly messages, not raw technical errors.
- High-risk actions require confirmation, pending/success/error state, reason where required, and audit support.

See `apps/web/AGENTS.md` for web-specific rules.

## Mobile rules

- Mobile shows what each persona needs to know or safely do now.
- Use purpose-limited APIs; never reuse admin-shaped responses for parent, teacher, principal, driver, staff self-service, or student session flows.
- Store credentials only in secure storage.
- Clear private caches on logout/session expiry.
- Offline support is only for safe reads and explicitly idempotent writes with visible queued/synced/failed states.
- No offline payments, wallet debits, refunds, payroll actions, accounting actions, report-card publishing, tenant/platform settings, or high-risk writes.

See `apps/schoolos_mobile/AGENTS.md` for mobile-specific rules.

## Learning rules

- M12 Learning is school-controlled and teacher-led.
- Keep Learning separate under its own domain and reuse core students, staff, classes, sections, subjects, timetable, files, RBAC, audit, and communication.
- Teachers create/launch activities only for assigned class/section/subject unless explicitly permitted.
- Student access is lab/session-only or controlled-device only for MVP.
- Session codes/QR tokens must expire and fail closed.
- Parent learning summaries must be child-scoped, non-comparative, and supportive.
- No public leaderboards, open student chat, harsh labels, AI tutor, adaptive recommendations, heavy simulations, or broad home learning app unless approved.

## Implementation priority

1. Security, auth, RBAC, tenant isolation, and permission fixes.
2. Verification, migrations, seed data, OpenAPI, typecheck, tests, and smoke gates.
3. Existing pilot workflows and frontend workspace completion.
4. File Registry/protected file hardening.
5. Loading/empty/error/permission/module-locked states.
6. Browser E2E and staging smoke.
7. Mobile polish/device QA through purpose-limited APIs.
8. UI polish after real functionality works.
9. AI only after M11 is explicitly approved.

## Working protocol

1. Read relevant docs and existing code first.
2. Inspect backend, frontend, Prisma schema, API contracts, permissions, DTOs, audit logs, tests, and OpenAPI/shared contracts where relevant.
3. Implement only missing production pieces.
4. Do not rewrite working modules unnecessarily.
5. Do not remove features unless obsolete and documented.
6. Do not invent endpoint contracts. Mark unknowns as `needs backend verification`, `needs OpenAPI confirmation`, `needs mobile DTO`, `needs idempotency confirmation`, or `needs offline sync confirmation`.
7. Add/update focused tests or regression coverage where appropriate.
8. Run relevant verification and do not claim passing checks unless actually run.

## Definition of done

- Real API/database persistence.
- No fake/mock/placeholder production data.
- Tenant isolation enforced.
- RBAC/module entitlement enforced.
- Parent/student/driver/staff scopes fail closed.
- Sensitive writes audited.
- Money writes idempotent.
- Files use File Registry/StorageService.
- Growing lists paginated/filtered server-side.
- UI has loading, empty, error, success, permission denied, and module locked states.
- Protected downloads use authenticated helpers.
- Tests or focused regressions updated where appropriate.
- No production-ready claim without staging/pilot verification.

## Verification commands

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
pnpm smoke:pilot
pnpm smoke:learning
pnpm smoke:full
```

Web-specific:

```bash
pnpm --filter @schoolos/web typecheck
pnpm test:web:e2e
```

Mobile-specific:

```bash
cd apps/schoolos_mobile
flutter pub get
dart format .
flutter analyze
flutter test
flutter build apk --debug
flutter build ios --no-codesign
```

For docs-only changes, runtime verification is not required, but report that only docs/instructions changed.

## Progress report format

```text
Current module:
Completed:
Remaining:
Risks:
Verification run:
Verification result:
Next action:
```
