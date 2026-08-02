# SchoolOS Principal Web Design Specification

**Status:** Target design specification  
**Audience:** Product design, frontend, backend, QA, security, and school leadership reviewers  
**Scope:** Principal persona on SchoolOS web  
**Roadmap boundary:** Nepal-scoped; P0/P1 surfaces only; M8 Library, M9 Transport, M10 Canteen, M13 Learning, and open chat are excluded from the active design scope

---

## 1. Design objective

The Principal web experience is the school leadership command centre.

It must help a Principal answer, within ten seconds:

```text
1. What is at risk today?
2. Which decisions are waiting for me?
3. Is the school ready academically, operationally, and financially?
4. Where should I intervene without taking over another person's job?
```

The experience must not become:

- A duplicate Admin workspace.
- An Accountant console.
- An HR operations desk.
- A marks-entry or attendance-marking tool.
- A wall of decorative KPIs.
- A collection of shortcuts into unsafe operational pages.

The defining interaction pattern is:

```text
Observe → understand impact → inspect evidence → decide or escalate
```

not:

```text
Create → configure → bulk edit → operate
```

---

## 2. Principal design principles

### 2.1 Leadership-first composition

Every Principal page must be composed around one of four leadership jobs:

1. **Attention** — identify risk, delay, exception, or missing work.
2. **Approval** — make a controlled decision with evidence and reason.
3. **Readiness** — determine whether a school process can proceed safely.
4. **Evidence** — review reports, trends, and high-risk audit history.

### 2.2 Decision before detail

The default view shows the decision-relevant summary. Detailed records appear only after the Principal chooses to inspect an item.

Use this hierarchy:

```text
Critical interruption
→ Approval waiting
→ Warning / overdue work
→ Readiness status
→ Trend or comparison
→ Detailed evidence
```

### 2.3 Oversight is not operational authority

A Principal may be separately delegated an operational capability, but the Principal persona itself must not imply it.

Default Principal pages must not expose:

- New admission creation.
- Student record editing.
- Attendance marking.
- Marks entry.
- Exam configuration.
- Staff creation.
- Payroll processing.
- Journal or voucher entry.
- Payment collection.
- Provider or school configuration.

### 2.4 Backend-owned truth

All summaries, percentages, money, readiness states, risk counts, and approval queues must come from bounded, tenant-scoped backend contracts.

The browser must never calculate an official total from an incomplete list.

Use explicit states:

```text
Loading
Ready
Partial
Unavailable
Permission restricted
Module not enabled
Stale
```

Never render unavailable data as `0`.

### 2.5 One screen, one main job

A page may contain supporting evidence, but it must have one primary purpose.

Examples:

- Executive Dashboard: prioritize the day.
- Approval Centre: decide requests.
- Attendance Oversight: resolve attendance risk.
- Finance Overview: understand financial position and exceptions.
- Leadership Audit: investigate high-risk changes.

---

## 3. Global Principal information architecture

```text
Leadership
  Executive Dashboard
  Attention Centre
  Approval Centre

Students
  Enrollment Overview
  Admissions Overview

School Readiness
  Attendance Oversight
  Academic Readiness
  Staff Overview
  Finance Overview

Communication
  Notices
  Activity Oversight
  Notifications

Evidence
  Reports
  Leadership Audit
```

Personal profile, notification preferences, security, devices, sessions, and sign-out remain in the top-right user menu.

### Excluded from active navigation

```text
Library
Transport
Canteen
Learning Layer
Open chat / conversations
School configuration
Platform operations
```

---

## 4. Global web shell

### 4.1 Desktop shell

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Topbar: school | academic year | search | notifications | user menu    │
├───────────────┬─────────────────────────────────────────────────────────┤
│ Principal     │ Page header                                             │
│ navigation    │ Context / period controls                               │
│ 264px         │ Summary / status strip                                  │
│               │ Main leadership workspace                              │
│               │ Optional evidence drawer                               │
└───────────────┴─────────────────────────────────────────────────────────┘
```

- Expanded sidebar: 264px.
- Collapsed sidebar: 72px.
- Main content: fluid, maximum approximately 1440px.
- Page gutter: 24px on standard laptops; 32px on wide desktop.
- Major vertical rhythm: 24px.
- Keep the first meaningful decision content visible on a 1366 × 768 laptop.

### 4.2 Topbar

The topbar contains global context only:

- School identity.
- School switcher only when the user has multiple authorized school contexts.
- Academic year selector when the page depends on an academic year.
- Global search.
- Notification bell.
- User profile menu.
- Support-override banner only when an audited override is active.

Do not place page actions in the topbar.

### 4.3 Page header

Use `ModuleHeader` or a Principal-compatible extension.

Required anatomy:

```text
Eyebrow / domain
Page title
One-sentence purpose
Context metadata: selected day/period, status, last updated
Primary action: one safe leadership action, or none
More Actions: secondary navigation / export / history
```

Examples of valid Principal primary actions:

- Review 4 approvals.
- Open highest-risk item.
- Publish approved results.
- Approve a critical notice.
- Download an approved report.

Invalid default actions:

- Add student.
- Mark attendance.
- Enter marks.
- Add staff.
- Create journal.

### 4.4 Context controls

Use a compact context bar below the header where relevant:

- Academic year.
- Term or exam term.
- Date or BS month.
- Branch when multi-branch support is active.
- Grade / class / section for drill-down.

Context controls must update URL state when the view is shareable.

### 4.5 Evidence drawer

Use a right-side drawer for record-level inspection when the user should remain anchored in a queue.

Drawer width:

- 480–560px desktop.
- Full-screen sheet below 1024px.

Drawer anatomy:

```text
Title and status
Impact summary
Submitted by / source / time
Evidence and comparison
Audit history
Decision or escalation controls
```

---

## 5. Principal component language

### 5.1 Leadership KPI strip

Use 3–5 cards maximum.

Every KPI must be:

- Backend-owned.
- Time-bound.
- Permission-filtered.
- Actionable.
- Honest about partial or unavailable data.

Preferred card anatomy:

```text
Icon + label
Large value or readiness state
One-line interpretation
Drill-through indicator
```

Use counts only when the count changes a decision.

### 5.2 Attention row

```text
Severity rail | module icon | issue title | impact | age/SLA | owner | action
```

- Critical: danger semantic treatment.
- High: warning treatment.
- Normal follow-up: information treatment.
- Resolved: neutral/success only in history views.

Module colour identifies source; semantic colour identifies risk.

### 5.3 Approval row

```text
Approval type
Requested change / decision
Scope and impact
Requester
Age
Current step
Evidence completeness
Open review
```

Do not put Approve / Reject directly in a dense table unless the decision is low-risk and reversible. High-risk decisions open a review panel.

### 5.4 Readiness matrix

Use rows for required conditions and columns for status, owner, due date, and next action.

```text
Requirement | Status | Owner | Due / age | Evidence | Action
```

### 5.5 Trend panels

Use trends only where comparison supports intervention.

Good examples:

- Attendance completion over 30 school days.
- Repeated absence by grade.
- Marks submission progress by class.
- Fee collection rate and aging movement.
- Staff absence or leave coverage.

Avoid decorative pie charts with no action.

---

# 6. Page-by-page design

## Page 1 — Executive Dashboard

### Route

`/dashboard`

### Main job

Prioritize the Principal's day and expose only the most important school-wide decisions, risks, and readiness signals.

### Header

- Eyebrow: `Executive oversight`
- Title: `Executive Dashboard`
- Description: `Critical decisions, school readiness, and exceptions requiring leadership attention.`
- Metadata:
  - School day.
  - Overall data status.
  - Last updated.
- Primary action:
  - `Review X attention items` when open items exist.
  - Otherwise the highest-priority allowed next action.

### Summary strip

Recommended cards:

1. **Attendance completion** — submitted / expected registers.
2. **Academic blockers** — classes or result workflows not ready.
3. **Finance exceptions** — reconciliation, overdue, or high-risk approval categories; not an accountant transaction total.
4. **Staff coverage** — present, approved leave, and uncovered critical roles.
5. **Needs attention** — count of decision queues, not total underlying records.

On a 1366px laptop, show four cards and move the fifth into the first main panel or second row.

### Main layout

Desktop:

```text
8 columns: Needs your attention
4 columns: Approvals waiting

8 columns: School readiness
4 columns: Today's operating status

8 columns: Trend / comparison selected by risk
4 columns: Recent school activity
```

### Needs your attention

Show up to five severity-ordered items.

Each row contains:

- Module.
- Issue.
- Impact count or scope.
- Severity.
- Age.
- `Review`.

Footer: `Open Attention Centre`.

### Approvals waiting

Show up to four items grouped by deadline.

- Approval type.
- Requester.
- Scope.
- Age.
- Open review.

Never merge all pending records into a misleading single number.

### School readiness

Three leadership domains:

- Academic readiness.
- Financial readiness.
- People operations readiness.

Each domain displays:

- Status: Ready / At risk / Blocked / Unavailable.
- Two key blockers.
- Owner.
- Link to focused page.

### Today's operating status

Compact rows for:

- Attendance.
- Communications.
- Academics.
- Finance exceptions.
- Staff coverage.

### Forbidden content

- Operational quick-action grid.
- Create Student.
- Mark Attendance.
- Enter Marks.
- Add Staff.
- Create Voucher.
- Deferred module summaries.

### States

- Loading: preserve header and render skeletons matching each panel.
- Partial: panel-level unavailable message; retain successful domains.
- Empty: `All clear` with last updated time and next scheduled review.
- Projection mismatch: explicit safe failure and re-authentication guidance.

---

## Page 2 — Attention Centre

### Route

`/dashboard/attention`

### Main job

Provide a durable, filterable queue of school-wide risks and follow-ups that the Principal is authorized to review.

### Header

- Eyebrow: `Leadership`
- Title: `Attention Centre`
- Description: `Review school-wide exceptions, overdue work, and risks requiring leadership intervention.`
- Primary action: `Open highest-risk item`.
- More Actions:
  - Export current queue when permitted.
  - View resolved history.
  - Refresh.

### KPI strip

- Critical.
- Approval-related.
- Overdue.
- Due today.
- Unassigned owner.

### Filter bar

- Severity.
- Module.
- Category.
- Age / SLA.
- Owner.
- Status.
- Search.

Filters are URL-backed.

### Main layout

```text
Left 7/12: queue table or dense list
Right 5/12: selected-item evidence panel
```

Queue columns:

- Severity.
- Issue.
- Module.
- Impact.
- Owner.
- Age.
- Status.

### Selected-item panel

- Plain-language explanation.
- Why it matters.
- Affected scope.
- Current owner.
- Related evidence.
- Last activity.
- Safe actions:
  - Open source workspace.
  - Assign/escalate when authorized.
  - Acknowledge only when acknowledgement is meaningful.

Do not let “acknowledge” hide or resolve an unresolved backend problem.

### Empty state

`No open attention items match the selected filters.`

Offer `Reset filters`, not a create action.

---

## Page 3 — Approval Centre

### Route

`/dashboard/approvals`

### Main job

Make designated cross-module decisions with complete evidence, explicit impact, and an immutable reason.

### Header

- Eyebrow: `Leadership decisions`
- Title: `Approval Centre`
- Description: `Review requests that require your designated approval before the school can proceed.`
- Primary action: `Review oldest urgent approval`.
- More Actions:
  - Approval history.
  - Delegation status, read-only.
  - Export approval log.

### Summary strip

- Urgent.
- Due today.
- Awaiting evidence.
- Older than SLA.

### Tabs

- All.
- Attendance.
- Academics.
- Admissions.
- Staff.
- Notices.
- Finance, only when delegated.

### Queue + decision panel

Desktop uses split view.

Decision panel sections:

1. Request summary.
2. Impact and affected records.
3. Before / requested-after comparison.
4. Evidence attachments.
5. Prior approvals and comments.
6. Policy or permission note.
7. Decision controls.

### Decision controls

- Approve.
- Reject.
- Return for correction.

Every decision requires:

- Confirmation.
- Reason or comment according to policy.
- Pending state.
- Success state.
- Error state that preserves the draft reason.
- Refetch after completion.

High-risk decisions require step-up authentication when backend policy supports it.

### Prohibited patterns

- One-click approve from dashboard KPI.
- Approving several unrelated high-risk requests in bulk.
- Showing an Approve button without evidence completeness.
- Silent self-approval.

---

## Page 4 — Enrollment Overview

### Route

Recommended: `/dashboard/students/overview`

During migration, `/dashboard/students` may render the Principal composition.

### Main job

Understand current enrollment, capacity, student-data quality, and lifecycle exceptions without editing routine student records.

### Header

- Eyebrow: `Students`
- Title: `Enrollment Overview`
- Description: `Review enrollment, capacity, student-data quality, and lifecycle exceptions.`
- Primary action: `Review student exceptions` when open.
- More Actions:
  - Open read-only student directory.
  - Enrollment report.
  - Data-quality report.
  - iEMIS readiness summary, not direct export by default.

### Summary strip

- Active students.
- Capacity utilization.
- Missing required information.
- Transfer / withdrawal decisions pending.
- Duplicate candidates requiring escalation.

### Main sections

1. Enrollment by grade and section.
2. Capacity pressure.
3. Student-data quality queue.
4. Lifecycle decisions.
5. Recent enrollment changes.

### Directory behavior

Read-only directory fields:

- Student name / identifier.
- Grade, class, section.
- Enrollment status.
- Guardian verification indicator.
- Data completeness indicator.
- Safety restriction indicator without revealing restricted details in the list.

Clicking a row opens a purpose-limited profile summary.

### Forbidden actions

- New admission.
- Edit student identity.
- Change class / section.
- Link or revoke guardian.
- Generate IDs in bulk.
- Export unrestricted student data.

---

## Page 5 — Admissions Overview

### Route

Recommended: `/dashboard/admissions/overview`

During migration, `/dashboard/admissions` may render the Principal composition.

### Main job

Monitor admission demand, capacity, waitlist, sensitive exceptions, and final leadership decisions.

### Header

- Eyebrow: `Students`
- Title: `Admissions Overview`
- Description: `Monitor the admission funnel, capacity, waitlist, and cases requiring leadership review.`
- Primary action: `Review admission decisions` when applicable.
- More Actions:
  - Admission funnel report.
  - Capacity report.
  - View policy, read-only.

### Summary strip

- Applications in progress.
- Waiting for review.
- Ready for decision.
- Waitlisted.
- Capacity exceptions.

### Main layout

- Funnel visualization: inquiry → application → review → assessment → decision → enrollment.
- Capacity by grade / section.
- Leadership decision queue.
- Waitlist age and priority policy.
- Sensitive exception summary.

### Decision detail

Show:

- Applicant summary.
- Grade requested.
- Capacity context.
- Review notes.
- Documents completeness.
- Assessment outcome where policy permits.
- Conflict / duplicate warning.
- Decision history.

### Forbidden actions

- Create routine application.
- Upload documents on behalf of operations staff.
- Schedule routine interviews.
- Merge duplicate students.
- Directly change official enrollment without workflow.

---

## Page 6 — Attendance Oversight

### Route

Recommended: `/dashboard/attendance/overview`

During migration, `/dashboard/attendance` renders the Principal composition.

### Main job

Identify missing submissions, attendance anomalies, safety exceptions, and correction decisions.

### Header

- Eyebrow: `School readiness`
- Title: `Attendance Oversight`
- Description: `Monitor attendance completion, anomalies, repeated absence, and correction decisions.`
- Primary action: `Review pending corrections` when present.
- More Actions:
  - Monthly register.
  - Attendance report.
  - Submission compliance.
  - Anomaly methodology.

### Summary strip

- Registers submitted.
- Classes not submitted.
- Students absent today.
- Repeated absence / late alerts.
- Corrections awaiting decision.

### Main sections

1. **Submission status matrix** — grade / class / section, teacher, expected time, status.
2. **At-risk students** — repeated absence or lateness, trend, assigned follow-up owner.
3. **Correction queue** — original, requested, reason, age.
4. **Safety exceptions** — early departure, unauthorized release attempt, unresolved attendance conflict where supported.
5. **30-day trend** — completion, absence, lateness.

### Safe actions

- Open correction review.
- Escalate missing submission.
- View finalized register.
- Download permitted report.

### Forbidden actions

- Mark Attendance.
- Edit register directly.
- Open offline drafts.
- Bulk mark classes.
- Change attendance policy.

---

## Page 7 — Academic Readiness

### Route

Recommended: `/dashboard/academics/readiness`

### Main job

Determine whether examinations, marks, results, promotion, and report-card publication are ready to proceed.

### Header

- Eyebrow: `School readiness`
- Title: `Academic Readiness`
- Description: `Review marks completion, result readiness, publication blockers, and academic decisions.`
- Context:
  - Academic year.
  - Exam term.
- Primary action: `Review publication decisions` when applicable.
- More Actions:
  - Performance report.
  - Marks submission report.
  - Report-card job history.
  - Promotion readiness report.

### Summary strip

- Marks sheets complete.
- Missing submissions.
- Returned / correction items.
- Results ready for approval.
- Report cards blocked or failed.

### Main sections

1. Readiness by class / grade.
2. Missing marks and delayed submissions.
3. Marks unlock / correction queue.
4. Result approval and publication queue.
5. Report-card generation status.
6. Promotion review.
7. Performance and outlier trends.

### Readiness row

```text
Class | Subjects complete | Missing | Returned | Result status | Owner | Action
```

### Safe actions

- Review result.
- Approve publication.
- Return for correction.
- Approve controlled unlock.
- Approve withdrawal / republication.
- Review promotion recommendation.

### Forbidden actions

- Create exam term.
- Configure assessment components.
- Enter or overwrite marks.
- Edit teacher-owned marks directly.
- Calculate official results in browser.

---

## Page 8 — Staff Overview

### Route

Recommended: `/dashboard/hr/overview`

### Main job

Understand workforce availability, leave impact, contract risk, vacancies, and designated staff approvals.

### Header

- Eyebrow: `School readiness`
- Title: `Staff Overview`
- Description: `Review staff coverage, leave impact, contract risk, and workforce readiness.`
- Primary action: `Review staff approvals` when present.
- More Actions:
  - Staff coverage report.
  - Contract expiry report.
  - Attendance trend.
  - Payroll readiness, only when authorized.

### Summary strip

- Active staff.
- Present today.
- On approved leave.
- Critical coverage gaps.
- Contracts expiring.

### Main sections

1. Today’s coverage by department / grade / function.
2. Pending leave decisions.
3. Contract and probation reminders.
4. Vacancies and staffing gaps.
5. Staff attendance anomalies.
6. Payroll readiness status, read-only and permission-gated.

### Privacy

The overview must not display:

- Salary details.
- Bank information.
- Medical information.
- Disciplinary details.
- Unrelated HR documents.

### Forbidden actions

- Add Staff.
- Edit employment records.
- Configure salary structures.
- Run payroll.
- Generate or view all payslips by default.

---

## Page 9 — Finance Overview

### Route

Recommended: `/dashboard/finance-overview`

Do not use the Accountant’s operational `/dashboard/accounting` page as the Principal landing page.

### Main job

Understand the school’s financial position, collection performance, cash and bank position, and significant exceptions without performing accounting operations.

### Header

- Eyebrow: `School readiness`
- Title: `Finance Overview`
- Description: `Review collection performance, financial position, and exceptions requiring leadership attention.`
- Context:
  - Fiscal year.
  - Period.
- Primary action: `Review financial approvals` only when delegated.
- More Actions:
  - Income and expenditure statement.
  - Balance sheet.
  - Cash-flow report.
  - Receivables aging.
  - Audit exceptions.

### Summary strip

- Collection rate for selected period.
- Outstanding receivables.
- Cash and bank position.
- Unreconciled amount / exception count.
- Budget variance when implemented.

Money visibility must be permission-scoped.

### Main sections

1. Collection and receivables trend.
2. Aging distribution.
3. Income versus expenditure.
4. Cash and bank overview.
5. Reconciliation exceptions.
6. Large or unusual adjustments awaiting leadership review.
7. Financial statement shortcuts.
8. Source-module posting health.

### Safe drill-down

```text
Summary
→ report line
→ account balance
→ ledger evidence, read-only
→ source transaction
→ approval and document
```

### Forbidden actions

- New journal or voucher.
- Chart of accounts editing.
- Fiscal configuration.
- Bank reconciliation editing.
- Source mapping changes.
- Payment collection.
- Refund or reversal execution unless explicitly delegated through an approval workflow.

---

## Page 10 — Notices and Critical Communication

### Route

`/dashboard/notices`

### Main job

Govern high-impact school communication, approval, reach, acknowledgement, correction, and withdrawal.

### Header

- Eyebrow: `Communication`
- Title: `Notices`
- Description: `Review official notices, critical delivery, acknowledgement, and high-impact communication decisions.`
- Primary action:
  - `Review notice approvals` when pending.
  - `Create leadership notice` only when the Principal has explicit create permission and no approval is waiting.
- More Actions:
  - Scheduled notices.
  - Delivery failures.
  - Acknowledgement report.
  - Notice history.

### Summary strip

- Awaiting approval.
- Scheduled critical notices.
- Failed deliveries.
- Acknowledgements overdue.
- Corrected / withdrawn notices in current period.

### Main sections

1. Approval queue.
2. Active critical notices.
3. Delivery and acknowledgement status.
4. Failed delivery / escalation queue.
5. Correction, replacement, and withdrawal history.

### Approval detail

Show exact audience preview and impact before approval.

Required evidence:

- Category and priority.
- Author.
- Exact audience summary.
- Attachment list.
- Schedule.
- Acknowledgement requirement.
- Previous version where corrected.

---

## Page 11 — Activity Oversight

### Route

Recommended: `/dashboard/activity/oversight`

### Main job

Monitor consent-aware school activity publishing, moderation, reported content, and parent-facing communication quality.

### Header

- Eyebrow: `Communication`
- Title: `Activity Oversight`
- Description: `Review sensitive activity content, consent exceptions, moderation, and participation trends.`
- Primary action: `Review moderation queue` when pending.
- More Actions:
  - Reported content.
  - Consent exceptions.
  - Activity report.
  - Protected gallery, read-only.

### Summary strip

- Pending moderation.
- Consent blocked.
- Reported content.
- Failed media processing.
- Parent delivery issues.

### Main sections

1. Sensitive / reported content queue.
2. Consent exception queue.
3. Moderation decisions.
4. Participation by grade / class.
5. Publication and delivery trends.
6. Recent school activity, read-only.

### Forbidden actions

- `Create Activity` as the default primary action.
- Edit teacher-owned routine content without a controlled correction workflow.
- Browse unrestricted child media.

---

## Page 12 — Notifications

### Route

`/dashboard/notifications`

### Main job

Manage the Principal’s own notifications and act on safe deep links.

### Header

- Eyebrow: `Communication`
- Title: `Notifications`
- Description: `Review your school alerts, approvals, failures, and reminders.`
- Primary action: `Mark visible as read` only when useful.
- More Actions:
  - Notification preferences.
  - Archive.
  - Refresh.

### Layout

- Left: notification list grouped by Today / Earlier.
- Right: selected notification detail on desktop.
- Filters: Unread, Critical, Approvals, System, Archived.

Each notification shows:

- Safe title.
- School / module context.
- Event time and delivery time.
- Read / acknowledged state.
- Safe deep link.

Sensitive content must not appear in lock-screen preview copy.

---

## Page 13 — Reports

### Route

`/dashboard/reports`

### Main job

Find and generate Principal-authorized reports without exposing operational report definitions or unrestricted exports.

### Header

- Eyebrow: `Evidence`
- Title: `Reports`
- Description: `Generate authorized academic, attendance, staff, finance, and compliance reports.`
- Primary action: none until a report is selected.
- More Actions:
  - Recent exports.
  - Scheduled reports when implemented.
  - Export policy.

### Report catalogue categories

- Executive.
- Students and enrollment.
- Attendance.
- Academics.
- Staff.
- Finance.
- Communication.
- Compliance / iEMIS readiness.

### Main layout

```text
Left 4/12: searchable report catalogue
Right 8/12: report description, filters, preview metadata, export actions
Bottom full width: recent protected exports
```

### Export controls

- Required filters clearly identified.
- Data classification shown.
- Format choices limited by backend definition.
- Large exports queue as background jobs.
- Protected download.
- Generation and download audit.

Do not surface raw backend errors.

---

## Page 14 — Leadership Audit

### Route

Recommended: `/dashboard/audit`

### Main job

Review high-risk school changes across modules, with enough evidence to investigate without exposing platform-only audit data.

### Header

- Eyebrow: `Evidence`
- Title: `Leadership Audit`
- Description: `Review high-risk changes to access, student records, attendance, academics, finance, and communication.`
- Primary action: `Review critical events` when present.
- More Actions:
  - Export audit evidence.
  - Access report.
  - Date-range presets.

### Summary strip

- Critical events.
- Permission changes.
- Academic corrections.
- Financial reversals / reopenings.
- Sensitive exports.

### Filters

- Date range.
- Risk level.
- Module.
- Event type.
- Actor.
- Affected person / record.
- Source IP / device only when policy permits.

### Event list

Columns:

- Time.
- Event.
- Actor.
- Module.
- Affected scope.
- Risk.
- Result.

### Event detail drawer

- Plain-language event.
- Before / after values with field-level redaction.
- Reason.
- Approval chain.
- Related record.
- Supporting document.
- Correlation / request identifier for support use.

### Principal-visible audit categories

- Role and permission changes.
- Guardian access changes.
- Student lifecycle changes.
- Attendance reopen / correction.
- Marks unlock / correction.
- Result publish / withdraw.
- Refund / reversal / fiscal reopen.
- Payroll approval / posting when authorized.
- Notice publish / withdraw.
- Protected export generation.
- Sensitive record access.

Platform provider secrets, cross-tenant events, and unrelated technical logs remain outside this page.

---

## Page 15 — Personal Profile and Security

### Routes

- `/dashboard/settings/personal/profile`
- `/dashboard/settings/personal/notifications`
- `/dashboard/settings/personal/security`

### Main job

Allow the Principal to manage only their own profile, preferences, devices, and sessions.

### User-menu entries

- My Profile.
- Notification Preferences.
- Security and Sessions.
- Sign Out.

### Security page sections

- Password change.
- Active sessions.
- Recognized devices.
- Revoke session.
- Recent sign-in activity.
- Multi-factor status when supported.

Institutional Settings must not appear because the user is a Principal unless separately granted the School Configuration Owner role.

---

# 7. Responsive behavior

## Desktop ≥ 1280px

- Full sidebar.
- 12-column page grid.
- Split queue/detail layouts.
- Four KPI cards per row.
- Right evidence rail visible.

## Laptop 1024–1279px

- Sidebar may collapse.
- Two-column major panels become 7/5 or 6/6.
- KPI cards use 2 × 2 or 3 + 2 arrangements.
- Keep attention and approval rows above trends.

## Tablet 768–1023px

- Sidebar becomes drawer.
- Queue and detail become list + full-screen sheet.
- Summary cards use two columns.
- Tables use priority columns and row expansion.

## Narrow web < 768px

The web interface remains usable but is not a replacement for the Principal mobile app.

- One-column layout.
- Sticky page-level context only where essential.
- Hide nonessential table columns.
- Use cards for selected row detail, not for the entire dataset.
- Keep decision confirmations full-screen and keyboard accessible.

---

# 8. Accessibility requirements

Target WCAG 2.2 AA for priority Principal workflows.

Required:

- Full keyboard navigation.
- Visible focus.
- Correct heading hierarchy.
- Screen-reader labels for status and icon-only controls.
- Status never conveyed by colour alone.
- Minimum 44px touch targets for critical actions.
- Accessible tables with headers and captions.
- Dialog focus trap and focus return.
- Error summaries linked to fields.
- `prefers-reduced-motion` support.
- English and Nepali text scaling.
- Clear confirmation copy for high-risk decisions.

---

# 9. Copy rules

Use leadership language that explains impact.

Prefer:

```text
4 classes have not submitted attendance.
Result publication is blocked for Grade 8 because two subjects are incomplete.
Three notices require approval before their scheduled delivery time.
Bank reconciliation has two unresolved differences.
```

Avoid:

```text
Mutation failed.
4 pending.
Status: ERROR.
Entity not ready.
```

Every warning should state:

1. What happened.
2. What is affected.
3. What the Principal can safely do.

---

# 10. Visual design rules

Follow the active SchoolOS web design system.

- Calm `surface.app` background.
- White work surfaces.
- Brand navy for authority.
- Brand blue for primary actions.
- Module accent only for location.
- Semantic danger / warning / success / info for status.
- 16–24px panel radius.
- Subtle border and shadow.
- Strong 28/36 page title.
- 14/22 body text.
- 13px minimum in dense tables.
- Tabular numerals for counts and money.
- No decorative gradients as the core visual language.
- No rainbow charts.
- No nested card maze.

---

# 11. Global prohibited patterns

- Principal role used as a broad superuser.
- Hiding unsafe actions only in the frontend.
- Shared operator pages with inaccessible tabs and partial errors.
- Fake or client-calculated official totals.
- KPI cards without drill-through.
- Hash-only attention navigation as the sole queue.
- Notice-only approval labelled as the entire Approval Centre.
- Accounting audit labelled as school-wide Audit.
- Deferred modules in active Principal navigation.
- Sensitive student, staff, or financial details in list views.
- Bulk high-risk approvals.
- Approval without reason, evidence, or audit.
