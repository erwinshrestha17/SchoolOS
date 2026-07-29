# SchoolOS Agent Instructions

Token-conscious, repository-wide rules for human and AI contributors.

**Current posture:** Internal QA / controlled-pilot preparation. Make existing pilot-critical workflows reliable, secure, testable, and operationally usable. Do not expand scope unless the project owner explicitly approves it.

## 1. Instruction precedence

Apply instructions in this order:

1. Explicit project-owner instruction for the current task.
2. This root `AGENTS.md`.
3. Scoped `AGENTS.md` files in the touched app/package.
4. Canonical product, requirements, architecture, and release documents.
5. Existing contracts, migrations, tests, and established code conventions.

Do not use archived plans, generated summaries, or inferred behavior when a canonical source exists.

## 2. Read only what is relevant

Start with `README.md`, `docs/README.md`, and `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`. Then read only the focused source for the touched area:

| Area | Canonical source |
|---|---|
| Product/function | `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` |
| Software/API/database/web/mobile requirements | `docs/requirements/SCHOOLOS_SRS.md` |
| Architecture/security/platform | `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` |
| Module ownership and gaps | `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md` |
| Web | `apps/web/AGENTS.md`, `apps/web/e2e/README.md` |
| Mobile | `apps/schoolos_mobile/AGENTS.md`, `apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md` |
| Deploy/staging/operations | `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md` |

Formal document ownership is fixed:

| Artifact | Canonical path |
|---|---|
| PRD | `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` |
| SRS | `docs/requirements/SCHOOLOS_SRS.md` |
| SDD | `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` |
| MDD | `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md` |
| Release policy | `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md` |
| Production runbook | `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md` |

Do not create duplicate plans or ad hoc Markdown when content belongs in a canonical document. Track active work and blockers in GitHub Issues, Milestones, or Projects.

## 3. Active module taxonomy

Use these identifiers in docs, UI copy, comments, tickets, tests, and implementation notes:

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

- `M8A`, `M8B`, and `M8C` are obsolete.
- Inventory and Asset Management is removed from active scope. Do not add related docs, APIs, routes, migrations, entitlements, seed data, or UI unless explicitly re-approved.
- Chat/conversations are removed from the active product. Preserve historical data and authorization for compatibility/retention only; add no navigation, new writes, or replacement module identifier.

## 4. Product boundary and release target

SchoolOS is a Nepal-first multi-tenant education operating SaaS for:

- `SCHOOL`: Grades 1–10.
- `HIGHER_SECONDARY`: Grades 11–12 / +2.

Out of scope:

- Preschool, permanently removed by owner decision on 2026-07-18.
- Bachelor’s and Master’s institution-management features.
- Generic CRUD-dashboard positioning.
- Treating scope expansion as pilot readiness.

Every approved change must move the supported boundary toward Production / GA.

```text
Development complete
Internal QA ready
Staging validated
Controlled pilot validated
Release candidate
GA / Production release
```

The current posture is Internal QA / controlled-pilot preparation. Do not claim staging, pilot, release-candidate, production, or GA readiness without the applicable evidence in the GA release policy. Local tests, a build, a demo, or backend completion are not release evidence.

## 5. Delivery priorities

### P0 — Pilot-blocking safety and correctness

- Tenant isolation.
- Teacher assignment authorization.
- Guardian-child authorization.
- Attendance correctness.
- Fee and receipt correctness.
- Examination/mark-entry authorization.
- Sensitive-action audit logging.
- Backup and restore readiness.
- Suspended-tenant and disabled-module fail-closed behavior.

### P1 — Pilot operability

- Data migration and validation.
- Staff and parent onboarding.
- Essential reports and exports.
- Real-API web workspaces.
- Authenticated browser E2E.
- Mobile device QA.
- Performance, observability, provider, staging, and operational evidence.

### P2 — Post-pilot refinement

- UI refinement beyond validated usability problems.
- Optional modules.
- Advanced analytics.
- AI functionality.

P2 must not delay unresolved P0 or P1 work.

## 6. Frozen domains

### M13 Learning Layer

M13 is deferred and frozen. Preserve its backend, Prisma schema/migrations, OpenAPI/shared contracts, web/Flutter surfaces, tests, files, permissions, entitlements, and existing records.

Keep it disabled by default for pilot tenants, hidden when disabled, and outside pilot acceptance criteria and production-readiness claims.

Do not add M13 features, seed expansion, populated fixtures, mobile expansion, activity/question types, session modes, reports, analytics, AI, adaptive behavior, or broad student-home learning.

Only make a focused M13 change to fix tenant isolation, RBAC/ownership, suspended-tenant failure, protected-file security, build/typecheck failure, Prisma migration failure, OpenAPI verification failure, or repository-wide regression. Do not delete Learning data or run destructive Learning migrations.

### M14 Intelligence / AI

M14 remains roadmap-only unless explicitly approved.

## 7. Architecture: never break

Keep:

- NestJS modular monolith.
- PostgreSQL/Prisma.
- Redis/BullMQ.
- Next.js App Router.
- Flutter companion app.
- `packages/core` where available.

Do not introduce Angular migration, microservices, another database/search cluster, GPU infrastructure, Kubernetes, or separate deployment units without approval.

Mandatory boundaries:

- `tenantId` is the only tenancy boundary name; never rename it.
- `/platform/*` = operator SaaS plane.
- `/dashboard/settings/*` = school configuration plane.
- `/dashboard/*` = school operations plane.
- Keep SaaS billing separate from school fee collection/accounting.
- Keep M13 separate while preserving approved reuse of core entities/services.
- Source modules emit normalized events; M12 owns notification delivery.
- M15 owns notice authoring/publishing and emits normalized events to M12.

## 8. Naming and contract rules

- Inspect touched-area conventions before adding or renaming files, routes, DTOs, schema values, API clients, contracts, or UI surfaces.
- New TypeScript/web paths use kebab-case; Flutter/Dart paths use lower_snake_case; framework filenames are exceptions.
- New API paths use lowercase kebab-case resource nouns, explicit parameters such as `:studentId`, and documented command routes only when CRUD is insufficient.
- Use one canonical business term per concept.
- Persisted/API lifecycle values must follow: `Prisma/domain -> DTO -> service -> OpenAPI -> shared contract -> web/mobile`.
- Do not duplicate raw status strings or invent UI-only lifecycle values.
- Preserve stable legacy names unless a documented migration/compatibility plan protects database, API, web, mobile, integrations, jobs, cache, and tests.

## 9. Security and data rules

Backend authorization is truth; frontend hiding is UX only.

`tenantId` must scope APIs, jobs, files, caches, exports, reports, web, mobile, Learning, notifications, and all school operations.

Persona scopes fail closed:

- Parent: linked children only.
- Student: own/session-scoped records only.
- Teacher: assigned class/section/subject only unless explicitly permitted.
- Class teacher: view access does not grant write access to another teacher’s subject.
- Driver: assigned trip only.
- Staff self-service: own data only.

Also:

- Disabled modules and suspended tenants fail closed everywhere.
- Platform support override requires reason, audit, and expiry where supported.
- Sensitive writes must be audited.
- Never expose secrets, raw stack traces, Prisma/provider/storage internals, callback secrets, object keys, private URLs, salary/bank data, private staff/finance data, or unrelated student details.
- Never put production credentials, student data, or database backups in prompts, logs, fixtures, screenshots, or commits.

## 10. Cross-cutting implementation rules

### Files

Use `Feature module -> FileRegistryService -> StorageService -> StorageAdapter`.

No provider SDKs in feature modules, base64 files in DB, raw private-file browser opens, or exposed storage keys/private URLs. Web/mobile use authenticated protected-file helpers.

### Money

Backend/database totals are authoritative. Money writes are idempotent and audited. Confirmed fee, finance, accounting, and payroll records use reversal/correction, not silent mutation or deletion. No offline financial writes without explicit approval and backend reconciliation. Never calculate official totals in web/mobile.

### Notifications

Source modules emit normalized events and never call providers directly. M12 owns recipient resolution, templates, preferences, channel routing, jobs, retries, callbacks, read state, diagnostics, and delivery audit.

### Web

- One screen = one primary job.
- Real APIs only; no fake production data.
- Growing lists use server-side pagination.
- Handle applicable loading, empty, error, success, permission, module-locked, validation, file-unavailable, queued, and partial-failure states.
- High-risk actions require confirmation and reason where required.
- KPIs must be backend-owned, time-bound, actionable, and honest; never show fake `0` for unavailable or locked data.

### Mobile

- Companion app only; persona-first and purpose-limited APIs.
- No admin-shaped payloads.
- Safe offline reads only, plus explicitly approved idempotent writes.
- Show sync, queued, conflict, and failure states where applicable.
- A broad standalone Student App is not active scope.

### Learning

Preserve school-controlled, teacher-led, lab/session or controlled-device access. Do not add leaderboards, open student chat, harsh labels, AI tutors, adaptive runtime, broad home learning, or M14 behavior.

## 11. Missing API decision rule

If a web/mobile/platform surface needs data and no safe backend API exists:

1. Inspect existing code, OpenAPI/contracts, permissions, DTOs, Prisma, and tests.
2. Decide whether the need is real, repeatable, module-owned, tenant-scopable, RBAC/entitlement-gatable, and required for a production workflow.
3. If yes, implement a purpose-limited module-owned API and connect the surface.
4. If no, show a friendly unavailable/locked/permission state and record the exact gap.

Never invent endpoint contracts, guess response shapes, derive official totals from list APIs, or show developer-facing “Needs backend API” copy in pilot UI.

Use explicit uncertainty labels when needed: `needs backend verification`, `needs OpenAPI confirmation`, `needs mobile DTO`, `needs idempotency confirmation`, or `needs offline sync confirmation`.

## 12. Before coding

1. Read focused instructions, canonical docs, and existing implementation.
2. Inspect contracts/OpenAPI, Prisma, DTOs, permissions, audit, API clients, migrations, and focused tests.
3. Identify the smallest safe production change.
4. Reuse existing architecture; do not create duplicate services, endpoints, DTOs, models, components, or docs.
5. Do not rewrite working modules without a verified defect or approved architectural reason.
6. Do not modify unrelated files or weaken validation/tests to make checks pass.
7. Update focused tests for behavior changes.
8. Run relevant checks and report exactly what ran.

Guardrails:

- Contract first; never guess shapes.
- New visible workflows need appropriate seed data and focused smoke coverage where practical, or an explicit pending note.
- Use selective/aggregate queries, paginate growing lists, avoid unbounded `findMany`, and review tenant-scoped indexes.
- Return safe error envelopes; web/mobile never show raw technical errors.
- Stop on unknown permissions, contracts, idempotency, file access, financial behavior, or offline behavior.

## 13. Definition of done

### Development complete

All applicable conditions must hold:

- Real persistence; no fake production data.
- Tenant/RBAC/entitlement/persona scope enforced server-side.
- Disabled modules and suspended tenants fail closed.
- Sensitive writes audited; money writes idempotent.
- Confirmed financial records use correction/reversal.
- Notification delivery state is honest.
- Files use File Registry/StorageService boundaries.
- Growing lists are paginated.
- UI states and protected downloads are complete.
- Focused regression coverage is updated.
- Relevant checks pass, or unresolved failures are reported honestly.

### Staging, pilot, release candidate, production, or GA

These claims additionally require the exact applicable evidence in `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`: staging migrations/configuration, provider/storage checks, authenticated browser E2E, device QA, backup/restore proof, monitoring/alerts, rollback readiness, and controlled-pilot workflow evidence.

Never substitute local checks for release-stage evidence.

## 14. Verification

Run relevant gates only and report exact commands/results:

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
pnpm smoke:full
pnpm --filter @schoolos/web typecheck
pnpm test:web:e2e
cd apps/schoolos_mobile && flutter pub get && dart format . && flutter analyze && flutter test
```

`pnpm smoke:learning` is optional only for an allowed M13 fix or repository-wide M13 regression. It is not a pilot, release-candidate, production, or GA gate while M13 is deferred.

Docs-only changes need no runtime checks unless they alter executable examples, commands, configuration, contracts, or release procedures.

## 15. Progress format

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

Report verified facts only. Distinguish implementation completion, local verification, staging evidence, pilot evidence, and unresolved blockers.
