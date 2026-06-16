# SchoolOS Agent Instructions

Token-light global rules for agents. Detailed behavior lives in the active docs and existing code/contracts.

## Read only what is relevant

Start with `README.md`, `docs/README.md`, `docs/project/SCHOOLOS_PROJECT_STATUS.md`, and `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md`. Then read the focused source for the touched area:

- Product/function: `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`, `docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`
- Architecture/security/platform: `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md`, `docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md`
- Web: `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`, `apps/web/e2e/README.md`
- Mobile: `docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md`, `apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md`
- Deploy/staging: `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md`

Do not recreate old split plans or duplicate docs. Update the smallest active source of truth only when docs truly need changes.

## Product stance

SchoolOS is a Nepal-first multi-tenant KG-12 school operating SaaS, not a CRUD dashboard. Aim every change toward production-ready and deploy-ready quality. Report readiness honestly: current status remains controlled-pilot/internal-QA until staging migration, provider/storage checks, browser E2E, pilot smoke, and real school workflow validation pass.

Current priorities: frontend real-API workspaces, verification gates, protected files, mobile companion polish, staging/browser smoke, M12 hardening. M11 AI is roadmap only unless explicitly approved.

## Architecture: never break

- Keep NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js App Router, Flutter companion app, `packages/core` where available.
- No Angular migration, microservices, new DB/search cluster/GPU/Kubernetes, or separate deployment units unless approved.
- Do not rename `tenantId`.
- Keep planes separate: `/platform/*` operator SaaS, `/dashboard/settings/*` school config, `/dashboard/*` school operations.
- Do not mix SaaS billing with school fee collection/accounting.
- Keep M12 Learning separate and reuse core students/staff/classes/subjects/timetable/files/RBAC/audit/communication.

## Security and data rules

- `tenantId` is the strict boundary for API, jobs, files, cache, exports, reports, web, mobile, and learning.
- Backend authorization is truth; frontend hiding is UX only.
- Disabled modules and suspended tenants fail closed everywhere.
- Parent = linked children only. Student = own/session-scoped only. Teacher = assigned class/section/subject only unless permitted. Driver = assigned trip only. Staff self-service = own data only.
- Platform support override needs reason, audit, and expiry where supported.
- Never expose unsafe internals, private payloads, provider/storage internals, raw stack traces, or private staff/finance data.

## Files, money, web, mobile

Files: always use `Feature module -> FileRegistryService -> StorageService -> StorageAdapter`. No provider SDKs in feature modules, no base64 files in DB, no raw private-file browser opens. Web/mobile use protected authenticated helpers.

Money: backend/database totals only. Money writes are idempotent and audited. Confirmed finance/accounting/payroll records use reversal/correction, not silent mutation. No offline financial writes unless explicitly approved with backend reconciliation.

Web: one screen = one main job; real APIs only; no fake production data; server-side pagination for growing lists; states for loading/empty/error/success/permission/module locked/validation/file unavailable/queued/partial failure; high-risk actions need confirmation and reason where required.

Mobile: companion app only; persona-first; purpose-limited APIs only; no admin-shaped mobile payloads; safe offline reads only; visible sync states for approved idempotent writes; no broad student app.

Learning: school-controlled, teacher-led, lab/session or controlled-device student access; expiring session codes/QR; parent summaries child-scoped and non-comparative; no leaderboard, open student chat, harsh labels, AI tutor, adaptive runtime, or broad home learning unless approved.

## Before coding

1. Read focused docs and existing code first.
2. Inspect contracts/OpenAPI, Prisma schema, DTOs, permissions, audit, API clients, and tests for the touched area.
3. Implement missing production pieces only; do not rewrite working modules.
4. Do not invent endpoint contracts. Mark unknowns as `needs backend verification`, `needs OpenAPI confirmation`, `needs mobile DTO`, `needs idempotency confirmation`, or `needs offline sync confirmation`.
5. Add/update focused tests where appropriate.
6. Run relevant checks and report only what actually ran.

## Done means

Real persistence; no fake production data; tenant/RBAC/entitlement enforced; persona scopes fail closed; sensitive writes audited; money idempotent; files through File Registry/StorageService; paginated growing lists; complete UI states; protected downloads; focused regression updated where appropriate. Production/deploy-ready claims require actual staging/pilot verification results.

## Verification

Run relevant gates only, then report honestly:

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
pnpm --filter @schoolos/web typecheck
pnpm test:web:e2e
cd apps/schoolos_mobile && flutter pub get && dart format . && flutter analyze && flutter test
```

Docs-only changes need no runtime checks.

## Progress format

```text
Current module:
Completed:
Remaining:
Risks:
Verification run:
Verification result:
Next action:
```
