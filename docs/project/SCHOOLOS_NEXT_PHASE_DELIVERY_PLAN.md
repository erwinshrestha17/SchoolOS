# SchoolOS Next Phase Delivery Plan

**Status:** Canonical focused execution plan
**Last updated:** 2026-07-01
**Source audit:** `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`

This plan is dependency-driven. It does not replace product requirements, functional requirements, architecture/security guidance, design plans, production runbook, or the GA release policy. It is the focused execution path from local internal-QA evidence to staging, one controlled paid design partner, and production readiness.

Cross-surface scope is governed by `docs/product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md`. Its feature inventory is a boundary reference, not an automatic backlog: create implementation work only for repository-verified gaps that fit the current phase and its exit gates.

The initial commercial wedge and external-claim boundary are governed by `docs/product/SCHOOLOS_BRD.md` and `docs/product/SCHOOLOS_MARKETING_AND_COMPLIANCE_CLAIMS_POLICY.md`. The live proof required before a paid design-partner commitment is governed by `SCHOOLOS_PILOT_RISK_EVIDENCE_MATRIX.md`.

## Current Verified Baseline

- Root local gates pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`.
- Prisma generation and validation pass: `pnpm db:generate` and `pnpm db:validate`.
- The OpenAPI wiring gate passes: `pnpm verify:openapi`.
- Web local production build and web contract tests pass.
- Playwright authenticated browser smoke passed locally against the live seeded backend: `pnpm test:web:e2e` passed 17 checks on 2026-06-21.
- Flutter mobile gates pass: `flutter pub get`, `dart format --output=none --set-exit-if-changed .`, `flutter analyze`, `flutter test`, and `flutter build apk --debug`.
- Phase 1 local seed/smoke evidence passed with Docker Postgres/Redis and local API: `pnpm db:migrate`, `pnpm db:seed` twice, `pnpm smoke:pilot`, API typecheck/test/E2E, and Flutter analyze/test.
- Local Android emulator role-flow QA passed for principal/admin, parent, class teacher, subject teacher, support staff, accountant, and driver against the same seeded backend.

## Current Blockers

1. Production environment preflight fails when forced because required production variables and secrets are absent.
2. Staging migration, deployment, provider, storage, backup, restore, rollback, monitoring, and alert evidence is missing.
3. Authenticated browser E2E and mobile role-flow QA have local-only evidence; staging and physical-device evidence are missing.
4. External provider, object-storage, monitoring, rollback, and controlled-pilot evidence is missing.
5. No paid Grade 1-10 design partner may be signed before the sold slice passes the risk-evidence matrix, including shared-service entitlement isolation.

## Commercial Discovery Runs in Parallel

Commercial discovery is cheap, continuous, and separate from release evidence. It does not make an unproven workflow safe to sell.

- Run 8-12 interviews using `SCHOOLOS_PILOT_INTERVIEW_SCREENER.md` before finalizing package, pricing cadence, fee-transparency positioning, or pilot commitments.
- Test the initial mid-tier private School (Grade 1-10) target as a hypothesis.
- Learn the current fee/scholarship/discount workflow, parent-trust pain, buyer approval path, budget treatment, competitor context, diaspora-guardian patterns, and willingness to run shadow mode.
- Do not pitch legal compliance. Use the claim boundary in `docs/product/SCHOOLOS_MARKETING_AND_COMPLIANCE_CLAIMS_POLICY.md`.
- Record the school’s internal pilot champion, accountant/cashier owner, and technical/admin contact before treating it as a viable design partner.

## Scope Freeze for Horizon 1

The first sold slice is limited to:

```text
Student and guardian records
+ attendance
+ fee records, discounts/scholarships where enabled
+ receipts and reasoned reversals/refunds
+ parent notices and fee visibility
+ principal attention
```

No new work is allowed unless it:

1. removes a pilot blocker;
2. improves this sold slice;
3. proves tenant isolation, entitlement isolation, money correctness, parent/teacher scope, protected files, or release evidence; or
4. is explicitly demanded by the signed pilot workflow and can be delivered safely within the existing architecture and contracts.

Deferred modules must be server-side entitlement-gated for the pilot tenant. Hiding navigation alone is not sufficient.

## Stage-Aware Architecture Gaps

The shared platform still supports `PRESCHOOL`, `SCHOOL`, `HIGHER_SECONDARY`, and proposed `BACHELOR` direction. Current code evidence supports the shared tenant/student/guardian/enrollment/class/section/subject foundation, but the following remain design work rather than implementation claims:

- Backend-owned `ExperienceContext`.
- Tenant program offerings and class/section stage profile.
- Preschool authorized pickup, temporary pickup change, arrival/checkout, pickup exception, and care-alert scope.
- Higher Secondary / +2 streams, subject combinations, practical/lab timetable, practical components, projects, and board-readiness lifecycle.
- Bachelor's programs, departments, intakes/batches, semesters/terms, courses, faculty assignment, Student App self-service, and result/assignment workflows.
- Master eligibility for future Student App only; no active Master's management pack.

Do not build UI-only stage switches or hard-code +2 streams before schema, OpenAPI/shared DTO, authorization, web/mobile, migration, seed, and test requirements are designed.

## Explicitly Deferred Scope

- M14 Intelligence / AI.
- Broad student-owned mobile app beyond approved learning/session flows, except future Bachelor/Master Student App after backend eligibility and self-scope contracts exist.
- Master's full institution-management pack.
- Architecture rewrites, microservices, Kubernetes, search clusters, GPU workloads, or unrelated infrastructure.
- Production provider integrations without sandbox/staging credentials and verification.
- Broader Preschool, +2, Bachelor, multi-branch, Learning, or live-map expansion before the initial Grade 1-10 pilot produces technical, commercial, and support evidence.

## Phase 0 — Stable Verification Baseline

**Goal:** Keep release evidence honest and local verification reproducible.

| Workstream | Required work |
|---|---|
| Backend | Keep current local API gates passing. Avoid feature work except small fixes required to keep documented commands working. |
| Web | Keep contract tests and build passing. Preserve authenticated browser execution. |
| Mobile | Keep Flutter analyze/tests/APK build passing. Record build warnings. |
| Test | Preserve exact command results in the readiness audit. |
| Seed/demo data | Keep the seed idempotent and representative. |
| Staging/deploy | Do not claim staging proof from local runs. |

**Exit gate:**

```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
cd apps/schoolos_mobile && flutter pub get && dart format --output=none --set-exit-if-changed . && flutter analyze && flutter test && flutter build apk --debug
```

## Phase 1 — Realistic Seeded Tenant and Smokeable Workflows

**Goal:** Keep one realistic Nepal-school tenant usable for local demo, browser smoke, and mobile role testing without frontend hard-coded data.

| Workstream | Required work |
|---|---|
| Backend | Use central `apps/api/prisma/seed.ts` and existing lifecycle services; preserve tenant isolation, RBAC, File Registry, finance, and payroll boundaries. |
| Web | Fix only seed-dependent empty/error states discovered by smoke. |
| Mobile | Preserve meaningful empty, permission, module-locked, offline, and genuine-error states. |
| Test | Keep seed idempotency plus parent, teacher, staff, driver, and mobile endpoint scope coverage. |
| Seed/demo data | Maintain a realistic school tenant with academic year, classes/sections, students/guardians, teacher assignments, timetable, attendance, homework, notices, fees/receipts, HR/payroll, and representative transport. |

**Exit gate:**

```bash
pnpm db:migrate
pnpm db:seed
pnpm smoke:pilot
pnpm --filter @schoolos/api test
pnpm --filter @schoolos/api test:e2e
cd apps/schoolos_mobile && flutter analyze && flutter test
```

## Phase 2 — Authenticated Web Completion and Browser E2E

**Goal:** Keep pilot workflows verifiable in a real browser against seeded backend data.

| Workstream | Required work |
|---|---|
| Backend | Fix only endpoint defects found by browser E2E. |
| Web | Complete safe states and route-level flows for the sold slice first; defer broader module polish. |
| Mobile | No expansion except shared API contract fixes. |
| Test | Keep authenticated Playwright execution; add role-denial, module-locked, published/unpublished, and protected-file checks where missing. |
| Staging/deploy | Prepare an explicit staging environment matrix. |

**Acceptance criteria:**

- Browser tests cover school admin, platform operator, teacher, parent-safe access, restricted/denied routes, and module-locked state.
- Protected file flows use authenticated helpers only.
- Unpublished marks/report cards are inaccessible through route, API, file, notification, and deep-link paths.

**Exit gate:**

```bash
pnpm test:web:e2e
pnpm verify:production
```

Local browser success is necessary but not staging proof.

## Phase 3 — Mobile Role Flows and Device QA

**Goal:** Verify the companion app with real seeded backend data while preserving purpose-limited persona scope.

| Workstream | Required work |
|---|---|
| Backend | Purpose-limited mobile endpoint fixes only. |
| Web | No scope except shared API contract and documentation updates. |
| Mobile | Preserve parent, teacher, principal, staff/self-service, and driver flows with safe offline behavior. |
| Test | Cover empty, permission denied, module locked, unauthorized, seeded-data success, and prohibited financial-offline behavior. |
| Staging/deploy | Produce Android emulator evidence; physical-device and signed-release work remains later. |

**Acceptance criteria:**

- Parent sees linked-child data only.
- Teacher sees assigned classes/subjects only.
- Staff sees own attendance, leave, and payslips only.
- Driver sees assigned route/trip only.
- Parent payment initiation blocks when offline; it is not queued for later financial sync.
- Bilingual fee/notice comprehension and a configured critical-parent reach path, including SMS fallback where the pilot requires it, are explicit pilot decisions rather than assumed app-only behavior.

**Exit gate:**

```bash
cd apps/schoolos_mobile
flutter pub get
dart format --output=none --set-exit-if-changed .
flutter analyze
flutter test
flutter build apk --debug
```

Plus emulator screenshots/log evidence for every representative role.

## Phase 4 — Staging, Providers, Backups, and Observability

**Goal:** Convert local readiness into controlled staging evidence.

| Workstream | Required work |
|---|---|
| Backend | Run `prisma migrate deploy`; verify `/health`, `/ready`, queue processors, provider readiness, and storage behavior. |
| Web | Deploy staging web with HTTPS API origin and authenticated browser E2E. |
| Mobile | Configure staging API URL and run emulator/device QA against staging. |
| Test | Run staging smoke, authenticated browser E2E, mobile role checklist, and the named automated tests in the risk matrix. |
| Staging/deploy | Validate secrets, HTTPS origins, storage, email/SMS/push modes, payment-gateway sandbox, backups, restore, rollback, logs, and alerts. |

**Acceptance criteria:**

- `pnpm verify:env:staging` passes with real staging values, HTTPS origins, non-placeholder secrets, configured web API base URL, and explicit provider/storage modes.
- Staging migration apply, backup restore duration, provider mode, alert/log access, and rollback procedure are recorded.
- Every risk-matrix row has a named test and at least Automated-passing status; sold-slice rows have a recorded live staging proof where the path exists.
- Shared notification, search, dashboard aggregation, audit/activity, export, and job surfaces are checked for both tenant and module-entitlement filtering.

**Exit gate:**

```bash
pnpm verify:production
pnpm smoke:pilot
```

Plus staging migration, backup, restore, provider, alert, and evidence-matrix records.

## Phase 5 — Controlled Single-School Pilot

**Goal:** Run one controlled Grade 1-10 pilot with a narrow, fee-transparency and parent-trust wedge.

### Entry criteria before paid design-partner signature

```text
[ ] School fits the target hypothesis and has a principal/owner decision-maker.
[ ] School has an admin and finance/cashier champion for daily workflow validation.
[ ] School agrees to a defined attendance + fee shadow-mode period.
[ ] Sold-slice scope, provider modes, support path, and data/onboarding responsibilities are written down.
[ ] All 10 risk-matrix rows are Live-proven.
[ ] Entitlement-isolation sub-checklist is complete, including shared/cross-cutting services.
[ ] Claims policy is used in any proposal, training, sales, or pilot material.
```

| Workstream | Required work |
|---|---|
| Backend | Fix pilot-critical defects only; preserve auditability and data boundaries. |
| Web | Support the sold daily workflow and capture defect evidence. |
| Mobile | Support only selected parent/teacher/staff/driver companion flows. |
| Test | Run regression gates before each pilot release. |
| Data/onboarding | Move from demo seed to school-approved pilot data import/onboarding. |
| Staging/deploy | Operate backup, restore, rollback, monitoring, and incident response procedures. |
| Commercial/pilot success | Run interviews, document approval and support owners, train the school, and record shadow-mode findings without promising legal certification. |

### Pilot sequence

1. Configure and verify the tenant’s sold slice; deferred modules stay entitlement-locked at API, job, file, mobile, and shared-service boundaries.
2. Run attendance and fees in shadow mode alongside the school’s current process.
3. Reconcile every material mismatch using an auditable correction path; do not silently alter confirmed financial records.
4. Cut over only after shadow-mode attendance + fees completes without a P0/P1 incident and the named school owner signs off.
5. Publish a pilot exit report with defects, resolutions, support requests, data corrections, and operator/school sign-off.

**Acceptance criteria:**

- One school completes the agreed Grade 1-10 sold slice without engineering handholding.
- No unresolved P0/P1 tenant isolation, entitlement, finance, payroll, file, auth, or parent-scope defect remains.
- Authorized staff can explain a configured charge, applied scholarship/discount, receipt, and reversal history from traceable records.
- Parent communication is clear for the agreed channels; configured provider modes are stated honestly.
- Backup/restore and rollback are understood by the operator team.

## Phase 6 — Same-Segment Expansion and Multi-School Hardening

**Goal:** Prove safe operation for a small number of schools in the same segment before broadening the product.

| Workstream | Required work |
|---|---|
| Backend | Strengthen tenant lifecycle, support-override audit, queue/backfill operations, abuse protection, and migration rollback playbooks. |
| Web | Harden platform operations and tenant administration workflows. |
| Mobile | Add release signing, crash/analytics policy, and staged rollout checks. |
| Test | Add multi-tenant load, concurrency, migration replay, and incident drills where practical. |
| Staging/deploy | Prove capacity, monitoring, backups, restore, rollback, and provider SLAs across more than one tenant. |
| Partnerships | Begin PABSON/N-PABSON relationship discovery only after a referenceable pilot result; do not imply endorsement without permission. |

**Exit gate:**

- Single-school production-ready decision can be upgraded only after pilot exit.
- Multi-school production-ready decision requires multi-tenant staging and operational proof.

## Phase 7 — Deferred Expansion and M14 Intelligence/AI

**Goal:** Reopen roadmap breadth only after production-critical, pilot, support, and commercial gates are stable.

| Workstream | Required work |
|---|---|
| Product | Reassess Preschool, +2, Bachelor, multi-branch, Learning, and later AI from validated school demand rather than documentation breadth. |
| Backend | Define privacy, consent, retention, provider, cost, and audit boundaries before any AI feature work. |
| Web | No AI UI until backend contracts and governance are approved. |
| Mobile | No AI/mobile learning expansion without explicit product approval. |
| Test | Add safety and provider-failure tests only if the relevant scope is approved. |

**Exit gate:** A separate approved implementation plan after Phase 6 evidence.

## Immediate Next Action

Start **Phase 4 — Staging, Providers, Backups, and Observability** while running commercial interviews in parallel. Do not claim staging, controlled-pilot, release-candidate, or GA readiness until the applicable technical, risk-matrix, commercial, and controlled-pilot evidence is recorded.
