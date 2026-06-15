# SchoolOS Web Frontend Implementation Master Plan

**Status:** Web-only implementation planning document.
**Scope:** `apps/web`, Next.js App Router, school dashboard, settings, and M0 Platform Core / SaaS Admin.
**Source:** Based on the current `docs/design/*.md` design set. The combined `SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md` remains the current design source of truth.

This file is planning only. It does not implement routes, components, APIs, backend code, database schema, tests, or migrations.

---

## 1. Purpose

This is the web-only frontend implementation plan for SchoolOS. It separates web execution planning from mobile execution planning while preserving the current combined web/mobile design source.

The plan covers:

- `apps/web`.
- Next.js App Router.
- School web dashboard.
- Admin, teacher, accountant, librarian, transport, canteen, HR, and payroll workflows.
- Settings.
- M0 Platform Core / SaaS Admin.
- Dense tables, reports, File Registry actions, protected PDFs, exports, and audit-heavy workflows.

---

## 2. Web Product Direction

SchoolOS web is the command center for the school. It should feel like a daily school operating desk, not a generic ERP, template dashboard, or shortcut wall.

Core direction:

- One screen = one main job.
- Real APIs only.
- No fake frontend data, placeholder production metrics, browser-only production state, or client-owned financial truth.
- Use school-friendly language: "Save failed", "You do not have permission", "Receipt download unavailable", not raw technical errors.
- Web-first areas: admin operations, finance, accounting, payroll, reporting, settings, platform, protected exports, File Registry workflows, and dense operational tables.
- Mobile and parent/student/driver/staff self-service surfaces must not drive admin-shaped web decisions.

---

## 3. Web Guardrails

- Keep `tenantId` as the tenant boundary.
- Backend RBAC, tenant scope, module entitlement, and route guards are the source of truth.
- UI visibility is not security and must not bypass backend permission checks.
- Direct locked-module route access must show `ModuleLockedState` or a safe permission state.
- Protected files, PDFs, receipts, report cards, payslips, documents, activity media, and exports must use File Registry/authenticated helper components only.
- Do not expose raw storage URLs, object keys, permanent public URLs, raw Prisma/internal errors, secrets, or provider credentials.
- No Angular migration.
- No microservices.
- No AI runtime features.
- No M9 accounting microservice.
- School Settings and Platform Core must stay separate.
- SaaS billing must not mix with school fee collection.

---

## 4. Web Global App Shell Plan

The global shell should support fast daily work without turning the aside into an operational dashboard.

Required shell pieces:

- `TopBar`: SchoolOS identity, school switcher, academic year switcher, global search, notifications, user menu, and visible support-override/banner state where relevant.
- `SchoolSwitcher`: tenant context where a user has more than one permitted school.
- `AcademicYearSwitcher`: visible for school operations where academic-year context matters.
- `GlobalSearch`: role-scoped, tenant-scoped search only.
- `NotificationBell`: alerts, notices, approvals, delivery failures, and module-specific attention items.
- `UserMenu`: profile, settings, logout, session/security actions.
- `GlobalAside`: navigation only.
- `MainWorkspace`: the real dashboard or selected module workspace.
- `Settings` and `Help` pinned at the bottom of the school aside.
- Role/module-aware navigation.
- Dedicated `PlatformShell` separated from the school shell.

Global aside may contain logo, module links, collapsible groups, role indicator, locked indicators, Settings, and Help. It must not contain KPIs, operational tables, workflow buttons, finance amounts, student private data, or high-risk actions.

---

## 5. Web Design System Plan

Visual style:

- Calm light app background, white cards/tables, readable text, clear hierarchy.
- One SchoolOS base palette with restrained module accents.
- Module accent colors identify location only; semantic colors represent status.
- Avoid decorative gradients, shortcut walls, low-contrast text, and generic admin-kit visuals.

Token summary:

- Brand: `#155EEF`, `#0B3A88`, `#EAF1FF`, `#7C3AED`.
- Surfaces: `#F3F7FB`, `#FFFFFF`, `#F8FAFC`.
- Border/text: `#E2E8F0`, `#0F172A`, `#475569`.
- Semantics: success `#16A34A`, warning `#D97706`, danger `#DC2626`, info `#0284C7`.

Layout and component rules:

- Use `ModuleHeader`, `KpiGrid`, tabs, filters, main content, drawers/modals/wizards, reports/export/print, and audit history.
- One primary CTA per page.
- Secondary actions belong in `More Actions`.
- Cards are for repeated items, metrics, and panels; dense operational work should use tables, grids, queues, calendars, POS panels, or report views.
- Growing lists must be paginated and filtered server-side.
- Filters should use URL `searchParams` where practical.
- Row actions should use one primary row action plus `More`.
- Dangerous actions require separation, confirmation, impact preview, reason where required, and audit.

Required states:

- Loading skeletons that preserve title and selected filters.
- Empty state with one safe next action.
- Error state with parsed backend message, retry, and preserved context.
- Success toast or inline confirmation plus refetch/invalidate.
- Permission denied state.
- Module locked state.
- File unavailable state.
- Slow-network or stale-data state where useful.

Accessibility:

- Keyboard-reachable dialogs, menus, selects, tabs, and sheets.
- Visible focus states.
- Labeled inputs and inline errors.
- Tables with clear headers.
- Status must not rely only on color.
- Icon-only buttons need `aria-label`.

---

## 6. Main Dashboard Plan

The dashboard is the school command center. It should answer:

- What is happening today?
- What needs attention?
- Which module needs action?
- What can this user do quickly from here?

Dashboard sections:

1. Header/greeting/school status.
2. Six to eight top KPIs maximum.
3. Today's operations.
4. Pending approvals and alerts.
5. Module summary cards.
6. Recent activity timeline.
7. Role-based quick actions.
8. Optional reports/charts only where they aid decisions.

Rules:

- Do not deep-fetch every module on first dashboard load.
- Use real summary APIs, safe module summaries, list metadata, or unavailable states.
- Module-locked cards show locked state, not fake values.
- Finance, payroll, private chat, file, and sensitive student summaries must be permission-filtered.
- Recent activity must use safe actor/object labels and avoid private chat/payroll details.

API notes:

- Dashboard summary APIs need backend verification.
- Missing module summaries must be marked as needing real summary API or OpenAPI contract confirmation.

---

## 7. Standard Web Module Workspace Pattern

Every module should follow this default flow:

```text
Dashboard -> List/Table -> Detail Drawer -> Full Page only when needed
```

Standard workspace:

```text
ModuleHeader
KPI Strip
Tabs
Filters/Search/Date/Class/Status
Main Content
Detail Drawer / Modal / Wizard
Reports / Export / Print
Audit History where needed
```

Use full pages only for complex workflows such as student profile, staff profile, report-card batch review, payroll run, accounting reconciliation, timetable builder, large imports, learning activity builder, and controlled learning runtime routes.

---

## 8. Web Module-by-Module Plan

### Main Dashboard

- **Purpose:** School command center for today, alerts, pending work, module health, and safe shortcuts.
- **Screens/tabs:** Single dashboard with role-specific sections.
- **KPI cards:** Students, present today, absent today, fees collected today, pending tasks, staff present, transport trips, overdue fees.
- **Main content:** Today's operations, approvals/alerts, module summaries, recent activity, quick actions.
- **Drawers/modals/wizards:** Alert detail drawer, approval drawer, quick-action modal where appropriate.
- **Primary actions:** Resolve top alert or role-specific next action.
- **Secondary actions:** Open reports, refresh summaries, view activity.
- **Components:** `DashboardWelcomeHeader`, `DashboardKpiGrid`, `TodayOperationsPanel`, `PendingApprovalsPanel`, `AlertPanel`, `ModuleSummaryGrid`, `RecentActivityTimeline`, `QuickActionGrid`.
- **API/data dependencies:** Needs real summary APIs, permissions, entitlements, audit/activity feed, notifications.
- **RBAC/audit/File Registry:** Permission-filtered summaries; no private files opened from dashboard except through protected helpers.
- **States:** Loading, unavailable summary, empty operations, error, permission denied, module locked.
- **Priority:** Build after shell and shared UI foundation.

### M1 Admissions & Student Profiles

- **Purpose:** Student lifecycle from inquiry/admission to profile, guardians, documents, QR, ID card, iEMIS, and lifecycle history.
- **Screens/tabs:** Students, Admissions, Documents, Duplicates, iEMIS Export, QR/ID Cards, Student Profile.
- **KPI cards:** Active students, new admissions, pending applications, missing documents, duplicate candidates, iEMIS issues.
- **Main content:** Server-paginated student table, admission pipeline, duplicate review, import history, document checklist.
- **Drawers/modals/wizards:** Student detail drawer, admission wizard, duplicate review dialog, document upload modal, QR/ID preview, lifecycle/audit drawer.
- **Primary actions:** Add student / create application.
- **Secondary actions:** Import CSV, duplicate review, iEMIS readiness, generate/rotate QR, export, transfer/archive with reason.
- **Components:** `AdmissionsWorkspace`, `AdmissionsTabs`, `StudentFilterBar`, `StudentTable`, `StudentDetailDrawer`, `AdmissionFormWizard`, `StudentDocumentsPanel`, `DuplicateCandidatesPanel`, `IemisExportPanel`, `StudentQrPanel`.
- **API/data dependencies:** Students, admissions, documents, QR, iEMIS readiness, import history, duplicate review; needs OpenAPI contract confirmation for remaining route shapes.
- **RBAC/audit/File Registry:** Teacher assigned-scope; parent-safe data excluded; lifecycle/QR/archive actions audited; photos/docs/ID cards through protected helpers.
- **States:** Empty filters, missing docs, duplicate warnings, permission denied, module locked, file unavailable.
- **Priority:** High-use daily module, W3.

### M2 Smart Attendance

- **Purpose:** Fast attendance marking, monthly registers, corrections, offline drafts, anomaly/follow-up work, and parent absence/late visibility.
- **Screens/tabs:** Daily Attendance, Monthly Register, Corrections, Offline Drafts, Anomalies/Follow-ups, Reports.
- **KPI cards:** Present today, absent today, late, classes not marked, correction requests.
- **Main content:** Attendance grid, class status table, correction queue, monthly register grid.
- **Drawers/modals/wizards:** Correction review drawer, attendance lock banner, offline draft panel, export modal.
- **Primary actions:** Mark/submit attendance.
- **Secondary actions:** Save draft, bulk present, export register, open correction queue.
- **Components:** `AttendanceWorkspace`, `AttendanceControlBar`, `DailyAttendanceGrid`, `AttendanceActionBar`, `MonthlyRegisterGrid`, `CorrectionQueue`, `CorrectionReviewDrawer`, `OfflineDraftPanel`.
- **API/data dependencies:** Rosters, sessions, drafts, corrections, register/export, anomalies, follow-ups; offline sync needs idempotency confirmation.
- **RBAC/audit/File Registry:** Teacher assigned-class scope; correction approval audited; exports through protected helpers.
- **States:** Locked, already submitted, duplicate session, offline draft pending/synced/failed, empty roster, permission denied.
- **Priority:** High-use daily module, W3.

### M3 Fees & Receipts

- **Purpose:** Fee setup, invoices, payment collection, receipts, dues, reversals/refunds, cashier close, reminders, and reports.
- **Screens/tabs:** Dues, Invoices, Payments, Receipts, Discounts, Refunds/Reversals, Cashier Close, Reports.
- **KPI cards:** Collected today, total due, overdue students, pending reversals/refunds, cashier close status.
- **Main content:** Invoice/payment/receipt tables, cashier collection counter, defaulter segmentation, cashier close review.
- **Drawers/modals/wizards:** Payment drawer, receipt preview, reversal reason dialog, discount approval drawer, cashier close confirmation.
- **Primary actions:** Collect/record payment.
- **Secondary actions:** Generate invoices, reprint receipt, cashier close, reconciliation, overdue reminder preview, export.
- **Components:** `FeesWorkspace`, `FeeFilterBar`, `InvoiceTable`, `PaymentDrawer`, `ReceiptPreviewDrawer`, `DiscountRequestPanel`, `RefundReversalPanel`, `CashierClosePanel`.
- **API/data dependencies:** Fees, invoices, payments, receipts, defaulters, reminders, cashier close, gateway status; gateway/mobile payment endpoints need staging/provider verification.
- **RBAC/audit/File Registry:** Decimal money from backend; no client totals as truth; receipt PDFs through blob helper; reversal/refund/close audited.
- **States:** Payment idempotency/pending, receipt unavailable, provider disabled, permission denied, module locked.
- **Priority:** High-use daily module, W3.

### M4 Academics, Exams, CAS & Report Cards

- **Purpose:** Academic setup, exam terms/components, marks entry, CAS, report-card generation/publishing, and parent published results.
- **Screens/tabs:** Subjects, Exam Terms, Marks Entry, CAS, Report Cards, Results/Promotion Readiness.
- **KPI cards:** Active terms, marks pending, draft marks, generated reports, publish blockers.
- **Main content:** Readiness cards, exam tables, spreadsheet-style marks grid, report-card batch table.
- **Drawers/modals/wizards:** Exam template dialog, marks submit action bar, report-card preview drawer, publish confirmation, correction history drawer.
- **Primary actions:** Create exam term / save marks / generate report-card batch depending on active tab.
- **Secondary actions:** Apply template, save draft, submit for review, publish results, download protected PDFs, export.
- **Components:** `AcademicsWorkspace`, `AcademicSelectorBar`, `ExamTermsTable`, `ExamComponentBuilder`, `MarksEntryGrid`, `CasAssessmentPanel`, `ReportCardPanel`, `ReportCardPreviewDrawer`.
- **API/data dependencies:** Academics/exams/marks/CAS/report-cards/results/promotions; report-card PDF protected helper path confirmed in docs, exact DTOs need OpenAPI confirmation.
- **RBAC/audit/File Registry:** Teacher assigned-scope; parent published-only; report PDFs protected; publish/correction audited.
- **States:** Lock, autosave, row validation, absent/withheld/retest, failed batch, permission denied.
- **Priority:** High-use daily module, W3.

### M5 Activity Feed & Milestones

- **Purpose:** Classroom posts, media, moderation, milestones, consent-aware parent visibility.
- **Screens/tabs:** Feed, Pending Approval, Media Gallery, Milestones, Parent View, Reports.
- **KPI cards:** Posts today, pending moderation, consent-blocked media, failed deliveries, milestones.
- **Main content:** Feed/table hybrid, media gallery, approval queue, milestone cards.
- **Drawers/modals/wizards:** Composer drawer, audience preview, approval drawer, media preview drawer.
- **Primary actions:** Create post.
- **Secondary actions:** Approve/reject, archive, milestone templates, delivery logs, download protected media.
- **Components:** `ActivityWorkspace`, `ActivityFilterBar`, `ActivityFeedList`, `ActivityPostCard`, `ActivityApprovalPanel`, `ConsentWarningBanner`, `MediaGallery`, `MilestonePanel`, `ParentActivityPreview`.
- **API/data dependencies:** Activity posts, audience preview, gallery/media access, milestones, delivery status; needs OpenAPI contract confirmation for UI-specific summary DTOs.
- **RBAC/audit/File Registry:** Parent linked-child and consent scope; removed guardians denied; media protected; moderation audited.
- **States:** Consent blocked, media unavailable, pending approval, failed delivery, module locked.
- **Priority:** After highest-use core, but tied to M10 and parent trust; W4/W5 depending on current backlog.

### M6 Homework & Timetable

- **Purpose:** Homework assignment/review, attachments, reminders, timetable builder, conflicts, substitutions, and teacher workload.
- **Screens/tabs:** Homework, Submissions, Timetable Builder, Substitution, Teacher Workload, Reports.
- **KPI cards:** Homework assigned, due soon, pending submissions, teacher conflicts, substitutions.
- **Main content:** Homework table, submissions table, weekly timetable grid, conflict panel, substitution queue.
- **Drawers/modals/wizards:** Homework detail drawer, homework form, submission review drawer, period editor, substitution dialog.
- **Primary actions:** Create homework / validate timetable version.
- **Secondary actions:** Template library, recurring homework, reminders, publish/lock timetable, export.
- **Components:** `HomeworkTimetableWorkspace`, `HomeworkFilterBar`, `HomeworkTable`, `HomeworkDetailDrawer`, `SubmissionReviewPanel`, `TimetableBuilder`, `ConflictPanel`, `SubstitutionPanel`.
- **API/data dependencies:** Homework, submissions, reminders, templates, timetable versions, validation, substitutions; recurring/template depth needs backend verification.
- **RBAC/audit/File Registry:** Attachments through File Registry; publish/lock audited; parent/student see assigned published work only.
- **States:** Attachment unavailable, conflict, substitution missing teacher, offline read cache where mobile only, permission denied.
- **Priority:** Operational module, W4.

### M7 HR & Payroll

- **Purpose:** Staff lifecycle, documents, contracts, leave, attendance, payroll runs, payslips, and HR reports.
- **Screens/tabs:** Staff, Contracts, Leave, Attendance, Payroll, Payslips, Reports.
- **KPI cards:** Active staff, on leave today, pending leave, contract expiring, payroll exceptions.
- **Main content:** Staff table, leave queue/calendar, payroll run table, payslip list.
- **Drawers/modals/wizards:** Staff detail drawer, staff form, leave approval drawer, payroll run wizard, payslip preview.
- **Primary actions:** Add staff / start payroll preview depending on tab.
- **Secondary actions:** Contract reminders, approve leave, post/reverse payroll, download payslips, export.
- **Components:** `HrPayrollWorkspace`, `StaffFilterBar`, `StaffTable`, `StaffDetailDrawer`, `LeaveApprovalPanel`, `PayrollRunWizard`, `PayslipPreviewDrawer`.
- **API/data dependencies:** Staff, HR, leave, attendance, payroll, payslips; salary versioning/check-in depth needs backend verification.
- **RBAC/audit/File Registry:** Salary/bank fields permission-gated; payslips protected; payroll posting/reversal audited.
- **States:** Missing documents, salary permission denied, payroll locked/posted, payslip unavailable, module locked.
- **Priority:** Operational module, W4.

### M8A Library

- **Purpose:** Catalog, copies, issue/return, overdues, fines, scanner workflows, and reports.
- **Screens/tabs:** Catalog, Copies, Issue/Return, Overdue, Fines, Reports.
- **KPI cards:** Books, available copies, issued, overdue, fines pending.
- **Main content:** Search-first book table, copy table, scanner issue/return panel, overdue/fines report.
- **Drawers/modals/wizards:** Book detail drawer, issue drawer, return drawer, copy archive dialog.
- **Primary actions:** Add book / scanner issue-return depending on context.
- **Secondary actions:** Add copy, archive copy, post fine to fees, export overdue.
- **Components:** `LibraryWorkspace`, `LibraryFilterBar`, `BookTable`, `BookDetailDrawer`, `IssueBookDrawer`, `ReturnBookDrawer`, `OverduePanel`, `LibraryFinePanel`.
- **API/data dependencies:** Library books/copies/issues/returns/QR lookup/fines/reports; scanner device QA still needed.
- **RBAC/audit/File Registry:** Borrower scope; archive/lost/damaged reason audited; reports/export through File Registry where retained.
- **States:** Copy not found, already issued, borrower blocked, archived copy, overdue fine, module locked.
- **Priority:** Operational module, W4.

### M8B Transport

- **Purpose:** Routes, stops, vehicles, assignments, trips, GPS/latest-location status, alerts, and reports.
- **Screens/tabs:** Routes, Stops, Vehicles, Students, Trips, Location Status/GPS Quality, Reports.
- **KPI cards:** Active trips, assigned students, stale GPS, delays, vehicle document expiry.
- **Main content:** Route/trip table, latest GPS status, trip history, assignment tables.
- **Drawers/modals/wizards:** Route/trip detail drawer, assign student dialog, assign driver dialog, trip history/export drawer.
- **Primary actions:** Create route.
- **Secondary actions:** Assign students, assign driver, start trip, GPS quality report, export.
- **Components:** `TransportWorkspace`, `TransportFilterBar`, `RouteVehicleSplitView`, `RouteTable`, `TripDetailDrawer`, `StudentTransportAssignmentPanel`, `TransportAlertPanel`.
- **API/data dependencies:** Transport routes/stops/vehicles/assignments/trips/location/driver/parent/reports; live map needs SSE/WebSocket/privacy/load decision and is deferred.
- **RBAC/audit/File Registry:** Parent sees assigned child route only; driver APIs are purpose-limited; exports protected.
- **States:** Stale GPS, no active trip, driver unassigned, vehicle inactive, module locked.
- **Priority:** Operational module, W4.

### M8C Canteen

- **Purpose:** Menu, meal plans, wallets, QR serving, POS, inventory, vendors, receipts, and reports.
- **Screens/tabs:** POS, Serving, Menu, Wallets, Inventory, Vendors, Reports.
- **KPI cards:** Meals served, sales today, low wallets, stock low, allergy warnings.
- **Main content:** Touch-friendly POS/serving panel, menu grid, wallet table, inventory/stock panels.
- **Drawers/modals/wizards:** QR serve panel, wallet top-up dialog, sale/refund dialog, stock adjustment, receipt preview.
- **Primary actions:** Open POS / serve via QR.
- **Secondary actions:** Add menu item, wallet top-up, stock close, wastage report, export.
- **Components:** `CanteenWorkspace`, `CanteenFilterBar`, `MenuItemGrid`, `QrServePanel`, `StudentWalletSummary`, `WalletPanel`, `OrderTable`, `StockPanel`.
- **API/data dependencies:** Canteen menu, enrollments, parent status, servings, wallets, POS sales, receipts, inventory/vendors/reports; device/browser POS QA needed.
- **RBAC/audit/File Registry:** Allergy/medical warning visible before serving; backend-required acknowledgement; wallet debit atomic; receipt protected.
- **States:** Insufficient wallet, allergy acknowledgement required, item out of stock, duplicate serve, module locked.
- **Priority:** Operational module, W4.

### M9 Accounting & Finance

- **Purpose:** Chart of accounts, journals, ledgers, fiscal periods, reconciliation, source mappings, protected reports/exports.
- **Screens/tabs:** Dashboard, Chart of Accounts, Journals, Ledger, Trial Balance, Reports, Reconciliation, Period Close.
- **KPI cards:** Fiscal year status, pending journals, unreconciled bank items, export jobs, source mapping issues.
- **Main content:** Formal accounting dashboard, journal table, COA tree, ledger drawer, reconciliation split view, reports.
- **Drawers/modals/wizards:** Journal drawer, journal form, post/reverse dialogs, reconciliation drawer, period close dialog.
- **Primary actions:** Create journal / import statement / run report depending on tab.
- **Secondary actions:** Post, reverse, correct, auto match, export ledger, close/reopen period.
- **Components:** `AccountingWorkspace`, `AccountingFilterBar`, `JournalTable`, `JournalEntryDrawer`, `ChartOfAccountsTree`, `LedgerPanel`, `TrialBalancePreview`, `FinancialReportsPanel`, `PeriodClosePanel`.
- **API/data dependencies:** Accounting accounts, fiscal years, periods, journals, vouchers, reports, exports, reconciliation; large export progress UI needs contract confirmation.
- **RBAC/audit/File Registry:** Ledger writes must come from accounting boundary; posted records use reversal/correction; exports File Registry-backed.
- **States:** Fiscal lock, unbalanced journal, export pending/failed, reconciliation mismatch, permission denied.
- **Priority:** W5.

### M10 Notices & Communication

- **Purpose:** Notices, announcements, templates, recipient preview, delivery logs, notification center, and controlled parent-teacher chat.
- **Screens/tabs:** Notices, Compose, Chat, Recipients, Delivery Logs, Templates, Provider Diagnostics.
- **KPI cards:** Sent today, scheduled, failed deliveries, unread high-impact, escalated chats.
- **Main content:** Notice table/composer, audience preview, delivery status, chat inbox layout.
- **Drawers/modals/wizards:** Composer panel, recipient selector, send confirmation, template editor, escalation/report drawer.
- **Primary actions:** Send notice.
- **Secondary actions:** Save draft, schedule, templates, delivery logs, provider diagnostics, retry with reason.
- **Components:** `CommunicationWorkspace`, `CommunicationFilterBar`, `NoticeList`, `NoticeComposerPanel`, `NoticeAudienceSelector`, `NoticePreviewPanel`, `DeliveryLogsPanel`, `ChatInboxLayout`, `QuietHoursBanner`.
- **API/data dependencies:** Notices, recipient preview, notification center, messaging, conversations, provider diagnostics; push/FCM depends on provider readiness.
- **RBAC/audit/File Registry:** High-impact messages audited; attachments protected; teacher threads assigned-scope; quiet hours enforced.
- **States:** Provider disabled, delivery retry pending, quiet-hours banner, attachment unavailable, permission denied.
- **Priority:** High-use daily module, W3.

### M12 Learning Layer

- **Purpose:** Teacher-controlled learning activities, board/lab sessions, resources, attempts, progress, and parent child-scoped summaries.
- **Screens/tabs:** Activities, Sessions, Resources, Progress, Activity Builder, Board Session, Student Lab Session, Parent Summary.
- **KPI cards:** Live sessions, published activities, active participants, submitted attempts, needs-practice summary.
- **Main content:** Activity table, activity builder, resource library, session monitor, progress table.
- **Drawers/modals/wizards:** Activity preview, resource picker, launch session dialog, session monitor drawer, attempt review.
- **Primary actions:** Create activity / launch session.
- **Secondary actions:** Attach resource, pause/resume/end session, export progress.
- **Components:** `LearningWorkspace`, `LearningFilterBar`, `ActivityTable`, `ActivityBuilder`, `ResourceLibraryPanel`, `LaunchSessionDialog`, `SessionMonitorDrawer`, `BoardSessionControls`, `ProgressPanel`, `ParentLearningSummaryPanel`.
- **API/data dependencies:** Learning activities/sessions/resources/attempts/progress/parent summary; protected file upload picker needs backend/UI verification.
- **RBAC/audit/File Registry:** Teacher assigned-scope; resources protected; parent sees own child only; student sees own active session/attempt only.
- **States:** Live/paused/ended/expired, heartbeat issue, autosave pending/failed, session invalid, module locked.
- **Priority:** W5.

### Settings

- **Purpose:** School-level configuration, not daily operations.
- **Screens/tabs:** School Profile, Academic Years, Classes & Sections, Users, Roles & Permissions, Module Access, Fee Settings, Attendance Settings, Exam/Report Card Settings, Notification Settings, Templates, File & Document Settings, Security, Integrations, Backup & Export, Settings Audit Log.
- **KPI cards:** Optional and sparse; focus on configuration status, incomplete setup, high-risk settings, audit changes.
- **Main content:** Settings sidebar plus selected settings panel.
- **Drawers/modals/wizards:** User drawer, role matrix, confirmation/reason dialogs, logo upload, template editor.
- **Primary actions:** Save selected settings area.
- **Secondary actions:** Export audit log, preview templates, force logout, provider readiness, backup/export.
- **Components:** `SettingsWorkspace`, `SettingsSidebar`, `SettingsSearch`, `SettingsSectionCard`, specific settings panels, `SettingsAuditLog`.
- **API/data dependencies:** Settings/public/settings audit logs/users/roles/permissions/module access/branding/logo; some areas need OpenAPI confirmation.
- **RBAC/audit/File Registry:** All settings mutations audited; sensitive changes require confirmation/reason; logo/file rules through File Registry.
- **States:** Unsaved changes, validation errors, provider disabled, permission denied, audit export denied.
- **Priority:** W5.

### M0 Platform Core / SaaS Admin

- **Purpose:** Platform control plane for SchoolOS operators, not normal school users.
- **Screens/tabs:** Platform Dashboard, Tenants, Plans & Billing, Module Access, Feature Flags, Platform Users/Admins, RBAC Templates, File Registry, Audit Logs, System Health, Queues & Jobs, Storage, Backups, Support Tools, Global Platform Settings.
- **KPI cards:** Active schools, suspended schools, provider issues, failed jobs, active support overrides, storage usage, trial tenants.
- **Main content:** Platform attention queue, tenant table, module access matrix, health/service tables, jobs queue, audit logs.
- **Drawers/modals/wizards:** Tenant detail drawer, create tenant wizard, plan editor, feature flag drawer, support sensitive action dialog, restore point drawer.
- **Primary actions:** Review highest-risk school / create tenant depending on page.
- **Secondary actions:** Provider readiness, queue center, audit logs, export platform report, support override.
- **Components:** `PlatformShell`, `PlatformTopBar`, `PlatformAside`, `PlatformDashboardWorkspace`, `TenantWorkspace`, `TenantCreateWizard`, `ModuleAccessWorkspace`, `FeatureFlagsWorkspace`, `PlatformFileRegistryWorkspace`, `PlatformAuditWorkspace`, `SystemHealthWorkspace`, `QueueWorkspace`, `SupportToolsWorkspace`.
- **API/data dependencies:** Platform dashboard, tenants, plans, feature keys, entitlements, providers/readiness, queues, audit logs, support override, report exports; exact current route set needs OpenAPI confirmation.
- **RBAC/audit/File Registry:** Platform-only guards; no tenant-private data without override; support override audited and visible; platform file preview/download audited.
- **States:** Support override active, provider disabled/unconfigured, queue retry race, tenant suspended, permission denied.
- **Priority:** W5.

---

## 9. Web Settings Plan

Settings controls one school's configuration.

Required settings areas:

- School Profile.
- Academic Years.
- Classes & Sections.
- Users.
- Roles & Permissions.
- Module Access visibility.
- Fee Settings.
- Attendance Settings.
- Exam/Report Card Settings.
- Notification Settings.
- Templates.
- File & Document Settings.
- Security.
- Integrations.
- Backup & Export.
- Settings Audit Log.

Rules:

- All settings mutations must be audited.
- Sensitive settings changes require confirmation and reason where configured.
- Module visibility does not override SaaS entitlement.
- Direct locked route access still shows `ModuleLockedState`.
- Integration secrets are masked.
- File/document settings use File Registry rules.
- Backup restore remains high risk and should not be casually exposed to normal school users.

---

## 10. Web Platform Core Plan

Platform is the SaaS owner/developer/super admin control plane. It is separate from school Settings.

Required platform areas:

- Platform Dashboard.
- Tenants.
- Plans & Billing.
- Module Access.
- Feature Flags.
- Platform Users/Admins.
- RBAC Templates.
- File Registry.
- Audit Logs.
- System Health.
- Queues & Jobs.
- Storage.
- Backups.
- Support Tools.
- Global Platform Settings.

Dangerous platform actions require:

1. Reason.
2. Confirmation.
3. Audit log.
4. Role permission.
5. Clear impact preview.

Examples: suspend tenant, disable module, retry failed payment jobs, restore backup, impersonate/support override, force logout, delete admin, enable maintenance mode, cleanup files.

---

## 11. Web Component Architecture Plan

Recommended folder structure:

```text
apps/web/components/
  layout/
  ui/
  dashboard/
  admissions/
  attendance/
  finance/
  academics/
  activity/
  homework/
  hr/
  library/
  transport/
  canteen/
  accounting/
  communication/
  learning/
  settings/
  platform/
```

Separation:

- Shared UI components: `ModuleHeader`, `KpiCard`, `KpiGrid`, `ModuleTabs`, `FilterBar`, `DataTable`, `StatusBadge`, `ActionMenu`, `DetailDrawer`, `ConfirmDialog`, `EmptyState`, `ErrorState`, `LoadingState`, `PermissionState`, `ModuleLockedState`, `ProtectedFileButton`, `ProtectedFileLink`.
- Layout components: `DashboardShell`, `TopBar`, `GlobalAside`, `MainContent`, `PlatformShell`.
- Dashboard components: command-center KPIs, operations, approvals, alerts, module summaries, activity, quick actions.
- Module-specific components: workflow-specific tables, grids, drawers, panels, POS, maps, builders, and wizards.
- Settings components: school configuration panels and settings audit.
- Platform components: platform shell, tenants, plans, module access, health, queues, storage, support, audit, backups.

Rule:

```text
Shared components handle layout and behavior.
Module components handle school-specific workflows.
Workspace components connect API data, filters, tabs, actions, and state.
```

---

## 12. Web Route Plan

Planning only. Do not implement routes from this document without checking existing `apps/web/app` and OpenAPI contracts.

Recommended school routes:

```text
/dashboard
/dashboard/students
/dashboard/students/[studentId]
/dashboard/admissions
/dashboard/attendance
/dashboard/attendance/register
/dashboard/attendance/corrections
/dashboard/fees
/dashboard/finance/collections
/dashboard/fees/cashier-close
/dashboard/academics
/dashboard/academics/marks
/dashboard/academics/report-cards
/dashboard/activity
/dashboard/homework
/dashboard/timetable
/dashboard/timetable/builder
/dashboard/hr
/dashboard/payroll
/dashboard/library
/dashboard/library/issue-return
/dashboard/transport
/dashboard/canteen
/dashboard/canteen/pos
/dashboard/accounting
/dashboard/accounting/journals
/dashboard/accounting/reconciliation
/dashboard/notices
/dashboard/messages
/dashboard/learning
/dashboard/learning/activities/[activityId]
/classroom/board/session/[sessionId]
/student/learning/session/[sessionId]
/dashboard/reports
/dashboard/settings
/dashboard/settings/users
/dashboard/settings/roles
```

Recommended platform routes:

```text
/platform
/platform/tenants
/platform/tenants/new
/platform/tenants/[tenantId]
/platform/plans
/platform/billing
/platform/module-access
/platform/feature-flags
/platform/admins
/platform/rbac-templates
/platform/file-registry
/platform/audit-logs
/platform/system-health
/platform/queues
/platform/storage
/platform/backups
/platform/support
/platform/settings
```

---

## 13. Web API Contract Plan

Do not invent fake endpoint contracts. Before implementation, each area must be checked against current OpenAPI output and `apps/web/lib/api/*`.

High-level data needs:

- Auth/session: current user, roles, permissions, tenant status, support override, module entitlements.
- Dashboard: real summary APIs or unavailable states; needs real summary API.
- M1: students, admissions, documents, QR, lifecycle, imports, duplicates, iEMIS; needs OpenAPI contract confirmation.
- M2: rosters, sessions, drafts, corrections, registers, exports, anomalies, follow-ups; needs idempotency/offline confirmation.
- M3: fee heads, invoices, payments, receipts, reversals, reminders, cashier close, exports, provider readiness; gateway actions need staging/provider verification.
- M4: exams, terms, marks, CAS, report cards, PDFs, results, promotions; needs contract confirmation for UI DTOs.
- M5: posts, audience preview, media access, moderation, milestones, delivery logs; needs protected media contract confirmation.
- M6: homework, submissions, templates, reminders, timetable versions, conflicts, substitutions; needs contract confirmation for recurring/depth.
- M7: staff, leave, attendance, payroll, payslips, documents; needs salary/permission DTO confirmation.
- M8A: books, copies, issues, returns, QR lookup, fines, reports; needs scanner/device contract confirmation.
- M8B: routes, stops, vehicles, trips, GPS/latest location, driver/parent scoped data, reports; live map deferred.
- M8C: menu, wallets, serving, POS, receipts, inventory, vendors, reports; needs POS idempotency confirmation.
- M9: accounts, journals, fiscal periods, reports, exports, reconciliation; needs queued export progress contract confirmation.
- M10: notices, recipient preview, messaging, notification center, delivery logs, provider diagnostics; needs provider readiness confirmation.
- M12: activities, sessions, attempts, resources, progress, parent summary; protected resource picker needs backend verification.
- Settings: school profile, academic years, classes/sections, users, roles, module visibility, fee/attendance/exam/notification/file/security/integration settings, audit logs; needs OpenAPI contract confirmation.
- Platform: tenants, plans, billing, module access, feature flags, platform admins, RBAC templates, File Registry, audit logs, system health, queues, storage, backups, support tools, global settings; needs OpenAPI contract confirmation.

Unknown or missing contracts must be marked:

- needs backend verification
- needs OpenAPI contract confirmation
- needs real summary API

---

## 14. Web Implementation Order

Use this sequence:

- **W1 Shared UI foundation and shell standardization:** shared states, shell, topbar, aside, role/module navigation, protected file components, table/filter primitives, dialogs, audit reason patterns.
- **W2 Main dashboard command center:** real summary/unavailable states, role quick actions, module cards, recent activity.
- **W3 High-use daily modules:** M1, M2, M3, M4, M10.
- **W4 Operational modules:** M6, M7, M8A, M8B, M8C.
- **W5 Accounting, Learning, Settings, Platform Core:** M9, M12, school settings, platform control plane.
- **W6 Polish, accessibility, contract verification, smoke tests, production checks.**

Do not use "Phase 1/2" labels in navigation.

---

## 15. Web Testing and Verification Plan

Testing scope:

- lint
- typecheck
- build
- OpenAPI sync
- UI contract checks
- RBAC/permission states
- module locked states
- protected file preview/download
- no fake data
- loading/empty/error/success states
- dashboard summary API checks
- settings audit checks
- platform dangerous-action checks
- accessibility checks
- route protection
- e2e smoke paths

Commands to run when implementation changes are made:

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

Do not claim any command passed unless it was actually run in that implementation turn.

---

## 16. Web Risks

- Tenant isolation bypass through broad client queries.
- Fake frontend data returning to dashboard cards or module KPIs.
- Unbounded dashboard fetches across all modules.
- Missing module locked states.
- Duplicate UI primitives and inconsistent page behavior.
- Raw file URLs or object keys in browser.
- Sensitive finance/payroll exposure.
- Platform/school settings confusion.
- Support override misuse or invisible override context.
- AI feature flags accidentally enabled.
- Parent, driver, staff self-service, or student lab/session surfaces using admin-shaped APIs.
- Client-side totals replacing backend-owned totals.
- Dangerous actions without reason, confirmation, impact preview, permission, and audit.
