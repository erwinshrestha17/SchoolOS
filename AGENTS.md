# SchoolOS Agent Instructions

Token-light global rules for agents. Detailed behavior lives in the active docs and existing code/contracts.

## Read only what is relevant

Start with `README.md`, `docs/README.md`, and `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`. Then read the focused source for the touched area:

- Product/function: `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`
- Software/API/database/web/mobile requirements: `docs/requirements/SCHOOLOS_SRS.md`
- Architecture/security/platform: `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md`
- Module ownership and gaps: `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md`
- Web: `apps/web/AGENTS.md`, `apps/web/e2e/README.md`
- Mobile: `apps/schoolos_mobile/AGENTS.md`, `apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md`
- Deploy/staging: `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md`

Do not recreate old split plans or duplicate docs. Update the smallest active source of truth only when docs truly need changes.

Formal ownership is fixed:

| Artifact | Canonical path |
|---|---|
| PRD | `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` |
| SRS | `docs/requirements/SCHOOLOS_SRS.md` |
| SDD | `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` |
| MDD | `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md` |
| Release policy | `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md` |
| Production runbook | `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md` |

Do not add Markdown when the content belongs in an existing canonical document. Track current work and blockers in GitHub Issues, Milestones, or Projects.

## Active module taxonomy

Use this numbering in new docs, UI copy, comments, tickets, and implementation notes:

| Module | Name |
|---|---|
| M0 | Platform Core |
| M1 | Admissions and Student Profiles |
| M2 | Smart Attendance |
| M3 | Fees and Receipts |
| M4 | Academics, Exams, CAS, Report Cards |
| M5 | Activity Feed and Milestones |
| M6 | Homework and Timetable |
| M7 | HR and Payroll |
| M8 | Library |
| M9 | Transport |
| M10 | Canteen |
| M11 | Accounting and Finance |
| M12 | Notifications and Delivery |
| M13 | Learning Layer |
| M14 | Intelligence / AI |
| M15 | Notices and Announcements |

`M8A`, `M8B`, and `M8C` are obsolete. Library, Transport, and Canteen are independent modules.

Inventory & Asset Management is scrapped from the active module plan. Do not add Inventory docs, APIs, routes, migrations, entitlements, seed data, or UI unless explicitly re-approved by the project owner.

## Product stance and release target

SchoolOS is a Nepal-first multi-tenant education operating SaaS for `PRESCHOOL`, `SCHOOL` (Grade 1-10), and `HIGHER_SECONDARY` (Grade 11-12 / +2), not a CRUD dashboard and not an MVP delivery exercise. Bachelor and Master's institution-management features are not active scope. Every change must move the supported release boundary toward **Production / General Availability (GA)**.

Use the release stages defined in `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`:

```text
Development complete
Internal QA ready
Staging validated
Controlled pilot validated
Release candidate
GA / Production release
```

Report readiness honestly. The current posture is Internal QA / controlled-pilot preparation; SchoolOS is not GA until staging migration and provider checks, authenticated browser E2E, device QA, backup/restore proof, controlled-pilot workflows, monitoring, rollback, and release evidence pass. Passing local tests, showing a demo, or completing backend code does not establish production or GA readiness.

Current priorities: security/RBAC/tenant-isolation evidence; staging deployment and operational proof; browser E2E; real-API web workspaces; pilot workflows; mobile device QA; performance/backup/observability/release automation. M14 AI remains roadmap only unless explicitly approved.

## Architecture: never break

- Keep NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js App Router, Flutter companion app, `packages/core` where available.
- No Angular migration, microservices, new DB/search cluster/GPU/Kubernetes, or separate deployment units unless approved.
- Do not rename `tenantId`.
- Keep planes separate: `/platform/*` operator SaaS, `/dashboard/settings/*` school config, `/dashboard/*` school operations.
- Do not mix SaaS billing with school fee collection/accounting.
- Keep M13 Learning separate and reuse core students/staff/classes/subjects/timetable/files/RBAC/audit/notifications.
- Keep M12 notification delivery separate from feature modules. Source modules emit events; M12 owns recipient resolution, templates, channel routing, delivery jobs, retries, read state, provider diagnostics, and audit.
- Keep M15 notice authoring separate from M12 delivery. M15 previews and publishes notices, then emits a normalized event to M12. Chat/conversations are deferred; preserve historical data and authorization without active navigation or new writes.

## Naming and contract rules

- Follow the naming and contract rules in this file and the existing touched-area conventions before adding or renaming files, folders, routes, DTOs, schema values, API clients, or web/mobile surfaces.
- New TypeScript/web paths use kebab-case; Flutter/Dart paths use lower_snake_case; framework-required filenames remain exceptions.
- New API paths use lowercase kebab-case resource nouns, explicit route parameters such as `:studentId`, and documented domain-command routes only when CRUD is insufficient.
- Use one canonical business term per concept. `tenantId` is the only tenancy boundary name.
- Persisted/API lifecycle values must follow one chain: Prisma/domain value -> DTO validation -> service -> OpenAPI -> shared contract -> web/mobile. Do not duplicate raw status strings or invent UI-only statuses.
- Preserve stable legacy names unless a documented compatibility and migration plan protects API, database, web, mobile, integration, job, cache, and test consumers.

## Security and data rules

- `tenantId` is the strict boundary for API, jobs, files, cache, exports, reports, web, mobile, learning, notifications, and school operations.
- Backend authorization is truth; frontend hiding is UX only.
- Disabled modules and suspended tenants fail closed everywhere.
- Parent = linked children only. Student = own/session-scoped only. Teacher = assigned class/section/subject only unless permitted. Driver = assigned trip only. Staff self-service = own data only.
- Platform support override needs reason, audit, and expiry where supported.
- Never expose unsafe internals, private payloads, provider/storage internals, raw stack traces, or private staff/finance data.
- Notifications must not leak private message bodies, provider credentials, callback secrets, raw object keys, private URLs, salary/bank data, or unrelated student details.

## Files, money, notifications, web, mobile

Files: always use `Feature module -> FileRegistryService -> StorageService -> StorageAdapter`. No provider SDKs in feature modules, no base64 files in DB, no raw private-file browser opens. Web/mobile use protected authenticated helpers.

Money: backend/database totals only. Money writes are idempotent and audited. Confirmed finance/accounting/payroll records use reversal/correction, not silent mutation. No offline financial writes unless explicitly approved with backend reconciliation.

Notifications: source modules emit normalized events and never call SMS/email/push providers directly. M12 owns recipient resolution, templates, preferences, channel routing, delivery attempts, retries, provider callbacks, read state, and notification-center behavior.

Web: one screen = one main job; real APIs only; no fake production data; server-side pagination for growing lists; states for loading/empty/error/success/permission/module locked/validation/file unavailable/queued/partial failure; high-risk actions need confirmation and reason where required. KPIs only where backend-owned, time-bound, actionable (real drill-through), and honest (never fake `0` for unavailable/locked) — see `apps/web/AGENTS.md` KPI design rule; mobile never copies web KPI grids (`apps/schoolos_mobile/AGENTS.md`).

Mobile: companion app only; persona-first; purpose-limited APIs only; no admin-shaped mobile payloads; safe offline reads only; visible sync states for approved idempotent writes. Students use controlled school learning/session access only; a broad Student App is not active scope.

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

## Before coding

1. Read focused docs and existing code first.
2. Inspect contracts/OpenAPI, Prisma schema, DTOs, permissions, audit, API clients, and tests for the touched area.
3. Implement missing production pieces only; do not rewrite working modules.
4. Do not invent endpoint contracts. Mark unknowns as `needs backend verification`, `needs OpenAPI confirmation`, `needs mobile DTO`, `needs idempotency confirmation`, or `needs offline sync confirmation`.
5. Add/update focused tests where appropriate.
6. Run relevant checks and report only what actually ran.

## Done means

Development complete means real persistence; no fake production data; tenant/RBAC/entitlement enforced; persona scopes fail closed; sensitive writes audited; money idempotent; notification delivery state honest; files through File Registry/StorageService; paginated growing lists; complete UI states; protected downloads; and focused regression updated where appropriate.

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
