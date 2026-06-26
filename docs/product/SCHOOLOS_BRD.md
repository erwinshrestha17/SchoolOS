# SchoolOS Business Requirements Document

**Status:** Canonical BRD
**Owner/audience:** CEO, school owner/principal, preschool owner, finance lead, product leadership, sales/support leadership
**Scope:** Business case, buyer personas, Nepal market fit, packaging direction, stage-aware rollout, business risks, and success metrics for one multi-tenant SchoolOS platform.
**Precedence:** Business intent only. Product scope is owned by `SCHOOLOS_PRODUCT_REQUIREMENTS.md`; functional behavior by `SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`; current readiness by `../project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`; release stage policy by `../production/SCHOOLOS_GA_RELEASE_POLICY.md`.
**Inputs/source documents:** `README.md`, `../README.md`, `SCHOOLOS_PRODUCT_REQUIREMENTS.md`, `SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`, `SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md`, `../project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`, `../project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`, `../architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md`, `../design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`, `../design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md`.
**Out-of-scope content:** API contracts, Prisma schema design, screen layouts, implementation status, staging proof, pricing numbers, legal contract terms, and GA readiness claims.
**Last reviewed date:** 2026-06-26

---

## 1. Business Decision

SchoolOS is one Nepal-first multi-tenant education operating SaaS for four active education focus areas:

```text
One SchoolOS platform
+ shared tenant-aware core
+ Preschool experience pack
+ School (Grade 1-10) experience pack
+ Higher Secondary / +2 experience pack
+ Bachelor's higher-education product direction
+ shared Web application
+ shared Flutter companion app
```

SchoolOS must not become separate products, databases, apps, tenant boundaries, or student systems for Preschool, School, +2, Bachelor's, or future Master's eligibility. The business advantage is a single shared tenant-aware core that supports Montessori through Grade 12 today and grows toward higher education through approved schema/contracts, not parallel platforms.

Master's is not an active full institution-management pack. It is only a future higher-education extension and an allowed Student App eligibility level for enrolled Master's students after backend eligibility, enrollment, entitlement, role, self-scope, and tenant checks are designed and verified.

Current evidenced release stage remains **Internal QA ready**. This BRD does not upgrade readiness.

## 2. Target Segments

| Segment | Business need | SchoolOS fit |
|---|---|---|
| Preschool / Montessori / Nursery / LKG / UKG | Trust, child safety, parent visibility, simple teacher workflow, admissions, fees, staff/classroom coverage. | Preschool experience pack over shared students, guardians, attendance, activity, milestones, notices, fees, files, and mobile companion. |
| School Grade 1-10 | Daily operations, attendance, homework, timetable, exams, CAS, report cards, library, transport, canteen, parent communication. | School experience pack over shared academic, operations, finance, communication, and reporting modules. |
| Higher Secondary / +2 | Streams/programs, subject combinations, practicals, projects, labs, internal assessment, board readiness, parent/student controlled visibility. | Higher Secondary experience pack extending shared academics, timetable, exams, staff assignment, reports, files, and communication without a parallel platform. |
| Bachelor's-level institutions/programs | Configurable programs, departments, intakes/batches, semesters/terms, courses, faculty assignment, attendance, timetable, assignments, exams/results, fees, notices, library, and future student self-service. | Active higher-education product direction only; schema/API/UI/workflows remain **PROPOSED / NEEDS_SCHEMA_DESIGN** until verified. |
| Multi-branch or growing school groups | Tenant isolation, common operating discipline, role separation, reporting, platform support. | Multi-tenant SaaS with `tenantId` boundary, platform control plane, school configuration plane, and daily operations plane. |

## 3. Buyer And User Personas

| Persona | Buying or adoption driver | Non-negotiable concern |
|---|---|---|
| School owner / principal | Better control, parent trust, reporting confidence, collections visibility, fewer operational surprises. | Must see exception-focused, accurate, permission-safe information. |
| Preschool owner | Child safety, authorized pickup, parent confidence, simple classroom updates. | Must avoid heavy school-grade exam workflows and harsh child labels. |
| School administrator / receptionist | Faster admissions, student/guardian records, attendance follow-up, notices, documents. | Needs one reliable source of truth and friendly unavailable states when a module is locked. |
| Accountant / cashier | Accurate invoices, receipts, reversals, cashier close, audit, handoff to accounting. | No browser/mobile financial truth and no silent mutation of confirmed money records. |
| Teacher | Fast assigned-class attendance, homework, observations, parent updates, marks where applicable. | Mobile must be task-first, assigned-scope, and not an admin dashboard. |
| Parent / guardian | Linked-child attendance, fees, receipts, notices, activity, milestones, report cards, transport where enabled. | Must never expose another child or unsafe private media. |
| Academic coordinator / exam head | Timetable, homework, assessments, marks, report-card readiness, +2 practical/project readiness. | Needs configurable academic structure, not hard-coded streams or grade assumptions. |
| SchoolOS operator / support | Tenant setup, subscriptions, provider readiness, queue health, support override, audit. | Platform controls must not mix with school operations or school fee collection. |
| Future Bachelor/Master student | Self-service access to own profile, enrollment, timetable, attendance, assignments, published results, notices, fees/receipts, library status, documents, and support requests where approved. | Must be self-only, active-enrollment-scoped, tenant-scoped, module-entitlement-scoped, and backend-authorized; no admin or other-student access. |

## 4. Value Proposition

SchoolOS sells operational confidence:

- One tenant-aware student record, guardian relationship, enrollment history, fee ledger, attendance record, communication trail, file registry, and audit trail.
- Preschool child-safety workflows without forcing heavy academic screens.
- School Grade 1-10 academic and operational workflows in one operating desk.
- Higher Secondary / +2 support through configurable programs, streams, subject combinations, practicals, projects, and board-readiness workflows.
- Bachelor's is an approved higher-education product direction, but runtime work requires schema, OpenAPI, shared-contract, RBAC, entitlement, tenant-isolation, seed, browser/mobile, and staging proof before implementation claims.
- Broad Student App access is permitted only for active Bachelor or Master enrollments. Preschool, Grade 1-10, and +2 students may use only approved controlled learning/session flows.
- Parent trust through child-scoped mobile visibility and consent-safe updates.
- Finance trust through backend-owned totals, idempotent writes, reversals, receipts, cashier close, and accounting handoff.
- Operator trust through release gates, tenant isolation, provider readiness, backup/restore, monitoring, and support override audit.

## 5. Business Requirements

| ID | Requirement | Rationale |
|---|---|---|
| BRD-01 | SchoolOS must support `PRESCHOOL`, `SCHOOL`, `HIGHER_SECONDARY`, and `BACHELOR` through one shared core and configurable experience direction. | Avoid fragmented products and duplicate records while supporting real market differences. |
| BRD-02 | The official user-facing label for Grade 1-10 is `School (Grade 1-10)`. | Avoid using "Primary" as a universal system label for grades it does not cover. |
| BRD-03 | Preschool positioning must emphasize child safety, safe handover, parent trust, daily care/activity visibility, teacher simplicity, admissions, fees, and developmental milestones. | Preschool buyers evaluate trust and safety before dense academics. |
| BRD-04 | School Grade 1-10 positioning must emphasize attendance, timetable, homework, exams, marks, CAS, report cards, parent communication, fees, and operations. | This is the daily school operating core. |
| BRD-05 | Higher Secondary / +2 positioning must emphasize programs/streams, subject combinations, theory/practical timetables, labs, projects, internal assessment, mock exams, and board readiness. | +2 schools need academic flexibility without a separate platform. |
| BRD-06 | Mobile must remain one Flutter companion app with persona-first flows. | Separate app binaries increase support, release, QA, and data-boundary risk. |
| BRD-07 | Release status must remain evidence-based and must not be upgraded by documentation improvements. | Protects buyer trust and internal planning discipline. |
| BRD-08 | M14 Intelligence / AI remains roadmap-only until production data, privacy, audit, safety, human-review, and cost controls are approved. | Prevents premature high-risk product claims. |
| BRD-09 | Bachelor's runtime work must stay proposed until schema, OpenAPI, shared contracts, RBAC/entitlement, tenant isolation, seed, tests, browser/mobile, and staging proof exist. | Prevents higher-education scope from bypassing current pilot and GA blockers. |
| BRD-10 | Master's must remain eligibility/future-extension only until separately approved as a full management pack. | Prevents accidental Master's administration, finance, faculty, and course-management scope. |

## 6. Packaging Direction

Packaging is conceptual until pricing is approved.

| Package axis | Direction |
|---|---|
| Experience packs | `PRESCHOOL`, `SCHOOL`, `HIGHER_SECONDARY`, and future `BACHELOR`; a tenant may enable one or more only after backend contracts and entitlement design exist. |
| Core modules | M0-M7 and M12 are likely baseline for most supported schools, subject to entitlement policy. |
| Operations modules | Library, Transport, Canteen, Accounting, Learning, and advanced operations can be entitlement-controlled. |
| Mobile | Included as one companion app; persona capabilities are controlled by backend entitlement, role, scope, and capability. |
| Student App | Broad Student App is future-approved only for active Bachelor or Master enrollments; Preschool through +2 remain controlled-session-only. |
| Providers | SMS, email, push, payment, and storage modes must be explicit as disabled, log/dev, mock, sandbox, or configured. |
| Support | Support override must be reasoned, expiring where supported, and audited. |

SchoolOS SaaS billing remains separate from school fee collection and school accounting.

## 7. Stage-Based Go-To-Market

| Stage | Business objective | Minimum proof before external claim |
|---|---|---|
| Internal QA ready | Stabilize local workflows and documentation source of truth. | Local gates recorded in the readiness audit. |
| Staging validated | Demonstrate deployable workflows in a staging-like environment. | Migration apply, health/readiness, provider/storage modes, authenticated browser smoke, mobile QA, backup/restore evidence. |
| Controlled pilot validated | Prove one school can run agreed workflows with support. | Pilot workflow evidence, incident/support process, backup/rollback readiness, no open P0/P1 school-safety/finance/tenant defects. |
| Release candidate | Freeze supported release boundary and close GA blockers. | Release checklist approval and rollback/recovery proof. |
| GA / Production release | Public onboarding for supported plans/modules. | GA policy gates complete and release owner approval recorded. |

## 8. Business Success Metrics

| Metric | Target direction |
|---|---|
| Pilot workflow completion | One school completes agreed workflows without engineering intervention. |
| Parent trust | Parents can find linked-child notices, attendance, fees, receipts, activity, and stage-appropriate updates without support help. |
| Preschool safety visibility | Leadership can see uncollected children, pickup exceptions, attendance gaps, care alerts, and unresolved concerns. |
| Finance correctness | No unresolved duplicate receipt/payment, silent mutation, or client-calculated official total defect. |
| Teacher adoption | Teachers can complete assigned daily mobile/web tasks quickly and safely. |
| Operational reliability | Staging smoke, provider modes, queues, backup/restore, monitoring, and rollback are recorded. |
| Support burden | Common tenant setup, role, provider, and module-lock questions are diagnosable from platform operations. |

## 9. Business Risks

| Risk | Mitigation owner |
|---|---|
| Overclaiming readiness before staging/pilot proof | GA release policy and readiness audit remain authoritative. |
| Trying to build three products | PRD, FRS, SRS, and architecture enforce one shared core plus experience packs. |
| Preschool workflow becoming too academic-heavy | Preschool scope explicitly excludes heavy marks grids, ranking, harsh labels, broad child app, and mandatory detailed care logs. |
| +2 workflows becoming hard-coded | SRS/MDD require school-configurable programs, streams, subject combinations, practicals, and projects. |
| Bachelor's/Master's overclaiming | Mark Bachelor's as proposed until contract proof exists; keep Master's eligibility-only. |
| Financial or child-data trust failure | Backend authorization, Decimal/database totals, audit, File Registry, and narrow permission scopes are mandatory. |
| Support/ops cannot run the product | Production runbook, platform operations, monitoring, provider readiness, backup/restore, and support override evidence are GA gates. |
