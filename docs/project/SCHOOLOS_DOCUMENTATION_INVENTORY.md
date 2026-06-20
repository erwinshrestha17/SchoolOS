# SchoolOS Documentation Inventory And Consolidation Decisions

**Status:** Canonical documentation inventory
**Owner/audience:** Documentation owner, product/architecture owners, coding agents, QA, support/operations
**Scope:** Complete tracked Markdown inventory, source-of-truth ownership, duplicate/overlap notes, inbound-reference notes, and recommended consolidation action.
**Precedence:** This inventory maps documents only. It does not replace the BRD, PRD, FRS, SRS, SDD, MDD, release policy, readiness audit, or runbook.
**Inputs/source documents:** `git status --short`, `git ls-files '*.md'`, Markdown heading/link scan, and source inspection performed on 2026-06-20.
**Out-of-scope content:** Runtime implementation proof, endpoint contracts, schema changes, deletion/renaming execution, and archive history beyond current tracked Markdown.
**Last reviewed date:** 2026-06-20

---

## 1. Inventory Rules

Status values:

```text
canonical
active supporting
temporary
retired
archive
generated
duplicate
```

Recommended actions:

```text
KEEP
REWRITE
MERGE
ARCHIVE
DELETE
```

This pass did not delete, rename, or archive tracked Markdown files. Recommended actions describe the desired future consolidation state, not necessarily an action executed in this pass.

## 2. Source-Of-Truth Hierarchy

| Artifact | Canonical path |
|---|---|
| BRD | `docs/product/SCHOOLOS_BRD.md` |
| PRD | `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` |
| FRS | `docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md` |
| SRS | `docs/requirements/SCHOOLOS_SRS.md` |
| SDD | `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` |
| MDD | `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md` |
| Release policy | `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md` |
| Current readiness proof | `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` |
| Execution sequencing | `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` |
| Production runbook | `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md` |
| Web design | `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` |
| Mobile design | `docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md` |
| M12 notification architecture | `docs/architecture/SCHOOLOS_NOTIFICATION_ARCHITECTURE.md` |
| Platform operations | `docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md` |
| Naming conventions | `docs/architecture/SCHOOLOS_NAMING_CONVENTIONS.md` |

## 3. Complete Markdown Inventory

| Path | Current purpose | Status | Duplicate/overlap | Inbound links/references | Recommended action | Canonical destination if merged |
|---|---|---|---|---|---|---|
| `AGENTS.md` | Repository-wide agent/developer guardrails. | canonical | Summarizes module taxonomy and docs read order; intentional. | Instruction file, not usually linked. | KEEP | N/A |
| `README.md` | Repository entry point and concise source-of-truth summary. | canonical | Overlaps docs index by design. | Entry point; not dependent on inbound docs links. | REWRITE | N/A |
| `apps/api/AGENTS.md` | API-specific implementation guardrails. | active supporting | Overlaps root AGENTS for API rules. | Instruction file. | KEEP | Root `AGENTS.md` if ever merged. |
| `apps/schoolos_mobile/AGENTS.md` | Mobile-specific implementation/design guardrails. | active supporting | Overlaps mobile design plan and root AGENTS. | Instruction file. | KEEP | `docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md` for design-only content. |
| `apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md` | App-local mobile read order and verification commands. | active supporting | Overlaps mobile design plan. | Referenced from docs map. | KEEP | N/A |
| `apps/schoolos_mobile/docs/DESIGN_SYSTEM.md` | Flutter design-system guidance. | active supporting | Complements mobile design plan. | App-local; not heavily linked. | KEEP | N/A |
| `apps/schoolos_mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset/README.md` | Flutter/iOS launch-image placeholder. | generated | Not product documentation. | None observed. | KEEP | N/A |
| `apps/web/AGENTS.md` | Web-specific implementation/design guardrails. | active supporting | Overlaps web design plan and root AGENTS. | Instruction file. | KEEP | `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` for design-only content. |
| `apps/web/docs/DESIGN_SYSTEM.md` | Web design-system guidance. | active supporting | Referenced by many module design references. | Module design references. | KEEP | N/A |
| `apps/web/docs/modules/M8_LIBRARY_FRONTEND_IMPLEMENTATION_GUIDE.md` | App-local M8 implementation guide. | active supporting | Overlaps M8 design reference. | App-local module guide index. | KEEP | `docs/design/modules/M8_LIBRARY_FRONTEND_REFERENCE.md` if retired. |
| `apps/web/docs/modules/README.md` | App-local web module implementation guide index. | active supporting | Overlaps docs module design index. | App-local. | KEEP | `docs/design/modules/README.md` if retired. |
| `apps/web/e2e/README.md` | Browser smoke/E2E guide. | active supporting | Overlaps readiness audit for evidence but owns how-to. | Docs read order. | KEEP | N/A |
| `design-qa.md` | Ad hoc UI QA notes. | temporary | Overlaps web design/audit notes. | None observed. | ARCHIVE | `docs/archive/README.md` plus relevant web design/audit sections. |
| `docs/README.md` | Documentation map and read order. | canonical | Summarizes all canonical docs. | Root README should point here. | REWRITE | N/A |
| `docs/architecture/NEPAL_BS_DATE_TIME_STANDARD.md` | Nepal date/time standard. | active supporting | Complements architecture/security and core helper code. | None observed. | KEEP | N/A |
| `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` | Canonical SDD, security, storage, performance, platform architecture rules. | canonical | Overlaps SRS for constraints; SRS references rather than duplicates. | Docs read order. | REWRITE | N/A |
| `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md` | Canonical MDD catalog and module gap matrix. | canonical | New owner for module design to reduce PRD/FRS duplication. | New canonical doc. | KEEP | N/A |
| `docs/architecture/SCHOOLOS_NAMING_CONVENTIONS.md` | Naming and vocabulary conventions. | active supporting | Complements all implementation docs. | Docs read order and AGENTS. | KEEP | N/A |
| `docs/architecture/SCHOOLOS_NOTIFICATION_ARCHITECTURE.md` | M12 notification/communication architecture. | active supporting | Complements FRS/MDD; does not replace them. | Docs read order. | KEEP | N/A |
| `docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md` | Platform control plane, tenant configuration, providers, queues, support operations. | active supporting | Complements SRS/architecture. | Docs read order. | KEEP | N/A |
| `docs/archive/README.md` | Archive policy and index. | archive | Does not own active requirements. | Docs map. | KEEP | N/A |
| `docs/design/HOSTEL_WEB_REFERENCE_ANALYSIS_RETIRED.md` | Retired Hostel design appendix. | retired | Historical only. | Archive/design index not active. | KEEP | N/A |
| `docs/design/M10_CANTEEN_WEB_REFERENCE_ANALYSIS.md` | Supporting M10 web design analysis. | active supporting | Overlaps M10 module reference. | Module docs map. | KEEP | `docs/design/modules/M10_CANTEEN_FRONTEND_REFERENCE.md` if consolidated. |
| `docs/design/M11_ACCOUNTING_WEB_REFERENCE_ANALYSIS.md` | Supporting M11 web design analysis. | active supporting | Overlaps M11 module reference. | Module docs map. | KEEP | `docs/design/modules/M11_ACCOUNTING_FINANCE_FRONTEND_REFERENCE.md` if consolidated. |
| `docs/design/M12_COMMUNICATION_WEB_REFERENCE_ANALYSIS.md` | Supporting M12 web reference analysis. | active supporting | Overlaps M12 module reference and notification architecture. | Module docs map. | KEEP | `docs/design/modules/M12_NOTIFICATIONS_COMMUNICATION_FRONTEND_REFERENCE.md` if consolidated. |
| `docs/design/M4_ACADEMICS_WEB_REFERENCE_SPEC.md` | M4 web reference specification. | active supporting | Overlaps M4 module reference and execution plan. | Implementation/docs map. | KEEP | `docs/design/modules/M4_ACADEMICS_EXAMS_REPORT_CARDS_FRONTEND_REFERENCE.md` if consolidated. |
| `docs/design/M6_HOMEWORK_TIMETABLE_WEB_REFERENCE_ANALYSIS.md` | Supporting M6 web design analysis. | active supporting | Overlaps M6 module reference/checklist. | Module docs map. | KEEP | `docs/design/modules/M6_HOMEWORK_TIMETABLE_FRONTEND_REFERENCE.md` if consolidated. |
| `docs/design/M9_TRANSPORT_WEB_REFERENCE_ANALYSIS.md` | Supporting M9 web design analysis. | active supporting | Overlaps M9 module reference. | Module docs map. | KEEP | `docs/design/modules/M9_TRANSPORT_FRONTEND_REFERENCE.md` if consolidated. |
| `docs/design/SCHOOLOS_DASHBOARD_AND_M1_REFERENCE_SCREENS.md` | Supporting dashboard/M1 visual reference. | active supporting | Overlaps web design plan and M1 reference. | Docs map. | KEEP | `docs/design/modules/M1_ADMISSIONS_STUDENT_PROFILES_FRONTEND_REFERENCE.md` if consolidated. |
| `docs/design/SCHOOLOS_M7_HR_PAYROLL_WEB_DESIGN_REFERENCE.md` | Supporting M7 web design reference. | active supporting | Overlaps M7 module reference. | Docs map. | KEEP | `docs/design/modules/M7_HR_PAYROLL_FRONTEND_REFERENCE.md` if consolidated. |
| `docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md` | Canonical mobile app UI/UX plan. | active supporting | Mobile design source; SRS/MDD reference it. | Docs read order and mobile guide. | KEEP | N/A |
| `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` | Canonical web frontend design plan. | active supporting | Web design source; SRS/MDD reference it. | Docs read order and module references. | KEEP | N/A |
| `docs/design/decisions/2026-06-19-m2-attendance-web-reference.md` | M2 attendance design decision note. | temporary | Overlaps M2 module reference/checklist. | None observed. | KEEP | `docs/design/modules/M2_SMART_ATTENDANCE_FRONTEND_REFERENCE.md` after decision is absorbed. |
| `docs/design/modules/M10_CANTEEN_FRONTEND_REFERENCE.md` | M10 module web design reference. | active supporting | Overlaps M10 analysis doc. | Module index. | KEEP | N/A |
| `docs/design/modules/M11_ACCOUNTING_FINANCE_FRONTEND_REFERENCE.md` | M11 module web design reference. | active supporting | Overlaps M11 analysis doc. | Module index. | KEEP | N/A |
| `docs/design/modules/M12_NOTIFICATIONS_COMMUNICATION_FRONTEND_REFERENCE.md` | M12 module web design reference. | active supporting | Overlaps notification architecture only for UI. | Module index. | KEEP | N/A |
| `docs/design/modules/M13_LEARNING_LAYER_FRONTEND_REFERENCE.md` | M13 module web design reference. | active supporting | Complements M13 PRD/FRS/MDD. | Module index. | KEEP | N/A |
| `docs/design/modules/M1_ADMISSIONS_STUDENT_PROFILES_FRONTEND_REFERENCE.md` | M1 module web design reference. | active supporting | Overlaps dashboard/M1 visual appendix. | Module index. | KEEP | N/A |
| `docs/design/modules/M2_SMART_ATTENDANCE_FRONTEND_REFERENCE.md` | M2 module web design reference. | active supporting | Overlaps M2 decision/checklist. | Module index. | KEEP | N/A |
| `docs/design/modules/M3_FEES_RECEIPTS_FRONTEND_REFERENCE.md` | M3 module web design reference. | active supporting | Complements finance implementation audit. | Module index. | KEEP | N/A |
| `docs/design/modules/M4_ACADEMICS_EXAMS_REPORT_CARDS_FRONTEND_REFERENCE.md` | M4 module web design reference. | active supporting | Overlaps M4 web spec/execution plan. | Module index. | KEEP | N/A |
| `docs/design/modules/M5_ACTIVITY_FEED_MILESTONES_FRONTEND_REFERENCE.md` | M5 module web design reference. | active supporting | Complements stage-aware preschool activity requirements. | Module index. | KEEP | N/A |
| `docs/design/modules/M6_HOMEWORK_TIMETABLE_FRONTEND_REFERENCE.md` | M6 module web design reference. | active supporting | Overlaps M6 analysis/checklist. | Module index. | KEEP | N/A |
| `docs/design/modules/M7_HR_PAYROLL_FRONTEND_REFERENCE.md` | M7 module web design reference. | active supporting | Overlaps M7 design reference. | Module index. | KEEP | N/A |
| `docs/design/modules/M8_LIBRARY_FRONTEND_REFERENCE.md` | M8 module web design reference. | active supporting | Overlaps app-local M8 guide. | Module index. | KEEP | N/A |
| `docs/design/modules/M9_TRANSPORT_FRONTEND_REFERENCE.md` | M9 module web design reference. | active supporting | Overlaps M9 analysis. | Module index. | KEEP | N/A |
| `docs/design/modules/README.md` | Module design reference index. | active supporting | Summarizes module files. | Web design plan. | KEEP | N/A |
| `docs/implementation/M4_ACADEMICS_FRONTEND_EXECUTION_PLAN.md` | M4 frontend execution plan. | temporary | Overlaps M4 design/spec and next-phase plan. | Docs map. | KEEP | `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` after execution. |
| `docs/implementation/WEB_UI_API_ALIGNMENT_AUDIT.md` | Web UI/API alignment audit and implementation notes. | active supporting | Overlaps readiness audit for web, but owns UI/API alignment. | Docs map. | KEEP | N/A |
| `docs/product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md` | Cross-surface allocation and role/surface boundaries. | active supporting | Overlaps PRD/SRS/MDD; retained for detailed allocation. | PRD/FRS and docs map. | KEEP | N/A |
| `docs/product/SCHOOLOS_BRD.md` | Business requirements and market/stage rollout. | canonical | New formal BRD. | Docs map. | KEEP | N/A |
| `docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md` | Canonical FRS. | canonical | Overlaps PRD/MDD; owns workflow behavior. | Product allocation doc. | REWRITE | N/A |
| `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` | Canonical PRD. | canonical | Overlaps BRD/FRS/SRS/MDD only by reference. | Product allocation doc. | REWRITE | N/A |
| `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md` | Release terminology and GA gates. | canonical | Summarized elsewhere by reference only. | Docs map and README. | KEEP | N/A |
| `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md` | Deployment, backup/restore, rollback, pilot runbook. | active supporting | Procedure, not readiness proof. | Docs map. | KEEP | N/A |
| `docs/project/M10_CANTEEN_FRONTEND_IMPLEMENTATION_CHECKLIST.md` | M10 frontend checklist. | temporary | Overlaps M10 design reference. | None observed. | KEEP | `docs/design/modules/M10_CANTEEN_FRONTEND_REFERENCE.md` after execution. |
| `docs/project/M6_HOMEWORK_TIMETABLE_FRONTEND_IMPLEMENTATION_CHECKLIST.md` | M6 frontend checklist. | temporary | Overlaps M6 design reference. | None observed. | KEEP | `docs/design/modules/M6_HOMEWORK_TIMETABLE_FRONTEND_REFERENCE.md` after execution. |
| `docs/project/SCHOOLOS_DOCUMENTATION_INVENTORY.md` | Complete Markdown inventory. | canonical | New owner for documentation inventory. | Docs map. | KEEP | N/A |
| `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md` | Long implementation backlog and module history. | active supporting | Overlaps next-phase plan; next-phase owns current sequence. | Docs map. | KEEP | `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` for active execution. |
| `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` | Dependency-driven execution sequence. | canonical | Overlaps implementation plan only for current route. | Readiness audit/product allocation. | REWRITE | N/A |
| `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` | Current readiness evidence and blockers. | canonical | Contains older inventory; this doc now owns full inventory. | Readiness docs. | KEEP | N/A |
| `docs/project/SCHOOLOS_PROJECT_STATUS.md` | Concise current status snapshot. | active supporting | Summarizes audit; should not replace it. | Docs map. | KEEP | Audit for evidence. |
| `docs/project/checklists/2026-06-19-m2-attendance-frontend-delivery-checklist.md` | M2 attendance frontend delivery checklist. | temporary | Overlaps M2 design decision/reference. | None observed. | KEEP | `docs/design/modules/M2_SMART_ATTENDANCE_FRONTEND_REFERENCE.md` after execution. |
| `docs/requirements/SCHOOLOS_SRS.md` | Canonical SRS. | canonical | New requirements bridge; references PRD/FRS rather than duplicating. | Docs map. | KEEP | N/A |

## 4. Consolidation Decisions

| Decision | Result |
|---|---|
| Create formal BRD/PRD/FRS/SRS/SDD/MDD ownership model. | Done through BRD, existing PRD/FRS, new SRS, existing architecture/security as SDD, and new module design catalog as MDD. |
| Keep release evidence separate from product/architecture docs. | `SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` remains current proof owner. |
| Keep execution sequence separate from backlog/history. | `SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` remains current route; implementation plan remains supporting backlog/history. |
| Avoid deleting/archiving in this pass. | No tracked Markdown was deleted or moved. |
| Retain app-local guides where they prevent mistakes. | App AGENTS, mobile guide, design systems, and E2E README remain active supporting docs. |
| Mark temporary checklists and ad hoc QA notes. | They remain tracked, but future cleanup should merge/archive after their content is absorbed. |

