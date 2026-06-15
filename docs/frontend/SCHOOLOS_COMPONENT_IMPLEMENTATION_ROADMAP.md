# SchoolOS Component Implementation Roadmap

**Status:** Planning baseline  
**Last updated:** 2026-06-15  
**Phase:** Planning only — no component implementation until planning is accepted  
**Purpose:** Define the SchoolOS component system build order so web and mobile screens can be implemented consistently after the planning phase.

Related docs:

```text
docs/design/SCHOOLOS_UI_UX_GUIDE.md
docs/design/SCHOOLOS_DETAILED_UI_UX_ROLE_COMPONENT_BLUEPRINT.md
docs/design/SCHOOLOS_WEB_MOBILE_MODULE_SCREEN_ROLE_PLAN.md
docs/design/SCHOOLOS_UI_UX_CONSOLIDATION_NOTES.md
docs/frontend/SCHOOLOS_SCREEN_CONTRACT_MATRIX.md
```

---

## 1. Component Strategy Decision

SchoolOS uses a **SchoolOS-owned component system**.

Final rule:

```text
Build SchoolOS components.
Use dependencies only behind SchoolOS wrappers.
Never build module pages from random provider components or copied template blocks.
```

Accepted dependency direction:

```text
Radix/shadcn-style primitives for accessible behavior
TanStack Query for server state
TanStack Table behind SchoolOS DataTable when needed
React Hook Form + Zod behind SchoolOS form patterns
Lucide icons as one icon language
Tailwind utilities with SchoolOS tokens
Flutter Material 3 with SchoolOS theme wrappers
```

---

## 2. Component Layers

| Layer | Purpose | Example components | Implementation priority |
|---|---|---|---|
| Tokens | Visual foundation | colors, typography, spacing, radius, shadows | P0 |
| Primitives | Basic UI building blocks | Button, Input, Select, Dialog, Tabs, Badge | P0 |
| Layout | Product shell and page scaffolding | AppShell, PlatformShell, MobileShell, PageHeader | P0 |
| State | Consistent API/UI state handling | LoadingState, EmptyState, ErrorState, PermissionState, ModuleLockedState | P0 |
| Data | Dense school office workflows | DataTable, FilterBar, Pagination, SearchInput | P0 |
| Feedback/action | Safe interactions | ConfirmDialog, AuditReasonDialog, Toast, InlineAlert | P0 |
| Domain shared | Cross-module business UI | MoneyDisplay, DateDisplay, StatusBadge, FilePreviewAction | P0/P1 |
| Module domain | Module-specific workflow UI | AttendanceRegister, FeeCollectionPanel, MarksGrid | P1+ |
| Mobile widgets | Flutter role-focused patterns | MobileStatusCard, TodayCard, BottomNav, OfflineBanner | P1 |

---

## 3. P0 Web Foundation Components

These must exist before major module screens are built.

```text
DesignTokens
Button
IconButton
Input
Textarea
Select
Checkbox
RadioGroup
Switch
Badge
StatusBadge
Avatar
Card / SectionCard
StatCard
PageHeader
Breadcrumbs
AppShell
PlatformShell
Sidebar
Topbar
PermissionGate
EntitlementGate
RoleAwareNav
LoadingState
EmptyState
ErrorState
PermissionState
ModuleLockedState
ReadOnlyState
DataTable
FilterBar
PaginationControls
SearchInput
ActionMenu
ConfirmDialog
AuditReasonDialog
Toast / Notification feedback
MoneyDisplay
DateDisplay
FileDownloadAction
AuthenticatedImagePreview
```

Acceptance criteria:

```text
A P0 module screen can be built using shared components without custom one-off table/filter/dialog/state styling.
```

---

## 4. P0 Mobile Foundation Widgets

These are planned before Flutter implementation begins.

```text
SchoolOsTheme
MobileShell
MobileHeader
RoleAwareBottomNav
TodaySummaryCard
MobileStatusCard
MobileActionCard
MobileListCard
MobileDetailSection
MobileEmptyState
MobileErrorState
MobileLoadingSkeleton
MobilePermissionState
MobileModuleLockedState
OfflineBanner
PendingSyncBanner
MobileConfirmSheet
MobileReasonSheet
MobileFileDownloadTile
```

Acceptance criteria:

```text
Parent, teacher, student, and driver mobile screens can share the same shell, state, and card patterns while showing different scoped content.
```

---

## 5. Shared Display Components

These should be used across all modules to avoid inconsistent rendering.

| Component | Purpose | Notes |
|---|---|---|
| `MoneyDisplay` | NPR and monetary values | Right-aligned in tables, tabular numbers. |
| `DateDisplay` | Date/time formatting | Future-ready for Bikram Sambat support. |
| `StatusBadge` | Semantic statuses | Must include text, not color only. |
| `ModuleBadge` | Module identity/accent | Subtle only; semantic status wins. |
| `RoleBadge` | Current role/context | Useful for multi-role users. |
| `TenantStatusBadge` | Platform tenant status | Platform only. |
| `ProviderModeBadge` | SMS/payment/storage mode | Platform/settings use. |
| `AuditTimeline` | Sensitive action history | Used in finance, payroll, accounting, support. |
| `FilePreviewAction` | Private file access | Uses authenticated helper. |
| `ExportJobStatus` | Report/export status | Pending/success/failed/retry/download. |

---

## 6. Module Domain Components

### M1 Students / Admissions

```text
StudentProfileHeader
StudentIdentityCard
GuardianCard
StudentDocumentList
StudentPhotoUploader
StudentQrLifecyclePanel
StudentLifecycleTimeline
DuplicateCandidateComparison
AdmissionPipelineBoard
EnrollmentConfirmationPanel
IemisReadinessTable
```

### M2 Attendance

```text
AttendanceRegister
AttendanceStatusToggle
AttendanceSummaryStrip
AttendanceMonthlyGrid
AttendanceCorrectionQueue
AttendanceConflictCard
WorkingDayCalendar
MobileAttendanceRoster
```

### M3 Fees

```text
FinanceKpiStrip
StudentFeeLedger
PaymentCollectionPanel
ReceiptViewer
CashierClosePreview
RefundReversalQueue
DefaulterTable
FeeReminderPreview
```

### M4 Academics

```text
ExamTermStatusPanel
AssessmentComponentTable
MarksEntryGrid
CasEntryGrid
ReportCardReadinessPanel
ReportCardBatchTable
ResultPublishConfirm
PromotionReviewTable
SyllabusProgressPanel
```

### M5 Activity Feed

```text
ActivityComposer
AudiencePreviewPanel
ActivityPostCard
MediaConsentBadge
ActivityMediaGallery
ModerationQueue
MilestoneTemplateCard
MoodLogPanel
```

### M6 Homework / Timetable

```text
HomeworkWorkspaceTable
HomeworkDetailPanel
SubmissionReviewTable
HomeworkReminderPreview
TimetableBuilderGrid
TimetableConflictPanel
TeacherAvailabilityGrid
SubstitutionAssignmentPanel
MobileTimetableCard
```

### M7 HR / Payroll

```text
StaffProfileHeader
LeaveApprovalQueue
StaffSelfServiceCard
PayrollRunStepper
PayrollPreviewTable
PayslipDownloadCard
SalaryStructurePanel
PayrollPostingPanel
```

### M8A Library

```text
LibraryDeskPanel
BookCatalogTable
CopyStatusBadge
IssueReturnPanel
ReservationQueue
OverdueTable
LibraryFinePanel
```

### M8B Transport

```text
TransportStatusDashboard
RouteStopManager
VehicleDocumentAlert
DriverAssignmentTable
StudentTransportAssignmentTable
ActiveTripBoard
TripManifestTable
DelayBroadcastPreview
MobileDriverTripPanel
ParentTransportStatusCard
```

### M8C Canteen

```text
CanteenPosPanel
CanteenScanResultCard
MenuItemTable
MealPlanPanel
WalletBalanceCard
WalletTransactionTimeline
InventoryStockTable
ParentCanteenStatusCard
```

### M9 Accounting

```text
AccountingControlDashboard
ChartOfAccountsTree
JournalTable
JournalDebitCreditTable
FiscalPeriodStatusPanel
VoucherForm
BankReconciliationWorkspace
FinancialReportFilterPanel
SourceLedgerTable
```

### M10 Notices / Communication

```text
NoticeComposer
NoticeAudiencePreview
NoticeDeliveryStatusTable
MessagingInboxLayout
MessageThread
SchoolHoursBanner
EscalationReviewQueue
MobileNoticeCard
MobileChatThread
```

### M12 Learning

```text
LearningActivityCard
LearningSessionPanel
AttemptReviewTable
ClassProgressPanel
LearningResourceList
StudentLearningCard
```

---

## 7. Implementation Build Order

### Phase 0 — Planning completion

```text
Finalize consolidation notes
Finalize permission catalog
Finalize screen contract matrix
Finalize component roadmap
Finalize persona smoke tests
```

### Phase 1 — Web foundation

```text
Design tokens
Typography and layout tokens
AppShell and PlatformShell
Topbar/sidebar/navigation
Permission/entitlement gates
State components
DataTable/FilterBar/Search/Pagination
ConfirmDialog/AuditReasonDialog
Money/Date/Status/File components
```

### Phase 2 — Role landing dashboards

```text
Owner dashboard
Principal dashboard
Teacher dashboard
Finance dashboard
Parent mobile dashboard contract planning
Platform dashboard
```

### Phase 3 — Core web modules

```text
M1 Students and Admissions
M2 Attendance
M3 Fees
M4 Academics / Report Cards
M10 Notices basic
```

### Phase 4 — Extended web modules

```text
M6 Homework / Timetable
M7 HR / Payroll
M8A Library
M8B Transport
M8C Canteen
M9 Accounting
M12 Learning
Reports / Advanced Operations
```

### Phase 5 — Mobile foundation

```text
Flutter SchoolOsTheme
MobileShell
RoleAwareBottomNav
Mobile state widgets
Offline/pending sync widgets
Mobile file/download widgets
Mobile cards and list patterns
```

### Phase 6 — Mobile role flows

```text
Parent My Child Overview
Teacher Today / Attendance / Homework
Student Timetable / Homework / Results
Driver Assigned Trip
Parent Fees / Notices / Chat
```

---

## 8. Storybook / Preview Plan

Before module implementation, create a preview environment for web components.

Priority preview stories:

```text
Button states
Form controls
StatusBadge variants
MoneyDisplay and DateDisplay
PageHeader variants
DataTable with pagination/loading/empty/error
FilterBar with active filters
PermissionState
ModuleLockedState
AuditReasonDialog
PaymentCollectionPanel mock state
AttendanceRegister mock state
MarksEntryGrid mock state
Mobile card visual references if web preview is useful
```

Rules:

```text
Storybook/preview uses mock display data only.
Production module screens use real APIs only.
No fake data in production routes.
```

---

## 9. Component Acceptance Checklist

Every shared component must pass:

```text
Keyboard accessible where interactive
Screen-reader friendly labels where needed
Works in loading/disabled/error states
Supports SchoolOS tokens
Does not hardcode tenant/module data
Does not hide security rules inside UI only
Has predictable API props
Can be reused across modules
Does not import module-specific API clients
Has responsive behavior defined
Has tests or stories where appropriate
```

---

## 10. Design Drift Prevention

To avoid inconsistent UI:

```text
Do not create new button/card/table/dialog variants inside module folders unless approved.
Do not use raw colors when token exists.
Do not copy dashboard template code into modules.
Do not add extra icon libraries.
Do not use provider components directly in pages.
Do not create custom state messages per module when shared states can work.
```

---

## 11. Planning Open Questions

```text
Will Storybook be added before or during Phase 1?
Should design tokens live in apps/web only or a shared package?
How much dark mode support is required for v1?
Should Flutter theme be generated from the same JSON token source?
Should mobile implementation wait until all P0 web flows are stable?
Which module domain components deserve isolated previews first?
```
