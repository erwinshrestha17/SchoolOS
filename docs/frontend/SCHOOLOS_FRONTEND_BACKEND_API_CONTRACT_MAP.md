# SchoolOS Frontend and Backend API Contract Map

**Updated:** 2026-06-15
**Scope:** Planning and inventory only. Do not implement module UI from this document in the same task.
**Backend rule:** Backend is frozen except blockers. Do not change backend business logic, add backend features, rename `tenantId`, or introduce fake data.

---

## 1. Inventory Sources and Contract

This map is built from the NestJS controllers under `apps/api/src/**/*.controller.ts`, the API E2E/contract test surface, and the known Swagger mount.

Runtime API rules:

- Global API prefix: `/api/v1`.
- Swagger/OpenAPI UI: `/api/v1/docs`.
- Frontend must use cookie-first auth. Never store raw access/refresh tokens in browser storage.
- Every module API call must use the existing shared web API helper and credentials-enabled requests.
- Parent, staff self-service, driver, lab/session student, and mobile APIs are purpose-limited. Do not use admin endpoints for these actors when scoped endpoints exist.
- Students do not get a broad MVP mobile app. Student-facing MVP routes are controlled computer-lab or school-device learning sessions only.
- Every workflow must render loading, empty, error, success, permission-denied, and module-locked states.
- Use school-friendly language. One main job per screen.

OpenAPI parity note:

- The route inventory below is source-extracted from controllers and should be cross-checked by running `pnpm verify:openapi` or opening `/api/v1/docs` locally before implementation sprint kickoff.
- Do not add frontend routes that are not backed by real API routes listed here.

---

## 2. Shared Frontend Consumption Rules

### 2.1 Standard UI States

| State | Required UI behavior |
|---|---|
| Loading | Show skeleton/card placeholder with page title and selected filters preserved. |
| Empty | Explain what school staff should do next, for example “No students found. Add an admission or adjust filters.” |
| Error | Show backend message when safe; include retry and keep unsaved form values. |
| Success | Use small confirmation toast plus optimistic refetch/invalidate. Do not hide audit/action history. |
| Permission denied | Show “You do not have permission to view/manage this area. Contact the school admin.” Do not expose hidden actions. |
| Module locked | Show plan/module locked card using entitlement response where available; no fake fallback data. |

### 2.2 Mutation Rules

- Create/update/delete/archive/post/reverse/approve actions must use explicit submit buttons, disabled pending states, and safe confirmation where irreversible.
- CSV/PDF/blob endpoints must use the shared authenticated blob/download helper; avoid raw `window.open` with auth-sensitive URLs.
- Long-running exports and report jobs must show queued/running/success/failed state and link to File Registry/download only after backend provides it.
- SSE streams should be progressive enhancement only; list queries remain the source of truth after reconnect/refetch.

---

## 3. Recommended API Client Files

Create or align clients under `apps/web/lib/api` without duplicating the shared HTTP helper. The current repo already has `client.ts`, `auth.ts`, `platform.ts`, `students.ts`, `attendance.ts`, `finance.ts`, `academics.ts`, `activity.ts`, `communications.ts`, `messaging.ts`, `learning.ts`, `library.ts`, `transport.ts`, `canteen.ts`, `accounting.ts`, `payroll.ts`, `users.ts`, `marketing.ts`, and `index.ts`.

```text
apps/web/lib/api/client.ts                  # shared cookie-first fetch, error normalization, query, blob/download helpers
apps/web/lib/api/auth.ts                    # auth, me, MFA, password/OTP recovery
apps/web/lib/api/users.ts                   # users, roles, permissions
apps/web/lib/api/platform.ts                # M0 platform, tenants, plans, provider readiness, queues, SaaS billing
apps/web/lib/api/students.ts                # M1 student profile, documents, QR, lifecycle, iEMIS
apps/web/lib/api/attendance.ts              # M2 attendance, drafts, corrections, calendar, staff attendance links
apps/web/lib/api/finance.ts                 # M3 fees, invoices, payments, receipts, cashier close
apps/web/lib/api/academics.ts               # M4 exams, marks, CAS, report cards, results, promotions
apps/web/lib/api/activity.ts                # M5 feed, gallery, media, mood logs, milestones
apps/web/lib/api/payroll.ts                 # M7 payroll preview/runs/payslips/salary/reports
apps/web/lib/api/library.ts                 # M8A library books/copies/issues/reservations/fines/reports
apps/web/lib/api/transport.ts               # M8B routes/stops/vehicles/trips/driver/parent/reports
apps/web/lib/api/canteen.ts                 # M8C menu/plans/enrollments/serving/wallet/POS/inventory/reports
apps/web/lib/api/accounting.ts              # M9 chart, periods, journals, reports, vouchers, reconciliation
apps/web/lib/api/communications.ts          # M10 notices, messaging, parent-teacher chat, notifications
apps/web/lib/api/messaging.ts               # M10 parent-teacher chat and thread/message helpers
apps/web/lib/api/learning.ts                # M12 activities, sessions, attempts, progress, resources
apps/web/lib/api/marketing.ts               # public demo/request flows
apps/web/lib/api/index.ts                   # re-export only; no second client implementation
```

Planned split rule: new domain files can be added only when they reduce real duplication. Admissions, homework, timetable, settings, files, reports, and advanced operations may be split out later, but until then they must continue to use `client.ts` as the only base HTTP/blob/error layer.

---

## 4. Backend API Inventory and Frontend Consumption Map

### 4.1 M0 Platform

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `GET /api/v1/platform/dashboard`, `GET /api/v1/platform/health`, `GET /api/v1/platform/usage` | Platform operator reviews SaaS health, school count, usage, provider and queue readiness. Actor: platform super admin. | `/platform` → `PlatformDashboardWorkspace` | Queries only. Loading cards; empty “No schools onboarded”; error retry; locked/permission state via platform guard. | P0 |
| `GET /api/v1/platform/tenants`, `GET /api/v1/platform/tenants/page`, `GET /api/v1/platform/tenants/:tenantId`, `PATCH /api/v1/platform/tenants/:tenantId/status`, `POST /api/v1/platform/schools/:tenantId/suspend-for-billing`, `POST /api/v1/platform/schools/:tenantId/reactivate-after-payment` | Manage school tenants and operational status. Actor: platform operator. | `/platform/schools`, `/platform/schools/[tenantId]` → `SchoolTenantListWorkspace`, `SchoolTenantDetailWorkspace` | Status mutations require reason modal, optimistic disabled state, refetch tenant detail/audit. Permission denied hides status actions. | P0 |
| `GET/POST/PATCH /api/v1/platform/plans`, `GET /api/v1/platform/feature-keys`, `GET /api/v1/platform/usage-keys`, `POST /api/v1/platform/tenants/:tenantId/subscriptions`, `PATCH /api/v1/platform/tenants/:tenantId/subscriptions/:subId`, `POST /api/v1/platform/tenants/:tenantId/feature-overrides`, `GET /api/v1/platform/tenants/:tenantId/entitlements/:featureKey` | SaaS plans, subscriptions, feature overrides, module locks. Actor: platform billing/admin. | `/platform/billing/plans`, `/platform/schools/[tenantId]/subscription` → `PlanManager`, `SchoolSubscriptionPanel` | Create/update plan forms; feature override confirmation. Module-locked state must use entitlement data, not local assumptions. | P0 |
| `GET/PATCH /api/v1/platform/tenants/:tenantId/billing-profile`, `GET/POST /api/v1/platform/tenants/:tenantId/saas-invoices`, `POST /api/v1/platform/tenants/:tenantId/saas-invoices/:invoiceId/payments`, `POST /api/v1/platform/tenants/:tenantId/saas-invoices/:invoiceId/cancel`, `GET /api/v1/platform/schools/:tenantId/billing`, `GET /api/v1/platform/tenants/:tenantId/billing`, `POST /api/v1/platform/schools/:tenantId/billing/invoices`, `POST /api/v1/platform/billing/invoices/:invoiceId/issue`, `POST /api/v1/platform/billing/invoices/:invoiceId/payments`, `POST /api/v1/platform/billing/invoices/:invoiceId/mark-overdue`, `POST /api/v1/platform/billing/invoices/:invoiceId/cancel` | SaaS billing separate from school fee ledger. Actor: platform billing operator. | `/platform/billing`, `/platform/schools/[tenantId]/billing` → `SaasBillingWorkspace` | Invoice lifecycle with issue/payment/cancel confirmations. Show overdue and paid states. No school fee APIs here. | P1 |
| `GET/POST /api/v1/platform/tenants/:tenantId/api-keys`, `POST /api/v1/platform/tenants/:tenantId/api-keys/:apiKeyId/revoke` | Tenant API key lifecycle for integrations. Actor: platform operator. | `/platform/schools/[tenantId]/api-keys` → `TenantApiKeysPanel` | Reveal newly-created secret once only if backend returns it. Revoke requires reason and success audit. | P1 |
| `GET/POST /api/v1/platform/providers`, `GET /api/v1/platform/providers/readiness`, `GET /api/v1/platform/providers/:id/readiness`, `POST /api/v1/platform/providers/:id/test`, `PATCH /api/v1/platform/providers/:id/status`, `GET/POST/PATCH /api/v1/platform/webhook-endpoints`, `GET /api/v1/platform/webhook-deliveries`, `POST /api/v1/platform/webhook-endpoints/:id/deliveries` | Provider readiness and callback monitoring for SMS/email/FCM/payment/storage. Actor: platform operator. | `/platform/providers` → `ProviderReadinessWorkspace` | Readiness cards with test action pending state. Disabled providers should be visually clear and not retried silently. | P0 |
| `GET /api/v1/platform/queues`, `GET /api/v1/platform/queues/failed-jobs`, `GET /api/v1/platform/queues/failed-job-groups`, `GET /api/v1/platform/queues/:queueName/jobs/:jobId`, `POST /api/v1/platform/queues/retry`, `DELETE /api/v1/platform/queues/:queueName/jobs/:jobId` | Queue operations, failed-job detail, retry/discard with audit. Actor: platform operator. | `/platform/queues` → `QueueOpsWorkspace` | Retry/discard race errors shown inline. Discard requires reason. Grouped diagnostics default to read-only. | P0 |
| `GET /api/v1/platform/report-exports`, `GET /api/v1/platform/audit-logs`, `GET /api/v1/platform/audit-logs/security`, `GET /api/v1/platform/schools/:tenantId/audit`, `GET /api/v1/platform/audit/export` | Platform report export visibility and audit/security review. Actor: platform auditor/operator. | `/platform/audit`, `/platform/report-exports` → `PlatformAuditWorkspace`, `PlatformReportExportWorkspace` | Filtered paginated tables; CSV export uses authenticated blob helper. Empty state says no matching audit entries. | P1 |
| `GET /api/v1/platform/tenants/:tenantId/onboarding`, `POST /api/v1/platform/tenants/:tenantId/onboarding/override`, `POST /api/v1/platform/support/override/enter`, `POST /api/v1/platform/support/override/exit` | Onboarding checklist and temporary support override. Actor: platform support operator. | `/platform/schools/[tenantId]/onboarding`, support banner in dashboard shell | Override requires reason/duration; active support override banner must be visible across tenant workspaces. | P0 |

### 4.2 Auth / Users / Roles

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` | Cookie-first session lifecycle. Actor: all authenticated users. | `/login`, dashboard shell → `LoginForm`, `AuthGate` | Use credentials cookies only. Loading during session restore. Auth errors clear only UI state, not browser token storage. | P0 |
| `POST /api/v1/auth/otp/request-login`, `POST /api/v1/auth/otp/verify`, `POST /api/v1/auth/password-recovery/request`, `POST /api/v1/auth/password-recovery/confirm`, `POST /api/v1/auth/mfa/setup/request`, `POST /api/v1/auth/mfa/setup/confirm` | OTP, recovery, MFA setup. Actor: staff/admin/guardian according to auth policy. | `/login`, `/forgot-password`, `/settings/security` → `OtpLoginPanel`, `PasswordRecoveryPanel`, `MfaSetupPanel` | Rate-limit errors shown as friendly cooldown text. MFA success refetches `/auth/me`. | P1 |
| `GET/POST /api/v1/users`, `PATCH /api/v1/users/:id/status`, `POST /api/v1/users/:id/reset-password`, `POST /api/v1/users/:id/force-logout`, `POST /api/v1/users/tenants/:id/deactivate` | User account lifecycle. Actor: school admin / platform admin. | `/dashboard/settings/users` → `UsersWorkspace` | Reset/force logout/status changes require confirmation. Permission denied hides action menu. | P0 |
| `GET/POST /api/v1/roles`, `GET /api/v1/roles/permissions`, `POST /api/v1/roles/assign`, `POST /api/v1/roles/:id/permissions` | Role and permission inspection/assignment. Actor: school admin. | `/dashboard/settings/roles` → `RolesPermissionsWorkspace` | Load permission catalog first; empty roles state suggests creating role. Save diff only. | P0 |

### 4.3 M1 Students / Admissions

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `GET/POST /api/v1/students`, `GET/PATCH /api/v1/students/:id`, `POST /api/v1/students/:id/delete`, `POST /api/v1/students/:id/archive`, `POST /api/v1/students/:id/archive-alumni`, `POST /api/v1/students/:id/transfer` | Student directory, profile editing, lifecycle, transfer/alumni/archive. Actors: principal/admin/admission officer. | `/dashboard/students`, `/dashboard/students/[id]` → `StudentDirectoryWorkspace`, `StudentProfileWorkspace` | Directory filters persist. Destructive lifecycle actions require reason and show fee-clearance/profile blockers. Module locked: students unavailable. | P0 |
| `GET /api/v1/students/:id/fee-clearance`, `GET /api/v1/students/:id/attendance-history`, `GET /api/v1/students/:id/lifecycle-timeline`, `GET /api/v1/students/:id/identity`, `POST /api/v1/students/:id/identity`, `POST /api/v1/students/:id/identity/revoke` | Profile tabs for lifecycle, attendance, fee clearance, identity code. Actor: admin/class teacher with permissions. | `/dashboard/students/[id]` tabs → `StudentLifecyclePanel`, `StudentIdentityPanel` | Read-only panels unless action permission exists. Revoke requires reason. | P1 |
| `GET /api/v1/students/duplicates/candidates`, `POST /api/v1/students/duplicates/merge/preview`, `POST /api/v1/students/duplicates/merge`, `POST /api/v1/admissions/duplicates` | Duplicate detection, preview, merge. Actor: admission officer/admin. | `/dashboard/admissions/duplicates` → `DuplicateReviewWorkspace` | Preview before merge; success refetches candidates and affected profiles. Empty: “No duplicate students to review.” | P0 |
| `GET /api/v1/students/iemis/validation`, `GET /api/v1/students/:id/iemis-readiness`, `GET /api/v1/students/iemis/export`, `GET /api/v1/students/roster/export`, `GET /api/v1/admissions/iemis-export` | iEMIS readiness and exports. Actor: admin/account/school office. | `/dashboard/students/iemis` → `IemisReadinessWorkspace` | CSV/export via blob helper. Show class/section readiness issues with profile links. | P0 |
| `GET/POST /api/v1/students/document-expiry/templates`, `GET /api/v1/students/:id/documents/:kind.pdf`, `POST /api/v1/students/:id/generated-documents/:documentId/revoke` | Document templates/expiry and generated student documents. Actor: office/admin. | `/dashboard/students/documents`, profile documents tab → `StudentDocumentsWorkspace` | PDF opens through authenticated helper. Revocation requires reason. | P1 |
| `PATCH /api/v1/students/:id/guardians/:guardianId`, `POST /api/v1/students/:id/guardian-invitations`, `GET/POST /api/v1/students/guardians/:guardianId/identity-verifications`, `POST /api/v1/students/guardians/:guardianId/identity-verifications/:verificationId/review`, `POST /api/v1/admissions/guardians/:id/invite` | Guardian links, invitations, identity verification. Actor: admin/admission officer. | Student profile guardian tab → `GuardianManagementPanel` | Invite/review actions show pending state and audit result. Do not expose guardian docs to wrong actor. | P1 |
| `POST /api/v1/students/:id/photo`, `GET /api/v1/students/:id/photo/preview`, `GET /api/v1/students/:id/photo/download`, `DELETE /api/v1/students/:id/photo` | Private student photo management. Actor: admin/class teacher with update permission. | Student profile photo panel → `StudentPhotoCard` | Use protected preview/download helpers. Delete requires confirmation. | P1 |
| `GET /api/v1/students/:studentId/qr`, `GET /api/v1/students/:studentId/qr/scans`, `GET /api/v1/students/:studentId/qr/analytics`, `POST /api/v1/students/:studentId/qr`, `POST /api/v1/students/:studentId/qr/rotate`, `POST /api/v1/students/:studentId/qr/revoke`, `POST /api/v1/students/qr/resolve`, `GET /api/v1/students/:studentId/qr-image` | Student QR lifecycle and safe scan audit. Actor: admin/library/canteen/authorized scanner. | `/dashboard/students/[id]/qr`, scanner surfaces → `StudentQrPanel`, `QrResolvePanel` | Raw token is one-time only. Existing QR image unavailable state must explain why. Rotate/revoke require reason. | P0 |
| `GET/POST /api/v1/admissions`, `GET/POST /api/v1/admissions/applications`, `POST /api/v1/admissions/applications/:id/status`, `POST /api/v1/admissions/applications/:id/enroll`, `POST /api/v1/admissions/bulk-import`, `GET /api/v1/admissions/bulk-import/batches`, `GET /api/v1/admissions/bulk-import/batches/:id`, `POST /api/v1/admissions/students/:id/transfer`, `DELETE /api/v1/admissions/students/:id`, `POST /api/v1/admissions/students/:id/archive-alumni` | Admission pipeline, bulk import review, accepted application enrollment. Actor: admission officer/admin. | `/dashboard/admissions`, `/dashboard/admissions/imports` → `AdmissionsPipelineWorkspace`, `AdmissionImportWorkspace` | Status change rules shown as disabled actions. Bulk import uses real CSV content; dry-run/confirmed states visible. | P0 |

### 4.4 M2 Attendance

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `GET /api/v1/attendance`, `GET /api/v1/attendance/rosters`, `POST /api/v1/attendance/sessions`, `POST /api/v1/attendance/sync`, `GET/POST /api/v1/attendance/drafts`, `POST /api/v1/attendance/drafts/:id/submit`, `POST /api/v1/attendance/drafts/cleanup` | Class attendance marking, offline drafts, sync. Actor: teacher/class teacher. | `/dashboard/attendance/mark` → `AttendanceMarkingWorkspace` | Roster loading skeleton; empty roster message; submit disabled if locked/duplicate. Draft sync shows saved/failed state. | P0 |
| `GET /api/v1/attendance/summary`, `GET /api/v1/attendance/register`, `GET /api/v1/attendance/register/export`, `GET /api/v1/attendance/students/:id/history`, `GET /api/v1/attendance/students/:id/summary` | Monthly register, student history, parent-scoped summary. Actors: teacher/admin/parent. | `/dashboard/attendance/register`, student profile attendance tab → `MonthlyRegisterWorkspace` | Export via blob helper. Parent summary uses purpose-limited route only. | P0 |
| `GET /api/v1/attendance/analytics`, `GET /api/v1/attendance/anomalies`, `GET /api/v1/attendance/follow-ups`, `GET /api/v1/attendance/conflicts`, `PATCH /api/v1/attendance/conflicts/:id/review`, `PATCH /api/v1/attendance/sessions/:id/override` | Attendance anomalies, conflict review, locked-session override. Actor: principal/admin. | `/dashboard/attendance/review` → `AttendanceReviewWorkspace` | Review mutation requires comment/reason. Empty: no conflicts to review. | P1 |
| `GET/POST /api/v1/attendance/calendar` | Working-day calendar policy. Actor: admin. | `/dashboard/attendance/calendar` → `WorkingDayCalendarWorkspace` | Date cells show policy state. Save one day at a time; refetch month. | P1 |
| `POST /api/v1/attendance/corrections`, `GET /api/v1/attendance/corrections`, `PATCH /api/v1/attendance/corrections/:id/approve`, `PATCH /api/v1/attendance/corrections/:id/reject`, `PATCH /api/v1/attendance/corrections/:id/review` | Correction request and approval workflow. Actors: teacher requester, admin reviewer. | `/dashboard/attendance/corrections` → `AttendanceCorrectionsWorkspace` | Request/review forms preserve values on error; success updates queue. | P0 |
| `GET /api/v1/attendance/staff`, `POST /api/v1/attendance/staff`, `GET /api/v1/attendance/staff/summary`, `GET /api/v1/attendance/me/attendance`, `GET /api/v1/attendance/me/leave-requests`, `GET /api/v1/attendance/staff/leave-balances`, `GET/POST /api/v1/attendance/staff/leave-requests`, `POST /api/v1/attendance/staff/leave/:id/cancel`, `PATCH /api/v1/attendance/staff/leave-requests/:id/review` | Staff attendance and leave queue, shared with HR/payroll. Actors: HR/admin/staff. | `/dashboard/hr/attendance`, `/dashboard/me/leave` → `StaffAttendanceWorkspace`, `MyLeaveWorkspace` | Self-service screens use `me` routes. HR review actions require permission and reason. | P1 |

### 4.5 M3 Fees / Finance

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `GET/POST /api/v1/fees/heads`, `GET/POST /api/v1/fees/plans`, `GET/POST /api/v1/fees/discounts`, `POST /api/v1/fees/discounts/recalculate`, `GET/POST /api/v1/fees/waivers`, `GET/POST /api/v1/fees/due-schedules`, `POST /api/v1/fees/due-schedules/:id/process` | Fee setup, discount/waiver/due schedule. Actor: accountant/admin. | `/dashboard/finance/setup` → `FeeSetupWorkspace` | Setup forms have validation errors inline. Recalculate/process requires confirmation and shows summary. | P0 |
| `GET /api/v1/fees/invoices`, `GET /api/v1/fees/invoices/:id`, `POST /api/v1/fees/invoices/:id/void`, `POST /api/v1/fees/invoices/:id/adjustments`, `GET /api/v1/fees/students/:studentId/ledger`, `GET/POST /api/v1/fees/billing-runs` | Invoice, ledger, billing run lifecycle. Actor: accountant/cashier/admin. | `/dashboard/finance/invoices`, `/dashboard/students/[id]/fees` → `InvoicesWorkspace`, `StudentFeeLedgerPanel` | Void/adjustment needs reason. Empty ledger shows no dues/transactions. | P0 |
| `GET /api/v1/payments`, `POST /api/v1/payments`, `POST /api/v1/payments/online/initiate`, `GET /api/v1/payments/gateway-readiness`, `POST /api/v1/payments/:id/refund`, `POST /api/v1/payments/:id/reverse`, `POST /api/v1/payments/:id/refund/request`, `POST /api/v1/payments/:id/reverse/request`, `GET /api/v1/payments/requests`, `POST /api/v1/payments/requests/:id/review` | Payment collection, online gateway, refund/reversal request and approval. Actor: cashier/accountant/principal. | `/dashboard/finance/payments`, `/dashboard/finance/approvals` → `PaymentCollectionWorkspace`, `FinanceApprovalWorkspace` | Payment submission disables double click. Gateway readiness blocks online initiation with friendly reason. | P0 |
| `GET /api/v1/payments/cashier-close/preview`, `GET /api/v1/payments/cashier-close`, `POST /api/v1/payments/cashier-close`, `POST /api/v1/payments/cashier-close/:id/reopen` | Cashier close and reopen. Actor: cashier/accountant. | `/dashboard/finance/cashier-close` → `CashierCloseWorkspace` | Preview before close. Reopen requires reason and permission. | P1 |
| `GET /api/v1/receipts`, `GET /api/v1/receipts/verify/:receiptNumber`, `GET /api/v1/receipts/:receiptNumber.pdf`, `POST /api/v1/receipts/:id/reprint`, `GET /api/v1/receipts/:id/reprint-history` | Receipt list, QR verification, PDF, reprint history. Actor: cashier/accountant/parent via scoped route. | `/dashboard/finance/receipts` → `ReceiptsWorkspace` | PDF via blob helper. Reprint requires reason and logs history. | P0 |
| `GET /api/v1/fees/defaulters`, `POST /api/v1/fees/defaulters/reminders`, `GET /api/v1/fees/reports/collections`, `GET /api/v1/fees/reports/dues` | Dues, defaulters, reminders, collection reporting. Actor: accountant/admin. | `/dashboard/finance/reports` → `FeesReportsWorkspace` | Reminder preview/confirmation; empty defaulters means all clear. | P1 |

### 4.6 M4 Academics

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `GET/POST/PATCH/DELETE /api/v1/academics/exam-terms`, `PATCH /api/v1/academics/exam-terms/:id/status`, `PATCH /api/v1/academics/exam-terms/:id/unlock`, `GET/POST/PATCH/DELETE /api/v1/academics/assessment-components`, `GET /api/v1/academics/assessment-templates`, `POST /api/v1/academics/assessment-templates/apply` | Exam term and assessment setup. Actor: academic coordinator/admin. | `/dashboard/academics/setup` → `AcademicsSetupWorkspace` | Term archive/unlock requires reason. Template apply shows affected classes/components. | P0 |
| `GET/POST /api/v1/academics/exams/timetable`, `POST /api/v1/academics/exams/:id/timetable/publish` | Exam timetable setup and publish. Actor: academic coordinator. | `/dashboard/academics/exam-timetable` → `ExamTimetableWorkspace` | Publish disabled until slots valid. Empty timetable prompt. | P1 |
| `GET /api/v1/academics/marks`, `GET /api/v1/academics/marks/student/:studentId`, `POST /api/v1/academics/marks/bulk-upsert`, `PATCH /api/v1/academics/marks/:id`, `GET/POST/PATCH /api/v1/academics/marks/lock-requests` | Mark entry, history, lock workflow. Actor: subject teacher/coordinator. | `/dashboard/academics/marks` → `MarksEntryWorkspace` | Bulk upsert uses row-level errors. Lock status controls editability. | P0 |
| `GET/POST/PATCH/DELETE /api/v1/academics/cas-records`, `POST /api/v1/academics/cas-records/bulk-upsert` | CAS record entry and review. Actor: teacher/coordinator. | `/dashboard/academics/cas` → `CasRecordsWorkspace` | Save per student/component; empty class state tells teacher to choose class/exam. | P0 |
| `GET/POST /api/v1/academics/report-cards`, `POST /api/v1/academics/report-cards/batch`, `GET /api/v1/academics/report-cards/:id.pdf`, `GET /api/v1/academics/report-cards/:id/history`, `POST /api/v1/academics/report-cards/:id/corrections`, `POST /api/v1/academics/report-cards/:id/regenerate`, `GET /api/v1/academics/report-cards/corrections`, `PATCH /api/v1/academics/report-cards/corrections/:id/review` | Report card generation, PDF, correction lifecycle. Actor: academic coordinator/principal. | `/dashboard/academics/report-cards` → `ReportCardsWorkspace` | PDF through protected helper. Batch partial failures shown per student. | P0 |
| `GET/POST /api/v1/academics/subjects/:id/syllabus`, `PATCH /api/v1/academics/syllabus/:id/complete`, `GET /api/v1/academics/subjects/:id/syllabus/progress` | Syllabus topic progress. Actor: subject teacher. | `/dashboard/academics/syllabus` → `SyllabusProgressWorkspace` | Topic completion optimistic then refetch. | P2 |
| `GET /api/v1/academics/results/preview`, `GET /api/v1/academics/results/preview/student/:studentId`, `GET /api/v1/academics/results/publishing`, `POST /api/v1/academics/results/publishing/publish`, `POST /api/v1/academics/results/publishing/unpublish`, `POST /api/v1/academics/results/publishing/notify`, `GET /api/v1/academics/grading-scale`, `GET /api/v1/academics/grading-policy`, `GET /api/v1/academics/remedial`, `GET/POST /api/v1/academics/promotions`, `POST /api/v1/academics/promotions/batch` | Result preview, publish, notify, remedial and promotion readiness. Actor: coordinator/principal. | `/dashboard/academics/results`, `/dashboard/academics/promotions` → `ResultsPublishingWorkspace`, `PromotionWorkspace` | Publish requires readiness all-clear. Notify shows recipient count. | P0 |

### 4.7 M5 Activity Feed

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `SSE /api/v1/activity-feed/stream`, `GET /api/v1/activity-feed/posts`, `GET /api/v1/activity-feed/posts/:id`, `POST /api/v1/activity-feed/posts`, `PATCH /api/v1/activity-feed/posts/:id`, `DELETE /api/v1/activity-feed/posts/:id`, `PATCH /api/v1/activity-feed/posts/:id/restore`, `PATCH /api/v1/activity-feed/posts/:id/moderation` | Activity post lifecycle, moderation, restore. Actors: teacher/moderator/parent read. | `/dashboard/activity-feed`, `/dashboard/activity-feed/[id]` → `ActivityFeedWorkspace`, `ActivityPostDetail` | SSE invalidates list. Moderation status shown clearly; delete requires reason. | P0 |
| `GET /api/v1/activity-feed/parent`, `POST /api/v1/activity-feed/posts/:id/reactions`, `GET /api/v1/activity-feed/reactions/analytics`, `GET /api/v1/activity-feed/audience-preview` | Parent feed, reactions, audience preview. Actors: parent/teacher/admin. | Parent portal/mobile surfaces; admin composer → `AudiencePreviewPanel` | Parent route must stay child-scoped. Audience preview before publish. | P1 |
| `GET /api/v1/activity-feed/gallery`, `GET /api/v1/activity-feed/media/:id/preview-url`, `GET /api/v1/activity-feed/media/:id/download-url`, `GET /api/v1/activity-feed/parent/media/:id/preview-url`, `GET /api/v1/activity-feed/parent/media/:id/download-url`, `GET /api/v1/activity-feed/attachments/:id/preview`, `GET /api/v1/activity-feed/attachments/:id/download` | Gallery and private media access with consent-aware checks. Actor: teacher/parent/admin. | `/dashboard/activity-feed/gallery` → `MediaGalleryWorkspace` | Use protected media helpers. Blocked media shows consent/unavailable message. | P0 |
| `GET/POST /api/v1/activity-feed/mood-logs`, `GET/POST /api/v1/activity-feed/milestones`, `GET /api/v1/activity-feed/milestone-templates` | Preschool mood and developmental milestones. Actor: teacher/parent read. | `/dashboard/activity-feed/milestones` → `MilestonesWorkspace` | Template-driven forms; empty state by month/student. | P1 |

### 4.8 M6 Homework / Timetable

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `GET/POST/PATCH/DELETE /api/v1/homework`, `GET /api/v1/homework/templates`, `GET /api/v1/homework/:id`, `PATCH /api/v1/homework/:id/publish`, `PATCH /api/v1/homework/:id/close`, `PATCH /api/v1/homework/:id/cancel` | Homework assignment lifecycle. Actor: teacher/coordinator. | `/dashboard/homework`, `/dashboard/homework/[id]` → `HomeworkWorkspace`, `HomeworkDetailWorkspace` | Draft/published/closed/cancelled states control actions. Empty state prompts teacher to create homework. | P0 |
| `GET/POST /api/v1/homework/:id/submissions`, `GET/PATCH /api/v1/homework/submissions/:submissionId`, `PATCH /api/v1/homework/submissions/:submissionId/review`, `PATCH /api/v1/homework/submissions/:submissionId/mark-reviewed`, `POST /api/v1/homework/submissions/:submissionId/request-correction`, `POST /api/v1/homework/submit` | Submission, review, correction. Actors: teacher/parent; broad student homework UI is deferred for MVP. | `/dashboard/homework/[id]/submissions` → `HomeworkSubmissionsWorkspace` | Any student-facing submission use must be purpose-limited and is not part of broad mobile MVP. Review success updates status and counts. | P0 |
| `GET /api/v1/homework/:id/reminders/preview`, `POST /api/v1/homework/:id/reminders/send`, `GET /api/v1/homework/reminders/batches`, `POST /api/v1/homework/reminders/batches/:batchId/retry` | Missing homework reminders and retry history. Actor: teacher/coordinator. | `/dashboard/homework/reminders` → `HomeworkRemindersWorkspace` | Preview recipients before send. Retry failed batch only with visible status. | P1 |
| `GET /api/v1/homework/reports/completion`, `GET /api/v1/homework/reports/missing-late`, `GET /api/v1/homework/attachments/:attachmentId/preview-url`, `GET /api/v1/homework/attachments/:attachmentId/download-url` | Homework reports and File Registry-backed attachments. Actor: teacher/admin/parent scoped. | `/dashboard/homework/reports` → `HomeworkReportsWorkspace` | Attachment links via signed helper; report filters required. | P1 |
| `GET /api/v1/timetable`, `GET/POST/PATCH/DELETE /api/v1/timetable/periods`, `GET/POST/PATCH/DELETE /api/v1/timetable/rooms`, `GET/POST/PATCH /api/v1/timetable/versions`, `POST /api/v1/timetable/versions/:id/restore`, `GET /api/v1/timetable/versions/:id/compare/:targetId`, `POST /api/v1/timetable/versions/:id/validate`, `PATCH /api/v1/timetable/versions/:id/publish`, `PATCH /api/v1/timetable/versions/:id/lock`, `PATCH /api/v1/timetable/versions/:id/archive`, `PATCH /api/v1/timetable/versions/:id/reopen-draft`, `POST /api/v1/timetable/versions/:id/slots`, `PATCH/DELETE /api/v1/timetable/slots/:id` | Timetable builder with versioning, validation, publish/lock/archive. Actor: academic coordinator/admin. | `/dashboard/timetable/builder` → `TimetableBuilderWorkspace` | One main job: build/publish a timetable version. Validation errors show per slot. | P0 |
| `GET /api/v1/timetable/teacher-availability`, `GET/POST /api/v1/timetable/teachers/:teacherId/availability`, `PATCH/DELETE /api/v1/timetable/teacher-availability/:id`, `GET/POST/PATCH /api/v1/timetable/workload-rules`, `GET/POST/PATCH/DELETE /api/v1/timetable/subject-weekly-requirements`, `GET /api/v1/timetable/workload`, `GET /api/v1/timetable/teachers/:teacherId/workload`, `GET /api/v1/timetable/reports/teacher/:teacherId`, `GET /api/v1/timetable/reports/class/:classId` | Availability, workload limits, subject weekly period requirements, teacher/class reports. Actor: coordinator. | `/dashboard/timetable/rules`, `/dashboard/timetable/reports` → `TimetableRulesWorkspace`, `TimetableReportsWorkspace` | Empty rule state guides setup. Update one rule at a time. | P1 |
| `GET /api/v1/timetable/substitutions/summary`, `GET/POST/PATCH /api/v1/timetable/substitutions`, `PATCH /api/v1/timetable/substitutions/:id/assign`, `PATCH /api/v1/timetable/substitutions/:id/cancel`, `PATCH /api/v1/timetable/substitutions/:id/complete` | Absent-teacher substitution workflow. Actor: coordinator/admin. | `/dashboard/timetable/substitutions` → `SubstitutionWorkspace` | Assignment disabled if unavailable/conflict. Completion updates daily summary. | P0 |

### 4.9 M7 HR / Payroll

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `GET/POST/PATCH /api/v1/staff`, `GET /api/v1/staff/:id`, `POST /api/v1/staff/:id/archive`, `POST /api/v1/staff/:id/terminate`, `GET /api/v1/staff/me`, `GET /api/v1/staff/me/timeline`, `POST /api/v1/staff/me/leave-requests`, `POST /api/v1/staff/me/attendance` | Staff directory, profile, lifecycle, self-service. Actors: HR/admin/staff. | `/dashboard/hr/staff`, `/dashboard/hr/staff/[id]`, `/dashboard/me` → `StaffWorkspace`, `StaffProfileWorkspace`, `MyStaffWorkspace` | Archive/terminate requires reason. Self-service uses `me` endpoints only. | P0 |
| `GET/POST /api/v1/payroll/preview`, `POST /api/v1/payroll/runs/preview`, `GET/POST /api/v1/payroll/runs`, `GET /api/v1/payroll/runs/:id`, `POST /api/v1/payroll/runs/preview-to-draft`, `POST /api/v1/payroll/runs/:id/approve`, `POST /api/v1/payroll/runs/:id/review`, `POST /api/v1/payroll/runs/:id/submit-review`, `POST /api/v1/payroll/runs/:id/reject`, `POST /api/v1/payroll/runs/:id/post`, `POST /api/v1/payroll/runs/:id/post-to-accounting`, `POST /api/v1/payroll/runs/:id/mark-paid`, `POST /api/v1/payroll/runs/:id/reverse` | Payroll run lifecycle. Actor: accountant/HR/principal. | `/dashboard/payroll/runs`, `/dashboard/payroll/runs/[id]` → `PayrollRunsWorkspace`, `PayrollRunDetail` | State machine actions only when allowed. Reject/reverse require reason. | P0 |
| `GET /api/v1/payroll/payslips`, `GET /api/v1/payroll/me/payslips`, `GET /api/v1/payroll/payslips/:payslipNumber/pdf`, `GET /api/v1/payroll/payslips/:payslipNumber.pdf`, `GET /api/v1/payroll/runs/:runId/staff/:staffId/payslip.pdf`, `GET /api/v1/payroll/runs/:runId/lines/:lineId/salary-slip.pdf` | Payslip list and PDF. Actors: payroll admin/staff self-service. | `/dashboard/payroll/payslips`, `/dashboard/me/payslips` → `PayslipsWorkspace`, `MyPayslipsWorkspace` | Staff route only shows own payslips. PDF via blob helper. | P0 |
| `GET /api/v1/payroll/statutory-deductions`, `GET/POST/PATCH /api/v1/payroll/salary-structures`, `GET /api/v1/payroll/staff/:staffId/salary-structure`, `POST /api/v1/payroll/salary-structures/:id/activate`, `POST /api/v1/payroll/salary-structures/:id/archive` | Salary structures and statutory deductions. Actor: HR/payroll admin. | `/dashboard/payroll/salary` → `SalaryStructureWorkspace` | Active/archive states clear; archive requires confirmation. | P1 |
| `GET /api/v1/payroll/runs/:id/register`, `GET /api/v1/payroll/runs/:id/register/export.csv`, `GET /api/v1/payroll/reports/register`, `GET /api/v1/payroll/reports/summary`, `GET /api/v1/payroll/reports/pf`, `GET /api/v1/payroll/reports/tds`, `GET /api/v1/payroll/reports/salary-components`, `GET /api/v1/payroll/reports/leave-deductions`, `GET /api/v1/payroll/reports/register.csv`, `GET /api/v1/payroll/reports/pf/export.csv`, `GET /api/v1/payroll/reports/tds/export.csv` | Payroll register and statutory reports. Actor: accountant/HR. | `/dashboard/payroll/reports` → `PayrollReportsWorkspace` | CSV via blob helper; report filters required. | P1 |

### 4.10 M8A Library

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `GET/POST/PATCH /api/v1/library/books`, `POST /api/v1/library/books/:id/archive`, `GET /api/v1/library/books/:id/history`, `GET/POST/PATCH/DELETE /api/v1/library/copies`, `GET /api/v1/library/copies/scan/:code`, `PATCH /api/v1/library/copies/:id/status`, `POST /api/v1/library/copies/:id/archive`, `GET /api/v1/library/copies/:id/history` | Book/copy catalog and barcode/QR lookup. Actor: librarian/admin. | `/dashboard/library/catalog` → `LibraryCatalogWorkspace` | Scanner-first lookup. Archive/delete requires reason. | P0 |
| `GET/POST /api/v1/library/issues`, `GET /api/v1/library/my/issues`, `POST /api/v1/library/issues/scanner`, `PATCH /api/v1/library/issues/:id/return`, `POST /api/v1/library/returns/scanner`, `GET/POST /api/v1/library/reservations`, `PATCH /api/v1/library/reservations/:id/cancel`, `POST /api/v1/library/reservations/:id/fulfill`, `POST /api/v1/library/qr-lookup` | Issue/return/reservation scanner workflow. Actor: librarian/student/staff borrower. | `/dashboard/library/circulation` → `LibraryCirculationWorkspace` | Scanner success moves to confirm step. Empty borrower/issues state is friendly. | P0 |
| `GET /api/v1/library/overdue`, `POST /api/v1/library/overdue/reminders`, `GET /api/v1/library/reports/*`, `GET /api/v1/library/reports/issued.csv`, `POST /api/v1/library/reports/issued/export`, `GET /api/v1/library/borrowed-students` | Overdue, reminders, library reports. Actor: librarian/admin. | `/dashboard/library/reports` → `LibraryReportsWorkspace` | Reminder send requires preview/confirm. Export queued/direct state handled. | P1 |
| `GET/POST/PATCH /api/v1/library/fines`, `POST /api/v1/library/fines/:id/post-to-fees`, `POST /api/v1/library/fines/:id/reconcile-payment`, `GET/PATCH /api/v1/library/settings` | Fines, fee handoff, settings. Actor: librarian/accountant. | `/dashboard/library/fines`, `/dashboard/library/settings` → `LibraryFinesWorkspace`, `LibrarySettingsPanel` | Post-to-fees idempotent result displayed; settings update single form. | P1 |

### 4.11 M8B Transport

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `GET/POST/PATCH /api/v1/transport/routes`, `POST /api/v1/transport/routes/one-day-changes`, `GET/POST/PATCH /api/v1/transport/stops`, `GET/POST/PATCH /api/v1/transport/vehicles` | Routes, stops, vehicles, one-day changes. Actor: transport admin. | `/dashboard/transport/setup` → `TransportSetupWorkspace` | Save one entity at a time; route-change shows affected students. | P0 |
| `GET/POST /api/v1/transport/assignments/drivers`, `GET/POST /api/v1/transport/assignments/students`, `PATCH /api/v1/transport/assignments/students/:id/fee-mapping`, `PATCH /api/v1/transport/assignments/students/:id/pause`, `PATCH /api/v1/transport/assignments/students/:id/end` | Driver/student route assignment and fee mapping. Actor: transport admin/accountant. | `/dashboard/transport/assignments` → `TransportAssignmentsWorkspace` | Pause/end require reason. Fee mapping shows linked fee state. | P0 |
| `POST /api/v1/transport/trips`, `GET /api/v1/transport/trips/active`, `GET /api/v1/transport/trips/history`, `GET /api/v1/transport/trips/:id`, `PATCH /api/v1/transport/trips/:id/complete`, `PATCH /api/v1/transport/trips/:id/cancel`, `PATCH /api/v1/transport/trips/:id/students/boarded`, `PATCH /api/v1/transport/trips/:id/students/dropped`, `PATCH /api/v1/transport/trips/:id/students/absent`, `PATCH /api/v1/transport/trips/:id/delay`, `POST /api/v1/transport/trips/:id/location`, `GET /api/v1/transport/trips/:id/location/latest`, `POST /api/v1/transport/location/cleanup` | Trip operations and live location. Actors: driver/transport admin. | `/dashboard/transport/trips`, driver app surfaces → `TransportTripsWorkspace`, `DriverTripWorkspace` | Admin and driver routes separated. Live location handles stale/empty GPS. | P0 |
| `GET /api/v1/transport/parent/students/:studentId/active-trip`, `GET /api/v1/transport/parent/students/:studentId/status` | Parent child-scoped transport tracking. Actor: parent. | Parent/mobile surfaces → `ParentTransportStatusCard` | Purpose-limited, no full admin trip history. Show “No active trip now.” | P0 |
| `GET /api/v1/transport/driver/*`, `POST /api/v1/transport/driver/trips`, `PATCH/POST /api/v1/transport/driver/trips/:id/*` | Driver dashboard, manifest, GPS, boarding, emergency contact. Actor: driver. | Mobile/driver web surface → `DriverTransportWorkspace` | Offline/poor network pending state; no admin-only actions. | P1 |
| `GET/POST /api/v1/transport/logs`, `POST /api/v1/transport/delays`, `GET /api/v1/transport/reports*`, `GET /api/v1/transport/reports/trips.csv`, `POST /api/v1/transport/reports/trips/export` | Logs, delay broadcast, transport reports. Actor: transport admin. | `/dashboard/transport/reports` → `TransportReportsWorkspace` | Report filters; export direct/queued handling. | P1 |

### 4.12 M8C Canteen

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `GET /api/v1/canteen/qr-resolve/:token`, `POST/GET/PATCH /api/v1/canteen/menu-items`, `PATCH /api/v1/canteen/menu-items/:id/status`, `POST /api/v1/canteen/menu-items/:id/archive`, `POST/GET/PATCH /api/v1/canteen/meal-plans`, `PATCH /api/v1/canteen/meal-plans/:id/status` | Menu and meal plan setup, QR resolve for serving. Actor: canteen manager/staff. | `/dashboard/canteen/menu` → `CanteenMenuWorkspace` | Archive/status update requires reason. Empty menu prompts creation. | P0 |
| `POST/GET/PATCH /api/v1/canteen/enrollments`, `PATCH /api/v1/canteen/enrollments/:id/cancel`, `PATCH /api/v1/canteen/enrollments/:id/pause`, `PATCH /api/v1/canteen/enrollments/:id/resume`, `PATCH /api/v1/canteen/enrollments/:id/end`, `GET /api/v1/canteen/parent/students/:studentId/status` | Student meal enrollment and parent status. Actors: canteen manager/parent. | `/dashboard/canteen/enrollments`, parent/mobile → `CanteenEnrollmentWorkspace`, `ParentCanteenStatusCard` | Parent status is scoped. Pause/resume/end require reason. | P0 |
| `POST/GET /api/v1/canteen/servings`, `PATCH /api/v1/canteen/servings/:id/cancel`, `PATCH /api/v1/canteen/servings/:id/not-taken` | Meal serving, cancel, not-taken. Actor: canteen serving staff. | `/dashboard/canteen/serving` → `CanteenServingWorkspace` | Allergy/medical warning acknowledgement before submit. | P0 |
| `POST /api/v1/canteen/wallets/student/:studentId`, `GET /api/v1/canteen/wallets/student/:studentId/balance`, `POST /api/v1/canteen/wallets/student/:studentId/top-up`, `GET /api/v1/canteen/wallets/student/:studentId/transactions`, `POST /api/v1/canteen/wallets/transactions/:id/reverse`, `POST /api/v1/canteen/wallets/transactions/:id/correct`, `POST /api/v1/canteen/wallets/low-balance-alerts`, `GET/POST /api/v1/canteen/spending-controls` | Wallet, top-up, transaction correction, low-balance alerts, spending control. Actor: canteen manager/accountant/parent read. | `/dashboard/canteen/wallets` → `CanteenWalletWorkspace` | Reversal/correction reason required. Low balance alert preview/confirm. | P0 |
| `POST/GET/PATCH /api/v1/canteen/pos-sales`, `GET /api/v1/canteen/pos-sales/:id/receipt`, `GET /api/v1/canteen/pos-sales/:id/receipt.pdf`, `POST /api/v1/canteen/pos-sales/:id/receipt.pdf/file`, `POST /api/v1/canteen/pos-sales/:id/receipt.json/file` | POS sale and receipt. Actor: canteen cashier. | `/dashboard/canteen/pos` → `CanteenPosWorkspace` | Completion disabled during payment/stock check. Receipts via blob/file helper. | P0 |
| `GET/POST /api/v1/canteen/suppliers`, `GET/POST /api/v1/canteen/inventory-items`, `POST /api/v1/canteen/purchase-bills`, `POST /api/v1/canteen/wastage`, `POST /api/v1/canteen/stock-adjustment` | Inventory, suppliers, purchase, wastage, stock adjustment. Actor: canteen manager. | `/dashboard/canteen/inventory` → `CanteenInventoryWorkspace` | Stock adjustment requires reason; empty inventory prompts item setup. | P1 |
| `GET /api/v1/canteen/reports/*`, `GET /api/v1/canteen/reports/*.csv`, `POST /api/v1/canteen/reports/*/export` | Meal count, sales, low balance, spending, stock ledger reports. Actor: canteen manager/accountant. | `/dashboard/canteen/reports` → `CanteenReportsWorkspace` | Export direct/queued state; date filters required for daily reports. | P1 |

### 4.13 M9 Accounting

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `GET/POST/PATCH /api/v1/accounting/accounts`, `GET /api/v1/accounting/accounts/tree`, `POST /api/v1/accounting/accounts/seed-defaults`, `POST /api/v1/accounting/accounts/:id/archive`, legacy `GET/POST /api/v1/accounting/chart-accounts` | Chart of accounts setup. Actor: accountant/admin. | `/dashboard/accounting/chart` → `ChartOfAccountsWorkspace` | Seed defaults once with confirmation. Archive disabled when blocked. | P0 |
| `GET/POST /api/v1/accounting/fiscal-years`, `GET /api/v1/accounting/fiscal-years/:id/periods`, `POST /api/v1/accounting/fiscal-years/:id/close-year`, `POST /api/v1/accounting/fiscal-years/:id/reopen-year`, `GET/POST /api/v1/accounting/periods`, `POST /api/v1/accounting/fiscal-periods/:id/lock`, `POST /api/v1/accounting/fiscal-periods/:id/unlock`, `POST /api/v1/accounting/fiscal-periods/:id/close`, `POST /api/v1/accounting/fiscal-periods/:id/reopen` | Fiscal year/period close and lock. Actor: accountant/principal. | `/dashboard/accounting/periods` → `AccountingPeriodsWorkspace` | Lock/close/reopen require reason and show affected posting status. | P0 |
| `GET/POST /api/v1/accounting/journals`, `POST /api/v1/accounting/journals/manual`, `GET /api/v1/accounting/journals/:id`, `POST /api/v1/accounting/journals/:id/submit`, `POST /api/v1/accounting/journals/:id/approve`, `POST /api/v1/accounting/journals/:id/reject`, `POST /api/v1/accounting/journals/:id/post`, `POST /api/v1/accounting/journals/:id/cancel`, `POST /api/v1/accounting/journals/:id/reverse`, `POST /api/v1/accounting/journals/:id/correct`, `POST /api/v1/accounting/opening-balance`, `GET /api/v1/accounting/opening-balance/:fiscalYearId` | Manual journal, approval/post/reverse/correction, opening balance. Actor: accountant/principal. | `/dashboard/accounting/journals` → `JournalWorkspace` | State machine controls visible actions. Debit/credit validation before submit. | P0 |
| `POST /api/v1/accounting/vouchers/expense`, `POST /api/v1/accounting/vouchers/payment`, `POST /api/v1/accounting/vouchers/receipt`, `POST /api/v1/accounting/vouchers/contra`, `POST /api/v1/accounting/expenses`, `POST /api/v1/accounting/closing/:id` | Voucher entry and period close helper. Actor: accountant. | `/dashboard/accounting/vouchers` → `VoucherWorkspace` | One voucher type per screen section; success links created journal. | P1 |
| `GET /api/v1/accounting/reports`, `GET /api/v1/accounting/accounts/:accountId/ledger`, `GET /api/v1/accounting/reports/income-statement`, `GET /api/v1/accounting/reports/balance-sheet`, `GET /api/v1/accounting/reports/cash-book`, `GET /api/v1/accounting/reports/vat-summary`, `GET /api/v1/accounting/reports/tds-summary`, `GET /api/v1/accounting/reports/pf-summary`, `GET /api/v1/accounting/reports/source-ledger/reconciliation`, `GET /api/v1/accounting/exports/:report.csv` | Accounting reports and exports. Actor: accountant/principal. | `/dashboard/accounting/reports` → `AccountingReportsWorkspace` | Filters required. CSV via blob helper. | P0 |
| `POST /api/v1/accounting/bank-reconciliation/:accountId/import`, `GET /api/v1/accounting/bank-reconciliation/:accountId/unreconciled`, `GET /api/v1/accounting/bank-reconciliation/:accountId/auto-match`, `POST /api/v1/accounting/bank-reconciliation/reconcile`, `GET /api/v1/accounting/bank-reconciliation/:accountId/summary`, `GET /api/v1/accounting/reports/reconciliation`, `GET /api/v1/accounting/reports/reconciliation/export` | Bank statement import, auto-match, reconciliation. Actor: accountant. | `/dashboard/accounting/reconciliation` → `BankReconciliationWorkspace` | Import review before save. Auto-match suggestions are not auto-posted. | P1 |

### 4.14 M10 Communications / Messaging / Notices

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `GET/POST /api/v1/notices`, `POST /api/v1/notices/recipient-preview`, `POST /api/v1/notices/scheduled/process` | Notice composer, recipient preview, scheduled processing. Actor: principal/admin/teacher per permission. | `/dashboard/communications/notices` → `NoticesWorkspace` | Preview recipients before send/schedule. Empty notices show “No notices published yet.” | P0 |
| `SSE /api/v1/messaging/stream`, `GET /api/v1/messaging/unread-count`, `GET/POST /api/v1/messaging/conversations`, `GET/POST /api/v1/messaging/messages`, `GET/POST /api/v1/messaging/read-receipts` | Generic messaging and unread state. Actor: permitted school users. | `/dashboard/communications/messages` → `MessagingWorkspace` | SSE updates unread but list query remains source of truth. | P1 |
| `GET/POST /api/v1/messaging/parent-teacher/threads`, `GET /api/v1/messaging/parent-teacher/threads/:threadId`, `PATCH /api/v1/messaging/parent-teacher/threads/:threadId/close`, `PATCH /api/v1/messaging/parent-teacher/threads/:threadId/escalate`, `GET/POST /api/v1/messaging/parent-teacher/threads/:threadId/messages`, `PATCH /api/v1/messaging/parent-teacher/messages/:messageId/read`, `PATCH /api/v1/messaging/parent-teacher/threads/:threadId/read` | Parent-teacher chat with quiet-hours and school-safe boundaries. Actors: parent, teacher, admin moderator. | `/dashboard/communications/parent-teacher`, parent portal → `ParentTeacherChatWorkspace` | Outside-hours and data-sharing blocks shown in composer. Close/escalate require reason. | P0 |
| `GET/PUT /api/v1/messaging/parent-teacher/availability`, `GET /api/v1/messaging/parent-teacher/availability/status`, `POST /api/v1/messaging/parent-teacher/threads/:threadId/abuse-report`, `GET /api/v1/messaging/parent-teacher/abuse-reports`, `PATCH /api/v1/messaging/parent-teacher/abuse-reports/:reportId/review`, `PATCH /api/v1/messaging/parent-teacher/escalations/:escalationId/resolve` | Availability, moderation, abuse review, escalation resolution. Actor: admin/teacher/parent scoped. | `/dashboard/communications/moderation` → `ChatModerationWorkspace` | Review queues show empty “No reports pending.” Resolution requires note. | P1 |

### 4.15 M12 Learning

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `GET/POST/PATCH/DELETE /api/v1/learning/activities`, `GET /api/v1/learning/activities/:id`, `GET/POST /api/v1/learning/activities/:id/resources` | Learning activity builder and resources. Actors: teacher/admin. | `/dashboard/learning/activities`, `/dashboard/learning/activities/[id]` → `LearningActivitiesWorkspace`, `LearningActivityBuilder` | Builder saves real payload only. Archive activity instead of hard-delete wording. | P0 |
| `POST /api/v1/learning/activities/:id/sessions`, `GET /api/v1/learning/sessions`, `GET /api/v1/learning/sessions/:id`, `POST /api/v1/learning/sessions/:id/pause`, `POST /api/v1/learning/sessions/:id/resume`, `POST /api/v1/learning/sessions/:id/end`, `POST /api/v1/learning/sessions/:id/heartbeat`, `GET /api/v1/learning/sessions/:id/participants`, `POST /api/v1/learning/sessions/join` | School-only live learning sessions, monitoring, heartbeat, participants. Actors: teacher and lab/session student. | `/dashboard/learning/sessions`, `/student/learning/*` lab/session route → `LearningSessionsWorkspace`, `LearningSessionRoom` | Heartbeat failure shows reconnect, not fake live status. Join is lab/session scoped. | P0 |
| `POST /api/v1/learning/sessions/:id/attempts`, `PATCH /api/v1/learning/attempts/:id/autosave`, `POST /api/v1/learning/attempts/:id/submit` | Attempt start/autosave/submit. Actor: lab/session student. | `/student/learning/session/[sessionId]` → `LearningAttemptWorkspace` | Autosave indicator required. Submit locked after success. No broad student mobile/home app. | P0 |
| `GET /api/v1/learning/progress/class/:classId`, `GET /api/v1/learning/progress/student/:studentId`, `GET /api/v1/parent/learning/summary` | Class/student/parent learning progress. Actors: teacher, parent, lab/session student scoped. | `/dashboard/learning/progress`, parent portal → `LearningProgressWorkspace`, `ParentLearningSummaryCard` | Parent summary must use parent-scoped endpoint only. Empty: no attempts yet. | P1 |
| `GET/POST/PATCH/DELETE /api/v1/learning/resources`, `GET /api/v1/learning/resources/:id` | Reusable learning resource library. Actor: teacher/admin. | `/dashboard/learning/resources` → `LearningResourcesWorkspace` | Resource archive; no fake resource placeholders. | P1 |

### 4.16 Advanced Operations

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `GET /api/v1/advanced/approvals/catalog`, `GET/POST /api/v1/advanced/approvals/policies`, `GET/POST /api/v1/advanced/approvals`, `POST /api/v1/advanced/approvals/:id/decisions`, `POST /api/v1/advanced/approvals/:id/apply`, `POST /api/v1/advanced/approvals/:id/comments`, `POST /api/v1/advanced/approvals/:id/attachments` | Reusable approval policies, request decisions, comments, attachments. Actor: admin/principal/approver. | `/dashboard/operations/approvals` → `ApprovalsWorkspace` | Decision/apply is explicit two-step where needed. Comments/attachments update timeline. | P0 |
| `GET /api/v1/advanced/automation/catalog`, `GET/POST /api/v1/advanced/automation/rules`, `POST /api/v1/advanced/automation/execute`, `GET /api/v1/advanced/automation/execution-logs` | Deterministic rules-based automation, execution logs. Actor: admin/operator. | `/dashboard/operations/automation` → `AutomationRulesWorkspace` | Rule creation from catalog. Execute action shows dry-run/preview if backend supports it; otherwise confirm. | P1 |
| `GET /api/v1/advanced/analytics/summaries`, `POST /api/v1/advanced/analytics/refresh` | Descriptive analytics summaries. Actor: admin/principal. | `/dashboard/operations/analytics` → `AnalyticsSummariesWorkspace` | Refresh queued/pending state; label as descriptive, not AI prediction. | P1 |
| `GET/POST /api/v1/advanced/document-templates`, `POST /api/v1/advanced/document-templates/:id/generate`, `POST /api/v1/advanced/document-templates/generated/:id/print-history` | Certificate/document template generation and print history. Actor: office/admin. | `/dashboard/operations/documents` → `DocumentTemplatesWorkspace` | Generate from real template only. Print history reason optional but visible. | P1 |
| `GET/POST /api/v1/advanced/exports`, `POST /api/v1/advanced/exports/:id/retry` | Export center jobs. Actor: admin/operator. | `/dashboard/operations/exports` → `ExportCenterWorkspace` | Job statuses: queued/running/success/failed. Retry failed only. | P0 |

### 4.17 Reports / File Registry / Settings / Mobile

| Backend routes | School workflow / business logic / actor | Frontend route + component | Data, mutation, and state handling | Priority |
|---|---|---|---|---|
| `GET /api/v1/reports`, `POST /api/v1/reports/:reportKey/export`, `GET /api/v1/reports/export-history`, `POST /api/v1/reports/export-history/:id/retry`, `GET /api/v1/reports/export-history/:id/download` | Shared reports catalog, export history, retry/download. Actor: admin/accountant/allowed staff. | `/dashboard/reports` → `ReportsWorkspace` | 202 queued response shown as job. Download via blob helper. | P0 |
| `POST /api/v1/files/upload`, `POST /api/v1/files/signed-upload`, `POST /api/v1/files/:id/complete-upload`, `GET /api/v1/files/:id/view`, `GET /api/v1/files/:id/signed-preview`, `GET /api/v1/files/:id/signed-download`, `GET /api/v1/files/:id/preview`, `GET /api/v1/files/:id/download` | File Registry upload, signed access, audited preview/download. Actor: module-specific authorized users. | Shared file components → `FileUploadField`, `ProtectedFileLink` | Validate accepted module before upload. Never expose object keys. | P0 |
| `GET /api/v1/settings`, `GET /api/v1/settings/public`, `GET /api/v1/settings/onboarding`, `GET /api/v1/settings/audit-logs`, `PATCH /api/v1/settings/:key`, `POST /api/v1/settings/branding/logo`, `GET /api/v1/settings/branding/logo/preview`, `GET /api/v1/settings/branding/logo/download`, `DELETE /api/v1/settings/branding/logo` | Tenant settings, onboarding, audit, branding logo. Actor: school admin. | `/dashboard/settings`, `/dashboard/settings/branding` → `SettingsWorkspace`, `BrandingWorkspace` | Logo uses File Registry-backed private access. Setting update one key at a time. | P0 |
| `GET /api/v1/mobile/me/students`, `GET /api/v1/mobile/me/dashboard`, `GET /api/v1/mobile/me/notifications`, `POST /api/v1/mobile/me/notifications/:id/read`, `GET /api/v1/mobile/students/:id/profile`, `GET /api/v1/mobile/students/:id/attendance-summary`, `GET /api/v1/mobile/students/:id/fees-summary`, `GET /api/v1/mobile/students/:id/receipts/:receiptNumber.pdf`, `GET /api/v1/mobile/students/:id/activity-feed`, `GET /api/v1/mobile/students/:id/homework`, `GET /api/v1/mobile/students/:id/timetable`, `GET /api/v1/mobile/students/:id/report-cards`, `GET /api/v1/mobile/students/:id/canteen`, `GET /api/v1/mobile/students/:id/library`, `GET /api/v1/mobile/students/:id/transport` | Parent mobile summary and child-scoped module cards. Actor: parent/guardian. | Flutter app and optional responsive parent portal → `ParentMobileSummaryScreens` | Purpose-limited. Do not call admin APIs from parent/mobile surfaces. | P1 |

---

## 5. Frontend Sprint Order

### Sprint 0 — API foundation and route guard readiness

**Goal:** Shared client safety before module screens.

Acceptance criteria:

- One shared cookie-first HTTP helper is used by all clients.
- API errors normalize to typed states: auth, permission, module locked, validation, conflict, server error.
- Blob/download helper handles CSV/PDF/private media without raw token storage.
- Module guard component shows locked and permission-denied states consistently.
- No fake data remains in planned module workspaces.

### Sprint 1 — Auth, Settings, RBAC, Platform basics

**Goal:** Ensure school admins and platform operators can access real tenant/user/module state.

Acceptance criteria:

- Login/session restore/logout work from cookies only.
- Users/Roles workspace uses `/users`, `/roles`, `/roles/permissions`.
- Settings and branding use `/settings` and private logo routes.
- Platform tenants, module locks, provider readiness, queue health, and onboarding use real M0 routes.

### Sprint 2 — M1 Students and Admissions

**Goal:** Student/admission workflows become the stable backbone for all dependent modules.

Acceptance criteria:

- Student directory/profile/lifecycle uses real `/students` APIs.
- Admissions pipeline/import/duplicate review uses `/admissions` and duplicate APIs.
- iEMIS readiness/export uses real endpoints and authenticated downloads.
- QR management never expects stored raw tokens.

### Sprint 3 — M2 Attendance and M6 Timetable foundation

**Goal:** Daily school operations for teachers and coordinators.

Acceptance criteria:

- Attendance marking handles roster loading, drafts, sync, corrections, conflicts, register exports.
- Timetable builder handles versions, validation, publish/lock/archive, workload rules, substitutions.
- Teacher/staff scoped routes are not replaced by admin routes.

### Sprint 4 — M3 Fees and M9 Accounting

**Goal:** Cash collection, receipts, ledger posting, and accounting reports.

Acceptance criteria:

- Fees setup, billing runs, invoices, payments, receipts, cashier close use real routes.
- Refund/reversal approval queues reflect backend state.
- Accounting chart, fiscal periods, journals, vouchers, reports, reconciliation use real routes.
- All PDF/CSV exports use authenticated blob helpers.

### Sprint 5 — M4 Academics and M6 Homework

**Goal:** Learning administration, marks, report cards, homework lifecycle.

Acceptance criteria:

- Exam terms/components/templates, marks, CAS, results publishing, report cards, promotions use real APIs.
- Homework assignment/submission/review/reminders/reports use real APIs.
- Locked term/homework states disable unsafe actions.

### Sprint 6 — M7 HR/Payroll

**Goal:** Staff and payroll lifecycle with safe self-service.

Acceptance criteria:

- Staff directory/lifecycle/self-service uses `/staff` and `me` routes correctly.
- Payroll run state machine uses backend status; no client-side status invention.
- Payslips and payroll CSV/PDF exports use authenticated blob helper.

### Sprint 7 — M8A/M8B/M8C Operations

**Goal:** Library, transport, and canteen operational workspaces.

Acceptance criteria:

- Library scanner workflows, fines, reports, and settings use real APIs.
- Transport setup, assignments, trips, driver, parent tracking, reports use scoped APIs.
- Canteen menu/plans/enrollments/serving/wallet/POS/inventory/reports use real APIs and warning acknowledgements.

### Sprint 8 — M10 Communications and M5 Activity Feed

**Goal:** Safe school communication and parent-visible updates.

Acceptance criteria:

- Notices include recipient preview before send/schedule.
- Parent-teacher chat handles quiet hours, read receipts, escalation, abuse review, availability.
- Activity feed handles consent-aware media, moderation, gallery, parent-scoped posts.

### Sprint 9 — M12 Learning and Advanced Operations

**Goal:** Learning layer and pre-AI advanced operations frontends.

Acceptance criteria:

- Learning activities/sessions/attempts/progress/resources use real M12 APIs.
- Advanced approvals, automation, analytics, document templates, export center use real APIs.
- Analytics labels remain descriptive; no AI/prediction language.

---

## 6. Verification Checklist

Before each sprint is marked complete:

```text
pnpm --filter @schoolos/web typecheck
pnpm typecheck
pnpm build
pnpm verify:openapi
re-run relevant smoke suite when touching existing flows
```

Manual browser verification for each workflow:

- Loading state appears before data resolves.
- Empty state uses school-friendly copy.
- Error state keeps form/filter state and exposes retry.
- Success state refetches or invalidates related queries.
- Permission-denied state hides restricted actions.
- Module-locked state blocks workflow without fake data.
- Mutation has disabled pending state and safe confirmation where needed.
- CSV/PDF/file/media actions use authenticated helpers.

---

## 7. Remaining Mapping Work Before UI Build

- Generate or open `/api/v1/docs` locally and compare route count against this source-extracted map.
- Fill exact component filenames after each sprint chooses final workspace names.
- Add type imports from `@schoolos/core` where available before writing client method signatures.
- For controller routes not used by the web app yet, keep them documented but do not create UI just to consume them.

---

## 8. Compact Workflow Trace

Backend route → school workflow → UI screen → component → API client → state handling → verification

Example:

```text
GET /api/v1/students
→ Student directory
→ /dashboard/students
→ StudentDirectoryWorkspace
→ apps/web/lib/api/students.ts:listStudents
→ loading/empty/error/success/permission/module-locked states
→ web typecheck + browser filter/list verification
```
