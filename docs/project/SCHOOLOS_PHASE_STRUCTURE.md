# SchoolOS Main Phase Structure

This phase structure has been consolidated into the master SchoolOS memory.

Current source of truth:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Related focused plans:

```text
docs/project/SCHOOLOS_STUDENT_IDENTITY_QR_PLAN.md
docs/project/SCHOOLOS_M11_INTELLIGENCE_ROADMAP.md
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
| Phase 2 | Academic, HR, Timetable, and Accounting Expansion | Add academic depth, timetable/homework, HR/payroll, full M9 accounting, controlled parent communication expansion, and cross-module hardening such as QR-based Student Identity. | Foundation implemented; hardening in progress |
| Phase 3 | Extended School Operations | Add library, transport, canteen, and parent/mobile expansion using shared foundations such as Student QR Identity. | Admin foundations implemented for Library/Transport/Canteen; parent/mobile later |
| Phase 4 | AI, Analytics, Scale, and Enterprise SaaS | Add M11 School Intelligence & Analytics, AI/ML features, analytics platform, scale optimizations, and enterprise SaaS controls. | Roadmap documented; implementation later |

---

## Phase 2 Sub-Phases

- 2A Academics, Exams, CAS, and Report Cards.
- 2B Homework and Timetable.
- 2C HR and Payroll.
- 2D Full M9 Accounting and Finance.
- 2E Parent Communication Expansion.
- 2F Student Identity QR Foundation.

### Phase 2F — Student Identity QR Foundation

Ownership: **M1 Admissions & Student Profiles**.

Goal: create a reusable student identity foundation before Library, Canteen, Transport, and Parent/Mobile workflows depend on it.

Scope:

```text
- Immutable Student ID code generated during student registration/admission.
- Revocable QR credential per student.
- QR code on student ID card PDF/profile.
- QR generation, rotation, and revocation APIs.
- Authenticated QR scan/resolve API.
- Purpose-based scan responses: LIBRARY, CANTEEN, TRANSPORT, ATTENDANCE, GENERAL_STUDENT_LOOKUP.
- Tenant-scoped and permission-scoped QR access.
- Audit logs for generate, rotate, revoke, resolve, and scan actions.
- Biometrics intentionally deferred.
```

Recommended next work:

```text
Harden one existing vertical at a time.
Priority: M9 accounting correctness, production verification, reports/exports, tenant isolation, contract-test alignment, and Student QR Identity foundation before deeper Library/Canteen workflows.
```

---

## Phase 3 Sub-Phases

- 3A Library Management.
- 3B Transport Management.
- 3C Canteen Management.
- 3D Parent and Mobile Expansion.

### Phase 3A — Library Management QR Reuse

Use M1 Student QR Identity to identify student borrowers during issue/return flows. Library owns book/copy barcodes separately; student QR only identifies the borrower.

### Phase 3C — Canteen QR + Wallet Reuse

Use M1 Student QR Identity for canteen counter lookup, wallet purchases, meal/snack serving, duplicate serving prevention, allergy/dietary warning checks, and parent-visible purchase history.

### Phase 3D — Parent and Mobile Expansion

Expose canteen wallet balance, top-up history, purchase history, spending controls, low-balance alerts, and later library borrowed/overdue visibility to parents. Parent APIs must remain guardian/child-scoped.

---

## Phase 4 — AI, Analytics, Scale, and Enterprise SaaS

Phase 4 is owned primarily by **M11 School Intelligence & Analytics**.

Detailed M11 plan:

```text
docs/project/SCHOOLOS_M11_INTELLIGENCE_ROADMAP.md
```

### Phase 4A — School Intelligence Foundation

- Structured `SchoolEvent` capture roadmap across M1-M10.
- Feature snapshot roadmap for students, guardians, teachers, classrooms, and schools.
- Explainable `RiskScoreSnapshot` roadmap.
- `InsightAction` workflow roadmap.
- `AiInferenceRequest` contract roadmap for future cloud and on-device AI.
- Tenant isolation, RBAC, audit, and sensitive-view rules.

### Phase 4B — Rule-Based Operational Intelligence

- Teacher Workload Balance Monitor.
- Substitute Teacher Intelligence.
- Guardian Communication Health Score.
- Academic Year Momentum Tracker.
- Classroom-Level Heat Events.

### Phase 4C — Student Risk and Academic Quality Intelligence

- Sibling Academic Correlation Report.
- Predictive Dropout Engine v1, rule-based first and ML later.
- Student risk dashboard and intervention checklist.
- Exam Paper Difficulty Calibration.
- Tenant-level curriculum gap detection.

### Phase 4D — AI Teacher Assistant and Natural Language Interface

- AI Teaching Assistant for teachers only, with human review.
- Report card remark drafts.
- Lesson plan drafts.
- Homework feedback drafts.
- Notice/message drafts.
- English-first Natural Language School Management Interface using approved query templates.

### Phase 4E — Offline-First and Network Intelligence

- Offline-first AI inference contract.
- Future on-device model support.
- Aggregate-only opt-in School Health Network Intelligence.
- Cross-school curriculum benchmarking with anonymization and platform audit.

### Phase 4F — Scale Optimization and Enterprise SaaS

- Analytics read models.
- Background intelligence jobs.
- Model/version governance.
- Platform intelligence dashboards.
- Enterprise observability.
- Plan-based AI/analytics limits.

### Phase 4 Safety Rule

Do not start AI/ML implementation until reliable production data exists and the M11 event/snapshot/risk-score foundation is approved. M11 outputs must never automatically punish students, block fees, suspend access, make payroll/staff discipline decisions, or publicly rank teachers.

---

## Rule

Do not expand every Phase 2/3 module at once. Keep existing Phase 2 and Phase 3 admin foundations focused, tenant-scoped, tested, production-aware, and clear about deferred parent/mobile, driver app, live map/WebSocket, inventory/vendor, AI implementation, and biometric scope.
