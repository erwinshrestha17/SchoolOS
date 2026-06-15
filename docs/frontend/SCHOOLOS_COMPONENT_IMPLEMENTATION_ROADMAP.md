# SchoolOS Component Implementation Roadmap

**Status:** Source of Truth  
**Last updated:** 2026-06-15  
**Phase:** Planning only — no component implementation until planning is accepted  
**Purpose:** Define the SchoolOS component system build order so web and mobile screens can be implemented consistently after the planning phase.

Related docs:

```text
docs/design/SCHOOLOS_UI_UX_GUIDE.md
docs/design/SCHOOLOS_DESIGN_TOKENS_REFERENCE.md
docs/design/references/SCHOOLOS_ROLE_SCREEN_DESIGN_REFERENCE.md
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

| Layer | Purpose | Example components | Priority |
|---|---|---|---|
| Tokens | Visual foundation | colors, typography, spacing, radius, shadows | P0 |
| Primitives | Basic UI blocks | Button, Input, Select, Dialog, Tabs, Badge | P0 |
| Layout | Product shell/scaffolding | AppShell, PlatformShell, MobileShell, PageHeader | P0 |
| State | Consistent UI states | LoadingState, EmptyState, ErrorState, PermissionState, ModuleLockedState | P0 |
| Data | Dense school workflows | DataTable, FilterBar, Pagination, SearchInput | P0 |
| Feedback/action | Safe interactions | ConfirmDialog, AuditReasonDialog, Toast, InlineAlert | P0 |
| Domain shared | Cross-module business UI | MoneyDisplay, DateDisplay, StatusBadge, FilePreviewAction | P0/P1 |
| Module domain | Module workflow UI | AttendanceRegister, FeeCollectionPanel, MarksGrid | P1+ |
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

## 6. Module Domain Component Families

| Module | Component family examples |
|---|---|
| M1 Students/Admissions | StudentProfileHeader, GuardianCard, StudentDocumentList, StudentPhotoUploader, StudentQrLifecyclePanel, DuplicateCandidateComparison, AdmissionPipelineBoard, IemisReadinessTable. |
| M2 Attendance | AttendanceRegister, AttendanceStatusToggle, AttendanceSummaryStrip, AttendanceMonthlyGrid, AttendanceCorrectionQueue, MobileAttendanceRoster. |
| M3 Fees | FinanceKpiStrip, StudentFeeLedger, PaymentCollectionPanel, ReceiptViewer, CashierClosePreview, RefundReversalQueue, DefaulterTable. |
| M4 Academics | MarksEntryGrid, CasEntryGrid, ReportCardReadinessPanel, ReportCardBatchTable, ResultPublishConfirm, PromotionReviewTable. |
| M5 Activity | ActivityComposer, AudiencePreviewPanel, ActivityPostCard, MediaConsentBadge, ActivityMediaGallery, ModerationQueue. |
| M6 Homework/Timetable | HomeworkWorkspaceTable, SubmissionReviewTable, TimetableBuilderGrid, TimetableConflictPanel, SubstitutionAssignmentPanel, MobileTimetableCard. |
| M7 HR/Payroll | StaffProfileHeader, LeaveApprovalQueue, StaffSelfServiceCard, PayrollRunStepper, PayrollPreviewTable, PayslipDownloadCard. |
| M8A Library | LibraryDeskPanel, BookCatalogTable, CopyStatusBadge, IssueReturnPanel, ReservationQueue, OverdueTable. |
| M8B Transport | TransportStatusDashboard, RouteStopManager, VehicleDocumentAlert, ActiveTripBoard, MobileDriverTripPanel, ParentTransportStatusCard. |
| M8C Canteen | CanteenPosPanel, CanteenScanResultCard, MenuItemTable, WalletBalanceCard, InventoryStockTable, ParentCanteenStatusCard. |
| M9 Accounting | AccountingControlDashboard, ChartOfAccountsTree, JournalTable, JournalDebitCreditTable, FiscalPeriodStatusPanel, FinancialReportFilterPanel. |
| M10 Notices/Chat | NoticeComposer, NoticeAudiencePreview, NoticeDeliveryStatusTable, MessagingInboxLayout, MessageThread, SchoolHoursBanner. |
| M12 Learning | LearningActivityCard, LearningSessionPanel, AttemptReviewTable, ClassProgressPanel, LearningResourceList. |

---

## 7. Implementation Build Order

### Phase 0 — Planning completion

```text
Finalize planning index
Finalize UI/UX guide
Finalize design tokens
Finalize permission catalog
Finalize screen contract matrix P0 rows
Finalize frontend/backend sync plan
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
Platform dashboard
Parent/mobile dashboard contract planning
```

### Phase 3 — Core web modules

```text
M1 Students and Admissions
M2 Attendance
M3 Fees
M4 Academics / Report Cards
M10 Notices basics
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

## 8. Preview / Storybook Plan

Before module implementation, create a preview environment for web components.

Priority previews:

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
```

Rules:

```text
Preview/stories may use mock display data.
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
