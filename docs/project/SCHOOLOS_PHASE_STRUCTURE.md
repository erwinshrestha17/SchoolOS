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
docs/project/SCHOOLOS_M9_ACCOUNTING_COMPLETION.md
```

Keep this file only as a compatibility pointer for older prompts that still reference `SCHOOLOS_PHASE_STRUCTURE.md`.

---

## Current Position

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
Phase 2A M4 Academics backend: Complete / contract-protected
Phase 2D M9 Accounting: Production Candidate Complete
Current stage: Phase 2A backend complete + Phase 2 foundations + M9 production-candidate completion + Phase 3 operations admin foundations
```

---

## Main Phase Summary

| Phase | Name | Goal | Status |
|---|---|---|---|
| Phase 1 | Pilot-Ready Core School System | Make the system usable for real live-school daily operations and polish it for pilot use. | Completed |
| Phase 2 | Academic, HR, Timetable, and Accounting Expansion | Add academic depth, timetable/homework, HR/payroll, full M9 accounting, controlled parent communication expansion, and cross-module hardening such as QR-based Student Identity. | Phase 2A backend complete; M9 Accounting production-candidate complete; other foundations implemented |
| Phase 3 | Extended School Operations | Add library, transport, canteen, and parent/mobile expansion using shared foundations such as Student QR Identity. | Admin foundations implemented for Library/Transport/Canteen; parent/mobile later |
| Phase 4 | AI, Analytics, Scale, and Enterprise SaaS | Add M11 School Intelligence & Analytics, AI/ML features, analytics platform, scale optimizations, and enterprise SaaS controls. | Roadmap documented; implementation later |

---

## Phase 2 Sub-Phases

- 2A Academics, Exams, CAS, and Report Cards — **backend complete / contract-protected**.
- 2B Homework and Timetable — foundation implemented.
- 2C HR and Payroll — foundation implemented.
- 2D Full M9 Accounting and Finance — **Production Candidate Complete**.
- 2E Parent Communication Expansion — foundation implemented / further hardening later.
- 2F Student Identity QR Foundation — foundation documented / staged for vertical reuse.

### Phase 2A — M4 Academics, Exams, CAS, and Report Cards

Status: **Backend Complete / Contract-Protected**.

Completed backend sequence:

```text
Step 1 — Exam Terms + Assessment Components foundation
Step 2 — Subject Marks Entry
Step 3 — CAS Records
Step 4 — Nepal Grading/GPA Result Preview
Step 5 — Marks Lock/Unlock Workflow Hardening
Step 6 — Report Card Generation Backend Hardening
Step 7 — Promotion Readiness Backend Hardening
Step 8 — Result Publishing + Parent Notification Backend Hardening
Step 9 — Backend Final Hardening + Phase 2A Flow Contract
```

Completed backend scope:

```text
- Tenant-scoped exam term and assessment component APIs.
- Transactional marks bulk upsert with max-mark, absent, withheld, and lock validation.
- CAS create/list/update/delete and bulk upsert.
- Server-side Nepal grading/GPA result preview for student/class results.
- Marks lock request/review/unlock workflow with audit logs.
- Report card generation requiring locked marks and rejecting incomplete/withheld outcomes.
- Promotion readiness based on generated/locked report cards instead of raw marks.
- Result publishing, unpublishing, and parent notification hardening.
- Consent-aware result notification through CommunicationsService.
- Phase 2A flow contract test covering the full backend chain.
```

Latest verified results:

```text
pnpm --filter @schoolos/api test src/academics/phase2a-flow.contract.spec.ts
  PASS: 1 suite / 9 tests

pnpm --filter @schoolos/api test src/integrity/production-contracts.spec.ts
  PASS: 1 suite / 11 tests

pnpm typecheck
  PASS: API + web

pnpm test
  PASS: API 76 suites / 494 tests
  PASS: Web 71 tests
```

Next Phase 2A work:

```text
- Phase 2A frontend/admin UI wired to real APIs.
- Browser smoke/Playwright contracts for the full Phase 2A workflow.
- Report card PDF visual polish.
- Future locked report-card correction/regeneration workflow.
- Deeper academic reports and exports.
```

### Phase 2D — Full M9 Accounting and Finance

Status: **Production Candidate Complete**.

Completed scope:

```text
- Ledger correctness and double-entry enforcement.
- Decimal-safe ledger posting.
- Immutable posted journals.
- Source-based idempotent posting.
- Database-level idempotency constraints.
- Reversal and correction workflows.
- Fiscal period lifecycle: OPEN, LOCKED, CLOSED.
- Fiscal year close/reopen workflow.
- Opening balance workflow.
- Expense/payment/receipt/contra voucher workflows.
- Trial Balance, General Ledger, Cash Book, Income Statement, Balance Sheet.
- VAT/TDS/PF summaries.
- CSV report exports.
- Explicit report account mappings.
- Bank reconciliation.
- Frontend Accounting workspace.
- Granular RBAC permissions, audit coverage, and tenant isolation.
```

Verification passed:

```text
pnpm db:generate
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
```

Remaining future enhancements:

```text
- PDF accounting exports.
- Saved report snapshots and File Registry integration.
- Advanced bank auto-match rules.
- Accounting audit log viewer UI.
- Seeded Playwright accounting workflow tests.
- Production seed review for default Chart of Accounts and report mappings.
```

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
Priority: Phase 2A frontend/admin UI, seeded Accounting browser workflow tests, production seed review for default COA/report mappings, and continued module hardening for Homework/Timetable, HR/Payroll, Library, Transport, and Canteen.
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
