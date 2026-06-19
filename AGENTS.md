# SchoolOS Agent Instructions

Token-light global rules for agents. Detailed behavior lives in the active docs and existing code/contracts.

## Read only what is relevant

Start with `README.md`, `docs/README.md`, `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`, `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`, and `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`. Then read the focused source for the touched area:

- Product/function: `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`, `docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`
- M13 Inventory & Asset Management: `docs/product/M13_INVENTORY_ASSET_MANAGEMENT.md`, `docs/design/modules/M13_INVENTORY_ASSET_FRONTEND_REFERENCE.md`, `docs/implementation/M13_INVENTORY_ASSET_IMPLEMENTATION_PLAN.md`
- Architecture/security/platform: `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md`, `docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md`
- Web: `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`, `apps/web/e2e/README.md`
- Mobile: `docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md`, `apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md`
- Deploy/staging: `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md`

Do not recreate old split plans or duplicate docs. Update the smallest active source of truth only when docs truly need changes.

## Product stance and release target

SchoolOS is a Nepal-first multi-tenant KG-12 school operating SaaS, not a CRUD dashboard and not an MVP delivery exercise. Every change must move the supported release boundary toward **Production / General Availability (GA)**.

Use the release stages defined in `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`:

```text
Development complete
Internal QA ready
Staging validated
Controlled pilot validated
Release candidate
GA / Production release
```

Report readiness honestly. The documented current stage is Internal QA ready; SchoolOS is not GA until staging migration and provider checks, authenticated browser E2E, device QA, backup/restore proof, controlled-pilot workflows, monitoring, rollback, and release evidence pass. Passing local tests, showing a demo, or completing backend code does not establish production or GA readiness.

Current priorities: security/RBAC/tenant-isolation evidence; staging deployment and operational proof; browser E2E; real-API web workspaces; pilot workflows; mobile device QA; performance/backup/observability/release automation. M11 AI remains roadmap only unless explicitly approved. M13 Inventory & Asset Management is currently documented planned scope; do not claim code readiness until migrations, contracts, APIs, web screens, tests, seed data, and smoke evidence exist.

## Architecture: never break

- Keep NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js App Router, Flutter companion app, `packages/core` where available.
- No Angular migration, microservices, new DB/search cluster/GPU/Kubernetes, or separate deployment units unless approved.
- Do not rename `tenantId`.
- Keep planes separate: `/platform/*` operator SaaS, `/dashboard/settings/*` school config, `/dashboard/*` school operations.
- Do not mix SaaS billing with school fee collection/accounting.
- Keep M12 Learning separate and reuse core students/staff/classes/subjects/timetable/files/RBAC/audit/communication.
- Keep M13 Inventory & Asset Management separate from M9 Accounting, M8A Library, M8B Transport, and M8C Canteen ownership. M13 may emit safe handoff events; official ledger posting remains M9-owned.

## Security and data rules

- `tenantId` is the strict boundary for API, jobs, files, cache, exports, reports, web, mobile, inventory, assets, and learning.
- Backend authorization is truth; frontend hiding is UX only.
- Disabled modules and suspended tenants fail closed everywhere.
- Parent = linked children only. Student = own/session-scoped only. Teacher = assigned class/section/subject only unless permitted. Driver = assigned trip only. Staff self-service = own data only.
- Platform support override needs reason, audit, and expiry where supported.
- Never expose unsafe internals, private payloads, provider/storage internals, raw stack traces, or private staff/finance data.
- M13 vendor details, bills, purchase records, asset documents, stocktake records, write-off evidence, and accounting handoff state must be permission-filtered.

## Files, money, inventory, web, mobile

Files: always use `Feature module -> FileRegistryService -> StorageService -> StorageAdapter`. No provider SDKs in feature modules, no base64 files in DB, no raw private-file browser opens. Web/mobile use protected authenticated helpers.

Money: backend/database totals only. Money writes are idempotent and audited. Confirmed finance/accounting/payroll records use reversal/correction, not silent mutation. No offline financial writes unless explicitly approved with backend reconciliation.

Inventory: stock quantities, valuation, purchase receive, issue/return, transfer, adjustment, stocktake variance, maintenance completion, asset write-off/disposal, depreciation, and accounting handoff are backend-owned. The browser must not calculate official stock or accounting truth. M13 must never directly post official M9 ledger entries from frontend code.

Web: one screen = one main job; real APIs only; no fake production data; server-side pagination for growing lists; states for loading/empty/error/success/permission/module locked/validation/file unavailable/queued/partial failure; high-risk actions need confirmation and reason where required.

Mobile: companion app only; persona-first; purpose-limited APIs only; no admin-shaped mobile payloads; safe offline reads only; visible sync states for approved idempotent writes; no broad student app.

Learning: school-controlled, teacher-led, lab/session or controlled-device student access; expiring session codes/QR; parent summaries child-scoped and non-comparative; no leaderboard, open student chat, harsh labels, AI tutor, adaptive runtime, or broad home learning unless approved.

## Missing API decision rule

If any web/mobile/platform surface needs data and no safe backend API exists, make a proper decision instead of faking it. First inspect existing code, OpenAPI/contracts, permissions, DTOs, and tests. If the need is real, repeatable, module-owned, tenant-scopable, RBAC/entitlement-gatable, and useful for a production workflow, implement a module-owned purpose-limited backend API and connect the surface. If not, keep a friendly unavailable/locked/permission state and mark the gap clearly. Never derive official totals from list APIs or browser/mobile calculations.

## Compact implementation guardrails

- Contract first: confirm backend/OpenAPI/`packages/core` shape before frontend/mobile integration; update the contract first if missing; never guess response shape.
- Summary ownership: dashboard summaries are module-owned first; main dashboard may compose module summaries but must not duplicate module business logic.
- Placeholder removal: developer-facing `Needs backend API` copy is internal only; pilot-facing UI keeps friendly unavailable/error/locked/permission states.
- Seed and smoke: any new visible workflow/card/screen needs supporting seed data and focused browser/mobile smoke where practical, or a clear pending note.
- Query performance: new list/summary APIs use aggregate/select queries, pagination where needed, no unbounded `findMany`, and tenant-scoped index review for common filters.
- Error shape: backend returns safe bounded error envelopes; web/mobile parse shared errors and never show raw technical/provider/storage/Prisma messages.
- Stop on unknowns: do not guess contracts, permissions, DTOs, idempotency, file access, or offline behavior; mark the exact `needs ... confirmation` item.
- M13 implementation must start with contracts/models/permissions/tests before broad UI wiring.

## Before coding

1. Read focused docs and existing code first.
2. Inspect contracts/OpenAPI, Prisma schema, DTOs, permissions, audit, API clients, and tests for the touched area.
3. Implement missing production pieces only; do not rewrite working modules.
4. Do not invent endpoint contracts. Mark unknowns as `needs backend verification`, `needs OpenAPI confirmation`, `needs mobile DTO`, `needs idempotency confirmation`, or `needs offline sync confirmation`.
5. Add/update focused tests where appropriate.
6. Run relevant checks and report only what actually ran.

## Done means

Development complete means real persistence; no fake production data; tenant/RBAC/entitlement enforced; persona scopes fail closed; sensitive writes audited; money idempotent; inventory movement idempotent where relevant; files through File Registry/StorageService; paginated growing lists; complete UI states; protected downloads; and focused regression updated where appropriate.

A staging, release-candidate, production, or GA claim additionally requires the exact applicable evidence in `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`: staging migration and configuration validation, provider/storage checks, seeded authenticated browser E2E, device QA, backup/restore proof, monitoring/alerts, rollback readiness, and controlled-pilot workflow evidence. Do not substitute local checks for these gates.

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
Release stage:
Current module:
Completed:
Remaining GA blockers:
Risks:
Verification run:
Verification result:
Staging/pilot evidence:
Next release action:
```
