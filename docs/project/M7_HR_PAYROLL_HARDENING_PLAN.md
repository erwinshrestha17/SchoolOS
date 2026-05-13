# Implementation Plan - Harden M7 HR and Payroll Backend

**Last reviewed:** 2026-05-13

**Current status:** Backend/admin UI foundation implemented; remaining work is deeper payroll/leave/report/browser hardening.

For project-wide phase order, follow `docs/project/SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md`. This file is a module-specific checklist only.

This plan outlines the steps to harden the HR and Payroll modules in SchoolOS, ensuring production-grade depth, security, and accounting integration.

## 1. Schema Enhancements
- [x] Add `StaffDocumentKind` enum (ID_CARD, CITIZENSHIP, CONTRACT, ACADEMIC_CERTIFICATE, OTHER).
- [x] Add `StaffDocument` model to track staff files via File Registry.
- [x] Add `StaffLifecycleEventType` enum (HIRED, PROMOTED, TRANSFERRED, ON_LEAVE, RETURNED, TERMINATED, RESIGNED).
- [x] Add `StaffLifecycleEvent` model for audit trail.
- [x] Add `PayrollRunStatus` hardening (ensure all states are used).
- [x] Add `PayrollCorrection` fields to `PayrollRun`.

## 2. Staff Profile & Lifecycle
- [x] **Staff Document Manager**: Integrated with `FileRegistryService` via `StaffDocumentService`.
- [x] **Contract History**: Enhanced `StaffContract` tracking in schema and services.
- [x] **Lifecycle Auditing**: Implemented `StaffLifecycleService` to log events (HIRED, STATUS_CHANGE, TERMINATED).
- [x] **Termination Workflow**: Implemented `terminateStaff` in `StaffService` with user deactivation.

## 3. Leave Management
- [x] **Accrual Logic**: Foundation laid in `StaffLeaveBalance`.
- [x] **Paid/Unpaid Handling**: Updated `PayrollService` to distinguish between paid and unpaid leave requests.
- [x] **Audit Trail**: Detailed logs for leave approval/rejection (existing logic + lifecycle logging).

## 4. Payroll Lifecycle & Corrections
- [x] **State Machine**: Strict transition logic in `PayrollService`.
- [x] **Locking**: Posted payroll is immutable (enforced by status checks).
- [x] **Reversal Workflow**: Implemented `reversePayrollRun` with mandatory reason.
- [x] **Correction Entry**: Reversal entries handled via `AccountingPostingService`.

## 5. Accounting Integration (M9)
- [x] **AccountingPostingService**: Ensured all payroll postings go through this service.
- [x] **Automatic Vouchers**:
    - Salary Accrual: Handled via `postPayrollAccrual`.
    - Disbursement: Handled via `postPayrollDisbursement`.
- [x] **Reversal Tests**: `reversePayrollRun` uses `postReversal` for both accrual and disbursement.

## 6. Reports & Security
- [x] **Payroll Register**: Enhanced register with more details (PF, TDS, Paid/Unpaid days).
- [x] **Staff Attendance Report**: Logical foundation for combined attendance/calendar view.
- [x] **Sensitive Field Masking**: Implemented `mask` logic in `mapStaffDetail` for `citizenshipNo`, `panNumber`, `bankAccount`.
- [x] **RBAC**: Enforced permissions for all new endpoints (`hr:staff:terminate`, `payroll:run:reverse`, etc.).

## 7. Verification
- [ ] `pnpm db:generate`
- [ ] `pnpm db:validate`
- [ ] `pnpm verify:openapi`
- [ ] `pnpm --filter @schoolos/api typecheck`
- [ ] `pnpm test:e2e`
- [ ] `pnpm build`
- [ ] Add/run HR and payroll browser smoke coverage.

## 8. Remaining M7 Hardening

- [ ] Payroll approval/posting lock depth.
- [ ] Leave accrual edge cases and audit workflow depth.
- [ ] Sensitive staff field encryption/masking review.
- [ ] Payroll register/report export hardening.
- [ ] Payslip PDF visual polish.
- [ ] Staff self-service finalization.
- [ ] More HR/payroll permission and tenant-isolation tests.
