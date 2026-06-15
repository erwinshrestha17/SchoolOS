# SchoolOS Settings Wireframes

**Status:** Companion wireframe guide for SchoolOS school-level settings.  
**Scope:** Design planning only. This document does not implement backend, frontend, mobile, API, database, migrations, or tests.  
**Related docs:**

- `docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md`
- `docs/design/SCHOOLOS_WEB_DESIGN_EXPANSION.md`
- `docs/design/SCHOOLOS_WEB_MODULE_WORKSPACE_LAYOUT.md`
- `docs/design/SCHOOLOS_WEB_LOW_FIDELITY_WIREFRAMES.md`
- `docs/design/SCHOOLOS_WEB_COMPONENT_IMPLEMENTATION_PLAN.md`

Settings should be available from the bottom of the global aside bar.

```text
Global Aside
  Dashboard
  Admissions
  Attendance
  Fees
  Academics
  Activity
  Homework
  HR
  Library
  Transport
  Canteen
  Accounting
  Communication

  ─────────────
  Settings
  Help
```

---

## Settings Module Purpose

Settings controls **school-level configuration**, not daily operations.

It should include:

```text
School Profile
Academic Years
Classes & Sections
Roles & Permissions
Users
Fee Settings
Attendance Settings
Exam Settings
Notification Settings
Templates
File & Document Settings
Security
Integrations
Backup & Export
```

Settings should be **school-admin focused**, while **M0 Platform Core** remains developer/SaaS-admin focused.

Guardrails:

- Use real APIs only.
- Keep `tenantId` as the tenant boundary everywhere.
- Backend authorization remains the source of truth.
- All settings mutations must be audited.
- Sensitive settings changes require confirmation and audit reason where required.
- Do not expose platform-only settings to normal school users.
- File and document settings must use protected File Registry access rules.
- Integrations must never expose provider secrets in the UI.

---

## 1. Settings Main Workspace Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Settings                                                                     │
│ Configure school profile, academic years, users, permissions, modules,        │
│ notifications, templates and system rules.                                    │
│                                                        [Save Changes]         │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Search settings...                                                           │
└──────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────┬──────────────────────────────────────────────────────┐
│ Settings Menu          │ Settings Content                                      │
│-----------------------│------------------------------------------------------│
│ School Profile         │ Selected settings page appears here                  │
│ Academic Years         │                                                      │
│ Classes & Sections     │                                                      │
│ Users                  │                                                      │
│ Roles & Permissions    │                                                      │
│ Modules                │                                                      │
│ Fee Settings           │                                                      │
│ Attendance Settings    │                                                      │
│ Exam Settings          │                                                      │
│ Notification Settings  │                                                      │
│ Templates              │                                                      │
│ File & Documents       │                                                      │
│ Security               │                                                      │
│ Integrations           │                                                      │
│ Backup & Export        │                                                      │
└───────────────────────┴──────────────────────────────────────────────────────┘
```

---

## 2. School Profile Settings

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ School Profile                                                               │
│ Basic information used in receipts, report cards, notices and documents.      │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Basic Details                         │ │ Branding                            │
│--------------------------------------│ │-------------------------------------│
│ School Name                           │ │ School Logo                         │
│ [ Holyland Kids' Academy        ]     │ │ [ Upload Logo ]                     │
│                                      │ │                                     │
│ Registration No.                      │ │ Receipt Header Preview              │
│ [                             ]       │ │ ┌───────────────────────────────┐   │
│                                      │ │ │ Holyland Kids' Academy          │   │
│ Phone                                │ │ │ Butwal, Nepal                  │   │
│ [                             ]       │ │ └───────────────────────────────┘   │
│                                      │ │                                     │
│ Email                                │ │ [Change Logo] [Remove]              │
│ [                             ]       │ │                                     │
│                                      │ │                                     │
│ Address                              │ │                                     │
│ [                             ]       │ │                                     │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Principal Name: [                          ]                                 │
│ School Website: [                          ]                                 │
│ Default Language: [ English ▼ ]                                               │
│ Time Zone: [ Asia/Kathmandu ▼ ]                                               │
│                                                                              │
│ [Cancel] [Save School Profile]                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:

- School logo upload must use protected File Registry flow.
- School profile changes must write an audit event.
- Receipt/report-card/notice preview should use saved templates where available.

---

## 3. Academic Year Settings

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Academic Years                                                               │
│ Manage academic sessions, active year, promotion cycle and year lock.         │
│                                                        [Create Academic Year] │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Academic Year Table                                                           │
│------------------------------------------------------------------------------│
│ Year Name | Start Date | End Date | Status | Active | Locked | Actions       │
│------------------------------------------------------------------------------│
│ 2082/83   | 2082-01-01 | 2082-12-30 | Active | Yes | No  | Edit | Lock      │
│ 2081/82   | 2081-01-01 | 2081-12-30 | Closed | No  | Yes | View             │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Academic Year Rules                                                           │
│ [ ] Auto-generate roll numbers after promotion                                │
│ [ ] Lock previous year data after closing                                      │
│ [ ] Require approval before student promotion                                  │
│                                                                              │
│ [Save Rules]                                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:

- Active academic year changes can affect every module and require confirmation.
- Closing or locking a year must be auditable.
- Promotion settings must not perform actual promotions without a separate workflow.

---

## 4. Classes and Sections Settings

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Classes & Sections                                                           │
│ Configure school levels, classes, sections, class teachers and capacity.       │
│                                                             [Add Class]       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Class List                            │ │ Selected Class Detail               │
│--------------------------------------│ │-------------------------------------│
│ Nursery                              │ │ Class: Grade 5                      │
│ LKG                                  │ │ Level: Basic Level                  │
│ UKG                                  │ │ Capacity: [ 40 ]                    │
│ Grade 1                              │ │                                     │
│ Grade 2                              │ │ Sections                            │
│ Grade 3                              │ │ A | Class Teacher: Ram Sharma       │
│ Grade 4                              │ │ B | Class Teacher: Sita KC          │
│ Grade 5      Selected                │ │                                     │
│ Grade 6                              │ │ [Add Section]                       │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Class Rules                                                                   │
│ [ ] Allow multiple sections per class                                          │
│ [ ] Require class teacher before activating section                            │
│ [ ] Show preschool level separately                                            │
│                                                                              │
│ [Save Changes]                                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:

- Class/section deletion should be soft/archive-style if records exist.
- Capacity and class teacher rules should validate before activation.
- Teacher assignment must respect HR/staff records and role permissions.

---

## 5. Users Settings

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Users                                                                        │
│ Manage staff logins, parent accounts, student accounts and user access.       │
│                                                               [Invite User]  │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Search user... | Role ▼ | Status ▼ | Login Type ▼ | [Export]                 │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Users Table                                                                   │
│------------------------------------------------------------------------------│
│ Name | Email/Phone | Role | Linked Profile | Status | Last Login | Actions   │
│------------------------------------------------------------------------------│
│ Ram Sharma | 98xxxx | Teacher | Staff Profile | Active | Today | Edit        │
│ Aarav Parent | 98xxxx | Parent | Student: Aarav | Active | Yesterday | View  │
│ Sita KC | sita@... | Accountant | Staff Profile | Invited | Never | Resend   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### User Detail Drawer

```text
┌──────────────────────────────────────────────┐
│ User Detail                                  │
├──────────────────────────────────────────────┤
│ Name: Ram Sharma                             │
│ Role: Teacher                                │
│ Status: Active                               │
│ Linked Staff: Ram Sharma                     │
│                                              │
│ Permissions Summary                          │
│ Attendance: Mark assigned class only         │
│ Homework: Create and review                  │
│ Fees: No access                              │
│                                              │
│ [Edit Role] [Reset Password] [Disable User]  │
└──────────────────────────────────────────────┘
```

Notes:

- Do not expose raw internal user IDs.
- Disable/reset actions must be audited.
- Parent accounts must remain child-scoped.
- Student accounts, if enabled, must remain limited to safe student surfaces.

---

## 6. Roles and Permissions Settings

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Roles & Permissions                                                          │
│ Control which users can view, create, edit, approve, export and delete data.  │
│                                                               [Create Role]  │
└──────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────┬──────────────────────────────────────────────────────┐
│ Roles                  │ Permission Matrix                                    │
│-----------------------│------------------------------------------------------│
│ Principal              │ Module        View Create Edit Approve Export Delete │
│ Admin                  │------------------------------------------------------│
│ Teacher                │ Admissions    ✓    ✓      ✓    -       ✓      -      │
│ Class Teacher Selected │ Attendance    ✓    ✓      ✓    ✓       ✓      -      │
│ Accountant             │ Fees          ✓    -      -    -       -      -      │
│ Librarian              │ Academics     ✓    ✓      ✓    -       ✓      -      │
│ Transport Manager      │ HR            -    -      -    -       -      -      │
│ Canteen Staff          │ Library       -    -      -    -       -      -      │
│ Parent                 │ Transport     -    -      -    -       -      -      │
│ Student                │ Canteen       -    -      -    -       -      -      │
└───────────────────────┴──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Permission Rules                                                              │
│ [ ] Teachers can only view assigned classes                                   │
│ [ ] Accountants cannot delete payments                                        │
│ [ ] Parents can only view their own child data                                │
│ [ ] Students can only view their own homework, exams and notices              │
│                                                                              │
│ [Save Permission Changes]                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:

- The UI permission matrix is a management surface only; backend service-level RBAC remains mandatory.
- High-privilege role changes require confirmation.
- Permission changes must be audited with before/after values.

---

## 7. Module Access Settings

This is for school-level module visibility. Full SaaS plan control still belongs to **M0 Platform Core**.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Modules                                                                      │
│ Enable, disable or hide modules for this school workspace.                    │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Module Access                                                                 │
│------------------------------------------------------------------------------│
│ Module              Status      Visible in Sidebar     Notes                 │
│------------------------------------------------------------------------------│
│ Admissions          Enabled     Yes                    Core module           │
│ Attendance          Enabled     Yes                    Core module           │
│ Fees                Enabled     Yes                    Core module           │
│ Academics           Enabled     Yes                    Core module           │
│ Activity Feed       Enabled     Yes                    Optional              │
│ Homework            Enabled     Yes                    Optional              │
│ HR & Payroll        Enabled     Yes                    Optional              │
│ Library             Enabled     Yes                    Optional              │
│ Transport           Disabled    No                     Not used by school    │
│ Canteen             Disabled    No                     Not used by school    │
│ Accounting          Enabled     Yes                    Finance team only     │
│ Communication       Enabled     Yes                    Core module           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ [Save Module Visibility]                                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:

- Module visibility does not override SaaS entitlement.
- Direct route access must still show `ModuleLockedState` or permission-safe denial.
- Never show fake module data when a module is disabled or locked.

---

## 8. Fee Settings

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Fee Settings                                                                 │
│ Configure fee heads, receipt sequence, payment methods, fines and discounts.  │
│                                                              [Add Fee Head]  │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Fee Heads                             │ │ Receipt & Payment Rules             │
│--------------------------------------│ │-------------------------------------│
│ Tuition Fee                           │ │ Receipt Prefix                      │
│ Admission Fee                         │ │ [ HKA-REC- ]                        │
│ Exam Fee                              │ │                                     │
│ Transport Fee                         │ │ Starting Number                     │
│ Library Fine                          │ │ [ 1001 ]                            │
│ Canteen Wallet                        │ │                                     │
│                                      │ │ Payment Methods                     │
│ [Add Fee Head]                        │ │ [✓] Cash [✓] Bank [✓] QR [ ] Cheque │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Fine & Discount Rules                                                         │
│ Late Fee Type: [ Fixed ▼ ] Amount: [ Rs. 100 ]                                │
│ Grace Period: [ 7 days ]                                                       │
│ Discount Approval Required: [ Yes ▼ ]                                          │
│ Payment Reversal Approval Required: [ Yes ▼ ]                                  │
│                                                                              │
│ [Save Fee Settings]                                                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:

- Money configuration must use Decimal/numeric-safe backend contracts.
- Receipt sequence changes require confirmation and audit.
- Payment methods must reflect provider readiness and school policy.

---

## 9. Attendance Settings

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Attendance Settings                                                          │
│ Configure attendance rules, marking deadlines, lock windows and alerts.       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Student Attendance Rules              │ │ Teacher Attendance Rules             │
│--------------------------------------│ │-------------------------------------│
│ Marking Deadline                      │ │ Staff attendance enabled             │
│ [ 10:30 AM ]                          │ │ [ Yes ▼ ]                            │
│                                      │ │                                     │
│ Auto Lock After                       │ │ Late after                           │
│ [ 11:00 AM ]                          │ │ [ 10:00 AM ]                         │
│                                      │ │                                     │
│ Correction Window                     │ │ Require correction approval          │
│ [ 3 days ]                            │ │ [ Yes ▼ ]                            │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Attendance Alerts                                                             │
│ [✓] Alert class teacher if attendance not submitted                           │
│ [✓] Notify parent when student is absent                                      │
│ [✓] Show frequent absence alert                                               │
│ [ ] Auto-send SMS for absence                                                 │
│                                                                              │
│ [Save Attendance Settings]                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:

- Lock/deadline changes affect daily teacher workflows and must be clearly explained.
- SMS settings must depend on notification provider readiness.
- Parent notifications must be tenant-scoped and child-scoped.

---

## 10. Exam and Report Card Settings

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Exam & Report Card Settings                                                  │
│ Configure grading scale, marks components, report card format and publishing. │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Grading Scale                         │ │ Report Card Rules                   │
│--------------------------------------│ │-------------------------------------│
│ A+  90 - 100                          │ │ Show attendance summary             │
│ A   80 - 89                           │ │ [ Yes ▼ ]                           │
│ B+  70 - 79                           │ │                                     │
│ B   60 - 69                           │ │ Show rank                           │
│ C+  50 - 59                           │ │ [ Optional ▼ ]                      │
│                                      │ │                                     │
│ [Edit Scale]                          │ │ Require approval before publish     │
│                                      │ │ [ Yes ▼ ]                           │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Default Marks Components                                                      │
│ [✓] Theory                                                                    │
│ [✓] Practical                                                                 │
│ [✓] Internal Assessment                                                       │
│ [ ] Project Work                                                              │
│ [ ] Viva                                                                      │
│                                                                              │
│ [Save Exam Settings]                                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:

- Report-card publish settings affect parent-visible results and require confirmation.
- Rank display should be optional by school policy.
- Existing published report-card snapshots should not be silently changed.

---

## 11. Notification Settings

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Notification Settings                                                        │
│ Configure in-app, SMS, email and push notifications.                          │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Notification Channels                                                         │
│------------------------------------------------------------------------------│
│ Event                         In-App     SMS      Email     Push              │
│------------------------------------------------------------------------------│
│ Student absent                ✓          ✓        -         ✓                 │
│ Fee due reminder              ✓          ✓        ✓         ✓                 │
│ Notice sent                   ✓          -        ✓         ✓                 │
│ Homework assigned             ✓          -        -         ✓                 │
│ Report card published         ✓          -        ✓         ✓                 │
│ Transport delay               ✓          ✓        -         ✓                 │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Quiet Hours                                                                   │
│ Start: [ 6:00 PM ] End: [ 7:00 AM ]                                           │
│ [✓] Disable parent-teacher chat outside school hours                          │
│ [✓] Allow emergency notices anytime                                           │
│                                                                              │
│ [Save Notification Settings]                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:

- Emergency notices may bypass quiet hours only by policy.
- Chat quiet hours must align with M10 communication rules.
- SMS/email/push availability must match integration/provider readiness.

---

## 12. Templates Settings

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Templates                                                                    │
│ Manage reusable notice, receipt, report card and message templates.           │
│                                                            [Create Template] │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Template List                         │ │ Template Editor                     │
│--------------------------------------│ │-------------------------------------│
│ Holiday Notice                        │ │ Template Name                       │
│ Fee Reminder                          │ │ [ Holiday Notice ]                  │
│ Exam Notice                           │ │                                     │
│ Parent Meeting                        │ │ Type                                │
│ Absence SMS                           │ │ [ Notice ▼ ]                        │
│ Receipt Footer                        │ │                                     │
│ Report Card Remarks                   │ │ Language                            │
│                                      │ │ [ English ▼ ]                       │
│                                      │ │                                     │
│                                      │ │ Body                                │
│                                      │ │ [ Dear Parents, ... ]               │
│                                      │ │                                     │
│                                      │ │ [Preview] [Save Template]           │
└──────────────────────────────────────┘ └─────────────────────────────────────┘
```

Notes:

- Templates should support Nepali and English where needed.
- Preview should use real placeholders and safe sample context.
- Template edits must not retroactively mutate already generated legal/financial documents unless a separate regeneration flow exists.

---

## 13. File and Document Settings

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ File & Document Settings                                                     │
│ Configure allowed files, required documents and protected file rules.         │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Required Student Documents            │ │ Upload Rules                        │
│--------------------------------------│ │-------------------------------------│
│ [✓] Birth Certificate                 │ │ Max File Size                       │
│ [✓] Transfer Certificate              │ │ [ 10 MB ]                           │
│ [✓] Previous Marksheet                │ │                                     │
│ [ ] Guardian ID                       │ │ Allowed Types                       │
│ [ ] Medical Document                  │ │ [ PDF, JPG, PNG ]                   │
│                                      │ │                                     │
│ [Add Custom Document]                 │ │ Protected Preview Required          │
│                                      │ │ [ Yes ▼ ]                           │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ File Access Rules                                                             │
│ [✓] Require authentication for file preview                                   │
│ [✓] Log protected file downloads                                              │
│ [✓] Block public direct file URLs                                             │
│ [✓] Restrict student files by role                                            │
│                                                                              │
│ [Save File Settings]                                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:

- File previews/downloads must go through protected endpoints.
- Public direct object storage URLs must not be exposed.
- File settings changes affect M1, M5, M6, M7, M10, reports, PDFs, and exports.

---

## 14. Security Settings

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Security Settings                                                            │
│ Manage login, password rules, sessions and sensitive action controls.         │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Login Security                        │ │ Session Rules                       │
│--------------------------------------│ │-------------------------------------│
│ Password minimum length               │ │ Session timeout                     │
│ [ 8 characters ]                      │ │ [ 8 hours ▼ ]                       │
│                                      │ │                                     │
│ Login throttling                      │ │ Remember device                     │
│ [ Enabled ▼ ]                         │ │ [ No ▼ ]                            │
│                                      │ │                                     │
│ Two-factor authentication later       │ │ Force logout all users              │
│ [ Disabled ]                          │ │ [Force Logout]                      │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Sensitive Action Rules                                                        │
│ [✓] Require reason for payment reversal                                       │
│ [✓] Require approval for payroll lock                                         │
│ [✓] Require confirmation for student transfer                                 │
│ [✓] Record audit log for all settings changes                                 │
│                                                                              │
│ [Save Security Settings]                                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:

- Do not store raw tokens in browser storage.
- Force logout and session changes must be audited.
- 2FA should remain inaccessible until implemented and validated.

---

## 15. Integrations Settings

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Integrations                                                                 │
│ Connect SMS, email, payment gateway, storage and external services.           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Integration Cards                                                             │
│                                                                              │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐  │
│ │ SMS Gateway           │ │ Email Service         │ │ Payment Gateway       │  │
│ │ Not Connected         │ │ Connected             │ │ Not Connected         │  │
│ │ [Configure]           │ │ [Manage]              │ │ [Configure]           │  │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘  │
│                                                                              │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐  │
│ │ Object Storage        │ │ Google Maps           │ │ Biometric Device      │  │
│ │ Connected             │ │ Not Connected         │ │ Later                 │  │
│ │ [Manage]              │ │ [Configure]           │ │ [Coming Soon]         │  │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:

- Secrets must be masked.
- Provider readiness checks should be explicit.
- Payment gateway integrations must not be enabled for financial actions until idempotency and reconciliation are verified.

---

## 16. Backup and Export Settings

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Backup & Export                                                              │
│ Export school data, download reports and manage backup rules.                │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│ Data Export                           │ │ Backup Status                       │
│--------------------------------------│ │-------------------------------------│
│ Export Type                           │ │ Last Backup                         │
│ [ Students ▼ ]                        │ │ 2082-03-01 11:00 PM                 │
│                                      │ │                                     │
│ Date Range                            │ │ Backup Health                       │
│ [ Start Date ] [ End Date ]           │ │ Healthy                             │
│                                      │ │                                     │
│ Format                                │ │ Backup Frequency                    │
│ [ CSV ▼ ]                             │ │ Daily                               │
│                                      │ │                                     │
│ [Generate Export]                     │ │ [View Backup Logs]                  │
└──────────────────────────────────────┘ └─────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Export History                                                                │
│------------------------------------------------------------------------------│
│ Export Name | Type | Created By | Created At | Status | Download             │
│------------------------------------------------------------------------------│
│ students-2082.csv | Students | Admin | Today | Ready | Download              │
│ fees-june.xlsx    | Fees     | Accountant | Yesterday | Ready | Download      │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:

- Backup restore is a high-risk platform/admin workflow and should not be casually exposed to school users.
- Exports must be scoped by tenant, permission, and purpose.
- Export files should use File Registry where retained.

---

## 17. Settings Audit Log

Every setting change should be auditable.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Settings Audit Log                                                           │
│ Track who changed settings, when, and what was changed.                       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ User ▼ | Setting Area ▼ | Date Range ▼ | Action ▼ | [Export Audit Log]       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ Audit Table                                                                   │
│------------------------------------------------------------------------------│
│ Time | User | Area | Action | Before | After | IP / Device                   │
│------------------------------------------------------------------------------│
│ 09:30 | Admin | Fee Settings | Updated receipt prefix | REC | HKA-REC | ...  │
│ 08:45 | Principal | Attendance | Changed lock time | 10:30 | 11:00 | ...     │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:

- Audit history must be filterable.
- Exporting audit logs should require permission.
- Before/after values should redact secrets and sensitive data.

---

## 18. Settings Component Plan

```text
components/settings/
  settings-workspace.tsx
  settings-sidebar.tsx
  settings-search.tsx
  settings-section-card.tsx

  school-profile-settings.tsx
  academic-year-settings.tsx
  class-section-settings.tsx
  users-settings.tsx
  roles-permissions-settings.tsx
  module-access-settings.tsx

  fee-settings.tsx
  attendance-settings.tsx
  exam-report-card-settings.tsx
  notification-settings.tsx
  template-settings.tsx
  file-document-settings.tsx
  security-settings.tsx
  integration-settings.tsx
  backup-export-settings.tsx
  settings-audit-log.tsx
```

Shared components used:

```text
ModuleHeader
KpiCard
DataTable
DetailDrawer
ConfirmDialog
StatusBadge
ProtectedFileButton
ProtectedFileLink
AuditTimeline
EmptyState
ErrorState
```

---

## Final Settings Layout Pattern

```text
SettingsWorkspace
  ModuleHeader
  SettingsSearch
  SettingsLayout
    SettingsSidebar
    SettingsContent
      SelectedSettingsPage
  SettingsAuditLog
```

Settings is a school-level configuration workspace. It should feel safe, simple, and understandable for school admins, while M0 Platform Core remains the SaaS/developer control plane.
