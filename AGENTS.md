# SchoolOS Agent Instructions

Repository-wide rules for human and AI contributors. Keep work production-oriented, scoped, evidence-based, and Nepal-only.

**Current posture:** P0 production-safety execution for a controlled real-school pilot. Do not expand scope to create an appearance of readiness.

**Active P0 modules:** M0–M7, M11, M12, M15 as required by current P0 workflows.

**Deferred/frozen:** M8 Library, M9 Transport, M10 Canteen, M13 Learning, M14 Intelligence/AI. Preserve existing data, migrations, contracts, permissions, tests, and compatibility code; add no new feature work unless the project owner explicitly reactivates a module.

## 1. Instruction precedence

1. Explicit project-owner instruction for the current task.
2. This root `AGENTS.md`.
3. Scoped `AGENTS.md` in the touched app/package.
4. Canonical product, requirements, architecture, security, and release documents.
5. Existing contracts, migrations, tests, and code conventions.

Latest explicit owner decisions override stale roadmap assumptions. Update canonical docs when a conflict is confirmed; do not silently preserve contradictions.

## 2. Canonical sources

Start with `README.md`, `docs/README.md`, and `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`. Then read only the focused source required for the task.

| Area | Canonical source |
|---|---|
| Product/function | `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` |
| API/database/web/mobile requirements | `docs/requirements/SCHOOLOS_SRS.md` |
| Architecture/security/platform | `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` |
| Module ownership/gaps | `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md` |
| Web | `apps/web/AGENTS.md`, `apps/web/e2e/README.md` |
| Mobile | `apps/schoolos_mobile/AGENTS.md`, `apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md` |
| Production/operations | `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md` |

Do not create duplicate PRDs/SRSs/SDDs/runbooks or ad hoc roadmap Markdown when content belongs in a canonical document. Track work/blockers in GitHub Issues, Milestones, or Projects where available.

## 3. Module taxonomy and current execution status

| Module | Name | Status |
|---|---|---|
| M0 | Platform Core | Active P0 |
| M1 | Admissions and Student Profiles | Active P0 |
| M2 | Smart Attendance | Active P0 |
| M3 | Fees and Receipts | Active P0 |
| M4 | Academics, Exams, CAS, Report Cards | Active P0 |
| M5 | Activity Feed and Milestones | P0-dependent only |
| M6 | Homework and Timetable | P0-dependent only |
| M7 | HR and Payroll | P0-dependent only |
| M8 | Library | Deferred |
| M9 | Transport | Deferred |
| M10 | Canteen | Deferred |
| M11 | Accounting and Finance | Active P0 |
| M12 | Notifications and Delivery | Active P0 |
| M13 | Learning Layer | Frozen / disabled by default |
| M14 | Intelligence / AI | Roadmap-only |
| M15 | Notices and Announcements | Active P0 |

- `M8A`, `M8B`, `M8C` are obsolete.
- Inventory/Asset Management is not active scope.
- Chat/conversations are removed from active product scope. Preserve legacy data only where required for compatibility/retention; add no navigation or new writes.
- A broad standalone Student App is not active scope.

## 4. Nepal-only product boundary

SchoolOS is a Nepal-first multi-tenant school operating SaaS for:

- `SCHOOL`: Grades 1–10.
- `HIGHER_SECONDARY`: Grades 11–12 / +2.

Do not introduce international expansion, Cambridge/IB/British/American curriculum execution, OneRoster/LTI, foreign accreditation/compliance, cross-country localization, preschool, Bachelor’s/Master’s management, public rankings, or social/open-chat features without a new explicit owner decision.

Release claims must follow evidence:

```text
Development complete
→ Internal QA ready
→ Staging validated
→ Controlled pilot validated
→ Release candidate
→ GA / Production release
```

Local tests/builds/demos are not staging, pilot, RC, or GA evidence.

### P0 is the default implementation scope

Do not start P1/P2 feature expansion while unresolved P0 blockers remain unless explicitly instructed.

P0 execution order:

1. P0-01 — fail-closed entitlements, tenant isolation, teacher assignment authorization, guardian scoping, mobile cache invalidation, authorization matrix.
2. P0-02 — attendance correctness, locking, idempotency, correction history.
3. P0-03 — marks authorization, review/lock/publish/unlock/correction/versioning.
4. P0-04 — versioned Nepal School Education Compliance Profile.
5. P0-05 — reproducible IEMIS validation/export; no direct-sync claim without an authorized interface.
6. P0-06 — fee/receipt/reconciliation integrity and idempotent M3→M11 posting.
7. P0-07 — privacy, safeguarding, consent, protected files, sensitive-access audit.
8. P0-08 — bounded offline/synchronization correctness.
9. Nepal localization correctness: Nepali Unicode, NPR, Nepal timezone, Nepal address hierarchy, BS/AD presentation with canonical date storage.
10. Backup/restore, clean migrations, observability, provider/storage readiness, and controlled-pilot evidence.

## 5. Platform control plane and school application are separate security domains

The **SchoolOS Platform** and the **School Management System** must not be one application where a hidden `DEVELOPER` role simply sees more school menus.

They may share the monorepo, backend infrastructure, PostgreSQL, Redis, storage abstractions, common packages, and deployment pipeline, but must remain separate in identity, authorization, routing, UI surface, audit semantics, and support access.

### School tenant plane

School personas operate only inside trusted tenant scope: Principal, Admin, Teacher, HR, Accountant, Parent/Guardian.

- `/dashboard/*` = school operations.
- `/dashboard/settings/*` = school configuration.

A Principal/Admin may be highly privileged inside one school but must never receive platform capabilities, provider secrets, global flags, SaaS plan controls, infrastructure controls, or other tenants’ data.

### Platform control plane

`/platform/*` is SchoolOS-internal SaaS control plane for tenant lifecycle, entitlements, SaaS subscriptions, platform operators, provider configuration, release/feature controls, system health, support tooling, cross-tenant audit, and centrally managed compliance-profile publishing.

Use distinct trusted contexts conceptually:

```text
SchoolAuthorizationContext: tenantId + schoolUserId + roles + permissions
PlatformAuthorizationContext: platformOperatorId + platformRoles + platformCapabilities
```

Rules:

- Never implement `role === 'DEVELOPER' → showEverything()`.
- School sessions/JWTs cannot become platform sessions by adding a role.
- Platform capabilities cannot be assigned by a school Admin/Principal.
- Platform sessions do not carry a tenant as permanent authority scope.
- Prefer a distinct internal platform frontend (for example `apps/platform-web`) rather than platform menus embedded in the school web app. If migration is incomplete, move incrementally and do not duplicate functionality.
- Separate frontend/security domains do **not** require microservices or a second database. Do not add new infrastructure units without approval.

### Controlled support access

Platform operators do not get ambient unrestricted tenant-record browsing. Tenant support access should be purpose-limited and, where supported, require tenant selection, reason/ticket, scoped module/capability, read-only default, expiry, step-up/approval for sensitive operations, and full audit. Emergency access must never become an untracked permanent bypass.

## 6. Architecture invariants

Keep:

- NestJS modular monolith.
- PostgreSQL/Prisma.
- Redis/BullMQ.
- Next.js App Router.
- Flutter companion app.
- `packages/core` where appropriate.

Do not introduce microservices, another primary database/search cluster, GPU infrastructure, Kubernetes, or unrelated frameworks without explicit approval.

Mandatory boundaries:

- `tenantId` is the canonical tenancy boundary name.
- Backend authorization is truth; frontend hiding is UX only.
- SaaS billing/subscriptions remain separate from school fees/accounting.
- M11 is authoritative for accounting; M3/M7 hand off controlled idempotent entries.
- Source modules emit normalized events; M12 owns notification delivery.
- M15 owns notice authoring/publishing and hands normalized events to M12.
- M13 remains frozen and logically separate; preserve existing data/contracts.

## 7. Security, authorization, and isolation

Never trust client-supplied `tenantId`, roles, permissions, guardian relations, teacher assignments, totals, approval states, or lifecycle states.

Fail closed when a tenant is suspended, entitlement is disabled/missing/invalid/unavailable, required capability/assignment cannot be verified, guardian relationship is not active/verified/authorized, or protected-file authorization fails.

Persona scope:

- Parent: active linked children only, with per-relationship permissions/restrictions.
- Teacher: active assigned class/section/subject/period/component only.
- Class teacher: cross-subject visibility does not grant another subject teacher’s write access.
- Staff self-service: own records only unless explicitly permitted.
- Platform operator: SaaS control-plane authority; tenant-record access only through controlled support paths.

Authoritative teacher writes require explicit capabilities, not generic Teacher role. Use existing canonical capabilities; equivalents include `HOMEROOM_ATTENDANCE_MARK`, `PERIOD_ATTENDANCE_MARK`, `SUBJECT_HOMEWORK_WRITE`, `SUBJECT_MARKS_WRITE`, `CLASS_ACADEMIC_OVERVIEW`, `CLASS_TEACHER_REMARK_WRITE`, `RESULT_REVIEW`, `RESULT_PUBLISH`, `MARKS_UNLOCK`.

Sensitive writes/support overrides are audited. Never expose secrets, raw stack traces, provider/storage internals, callback secrets, object keys, private URLs, unrelated student data, safeguarding records, salary/bank data, or private finance/staff data.

Never place production credentials, real student data, database backups, secrets, or private school records in prompts, logs, fixtures, screenshots, issues, PR text, or commits.

## 8. Cross-cutting implementation rules

### Contracts and naming

- Inspect touched-area conventions before adding/renaming routes, files, DTOs, enums, schemas, clients, components, or contracts.
- TypeScript/web paths: kebab-case. Flutter/Dart: lower_snake_case. Framework-required names are exceptions.
- API paths: lowercase kebab-case resource nouns with explicit parameters such as `:studentId`.
- Lifecycle values flow `Prisma/domain → DTO → service → OpenAPI → shared contract → web/mobile`.
- Do not invent UI-only statuses or duplicate raw lifecycle strings.
- Preserve stable legacy names unless a compatibility plan covers DB/API/web/mobile/jobs/cache/integrations/tests.

### Files

Use `Feature module → FileRegistryService → StorageService → StorageAdapter`. No provider SDKs in feature modules, normal DB base64 blobs, raw private-file browser opens, or exposed object keys/private URLs.

### Money

Backend/database totals are authoritative. Money writes are idempotent and audited. Confirmed payments, receipts, accounting, payroll, refunds, and adjustments use reversal/correction, never silent deletion/mutation. Official totals are never recomputed in web/mobile. High-risk financial writes remain online-only unless explicitly approved with backend reconciliation.

### Notifications / notices

Feature modules emit normalized events; they do not call providers directly. M12 owns recipient resolution, templates, preferences, channel routing, jobs/retries/callbacks, read/acknowledgement state, diagnostics, and delivery audit. M15 owns notice draft/approval/audience/version/publish/withdraw semantics.

### Web

- One screen = one primary job.
- Real APIs only; no fake production data.
- Paginate growing lists server-side.
- Handle loading, empty, success, error, permission, module-locked, validation, queued, conflict, partial-failure, and file-unavailable states where applicable.
- High-risk actions require confirmation/reason where required.
- KPIs are backend-owned, time-bound, actionable, and honest; never fake `0` for unavailable data.

### Mobile

- Companion app; persona-first, purpose-limited APIs; no admin-shaped payloads.
- Safe offline reads plus only approved idempotent writes.
- Show queued/synced/conflict/stale/revoked/failed states where relevant.
- Tenant/child/assignment/access changes must invalidate no-longer-authorized local data.

Biometrics for Parent/Teacher/Principal:

- School provides initial credentials through an approved channel.
- After first successful mobile login, prompt to enable device-supported Face ID/fingerprint.
- Optional; user may skip and enable later in Settings.
- Credential/password fallback remains available.
- Biometrics are device-local unlock only; never store raw biometric templates.
- Logout/session revocation/account recovery/device replacement/permission loss must invalidate protected local access appropriately.

### Offline P0 boundary

Allowed: attendance drafts, homework drafts, activity drafts, cached timetable/assigned roster, read-only notices/notifications.

Not allowed: payments, cashier close, payroll finalization, accounting journals, result publication, marks unlock, guardian changes, role/permission changes, institution configuration, compliance activation, government-export approval.

Offline authoritative writes require client-operation/idempotency IDs, fresh server-side authorization, version/conflict checks, and visible resolution. No silent last-write-wins for attendance, marks, or protected records.

## 9. Missing API decision rule

If a web/mobile/platform surface needs data and no safe backend API exists:

1. Inspect current code, OpenAPI/contracts, permissions, DTOs, Prisma, services, and tests.
2. Confirm the need is real, repeatable, module-owned, tenant-scopable, entitlement/RBAC-gatable, and needed for the active P0 workflow.
3. If yes, implement the smallest purpose-limited module-owned API and connect it.
4. If no, show a safe unavailable/locked/permission state and record the gap.

Never invent endpoint contracts, guess response shapes, derive authoritative totals from list APIs, or show developer-facing “Needs backend API” text in school UI.

Use explicit uncertainty labels when needed: `needs backend verification`, `needs OpenAPI confirmation`, `needs mobile DTO`, `needs idempotency confirmation`, `needs offline sync confirmation`, `needs authorization confirmation`.

## 10. Before coding

1. Read focused instructions/canonical docs/current implementation.
2. Inspect OpenAPI/contracts, Prisma, DTOs, permissions, audit, API clients, migrations, focused tests.
3. Identify the smallest safe P0 change.
4. Reuse architecture; do not duplicate services/endpoints/DTOs/models/components/docs.
5. Do not rewrite working modules without a verified defect or approved reason.
6. Do not modify unrelated files or weaken tests/validation.
7. Update focused tests for behavior changes.
8. Paginate growing lists, avoid unbounded `findMany`, use selective/aggregate queries, review tenant-scoped indexes.
9. Return safe error envelopes; never surface raw technical errors to web/mobile.
10. Run relevant checks and report exact commands/results.

If a security/finance/privacy/academic-integrity requirement remains unresolved after canonical-source inspection, mark that slice PARTIAL/BLOCKED rather than inventing behavior; continue independent safe work where possible.

## 11. Definition of done

Development complete requires, where applicable:

- Real persistence; no fake production data.
- Server-side tenant/RBAC/entitlement/persona/assignment/guardian enforcement.
- Suspended tenants/disabled modules fail closed.
- Sensitive writes/support overrides audited.
- Money writes idempotent; confirmed records corrected/reversed, not deleted.
- Attendance/marks preserve lifecycle and correction history.
- Honest notification state.
- Protected-file architecture respected.
- Growing lists paginated.
- Complete applicable web/mobile states.
- Mobile cache/access revocation handled.
- Focused regression, cross-tenant, role, assignment, guardian, and idempotency tests updated.
- Relevant checks pass or failures are reported exactly.

Staging/pilot/RC/GA claims additionally require the evidence in `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`, including applicable staging migration/configuration, provider/storage checks, authenticated browser E2E, mobile device QA, backup/restore proof, monitoring/alerts, rollback readiness, and controlled-pilot evidence.

## 12. Verification

Run only relevant gates and report exact commands/results. Typical gates:

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

Run platform-web checks only if that app exists/is touched, using its real package scripts. `pnpm smoke:learning` is relevant only for an allowed M13 security/regression fix; it is not a current P0 pilot gate while M13 is frozen.

Docs-only changes need no runtime checks unless they alter executable commands/configuration/contracts/release procedures.

## 13. Progress format

```text
Release stage:
Current P0 slice:
Current module:
Completed:
Remaining P0 blockers:
Risks:
Verification run:
Verification result:
Staging/pilot evidence:
Deferred/not touched:
Next release action:
```

Report verified facts only. Distinguish implementation completion, local verification, staging evidence, pilot evidence, and unresolved blockers.
