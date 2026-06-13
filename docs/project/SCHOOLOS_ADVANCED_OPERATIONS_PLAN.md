# SchoolOS Advanced Operations Plan

**Status:** Active pre-AI implementation blueprint  
**Scope:** Nepal-first advanced school operations before M11 School Intelligence / AI  
**Last updated:** 2026-06-13  
**Relationship to existing docs:** This document expands the module-wise backlog in `docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md` without replacing the PRD, FRS, architecture/security guide, production runbook, or M12 Learning Layer plan.

---

## 1. Purpose

SchoolOS must become a reliable, advanced school operating platform before any AI runtime is introduced. This plan defines non-AI, production-oriented features that can be implemented module by module for Nepali schools.

The goal is to deepen real school workflows around:

```text
1. Tenant onboarding and SaaS operations
2. Admissions and student lifecycle
3. Attendance and parent notifications
4. Fees, receipts, cashier close, and reconciliation
5. Academics, exams, report cards, and promotion
6. Homework, timetable, and substitutions
7. HR, leave, payroll, and staff self-service
8. Library, transport, canteen, and accounting
9. Parent/student/staff/driver mobile self-service
10. Approval workflows, rules-based automation, analytics, exports, and document templates
```

This is intentionally **pre-AI**. It must use deterministic workflows, explicit business rules, human approvals, audit trails, and tenant-scoped data access.

---

## 2. Nepal-School Operating Context

SchoolOS should optimize for the way Nepali schools actually operate, not only for a generic ERP model.

| Nepal-school reality | SchoolOS product implication |
|---|---|
| Cash, bank deposit, cheque, QR/wallet, and online payment references may coexist | Fee collection must support multiple modes, references, cashier close, and reconciliation. |
| Parent app usage may be inconsistent | Important notices, fee reminders, attendance alerts, and transport messages need SMS/push/email/in-app fallback behavior. |
| Schools often use mixed Nepali and English | Notices, reports, receipts, certificates, and templates must be localization-ready. |
| Internet can be unstable | Attendance, homework viewing, parent summaries, and driver workflows need offline/cache/retry states where practical. |
| Student records may begin in paper/Excel | CSV import, preview, validation errors, duplicate review, and legacy import batches are required. |
| IEMIS-style reporting pressure exists | SchoolOS should maintain reporting-ready fields and validation/export readiness, without claiming unsupported direct government integration. |
| SEE and Grade 11-12 workflows matter | Academics must support exam terms, report cards, practicals, projects, streams, subject combinations, symbol/registration-style fields, and board-prep records. |
| School owners need operational control | Principal dashboards, approvals, audit logs, exports, financial snapshots, and staff/fee/attendance summaries are required. |
| Schools may have smart boards or shared computer labs before 1:1 student devices | Learning should prioritize teacher-led board mode, lab mode, and printable fallbacks before adaptive/AI learning. |
| Transport and student safety are selling points | Routes, stops, vehicles, drivers, GPS status, boarding/deboarding, emergency contacts, and stale-location warnings are needed. |

---

## 3. Implementation Guardrails

These rules apply to every feature in this plan:

1. Keep the NestJS modular monolith.
2. Keep all tenant-owned reads, writes, jobs, exports, file access, and analytics scoped by authenticated `tenantId`.
3. Keep parent, student, driver, and mobile APIs purpose-limited; do not expose admin-shaped responses.
4. Keep money flows idempotent and auditable.
5. Use reversal/correction workflows for confirmed financial records; do not edit confirmed records silently.
6. Keep private files behind File Registry and StorageService boundaries.
7. Require reason, actor, timestamp, and audit trail for sensitive actions.
8. Avoid fake/mock production data.
9. Keep provider-disabled/mock modes explicit in the UI.
10. Do not implement AI/ML/LLM runtime under this plan.
11. Add browser/mobile smoke coverage for user-facing workflows before claiming production readiness.
12. Add ownership and cross-tenant denial tests for every new parent/student/mobile/driver endpoint.

---

## 4. Recommended Build Order

### Phase A — Pre-AI Pilot Depth

1. Tenant onboarding wizard.
2. Student lifecycle and IEMIS-ready fields.
3. Advanced fee workflows.
4. Attendance automation and offline sync polish.
5. Parent/student mobile self-service.
6. Communication read receipts and follow-ups.
7. Exam/report-card/certificate generation.
8. Approval workflow engine.
9. Rules-based automation engine.
10. Descriptive analytics dashboards.

### Phase B — Premium Private-School Operations

1. Timetable conflict and substitution engine.
2. Transport GPS/driver/parent workflow hardening.
3. Canteen POS and wallet controls.
4. Library scanner-first operations.
5. HR leave/payroll self-service.
6. Accounting reconciliation polish.
7. Grade 11-12 streams, practicals, projects, and board-prep fields.
8. Data export center and document template system.

### Phase C — SaaS Maturity Before AI

1. Usage-based plan limits.
2. Add-on/marketplace-style module entitlements.
3. Provider health center.
4. Queue operations center.
5. Advanced audit/security dashboard.
6. Multi-branch school support where required.
7. Backup/export/recovery workflows.
8. Reporting-safe aggregation layer for future M11.

---

## 5. Cross-Cutting Advanced Features

### 5.1 Approval Workflow Engine

A reusable approval engine should support sensitive decisions across modules.

```text
Entity -> Request -> Review -> Approve/Reject -> Apply final action -> Audit
```

Core data model:

```text
ApprovalRequest
ApprovalStep
ApprovalDecision
ApprovalPolicy
ApprovalComment
ApprovalAttachment
```

Required workflows:

| Workflow | Typical approver | Required controls |
|---|---|---|
| Fee reversal/refund | Principal / Accountant | Reason, before/after ledger, accounting reversal, audit. |
| Discount/scholarship | Principal / Accountant | Reason, effective date, impacted invoices, audit. |
| Marks correction | Academic Head / Principal | Reason, previous marks, new marks, publish state check. |
| Attendance correction | Admin / Class Teacher | Reason, old state, new state, correction window. |
| Leave request | HR / Principal | Leave balance, dates, substitution impact. |
| Payroll posting/reversal | Principal / Accountant | Payroll lock, accounting posting, reversal audit. |
| Student transfer/withdrawal | Admin / Principal | Clearance check, TC generation, lifecycle audit. |
| Document deletion/archive | Admin | Protected file history and audit. |
| Emergency/high-impact notice | Principal / Admin | Recipient preview and send audit. |
| Platform support override | Platform Operator | Tenant, reason, expiry, banner, audit. |

Acceptance criteria:

- Approval requests are tenant-scoped.
- Rejecting requires a reason.
- Applying the final action is idempotent.
- Related module screens show approval state.
- Sensitive approvals expose safe before/after context.

### 5.2 Rules-Based Automation Engine

This is deterministic automation, not AI.

```text
Trigger -> Condition -> Action -> Audit
```

Core data model:

```text
AutomationRule
AutomationTrigger
AutomationCondition
AutomationAction
AutomationExecutionLog
AutomationFailure
```

Initial rules:

| Trigger | Condition | Action |
|---|---|---|
| Student marked absent | Student active and parent contact available | Notify parent. |
| Attendance not marked by cutoff | Class has active timetable/roster | Notify class teacher/admin. |
| Fee due date passed | Due amount > 0 | Send fee reminder. |
| Notice unread after configured window | Notice is important/high priority | Send follow-up. |
| Staff leave approved | Staff has affected timetable periods | Create substitution tasks. |
| Library book overdue | Book not returned | Notify borrower/parent and calculate fine. |
| Canteen wallet below threshold | Wallet active | Notify parent. |
| Bus trip started | Students assigned to route | Notify route parents. |
| Exam result published | Parent/student visibility enabled | Send result notification. |
| Tenant suspended | Tenant inactive | Block access and background jobs. |

Acceptance criteria:

- Rules can be enabled/disabled per tenant/feature.
- Executions are logged with trigger, action, target, and result.
- Failed actions are retry-safe and auditable.
- Provider-disabled modes do not pretend messages were delivered.

### 5.3 Analytics Dashboards Without AI

Use descriptive metrics only. No prediction, no model scores, and no automated punitive action.

Dashboards:

| Dashboard | Metrics |
|---|---|
| Principal dashboard | Attendance, fee collection, academic status, pending approvals, unread notices, staff/transport/canteen/library snapshots. |
| Attendance dashboard | Daily/monthly percentage, class-wise attendance, absent list, late count, correction queue. |
| Fee dashboard | Collected, due, overdue, discounts, reversals, cashier close, gateway/manual references. |
| Academic dashboard | Exam completion, marks-entry status, class average, subject average, report-card publish status. |
| Homework dashboard | Assigned, submitted, late, pending, teacher workload. |
| Communication dashboard | Sent, delivered, read, unread, failed, retry state. |
| Transport dashboard | Active trips, stale GPS, route assignments, delayed trips, vehicle/driver status. |
| Canteen dashboard | POS sales, wallet balances, stock, low stock, vendor purchases, wastage. |
| Library dashboard | Issued books, overdue books, fines, lost/damaged copies, popular books. |
| HR dashboard | Staff attendance, leave, payroll status, contract expiry. |
| Platform dashboard | Tenant health, provider readiness, queues, storage, failed jobs, support override. |

### 5.4 Document and Template System

Required templates:

```text
Fee receipt
Report card
Transfer certificate
Character certificate
Bonafide certificate
Attendance certificate
Student ID card
Staff ID card
Exam admit-card-style document
Payment due letter
Notice PDF
```

Core data model:

```text
DocumentTemplate
GeneratedDocument
DocumentVerificationToken
DocumentPrintHistory
DocumentAccessLog
```

Acceptance criteria:

- Templates support school logo/header/footer.
- Templates are localization-ready for English/Nepali labels.
- Generated PDFs include timestamp, generated-by, and optional QR verification.
- Reprints are logged.
- Protected documents use File Registry access controls.

### 5.5 Mobile and Offline Reliability

Required patterns:

```text
Offline draft
Retry queue
Sync status: pending / synced / failed / retrying
Conflict state
Session expired state
Forbidden state
Module locked state
Stale data indicator
```

Priority mobile flows:

1. Teacher attendance marking and offline drafts.
2. Parent child switcher and child summary.
3. Parent fee receipts and notices.
4. Student homework/timetable/results.
5. Driver trip start/stop/GPS sync.
6. Staff leave request and payslip view.
7. Canteen/library scanner flows after device QA.

---

## 6. Module-Wise Implementation Blueprint

## M0 Platform Core / SaaS Foundation

### Nepal-school problem

Schools need guided setup, safe provider configuration, plan/module control, and support visibility before production rollout.

### Features to implement

1. Guided tenant onboarding wizard.
2. School level configuration: ECD, Grade 1-5, Grade 6-8, Grade 9-10, Grade 11-12.
3. Streams/programs enablement for Grade 11-12.
4. Plan and entitlement management.
5. Usage counters and plan limits.
6. Provider readiness dashboard: SMS, email, FCM, storage, payment gateway, maps/GPS.
7. Queue operations center with retry/discard reasons.
8. Storage readiness panel.
9. Platform support override banner and expiry enforcement.
10. Platform audit dashboard.
11. Data export center.
12. Tenant suspension impact preview.

### Suggested backend ownership

```text
apps/api/src/platform/onboarding
apps/api/src/platform/tenants
apps/api/src/platform/providers
apps/api/src/platform/entitlements
apps/api/src/platform/queues
apps/api/src/platform/audit
```

### Suggested web routes

```text
/dashboard/platform/tenants
/dashboard/platform/tenants/[tenantId]/onboarding
/dashboard/platform/providers
/dashboard/platform/queues
/dashboard/platform/audit
/dashboard/platform/exports
```

### Acceptance criteria

- Tenant setup changes are audited.
- Disabled modules fail closed.
- Provider secrets are masked.
- Queue retries require reason.
- Support override shows visible banner when active.

---

## M1 Admissions and Student Profiles

### Nepal-school problem

Schools need inquiry, application, admission, student lifecycle, guardian links, sibling links, documents, photos, QR identity, and IEMIS-ready fields.

### Features to implement

1. Admission pipeline: inquiry, application, document pending, entrance/interview, accepted, enrolled, rejected.
2. Admission draft autosave and recovery.
3. Document checklist and expiry reminders.
4. Duplicate candidate review using mixed Nepali/English names, guardian phone reuse, DOB, previous school, and sibling clues.
5. Student lifecycle timeline: admitted, class changed, transferred, withdrawn, graduated, rejoined, archived.
6. Student QR ID credential: generate, revoke, rotate, scan audit.
7. Student ID card generation.
8. Transfer certificate workflow.
9. Alumni state after graduation.
10. Sibling and guardian relationship resolution.
11. IEMIS-ready field validation and missing-field panel.
12. Legacy import review queue.

### Suggested backend ownership

```text
apps/api/src/students
apps/api/src/admissions
apps/api/src/student-documents
apps/api/src/student-qr
apps/api/src/imports
```

### Suggested web routes

```text
/dashboard/admissions/pipeline
/dashboard/admissions/applications/[id]
/dashboard/students/[id]
/dashboard/students/[id]/timeline
/dashboard/students/[id]/documents
/dashboard/students/[id]/qr
/dashboard/students/imports
/dashboard/students/iemis-readiness
```

### Acceptance criteria

- Guardian removal immediately revokes parent access.
- Student QR actions are audited.
- Duplicate merge/review never merges automatically without human decision.
- Archived/transferred students do not appear in active operational rosters unless explicitly filtered.

---

## M2 Smart Attendance

### Nepal-school problem

Teachers need fast attendance, admins need correction control, and parents need reliable absence/late communication.

### Features to implement

1. Teacher attendance workspace with bulk present and exceptions.
2. Attendance states: present, absent, late, half-day, excused, sick leave, school event, holiday, not marked.
3. Offline attendance draft queue with sync status.
4. Attendance lock window by tenant/class.
5. Correction request and approval workflow.
6. Duplicate session prevention for concurrent teachers.
7. Holiday/weekend/exam-day policy integration.
8. Parent absence/late notification rules.
9. Class/month/student attendance reports and exports.
10. Attendance follow-up queue for repeated absence.

### Suggested backend ownership

```text
apps/api/src/attendance
apps/api/src/attendance-corrections
apps/api/src/attendance-reports
```

### Suggested web/mobile routes

```text
/dashboard/attendance
/dashboard/attendance/corrections
/dashboard/attendance/reports
mobile/teacher/attendance
mobile/parent/attendance
mobile/student/attendance
```

### Acceptance criteria

- Offline sync does not overwrite newer server data silently.
- Correction approvals include reason and before/after value.
- Parent notifications are child-scoped.
- Attendance exports are tenant-scoped and permission-gated.

---

## M3 Fees and Receipts

### Nepal-school problem

Schools need accurate fee ledgers, partial payments, discounts, cash/bank/QR references, receipt disputes, day close, and reconciliation.

### Features to implement

1. Fee structure builder: admission, tuition, exam, transport, hostel, lab, library, activity, annual, miscellaneous.
2. Class-wise, student-wise, route-wise, scholarship, sibling discount, and one-time/recurring fee assignment rules.
3. Cashier-first collection screen with student search, partial/full payment, print/share.
4. Payment modes: cash, bank deposit, cheque, QR/wallet reference, online gateway, adjustment.
5. Receipt QR verification and reprint history.
6. Reversal/refund approval workflow.
7. Scholarship/discount adjustment workflow after invoice creation.
8. Cashier day close by cash, bank, manual reference, and gateway mode.
9. Gateway sandbox verification before real payment enablement.
10. Overdue reminder preview and defaulter segmentation.
11. Parent fee dashboard with invoice/receipt/PDF download.

### Suggested backend ownership

```text
apps/api/src/fees
apps/api/src/receipts
apps/api/src/cashier-close
apps/api/src/payment-gateways
apps/api/src/reconciliation
```

### Suggested web/mobile routes

```text
/dashboard/fees/collect
/dashboard/fees/students/[studentId]
/dashboard/fees/receipts/[receiptId]
/dashboard/fees/reversals
/dashboard/fees/cashier-close
/dashboard/fees/reconciliation
mobile/parent/fees
```

### Acceptance criteria

- Double-submit cannot create duplicate receipts.
- Webhook duplicate/forged/delayed/out-of-order cases are handled.
- Confirmed receipts are corrected by reversal, not silent edits.
- School fee collection stays separate from SchoolOS SaaS subscription billing.

---

## M4 Academics / Exams / CAS / Report Cards

### Nepal-school problem

Schools need exam planning, marks entry, CAS, report cards, promotion, SEE preparation, and Grade 11-12 stream/practical/project workflows.

### Features to implement

1. Exam term and assessment-component templates.
2. Teacher-friendly marks grid with autosave.
3. Absent, withheld, retest, make-up, practical, and project mark states.
4. Marks lock/unlock approval workflow.
5. Result publishing control.
6. Report-card template designer with branding, remarks, signatures, QR verification.
7. Batch report-card PDF generation through background jobs.
8. Promotion readiness dashboard.
9. Grade 11-12 streams and subject combinations.
10. Practical/lab component tracking.
11. Project component tracking.
12. Board-prep fields such as registration/symbol-style fields where school requires them.
13. Parent/student published result view.

### Suggested backend ownership

```text
apps/api/src/academics
apps/api/src/exams
apps/api/src/report-cards
apps/api/src/promotions
```

### Suggested web/mobile routes

```text
/dashboard/academics/exams
/dashboard/academics/marks-entry
/dashboard/academics/report-cards
/dashboard/academics/promotion
/dashboard/academics/streams
mobile/parent/results
mobile/student/results
```

### Acceptance criteria

- Parents/students only see published results.
- Locked marks require correction workflow.
- Report-card generation failures expose safe diagnostics.
- Grade 11-12 stream/subject changes are audited.

---

## M5 Activity Feed and Milestones

### Nepal-school problem

Parents want school-life updates, but media privacy and child-specific access must be strict.

### Features to implement

1. Teacher post composer with audience preview.
2. Montessori/ECD milestone templates.
3. Class/section/student-specific activity posts.
4. Consent-aware media blocking.
5. Image compression, upload retry, and low-bandwidth previews.
6. Moderation queue with reason, restore/archive, and audit.
7. Parent child-specific activity feed.
8. Teacher media gallery.
9. Delivery retry idempotency for activity notifications.

### Suggested backend ownership

```text
apps/api/src/activity-feed
apps/api/src/media-access
apps/api/src/consents
```

### Acceptance criteria

- Parent sees only linked child-safe activity media.
- Removed guardians lose media access immediately.
- Failed upload cleanup avoids orphaned records.
- Moderation actions are audited.

---

## M6 Homework and Timetable

### Nepal-school problem

Teachers need homework, students/parents need reminders, and coordinators need timetable/substitution control.

### Features to implement

1. Homework templates and recurring assignments.
2. Scheduled homework reminders.
3. Student homework submission states: pending, submitted, late, reviewed, returned.
4. Teacher homework review with comments/marks where enabled.
5. Parent/student offline homework viewing.
6. Drag-and-drop timetable builder.
7. Timetable conflict scoring.
8. Teacher workload balancing.
9. Room/lab allocation.
10. Staff leave to substitution linkage.
11. Substitution calendar with teacher availability.
12. Weekly timetable and substitution alerts on mobile.

### Suggested backend ownership

```text
apps/api/src/homework
apps/api/src/timetable
apps/api/src/substitutions
```

### Acceptance criteria

- Homework attachments remain protected through File Registry.
- Students/parents only see assigned/published homework.
- Timetable conflicts are blocked or explicitly acknowledged with permission.
- Substitution changes notify affected teachers/classes where enabled.

---

## M7 HR and Payroll

### Nepal-school problem

Schools need staff records, leave, attendance, payroll, payslips, deductions, contracts, and accounting posting.

### Features to implement

1. Staff lifecycle timeline.
2. Staff document management.
3. Contract expiry reminders.
4. Staff attendance/check-in/check-out.
5. Leave balance rules and approval queue.
6. Leave-without-pay payroll impact.
7. Salary structure versioning.
8. Payroll draft safety and review/approve/post workflow.
9. Payroll reversal and accounting reconciliation regression coverage.
10. Payslip PDF polish.
11. Staff mobile self-service: leave request, approval, payslip, attendance/check-in, notices.

### Suggested backend ownership

```text
apps/api/src/hr
apps/api/src/payroll
apps/api/src/staff-attendance
apps/api/src/leave
```

### Acceptance criteria

- Salary and bank fields are masked unless permission allows.
- Posted payroll uses reversal/correction workflow.
- Payroll posting creates or links accounting records where enabled.
- Staff self-service cannot expose other staff payroll data.

---

## M8A Library

### Nepal-school problem

Library work is commonly manual; scanner-first issue/return gives immediate operational value.

### Features to implement

1. Book metadata: ISBN/barcode, title, author, publisher, category, shelf.
2. Physical copy QR/barcode management.
3. Scanner-first issue/return using student QR and book barcode.
4. Student and staff borrower policies.
5. Holiday-aware overdue fine calculation.
6. Lost/damaged lifecycle with audited reason.
7. Fine-to-fees/accounting posting idempotency.
8. Book reservation workflow.
9. Overdue, lost books, fine summary, and popular books reports.
10. Parent/student borrowed books and due-date mobile views.

### Suggested backend ownership

```text
apps/api/src/library
apps/api/src/library-fines
```

### Acceptance criteria

- Book copies with history are archived, not unsafe-deleted.
- Fine posting is idempotent.
- Parent/student library views are scoped.
- Scanner workflows pass device QA before production claims.

---

## M8B Transport

### Nepal-school problem

Parents need safety visibility; schools need routes, stops, vehicles, drivers, trips, GPS status, and incident handling.

### Features to implement

1. Vehicle registry with capacity and document expiry.
2. Driver/conductor profile and assignment.
3. Route and stop builder.
4. Student route/stop assignment.
5. Driver mobile trip start/stop.
6. Boarding/deboarding/absent states.
7. GPS sync status and stale-location warnings.
8. Parent bus status: not started, en route, delayed, arrived, stale GPS.
9. Trip history and GPS quality reports.
10. Emergency contact flow.
11. Vehicle maintenance reminders.
12. Transport fee mapping with M3 Fees.

### Suggested backend ownership

```text
apps/api/src/transport
apps/api/src/transport-gps
apps/api/src/transport-trips
```

### Acceptance criteria

- Parent sees timestamped location/status only for assigned child route.
- Stale GPS must be clearly labeled.
- Driver cannot run overlapping trips on the same vehicle unless explicitly allowed.
- Live maps stay deferred until SSE/WebSocket/load-testing decision is approved.

---

## M8C Canteen

### Nepal-school problem

Schools need fast counter sales, wallet controls, stock visibility, and parent spending transparency.

### Features to implement

1. Fast POS mode with QR/student search.
2. Student wallet balance and parent top-up/manual adjustment.
3. Daily/monthly spending controls.
4. Low-balance events.
5. Allergy/medical warning before serving.
6. Menu planner.
7. Inventory low-stock alerts.
8. Stock close and wastage reports.
9. Vendor purchases and vendor bill edit locks.
10. Receipt reprint idempotency.
11. Parent wallet, menu, meal plan, and spending history mobile views.
12. Student meal QR.

### Suggested backend ownership

```text
apps/api/src/canteen
apps/api/src/canteen-pos
apps/api/src/canteen-wallets
apps/api/src/canteen-inventory
apps/api/src/canteen-vendors
```

### Acceptance criteria

- POS double-submit cannot duplicate sales.
- Wallet debit is atomic and cannot go negative unless explicit policy allows.
- Allergy/medical warning is shown before serving.
- Parent views are child-scoped.

---

## M9 Accounting and Finance

### Nepal-school problem

Schools need reliable ledgers connected to fees, payroll, canteen, library, transport, bank deposits, and expenses.

### Features to implement

1. Nepal school-friendly default chart of accounts templates.
2. Journal entry and voucher approval.
3. Fee-to-accounting source mapping.
4. Payroll-to-accounting source mapping.
5. Canteen/library/transport source mapping.
6. Bank statement CSV import.
7. Bank reconciliation review with manual confirmation.
8. Fiscal lock, close, reopen safety.
9. Reversal/correction-only enforcement for posted records.
10. Trial balance, ledger, income/expense, and snapshot reports.
11. Large export progress UI and background thresholds.
12. Principal read-only finance snapshot on mobile.

### Suggested backend ownership

```text
apps/api/src/accounting
apps/api/src/accounting-reconciliation
apps/api/src/accounting-reports
```

### Acceptance criteria

- Posted records are not silently edited.
- Source-record drilldown works for fees, payroll, canteen, library, and transport.
- Fiscal lock prevents unsafe backdated changes.
- Finance mobile surfaces are read-only unless explicitly approved.

---

## M10 Notices, Communication, and Chat

### Nepal-school problem

Schools need reliable controlled messaging that can replace scattered WhatsApp/Viber/manual communication.

### Features to implement

1. Notice templates: holiday, fee reminder, emergency, exam, transport delay, event, homework reminder, parent meeting.
2. Recipient preview before sending high-impact notices.
3. Targeting by school, class, section, route, staff group, fee segment, or individual parent/student.
4. Scheduled notices.
5. Read receipts and unread follow-up UI.
6. Provider callback verification for duplicate/forged/failed/delayed/out-of-order callbacks.
7. Provider-disabled fail-closed retry behavior.
8. Quiet-hours policy for chat.
9. Chat report/block/escalation flow.
10. Emergency/high-impact message audit.
11. Notice attachment preview on mobile.
12. Push notification and in-app notification center polish.

### Suggested backend ownership

```text
apps/api/src/communications
apps/api/src/notices
apps/api/src/messaging
apps/api/src/notification-providers
```

### Acceptance criteria

- Attachments remain protected after guardian removal or role change.
- Emergency/high-impact messages are audited.
- Provider failure diagnostics do not leak secrets.
- Teacher communication is limited to assigned scope unless permission allows broader access.

---

## M12 Learning Layer — Non-AI Depth

### Nepal-school problem

Schools may have smart boards or shared computer labs, but not all students have individual devices. Learning must be teacher-controlled and school-first.

### Features to implement before AI

1. Curriculum topic map: class -> subject -> chapter -> topic.
2. Manual question bank with reusable MCQ, true/false, short-answer, matching, and ordering questions.
3. Worksheet generator using templates, not AI.
4. Smart-board mode polish.
5. Computer-lab session polish.
6. Session replay/summary for teachers.
7. Resource library folders by subject/chapter/topic.
8. Protected file picker integration for learning resources.
9. Printable fallback for low-bandwidth schools.
10. Parent learning summary polish with supportive labels only.
11. Student learning summary polish.
12. Browser E2E coverage for activity builder, board, lab, resources, participant monitor, and parent summary.

### Suggested backend ownership

```text
apps/api/src/learning
apps/api/src/learning-resources
apps/api/src/learning-progress
```

### Acceptance criteria

- Learning does not duplicate core students, teachers, classes, subjects, files, notifications, or audit systems.
- Parent summaries remain child-scoped and non-comparative.
- Public leaderboards remain out of scope.
- AI tutor, adaptive recommendations, heavy simulations, and open chat remain deferred.

---

## M11 School Intelligence / AI — Explicitly Deferred

M11 remains roadmap-only until the pre-AI operational foundation is stable.

Preconditions before M11 implementation:

1. Reliable production data exists across attendance, fees, academics, communication, and learning.
2. Tenant-safe analytics/aggregation layer exists.
3. Parent/student/mobile APIs are purpose-limited and tested.
4. Sensitive actions have approval and audit trails.
5. Data quality issues are visible through dashboards.
6. Human-review workflow exists for any future recommendation.
7. Product owner approves AI scope explicitly.

Do not implement:

```text
LLM calls
Open student AI chat
Automated punishment/risk action
Raw prediction scores for parents/students
Cross-tenant model data leakage
Unreviewed recommendations
```

---

## 7. Definition of Done for Advanced Operations Features

A feature from this plan is not complete until:

1. Backend API is tenant-scoped and permission-gated.
2. Parent/student/mobile endpoints are purpose-limited where applicable.
3. Sensitive writes are audited.
4. Money writes are idempotent.
5. File access uses File Registry/StorageService boundaries.
6. Web UI has loading, empty, forbidden, module-locked, and error states.
7. Mobile UI has session-expired/forbidden/network states where applicable.
8. Background jobs re-check tenant, feature, entity, and provider state.
9. E2E or focused regression coverage exists for the critical path.
10. Staging smoke is run before readiness claims are updated.

---

## 8. Suggested Codex Implementation Prompt

```text
Read README.md, AGENTS.md, docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md, and docs/project/SCHOOLOS_ADVANCED_OPERATIONS_PLAN.md.

Goal:
Select the highest-priority incomplete pre-AI advanced operations feature from the active docs and implement it module-wise without introducing AI/ML/LLM runtime.

Rules:
- Preserve tenant isolation, RBAC, entitlements, audit logging, File Registry boundaries, and idempotent money flows.
- Prefer existing modules and code ownership paths; do not create unrelated parallel modules.
- Do not use fake production data.
- Do not implement M11 AI.
- Add or update backend tests, web tests, mobile tests, and smoke coverage where relevant.
- Update active docs only when the source-confirmed implementation state changes.

Output:
Maintain a progress log with current module, completed items, remaining items, risks, verification run, and next action.
```
