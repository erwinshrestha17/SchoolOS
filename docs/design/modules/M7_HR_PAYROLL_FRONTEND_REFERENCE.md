# M7 HR and Payroll — Frontend Design Reference

**Status:** Active module-level frontend design reference.  
**Updated:** 2026-06-19  
**Module:** M7 HR and Payroll  
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`  
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`

This document defines implementation-ready frontend design guidance and backend-alignment expectations for M7. Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Intent

M7 is the staff lifecycle, leave, attendance, salary, payroll, payslip, and staff self-service workspace. It must protect staff privacy while giving HR/payroll users controlled operational workflows.

Core flow:

```text
Staff profile
-> contract / document management
-> attendance / leave
-> salary structure versioning
-> payroll draft
-> review / approve / post
-> payslip generation
-> reversal / correction where required
-> staff self-service visibility
```

---

## 2. Theme and Layout Alignment

Use a privacy-first HR workbench:

```text
ModuleHeader
Staff/payroll summary strip
Tabs
FilterBar
Main staff/payroll workspace
Right detail drawer
Sensitive-field masking
Protected document/payslip actions
Audit timeline
```

Design rules:

- Salary, bank, PAN, payslip, and staff documents are masked unless permission allows visibility.
- Payroll workflows must look controlled and state-driven, not editable like ordinary lists.
- Staff self-service screens are separate from admin HR screens.
- Posted payroll is immutable in UI; use reversal/correction actions only.
- High-risk actions require reason and audit visibility.

---

## 3. Personas and Scope

| Persona | Main job | Scope rule |
|---|---|---|
| HR admin | Manage staff records, documents, contracts, leave. | Permission-gated tenant scope. |
| Payroll officer | Run and review payroll. | Payroll permission required. |
| Principal | Review staff and payroll summaries. | Summary/read-only unless permitted. |
| Staff | View own profile, leave, payslips. | Own record only. |
| Accountant | Review payroll accounting handoff. | Finance/payroll permission-gated. |

---

## 4. Recommended Route Map

```text
/dashboard/hr
/dashboard/hr/staff
/dashboard/hr/staff/[staffId]
/dashboard/hr/contracts
/dashboard/hr/documents
/dashboard/hr/attendance
/dashboard/hr/leave
/dashboard/hr/leave/approvals
/dashboard/payroll
/dashboard/payroll/runs
/dashboard/payroll/runs/[payrollRunId]
/dashboard/payroll/salary-structures
/dashboard/payroll/payslips
/dashboard/payroll/reports
/dashboard/hr/settings
/staff/profile
/staff/leave
/staff/payslips
```

---

## 5. Required Screens

### 5.1 HR Dashboard

- KPI cards: active staff, pending leave, contracts expiring, attendance exceptions, documents missing, payroll draft status.
- Quick actions: Add Staff, Review Leave, Start Payroll, Generate Payslips, Export Staff Report.
- Attention queue: missing documents, expiring contracts, unapproved leave, payroll blockers.

### 5.2 Staff Directory and Profile

- Staff table with search, department, role, status, contract type, document status.
- Profile detail with sections: personal, employment, assignment, documents, attendance, leave, payroll visibility where permitted.
- Sensitive data masked by default.
- Documents use protected file helpers.

### 5.3 Leave Workflow

- Leave calendar/list with status: Draft, Submitted, Approved, Rejected, Cancelled, LWP.
- Approval queue with balance preview, conflict info, reason/note, audit trail.
- LWP payroll effect must come from backend.

### 5.4 Staff Attendance

- Check-in/out logs, exceptions, late/absent flags, correction requests.
- Staff self-service own attendance view.
- Admin correction requires reason and audit.

### 5.5 Salary Structures

- Versioned salary structure list.
- Effective date, allowances, deductions, staff assignment, status.
- Past versions read-only.
- Changes require confirmation and reason where policy requires it.

### 5.6 Payroll Run Workspace

State machine:

```text
Draft
Review
Approved
Posted
Reversed
```

Layout:

```text
Header: payroll period and state
KPI strip: gross, deductions, net, staff count, blockers
Main: staff payroll line table
Right rail: blockers, variance, audit, accounting handoff
Sticky footer: Save Draft / Submit Review / Approve / Post / Reverse
```

### 5.7 Payslips and Staff Self-Service

- Payslip list with period, status, net pay where allowed, protected PDF.
- Staff sees own payslips only.
- Admin sees salary/bank detail only with permission.

---

## 6. Backend Alignment

Required backend capabilities:

```text
Staff CRUD APIs
Staff document File Registry APIs
Staff lifecycle/contract APIs
Leave request/approval/balance APIs
Attendance/check-in/out/correction APIs
Salary structure versioning APIs
Payroll draft/review/approve/post/reverse APIs
Payslip generation and protected file APIs
M11 accounting handoff state
M12 HR/payroll notification events
Staff self-service purpose-limited APIs
Audit logs for payroll and sensitive HR mutations
```

Backend ownership rules:

- Salary/payroll totals are backend-owned.
- Sensitive field visibility is backend permission-filtered.
- Posted payroll is immutable except reversal/correction.
- Staff self-service is own-record scoped by backend.
- Payslips use File Registry.

---

## 7. Required States

```text
Loading
No staff
Sensitive field masked
Document missing
Document unavailable
Leave pending
Leave approved
Leave rejected
Payroll draft
Payroll review
Payroll approved
Payroll posted
Payroll reversed
Payslip generating
Payslip ready
Permission denied
Module locked
Accounting handoff failed
```

---

## 8. Implementation Checklist

```text
[ ] Reads main web design plan and design system.
[ ] Sensitive fields are masked unless permission allows.
[ ] Staff documents and payslips use protected file helpers.
[ ] Leave balance/payroll impact comes from backend.
[ ] Salary structures are versioned and effective-date aware.
[ ] Payroll state machine is respected.
[ ] Posted payroll uses reversal/correction only.
[ ] Staff self-service is own-record scoped.
[ ] M11 accounting handoff state is visible but backend-owned.
[ ] No fake HR/payroll metrics remain.
```
