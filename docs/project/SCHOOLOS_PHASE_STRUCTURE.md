# SchoolOS Main Phase Structure

This phase structure has been consolidated into the master SchoolOS memory.

Current source of truth:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Keep this file only as a compatibility pointer for older prompts that still reference `SCHOOLOS_PHASE_STRUCTURE.md`.

---

## Current Position

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
Current stage: Phase 2 implemented foundations + Phase 3 operations admin foundations
```

---

## Main Phase Summary

| Phase | Name | Goal | Status |
|---|---|---|---|
| Phase 1 | Pilot-Ready Core School System | Make the system usable for real live-school daily operations and polish it for pilot use. | Completed |
| Phase 2 | Academic, HR, Timetable, and Accounting Expansion | Add academic depth, timetable/homework, HR/payroll, full M9 accounting, and controlled parent communication expansion. | Foundation implemented; hardening in progress |
| Phase 3 | Extended School Operations | Add library, transport, canteen, and parent/mobile expansion. | Admin foundations implemented for Library/Transport/Canteen; parent/mobile later |
| Phase 4 | AI, Analytics, Scale, and Enterprise SaaS | Add AI/ML features, analytics platform, scale optimizations, and enterprise SaaS controls. | Later |

---

## Phase 2 Sub-Phases

- 2A Academics, Exams, CAS, and Report Cards.
- 2B Homework and Timetable.
- 2C HR and Payroll.
- 2D Full M9 Accounting and Finance.
- 2E Parent Communication Expansion.

Recommended next work:

```text
Harden one existing vertical at a time.
Priority: M9 accounting correctness, production verification, reports/exports, tenant isolation, and contract-test alignment.
```

---

## Rule

Do not expand every Phase 2/3 module at once. Keep existing Phase 2 and Phase 3 admin foundations focused, tenant-scoped, tested, production-aware, and clear about deferred parent/mobile, driver app, live map/WebSocket, inventory/vendor, and AI scope.
