# SchoolOS Module Design References

**Status:** Module-level frontend design reference index.  
**Updated:** 2026-06-22

This folder contains the implementation-ready M1-M13 frontend web design references plus owner-approved planned compliance references. Each file owns its module's feature explanations, personas, route plan, screen specifications, component plan, backend/API needs, state matrix, security boundaries, Nepal-specific requirements, implementation checklist, and done definition.

These files complement and must follow the main web design sources:

```text
docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
docs/product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md
apps/web/docs/DESIGN_SYSTEM.md
apps/web/AGENTS.md
```

Backend/OpenAPI/shared contracts remain authoritative for DTOs, API names, route guards, permissions, totals, state transitions, file access, jobs, and audit behavior.

---

## Active Module Numbering

| Module | Name | Design reference |
|---|---|---|
| M1 | Admissions and Student Profiles | [M1 reference](M1_ADMISSIONS_STUDENT_PROFILES_FRONTEND_REFERENCE.md) |
| M2 | Smart Attendance | [M2 reference](M2_SMART_ATTENDANCE_FRONTEND_REFERENCE.md) |
| M3 | Fees and Receipts | [M3 reference](M3_FEES_RECEIPTS_FRONTEND_REFERENCE.md) |
| M3B | IRD Billing Compliance extension | [M3B reference](M3B_IRD_BILLING_COMPLIANCE_FRONTEND_REFERENCE.md) |
| M4 | Academics, Exams, CAS, Report Cards | [M4 reference](M4_ACADEMICS_EXAMS_REPORT_CARDS_FRONTEND_REFERENCE.md) |
| M5 | Activity Feed and Milestones | [M5 reference](M5_ACTIVITY_FEED_MILESTONES_FRONTEND_REFERENCE.md) |
| M6 | Homework and Timetable | [M6 reference](M6_HOMEWORK_TIMETABLE_FRONTEND_REFERENCE.md) |
| M7 | HR and Payroll | [M7 reference](M7_HR_PAYROLL_FRONTEND_REFERENCE.md) |
| M8 | Library | [M8 reference](M8_LIBRARY_FRONTEND_REFERENCE.md) |
| M9 | Transport | [M9 reference](M9_TRANSPORT_FRONTEND_REFERENCE.md) |
| M10 | Canteen | [M10 reference](M10_CANTEEN_FRONTEND_REFERENCE.md) |
| M11 | Accounting and Finance | [M11 reference](M11_ACCOUNTING_FINANCE_FRONTEND_REFERENCE.md) |
| M12 | Notifications, Notices, Communication, Chat | [M12 reference](M12_NOTIFICATIONS_COMMUNICATION_FRONTEND_REFERENCE.md) |
| M13 | Learning Layer | [M13 reference](M13_LEARNING_LAYER_FRONTEND_REFERENCE.md) |
| M15 | Education Compliance | [M15 reference](M15_EDUCATION_COMPLIANCE_FRONTEND_REFERENCE.md) |

`M8A`, `M8B`, and `M8C` are obsolete labels. Library, Transport, and Canteen are standalone modules.

Inventory & Asset Management is scrapped from active design scope.

M14 Intelligence / AI is deferred and intentionally has no active frontend implementation reference.

M3B is an extension of M3 Fees and Receipts, not a separate billing source of truth. M11 remains authoritative for accounting journals, fiscal periods, locks, reconciliation, and financial reports.

M15 Education Compliance is a planned compliance module. It is indexed here because the project owner approved UGC/HEMIS and IRD compliance documentation on 2026-06-22. Implementation still requires backend/OpenAPI confirmation.

---

## How to Use These Files

For module-specific frontend implementation, read in this order:

```text
1. docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
2. docs/product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md
3. apps/web/docs/DESIGN_SYSTEM.md
4. apps/web/AGENTS.md
5. docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md
6. docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md
7. The matching module reference in this folder
8. Existing routes/components/API clients/OpenAPI/contracts/tests for the touched module
```

For M3B or M15, also read:

```text
docs/product/SCHOOLOS_EDUCATION_COMPLIANCE_IRD_BILLING_SPEC.md
```

---

## Common Design Rules Across All Module References

- One screen = one main job.
- Use real backend APIs only.
- Do not add fake dashboard metrics to match visual references.
- Official totals, status, scope, locks, money, delivery state, files, and audit behavior are backend-owned.
- Confirm API names, DTOs, permissions, route guards, and protected-file behavior against backend/OpenAPI before coding.
- Use protected file helpers for private PDFs, receipts, photos, reports, labels, attachments, snapshots, payslips, report cards, learning resources, compliance exports, tax invoices, credit notes, and debit notes.
- Growing lists use server-side pagination and filtering.
- Parent, student, staff self-service, driver, and mobile companion surfaces are purpose-limited.
- High-risk actions require confirmation, reason where required, pending/success/error state, and audit visibility.
- Missing APIs should render friendly unavailable/locked/permission states and implementation notes such as `needs OpenAPI confirmation`, not fake data.
- Do not show `UGC integrated`, `IRD verified`, `CBMS certified`, or direct API claims unless backend settings contain official verification evidence and product/legal approval exists.

---

## Backend Alignment Rule

Each module reference includes a backend alignment section. Treat those backend feature lists as implementation guidance, not as proof that the current backend already exposes every endpoint.

Before implementing a screen:

```text
Inspect existing backend module
Inspect OpenAPI/shared contracts
Inspect API client files
Inspect permissions/entitlements
Inspect File Registry usage
Inspect tests and seeds
Then implement against confirmed contracts
```

Do not invent response shapes in frontend code.

---

## Cleanup Rules

- Do not create new module design files outside this folder unless there is a clear reason and this index is updated.
- Do not reintroduce `M8A`, `M8B`, or `M8C` module numbering.
- Do not create Inventory & Asset Management references unless the project owner explicitly re-approves the module.
- Do not create M14 AI frontend implementation docs until M14 is approved for active implementation.
- Keep M3B and M15 compliance docs aligned with `docs/product/SCHOOLOS_EDUCATION_COMPLIANCE_IRD_BILLING_SPEC.md` until master PRD/FRS/SRS/SDD files absorb the approved scope.
