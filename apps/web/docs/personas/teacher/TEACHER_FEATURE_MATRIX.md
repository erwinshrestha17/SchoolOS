# SchoolOS Teacher Web Feature Matrix

**Purpose:** Current-versus-target Teacher web capability and route matrix  
**Scope:** Ordinary Teacher, Class Teacher, Subject Teacher, and delegated Teacher coordination  
**Date:** 2026-08-02

---

## 1. Access notation

| Code | Meaning |
|---|---|
| Full scoped | May operate inside an exact active assignment |
| Homeroom | Class Teacher authority for one assigned section |
| Subject | Subject Teacher authority for one class-section-subject |
| Self | Own account or employment record only |
| Read | Read-only assignment projection |
| Delegated | Available only through an explicit coordinator capability |
| Contextual | Alert or minimal safety context only |
| Hidden | No Teacher navigation, API, search, report, or file access |
| Enabled | Visible only when the school module entitlement is enabled |

---

## 2. Persona variants

| Variant | Source of authority | Key rights |
|---|---|---|
| Base Teacher | Active user + active Staff row + Teacher role | Account, schedule, notices, notifications, self-service |
| Class Teacher | `CLASS_TEACHER` assignment | Homeroom roster, homeroom attendance, cross-subject coordination, class tasks, remarks |
| Subject Teacher | `SUBJECT_TEACHER` assignment | Subject roster, homework, marks, CAS, subject activity, subject communication |
| Assistant Teacher | `ASSISTANT_TEACHER` assignment | Explicitly configured limited classroom support |
| Substitute Teacher | temporary assignment/delegation | Time-bounded roster, attendance, homework, or draft marks as granted |
| Coordinator Teacher | permission-derived capability | Timetable, substitutions, exams, moderation, notices, delivery, or Library admin |

---

## 3. Module feature matrix

## M0 — Account, security, and school context

| Feature | Current | Target | Access |
|---|---|---|---|
| Sign in/out | Available | Keep | Self |
| Password change/recovery | Available | Keep | Self |
| Own sessions | Available through personal security | Make prominent | Self |
| Revoke own sessions | Available | Keep | Self |
| Profile | Available | Keep | Self |
| Preferences | Available | Keep | Self |
| Notification preferences | Available | Keep | Self |
| School public information | Available through settings reads | Replace broad settings permission with purpose-limited endpoint | Read |
| Enabled Teacher modules | Entitlement-aware navigation | Keep | Read |
| User creation/reset for others | Hidden | Hidden | Hidden |
| Roles and permissions | Base role currently has `roles:read` | Remove from ordinary Teacher | Hidden / delegated settings only |
| School settings | Personal routes only in shell | Keep school settings hidden | Hidden |
| Platform | Hidden and route-isolated | Keep | Hidden |

## M1 — Assigned students

| Feature | Current | Target | Access |
|---|---|---|---|
| My Subject Students | Available | Keep and enrich | Subject |
| My Homeroom | Available conditionally | Promote to direct route | Homeroom |
| Search assigned roster | Available | Keep | Scoped |
| Attendance signal | Available | Keep | Scoped |
| Medical alert indicator | Redacted boolean | Keep | Scoped safety |
| Student detail | No dedicated Teacher page | Add | Scoped |
| Approved guardian contact | Not prominent in current roster | Add purpose-limited action | Scoped |
| Attendance history | Summary only | Add student drill-down | Scoped |
| Subject performance | Limited | Add | Subject |
| Homeroom cross-subject summary | Available read-only | Keep | Homeroom |
| Intervention/observation history | Fragmented | Add scoped timeline | Homeroom/owner |
| Printable class directory | Missing | Add | Scoped export |
| Admissions | Direct route restricted | Keep hidden | Hidden |
| Enrollment changes | Hidden | Keep | Hidden |
| Unassigned student search | Backend denied | Keep | Hidden |

## M2 — Attendance

| Feature | Current | Target | Access |
|---|---|---|---|
| Attendance landing page | Shared Admin-shaped overview | Replace with My Attendance | Scoped |
| Homeroom daily marking | Available through assigned form | Keep | Homeroom |
| Period attendance | Contract-dependent | Add only when enabled and assigned | Subject |
| Current-period shortcut | Today provides context | Add direct action | Scoped |
| Offline draft | Available | Keep | Scoped |
| Draft replay | Browser smoke exists | Keep and expand | Scoped |
| Assigned history | Register/report routes exist | Create Teacher projection | Scoped |
| Monthly register | Available | Scope to assigned classes | Scoped |
| Correction request | Components exist | Separate request/status from approval | Owner |
| Correction approval | Shared routes/components | Delegated/admin only | Delegated |
| Conflict review | Shared page mounts queue | Delegated only | Delegated |
| School anomalies | Advertised in shared header | Hide ordinary Teacher | Hidden/delegated |
| School follow-up queue | Advertised in shared header | Homeroom-only follow-up projection | Homeroom |
| Bulk operations | Advertised | Hide ordinary Teacher | Hidden/delegated |
| Policy settings | Advertised | Hide ordinary Teacher | Hidden |
| Assigned attendance reports | Generic reports route | Add Teacher report page | Scoped |

## M3 — Fees and receipts

| Feature | Current | Target | Access |
|---|---|---|---|
| Fees, balances, receipts | No nav; backend permissions absent | Keep hidden | Hidden |
| Office follow-up indicator | Not standardized | Optional non-financial flag only | Contextual |
| Payment details | Hidden | Hidden | Hidden |

## M4 — Academics, marks, CAS, results

| Feature | Current | Target | Access |
|---|---|---|---|
| Marks Entry | Available | Rename My Assessments & Marks | Subject |
| Marks grid | Available through AcademicsWorkspace | Keep | Subject/component |
| CAS | Available | Keep | Subject/component |
| Draft save | Available | Keep | Owner |
| Missing marks validation | Available | Keep | Subject |
| Submit marks | Available | Keep | Owner |
| Correction request | Available in workflow | Create explicit status page | Owner |
| Subject analytics | Available/partial | Make first-class page | Subject |
| Homeroom readiness | Available in Homeroom summary | Add dedicated view | Homeroom |
| Class Teacher remarks | Product requirement; scattered | Add explicit workflow | Homeroom |
| Cross-subject completion | Available read-only | Keep | Homeroom |
| Exam-term setup | Restricted route | Conditional delegated nav | Delegated |
| Assessment components | Restricted route | Conditional delegated nav | Delegated |
| Retest queue | Primary action leaks on Marks page | Hide unless delegated | Delegated |
| Mark locks | Restricted | Delegated only | Delegated |
| Result publication | Restricted | Hidden ordinary Teacher | Hidden/delegated |
| Report-card administration | Restricted | Hidden ordinary Teacher | Hidden/delegated |
| Published assigned results | Results read permission exists | Add scoped read-only view if educationally required | Scoped read |

## M5 — Activities, observations, and milestones

| Feature | Current | Target | Access |
|---|---|---|---|
| Assigned activity feed | Available | Keep | Scoped |
| Create activity | Available | Keep | Subject/homeroom |
| Own drafts | Available | Keep | Owner |
| Media upload/processing | Available | Keep with clear state | Owner |
| Consent visibility | Available | Strengthen evidence display | Scoped |
| Gallery | Available | Keep own/assigned media projection | Scoped |
| Observations | Route exists | Make Teacher-owned view | Scoped/owner |
| Milestones | Route exists | Keep supportive, non-diagnostic design | Scoped |
| Moderation | Restricted and delegated | Keep | Delegated |
| Delivery diagnostics | Restricted | Keep | Delegated |
| School-wide reports | Restricted | Keep | Delegated |

## M6 — Homework

| Feature | Current | Target | Access |
|---|---|---|---|
| Today homework | Available | Keep | Scoped |
| All homework | Available | Keep | Scoped |
| Create subject homework | Available | Keep | Subject |
| Create class task | Product requirement; verify implementation | Add explicit category and homeroom authority | Homeroom |
| Draft/publish/schedule | Available | Keep | Owner |
| Attachments | Available | Keep | Owner |
| Review submissions | Available | Keep | Subject |
| Feedback/resubmission | Available | Keep | Subject |
| Reminder | Available | Keep | Subject |
| Templates | Available | Keep | Owner |
| Completion analytics | Available | Keep | Scoped |
| Date filtering | Client cap of 100 | Replace with server filtering/pagination | Scoped |
| Another Teacher’s work | Scope/ownership protected | Keep read-only only when homeroom coordination permits | Hidden/edit denied |

## M6 — Timetable

| Feature | Current | Target | Access |
|---|---|---|---|
| My Schedule | Available | Keep | Self/assigned |
| Current and next period | Available Today | Integrate with schedule | Self |
| Assigned-class timetable | Available/partial | Add context view | Scoped |
| Room changes | Available in data | Make prominent | Self |
| Substitutions affecting me | Available Today | Add acknowledgement/status | Self |
| Exam duty | Product requirement | Add | Self |
| Builder | Restricted | Conditional coordination | Delegated |
| Versions/conflicts/workload | Restricted | Conditional coordination | Delegated |
| Substitute administration | Restricted | Conditional coordination | Delegated |

## M7 — Employee self-service

| Feature | Current | Target | Access |
|---|---|---|---|
| My Workspace overview | Available | Keep | Self |
| Employment profile | Available | Keep | Self |
| Employment timeline | Available | Keep | Self |
| My attendance | Tab | Add direct route | Self |
| Attendance correction | Available through component/workflow | Add direct action | Self |
| Leave request/history | Tab | Add direct route | Self |
| Leave balance | Available/partial | Make visible | Self |
| Payslips | Tab | Add direct route | Self |
| Contracts | Tab | Add direct route | Self |
| Masked bank details | Available when backend returns | Keep masked and permission-safe | Self |
| Qualifications/documents | Not clearly surfaced | Add | Self |
| Workload summary | Product requirement | Add | Self |
| Other staff | Broad role permission exists, but no nav | Remove broad permission | Hidden |
| Payroll runs | Restricted | Keep hidden | Hidden |

## M8 — Library

| Feature | Current | Target | Access |
|---|---|---|---|
| My loans | Available | Keep | Self |
| Due soon/overdue | Available | Keep | Self |
| Catalogue search | Available | Keep | Read |
| Reservations | Missing ordinary Teacher UI | Add request/status | Self |
| Renewal request | Missing | Add | Self |
| Own fines | Product requirement; not prominent | Add permitted summary | Self |
| Teaching-resource request | Missing | Add | Self |
| Reading lists | Missing | Add for assigned classes | Scoped |
| Catalogue/copy administration | Restricted | Conditional teacher-librarian | Delegated |
| Issue/return and fines | Restricted | Conditional teacher-librarian | Delegated |

## M9 — Transport

| Feature | Current | Target | Access |
|---|---|---|---|
| Transport workspace | Hidden | Keep hidden | Hidden |
| Assigned-student disruption alert | Notification-only | Add contextual deep link without route/GPS data | Contextual |
| Dismissal/boarding concern | Fragmented | Add safe notification/action | Contextual |
| GPS/routes/drivers | Hidden | Hidden | Hidden |

## M10 — Canteen

| Feature | Current | Target | Access |
|---|---|---|---|
| Canteen workspace | Hidden | Keep hidden | Hidden |
| Allergy/dietary safety alert | Contextual | Show only approved safety context | Contextual |
| Closure/service issue | Notification | Keep | Contextual |
| Wallet/POS/transactions | Hidden | Hidden | Hidden |

## M11 — Accounting

All accounting, journals, vouchers, reconciliation, cash, bank, ledger, reports, and audit are hidden and must remain backend-denied.

## M12 — Notifications

| Feature | Current | Target | Access |
|---|---|---|---|
| Own inbox | Available | Keep | Self |
| Unread count | Available | Keep | Self |
| Mark read | Available | Keep | Self |
| Preferences | Available | Keep | Self |
| Deep links | Available/partial | Standardize safe assignment-aware links | Self |
| Delivery status for own notice | Available when permitted | Keep | Owner |
| Tenant-wide diagnostics | Restricted | Delegated only | Delegated |
| Provider settings | Hidden | Hidden | Hidden |

## M13 — Learning

| Feature | Current | Target | Access |
|---|---|---|---|
| Learning nav | Entitlement-gated | Keep hidden when disabled | Enabled |
| Create assigned activity | Available permission | Keep assignment-scoped | Subject |
| Resources | Available | Keep | Owner/scoped |
| Launch session | Available | Keep | Owner/scoped |
| Attempts/progress | Available | Keep assigned only | Scoped |
| Update own activity | Available | Keep | Owner |
| Broad delete | Base role includes | Replace with lifecycle/ownership action | Owner/workflow |
| School-wide learning administration | No ordinary Teacher nav | Keep delegated/admin only | Hidden |

## M15 — Notices

| Feature | Current | Target | Access |
|---|---|---|---|
| Received notices | Available | Keep | Self |
| Urgent unread | Available | Keep | Self |
| Protected attachments | Available | Keep | Self |
| Acknowledgement | Available | Keep | Self |
| Draft class/subject notice | Available where `notices:create` granted | Make assignment type explicit | Scoped |
| Recipient preview | Available | Keep | Scoped |
| Submit for approval | Available through lifecycle | Make status visible | Owner |
| Whole-school audience | Capability restricted in composer | Keep | Delegated |
| Publish/schedule/approve | Restricted | Delegated only | Delegated |
| Delivery logs/failures | Restricted | Delegated only | Delegated |
| Open chat | Removed | Do not label navigation as Messages | Hidden |

---

## 4. Current route matrix

| Route | Current Teacher behavior | Target behavior |
|---|---|---|
| `/dashboard` | Teacher Today | Keep; expand priority queue |
| `/dashboard/timetable` | My Schedule for ordinary Teacher | Keep |
| `/dashboard/my-students` | Subject/Homeroom tabs | Split into direct Teacher routes while keeping combined entry |
| `/dashboard/attendance` | Shared Smart Attendance overview | Replace with Teacher Attendance overview |
| `/dashboard/attendance/mark` | Assigned marking form | Keep |
| `/dashboard/attendance/register/monthly` | Shared register | Teacher-assigned register |
| `/dashboard/attendance/corrections` | Shared correction queue semantics | My correction requests/status |
| `/dashboard/attendance/reports` | Shared reports | Assigned reports |
| `/dashboard/attendance/anomalies` | Shared/admin destination | Redirect ordinary Teacher; delegated only |
| `/dashboard/attendance/follow-ups` | Shared queue | Homeroom projection or delegated only |
| `/dashboard/homework` | Assignment-aware shared workspace | Keep and refine |
| `/dashboard/academics/marks` | Marks page with leaked Retest action | Teacher marks landing with capability-aware actions |
| `/dashboard/academics/cas` | Shared scoped workspace | Keep Teacher projection |
| `/dashboard/academics/exam-terms` | Redirect unless delegated | Keep conditional |
| `/dashboard/academics/retakes` | Redirect unless delegated | Hide ordinary Teacher action |
| `/dashboard/academics/results` | Tab filtered depending restriction rules | Provide scoped read-only results only if required |
| `/dashboard/activity` | Assignment-aware feed | Keep |
| `/dashboard/activity/moderation` | Redirect unless delegated | Keep conditional |
| `/dashboard/notices` | Teacher-safe inbox/notice list | Refine views |
| `/dashboard/notices/new` | Teacher-aware composer | Keep |
| `/dashboard/notifications` | Own inbox | Keep |
| `/dashboard/library` | Teacher borrower workspace | Expand |
| `/dashboard/learning` | Entitlement/capability gated | Keep only when enabled |
| `/dashboard/my-workspace` | Tabbed employee self-service | Keep overview; add direct child routes |
| `/dashboard/reports` | Redirect unless delegated academic admin | Replace ordinary Teacher need with `/dashboard/class-reports` |
| `/dashboard/settings/*` | Personal routes allowed; school settings restricted | Keep |
| `/dashboard/students` | Redirect to My Students | Keep |
| `/dashboard/admissions` | Redirect to My Students | Keep |
| `/dashboard/hr` | Redirect to My Workspace | Keep |
| `/dashboard/payroll` | Redirect to My Workspace | Keep |
| `/dashboard/fees` | Permission denied | Keep hidden/denied |
| `/dashboard/accounting` | Permission denied | Keep hidden/denied |
| `/platform/*` | Platform layout denies | Keep hidden/denied |

---

## 5. Target route catalogue

### Today and schedule

- `/dashboard`
- `/dashboard/my-schedule`
- `/dashboard/my-schedule/exam-duty`
- `/dashboard/my-schedule/substitutions`

### Teaching context

- `/dashboard/my-homeroom`
- `/dashboard/my-subjects`
- `/dashboard/my-students`
- `/dashboard/my-students/[studentId]`

### Attendance

- `/dashboard/attendance`
- `/dashboard/attendance/mark`
- `/dashboard/attendance/period/[periodId]`
- `/dashboard/attendance/history`
- `/dashboard/attendance/register/monthly`
- `/dashboard/attendance/corrections`
- `/dashboard/attendance/corrections/new`
- `/dashboard/attendance/reports`

### Homework

- `/dashboard/homework`
- `/dashboard/homework/new`
- `/dashboard/homework/[homeworkId]`
- `/dashboard/homework/[homeworkId]/submissions`
- `/dashboard/homework/templates`
- `/dashboard/homework/completion`

### Assessments and marks

- `/dashboard/assessments`
- `/dashboard/assessments/[assessmentId]`
- `/dashboard/academics/marks`
- `/dashboard/academics/cas`
- `/dashboard/academics/submissions`
- `/dashboard/academics/corrections`
- `/dashboard/academics/subject-performance`
- `/dashboard/academics/homeroom-readiness`

### Activities

- `/dashboard/activity`
- `/dashboard/activity/new`
- `/dashboard/activity/[activityId]`
- `/dashboard/activity/gallery`
- `/dashboard/activity/observations`
- `/dashboard/activity/milestones`

### Communication

- `/dashboard/notices`
- `/dashboard/notices/new`
- `/dashboard/notices/[noticeId]`
- `/dashboard/notifications`

### Class reports

- `/dashboard/class-reports`
- `/dashboard/class-reports/attendance`
- `/dashboard/class-reports/homework`
- `/dashboard/class-reports/subject-performance`
- `/dashboard/class-reports/marks-completion`
- `/dashboard/class-reports/interventions`
- `/dashboard/class-reports/activity`
- `/dashboard/class-reports/acknowledgements`

### Resources and self-service

- `/dashboard/library`
- `/dashboard/library/reading-lists`
- `/dashboard/learning` when enabled
- `/dashboard/my-workspace`
- `/dashboard/my-workspace/attendance`
- `/dashboard/my-workspace/leave`
- `/dashboard/my-workspace/payslips`
- `/dashboard/my-workspace/contracts`
- `/dashboard/my-workspace/documents`
- personal profile, preferences, and security routes

### Coordination, only when delegated

- `/dashboard/coordination`
- existing timetable builder/substitution routes
- exam term routes
- activity moderation routes
- library administration routes
- notice administration and delivery routes

---

## 6. Forbidden route matrix for ordinary Teachers

| Domain | Forbidden examples |
|---|---|
| Admissions | `/dashboard/admissions/*` |
| School student admin | `/dashboard/students/*` except Teacher-specific projection routes |
| Fees | `/dashboard/fees/*`, `/dashboard/finance/*` |
| Accounting | `/dashboard/accounting/*` |
| HR admin | `/dashboard/hr/*`, `/dashboard/staff/*` |
| Payroll admin | `/dashboard/payroll/runs`, readiness, reports, postings |
| School settings | non-personal `/dashboard/settings/*` |
| School reports | generic `/dashboard/reports` |
| Attendance admin | anomalies, lock override, school correction review, global follow-up |
| Academics admin | exam setup, grade policy, publishing, locks, promotion, retakes unless delegated |
| Activity admin | moderation, reports, delivery diagnostics unless delegated |
| Library admin | catalog/copies/issues/borrowers/fines/reports unless delegated |
| Transport | all operational routes |
| Canteen | all operational routes |
| Platform | `/platform/*` |

---

## 7. Target navigation

```text
Today
  Today
  My Schedule

My Teaching
  My Homeroom                 [Class Teacher]
  My Subjects
  My Students
  Attendance
  Homework
  Assessments & Marks
  Activities
  Class Reports

Communication
  Notices
  Notifications

Resources
  Library                     [enabled]
  Learning                    [enabled]

My Workspace
  Overview
  My Attendance
  Leave
  Payslips
  Contracts & Documents
  Profile
  Preferences
  Security

Coordination                  [delegated only]
  Overview
  Timetable Builder
  Substitutions
  Exam Terms
  Activity Moderation
  Library Desk
```

---

## 8. Final rule

```text
Every visible Teacher feature must answer four questions:

1. Which active assignment authorizes this data?
2. What may this Teacher do in this workflow state?
3. Is the record owned by this Teacher or merely visible for coordination?
4. What happens immediately when the assignment or delegation ends?
```
