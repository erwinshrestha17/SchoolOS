# M1 Admissions and Student Profiles — Frontend Design Reference

**Status:** Active module-level frontend design reference.  
**Updated:** 2026-06-19  
**Module:** M1 Admissions and Student Profiles  
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`  
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`

This document translates the current SchoolOS web design rules into an implementation-ready M1 design plan. It is design guidance plus backend-alignment notes; backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Intent

M1 is the student lifecycle command center. It must handle admissions, student records, guardians, documents, duplicate review, ID/QR assets, transfer/withdrawal/graduation/alumni state, and IEMIS/readiness checks without becoming a generic student table.

Core flow:

```text
Inquiry / application
-> draft / document upload
-> duplicate review
-> approval / rejection
-> student profile creation
-> guardian linking
-> student lifecycle changes
-> protected document generation
-> reporting readiness
```

---

## 2. Theme and Layout Alignment

Follow the main SchoolOS web rhythm:

```text
ModuleHeader
Summary/KPI strip
Tabs
FilterBar
Main workspace
Right detail drawer or full detail page
Protected file actions
Audit/review timeline
```

Design rules:

- Use calm school-office copy, not technical CRM language.
- Keep one main job per screen: admit, review, manage profile, manage documents, or check readiness.
- Use neutral white cards on soft app background.
- Use clear lifecycle badges: Inquiry, Draft, Review, Approved, Rejected, Active, Transferred, Withdrawn, Graduated, Alumni, Archived.
- High-risk lifecycle actions require confirmation, reason, and audit state.
- Student photos/documents must use protected file components.

---

## 3. Personas and Scope

| Persona | Main job | Scope rule |
|---|---|---|
| Admission staff | Capture inquiries/applications and documents. | Tenant-scoped admission records only. |
| School admin | Approve, convert, manage profile and guardians. | Full M1 scope by permission. |
| Principal | Review admission pipeline and sensitive lifecycle decisions. | Summary plus approval where permitted. |
| Teacher | View assigned student profile summary only. | Assignment-scoped; no admission/private document depth unless allowed. |
| Parent/guardian | View linked child profile and documents where enabled. | Linked-child only. |

---

## 4. Recommended Route Map

```text
/dashboard/admissions
/dashboard/admissions/applications
/dashboard/admissions/applications/new
/dashboard/admissions/applications/[applicationId]
/dashboard/admissions/duplicate-review
/dashboard/students
/dashboard/students/[studentId]
/dashboard/students/[studentId]/guardians
/dashboard/students/[studentId]/documents
/dashboard/students/[studentId]/lifecycle
/dashboard/students/[studentId]/id-card
/dashboard/students/import-review
/dashboard/students/iemis-readiness
/parent/profile
```

Exact paths must follow existing route conventions. Missing route/API shapes must be marked `needs OpenAPI confirmation`.

---

## 5. Required Screens

### 5.1 Admissions Dashboard

- KPI cards: applications this month, pending review, duplicate warnings, missing documents, approved, rejected, converted to student.
- Pipeline columns: Inquiry, Draft, Submitted, Review, Approved, Rejected, Converted.
- Quick actions: New Application, Import Students, Review Duplicates, Export Readiness Issues.
- Right rail: selected application summary, guardian contact, missing fields, duplicate risk, latest audit.

### 5.2 Application Form / Draft

Sections:

```text
Student identity
Guardian details
Address
Previous school
Class/section request
Medical/emergency notes
Documents
Review notes
```

Design requirements:

- Sticky footer with Save Draft, Submit for Review, Cancel.
- Stepper or section navigation for long forms.
- Inline validation; no raw API errors.
- Document upload cards show required, uploaded, rejected, missing, unavailable states.
- Autosave can be shown only if backend draft persistence exists.

### 5.3 Duplicate Review

- Candidate comparison cards: Nepali/English names, DOB, guardian phone reuse, previous school, sibling clues.
- Show match reason, confidence label, and safe action: Merge/Link, Ignore with Reason, Needs Manual Review.
- Never auto-merge.

### 5.4 Student Profile

Profile layout:

```text
Left: photo, lifecycle badge, class/section/roll, guardian contacts
Main: personal, academic, medical, documents, activity, attendance/fee summary where permitted
Right rail: quick actions, alerts, audit timeline, protected documents
```

Actions:

- Edit Profile.
- Link/Remove Guardian.
- Generate ID Card.
- Generate Transfer Certificate.
- Change Lifecycle State.
- View File Registry Documents.

### 5.5 Guardian Management

- Guardian table with relationship, phone, email, portal status, linked children, access status.
- Removal must warn that file/profile/parent access will be revoked.
- Direct parent access must fail closed after unlink.

### 5.6 IEMIS / Reporting Readiness

- Readiness issue table: missing field, invalid format, mismatch, duplicate risk, unresolved guardian issue.
- Severity badges: Blocking, Warning, Info.
- Export only through protected report job where backend supports it.

---

## 6. Backend Alignment

Required backend capabilities:

```text
Application CRUD and draft persistence
Duplicate candidate API
Approval/rejection/conversion workflow
Student profile APIs
Guardian link/unlink APIs
Student document File Registry APIs
ID card / transfer certificate generation job
Import history and review queue
IEMIS readiness validation API
Audit trail for lifecycle and guardian changes
M12 notification events for admission approval/rejection and missing document reminders
```

Backend ownership rules:

- Duplicate scoring is backend-owned.
- Student lifecycle state is backend-owned.
- Guardian access revocation is backend-enforced.
- Protected files use File Registry.
- Parent/teacher scope is backend-enforced.

---

## 7. Required States

```text
Loading
Empty pipeline
No search results
Permission denied
Module locked
Draft saved
Draft save failed
Duplicate warning
Document missing
Document unavailable
Conversion blocked
Lifecycle change pending
Partial import success
Export queued
Export failed
```

---

## 8. Implementation Checklist

```text
[ ] Reads main web design plan and design system.
[ ] Uses real APIs only.
[ ] Application pipeline is server-backed.
[ ] Duplicate review uses backend candidate response.
[ ] Student profile uses protected image/document helpers.
[ ] Guardian removal revokes access and shows audit state.
[ ] Lifecycle actions require reason and confirmation.
[ ] Parent/teacher views are purpose-limited.
[ ] IEMIS readiness uses backend validation.
[ ] No fake student/application metrics remain.
```
