# SchoolOS Documentation Archive

**Status:** Archive index
**Last updated:** 2026-06-21

This folder is for old, superseded, duplicated, or one-off planning documents.

---

## Archive Rule

```text
Archive before deleting.
Do not use archived docs as source of truth.
Every archived doc should mention what replaced it when possible.
```

---

## What Belongs Here

```text
Old planning drafts
Superseded UI/UX plans
Duplicated module plans
One-off exploration notes
Uploaded reference docs after they have been consolidated
Deprecated implementation plans
```

---

## What Does Not Belong Here

```text
Current source-of-truth docs
Active screen contract matrices
Active permission catalogs
Active backend contract plans
Active testing plans
```

---

## Current Source of Truth

Use these instead of archived docs:

```text
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
docs/architecture/SCHOOLOS_NOTIFICATION_ARCHITECTURE.md
docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md
docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
docs/design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md
docs/design/modules/README.md
docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md
```

Check `docs/project/SCHOOLOS_DOCUMENTATION_INVENTORY.md` before archiving or deleting any tracked Markdown file.

---

## Archived In 2026-06-20 Consolidation Completion Pass

| Archived path | Original path | Replacement / current owner |
|---|---|---|
| `design/design-qa.md` | `design-qa.md` | `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`, `docs/design/modules/`, and `docs/implementation/WEB_UI_API_ALIGNMENT_AUDIT.md`. |
| `design/HOSTEL_WEB_REFERENCE_ANALYSIS_RETIRED.md` | `docs/design/HOSTEL_WEB_REFERENCE_ANALYSIS_RETIRED.md` | Active M0-M14 taxonomy in `docs/README.md`, `docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`, and `docs/architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md`. |
| `design/decisions/2026-06-19-m2-attendance-web-reference.md` | `docs/design/decisions/2026-06-19-m2-attendance-web-reference.md` | `docs/design/modules/M2_SMART_ATTENDANCE_FRONTEND_REFERENCE.md` and `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`. |
| `project/checklists/2026-06-19-m2-attendance-frontend-delivery-checklist.md` | `docs/project/checklists/2026-06-19-m2-attendance-frontend-delivery-checklist.md` | `docs/design/modules/M2_SMART_ATTENDANCE_FRONTEND_REFERENCE.md` and current delivery plan. |
| `implementation/M4_ACADEMICS_FRONTEND_EXECUTION_PLAN.md` | `docs/implementation/M4_ACADEMICS_FRONTEND_EXECUTION_PLAN.md` | `docs/design/modules/M4_ACADEMICS_EXAMS_REPORT_CARDS_FRONTEND_REFERENCE.md` and `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`. |
| `project/M6_HOMEWORK_TIMETABLE_FRONTEND_IMPLEMENTATION_CHECKLIST.md` | `docs/project/M6_HOMEWORK_TIMETABLE_FRONTEND_IMPLEMENTATION_CHECKLIST.md` | `docs/design/modules/M6_HOMEWORK_TIMETABLE_FRONTEND_REFERENCE.md` and `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`. |
| `project/M10_CANTEEN_FRONTEND_IMPLEMENTATION_CHECKLIST.md` | `docs/project/M10_CANTEEN_FRONTEND_IMPLEMENTATION_CHECKLIST.md` | `docs/design/modules/M10_CANTEEN_FRONTEND_REFERENCE.md` and `docs/project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`. |

## Archived In 2026-06-21 Markdown Cleanup

| Archived path | Original path | Replacement / current owner |
|---|---|---|
| `design/SCHOOLOS_DASHBOARD_AND_M1_REFERENCE_SCREENS.md` | `docs/design/SCHOOLOS_DASHBOARD_AND_M1_REFERENCE_SCREENS.md` | `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` and `docs/design/modules/M1_ADMISSIONS_STUDENT_PROFILES_FRONTEND_REFERENCE.md`. |
| `design/M4_ACADEMICS_WEB_REFERENCE_SPEC.md` | `docs/design/M4_ACADEMICS_WEB_REFERENCE_SPEC.md` | `docs/design/modules/M4_ACADEMICS_EXAMS_REPORT_CARDS_FRONTEND_REFERENCE.md`. |
| `design/M6_HOMEWORK_TIMETABLE_WEB_REFERENCE_ANALYSIS.md` | `docs/design/M6_HOMEWORK_TIMETABLE_WEB_REFERENCE_ANALYSIS.md` | `docs/design/modules/M6_HOMEWORK_TIMETABLE_FRONTEND_REFERENCE.md`. |
| `design/SCHOOLOS_M7_HR_PAYROLL_WEB_DESIGN_REFERENCE.md` | `docs/design/SCHOOLOS_M7_HR_PAYROLL_WEB_DESIGN_REFERENCE.md` | `docs/design/modules/M7_HR_PAYROLL_FRONTEND_REFERENCE.md`. |
| `design/M9_TRANSPORT_WEB_REFERENCE_ANALYSIS.md` | `docs/design/M9_TRANSPORT_WEB_REFERENCE_ANALYSIS.md` | `docs/design/modules/M9_TRANSPORT_FRONTEND_REFERENCE.md`. |
| `design/M10_CANTEEN_WEB_REFERENCE_ANALYSIS.md` | `docs/design/M10_CANTEEN_WEB_REFERENCE_ANALYSIS.md` | `docs/design/modules/M10_CANTEEN_FRONTEND_REFERENCE.md`. |
| `design/M11_ACCOUNTING_WEB_REFERENCE_ANALYSIS.md` | `docs/design/M11_ACCOUNTING_WEB_REFERENCE_ANALYSIS.md` | `docs/design/modules/M11_ACCOUNTING_FINANCE_FRONTEND_REFERENCE.md`. |
| `design/M12_COMMUNICATION_WEB_REFERENCE_ANALYSIS.md` | `docs/design/M12_COMMUNICATION_WEB_REFERENCE_ANALYSIS.md` | `docs/design/modules/M12_NOTIFICATIONS_COMMUNICATION_FRONTEND_REFERENCE.md`. |
| `web/modules/M8_LIBRARY_FRONTEND_IMPLEMENTATION_GUIDE.md` | `apps/web/docs/modules/M8_LIBRARY_FRONTEND_IMPLEMENTATION_GUIDE.md` | `docs/design/modules/M8_LIBRARY_FRONTEND_REFERENCE.md`. |
| `web/modules/README.md` | `apps/web/docs/modules/README.md` | `docs/design/modules/README.md`. |
