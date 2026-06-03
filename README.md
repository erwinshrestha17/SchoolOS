# SchoolOS

SchoolOS is a production-grade, multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10.

It is designed as a modular school operating system covering admissions, student records, attendance, fees, notices, activity feed, academics, homework, timetable, HR/payroll, accounting, library, transport, canteen, and future intelligence/analytics.

---

## Source of Truth

The consolidated project memory is:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Active companion files:

```text
DEVELOPMENT_RULES.md

docs/product/SCHOOLOS_PRD_COMBINED_MASTER_2026.md
docs/business/SCHOOLOS_BRD_2026.md
docs/requirements/SCHOOLOS_SRS_2026.md
docs/requirements/SCHOOLOS_FRS_2026.md

docs/design/SCHOOLOS_UI_UX_GUIDE.md

docs/project/SCHOOLOS_IMPLEMENTATION_STATUS_AND_PLAN.md
docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md
docs/project/SCHOOLOS_STORAGE_AND_FILE_REGISTRY.md
docs/project/SCHOOLOS_TRANSPORT_REALTIME_READINESS.md
docs/project/SCHOOLOS_SCALABILITY_HARDENING_POLICY.md

docs/production/deployment-runbook.md
docs/production/backup-restore-runbook.md
docs/production/phase1-pilot-readiness.md

apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md
apps/web/e2e/README.md
```

Historical/duplicate docs should not be recreated unless the project grows enough to justify splitting them again.

---

## Current Stage

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core Foundation Depth: Completed
M4 Academics backend/admin UI: Completed / Pilot-Ready
M6 Homework/Timetable: Completed / Pilot-Ready
M7 HR/Payroll: Completed / Pilot-Ready
M8A Library, M8B Transport, M8C Canteen: Admin/backend foundations implemented with hardening depth
M9 Accounting: Completed / Pilot-Ready
M10 Notices/Communication/Chat: Foundation plus provider/attachment/retry depth implemented
M11 Intelligence/AI: Roadmap only
```

Current product readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

Recommended next direction:

```text
Strict Phase Gate 0 from docs/project/SCHOOLOS_IMPLEMENTATION_STATUS_AND_PLAN.md
→ stabilize verification, migrations, seed data, smoke tests, and stale docs
→ harden controlled pilot reliability across M0 and Phase 1 core
→ run staging browser/manual QA for Homework/Timetable, HR/Payroll, Library, Canteen, and Transport
→ deepen existing modules one vertical at a time based on pilot evidence
```

Do not start broad new product fronts until the full verification gate is clean.

Explicitly deferred unless requested:

```text
Angular migration
AI/ML implementation
Deep parent/mobile module expansion beyond the started Flutter companion app
Driver live-trip workflow beyond the started mobile shell
Live transport map/WebSocket UI
Microservices
Biometric workflows
```
