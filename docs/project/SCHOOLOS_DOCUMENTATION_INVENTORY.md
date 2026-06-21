# SchoolOS Documentation Inventory And Consolidation Decisions

**Status:** Canonical documentation inventory
**Owner/audience:** Documentation owner, product/architecture owners, coding agents, QA, support/operations
**Scope:** Complete tracked Markdown inventory, source-of-truth ownership, duplicate/overlap notes, inbound-reference notes, recommended consolidation action, actions executed in the 2026-06-20 completion pass, and repo-wide decisions from the 2026-06-21 Markdown audit.
**Precedence:** This inventory maps documents only. It does not replace the BRD, PRD, FRS, SRS, SDD, MDD, release policy, readiness audit, or runbook.
**Inputs/source documents:** `git status --short`, `git ls-files '*.md'`, `rg --files -g '*.md'`, `git grep`/`rg` reference scans, Markdown heading/link scan, and source inspection performed on 2026-06-20 and refreshed on 2026-06-21.
**Out-of-scope content:** Runtime implementation proof, endpoint contracts, schema changes beyond documented recommendations, and archive history before current tracked Markdown.
**Last reviewed date:** 2026-06-21

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
MERGE_THEN_ARCHIVE
ARCHIVE
DELETE
```

This inventory reflects the final documentation state after the 2026-06-20 consolidation completion pass plus the 2026-06-21 repo-wide Markdown audit. Recommended actions describe the current action for each remaining path, not a claim that runtime implementation exists.

The completion pass archived temporary/retired Markdown that was safe to move after inbound references were checked and active links were updated. No Markdown file was deleted.

The 2026-06-21 audit found 64 tracked Markdown files. The decision is not to delete Markdown blindly: canonical docs, app-local guardrails, design systems, E2E guides, archive indexes, and generated asset README files stay. Ten duplicate web reference and implementation-guide documents were merged into active owners, given replacement notes, and archived.

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
| `README.md` | Repository entry point and concise source-of-truth summary. | canonical | Overlaps docs index by design. | Entry point; not dependent on inbound docs links. | KEEP | N/A |
| `apps/api/AGENTS.md` | API-specific implementation guardrails. | active supporting | Overlaps root AGENTS for API rules. | Instruction file. | KEEP | Root `AGENTS.md` if ever merged. |
| `apps/schoolos_mobile/AGENTS.md` | Mobile-specific implementation/design guardrails. | active supporting | Overlaps mobile design plan and root AGENTS. | Instruction file. | KEEP | `docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md` for design-only content. |
| `apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md` | App-local mobile read order and verification commands. | active supporting | Overlaps mobile design plan. | Referenced from docs map. | KEEP | N/A |
| `apps/schoolos_mobile/docs/DESIGN_SYSTEM.md` | Flutter design-system guidance. | active supporting | Complements mobile design plan. | App-local; not heavily linked. | KEEP | N/A |
| `apps/schoolos_mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset/README.md` | Flutter/iOS launch-image placeholder. | generated | Not product documentation. | None observed. | KEEP | N/A |
| `apps/web/AGENTS.md` | Web-specific implementation/design guardrails. | active supporting | Overlaps web design plan and root AGENTS. | Instruction file. | KEEP | `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` for design-only content. |
| `apps/web/docs/DESIGN_SYSTEM.md` | Web design-system guidance. | active supporting | Referenced by many module design references. | Module design references. | KEEP | N/A |
| `docs/archive/web/modules/M8_LIBRARY_FRONTEND_IMPLEMENTATION_GUIDE.md` | Archived app-local M8 implementation guide. | archive | Unique guidance merged into active M8 module reference. | Archive index only. | KEEP | `docs/design/modules/M8_LIBRARY_FRONTEND_REFERENCE.md`. |
| `docs/archive/web/modules/README.md` | Archived app-local web module implementation guide index. | archive | Active module references now live under `docs/design/modules/`. | Archive index only. | KEEP | `docs/design/modules/README.md`. |
| `apps/web/e2e/README.md` | Browser smoke/E2E guide. | active supporting | Overlaps readiness audit for evidence but owns how-to. | Docs read order. | KEEP | N/A |
| `docs/archive/design/design-qa.md` | Archived ad hoc M1 UI QA note. | archive | Historical visual QA evidence; active rules live elsewhere. | Archive index only. | KEEP | `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`, `docs/design/modules/`, `docs/implementation/WEB_UI_API_ALIGNMENT_AUDIT.md`. |
| `docs/README.md` | Documentation map and read order. | canonical | Summarizes all canonical docs. | Root README should point here. | KEEP | N/A |
| `docs/architecture/NEPAL_BS_DATE_TIME_STANDARD.md` | Nepal date/time standard. | active supporting | Complements architecture/security and core helper code. | None observed. | KEEP | N/A |
| `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` | Canonical SDD, security, storage, performance, platform architecture rules. | canonical | Overlaps SRS for constraints; SRS references rather than duplicates. | Docs read order. | KEEP | N/A |
| `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md` | Canonical MDD catalog and module gap matrix. | canonical | New owner for module design to reduce PRD/FRS duplication. | New canonical doc. | KEEP | N/A |
| `docs/architecture/SCHOOLOS_NAMING_CONVENTIONS.md` | Naming and vocabulary conventions. | active supporting | Complements all implementation docs. | Docs read order and AGENTS. | KEEP | N/A |
| `docs/architecture/SCHOOLOS_NOTIFICATION_ARCHITECTURE.md` | M12 notification/communication architecture. | active supporting | Complements FRS/MDD; does not replace them. | Docs read order. | KEEP | N/A |
| `docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md` | Platform control plane, tenant configuration, providers, queues, support operations. | active supporting | Complements SRS/architecture. | Docs read order. | KEEP | N/A |
| `docs/archive/README.md` | Archive policy and index. | archive | Does not own active requirements. | Docs map. | KEEP | N/A |
| `docs/archive/design/HOSTEL_WEB_REFERENCE_ANALYSIS_RETIRED.md` | Archived Hostel design appendix. | archive | Historical only; Hostel is not active scope. | Archive index only. | KEEP | Active M0-M14 taxonomy in docs map, PRD, and MDD. |
| `docs/archive/design/M10_CANTEEN_WEB_REFERENCE_ANALYSIS.md` | Archived M10 web design analysis from the earlier implementation pass. | archive | Unique guidance merged into active M10 module reference. | Archive index only. | KEEP | `docs/design/modules/M10_CANTEEN_FRONTEND_REFERENCE.md`. |
| `docs/archive/design/M11_ACCOUNTING_WEB_REFERENCE_ANALYSIS.md` | Archived M11 web design analysis from the earlier implementation pass. | archive | Unique guidance merged into active M11 module reference. | Archive index only. | KEEP | `docs/design/modules/M11_ACCOUNTING_FINANCE_FRONTEND_REFERENCE.md`. |
| `docs/archive/design/M12_COMMUNICATION_WEB_REFERENCE_ANALYSIS.md` | Archived M12 web reference analysis from the earlier implementation pass. | archive | Unique guidance merged into active M12 module reference and notification architecture. | Archive index only. | KEEP | `docs/design/modules/M12_NOTIFICATIONS_COMMUNICATION_FRONTEND_REFERENCE.md`. |
| `docs/archive/design/M4_ACADEMICS_WEB_REFERENCE_SPEC.md` | Archived M4 web reference specification from the earlier implementation pass. | archive | Unique guidance merged into active M4 module reference. | Alignment audit and archive references. | KEEP | `docs/design/modules/M4_ACADEMICS_EXAMS_REPORT_CARDS_FRONTEND_REFERENCE.md`. |
| `docs/archive/design/M6_HOMEWORK_TIMETABLE_WEB_REFERENCE_ANALYSIS.md` | Archived M6 web design analysis from the earlier implementation pass. | archive | Unique guidance merged into active M6 module reference. | Archive index only. | KEEP | `docs/design/modules/M6_HOMEWORK_TIMETABLE_FRONTEND_REFERENCE.md`. |
| `docs/archive/design/M9_TRANSPORT_WEB_REFERENCE_ANALYSIS.md` | Archived M9 web design analysis from the earlier implementation pass. | archive | Unique guidance merged into active M9 module reference. | Archive index only. | KEEP | `docs/design/modules/M9_TRANSPORT_FRONTEND_REFERENCE.md`. |
| `docs/archive/design/SCHOOLOS_DASHBOARD_AND_M1_REFERENCE_SCREENS.md` | Archived dashboard/M1 visual reference appendix from the earlier implementation pass. | archive | Unique dashboard guidance merged into web plan; M1 workflow guidance remains in active M1 module reference. | Archive index only. | KEEP | `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` and `docs/design/modules/M1_ADMISSIONS_STUDENT_PROFILES_FRONTEND_REFERENCE.md`. |
| `docs/archive/design/SCHOOLOS_M7_HR_PAYROLL_WEB_DESIGN_REFERENCE.md` | Archived M7 web design reference from the earlier implementation pass. | archive | Unique guidance merged into active M7 module reference. | Archive index only. | KEEP | `docs/design/modules/M7_HR_PAYROLL_FRONTEND_REFERENCE.md`. |
| `docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md` | Canonical mobile app UI/UX plan. | active supporting | Mobile design source; SRS/MDD reference it. | Docs read order and mobile guide. | KEEP | N/A |
| `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` | Canonical web frontend design plan. | active supporting | Web design source; SRS/MDD reference it. | Docs read order and module references. | KEEP | N/A |
| `docs/archive/design/decisions/2026-06-19-m2-attendance-web-reference.md` | Archived M2 attendance design decision note. | archive | Absorbed into M2 module reference and global web plan. | Archive index; archived M2 checklist. | KEEP | `docs/design/modules/M2_SMART_ATTENDANCE_FRONTEND_REFERENCE.md`. |
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
| `docs/archive/implementation/M4_ACADEMICS_FRONTEND_EXECUTION_PLAN.md` | Archived M4 frontend execution plan. | archive | Historical W0-W8 slice detail; active guidance is module reference plus next-phase plan. | M4 reference spec and alignment audit mention archive only. | KEEP | `docs/design/modules/M4_ACADEMICS_EXAMS_REPORT_CARDS_FRONTEND_REFERENCE.md`; `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`. |
| `docs/implementation/WEB_UI_API_ALIGNMENT_AUDIT.md` | Web UI/API alignment audit and implementation notes. | active supporting | Overlaps readiness audit for web, but owns UI/API alignment. | Docs map. | KEEP | N/A |
| `docs/product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md` | Cross-surface allocation and role/surface boundaries. | active supporting | Overlaps PRD/SRS/MDD; retained for detailed allocation. | PRD/FRS and docs map. | KEEP | N/A |
| `docs/product/SCHOOLOS_BRD.md` | Business requirements and market/stage rollout. | canonical | New formal BRD. | Docs map. | KEEP | N/A |
| `docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md` | Canonical FRS. | canonical | Overlaps PRD/MDD; owns workflow behavior. | Product allocation doc. | KEEP | N/A |
| `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` | Canonical PRD. | canonical | Overlaps BRD/FRS/SRS/MDD only by reference. | Product allocation doc. | KEEP | N/A |
| `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md` | Release terminology and GA gates. | canonical | Summarized elsewhere by reference only. | Docs map and README. | KEEP | N/A |
| `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md` | Deployment, backup/restore, rollback, pilot runbook. | active supporting | Procedure, not readiness proof. | Docs map. | KEEP | N/A |
| `docs/archive/project/M10_CANTEEN_FRONTEND_IMPLEMENTATION_CHECKLIST.md` | Archived M10 frontend checklist. | archive | Absorbed into active M10 module reference. | Archive index only. | KEEP | `docs/design/modules/M10_CANTEEN_FRONTEND_REFERENCE.md`. |
| `docs/archive/project/M6_HOMEWORK_TIMETABLE_FRONTEND_IMPLEMENTATION_CHECKLIST.md` | Archived M6 frontend checklist. | archive | Absorbed into active M6 module reference. | Archive index only. | KEEP | `docs/design/modules/M6_HOMEWORK_TIMETABLE_FRONTEND_REFERENCE.md`. |
| `docs/project/SCHOOLOS_DOCUMENTATION_INVENTORY.md` | Complete Markdown inventory. | canonical | New owner for documentation inventory. | Docs map. | KEEP | N/A |
| `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md` | Long implementation backlog and module history. | active supporting | Overlaps next-phase plan; next-phase owns current sequence. | Docs map. | KEEP | `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` for active execution. |
| `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` | Dependency-driven execution sequence. | canonical | Overlaps implementation plan only for current route. | Readiness audit/product allocation. | KEEP | N/A |
| `docs/project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` | Current readiness evidence and blockers. | canonical | Contains older inventory; this doc now owns full inventory. | Readiness docs. | KEEP | N/A |
| `docs/project/SCHOOLOS_PROJECT_STATUS.md` | Concise current status snapshot. | active supporting | Summarizes audit; should not replace it. | Docs map. | KEEP | Audit for evidence. |
| `docs/archive/project/checklists/2026-06-19-m2-attendance-frontend-delivery-checklist.md` | Archived M2 attendance frontend delivery checklist. | archive | Absorbed into active M2 module reference. | Archive index and archived M2 decision note. | KEEP | `docs/design/modules/M2_SMART_ATTENDANCE_FRONTEND_REFERENCE.md`. |
| `docs/requirements/SCHOOLOS_SRS.md` | Canonical SRS. | canonical | New requirements bridge; references PRD/FRS rather than duplicating. | Docs map. | KEEP | N/A |

## 4. Consolidation Decisions

| Decision | Result |
|---|---|
| Create formal BRD/PRD/FRS/SRS/SDD/MDD ownership model. | Done through BRD, existing PRD/FRS, new SRS, existing architecture/security as SDD, and new module design catalog as MDD. |
| Keep release evidence separate from product/architecture docs. | `SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` remains current proof owner. |
| Keep execution sequence separate from backlog/history. | `SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` remains current route; implementation plan remains supporting backlog/history. |
| Archive temporary/retired documents where safe. | `design-qa.md`, Hostel retired appendix, M2 decision/checklist, M4 execution plan, M6 checklist, and M10 checklist were moved under `docs/archive/`. |
| Delete obsolete Markdown. | None. Historical content remains available under `docs/archive/`. |
| Retain app-local guides where they prevent mistakes. | App AGENTS, mobile guide, design systems, and E2E README remain active supporting docs. |
| Remove duplicate source-of-truth ownership. | Active implementation sequencing stays in `SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`; module web detail stays in `docs/design/modules/`; archived checklists are historical only. |
| Do we need all 64 tracked Markdown files as active reading material? | No. The active reading set is the canonical/supporting docs; the 10 duplicate web reference/implementation-guide files were consolidated and archived. |
| Delete candidates after audit. | None. Historical content remains under `docs/archive/` with replacement notes. |
| 2026-06-21 web-reference cleanup. | Principal dashboard, M4, M6, M7, M8, M9, M10, M11, and M12 unique guidance was merged into active owners before the duplicate files were archived. |
