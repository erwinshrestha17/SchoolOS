# SchoolOS

SchoolOS is a production-grade, multi-tenant SaaS School Operating System for Nepal, with one shared platform that supports `PRESCHOOL`, `SCHOOL`, and `HIGHER_SECONDARY` as configurable experience packs.

It is designed as a modular school operating platform covering admissions, student records, attendance, fees, academics, homework, timetable, HR/payroll, library, transport, canteen, accounting, notifications, notices, communication, chat, classroom learning, parent engagement, protected files, reporting readiness, and future intelligence/analytics.

SchoolOS is governed by a **Production / General Availability (GA)** release target, not an MVP target. Current work is focused on evidence-led internal QA, realistic seeded school workflows, authenticated browser/mobile verification, staging validation, controlled-pilot proof, and the operational gates required for a public production release.

Inventory & Asset Management is intentionally **scrapped from the active module taxonomy** until the owner explicitly re-approves it.

---

## Source of Truth

The formal source-of-truth hierarchy is:

| Artifact | Owner |
|---|---|
| BRD | `docs/product/SCHOOLOS_BRD.md` |
| PRD | `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` |
| FRS | `docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md` |
| SRS | `docs/requirements/SCHOOLOS_SRS.md` |
| SDD | `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` |
| MDD | `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md` |

The consolidated active documentation set is:

```text
README.md
AGENTS.md
docs/README.md

docs/product/SCHOOLOS_BRD.md
docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md
docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md
docs/product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md
docs/requirements/SCHOOLOS_SRS.md

docs/project/SCHOOLOS_PROJECT_STATUS.md
docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md
docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md
docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md
docs/project/SCHOOLOS_DOCUMENTATION_INVENTORY.md

docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md
docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md
docs/architecture/SCHOOLOS_NAMING_CONVENTIONS.md
docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md
docs/architecture/SCHOOLOS_NOTIFICATION_ARCHITECTURE.md

docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md
docs/design/modules/README.md


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
SchoolOS Operations = library, transport, canteen, HR/payroll, and finance workflows
SchoolOS Notification Module = central notification inbox, events, templates, delivery routing, retries, preferences, read state, and audit
SchoolOS Communication = notices, parent-teacher communication, chat, delivery logs, moderation, and emergency messaging
SchoolOS Learning Layer = improves classroom teaching and student learning inside school
SchoolOS Intelligence = future teacher-reviewed analytics and safe AI after reliable production data exists
```

Cross-surface product allocation is defined in `docs/product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md`: backend owns official truth and workflow rules, web is the school operating desk, and mobile remains purpose-limited and persona-first.

SchoolOS uses one shared tenant-aware core plus configurable experience packs:

```text
PRESCHOOL
  Montessori, Nursery, LKG, UKG

SCHOOL
  Grade 1-10

HIGHER_SECONDARY
  Grade 11-12 / +2
```

Do not build separate preschool, school, and +2 products, databases, mobile apps, or student record systems. The current management modules remain the foundation. The Learning Layer is a separate domain that reuses existing students, teachers, classes, subjects, timetable, communication, File Registry, audit, RBAC, and tenant isolation. The Notification Module is explicit product scope and is not Intelligence/AI.

---

## Active Module Taxonomy

| Module | Name | Status |
|---|---|---|
| M0 | Platform Core | Implemented, unverified |
| M1 | Admissions and Student Profiles | Implemented, unverified |
| M2 | Smart Attendance | Implemented, unverified |
| M3 | Fees and Receipts | Implemented, unverified |
| M4 | Academics, Exams, CAS, Report Cards | Implemented, unverified |
| M5 | Activity Feed and Milestones | Implemented, unverified |
| M6 | Homework and Timetable | Implemented, unverified |
| M7 | HR and Payroll | Implemented, unverified |
| M8 | Library | Implemented, unverified |
| M9 | Transport | Implemented, unverified |
| M10 | Canteen | Implemented, unverified |
| M11 | Accounting and Finance | Implemented, unverified |
| M12 | Notifications, Notices, Communication, Chat | Implemented, unverified |
| M13 | Learning Layer | Implemented, unverified |
| M14 | Intelligence / AI | Deferred |

Do not use `M8A`, `M8B`, or `M8C` as active module numbers. Library, Transport, and Canteen are standalone modules.

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
Default seeded tenant and role-assignment proof: In progress; current seed worktree requires idempotency/scope verification before pilot claims
Authenticated browser E2E: Partially implemented; latest audited run passed public checks but skipped authenticated checks
Mobile role flows: Partially implemented; Flutter analyze/tests/APK build pass, but Android emulator role-flow QA against seeded backend is pending
Staging/provider/storage/backup/restore verification: Blocked until staging environment and real credentials/procedures are executed
Notification Module: Architecture documented; implementation/readiness claims still require code, provider, queue, browser, mobile, and staging evidence
M13 Learning Layer: Implemented foundation; staging/browser/device depth remains staged
M14 Intelligence/AI: Roadmap only
Stage-aware expansion: Preschool, School (Grade 1-10), and Higher Secondary / +2 product direction is documented; stage resolver, +2 streams, and advanced learning features remain staged future scope
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
- 2026-06-21: pnpm smoke:pilot passed after local Docker Postgres/Redis/API were running and seed idempotency was fixed.
- pnpm test:web:e2e passed with 5 public checks and 12 authenticated checks skipped.
```
