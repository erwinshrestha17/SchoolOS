# Retired Hostel Web Reference Analysis

**Status:** Retired design appendix.  
**Updated:** 2026-06-19

This file replaces the obsolete `M8B_HOSTEL_WEB_REFERENCE_ANALYSIS.md` reference.

Hostel is **not part of the active SchoolOS module taxonomy**. The current active module numbering is:

| Module | Name |
|---|---|
| M0 | Platform Core |
| M1 | Admissions and Student Profiles |
| M2 | Smart Attendance |
| M3 | Fees and Receipts |
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

Do not implement Hostel routes, APIs, permissions, migrations, seed data, mobile flows, or dashboard navigation from the old design appendix unless the project owner explicitly approves Hostel as a future standalone module with a new module number.

If Hostel is later approved, it must be introduced through:

```text
Product approval
Active module number assignment
PRD/FRS update
Architecture/security boundary review
Route ownership
RBAC and entitlement design
Backend/OpenAPI contracts
Seed data
Web/mobile smoke tests
Docs index update
```

Historical note: the removed appendix was only a visual-reference experiment. It did not establish active product scope.
