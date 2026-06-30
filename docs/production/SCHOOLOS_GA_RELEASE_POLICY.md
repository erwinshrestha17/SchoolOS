# SchoolOS Production / GA Release Policy

**Status:** Canonical release-governance policy
**Effective date:** 2026-06-18
**Applies to:** Product planning, implementation, tests, documentation, staging, pilots, mobile, web, platform operations, and release decisions

---

## 1. Decision

SchoolOS must no longer be planned, described, prioritized, or accepted as an **MVP-focused** product.

The delivery target is **Production Release / General Availability (GA)**:

```text
Production / Live environment = the monitored environment where real schools run daily work.
GA / General Availability     = the official public release suitable for onboarding supported schools beyond a controlled pilot.
```

This policy does **not** claim that SchoolOS is GA today. Current factual readiness is owned by `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`. A feature, module, local build, seeded demo, or passing test suite is not proof of GA by itself.

---

## 2. Required language

Use these terms in plans, PRs, reports, issues, release notes, and status documentation:

- Development complete
- Internal QA ready
- Staging validated
- Controlled pilot validated
- Release candidate
- Production readiness
- GA readiness
- GA blocker
- Production release gate

Do not use these as completion claims:

- MVP complete
- Good enough for MVP
- Demo works, therefore ready
- Backend complete, therefore production-ready
- Local tests passed, therefore GA-ready

When evidence is missing, state the exact missing gate rather than using an optimistic readiness label.

---

## 3. Product and architecture boundaries remain unchanged

SchoolOS remains a Nepal-first, multi-tenant education operating SaaS for `PRESCHOOL`, `SCHOOL`, `HIGHER_SECONDARY`, and `BACHELOR` direction. Master's is not a full active management pack; it is future extension and Student App eligibility only. The GA target must preserve these boundaries:

- Keep the NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js App Router, Flutter companion app, and shared contracts where available.
- Keep `tenantId` as the strict tenant boundary.
- Keep `/platform/*` for SchoolOS operator controls, `/dashboard/settings/*` for one school configuration, and `/dashboard/*` for daily school operations.
- Keep SchoolOS SaaS billing separate from school fee collection and M11 school accounting.
- Keep backend authorization, RBAC, tenant scope, and module entitlement as the source of truth.
- Keep M13 Learning as a separate domain that reuses core student, staff, class, subject, timetable, communication, file, RBAC, and audit systems.
- Keep M14 Intelligence / AI as roadmap-only until explicitly approved after the required data, review, safety, and cost controls exist.
- Keep broad Student App access backend-authorized and limited to active Bachelor or Master enrollments; Preschool through Grade 12 remain controlled learning/session-only.
- Do not introduce microservices, Angular migration, broad public student mobile, unsafe offline financial operations, or unverified live-map/provider scope as a shortcut to release.

---

## 4. GA-oriented definition of done

A workflow, module, release candidate, or GA release is complete only when its applicable evidence is recorded.

### 4.1 Functional and user-workflow completeness

- Real API and database persistence; no fake production data or browser-only business truth.
- A complete real school workflow, not only isolated CRUD actions.
- Loading, empty, validation, pending, success, error, permission-denied, module-locked, queued-job, partial-failure, and unavailable-file states where relevant.
- Server-side pagination, filtering, and appropriate tenant-scoped indexes for growing data.
- School-friendly errors; no raw Prisma, storage, provider, stack-trace, or secret leakage.

### 4.2 Security, tenancy, and persona scope

- Tenant-scoped reads, writes, jobs, exports, reports, file access, caches, and mobile responses.
- Direct cross-tenant or forbidden route/API attempts fail closed.
- Parent access is linked-child only.
- Student access is self/session-scoped only.
- Teacher access is assigned class/section/subject scoped unless explicitly permitted.
- Driver access is assigned-trip only.
- Staff self-service access is own-staff only.
- Suspended tenants are blocked across web, API, mobile, jobs, exports, files, and Learning.
- Sensitive actions require permission, confirmation, reason where policy requires it, and audit evidence.

### 4.3 Financial integrity

- Database/backend totals are the financial source of truth.
- Idempotency exists for payment, receipt, wallet, payroll, accounting, and retryable money workflows.
- Confirmed financial records use reversal/correction workflows rather than silent mutation.
- Gateway callbacks are signature-verified and tested for duplicate, delayed, failed, missing-reference, zero-amount, and already-paid cases.
- Mobile has no offline financial writes unless explicit backend idempotency and reconciliation evidence is approved.

### 4.4 Files, privacy, and lifecycle

- Every file follows `Feature module -> FileRegistryService -> StorageService -> StorageAdapter`.
- Protected file preview, download, and sharing use authenticated scoped helpers.
- No raw object key, permanent provider URL, token hash, provider credential, salary/bank value, or private payload is exposed in UI, API, logs, or client cache.
- Retention, archival, temporary-export expiry, backup, restore, and legal/financial record safeguards are documented and tested where applicable.

### 4.5 Mobile distribution size

The first SchoolOS mobile release must remain practical for Nepal's mobile-data and weaker-network conditions.

| Measure | Android | iPhone |
|---|---:|---:|
| Target store download | 20-30 MB | 25-35 MB |
| Absolute first-release store-download limit | Under 50 MB | Under 50 MB |
| Target installed size | 50-90 MB | 50-90 MB |

- Android release distribution uses an Android App Bundle (`.aab`) so Google Play can deliver device-specific files.
- Student photos, PDFs, report cards, videos, and large illustrations are not bundled in the application package.
- Protected and media files load securely only when requested; feature modules do not add large always-installed asset packs.
- Images are compressed and appropriately sized. Heavy animation/video packages require explicit release-size review.
- Module assets are lazy-loaded where the platform supports it.
- Optional persistent cache is user-controlled, limited to approved safe data, clearable, and capped at no more than 100 MB for the first release. Private cache still clears on logout/session expiry as required.
- Release-candidate evidence records the Android and iPhone store-download estimates plus installed size on representative devices. A debug APK size is not accepted as store-download evidence.
- Exceeding either platform's 50 MB store-download limit blocks the first release. Missing size evidence blocks a release-candidate or GA claim.

### 4.6 Verification and release evidence

Relevant implementation changes must run and truthfully report applicable checks:

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

For mobile changes:

```bash
cd apps/schoolos_mobile
flutter pub get
dart format .
flutter analyze
flutter test
flutter build apk --debug
flutter build ios --no-codesign
```

Local verification is necessary but insufficient for GA. GA also requires the staging, provider, browser/device, backup/restore, operational, and controlled-pilot evidence in this policy.

---

## 5. Release stages

| Stage | Meaning | Minimum proof |
|---|---|---|
| Development complete | Code and focused tests exist. | Relevant local implementation and focused verification. Not a release claim. |
| Internal QA ready | Local checks and QA scenarios are available. | Relevant lint/typecheck/unit/API E2E/contract/build evidence. |
| Staging validated | The deployable workflow works in a staging-like environment. | Applied migrations, configured environment, seeded browser E2E, provider/storage checks, and smoke evidence. |
| Controlled pilot validated | A real school can execute supported workflows with monitoring and support. | Pilot checklist, workflow evidence, feedback closure, and incident/support process. |
| Release candidate | Known GA blockers are resolved or explicitly deferred from the supported release boundary. | Rollback plan, operational readiness, recovery proof, and release checklist approval. |
| GA / Production release | Public onboarding is allowed for supported plans/modules. | All applicable gates passed, production monitoring active, and release owner approval recorded. |

---

## 6. Required environment and operational gates before GA

- Staging migrations apply successfully, with a documented rollback/recovery approach.
- Seed data supports every browser/device smoke persona and role.
- Authenticated browser E2E runs against seeded staging fixtures; public-only tests are not sufficient.
- Configured SMS, email, FCM, payment, and object-storage providers are verified in safe sandbox/staging modes.
- Production environment configuration, secret handling, health/readiness endpoints, queues, logs, monitoring, alerts, and incident procedures are validated.
- Backup and restore drills are executed and recorded.
- Release rollback procedure is documented and rehearsed.
- Daily school workflows are performed without engineering intervention in a controlled pilot.
- Mobile device QA is completed for supported personas and deep-link/permission failure paths.

---

## 7. Priority order until GA gates are satisfied

1. Security, auth, RBAC, tenant isolation, support-override, suspended-tenant, and ownership fail-closed evidence.
2. Staging deployment, migration validation, object-storage/provider checks, health/readiness, runbook, monitoring, and backup/restore proof.
3. Seeded authenticated browser E2E for daily school workflows and direct-route denial cases.
4. Real API-backed web workspace completion using shared loading/error/permission/module-locked/protected-file states.
5. Controlled-pilot smoke, support workflow, and feedback closure.
6. Flutter device QA for purpose-limited parent, teacher, staff, driver, principal, and student-session roles.
7. Performance, retention, observability, queue/retry diagnostics, recovery, and release automation.
8. New product scope only after GA blockers are understood, tracked, and do not weaken the supported release boundary.
9. Later Bachelor's design/validation only after pilot hardening, with schema, OpenAPI, shared-contract, RBAC/entitlement, tenant-isolation, student self-scope, seed, browser/mobile, staging, and release evidence.

---

## 8. Explicit non-goals until release gates permit them

```text
AI/ML/LLM runtime or open student AI chat
Angular migration
Microservice migration
Broad public student mobile application
Offline payments, wallet debits, refunds, payroll, accounting, or report-card publishing
Live transport map/WebSocket expansion without approved privacy and load validation
Provider integrations that have not passed safe sandbox/staging checks
```

---

## 9. Required implementation-report format

All implementation reports must include:

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

---

## 10. Source-of-truth relationship

- This document defines the target, release terminology, and gate policy.
- `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` owns evidence-based current readiness and scores.
- `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` owns the dependency-driven execution sequence.
- The product, functional, architecture, web, mobile, and runbook documents must follow this policy without overstating current readiness.
