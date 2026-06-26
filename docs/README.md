# SchoolOS Documentation

**Status:** Active documentation map and GA release-governance index
**Last updated:** 2026-06-26

This folder contains the active detailed SchoolOS documentation. Use this page as the folder-level map only; the root `README.md` remains the repository entry point and source-of-truth summary.

SchoolOS is governed by a Production / General Availability (GA) release target, not an MVP target. Current work is evidence-led internal QA hardening, seeded school workflow proof, authenticated browser/mobile verification, staging validation, controlled-pilot validation, and release-operational readiness.

Active education focus is `PRESCHOOL`, `SCHOOL` (Grade 1-10), `HIGHER_SECONDARY` (+2 / Grade 11-12), and `BACHELOR` over one shared tenant-aware core. Master's is not a full active institution-management pack; it is a future extension and an allowed Student App eligibility level only. Documentation updates must not claim Bachelor or Master's runtime implementation without code and verification evidence.

Inventory & Asset Management is not an active module. Do not recreate Inventory documentation unless the project owner explicitly re-approves that module.

---

## Active Module Numbering

| Module | Name |
|---|---|
| M0 | Platform Core |
| M1 | Admissions and Student Profiles |
| M2 | Smart Attendance |
| M3 | Fees and Receipts |
| M3B | IRD Billing Compliance extension |
| M4 | Academics, Exams, CAS, Report Cards |
| M5 | Activity Feed and Milestones |
| M6 | Homework and Timetable |
| M7 | HR and Payroll |
| M8 | Library |
| M9 | Transport |
| M10 | Canteen |
| M11 | Accounting and Finance |
| M12 | Notifications, Notices, Communication, Chat |
| M13 | Learning Layer |
| M14 | Intelligence / AI |
| M15 | Education Compliance |

`M8A`, `M8B`, and `M8C` are obsolete labels. Library, Transport, and Canteen have standalone module numbers.

M3B is an M3 extension for formal and IRD-compliance-ready billing. M15 is a planned compliance module for iEMIS, UGC/HEMIS-ready reporting, QAA readiness, validation, exports, and submission history. M14 Intelligence / AI remains deferred.

---

## Read Order

| Order | Document | Purpose |
|---:|---|---|
| 1 | `../README.md` | Project summary, module taxonomy, release stage, readiness boundaries, and active source-of-truth set. |
| 2 | `../AGENTS.md` | Agent/developer operating rules, GA-oriented delivery target, security rules, architecture rules, naming rules, and verification commands. |
| 3 | `production/SCHOOLOS_GA_RELEASE_POLICY.md` | Canonical release terminology, stage definitions, GA gates, non-goals, and required reporting format. |
| 4 | `project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` | Canonical evidence-based readiness audit, scores, command results, blockers, and documentation inventory. |
| 5 | `project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` | Focused dependency-driven execution plan from internal QA through staging, controlled pilot, release candidate, and production readiness. |
| 6 | `product/SCHOOLOS_BRD.md` | Canonical BRD: business case, Nepal market, buyer personas, packaging direction, stage-based go-to-market, and business risks. |
| 7 | `product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` | Canonical PRD: product vision, stage-aware experience model, capability matrices, user journeys, and product boundaries. |
| 8 | `product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md` | Canonical FRS: feature behavior, validations, state transitions, workflow diagrams, edge cases, and acceptance criteria. |
| 9 | `product/SCHOOLOS_EDUCATION_COMPLIANCE_IRD_BILLING_SPEC.md` | Canonical companion specification for M15 Education Compliance and M3B IRD Billing Compliance until absorbed into the PRD/FRS/SRS/SDD. |
| 10 | `requirements/SCHOOLOS_SRS.md` | Canonical SRS: software, non-functional, API, web, mobile, database, security, performance, and operational requirements. |
| 11 | `architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` | Canonical SDD: architecture, storage, File Registry, tenant isolation, scaling, performance, and security architecture. |
| 12 | `architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md` | Canonical MDD: module ownership, stage matrix, code-evidence gap matrix, and stage-aware architecture roadmap. |
| 13 | `product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md` | Backend/web/mobile allocation, allowed roles, and explicit surface boundaries. |
| 14 | `project/SCHOOLOS_DOCUMENTATION_INVENTORY.md` | Complete tracked Markdown inventory and consolidation decisions. |
| 15 | `project/SCHOOLOS_PROJECT_STATUS.md` | Current implementation status snapshot; should summarize, not replace, the audit. |
| 16 | `project/SCHOOLOS_IMPLEMENTATION_PLAN.md` | Longer implementation backlog and module detail; execution priority is governed by the next-phase plan and GA policy. |
| 17 | `architecture/SCHOOLOS_NAMING_CONVENTIONS.md` | Canonical vocabulary plus naming for files, folders, routes, DTOs, schema values, contracts, web, and mobile. |
| 18 | `architecture/SCHOOLOS_PLATFORM_OPERATIONS.md` | Platform control plane, tenant configuration boundaries, SaaS billing, and provider/queue operations. |
| 19 | `architecture/SCHOOLOS_NOTIFICATION_ARCHITECTURE.md` | M12 notification events, delivery, preferences, retries, provider operations, notification center, notices, chat, and audit behavior. |
| 20 | `design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` | Active web frontend design, UI/UX, components, route behavior, API usage, and web persona smoke plan. |
| 21 | `design/modules/README.md` | M1-M13 module-level frontend design reference index plus approved planned compliance references. |
| 22 | `implementation/WEB_UI_API_ALIGNMENT_AUDIT.md` | Active implementation alignment audit and contract-safe reference-screen implementation guidance. |
| 23 | `design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md` | Active Flutter mobile app UI/UX, persona flows, mobile wireframes, API/offline rules, and mobile smoke plan. |
| 24 | `production/SCHOOLOS_PRODUCTION_RUNBOOK.md` | Deployment, environment, backup/restore, pilot onboarding, rollback, and go/no-go procedures. Procedures are not proof unless executed. |

---

## Active Docs

### M1-M13 Frontend Web Design References and Planned Compliance References

| Module | Reference |
|---|---|
| M1 Admissions and Student Profiles | [M1 frontend reference](design/modules/M1_ADMISSIONS_STUDENT_PROFILES_FRONTEND_REFERENCE.md) |
| M2 Smart Attendance | [M2 frontend reference](design/modules/M2_SMART_ATTENDANCE_FRONTEND_REFERENCE.md) |
| M3 Fees and Receipts | [M3 frontend reference](design/modules/M3_FEES_RECEIPTS_FRONTEND_REFERENCE.md) |
| M3B IRD Billing Compliance extension | [M3B frontend reference](design/modules/M3B_IRD_BILLING_COMPLIANCE_FRONTEND_REFERENCE.md) |
| M4 Academics, Exams, CAS, Report Cards | [M4 frontend reference](design/modules/M4_ACADEMICS_EXAMS_REPORT_CARDS_FRONTEND_REFERENCE.md) |
| M5 Activity Feed and Milestones | [M5 frontend reference](design/modules/M5_ACTIVITY_FEED_MILESTONES_FRONTEND_REFERENCE.md) |
| M6 Homework and Timetable | [M6 frontend reference](design/modules/M6_HOMEWORK_TIMETABLE_FRONTEND_REFERENCE.md) |
| M7 HR and Payroll | [M7 frontend reference](design/modules/M7_HR_PAYROLL_FRONTEND_REFERENCE.md) |
| M8 Library | [M8 frontend reference](design/modules/M8_LIBRARY_FRONTEND_REFERENCE.md) |
| M9 Transport | [M9 frontend reference](design/modules/M9_TRANSPORT_FRONTEND_REFERENCE.md) |
| M10 Canteen | [M10 frontend reference](design/modules/M10_CANTEEN_FRONTEND_REFERENCE.md) |
| M11 Accounting and Finance | [M11 frontend reference](design/modules/M11_ACCOUNTING_FINANCE_FRONTEND_REFERENCE.md) |
| M12 Notifications, Notices, Communication, Chat | [M12 frontend reference](design/modules/M12_NOTIFICATIONS_COMMUNICATION_FRONTEND_REFERENCE.md) |
| M13 Learning Layer | [M13 frontend reference](design/modules/M13_LEARNING_LAYER_FRONTEND_REFERENCE.md) |
| M15 Education Compliance | [M15 frontend reference](design/modules/M15_EDUCATION_COMPLIANCE_FRONTEND_REFERENCE.md) |

```text
README.md
product/SCHOOLOS_BRD.md
product/SCHOOLOS_PRODUCT_REQUIREMENTS.md
product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md
product/SCHOOLOS_EDUCATION_COMPLIANCE_IRD_BILLING_SPEC.md
product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md
requirements/SCHOOLOS_SRS.md
project/SCHOOLOS_PROJECT_STATUS.md
project/SCHOOLOS_IMPLEMENTATION_PLAN.md
project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md
project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md
project/SCHOOLOS_DOCUMENTATION_INVENTORY.md
architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md
architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md
architecture/SCHOOLOS_NAMING_CONVENTIONS.md
architecture/SCHOOLOS_PLATFORM_OPERATIONS.md
architecture/SCHOOLOS_NOTIFICATION_ARCHITECTURE.md
design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
design/modules/README.md
design/modules/M1_ADMISSIONS_STUDENT_PROFILES_FRONTEND_REFERENCE.md
design/modules/M2_SMART_ATTENDANCE_FRONTEND_REFERENCE.md
design/modules/M3_FEES_RECEIPTS_FRONTEND_REFERENCE.md
design/modules/M3B_IRD_BILLING_COMPLIANCE_FRONTEND_REFERENCE.md
design/modules/M4_ACADEMICS_EXAMS_REPORT_CARDS_FRONTEND_REFERENCE.md
design/modules/M5_ACTIVITY_FEED_MILESTONES_FRONTEND_REFERENCE.md
design/modules/M6_HOMEWORK_TIMETABLE_FRONTEND_REFERENCE.md
design/modules/M7_HR_PAYROLL_FRONTEND_REFERENCE.md
design/modules/M8_LIBRARY_FRONTEND_REFERENCE.md
design/modules/M9_TRANSPORT_FRONTEND_REFERENCE.md
design/modules/M10_CANTEEN_FRONTEND_REFERENCE.md
design/modules/M11_ACCOUNTING_FINANCE_FRONTEND_REFERENCE.md
design/modules/M12_NOTIFICATIONS_COMMUNICATION_FRONTEND_REFERENCE.md
design/modules/M13_LEARNING_LAYER_FRONTEND_REFERENCE.md
design/modules/M15_EDUCATION_COMPLIANCE_FRONTEND_REFERENCE.md
implementation/WEB_UI_API_ALIGNMENT_AUDIT.md
design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md
production/SCHOOLOS_GA_RELEASE_POLICY.md
production/SCHOOLOS_PRODUCTION_RUNBOOK.md
```

App-specific active docs outside this folder:

```text
apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md
apps/web/AGENTS.md
apps/web/e2e/README.md
```

Archived supporting references:

```text
archive/design/HOSTEL_WEB_REFERENCE_ANALYSIS_RETIRED.md
archive/design/design-qa.md
archive/design/SCHOOLOS_DASHBOARD_AND_M1_REFERENCE_SCREENS.md
archive/design/M4_ACADEMICS_WEB_REFERENCE_SPEC.md
archive/design/M6_HOMEWORK_TIMETABLE_WEB_REFERENCE_ANALYSIS.md
archive/design/SCHOOLOS_M7_HR_PAYROLL_WEB_DESIGN_REFERENCE.md
archive/design/M9_TRANSPORT_WEB_REFERENCE_ANALYSIS.md
archive/design/M10_CANTEEN_WEB_REFERENCE_ANALYSIS.md
archive/design/M11_ACCOUNTING_WEB_REFERENCE_ANALYSIS.md
archive/design/M12_COMMUNICATION_WEB_REFERENCE_ANALYSIS.md
archive/design/decisions/2026-06-19-m2-attendance-web-reference.md
archive/implementation/M4_ACADEMICS_FRONTEND_EXECUTION_PLAN.md
archive/project/M6_HOMEWORK_TIMETABLE_FRONTEND_IMPLEMENTATION_CHECKLIST.md
archive/project/M10_CANTEEN_FRONTEND_IMPLEMENTATION_CHECKLIST.md
archive/project/checklists/2026-06-19-m2-attendance-frontend-delivery-checklist.md
archive/web/modules/README.md
archive/web/modules/M8_LIBRARY_FRONTEND_IMPLEMENTATION_GUIDE.md
```

---

## Source-of-Truth Ownership

| Topic | Canonical Document | Audience |
|---|---|---|
| Production / GA target, release stages, and required gates | `production/SCHOOLOS_GA_RELEASE_POLICY.md` | Product, engineering, QA, deployment owner |
| Current readiness evidence and scores | `project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` | Product, engineering, deployment owner |
| Next development sequence | `project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` | Engineering team |
| Business requirements | `product/SCHOOLOS_BRD.md` | Executive, product, sales/support, school owner/principal |
| Product scope and module taxonomy | `product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` | Product, engineering |
| Functional behavior | `product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md` | Engineering, QA |
| M15 Education Compliance and M3B IRD Billing Compliance companion scope | `product/SCHOOLOS_EDUCATION_COMPLIANCE_IRD_BILLING_SPEC.md` | Product, finance, compliance advisor, engineering, QA |
| Software and non-functional requirements | `requirements/SCHOOLOS_SRS.md` | Engineering, security, QA, SRE |
| Module design and code-evidence gap matrix | `architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md` | Product, architecture, engineering, QA |
| Documentation inventory and consolidation decisions | `project/SCHOOLOS_DOCUMENTATION_INVENTORY.md` | Documentation owner, maintainers |
| Backend/web/mobile feature allocation and role/surface boundaries | `product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md` | Product, engineering, design, QA |
| Architecture/security rules | `architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` | Engineering, security |
| Naming conventions and canonical vocabulary | `architecture/SCHOOLOS_NAMING_CONVENTIONS.md` | Engineering, QA, coding agents |
| Platform operations boundary | `architecture/SCHOOLOS_PLATFORM_OPERATIONS.md` | Platform/admin engineers |
| M12 notification events, delivery, preferences, retry, audit, and notification center | `architecture/SCHOOLOS_NOTIFICATION_ARCHITECTURE.md` | Product, engineering, QA, platform/admin engineers |
| Web UI and state rules | `design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` | Web engineers |
| M1-M13 module-level frontend design details and planned M3B/M15 compliance design details | `design/modules/README.md` and matching module file | Product, design, web engineers, QA, Codex agents |
| Mobile companion app rules | `design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md` | Mobile engineers |
| Deployment and recovery procedure | `production/SCHOOLOS_PRODUCTION_RUNBOOK.md` | Deployment/operator team |
| Historical/superseded docs | `archive/README.md` | Maintainers |

---

## Deprecated or Merged References

The old combined web/mobile planning reference `docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md` is not an active document. Use the separate web and mobile design plans plus the next-phase delivery plan.

The one-off web reference/specification files from the 2026-06-19 implementation pass were consolidated into `design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` and matching files under `design/modules/` on 2026-06-21, then archived. Do not read archived copies as current source of truth.

Any `M8A`, `M8B`, or `M8C` reference is legacy numbering and must be normalized to M8 Library, M9 Transport, or M10 Canteen when touched.

The generated/tool-cache Markdown file `.cache/corepack/v1/pnpm/10.12.1/README.md` is not repository documentation and should not be linked from active docs.

---

## Cleanup Rules

1. Do not add a new `.md` file if the content belongs inside an active source-of-truth doc, unless the owner explicitly approves a supporting visual-reference appendix, module reference, or architecture companion and its relationship to the canonical doc is recorded here.
2. `production/SCHOOLOS_GA_RELEASE_POLICY.md` is an approved canonical release-governance document; do not duplicate or fork its stage definitions in new docs.
3. Do not recreate planning-only docs that conflict with current implementation status.
4. Keep old duplicated planning content in git history rather than active repo docs.
5. Keep `docs/design` limited to the source-of-truth design plans and owner-approved supporting reference appendices/module references; do not add new design docs without owner approval and an index update here.
6. Web design belongs in `design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`; module-level design details belong in `design/modules/` and must defer to backend/OpenAPI contracts.
7. Mobile app design belongs in `design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md`.
8. Release evidence and scores belong in `project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`.
9. Forward execution sequencing belongs in `project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`.
10. Production / GA terms, stages, and exit gates belong in `production/SCHOOLOS_GA_RELEASE_POLICY.md`.
11. Module-specific product/functional requirements may live under `product/` only when they are large enough to remain readable outside the master PRD/FRD; index them here and make precedence explicit.
12. Formal BRD/PRD/FRS/SRS/SDD/MDD ownership must remain explicit. Do not duplicate content between them; link to the owner document.
13. New docs must include Status, Owner/audience, Scope, Precedence, Inputs/source documents, Out-of-scope content, and Last reviewed date when they are intended to be canonical.
14. M3B and M15 compliance references are approved planning companions as of 2026-06-22; do not claim implementation, UGC direct integration, IRD verification, or CBMS certification until backend evidence and official approval exist.
