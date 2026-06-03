# SchoolOS Business Requirements Document 2026

**Product:** SchoolOS  
**Market:** Nepal-focused school management SaaS  
**Target schools:** Montessori to Class 10 first, with future K-12/+2 extensibility  
**Document type:** Business Requirements Document  
**Status:** Draft derived from `docs/product/SCHOOLOS_PRD_COMBINED_MASTER_2026.md`  
**Last updated:** 2026-06-03

---

## 1. Purpose

This BRD explains the business need, market opportunity, target customers, commercial assumptions, success metrics, and business risks for SchoolOS.

It does not replace the PRD. The PRD remains the product master document. This BRD focuses on **why SchoolOS should exist, who it serves, how it wins, and what business outcomes it must produce**.

---

## 2. Business Problem

Many Nepali schools still manage operations using fragmented tools:

- Paper registers.
- Excel sheets.
- Manual fee ledgers.
- Offline accounting tools.
- Attendance notebooks.
- Printed/PDF report-card templates.
- WhatsApp/Viber groups.
- Unstructured Google Drive folders.
- Disconnected parent communication channels.

This creates duplicate data entry, weak financial visibility, inconsistent student records, fee/accounting mismatch risk, poor auditability, slow communication, weak privacy, and difficult official-reporting preparation.

SchoolOS solves this by providing a single tenant-isolated operating system for school operations, academics, finance, communication, files, reporting-readiness, and parent engagement.

---

## 3. Business Vision

SchoolOS should become the default operating system for Nepali schools by offering a reliable, locally relevant, financially accurate, and easy-to-use SaaS platform.

Core business thesis:

```text
One login, one school ledger, one student record, one audit trail.
```

SchoolOS should be positioned as a **Nepal-first school operating system**, not only as a generic student information system.

---

## 4. Business Goals

1. Enable multiple schools to run independently on one SaaS platform.
2. Support controlled pilot deployment after staging verification.
3. Provide strong coverage for school operations, fees, accounting, academics, attendance, communication, and parent access.
4. Build trust through accurate receipts, ledgers, reports, audit trails, and protected files.
5. Prepare a foundation for future analytics, mobile expansion, provider integrations, and SaaS billing automation.
6. Differentiate through Nepal-first workflows, cashier operations, IEMIS readiness, protected File Registry, and strong tenant isolation.

---

## 5. Target Customers

### 5.1 Primary customers

- Private Nepali schools from Montessori to Class 10.
- Small to mid-sized schools that currently rely on manual records, Excel, messaging apps, or disconnected tools.
- Schools that need better fee collection, attendance, parent communication, report cards, and financial visibility.

### 5.2 Future customers

- +2 colleges and K-12 institutions.
- Multi-branch school groups.
- Schools requiring deeper transport, canteen, HR/payroll, accounting, or reporting workflows.

---

## 6. Target Users and Business Value

| User | Business value SchoolOS must deliver |
|---|---|
| School Owner / Principal | Operational visibility, collections overview, attendance gaps, reporting readiness, risk alerts. |
| School Admin | Faster student, guardian, class, document, notice, and setup workflows. |
| Accountant / Finance Staff | Accurate invoices, payments, receipts, refunds, reversals, ledgers, reconciliation, accounting reports. |
| Cashier | Fast fee collection, partial payments, receipt printing/sharing, day-end close. |
| Teacher | Simple attendance, homework, marks/CAS, timetable, and class communication workflows. |
| Parent / Guardian | Child-specific dues, receipts, attendance, homework, notices, report cards, and future transport/canteen visibility. |
| Student | Own timetable, homework, notices, attendance, report cards, and allowed library/canteen information. |
| Librarian | Book/copy control, issue/return, fines, borrower lookup, reports. |
| Transport Staff / Driver | Route/trip/student boarding workflows and future live/stale location support. |
| Canteen Operator | Fast POS, wallet, QR serving, meal plans, spending controls, inventory. |
| HR / Payroll Staff | Staff records, leave, salary, payroll, payslips, payroll posting. |
| SchoolOS Platform Operator | Tenant management, subscriptions, provider readiness, feature control, audit, support override. |

---

## 7. Market Context

SchoolOS competes with both software and manual workflows:

| Alternative | Strength | Weakness SchoolOS can target |
|---|---|---|
| Paper/Excel/manual ledgers | Familiar and low cost | Error-prone, no audit, hard to reconcile, no parent visibility. |
| WhatsApp/Viber communication | Already adopted | Unstructured, privacy risk, no formal read tracking or audit. |
| Generic school ERP/SIS | Broad functionality | Often not Nepal-first or IEMIS-aware. |
| Open-source ERP/SIS tools | Flexible foundation | Requires heavy localization and school-specific setup. |
| Nepal-local school systems | Local support claims | Public evidence may be weak on tenant isolation, file privacy, audit, and accounting correctness. |

---

## 8. Differentiation Strategy

SchoolOS should win through:

1. Nepal-first school workflows.
2. Strong fee, cashier, receipt, and accounting correctness.
3. IEMIS/reporting readiness as a validation workflow.
4. Tenant-safe SaaS with audited support override.
5. Parent/teacher/mobile purpose-limited APIs.
6. Protected File Registry for documents, receipts, media, payslips, and exports.
7. QR identity for student operations.
8. Library, transport, canteen, HR, payroll, academics, communication, and accounting in one connected platform.
9. Low-bandwidth and school-office friendly UX.
10. Transparent provider readiness for eSewa, Khalti, storage, notifications, queues, and reports.

---

## 9. Business Scope

### 9.1 Controlled pilot MVP

The controlled pilot should include:

1. Multi-tenant login and RBAC.
2. Student profiles and guardian linkage.
3. Attendance with correction workflow.
4. Fees, receipts, refunds/reversals, cashier close, and ledgers.
5. Accounting core and financial reports.
6. Notices and read/delivery tracking.
7. Academics, marks, CAS, report cards, and result publishing.
8. Homework/timetable pilot-ready flows.
9. HR/payroll pilot-ready flows.
10. Library, transport, and canteen admin foundations.
11. Protected File Registry and report export flows.
12. Browser smoke coverage and staging verification.

### 9.2 Immediate pilot exclusions

The immediate pilot should not include:

- Deep parent/mobile module expansion beyond companion-app foundation.
- Full driver live-trip workflow.
- Live transport map/WebSocket/SSE UI.
- AI/ML features.
- Angular migration.
- Microservices migration.
- Biometric workflows.
- Unapproved real payment-provider collection.

---

## 10. Revenue and Commercial Assumptions

The pricing model should be validated during pilot. Initial assumptions:

1. SchoolOS is a B2B SaaS product sold to schools, not directly to parents.
2. Pricing may be based on school size, active students, enabled modules, support tier, and storage/report usage.
3. Future plans may include module-based tiers such as Core, Finance, Parent Portal, Advanced Operations, and Enterprise/Multi-branch.
4. Real payment-provider integration should not be monetized until verified in sandbox/staging and reconciled against SchoolOS receipts.
5. Support, onboarding, data import, and custom report setup may be billed separately for larger schools.

---

## 11. Pilot Success Metrics

| Metric | Target |
|---|---:|
| Successful pilot schools onboarded | 1-3 |
| Critical P0 workflow blockers | 0 |
| Tenant isolation incidents | 0 |
| Fee receipt/accounting mismatch | 0 |
| Attendance marking completion | 85%+ pilot class days initially; 95%+ after stabilization |
| Parent access success | 70%+ target parent cohort can access child data |
| Parent notice read rate | 70%+ |
| Staging verification pass rate | 100% or explicitly waived |
| Dashboard fatal route errors | 0 for pilot modules |
| Payment provider reconciliation | 100% deterministic final state for tested callbacks/lookups |

---

## 12. Product Success Metrics

| Metric | Target |
|---|---:|
| Monthly active schools | 80%+ onboarded schools |
| Fee collections recorded through SchoolOS | 80%+ |
| Parent/guardian activation | 50%+ linked guardians |
| Support tickets per school | Decreasing month over month |
| Admin workflow time saved | 30%+ |
| Report/export success rate | 99%+ |

---

## 13. Business Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Tenant isolation bug | Severe data breach and trust loss | Tenant tests, fail-closed access, audited support override. |
| Financial inconsistency | Loss of school trust | Idempotency, double-entry accounting, reconciliation tests, reversal audit. |
| Dirty legacy data | Broken imports and duplicate identities | Staged import, duplicate detection, review queue. |
| Too many modules expanded at once | Instability and pilot failure | Phase gates and hardening before expansion. |
| Weak browser smoke coverage | Pilot route failures | Seeded browser smoke tests before pilot. |
| Provider misconfiguration | Failed payments, notifications, storage, or exports | Provider readiness checks and explicit disabled/mock states. |
| Low parent adoption | Reduced communication value | Simple parent access, clear onboarding, child-scoped views. |
| Poor school-office usability | Low staff adoption | Cashier/teacher/admin-specific workflows and low-bandwidth UX. |
| Unsupported official reporting claim | Compliance/trust risk | Validate against real templates before claiming final IEMIS compliance. |

---

## 14. Business Constraints

1. Pilot reliability is more important than feature breadth.
2. Financial correctness is more important than UI polish alone.
3. Tenant isolation and file privacy are non-negotiable.
4. Provider integrations must be honest: disabled/mock/configured modes must be visible.
5. Official-reporting exports must not guess unmapped fields.
6. AI/analytics should wait until reliable production data exists.
7. Microservices and Angular migration are out of scope for immediate pilot.

---

## 15. Business Acceptance Criteria

SchoolOS is business-ready for controlled pilot when:

1. One pilot school can operate core student, attendance, fee, receipt, accounting, notice, and academic workflows without fatal blockers.
2. Fee ledgers, receipts, and accounting reports reconcile.
3. Parent access is child-scoped and safe.
4. School A cannot access School B data, files, reports, or messages.
5. Suspended tenants are blocked consistently.
6. Protected exports and files work through File Registry.
7. Pilot users can complete daily cashier, teacher, admin, and principal workflows.
8. Known gaps are documented and accepted before pilot launch.

---

## 16. Relationship to Other Documents

| Document | Purpose |
|---|---|
| PRD | Product direction, modules, user needs, edge cases, acceptance criteria. |
| BRD | Business need, market, customer value, risks, success metrics. |
| SRS | Exact software/system requirements and non-functional requirements. |
| FRS | Feature-by-feature functional behavior, inputs, outputs, states, validation, acceptance. |
| Technical Design | Architecture, modules, APIs, database, queues, integrations, deployment. |
| Test Plan | Manual, automated, e2e, regression, security, performance verification. |
