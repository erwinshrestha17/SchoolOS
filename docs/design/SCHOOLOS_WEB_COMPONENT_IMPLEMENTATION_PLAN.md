# SchoolOS Web Component Implementation Plan

**Status:** Companion design and implementation planning guide for SchoolOS web components.  
**Scope:** Web component architecture planning only. This document does not implement backend, frontend, mobile, API, database, migrations, or tests.  
**Related docs:**

- `docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md`
- `docs/design/SCHOOLOS_WEB_DESIGN_EXPANSION.md`
- `docs/design/SCHOOLOS_WEB_MODULE_WORKSPACE_LAYOUT.md`
- `docs/design/SCHOOLOS_WEB_MAIN_DASHBOARD_LAYOUT.md`
- `docs/design/SCHOOLOS_WEB_LOW_FIDELITY_WIREFRAMES.md`
- `docs/design/SCHOOLOS_MODULE_FEATURE_BREAKDOWN.md`

Use this structure for the SchoolOS web app:

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
  platform/
```

Guardrails:

- Use real APIs only.
- Keep `tenantId` as the tenant boundary everywhere.
- Backend RBAC and tenant scoping remain the source of truth.
- Shared UI components should not bypass backend authorization.
- File/PDF/media actions must use protected File Registry helpers.
- Financial, payroll, accounting, lifecycle, publish, archive, support override, and reversal actions require confirmation and audit reason where required.
- Do not add Angular, microservices, fake frontend data, AI runtime, broad student mobile, or public student leaderboards from this component work.

---

## 1. Core Layout Components

These components are used everywhere.

### App Shell Components

| Component | Purpose |
|---|---|
| `DashboardShell` | Main wrapper for logged-in dashboard pages. |
| `TopBar` | School switcher, academic year, search, notifications, user menu. |
| `GlobalAside` | Main module navigation. |
| `AsideModuleItem` | Single module item in sidebar. |
| `AsideModuleGroup` | Collapsible module group. |
| `UserRoleBadge` | Shows current role like Principal, Teacher, Accountant. |
| `SchoolSwitcher` | Switch school/tenant if user belongs to multiple schools. |
| `AcademicYearSwitcher` | Select active academic year. |
| `NotificationBell` | Shows alerts, notices, approvals. |
| `UserMenu` | Profile, settings, logout. |

Recommended layout tree:

```text
DashboardShell
  TopBar
    SchoolSwitcher
    AcademicYearSwitcher
    GlobalSearch
    NotificationBell
    UserMenu

  GlobalAside
    AsideModuleItem
    AsideModuleGroup

  MainContent
    Page content
```

---

## 2. Shared UI Components

These should be reusable across every module.

### General UI

| Component | Purpose |
|---|---|
| `ModuleHeader` | Page title, description, primary action button. |
| `KpiCard` | Small metric card. |
| `KpiGrid` | Grid wrapper for KPI cards. |
| `ModuleTabs` | Module-level tabs. |
| `FilterBar` | Search, filters, date, class, status. |
| `DataTable` | Standard table component. |
| `StatusBadge` | Active, Pending, Approved, Rejected, Paid, Overdue. |
| `ActionMenu` | View/Edit/Delete/Approve actions. |
| `DetailDrawer` | Right-side detail view. |
| `CreateEditModal` | Modal for create/edit forms. |
| `ConfirmDialog` | Delete, reversal, approval confirmation. |
| `EmptyState` | When no data exists. |
| `ErrorState` | Error display. |
| `LoadingState` | Skeleton/loading UI. |
| `ModuleLockedState` | When tenant does not have module access. |

### Form Components

| Component | Purpose |
|---|---|
| `FormSection` | Groups fields inside forms. |
| `TextField` | Text input. |
| `SelectField` | Dropdown. |
| `DateField` | Date picker. |
| `TextareaField` | Long text. |
| `CheckboxField` | Checkbox input. |
| `ToggleField` | On/off setting. |
| `FileUploadField` | Upload document/media. |
| `FormActions` | Cancel, save draft, submit buttons. |
| `ValidationSummary` | Shows form errors. |

### File Components

| Component | Purpose |
|---|---|
| `ProtectedFileButton` | Authenticated preview/download button. |
| `ProtectedFileLink` | Authenticated file link. |
| `FilePreviewCard` | Shows uploaded file preview. |
| `FileUploadDropzone` | Drag/drop upload. |
| `FileRegistryList` | List of registered files. |
| `DocumentStatusBadge` | Uploaded, Missing, Expired. |

### Workflow Components

| Component | Purpose |
|---|---|
| `ApprovalQueue` | Shows pending approval items. |
| `ApprovalActionPanel` | Approve/reject/request changes. |
| `AuditTimeline` | Shows history of changes. |
| `RecentActivityTimeline` | Shows recent actions. |
| `CommentBox` | Internal remarks/comments. |
| `ReasonRequiredDialog` | Used for reversals, rejection, correction. |
| `ExportButton` | Export CSV/Excel/PDF. |
| `PrintButton` | Print receipt, report card, register. |

---

## 3. Main Dashboard Components

### Dashboard Component Tree

```text
MainDashboardPage
  DashboardWelcomeHeader
  DashboardKpiGrid
    DashboardKpiCard

  TodayOperationsPanel
    OperationStatusCard

  PendingApprovalsPanel
    PendingApprovalItem

  AlertPanel
    AlertItem

  ModuleSummaryGrid
    ModuleSummaryCard

  RecentActivityTimeline

  QuickActionGrid
    QuickActionButton
```

### Components

| Component | Purpose |
|---|---|
| `DashboardWelcomeHeader` | Greeting, school name, academic year, school status. |
| `DashboardKpiGrid` | Shows top school-wide KPIs. |
| `DashboardKpiCard` | Students, attendance, fees, staff, notices. |
| `TodayOperationsPanel` | Attendance, fees, classes, transport, canteen status. |
| `OperationStatusCard` | One operation summary card. |
| `PendingApprovalsPanel` | Corrections, leave, discounts, activity approvals. |
| `PendingApprovalItem` | Single approval row. |
| `AlertPanel` | High/medium/low alerts. |
| `AlertItem` | Single alert with severity badge. |
| `ModuleSummaryGrid` | Cards for all modules. |
| `ModuleSummaryCard` | Summary of one module. |
| `RecentActivityTimeline` | System activity feed. |
| `QuickActionGrid` | Role-based shortcuts. |
| `QuickActionButton` | New admission, collect fee, create notice, etc. |

---

## 4. M1 — Admissions and Student Profiles Components

### Component Tree

```text
AdmissionsWorkspace
  ModuleHeader
  KpiGrid

  AdmissionsTabs

  StudentFilterBar
  StudentTable
  StudentDetailDrawer

  AdmissionFormWizard
  StudentDocumentsPanel
  DuplicateCandidatesPanel
  IemisExportPanel
  StudentQrPanel
```

### Components

| Component | Purpose |
|---|---|
| `AdmissionsWorkspace` | Main container for admissions module. |
| `AdmissionsTabs` | Students, Admissions, Documents, Duplicates, iEMIS, QR. |
| `StudentFilterBar` | Search, class, section, status, document status. |
| `StudentTable` | Lists all students. |
| `StudentTableRow` | Single student row. |
| `StudentDetailDrawer` | Quick student profile view. |
| `StudentProfileSummary` | Basic student details. |
| `GuardianInfoPanel` | Father, mother, local guardian. |
| `StudentEnrollmentPanel` | Class, section, academic year, roll number. |
| `StudentDocumentsPanel` | Upload/view student documents. |
| `StudentDocumentList` | Document list with status. |
| `AdmissionFormWizard` | Step-by-step admission form. |
| `AdmissionBasicInfoStep` | Student personal details. |
| `AdmissionGuardianStep` | Guardian/family details. |
| `AdmissionAcademicStep` | Class, section, previous school. |
| `AdmissionDocumentsStep` | Upload required documents. |
| `AdmissionReviewStep` | Final review before submit. |
| `DuplicateCandidatesPanel` | Shows possible duplicate students. |
| `DuplicateMergeDialog` | Merge duplicate student records. |
| `IemisExportPanel` | Government/iEMIS export screen. |
| `IemisValidationList` | Missing required government fields. |
| `StudentQrPanel` | Generate, rotate, view QR. |
| `StudentIdCardPreview` | ID card preview. |
| `StudentReportsPanel` | Student list, missing docs, admission reports. |

---

## 5. M2 — Smart Attendance Components

### Component Tree

```text
AttendanceWorkspace
  ModuleHeader
  KpiGrid

  AttendanceTabs

  AttendanceControlBar
  DailyAttendanceGrid
  AttendanceActionBar

  MonthlyRegisterGrid
  CorrectionQueue
  CorrectionReviewDrawer
  OfflineDraftPanel
```

### Components

| Component | Purpose |
|---|---|
| `AttendanceWorkspace` | Main attendance container. |
| `AttendanceTabs` | Daily, Monthly Register, Corrections, Offline Drafts. |
| `AttendanceControlBar` | Date, class, section selector. |
| `AttendanceKpiStrip` | Present, absent, late, corrections. |
| `DailyAttendanceGrid` | Main attendance marking grid. |
| `AttendanceStudentRow` | Student row with status buttons. |
| `AttendanceStatusToggle` | Present/Absent/Late/Leave selector. |
| `BulkAttendanceActions` | Mark all present, clear all. |
| `AttendanceActionBar` | Save draft, submit, export. |
| `MonthlyRegisterGrid` | Month-wise attendance sheet. |
| `MonthlyRegisterCell` | Daily status cell. |
| `CorrectionQueue` | List of correction requests. |
| `CorrectionRequestCard` | Single correction request. |
| `CorrectionReviewDrawer` | Approve/reject correction. |
| `AttendanceLockBanner` | Shows lock/deadline state. |
| `OfflineDraftPanel` | Offline saved drafts. |
| `OfflineSyncStatus` | Synced, pending, conflict. |
| `AttendanceReportsPanel` | Daily/monthly/export reports. |

---

## 6. M3 — Fees and Receipts Components

### Component Tree

```text
FeesWorkspace
  ModuleHeader
  KpiGrid

  FeesTabs

  FeeFilterBar
  InvoiceTable
  PaymentDrawer
  ReceiptPreviewDrawer

  DiscountApprovalPanel
  RefundReversalPanel
  CashierClosePanel
```

### Components

| Component | Purpose |
|---|---|
| `FeesWorkspace` | Main fees module. |
| `FeesTabs` | Invoices, Payments, Receipts, Discounts, Refunds, Cashier Close. |
| `FeeKpiGrid` | Collected today, due, overdue, refunds. |
| `FeeFilterBar` | Search student/invoice, class, month, status. |
| `InvoiceTable` | Invoice list. |
| `InvoiceStatusBadge` | Paid, partial, unpaid, overdue. |
| `InvoiceDetailDrawer` | Invoice breakdown. |
| `GenerateInvoiceDialog` | Create single/bulk invoice. |
| `PaymentDrawer` | Collect payment. |
| `PaymentMethodSelector` | Cash, bank, cheque, QR. |
| `ReceiptPreviewDrawer` | Receipt PDF/print preview. |
| `ReceiptActionButtons` | Print, download, reprint. |
| `DiscountRequestPanel` | Student discount requests. |
| `DiscountApprovalDrawer` | Approve/reject discount. |
| `RefundReversalPanel` | Refund/reversal list. |
| `ReversalReasonDialog` | Required reason for reversal. |
| `CashierClosePanel` | Daily cashier close. |
| `CashierCloseSummary` | Expected vs actual cash. |
| `CashierClosePdfButton` | Download cashier close PDF. |
| `FeeReportsPanel` | Due, collection, overdue, discount reports. |

---

## 7. M4 — Academics, Exams, CAS and Report Cards Components

### Component Tree

```text
AcademicsWorkspace
  ModuleHeader
  KpiGrid

  AcademicsTabs

  AcademicSelectorBar
  SubjectsTable
  ExamTermsTable
  MarksEntryGrid
  CasAssessmentPanel
  ReportCardPanel
```

### Components

| Component | Purpose |
|---|---|
| `AcademicsWorkspace` | Main academics module. |
| `AcademicsTabs` | Subjects, Exam Terms, Marks Entry, CAS, Report Cards. |
| `AcademicSelectorBar` | Class, section, term, subject. |
| `SubjectsTable` | Subject list. |
| `SubjectFormDialog` | Add/edit subject. |
| `ExamTermsTable` | Exam term list. |
| `ExamTermFormDialog` | Create/edit exam term. |
| `ExamComponentBuilder` | Theory, practical, internal components. |
| `MarksEntryGrid` | Spreadsheet-style marks entry. |
| `MarksEntryRow` | Student marks row. |
| `MarksInputCell` | Marks input with validation. |
| `MarksCalculationFooter` | Total, grade, pass/fail. |
| `MarksSubmitActionBar` | Save draft, submit, lock. |
| `CasAssessmentPanel` | CAS indicators and grading. |
| `CasStudentAssessmentRow` | Student CAS row. |
| `ReportCardPanel` | Generate/publish report cards. |
| `ReportCardStatusTable` | Student report card status. |
| `ReportCardPreviewDrawer` | Report card preview. |
| `ReportCardPdfButton` | Download report card PDF. |
| `PublishResultDialog` | Confirm result publishing. |
| `AcademicsReportsPanel` | Result summary, grade distribution. |

---

## 8. M5 — Activity Feed and Milestones Components

### Component Tree

```text
ActivityWorkspace
  ModuleHeader
  KpiGrid

  ActivityTabs

  ActivityFilterBar
  ActivityFeedList
  ActivityPostCard
  ActivityApprovalPanel

  MediaGallery
  MilestonePanel
```

### Components

| Component | Purpose |
|---|---|
| `ActivityWorkspace` | Main activity module. |
| `ActivityTabs` | Feed, Pending Approval, Media Gallery, Milestones, Parent View. |
| `ActivityFilterBar` | Class, section, status, date. |
| `ActivityFeedList` | List of activity posts. |
| `ActivityPostCard` | Single post card. |
| `ActivityMediaGrid` | Image/video thumbnails. |
| `CreateActivityPostDialog` | Create post. |
| `ActivityPostEditor` | Title, description, visibility, media. |
| `ActivityApprovalPanel` | Pending approval view. |
| `ActivityApprovalDrawer` | Approve/reject/request changes. |
| `ConsentWarningBanner` | Warns about blocked student media. |
| `ConsentBlockedStudentList` | Students without media consent. |
| `MediaGallery` | Uploaded media grid. |
| `MediaPreviewDrawer` | Preview selected media. |
| `MilestonePanel` | Student milestones. |
| `MilestoneCard` | Single milestone. |
| `CreateMilestoneDialog` | Add milestone. |
| `ParentActivityPreview` | Shows how post looks to parents. |
| `ActivityReportsPanel` | Post, approval, consent reports. |

---

## 9. M6 — Homework and Timetable Components

### Component Tree

```text
HomeworkTimetableWorkspace
  ModuleHeader
  KpiGrid

  HomeworkTimetableTabs

  HomeworkFilterBar
  HomeworkTable
  HomeworkDetailDrawer
  HomeworkFormDialog

  SubmissionReviewPanel

  TimetableBuilder
  ConflictPanel
  SubstitutionPanel
```

### Components

| Component | Purpose |
|---|---|
| `HomeworkTimetableWorkspace` | Main module container. |
| `HomeworkTimetableTabs` | Homework, Submissions, Timetable Builder, Substitution. |
| `HomeworkFilterBar` | Class, section, subject, due date, status. |
| `HomeworkTable` | Homework list. |
| `HomeworkStatusBadge` | Draft, active, closed, overdue. |
| `HomeworkDetailDrawer` | Homework detail and submissions. |
| `HomeworkFormDialog` | Create/edit homework. |
| `HomeworkAttachmentPanel` | Attach files using File Registry. |
| `SubmissionReviewPanel` | Review student submissions. |
| `SubmissionTable` | Submitted/pending/late list. |
| `SubmissionDetailDrawer` | View answer, remarks, files. |
| `ReturnForCorrectionDialog` | Send submission back. |
| `TimetableBuilder` | Main timetable grid. |
| `TimetableToolbar` | Class, week, draft/publish controls. |
| `TimetableGrid` | Weekly period grid. |
| `TimetableCell` | Subject/teacher/room per period. |
| `PeriodEditorDrawer` | Edit one timetable cell. |
| `ConflictPanel` | Teacher/room/class conflicts. |
| `ConflictAlertItem` | Single conflict warning. |
| `SubstitutionPanel` | Absent teacher substitution. |
| `SubstitutionFormDialog` | Assign substitute teacher. |
| `TeacherWorkloadPanel` | Teacher weekly load. |
| `TimetableReportsPanel` | Class, teacher, room timetable reports. |

---

## 10. M7 — HR and Payroll Components

### Component Tree

```text
HrPayrollWorkspace
  ModuleHeader
  KpiGrid

  HrTabs

  StaffFilterBar
  StaffTable
  StaffDetailDrawer
  StaffFormDialog

  LeaveApprovalPanel
  PayrollRunWizard
  PayslipPreviewDrawer
```

### Components

| Component | Purpose |
|---|---|
| `HrPayrollWorkspace` | Main HR module. |
| `HrTabs` | Staff, Contracts, Leave, Attendance, Payroll, Payslips. |
| `StaffFilterBar` | Search, role, department, status. |
| `StaffTable` | Staff list. |
| `StaffStatusBadge` | Active, on leave, resigned, terminated. |
| `StaffDetailDrawer` | Staff profile summary. |
| `StaffFormDialog` | Add/edit staff. |
| `StaffProfilePanel` | Personal/contact details. |
| `StaffDocumentsPanel` | Staff files and certificates. |
| `ContractPanel` | Contract details. |
| `ContractFormDialog` | Add/edit contract. |
| `ContractExpiryAlert` | Expiring contracts. |
| `LeaveRequestPanel` | Leave request list. |
| `LeaveApprovalDrawer` | Approve/reject leave. |
| `LeaveBalanceCard` | Staff leave balance. |
| `StaffAttendancePanel` | Staff attendance. |
| `PayrollRunWizard` | Step-by-step payroll process. |
| `PayrollMonthStep` | Select month. |
| `PayrollLoadStaffStep` | Load salary data. |
| `PayrollReviewStep` | Review salary, allowances, deductions. |
| `PayrollApprovalStep` | Approve/lock payroll. |
| `PayslipGenerationStep` | Generate payslips. |
| `PayslipPreviewDrawer` | Payslip preview. |
| `PayslipPdfButton` | Download payslip. |
| `HrReportsPanel` | Staff, leave, payroll reports. |

---

## 11. M8A — Library Components

### Component Tree

```text
LibraryWorkspace
  ModuleHeader
  KpiGrid

  LibraryTabs

  LibraryFilterBar
  BookTable
  BookDetailDrawer

  IssueBookDrawer
  ReturnBookDrawer
  OverduePanel
```

### Components

| Component | Purpose |
|---|---|
| `LibraryWorkspace` | Main library module. |
| `LibraryTabs` | Books, Copies, Issue, Return, Overdue, Reports. |
| `LibraryFilterBar` | Search book, ISBN, author, category. |
| `BookTable` | Book list. |
| `BookStatusBadge` | Available, issued, damaged, lost. |
| `BookFormDialog` | Add/edit book. |
| `BookDetailDrawer` | Book details and copy list. |
| `BookCopyTable` | Copies of selected book. |
| `BookCopyFormDialog` | Add/edit copy. |
| `IssueBookDrawer` | Issue book to student/staff. |
| `ReturnBookDrawer` | Return book. |
| `BorrowerSearchField` | Search student/staff. |
| `BookCopySearchField` | Search book/copy. |
| `OverduePanel` | Overdue book list. |
| `OverdueAlertCard` | Single overdue alert. |
| `LibraryFinePanel` | Fine calculation. |
| `LibraryReportsPanel` | Inventory, issued, overdue reports. |

---

## 12. M8B — Transport Components

### Component Tree

```text
TransportWorkspace
  ModuleHeader
  KpiGrid

  TransportTabs

  TransportFilterBar
  RouteVehicleSplitView
  RouteTable
  TransportMapPanel

  TripDetailDrawer
  StudentTransportAssignmentPanel
```

### Components

| Component | Purpose |
|---|---|
| `TransportWorkspace` | Main transport module. |
| `TransportTabs` | Routes, Stops, Vehicles, Students, Trips, Live Tracking. |
| `TransportFilterBar` | Route, vehicle, trip status. |
| `RouteTable` | Route list. |
| `RouteFormDialog` | Add/edit route. |
| `StopTable` | Stop list. |
| `StopFormDialog` | Add/edit stop. |
| `VehicleTable` | Vehicle list. |
| `VehicleFormDialog` | Add/edit vehicle. |
| `DriverAssignmentPanel` | Assign driver/helper. |
| `StudentTransportAssignmentPanel` | Assign student to route/stop. |
| `TripTable` | Morning/afternoon trips. |
| `StartTripDialog` | Start route trip. |
| `TripDetailDrawer` | Trip status, route, stops, driver. |
| `TransportMapPanel` | Map/live location view. |
| `VehicleMarker` | Vehicle location marker. |
| `RouteStopMarker` | Stop location marker. |
| `TripProgressTimeline` | Stop-by-stop progress. |
| `TransportAlertPanel` | Delay, missing driver, inactive vehicle. |
| `TransportReportsPanel` | Route, trip, vehicle reports. |

Transport note: full live tracking should remain behind policy, privacy, load, and SSE/WebSocket approval. Until then, prefer latest location, stale GPS, trip status, and trip history components.

---

## 13. M8C — Canteen Components

### Component Tree

```text
CanteenWorkspace
  ModuleHeader
  KpiGrid

  CanteenTabs

  CanteenFilterBar
  MenuItemGrid
  QrServePanel

  WalletPanel
  OrderTable
  StockPanel
```

### Components

| Component | Purpose |
|---|---|
| `CanteenWorkspace` | Main canteen module. |
| `CanteenTabs` | Menu, Orders, Wallets, QR Serving, Stock, Reports. |
| `CanteenFilterBar` | Search item/student, category, status. |
| `MenuItemGrid` | Menu card grid. |
| `MenuItemCard` | Single food item. |
| `MenuItemFormDialog` | Add/edit item. |
| `QrServePanel` | Scan student QR and serve food. |
| `StudentWalletSummary` | Shows wallet after QR scan. |
| `ServeItemSelector` | Select menu items. |
| `ServeConfirmationBox` | Final confirm and deduct. |
| `WalletPanel` | Student wallet management. |
| `WalletTopUpDialog` | Top up wallet. |
| `WalletTransactionTable` | Wallet history. |
| `OrderTable` | Sales/orders list. |
| `OrderRefundDialog` | Refund/cancel sale. |
| `StockPanel` | Stock and low-stock items. |
| `StockAdjustmentDialog` | Adjust stock. |
| `CanteenReportsPanel` | Sales, wallet, stock reports. |

---

## 14. M9 — Accounting and Finance Components

### Component Tree

```text
AccountingWorkspace
  ModuleHeader
  KpiGrid

  AccountingTabs

  AccountingFilterBar
  JournalTable
  JournalEntryDrawer

  ChartOfAccountsTree
  LedgerPanel
  TrialBalancePreview
  FinancialReportsPanel
```

### Components

| Component | Purpose |
|---|---|
| `AccountingWorkspace` | Main accounting module. |
| `AccountingTabs` | Dashboard, Chart of Accounts, Journal, Ledger, Trial Balance, Reports. |
| `AccountingFilterBar` | Date, account, source module, status. |
| `AccountingKpiGrid` | Cash balance, receivables, payables, pending journals. |
| `ChartOfAccountsTree` | Account hierarchy. |
| `AccountFormDialog` | Create/edit account. |
| `JournalTable` | Journal entries. |
| `JournalEntryDrawer` | View journal entry. |
| `JournalEntryFormDialog` | Add manual journal. |
| `JournalLineEditor` | Debit/credit line editor. |
| `JournalBalanceIndicator` | Balanced/not balanced status. |
| `PostJournalDialog` | Confirm posting. |
| `ReverseJournalDialog` | Reverse entry with reason. |
| `LedgerPanel` | Account ledger view. |
| `LedgerTable` | Ledger transactions. |
| `TrialBalancePreview` | Trial balance report. |
| `ProfitLossPreview` | P&L report. |
| `BalanceSheetPreview` | Balance sheet. |
| `PeriodClosePanel` | Monthly/yearly close. |
| `ClosePeriodDialog` | Confirm close period. |
| `AccountingReportsPanel` | Reports and exports. |

---

## 15. M10 — Notices and Communication Components

### Component Tree

```text
CommunicationWorkspace
  ModuleHeader
  KpiGrid

  CommunicationTabs

  CommunicationFilterBar
  NoticeList
  NoticeComposerPanel

  ChatInboxLayout
  TemplatePanel
  DeliveryLogsPanel
```

### Components

| Component | Purpose |
|---|---|
| `CommunicationWorkspace` | Main communication module. |
| `CommunicationTabs` | Notices, Compose, Chat, Templates, Recipients, Delivery Logs. |
| `CommunicationFilterBar` | Search, audience, status, date. |
| `NoticeList` | Sent/draft/scheduled notices. |
| `NoticeListItem` | Single notice row/card. |
| `NoticeComposerPanel` | Create/send notice. |
| `NoticeAudienceSelector` | Whole school, class, role, route, student. |
| `NoticeAttachmentPanel` | Attach files. |
| `NoticeSchedulePicker` | Schedule notice. |
| `NoticePreviewPanel` | Preview before sending. |
| `SendNoticeConfirmDialog` | Confirm send. |
| `TemplatePanel` | Notice templates. |
| `TemplateCard` | Holiday, fee reminder, exam notice. |
| `DeliveryLogsPanel` | Read/unread/failed logs. |
| `DeliveryStatusTable` | Recipient delivery status. |
| `ChatInboxLayout` | Parent-teacher chat UI. |
| `ChatThreadList` | Conversation list. |
| `ChatThreadItem` | Single chat thread. |
| `ChatConversationPanel` | Messages area. |
| `MessageBubble` | Single message. |
| `MessageComposer` | Type/send message. |
| `QuietHoursBanner` | Shows chat disabled outside school hours. |
| `ChatSafetyWarning` | Personal data sharing warning. |
| `ChatAuditPanel` | Admin/audit log if enabled. |

---

## 16. M12 — Learning Layer Components

M12 is teacher-controlled and school-only by default. Do not add broad student mobile, public leaderboards, open student AI chat, or harsh labels.

### Component Tree

```text
LearningWorkspace
  ModuleHeader
  KpiGrid

  LearningTabs

  LearningFilterBar
  ActivityTable
  ActivityBuilder
  SessionMonitorDrawer

  ResourceLibraryPanel
  ProgressPanel
```

### Components

| Component | Purpose |
|---|---|
| `LearningWorkspace` | Main learning module. |
| `LearningTabs` | Activities, Sessions, Resources, Progress. |
| `LearningFilterBar` | Class, section, subject, mode, status. |
| `LearningKpiGrid` | Activities, live sessions, participants, submitted attempts. |
| `ActivityTable` | Activity list. |
| `ActivityFormDialog` | Create/edit activity. |
| `ActivityBuilder` | Activity content and question builder. |
| `QuestionEditor` | Add/edit question. |
| `ResourceLibraryPanel` | Resource list. |
| `ResourcePickerDrawer` | Select resources for activity. |
| `LaunchSessionDialog` | Launch board/lab session. |
| `SessionMonitorDrawer` | Live session status, participants, pause/end. |
| `BoardSessionControls` | Teacher smart-board controls. |
| `LabSessionStatusPanel` | Student lab session status overview. |
| `AttemptReviewDrawer` | View submitted attempt. |
| `ProgressPanel` | Class/student progress. |
| `ParentLearningSummaryPanel` | Parent child-scoped learning summary. |

---

## 17. M0 — Platform Core Components

M0 is for **developer/platform admin only**, not normal school users.

### Component Tree

```text
PlatformWorkspace
  ModuleHeader
  KpiGrid

  PlatformTabs

  TenantTable
  TenantDetailDrawer

  ModuleAccessPanel
  RbacManagementPanel
  FileRegistryPanel
  AuditLogPanel
  SystemHealthPanel
  QueueHealthPanel
```

### Components

| Component | Purpose |
|---|---|
| `PlatformWorkspace` | Main platform admin module. |
| `PlatformTabs` | Tenants, Modules, RBAC, File Registry, Audit, Health, Queues. |
| `TenantTable` | School/tenant list. |
| `TenantFormDialog` | Create/edit tenant. |
| `TenantDetailDrawer` | Tenant overview. |
| `TenantStatusBadge` | Active, suspended, trial, inactive. |
| `TenantModuleAccessPanel` | Enable/disable modules by plan. |
| `SubscriptionPlanPanel` | Basic/Pro/Enterprise modules. |
| `RbacManagementPanel` | Roles and permissions. |
| `RoleTable` | Role list. |
| `PermissionMatrix` | Role-permission grid. |
| `FileRegistryPanel` | System-wide protected files. |
| `FileRegistryTable` | File list. |
| `AuditLogPanel` | Audit history. |
| `AuditLogFilterBar` | User, module, action, date. |
| `SystemHealthPanel` | API, DB, Redis, storage health. |
| `HealthStatusCard` | One system health metric. |
| `QueueHealthPanel` | Job queue status. |
| `QueueJobTable` | Failed/pending/completed jobs. |
| `SystemSettingsPanel` | Platform settings. |

---

## 18. Component Priority Plan

### Phase 1 — Build Shared Foundation

Implement these first:

```text
DashboardShell
TopBar
GlobalAside
ModuleHeader
KpiCard
KpiGrid
ModuleTabs
FilterBar
DataTable
StatusBadge
ActionMenu
DetailDrawer
CreateEditModal
ConfirmDialog
EmptyState
ErrorState
ModuleLockedState
ProtectedFileButton
ProtectedFileLink
ExportButton
PrintButton
AuditTimeline
```

These components will support every module.

### Phase 2 — Build Main Dashboard

```text
DashboardWelcomeHeader
DashboardKpiGrid
TodayOperationsPanel
PendingApprovalsPanel
AlertPanel
ModuleSummaryGrid
RecentActivityTimeline
QuickActionGrid
```

This gives the school a working command center.

### Phase 3 — Build High-Use Daily Modules

Priority:

```text
M1 Admissions
M2 Attendance
M3 Fees
M4 Academics
M10 Notices
```

These are the most used by schools.

### Phase 4 — Build Operational Modules

```text
M6 Homework & Timetable
M7 HR & Payroll
M8A Library
M8B Transport
M8C Canteen
```

### Phase 5 — Build Finance, Learning, and Platform Hardening

```text
M9 Accounting & Finance
M12 Learning Layer
M0 Platform Core
Advanced audit
Advanced reports
Health monitoring
Queue dashboard
```

---

## 19. Recommended Component Pattern

Every module should follow this same structure:

```text
ModuleWorkspace
  ModuleHeader
  KpiGrid
  ModuleTabs
  FilterBar
  MainContent
  DetailDrawer
  CreateEditModal
  ReportsPanel
```

Example:

```text
AdmissionsWorkspace
  ModuleHeader
  KpiGrid
  AdmissionsTabs
  StudentFilterBar
  StudentTable
  StudentDetailDrawer
  AdmissionFormWizard
  StudentReportsPanel
```

---

## 20. Best Naming Rule

Use this naming convention:

```text
[module-name]-workspace.tsx
[module-name]-tabs.tsx
[module-name]-filter-bar.tsx
[module-name]-table.tsx
[module-name]-detail-drawer.tsx
[module-name]-form-dialog.tsx
[module-name]-reports-panel.tsx
```

Example for admissions:

```text
components/admissions/admissions-workspace.tsx
components/admissions/admissions-tabs.tsx
components/admissions/student-filter-bar.tsx
components/admissions/student-table.tsx
components/admissions/student-detail-drawer.tsx
components/admissions/admission-form-wizard.tsx
components/admissions/student-documents-panel.tsx
components/admissions/student-reports-panel.tsx
```

---

## 21. Final Component Architecture Rule

For SchoolOS, use this rule:

```text
Shared components handle layout and behavior.
Module components handle school-specific workflows.
Workspace components connect API data, filters, tabs, and actions.
```

That means:

```text
KpiCard = reusable
DataTable = reusable
DetailDrawer = reusable

StudentTable = module-specific
AttendanceGrid = module-specific
PaymentDrawer = module-specific
MarksEntryGrid = module-specific
TimetableBuilder = module-specific
```

This keeps SchoolOS clean, scalable, and easier to implement module by module.
