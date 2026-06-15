# SchoolOS Web Design Expansion

**Status:** Companion expansion for the active web/mobile design plan.  
**Target master file:** `docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md`  
**Recommended merge point:** After `## 6. Module-Wise Screen Design Plan` and before `## 7. Major Screen Blueprints`.  
**Scope:** Web dashboard design depth only. This file does not implement backend, frontend, or mobile code.

This document expands the SchoolOS web dashboard design plan so frontend implementation agents know how each module screen should place KPIs, filters, tables, buttons, content, drawers, empty states, protected file actions, and audit-sensitive actions.

SchoolOS web must remain a daily school operating desk for Nepal schools, not a generic ERP dashboard. Every screen must have one main job, consume real APIs, preserve tenant isolation, respect RBAC/module entitlements, use protected File Registry helpers for private files, and show school-friendly states for loading, empty, error, success, permission denied, and module locked cases.

---

## 1. Web Screen Composition Standard

Every authenticated SchoolOS web screen should follow this structure unless a domain-specific workflow has a stronger reason:

```text
Topbar
Left Sidebar
Page Header
Context Bar / Filters
KPI Strip
Main Workspace
Right Insight Panel or Drawer
Sticky Action Footer only when a multi-step form needs it
```

| Zone | What it contains | Rules |
|---|---|---|
| Topbar | School selector, academic year/date context, global search, notifications, user menu | Never put module-specific actions here except global search or notifications. |
| Left Sidebar | Role-aware navigation | Hide unavailable modules, but direct locked access must still show `ModuleLockedState`. |
| Page Header | Page title, one-line purpose, one primary CTA, `More Actions` menu | One primary action only. Do not create five equal header buttons. |
| Context Bar / Filters | Academic year, class, section, date range, status, search, mode filters | Filters should use URL `searchParams` where possible. |
| KPI Strip | 3-5 decision cards | KPIs come from backend summary APIs or list metadata, never fake frontend totals. |
| Main Workspace | Table, register, kanban, calendar, POS, form, or report view | Main area must match the screen's main job. |
| Right Panel / Drawer | Selected record detail, alerts, audit timeline, preview, safe help text | Use for detail without losing table/filter context. |
| Sticky Action Footer | Save/cancel for long forms or review workflows | Do not use sticky footer on simple list screens. |

---

## 2. KPI Strip Rules

KPIs are for decisions, not decoration.

- Use 3-5 KPI cards per screen.
- Use short school-friendly labels.
- Every KPI must have a clear meaning and click-through/filter behavior where useful.
- Use module accent color only for subtle icon/accent, not full colored cards.
- Do not calculate official totals in the browser.
- Each KPI handles loading, empty, unavailable, permission-restricted, and stale-data states.

KPI card format:

```text
[Icon] Label
Main value
Small context line
Optional trend/status badge
Click behavior: filter table or open detail view
```

Example:

```text
Overdue Fees
NPR 245,000
42 students with dues older than 30 days
Action: Open defaulter list
```

---

## 3. Table, List, and Workspace Rules

Most admin modules use tables, but the table must not become the whole product experience.

| Area | Required behavior |
|---|---|
| Table header | Clear title, backend record count, active filter chips. |
| Columns | Show only fields needed for the current workflow. Sensitive fields require permission. |
| Row action | One primary row action plus a `More` menu for secondary actions. |
| Bulk action | Only where safe and permissioned. Destructive or financial bulk actions require confirmation and audit reason. |
| Empty state | Explain why there is no data and provide one safe next action. |
| Error state | Show school-friendly message, retry, and preserve filters. |
| Pagination | Server-side only for growing lists. |
| Sorting/filtering | Server-side where lists can grow. |

Common row action pattern:

```text
Primary: View / Open / Continue / Review / Collect / Mark
Secondary More: Edit, Download, Archive, Audit History, Retry, Reverse, Export
Danger: Separated inside More menu with confirmation and reason
```

---

## 4. Buttons and Action Placement Rules

### 4.1 Page Header Actions

Each page header should contain:

```text
Primary CTA: one main action
More Actions: import/export/settings/templates/report/history actions
```

Examples:

| Screen | Primary CTA | More Actions |
|---|---|---|
| Students | Add Student | Import CSV, Duplicate Review, iEMIS Readiness, Export |
| Attendance Register | Submit Attendance | Save Draft, Bulk Present, Export Register |
| Fee Collection | Record Payment | Reprint Receipt, Cashier Close, Defaulter Reminders |
| Report Cards | Generate Batch | Publish Results, Download Snapshots, Correction History |
| Notices | Send Notice | Templates, Schedule, Delivery Logs |

### 4.2 Form Actions

Use sticky footer only for long forms:

```text
Cancel | Save Draft | Save and Continue | Submit / Publish
```

Financial, payroll, accounting, report publish, tenant suspend, support override, student lifecycle, and file-delete/archive actions require confirmation and audit reason.

### 4.3 Danger Actions

Danger actions must:

1. Be visually separated.
2. Require confirmation.
3. Require reason for audit-sensitive workflows.
4. Show impact summary before submit.
5. Avoid hard delete unless explicitly required and permitted.

---

## 5. Drawers, Detail Panels, and Modals

Use drawers for details that should not destroy table context.

Recommended drawer tabs:

```text
Overview | Activity / Timeline | Files | Audit | Notes / Comments
```

Use modal dialogs for:

- Confirmation.
- Short create/edit forms.
- Reason capture.
- File upload.
- Small preview.

Use full-page routes for:

- Student profile.
- Payroll run review.
- Report-card batch review.
- Timetable builder.
- Accounting reconciliation.
- Learning activity builder.
- Large imports.

---

## 6. Shared Screen State Requirements

Every module screen must design these states:

| State | Required UX |
|---|---|
| Loading | Skeleton preserving page title and selected filters. |
| Empty | Friendly explanation and one CTA. |
| Error | Safe backend message, retry, preserved filters. |
| Success | Toast or inline confirmation, refetch/invalidate, visible history when audit-sensitive. |
| Permission denied | Clear explanation and safe navigation. |
| Module locked | Entitlement-backed locked state, no fake data. |
| Slow network | Skeleton or stale-data label. |
| File unavailable | Protected file error, not broken raw URL. |

---

## 7. Module-Wise Web Screen Blueprints

### 7.1 M0 Platform Core

#### Platform Attention Dashboard — `/platform`

**Goal:** Let SchoolOS operators see which schools, providers, queues, and billing states need attention.

**Header:**

- Title: `Platform Attention`
- Description: `Monitor tenant health, provider readiness, queues, and urgent support actions.`
- Primary CTA: `Review highest-risk school`
- More Actions: `Provider Readiness`, `Queue Center`, `Audit Logs`, `Export Platform Report`

**KPI strip:**

1. Active schools.
2. Suspended schools.
3. Provider issues.
4. Failed jobs.
5. Active support overrides.

**Main workspace:**

- Left: attention queue table grouped by risk.
- Right: provider and queue health cards.
- Bottom: recent platform audit events.

**Table columns:**

```text
Risk | School | Category | Issue | Last seen | Assigned owner | Action
```

**Right drawer:**

- Tenant summary.
- Plan and entitlement status.
- Provider readiness.
- Queue failures.
- Support override status.
- Audit timeline.

**Primary row action:** `Open issue`.

**Secondary row actions:** `Open tenant`, `Run readiness check`, `View failed jobs`, `Enter support override`.

**States:**

- Empty: `No platform issues right now.`
- Permission denied: platform-only message.
- Support override active: persistent warning banner.

**Acceptance checklist:**

- No tenant-private data is shown without audited override.
- Provider secrets are masked.
- Queue retry/discard requires reason where supported.
- SaaS billing never appears as school fee collection.

#### Schools / Tenants — `/platform/schools`

**Goal:** Manage tenant lifecycle and plan status.

**KPI strip:** active schools, onboarding incomplete, suspended, trial ending, provider misconfigured.

**Filters:** status, plan, province/district if available, provider state, search.

**Main table columns:** school name, tenant slug, plan, status, modules, onboarding, last activity, actions.

**Primary CTA:** `Add School`.

**More Actions:** `Export Tenants`, `Plan Comparison`, `Onboarding Checklist`.

**Drawer:** school overview, plan/feature entitlements, onboarding checklist, provider readiness, support notes, audit.

---

### 7.2 Auth, RBAC, and Settings

#### Login — `/login`

**Goal:** Let staff, platform operators, parents, and permitted users sign in safely.

**Content:**

- SchoolOS logo.
- Tenant/school slug if required.
- Email/phone/username field.
- Password field.
- Remember device only if supported.
- Forgot password link.

**States:** invalid credentials, tenant suspended, session expired, rate limited, network error.

**Acceptance checklist:**

- No raw token in browser storage.
- Friendly message for suspended tenant.
- Does not expose whether an email exists unless policy allows.

#### Users and Roles — `/dashboard/settings/users`, `/dashboard/settings/roles`

**Goal:** Manage school users, roles, permissions, and access safely.

**KPI strip:** active users, invited users, locked users, high-privilege roles, users needing review.

**Filters:** role, status, module, search.

**Table columns:** name, email/phone, role, status, last login, modules, actions.

**Primary CTA:** `Invite User`.

**More Actions:** `Role Templates`, `Permission Audit`, `Force Logout History`.

**Drawer:** user profile, roles, permissions, linked staff/guardian record, sessions, audit.

**Danger actions:** deactivate user, force logout, reset password.

---

### 7.3 M1 Admissions and Students

#### Student Directory — `/dashboard/students`

**Goal:** Find students quickly and open safe profile context.

**Header:**

- Primary CTA: `Add Student`.
- More Actions: `Start Admission`, `Import CSV`, `Duplicate Review`, `iEMIS Readiness`, `Export`.

**KPI strip:** total active students, new admissions this month, missing documents, iEMIS issues, duplicate candidates.

**Filters:** academic year, class, section, lifecycle status, document status, iEMIS readiness, search by name/admission number/guardian phone.

**Main table columns:** student, admission no., class/section/roll, guardian, lifecycle status, document status, dues flag if permitted, actions.

**Primary row action:** `Open Profile`.

**Secondary row actions:** `Edit`, `View Documents`, `QR Credential`, `Lifecycle Timeline`, `Transfer/Withdraw`.

**Right drawer:** quick profile, guardian contacts, document checklist, attendance/fee/academic summary where permission allows, recent timeline.

**Empty state:** `No students found for these filters.` CTA: `Add Student` or `Clear filters`.

**Acceptance checklist:**

- Teacher sees only assigned scope.
- Parent-safe data is not exposed to admin table by accident.
- Private photos and documents use protected helpers.
- Lifecycle actions require reason and audit.

#### Student Profile — `/dashboard/students/[studentId]`

**Goal:** One safe source of truth for a student.

**Header:** student name, admission no., class/section, lifecycle badge, primary CTA `Edit Profile`, More Actions `Generate ID Card`, `Rotate QR`, `Transfer`, `Archive`, `Audit History`.

**KPI strip:** attendance this month, outstanding dues if permitted, document readiness, academic status, recent alerts.

**Tabs:** Overview, Guardians, Documents, Attendance, Fees, Academics, Activity, Library/Canteen/Transport where enabled, Timeline, Audit.

**Right panel:** alerts, missing data, next actions.

**Protected files:** photo, documents, ID cards, certificates through authenticated preview/download.

#### Admission Pipeline — `/dashboard/admissions`

**Goal:** Move applications from inquiry to enrollment safely.

**KPI strip:** new inquiries, document pending, interview scheduled, accepted, duplicate-blocked.

**Main workspace:** kanban by status or table toggle.

**Card/table fields:** applicant, guardian, desired class, status, missing docs, duplicate risk, last update.

**Primary CTA:** `Create Application`.

**More Actions:** `Import Applications`, `Duplicate Review`, `Workflow Labels`, `Export`.

**Drawer:** application detail, documents, duplicate candidates, notes, status history, enrollment action.

**Acceptance checklist:**

- Enrollment conversion happens only after accepted state.
- Duplicate review is visible before risky enrollment.
- Admission documents use File Registry.

---

### 7.4 M2 Attendance

#### Attendance Workspace — `/dashboard/attendance`

**Goal:** Let admin/principal see today's attendance status and issues.

**KPI strip:** classes marked, not marked, absent students, late students, correction requests.

**Filters:** date, class, section, status, teacher, anomaly type.

**Main workspace:** class attendance status table.

**Table columns:** class/section, teacher, session status, present, absent, late, submitted at, issues, actions.

**Primary CTA:** `Open Register`.

**More Actions:** `Correction Queue`, `Monthly Register`, `Anomaly Dashboard`, `Export`.

**Right panel:** selected class attendance summary, missing roster warnings, lock-window status, parent notification state.

#### Attendance Register — `/dashboard/attendance/register`

**Goal:** Mark attendance for one class quickly.

**Header:** class, section, date, period/session.

**KPI strip:** roster total, present, absent, late, unmarked.

**Main workspace:** roster grid with fast status buttons.

**Row columns:** roll, student, status buttons, reason, notes, last changed.

**Primary CTA:** `Submit Attendance`.

**Secondary:** `Bulk Present`, `Save Draft`, `Clear`, `Export`.

**Sticky footer:** visible while editing.

**States:** locked, already submitted, duplicate session conflict, offline draft, rejected replay, correction required.

**Acceptance checklist:**

- Teacher can mark only assigned class.
- Offline draft cannot overwrite newer data silently.
- Parent notifications are child-scoped.

---

### 7.5 M3 Fees and Receipts

#### Finance Today / Fees Dashboard — `/dashboard/fees`

**Goal:** Show school fee health and guide collection/reconciliation work.

**KPI strip:** collected today, outstanding dues, overdue students, pending reversals/refunds, cashier close status.

**Filters:** academic year, class, fee head, due status, payment method, date range.

**Main workspace:** tabs for `Dues`, `Invoices`, `Payments`, `Receipts`, `Defaulters`.

**Primary CTA:** `Collect Payment`.

**More Actions:** `Fee Templates`, `Generate Invoices`, `Cashier Close`, `Reconciliation`, `Export`.

#### Fee Collection Counter — `/dashboard/finance/collections`

**Goal:** Cashier can search student, collect payment, and issue receipt.

**Top search:** student name, admission no., guardian phone, invoice no.

**KPI strip:** due amount, selected invoices, amount to collect, previous balance.

**Main layout:**

- Left: student/invoice selector.
- Center: payment entry form.
- Right: ledger/receipt preview.

**Primary CTA:** `Record Payment`.

**Secondary:** `Print Receipt`, `Share Receipt`, `Add Manual Reference`, `Clear`.

**Form fields:** amount, method, reference, received date, notes, idempotency key hidden.

**Acceptance checklist:**

- Money uses backend Decimal/numeric values.
- Double-submit cannot duplicate receipts.
- Receipt PDF opens through authenticated blob helper.
- Reversal/refund requires permission and reason.

#### Cashier Close — `/dashboard/fees/cashier-close`

**Goal:** Close collection window by method and generate protected report.

**KPI strip:** cash total, bank total, manual reference total, pending mismatch, close status.

**Main table:** payments in selected window.

**Primary CTA:** `Close Cashier Window`.

**More Actions:** `Download Day-End PDF`, `Export CSV`, `View Previous Closes`.

**Confirmation:** show totals, methods, window, mismatch warnings, audit reason.

---

### 7.6 M4 Academics, Exams, CAS, Report Cards

#### Academics Overview — `/dashboard/academics`

**Goal:** Show academic setup and result readiness.

**KPI strip:** active exam terms, marks pending, locked marks, report cards generated, publish blockers.

**Main workspace:** readiness cards by class/exam term.

**Primary CTA:** `Create Exam Term`.

**More Actions:** `Apply Template`, `Grading Policy`, `Report Cards`, `Promotion Readiness`.

#### Marks Entry — `/dashboard/academics/marks`

**Goal:** Let teacher enter assigned marks safely.

**Filters:** exam term, class, section, subject, component.

**KPI strip:** students, completed marks, draft marks, absent/withheld/retest, lock status.

**Main workspace:** marks grid.

**Columns:** roll, student, mark input, state selector, remarks, validation status.

**Primary CTA:** `Save Marks`.

**Secondary:** `Save Draft`, `Submit for Review`, `Export Sheet`.

**States:** locked, autosaved, row errors, absent/withheld/retest, permission denied.

#### Report Cards — `/dashboard/academics/report-cards`

**Goal:** Generate, review, publish, and download report cards.

**KPI strip:** generated, pending, failed, withheld due to dues, published.

**Main workspace:** batch table by class/exam term.

**Primary CTA:** `Generate Batch`.

**More Actions:** `Publish Results`, `Download Snapshots`, `Regenerate Failed`, `Correction History`.

**Drawer:** selected student report preview, marks summary, dues-withhold state, protected PDF button, audit history.

**Acceptance checklist:**

- Parents see published results only.
- Protected PDFs use authenticated helper.
- Correction/regeneration is audited.

---

### 7.7 M5 Activity Feed and Milestones

#### Activity Workspace — `/dashboard/activity`

**Goal:** Create, review, moderate, and track parent-visible activity posts.

**KPI strip:** posts today, pending moderation, media blocked by consent, failed deliveries, milestones recorded.

**Filters:** class, section, student, status, media consent, date range, author.

**Main workspace:** feed/table hybrid.

**Primary CTA:** `Create Post`.

**More Actions:** `Milestone Templates`, `Moderation Queue`, `Media Gallery`, `Delivery Logs`.

**Composer drawer:** audience preview, media upload, caption, tagged students, consent warning, publish/schedule.

**Post card actions:** `View`, `Edit`, `Archive`, `Moderate`, `Download Media`.

**Acceptance checklist:**

- Parent sees linked child-safe media only.
- Removed guardians lose media access.
- Media uses protected preview/download.
- Upload failures clean up safely.

---

### 7.8 M6 Homework and Timetable

#### Homework Workspace — `/dashboard/homework`

**Goal:** Assign, publish, remind, and review homework.

**KPI strip:** assigned today, due soon, submissions pending review, overdue, reminders pending.

**Filters:** class, section, subject, teacher, due date, status.

**Main table columns:** title, class/subject, due date, submissions, status, reminders, actions.

**Primary CTA:** `Create Homework`.

**More Actions:** `Template Library`, `Recurring Homework`, `Reminder History`, `Export Report`.

**Drawer:** homework detail, attachments, submissions, reminders, audit.

**Acceptance checklist:** attachments use File Registry, reminders show preview, parent/student see assigned published homework only.

#### Timetable Builder — `/dashboard/timetable/builder`

**Goal:** Build, validate, and publish timetable versions.

**KPI strip:** total periods, conflicts, teacher overloads, rooms/labs used, publish status.

**Main workspace:** weekly grid.

**Left panel:** class/section selector and period palette.

**Right panel:** conflict list, teacher availability, workload, validation summary.

**Primary CTA:** `Validate Version`.

**More Actions:** `Publish`, `Lock`, `Duplicate Version`, `Export`.

**Acceptance checklist:** conflicts are visible before publish, publish/lock audited, substitutions link to leave/absence where supported.

---

### 7.9 M7 HR and Payroll

#### HR Workspace — `/dashboard/hr`

**Goal:** Manage staff lifecycle, documents, leave, and attendance.

**KPI strip:** active staff, on leave today, pending leave requests, contract expiring, missing documents.

**Filters:** role, department, status, contract state, search.

**Table columns:** staff, role, contact, status, leave balance, document status, actions.

**Primary CTA:** `Add Staff`.

**More Actions:** `Leave Calendar`, `Contract Reminders`, `Staff Documents`, `Export`.

**Drawer:** staff overview, documents, lifecycle timeline, leave, payroll summary if permitted, audit.

#### Payroll Workspace — `/dashboard/payroll`

**Goal:** Preview, review, approve, post, and reverse payroll safely.

**KPI strip:** current run status, gross pay, deductions, net pay, exceptions.

**Main workspace:** payroll run table and selected run detail.

**Primary CTA:** `Start Payroll Preview`.

**More Actions:** `Approve`, `Post`, `Reverse`, `Download Payslips`, `Export Reports`.

**Acceptance checklist:** salary and bank fields permission-gated, posted payroll uses reversal, payslip PDF protected.

---

### 7.10 M8A Library

#### Library Desk — `/dashboard/library`

**Goal:** Manage books, copies, issues, returns, and fines.

**KPI strip:** books, copies available, issued copies, overdue, fines pending.

**Filters:** category, author, shelf, availability, borrower type, search/barcode.

**Main workspace:** tabs for `Catalog`, `Issue/Return`, `Overdue`, `Fines`, `Reports`.

**Primary CTA:** `Add Book`.

**More Actions:** `Scanner Mode`, `Import Books`, `Archive Copy`, `Export`.

#### Scanner Issue/Return — `/dashboard/library/issue-return`

**Goal:** Fast circulation by student QR and book barcode.

**Main layout:**

- Scan student/card.
- Scan book/copy.
- Show eligibility and due date.
- Confirm issue or return.

**Primary CTA:** `Confirm Issue / Return`.

**States:** copy not found, already issued, borrower blocked, overdue fine, archived copy.

---

### 7.11 M8B Transport

#### Transport Operations — `/dashboard/transport`

**Goal:** Keep routes, vehicles, assignments, trips, and GPS status visible.

**KPI strip:** active trips, assigned students, stale GPS, vehicle document expiry, delays.

**Filters:** route, vehicle, driver, status, date.

**Main workspace:** route/trip table with GPS quality state.

**Primary CTA:** `Create Route`.

**More Actions:** `Assign Students`, `Assign Driver`, `Trip History`, `GPS Quality Report`, `Export`.

**Drawer:** route/trip detail, manifest, latest GPS, delay/emergency notes, audit.

**Acceptance checklist:** live map remains deferred unless approved, stale GPS clearly labeled, parent sees assigned child route only.

---

### 7.12 M8C Canteen

#### Canteen Workspace — `/dashboard/canteen`

**Goal:** Manage menu, meal plans, wallets, POS, inventory, and reports.

**KPI strip:** meals served today, wallet low balance, stock low, allergy warnings, sales today.

**Main workspace:** tabs for `POS`, `Serving`, `Menu`, `Wallets`, `Inventory`, `Vendors`, `Reports`.

**Primary CTA:** `Open POS`.

**More Actions:** `Menu Planner`, `Wallet Top-up`, `Stock Close`, `Wastage Report`, `Export`.

#### Canteen POS / Serving — `/dashboard/canteen/pos`

**Goal:** Serve or sell safely and quickly.

**Main layout:**

- Student QR/search.
- Eligibility/wallet/allergy card.
- Item selector.
- Receipt preview.

**Primary CTA:** `Complete Sale / Serve Meal`.

**States:** insufficient wallet, allergy warning requires acknowledgement, item out of stock, duplicate serve attempt.

**Acceptance checklist:** wallet debit atomic, allergy warning before serving, receipt protected, POS double-submit safe.

---

### 7.13 M9 Accounting and Finance

#### Accounting Dashboard — `/dashboard/accounting`

**Goal:** Let accountant monitor fiscal status, source postings, and reports.

**KPI strip:** fiscal year status, pending journals, unreconciled bank items, export jobs, source mapping issues.

**Main workspace:** cards for chart, journals, reconciliation, reports, fiscal close.

**Primary CTA:** `Create Journal`.

**More Actions:** `Import Bank Statement`, `Run Report`, `Export Ledger`, `Close Period`.

#### Journals — `/dashboard/accounting/journals`

**Goal:** Create, review, approve, post, reverse, and correct journals.

**Table columns:** date, voucher no., source, amount, status, prepared by, actions.

**Drawer:** journal lines, source drilldown, approvals, audit, files.

**Acceptance checklist:** posted records not silently edited, fiscal lock blocks unsafe posting, reversals audited.

#### Reconciliation — `/dashboard/accounting/reconciliation`

**Goal:** Match bank statement lines to system records.

**KPI strip:** imported lines, auto matches, manual review, reconciled, unmatched.

**Main workspace:** split view of bank lines and suggested matches.

**Primary CTA:** `Import Statement`.

**More Actions:** `Auto Match`, `Confirm Matches`, `Export Reconciliation`.

---

### 7.14 M10 Notices, Communication, and Chat

#### Notices — `/dashboard/notices`

**Goal:** Compose, send, schedule, and track school notices.

**KPI strip:** sent today, scheduled, failed deliveries, unread high-impact, provider issues.

**Filters:** audience, channel, status, date, priority.

**Main table:** notice title, audience, channels, status, delivery/read summary, sent by, actions.

**Primary CTA:** `Send Notice`.

**More Actions:** `Templates`, `Scheduled Notices`, `Delivery Logs`, `Provider Diagnostics`.

**Composer:** audience preview, content, attachments, channels, schedule, high-impact confirmation.

**Acceptance checklist:** attachments protected, high-impact messages audited, provider-disabled state is honest.

#### Messages / Parent-Teacher Chat — `/dashboard/messages`

**Goal:** Handle scoped parent-teacher communication with safety controls.

**Main layout:**

- Left: thread list.
- Center: selected conversation.
- Right: student context, quiet-hours banner, escalation/report actions.

**KPI strip:** unread, escalated, blocked/reported, outside quiet-hours attempts.

**Acceptance checklist:** teacher sees assigned parent threads only, quiet hours respected, escalation locks handled, unsafe attachments suppressed.

---

### 7.15 M12 Learning Layer

#### Learning Workspace — `/dashboard/learning`

**Goal:** Teacher/admin creates activities, launches sessions, monitors attempts, and reviews progress.

**KPI strip:** published activities, live sessions, active participants, submitted attempts, needs-practice students.

**Filters:** class, section, subject, mode, difficulty, status.

**Main workspace:** tabs for `Activities`, `Sessions`, `Resources`, `Progress`.

**Primary CTA:** `Create Activity`.

**More Actions:** `Resource Library`, `Launch Board Session`, `Launch Lab Session`, `Export Progress`.

**Activity table:** title, class/subject, mode, difficulty, questions, status, last used, actions.

**Drawer:** activity preview, questions, resources, session history, progress summary.

#### Activity Builder — `/dashboard/learning/activities/[id]`

**Goal:** Build teacher-controlled learning activity.

**Layout:**

- Left: activity settings.
- Center: question/content editor.
- Right: preview and validation.
- Sticky footer: Save Draft, Publish, Launch.

**Acceptance checklist:** teacher assigned-scope validation, resources through File Registry, no AI/open chat/leaderboard.

#### Board Session — `/classroom/board/session/[sessionId]`

**Goal:** Teacher-led smart board screen.

**Layout:** full-screen board mode, question navigation, session code/QR, participant count, pause/resume/end.

**States:** live, paused, expired, ended, network heartbeat issue.

#### Student Lab Session — `/student/learning/session/[sessionId]`

**Goal:** Student joins controlled session, autosaves, submits.

**Layout:** minimal shell, activity content, autosave status, submit confirmation.

**Acceptance checklist:** no broad student app/sidebar, idempotent autosave/submit, no other students or admin data.

---

### 7.16 Advanced Operations

#### Operations Center — `/dashboard/operations`

**Goal:** Central workspace for approvals, automation, analytics, document templates, and exports.

**KPI strip:** pending approvals, failed automation, stale summaries, failed exports, templates needing review.

**Tabs:** Approvals, Automation, Analytics, Templates, Exports.

**Primary CTA:** context-specific, for example `Create Rule` or `Create Template`.

**More Actions:** `Refresh Summaries`, `Retry Failed`, `Audit Logs`.

#### Approval Inbox

**Table columns:** request type, student/staff/source, submitted by, status, age, risk, action.

**Drawer:** before/after context, comments, attachments, decisions, audit.

**Actions:** approve, reject with reason, request changes, apply final action.

**Acceptance checklist:** rejection requires reason, final action idempotent, sensitive before/after context is safe.

#### Export Center

**Table columns:** export name, module, requested by, status, created at, expires at, actions.

**Actions:** download protected file, retry failed, archive expired.

**Acceptance checklist:** files use File Registry, retry is auditable, large exports are queued.

---

### 7.17 Reports and File Registry

#### Reports Center — `/dashboard/reports`

**Goal:** Find generated reports, run allowed exports, and download protected files.

**KPI strip:** reports generated, failed jobs, expiring exports, scheduled reports, storage issues.

**Filters:** module, report type, status, date, requested by.

**Main table:** report, module, status, generated by, created at, expires, actions.

**Primary CTA:** `Run Report`.

**More Actions:** `Export History`, `Queue Status`, `Storage Readiness`.

**Acceptance checklist:** no raw storage URLs, protected downloads only, failed job safe diagnostics.

#### File Registry Surfaces

File actions across modules should use shared UI components:

```text
ProtectedFileButton
ProtectedFileLink
FileUploadDropzone
FilePreviewDrawer
FileAccessHistory
```

File row metadata:

```text
File name | Type | Owner | Size | Status | Uploaded by | Uploaded at | Actions
```

Actions:

```text
Preview | Download | Replace | Archive | Access history
```

Rules:

- Never expose raw object keys.
- Never use public permanent URLs for private files.
- Preview/download must fail closed with friendly error.
- Financial, payroll, student document, and report-card files require stricter audit/access controls.

---

## 8. Module-Specific KPI Examples

| Module | KPI 1 | KPI 2 | KPI 3 | KPI 4 | KPI 5 |
|---|---|---|---|---|---|
| M0 Platform | Active schools | Provider issues | Failed jobs | Suspended tenants | Active overrides |
| M1 Students | Active students | Missing docs | New admissions | Duplicate candidates | iEMIS issues |
| M2 Attendance | Classes marked | Absent today | Late today | Not marked | Corrections pending |
| M3 Fees | Collected today | Outstanding dues | Overdue students | Pending reversals | Cashier close status |
| M4 Academics | Marks pending | Locked marks | Reports generated | Publish blockers | Failed batches |
| M5 Activity | Posts today | Pending moderation | Consent blocked media | Failed deliveries | Milestones |
| M6 Homework | Assigned today | Due soon | Pending review | Overdue | Reminder status |
| M7 HR | Active staff | On leave | Leave pending | Payroll exceptions | Expiring contracts |
| M8A Library | Books | Issued | Overdue | Fines | Lost/damaged |
| M8B Transport | Active trips | Stale GPS | Delays | Assigned students | Vehicle expiry |
| M8C Canteen | Meals served | Low wallets | Sales today | Stock low | Allergy warnings |
| M9 Accounting | Fiscal status | Pending journals | Unreconciled | Export jobs | Source mapping issues |
| M10 Notices | Sent today | Scheduled | Failed deliveries | Unread high-impact | Provider issues |
| M12 Learning | Live sessions | Activities | Participants | Submitted attempts | Needs practice |

---

## 9. Web Implementation Acceptance Checklist

Before implementing or marking a screen complete:

1. The screen has one main job.
2. Route is known and role-aware.
3. API dependency is real and listed in the design plan.
4. `tenantId` is enforced by backend; frontend does not rely on hiding actions for security.
5. Data is loaded through shared API client/domain client.
6. Growing lists are server-paginated and filterable.
7. KPIs come from backend summary/list metadata.
8. Empty, loading, error, permission denied, module locked, and success states exist.
9. Sensitive mutations require confirmation and audit reason.
10. Financial mutations are idempotent and backend-owned.
11. Files use File Registry/authenticated preview/download helpers.
12. No raw object keys or permanent provider URLs are shown.
13. Parent/student/driver/staff self-service screens do not use admin-shaped APIs.
14. Icon-only buttons have `aria-label`.
15. Screen has at least one smoke/persona test plan.
16. No fake data, placeholder metrics, or local-only production state.

---

## 10. Codex Implementation Note

When using this file for frontend implementation, do not build all screens at once. Follow the frontend sprint order from the master design plan and implementation plan:

```text
0. API foundation and route guard readiness
1. Auth, Settings, RBAC, Platform basics
2. M1 Students and Admissions
3. M2 Attendance and M6 Timetable foundation
4. M3 Fees and M9 Accounting
5. M4 Academics and M6 Homework
6. M7 HR/Payroll
7. M8A/M8B/M8C Operations
8. M10 Communications and M5 Activity Feed
9. M12 Learning and Advanced Operations
```

Each sprint should read this expansion plus the master web/mobile design plan before making small targeted changes.
