# M4 Academics, Exams, CAS, Report Cards — Frontend Design Reference

**Status:** Active module-level frontend design reference.  
**Updated:** 2026-06-19  
**Module:** M4 Academics, Exams, CAS, Report Cards  
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`  
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`

This document defines implementation-ready frontend design guidance and backend-alignment expectations for M4. Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Intent

M4 is the academic assessment and result-publishing workspace. It must support academic structures, subjects, marks, CAS/continuous assessment, exam terms, grade sheets, report cards, promotion workflows, and parent/student result visibility.

Core flow:

```text
Academic setup
-> subject / assessment configuration
-> marks or CAS entry
-> validation and review
-> grade sheet generation
-> report-card generation
-> approval / publish
-> parent/student visibility
-> promotion / academic lifecycle
```

---

## 2. Theme and Layout Alignment

Use the SchoolOS academic workbench rhythm:

```text
ModuleHeader
Academic year / term context
Class / section / subject filters
KPI or readiness strip
Main marks / exam / report workspace
Right validation rail
Protected report-card actions
Audit / publish timeline
```

Design rules:

- Keep marks entry dense but readable on laptop screens.
- Use sectioned tables with sticky student identifiers where possible.
- Use validation summaries before publish/generation.
- Report-card actions must feel controlled and auditable.
- Parent/student published views must be simple and non-administrative.

---

## 3. Personas and Scope

| Persona | Main job | Scope rule |
|---|---|---|
| Subject teacher | Enter marks/CAS for assigned subject. | Assigned class/section/subject only. |
| Class teacher | Review class academic readiness and remarks. | Assigned class/section only. |
| Exam coordinator | Manage terms, components, grade sheets, report cards. | Permission-gated. |
| Principal | Approve/publish results and review trends. | Summary and approval where permitted. |
| Parent | View linked child published report. | Linked-child only. |
| Student | View own published report where enabled. | Self only. |

---

## 4. Recommended Route Map

```text
/dashboard/academics
/dashboard/academics/subjects
/dashboard/academics/assessments
/dashboard/academics/exams
/dashboard/academics/exams/[examId]
/dashboard/academics/marks-entry
/dashboard/academics/cas
/dashboard/academics/grade-sheets
/dashboard/academics/report-cards
/dashboard/academics/report-cards/[reportCardId]
/dashboard/academics/promotion
/dashboard/academics/reports
/dashboard/academics/settings
/parent/results
/student/results
```

---

## 5. Required Screens

### 5.1 Academics Dashboard

- KPI cards: active exam terms, marks pending, validation errors, report cards generated, report cards published, promotion pending.
- Attention queue: missing marks, invalid marks, unapproved report cards, unpublished results, locked term warnings.
- Quick actions: Enter Marks, Review CAS, Generate Grade Sheet, Generate Report Cards, Publish Results.

### 5.2 Subject and Assessment Setup

- Subject table with class, section, teacher assignment, grading type, status.
- Assessment component builder: theory, practical, CAS, project, attendance, remarks where enabled.
- Validation before activation.

### 5.3 Marks Entry Workspace

Layout:

```text
Header: class / section / subject / exam term
Grid: students x components
Right rail: validation errors, missing marks, grading policy
Sticky footer: Save Draft / Submit for Review / Lock
```

Rules:

- Teacher cannot edit unassigned subject marks.
- Locked marks require correction workflow.
- Validation errors must be inline and summarized.
- Draft state can be shown only if backend persistence exists.

### 5.4 CAS / Continuous Assessment

- Component-based entry with rubric/status labels.
- Class progress view showing completed/pending students.
- Teacher remarks and class-teacher review where supported.

### 5.5 Grade Sheets and Report Cards

- Preview before generation.
- Generation status: queued, processing, completed, failed.
- Protected PDF view/download.
- Publish confirmation showing parent/student visibility impact.
- Regeneration must show versioning or correction impact where backend supports it.

### 5.6 Promotion Workflow

- Class/section readiness summary.
- Promotion candidates table with academic status, attendance warnings, fee clearance state where permitted, result status.
- Promote/hold/review actions with reason where required.

### 5.7 Parent / Student Results View

- Published-only report cards.
- Child/self-scoped view.
- Protected PDF download where enabled.
- No internal teacher validation notes or unpublished drafts.

---

## 6. Backend Alignment

Required backend capabilities:

```text
Academic year/term APIs
Subject and teacher assignment APIs
Assessment component policy APIs
Marks draft/save/submit APIs
Marks validation APIs
CAS/rubric APIs
Grade sheet generation jobs
Report-card PDF File Registry integration
Publish/unpublish workflow
Promotion workflow
Parent/student published result APIs
M12 result/exam notification events
Audit trail for marks, generation, publishing, and promotion
```

Backend ownership rules:

- Subject assignment scope is backend-owned.
- Marks validation is backend-owned.
- Report-card files use File Registry.
- Publish state controls parent/student visibility.
- Report-card generation is backend/job-owned.

---

## 7. Required States

```text
Loading
No exam term
Marks draft saved
Marks validation failed
Marks locked
Correction required
Grade sheet queued
Report card processing
Report card generated
Report card failed
Publish pending
Published
Unpublished
Permission denied
Module locked
Protected file unavailable
```

---

## 8. Implementation Checklist

```text
[ ] Reads main web design plan and design system.
[ ] Uses real academic/exam APIs only.
[ ] Teacher marks entry is assignment-scoped.
[ ] Marks validation is backend-driven.
[ ] Report-card generation uses job/protected file flow.
[ ] Publish workflow requires confirmation.
[ ] Parent/student views are published and child/self-scoped.
[ ] Promotion workflow requires backend readiness response.
[ ] M12 exam/result notifications are represented accurately.
[ ] No fake academic metrics remain.
```
