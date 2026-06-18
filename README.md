# SchoolOS

SchoolOS is a production-grade, multi-tenant SaaS School Operating System for Nepal, with a staged product direction from Kindergarten / Montessori to Grade 12.

It is designed as a modular school operating platform covering admissions, student records, attendance, fees, notices, activity feed, academics, homework, timetable, HR/payroll, accounting, library, transport, canteen, classroom learning, parent engagement, and future intelligence/analytics.

SchoolOS is now governed by a **Production / General Availability (GA)** release target, not an MVP target. Current work is focused on evidence-led internal QA, realistic seeded school workflows, authenticated browser/mobile verification, staging validation, controlled-pilot proof, and the operational gates required for a public production release. M12 Learning Layer has a broad backend/web/mobile foundation; KG-12 breadth and deeper learning experiences remain staged expansion goals, not a claim that every KG-12 feature is already implemented.

---

## Source of Truth

The consolidated active documentation set is:

```text
README.md
AGENTS.md
docs/README.md

docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md
docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md

docs/project/SCHOOLOS_PROJECT_STATUS.md
docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md
docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md
docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md

docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md
docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md

docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md

docs/production/SCHOOLOS_GA_RELEASE_POLICY.md
docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md

apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md
apps/web/e2e/README.md
```

Historical/duplicate docs should not be recreated unless the project owner explicitly approves a new source-of-truth split.

---

## Product Direction

```text
SchoolOS Core Management = runs daily school operations
SchoolOS Academics = manages classes, subjects, timetable, homework, exams, reports, streams, projects, and practicals
SchoolOS Advanced Operations = pre-AI automation, approvals, analytics, mobile/offline reliability, document templates, and Nepal-specific operational depth
SchoolOS Learning Layer = improves classroom teaching and student learning inside school
SchoolOS Intelligence = future teacher-reviewed analytics and safe AI after reliable production data exists
```

KG-12 expansion must be staged:

```text
Stage A: Kindergarten / ECD / Montessori
Stage B: Grade 1-3
Stage C: Grade 4-5
Stage D: Grade 6-8
Stage E: Grade 9-10
Stage F: Grade 11-12
```

The current management modules remain the foundation. The Learning Layer is implemented as a separate M12 domain that reuses existing students, teachers, classes, subjects, timetable, communication, File Registry, audit, RBAC, and tenant isolation.

---

## Current Release Stage

Release terminology and GA gates are defined by `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`. The evidence-based current state remains in `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`.

```text
Target release stage: GA / Production release
Current evidenced release stage: Internal QA ready
Next required release gate: Staging validated
Controlled-pilot status: Not yet validated
GA / public production release: Not achieved
```

Current evidence:

```text
Local API/web/mobile foundations: Implemented with passing local unit, E2E, contract, build, and Flutter gates as recorded in docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md
Default seeded tenant and role-assignment proof: In progress; current seed worktree is dirty and requires idempotency/scope verification before pilot claims
Authenticated browser E2E: Partially implemented; latest audited run passed public checks but skipped authenticated checks
Mobile role flows: Partially implemented; Flutter analyze/tests/APK build pass, but Android emulator role-flow QA against seeded backend is pending
Staging/provider/storage/backup/restore verification: Blocked until staging environment and real credentials/procedures are executed
M11 Intelligence/AI: Roadmap only
M12 Learning Layer: Implemented foundation; staging/browser/device depth remains staged
KG-12 Expansion: Product direction added; Grade 11-12 and advanced learning features are staged future scope
```

Latest audited local verification snapshot:

```text
2026-06-18: Root local gates passed:
- pnpm db:generate
- pnpm db:validate
- pnpm verify:openapi
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm test:e2e
- pnpm build
- pnpm verify:production

Important caveats:
- pnpm smoke:pilot failed because local Postgres, Redis, and API were not running.
- pnpm test:web:e2e passed with 5 public checks and 12 authenticated checks skipped.
- DEPLOY_ENV=production pnpm verify:env:deploy failed because production secrets/origins were not configured in this local shell.
- Flutter analyze/test/debug APK build passed, but no emulator role-flow QA was run.
```

Current product readiness:

```text
Product Implementation Completion Score: 74 / 100
Production Deployment Readiness Score: 50 / 100
Current evidenced release stage: Internal QA ready
Staging validated: No
Controlled pilot validated: No
Release candidate: No
GA / Production release: No
Single-school production-ready: No
Multi-school production-ready: No
Full KG-12 SchoolOS product complete: No
```

---

## Edge Case Hardening Checklist

The detailed source of truth for edge cases remains the PRD and FRS module sections. This repo-level checklist must be used before claiming controlled pilot validation, release-candidate status, production readiness, or GA release.

### Global edge cases

- Every tenant-owned database query, file lookup, export, report, queue job, cache read, and background retry must be scoped by authenticated `tenantId`.
- School A must never access School B students, guardians, staff, fees, receipts, payroll, files, reports, notices, transport, canteen, library, learning, or analytics data.
- Same names, phone numbers, admission numbers, receipt numbers, file names, payment references, QR identifiers, activity codes, or session codes across tenants must never cause cross-tenant leakage.
- Suspended tenants must be blocked across dashboard, API, mobile, background jobs, file downloads, report generation, exports, provider actions, and learning sessions.
- Disabled feature routes must fail closed even if opened directly by URL.
- Parent, student, driver, and mobile APIs must be purpose-limited and must not expose admin-shaped responses.
- Expired sessions, slow network retries, refreshes, and double-clicks must not duplicate writes.
- Long forms should preserve drafts where practical and recover safely after login/session renewal.
- Offline or reconnect sync must show deterministic conflict handling instead of silently overwriting server data.
- Background jobs must re-check tenant status, feature status, entity status, permission state, and provider state before executing.
- Retried jobs must not duplicate payments, receipts, messages, notices, reports, exports, payroll postings, accounting entries, canteen/library transactions, or learning attempts.
- Failed jobs, failed exports, failed storage operations, and failed provider actions must expose safe diagnostics without secrets.
- Sensitive actions must be audited with actor, tenant, timestamp, reason, and before/after context where practical.

### Authentication, role, and access edge cases

- Parent can only access currently linked children.
- Guardian removal or replacement must immediately revoke old parent access to child data, messages, files, notices, receipts, report cards, media, and learning summaries.
- Student can only access their own allowed records.
- Teachers can access only assigned classes/subjects/students unless explicit permissions allow broader access.
- Drivers can access only assigned trips.
- Staff self-service can access own staff data only.
- Platform support access requires explicit audited override.
