# SchoolOS Master Project Memory

**Status:** Phase 2A M4 Academics backend complete + Phase 2D M9 Accounting Production Candidate Complete + Phase 2/3 foundations in progress  
**Product:** Production-grade multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10  
**Architecture:** NestJS modular monolith, PostgreSQL/Prisma, Redis/BullMQ, Next.js dashboard

This is the consolidated source of truth for SchoolOS. It merges the long-term project roadmap, main phase structure, platform/settings memory, scalability roadmap, current repo analysis summary, Student Identity QR plan, M9 Accounting completion note, M11 Intelligence roadmap, and pricing/entitlements plan.

Focused companion docs:

```text
PROJECT_CONTEXT.md
ARCHITECTURE.md
DEVELOPMENT_RULES.md
docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md
docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md
```

Do not recreate separate phase structure, scalability, student QR, M9, M11, pricing, platform-core, or settings-boundary docs unless the project grows enough to justify splitting them again.

---

## 1. Current State

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core Foundation Depth: Completed
Phase 2A M4 Academics backend: Completed / Contract-Protected
Phase 2D M9 Accounting: Production Candidate Complete
Current stage: Phase 2A backend complete + Phase 2 foundations + M9 production-candidate completion + Phase 3 operations admin foundations
```

Readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

Recommended near-term direction:

```text
Repo Verification & Stabilization Sprint
→ run full verification gate
→ fix any remaining Prisma/schema/typecheck/test blockers
→ stabilize Homework/Timetable after recent verification follow-ups
→ wire Phase 2A Academics admin UI to completed APIs
→ add authenticated Playwright browser smoke tests
→ prepare controlled pilot staging
```

Do not expand Phase 2/3 modules broadly at once. Existing Phase 3 admin modules may be polished and hardened, but parent/mobile and driver-facing experiences remain separate future scope.

---

## 2. Core Architecture

```text
Monorepo: pnpm
Backend: NestJS modular monolith
Database: PostgreSQL + Prisma
Cache/queues: Redis + BullMQ
Shared package: packages/core
Current frontend: Next.js dashboard in apps/web
Future frontend target: apps/web public site + apps/admin Angular dashboard later
```

Rules:

- Keep the modular monolith first.
- Do not introduce microservices unless scale/team/deployment/compliance clearly justify it.
- Do not migrate to Angular yet.
- Do not rename `tenantId` to `schoolId` without a deliberate migration.
- Backend-first for data integrity.
- UI must consume real APIs.
- Every tenant-owned query must be scoped by authenticated `tenantId`.
- Every business-critical write must be audited.

---

## 3. Three-Plane SaaS Architecture

SchoolOS has three logical planes inside the same modular monolith.

| Plane | Purpose | Frontend | Backend |
|---|---|---|---|
| Platform Control Plane | SchoolOS company/operator administration | `/platform/*` | `/platform/*` |
| Tenant Configuration Plane | School-owned settings/configuration | `/dashboard/settings/*` | `/settings/*` or `/tenant-settings/*` |
| School Operations Plane | Daily school workflows | `/dashboard/*` | `/students`, `/attendance`, `/finance`, `/notices`, `/academics`, `/homework`, `/timetable`, `/payroll`, `/accounting`, `/library`, `/transport`, `/canteen` |

Rules:

- Do not mix SchoolOS SaaS billing with school fee collection.
- School users must not access platform settings.
- Platform support/tenant override must require an explicit reason and audit log.
- Keep all planes inside the modular monolith for now.

---

## 4. Production Module Map

| Module | Name | Current Status |
|---|---|---|
| M0 | Platform Core / SaaS Starter | Foundation depth completed; SaaS billing/API keys/webhooks later |
| M1 | Admissions & Student Profiles | Phase 1A/1B complete / pilot-ready |
| M2 | Smart Attendance | Phase 1A/1B complete / pilot-ready |
| M3 | Fees & Receipts | Phase 1A/1B complete / pilot-ready |
| M4 | Exams, CAS & Report Cards | Phase 2A backend complete / admin UI next |
| M5 | Activity Feed & Milestones | Phase 1A/1B complete with media/moderation hardening foundations |
| M6 | Homework & Timetable | Phase 2 foundation implemented; stabilization priority |
| M7 | HR & Payroll | Phase 2 foundation implemented; deeper tests and UI polish needed |
| M8A | Library Management | Phase 3 admin foundation implemented |
| M8B | Transport Management | Phase 3 admin/trip/location foundation implemented; live/driver/parent later |
| M8C | Canteen Management | Phase 3 admin/wallet/POS foundation implemented; inventory/vendor later |
| M9 | Accounting & Finance | Phase 2D production-candidate complete |
| M10 | Notices & Communication | Phase 1A/1B + parent-teacher chat foundation |
| M11 | School Intelligence & Analytics | Roadmap only; implementation deferred |

---

## 5. Phase Structure

### Phase 1 — Pilot-Ready Core School System

Status: **Completed / Pilot-Ready**.

Includes:

```text
Auth/RBAC/tenant isolation
Admissions and student profiles
Attendance core workflow
Fee collection and receipts
Activity feed and milestones
Notices, consent, and delivery records
Dashboard shell and Phase 1 screens
Phase 1B operational depth, reports, exports, lifecycle actions, notification center, global search, cashier close, and PDF polish foundation
```

### Phase 2 — Academic, HR, Timetable, Communication, and Accounting Expansion

Status: **Partially complete**.

```text
2A Academics, Exams, CAS, Report Cards — backend complete / contract-protected
2B Homework and Timetable — foundation implemented; stabilization priority
2C HR and Payroll — foundation implemented; deeper lifecycle/accounting tests needed
2D M9 Accounting and Finance — production-candidate complete
2E Parent Communication Expansion — foundation implemented / further hardening later
2F Student Identity QR Foundation — approved cross-module foundation; implement before deeper Library/Canteen/Transport QR usage
```

### Phase 3 — Extended School Operations

Status: **Admin foundations implemented; production depth incomplete**.

```text
Library admin foundation
Transport admin/trip/location foundation
Canteen admin/wallet/POS foundation
Parent/mobile, driver app, live transport map/WebSocket/SSE, full canteen inventory/vendor/profit-loss later
```

### Phase 4 — AI, Analytics, Scale, and Enterprise SaaS

Status: **Roadmap documented; implementation deferred**.

Phase 4 is owned primarily by M11 School Intelligence & Analytics. Do not implement AI/ML until reliable production data exists and M11 foundations are approved.

---

## 6. Phase 2A — M4 Academics Backend Completion

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

Next Phase 2A work:

```text
- Phase 2A frontend/admin UI wired to real APIs.
- Browser smoke/Playwright contracts for the full Phase 2A workflow.
- Report card PDF visual polish.
- Future locked report-card correction/regeneration workflow.
- Deeper academic reports and exports.
```

---

## 7. Student Identity QR Foundation

Status: **Approved cross-module foundation. Implementation should happen before deeper Phase 3 QR-dependent workflows.**

Student QR identity belongs to **M1 Admissions & Student Profiles**, not Library-only, Canteen-only, or Transport-only.

Approved direction:

```text
Implement now / near-term:
- Immutable Student ID code generated during registration/admission.
- Revocable QR credential per student.
- QR code on student ID cards.
- Authenticated QR scan/resolve API.
- Purpose-based QR scan responses.
- Reuse QR identity in Library, Canteen, optional Transport, and parent/mobile views.

Do not implement now:
- Fingerprint registration.
- Face scan registration.
- Biometric attendance.
- Biometric canteen access.
- Biometric library access.
- Storage or processing of biometric templates.
```

Ownership:

```text
M1 Student Identity Foundation owns:
- Immutable student code.
- Student QR credential lifecycle.
- QR generation/rotation/revocation.
- QR scan/resolve security boundary.
- QR block on student ID card.

M8A Library consumes it.
M8C Canteen consumes it.
M8B Transport may consume it where useful.
M10 Notifications reacts to wallet, overdue, boarding/drop, and parent-visible events.
M3/M9 handle money/accounting impact for wallet, fines, and corrections.
```

Required foundation scope:

```text
1. Confirm immutable Student ID code is generated during registration/admission.
2. Add StudentQrCredential model.
3. Generate QR credential for each admitted/active student.
4. Add QR image generation endpoint for ID cards and student profile.
5. Add QR to student ID card PDF.
6. Add QR rotate/revoke actions for lost or damaged cards.
7. Add authenticated QR scan/resolve API.
8. Add purpose-based scan responses: LIBRARY, CANTEEN, TRANSPORT, ATTENDANCE, GENERAL_STUDENT_LOOKUP.
9. Add audit logs for generate, rotate, revoke, resolve, and scan actions.
10. Add permission and tenant-isolation tests.
```

Security rules:

```text
- QR must not contain student name, guardian phone, address, health data, wallet balance, or other PII.
- QR should contain only a random secure token or URL containing a token.
- Store only token hash in the database.
- QR scan must require authentication.
- QR scan must be tenant-scoped by tenantId.
- QR scan response must be purpose-specific and role-limited.
- Parents can only resolve their own child.
- Teachers can only resolve assigned students unless permission allows more.
- Canteen staff can only see canteen-safe data.
- Librarians can only see library-safe data.
- Transport drivers can only see assigned-route students.
- Admin/principal access remains tenant-scoped and audited.
- QR credentials must be revocable and rotatable.
```

Suggested model:

```prisma
model StudentQrCredential {
  id            String          @id @default(cuid())
  tenantId      String
  studentId     String
  tokenHash     String
  status        StudentQrStatus @default(ACTIVE)
  createdAt     DateTime        @default(now())
  rotatedAt     DateTime?
  revokedAt     DateTime?
  lastScannedAt DateTime?

  student       Student         @relation(fields: [studentId], references: [id])

  @@unique([tenantId, studentId])
  @@unique([tokenHash])
  @@index([tenantId, studentId])
  @@index([tenantId, status])
}

enum StudentQrStatus {
  ACTIVE
  REVOKED
}
```

Suggested APIs:

```text
POST /api/v1/students/:studentId/qr
POST /api/v1/students/:studentId/qr/rotate
POST /api/v1/students/:studentId/qr/revoke
GET  /api/v1/students/:studentId/qr-image
POST /api/v1/students/qr/resolve
```

Implementation order:

```text
1. Add StudentQrCredential model and indexes.
2. Generate QR credential during student registration/admission or first ID-card generation.
3. Add QR image generation service.
4. Add QR to student ID card PDF.
5. Add QR management actions in student detail page.
6. Add scan/resolve API with purpose-based response.
7. Add scan audit logs.
8. Add Library QR borrower lookup.
9. Add Canteen wallet ledger.
10. Add Canteen QR purchase flow.
11. Add Parent wallet and purchase history.
12. Add parent spending controls and notifications.
```

Canteen wallet rule:

```text
Use immutable wallet movements. Do not silently edit balances.
Confirmed financial events must later post through M9 Accounting boundaries.
```

Biometrics are explicitly out of scope until QR identity is stable, parent trust is established, legal/privacy rules are reviewed, and the product has strong consent, retention, encryption, audit, and deletion workflows.

---

## 8. M9 Accounting Completion and Rules

M9 Accounting is **Production Candidate Complete**.

Completed scope:

```text
- Ledger correctness and double-entry enforcement.
- Decimal-safe ledger posting with PostgreSQL numeric / Prisma Decimal.
- Immutable posted journals.
- Source-based idempotent posting.
- Database-level idempotency constraints.
- Reversal and correction workflows.
- Fiscal period lifecycle: OPEN, LOCKED, CLOSED.
- Fiscal year close/reopen workflow.
- Opening balance workflow.
- Voucher workflows for expense, payment, receipt, and contra use cases.
- Trial Balance backend.
- General Ledger backend.
- Cash Book backend.
- Income Statement backend.
- Balance Sheet backend.
- VAT/TDS/PF summaries.
- CSV accounting report exports.
- Explicit report account mappings.
- Bank reconciliation.
- Frontend Accounting workspace.
- Granular RBAC permissions.
- Audit coverage for critical accounting actions.
- Tenant-scoped accounting queries.
- AccountingPostingService ledger boundary.
```

Non-negotiable M9 rules:

```text
1. Never edit confirmed/posting financial truth directly.
2. Use reversal/correction/adjustment entries for mistakes.
3. Enforce debit = credit for posted journals.
4. Reject posting into LOCKED or CLOSED fiscal periods.
5. Keep fiscal year/period close and reopen explicit, privileged, reasoned, and audited.
6. Every source-driven journal must link to sourceModule/sourceType/sourceId/postingType.
7. Other modules must post through AccountingPostingService or an approved accounting boundary.
8. Use Prisma Decimal/PostgreSQL numeric; never JavaScript floating point for money.
9. Reports must come from backend ledger data, not frontend calculations.
10. Audit posting, approval, reversal, correction, closing, reopening, reconciliation, and exports.
```

Remaining M9 future enhancements:

```text
- PDF accounting exports.
- Saved report snapshots and File Registry integration for generated reports.
- Advanced bank reconciliation auto-match rules.
- Accounting audit log viewer UI.
- Seeded Playwright accounting workflow tests.
- Production seed review for default Chart of Accounts and report mappings.
- Optional background export workers for large reports if tenant size requires it.
```

---

## 9. M11 School Intelligence & Analytics Roadmap

Status: **Roadmap only. No implementation yet.**

M11 is the future intelligence and analytics layer. It must not be implemented as random AI features. It starts with structured data capture, safe read models, feature snapshots, explainable rules, human-reviewed recommendations, and only later ML/LLM features after reliable production data exists.

Non-negotiable M11 rules:

```text
- Documentation and roadmap updates are allowed now.
- Do not implement M11 product features until reliable production data exists.
- Start with explainable rule-based analytics, not model-first AI.
- No automated punishment from risk scores.
- No fee blocking, student suspension, payroll decision, staff discipline, or public ranking from AI/risk scores.
- Human review is required before AI output becomes an official communication, report, record, or action.
- Sensitive intelligence views are principal/admin-only unless explicitly designed otherwise.
- Cross-school analytics require anonymization, aggregation, explicit opt-in, and platform audit.
- Every intelligence read/write must remain tenant-scoped by tenantId unless it is an approved platform aggregate.
- Every sensitive insight access must be audited.
```

M11 ownership:

```text
Module: M11 — School Intelligence & Analytics
Backend: apps/api/src/intelligence/*
API: /api/v1/intelligence/*
School dashboard: /dashboard/intelligence/*
Platform/network intelligence: /platform/intelligence/*
```

M11 consumes safe events and snapshots from M1-M10. It should not bypass module boundaries or directly mutate operational records owned by other modules.

Foundation concepts for future implementation:

```text
SchoolEvent
StudentWeeklyFeatureSnapshot
TeacherWeeklyFeatureSnapshot
GuardianWeeklyFeatureSnapshot
ClassroomWeeklyFeatureSnapshot
SchoolWeeklyFeatureSnapshot
RiskScoreSnapshot
InsightAction
AiInferenceRequest
```

Phase 4 implementation order:

```text
4A — School Intelligence Foundation
4B — Rule-Based Operational Intelligence
4C — Student Risk and Academic Quality Intelligence
4D — AI Teacher Assistant and Natural Language Interface
4E — Offline-First and Network Intelligence
4F — Scale Optimization and Enterprise SaaS
```

---

## 10. Pricing Tiers and Entitlements Plan

Status: **Roadmap only. No implementation yet.**

Positioning:

```text
Nepal-ready School Operating System for modern schools.
```

Recommended commercial packaging:

```text
Tier 1: SchoolOS Core
Tier 2: SchoolOS Professional
Tier 3: SchoolOS Intelligence
Optional add-ons: Transport GPS, Canteen, Library, SMS bundle, AI credits, Branded Parent App, Advanced Accounting, Custom Reports
```

Technical golden rule:

```text
Plan controls what the school bought.
Feature entitlement controls what the tenant can access.
RBAC controls what the user can do.
Usage limits control how much they can use.
Frontend uses entitlements only for display.
Backend enforces entitlements for security.
```

Do not hardcode plan names into feature access logic. Use feature keys.

Critical boundary:

```text
SchoolOS SaaS billing = SchoolOS company charges schools.
M3/M9 school finance = schools collect money from parents/students.
Do not mix these accounting domains.
```

---

## 11. Scalability Rules

Every new feature must answer:

```text
1. Which module owns this feature: M0 or M1-M11?
2. Which backend folder/API namespace/frontend route owns it?
3. Which tenant owns this data?
4. Which role/permission can access it?
5. Is the list paginated?
6. Which index supports the main query?
7. Does the write need a transaction?
8. Is the operation idempotent?
9. Should this be sync or queued?
10. Does it require audit logging?
11. Does it affect accounting/ledger?
12. What tests prove tenant isolation and permissions?
13. If intelligence/AI is involved, is the output explainable and human-reviewed?
14. If pricing/tiered access is involved, which feature key, entitlement, and usage limit controls access?
```

Implementation order:

```text
Feature -> tenant isolation -> indexes -> pagination -> queue slow work -> audit sensitive actions -> tests -> verification
```

---

## 12. Current Repo Analysis Summary

```text
Full SchoolOS vision: around 70-80% implemented
Phase 1 pilot product: around 90-95% implemented
Phase 2A M4 Academics backend: complete / contract-protected
M9 Accounting: production-candidate complete
```

Module estimates:

| Module | Estimated Completion |
|---|---:|
| Auth/Security/Tenant | 90-95% |
| Platform Control Plane | 65-75% |
| M1 Admissions & Student Profiles | 90-95% |
| M2 Attendance | 85-90% |
| M3 Fees & Receipts | 85-90% |
| M5 Activity Feed | 75-85% |
| M10 Notices & Communication | 85-90% |
| M4 Academics | 80-90% |
| M6 Homework & Timetable | 60-70% |
| M7 HR & Payroll | 65-75% |
| M9 Accounting | 95-100% |
| M8A Library | 45-55% |
| M8B Transport | 45-55% |
| M8C Canteen | 45-55% |
| M11 Intelligence / AI | 0% implementation |

Biggest risks:

```text
- Phase 2A backend is complete but still needs admin UI wiring and browser smoke tests.
- Existing Phase 2/3 breadth without enough depth outside M4 and M9.
- Homework/Timetable schema/service/test stability after recent verification follow-ups.
- Pilot operations exposing real-world data-entry, fee, attendance, guardian-contact, PDF, and slow-network issues.
- Parent/mobile portal, driver app, live map/WebSocket, full canteen inventory/vendor workflows, and AI/ML implementation remain intentionally unbuilt.
- Tiered pricing and entitlements must be enforced backend-side before broad paid rollout; sidebar hiding alone is not security.
```

---

## 13. Verification Commands

Run relevant checks after meaningful changes:

```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
pnpm smoke:phase1
```

After recent verification follow-ups, rerun the full gate locally before treating the repo as green.

---

## 14. Future Codex Prompt Format

```text
Read these first:
- PROJECT_CONTEXT.md
- ARCHITECTURE.md
- DEVELOPMENT_RULES.md
- docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
- docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
- docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md when planning implementation order
- docs/project/SCHOOLOS_PLATFORM_AND_SETTINGS.md when touching platform/settings boundaries

Task:
[exact feature/change]

Constraints:
- Do not rewrite unrelated files.
- Keep NestJS modular monolith.
- Keep tenantId as the tenant/school boundary.
- Keep all tenant-owned reads/writes tenant-scoped.
- Keep platform, tenant settings, and school operations route boundaries separate.
- Add pagination/filtering for growing lists.
- Review/add indexes for high-volume queries.
- Move slow/retryable/provider/report/PDF/intelligence jobs to BullMQ where appropriate.
- Add validation, error handling, audit logs, and tests.
- Do not implement AI features until reliable production data and M11 foundations exist.
- Enforce plan/feature access backend-side; frontend gating is display only.
- Run relevant verification commands.

Return:
- Summary
- Files changed
- Backend/API/frontend ownership decisions
- Scalability decisions
- Tests run
- Verification results
- Remaining gaps
```
