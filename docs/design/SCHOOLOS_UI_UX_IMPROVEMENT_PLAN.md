# SchoolOS UI/UX Improvement Plan

## Purpose

This document defines the UI/UX direction for SchoolOS across web and app experiences. The goal is to make SchoolOS feel like a modern, production-ready, Nepal-friendly school management SaaS with separate experiences for school operations, platform/developer administration, and parent/teacher/student mobile use.

SchoolOS should not feel like a basic CRUD dashboard. It should feel like a trustworthy education operating system that is simple for schools, safe for children, useful for parents, and efficient for teachers and administrators.

---

# 1. Global UI/UX Direction for Web and App

## 1.1 Product Experience Principles

SchoolOS must be:

- **Simple:** common tasks should be reachable in 1-3 clicks/taps.
- **Role-aware:** admins, teachers, parents, students, drivers, and platform operators should only see what they need.
- **Trustworthy:** finance, attendance, student records, medical data, and communication must feel secure and auditable.
- **School-friendly:** language, layout, icons, and flows should match real school operations.
- **Mobile-first for parents/students:** parents and students should not see dense tables.
- **Desktop-first for operations:** admins/accountants need tables, filters, exports, reports, and approval flows.
- **Nepal-ready:** use NPR, local phone number patterns, guardian structures, class/section conventions, printable receipts, and later Nepali date/Bikram Sambat support.

## 1.2 Global Visual Language

Use a clean SaaS design system:

- Primary color: deep blue/indigo.
- Background: soft blue-grey or light slate.
- Cards: white, rounded, lightly bordered.
- Radius: 16px to 24px for cards; 10px to 14px for controls.
- Shadows: soft, minimal, not heavy.
- Icons: rounded education-style icons.
- Spacing: generous, especially on dashboards and mobile.
- Typography: clear and high contrast.

Recommended theme direction:

```ts
primary: '#155EEF'
primaryDark: '#0B3A88'
primarySoft: '#EAF1FF'
background: '#F3F7FB'
surface: '#FFFFFF'
border: '#E2E8F0'
success: '#16A34A'
warning: '#F59E0B'
danger: '#EF4444'
textPrimary: '#0F172A'
textSecondary: '#475569'
```

## 1.3 Shared Components

These components should be reused in both web and app where possible:

- `PageHeader`
- `SectionCard`
- `StatCard`
- `StatusBadge`
- `SearchInput`
- `FilterBar`
- `EmptyState`
- `LoadingState`
- `ActionMenu`
- `ConfirmDialog`
- `Toast`
- `Avatar`
- `NotificationBadge`

Web-specific reusable components:

- `DashboardShell`
- `SidebarGroup`
- `Topbar`
- `DataTable`
- `TablePagination`
- `ReportToolbar`
- `ExportButton`

App/mobile-specific reusable components:

- `MobileShell`
- `MobileHeader`
- `MobileBottomNav`
- `MobileModuleGrid`
- `MobileTimelineItem`
- `MobileCalendarCard`
- `MobileHomeworkCard`
- `MobileFeeCard`
- `MobileBusStatusCard`
- `MobileProfileSummary`

## 1.4 Status and Badge Standards

Use consistent statuses across modules:

| Status | Color | Usage |
|---|---|---|
| Active | Green | Student/staff/tenant active |
| Inactive | Grey | Temporarily disabled records |
| Pending | Amber | Waiting for action |
| Approved | Green | Approved workflows |
| Rejected | Red | Rejected workflows |
| Draft | Slate | Unpublished records |
| Published | Blue | Visible to users |
| Locked | Grey | Final/closed records |
| Paid | Green | Paid fees/invoices |
| Partial | Amber | Partially paid fees |
| Unpaid | Red | Unpaid fees |
| Overdue | Red | Past due payments/tasks |
| Onboard | Blue | Student is on bus |
| Dropped | Green | Student dropped safely |
| Delayed | Amber | Bus or workflow delay |

## 1.5 Accessibility and Safety Rules

- Minimum mobile touch target: 44px.
- Do not rely only on color; include text labels/icons.
- Use readable text contrast.
- Show loading, empty, error, and permission-denied states.
- Confirm destructive actions.
- Mask sensitive student, medical, guardian, and financial data based on role.
- Keep child data access strictly guardian/student-scoped.
- Keep audit visibility for finance, accounting, student lifecycle, communication, and sensitive edits.

---

# 2. Web-Focused UI/UX

The web experience is for school operations and platform/developer administration. It should prioritize productivity, reports, tables, filtering, approvals, exports, and role-based control.

---

## 2.1 Landing Page UX

### Audience

- School owners
- Principals
- Administrators
- Accountants
- Decision-makers
- Potential SaaS customers

### Landing Page Goals

- Explain what SchoolOS does in less than 10 seconds.
- Build trust with schools in Nepal.
- Show core modules clearly.
- Convert visitors to demo/request/onboarding.

### Recommended Sections

1. **Hero Section**
   - Headline: `Run your entire school from one modern platform.`
   - Subheadline: `Admissions, attendance, fees, exams, notices, transport, payroll, and accounting for Nepal-based schools.`
   - CTA buttons: `Request Demo`, `Login`
   - Visual: dashboard/mobile mockup.

2. **Problem/Solution Section**
   - Manual fee tracking
   - Paper attendance
   - Scattered notices
   - Weak parent communication
   - No real-time transport visibility
   - Hard reporting

3. **Module Overview**
   - Admissions
   - Student Profiles
   - Attendance
   - Fees & Receipts
   - Exams & Report Cards
   - Homework & Timetable
   - Notices & Communication
   - Transport
   - Accounting
   - HR/Payroll

4. **Nepal-Friendly Section**
   - NPR support
   - Cash/bank/QR payment workflows
   - Receipt printing
   - Guardian records
   - Local class/section structure
   - Future Nepali date support

5. **Trust and Security Section**
   - Role-based access
   - Audit logs
   - Secure student data
   - Tenant isolation
   - Encrypted sensitive fields

6. **CTA Section**
   - `Start pilot school setup`
   - `Book a demo`

### Landing Page UX Rules

- Avoid technical jargon.
- Use school workflow language.
- Use screenshots/cards instead of long text.
- Make CTAs visible at top and bottom.
- Mobile landing page must load fast and be scroll-friendly.

---

## 2.2 School Dashboard UX

### Audience

- School admin
- Principal
- Accountant
- Admission staff
- Class teacher
- Subject teacher
- HR staff

### Dashboard Goal

The school dashboard should act as the daily command center.

### Web Dashboard Layout

- Left sidebar with grouped navigation.
- Topbar with search, academic year, notifications, profile, and school/tenant context.
- Welcome/school summary section.
- KPI cards.
- Operational cards for attendance, fees, notices, and pending actions.

### Recommended Sidebar Groups

```text
Overview
- Dashboard

People
- Students
- Guardians
- Teachers
- Staff

Academics
- Classes
- Subjects
- Attendance
- Homework
- Timetable
- Exams
- Report Cards

Finance
- Fees
- Receipts
- Accounting
- Cashier Close

Operations
- Notices
- Activity Feed
- Transport
- Library
- Canteen

HR
- Payroll
- Leave

System
- Settings
- Tenant Setup
- Audit Logs
```

Use module badges:

- `Live`
- `Phase 2`
- `Later`
- `Locked`

### Dashboard Cards

- Total Students
- Total Teachers
- Total Parents
- Present Today
- Absent Today
- Fees Collected
- Pending Fees
- Upcoming Exams
- Pending Admissions
- Unread Notices
- Cashier Close Status

### Module UX Rules

#### Students

- Modern searchable table.
- Filters: class, section, gender, status, fee status.
- Row action menu: view, edit, assign class, view fees, view attendance, documents, archive.
- Student profile tabs: Overview, Attendance, Fees, Homework, Exams, Report Cards, Transport, Documents, Activity Log.

#### Admissions

- Step-based enrollment form.
- Admission pipeline: Inquiry, Application, Documents Pending, Review, Approved, Admitted, Rejected.
- Document checklist and review state.

#### Attendance

- Teacher-friendly marking flow.
- Class/section/date selector.
- Mark all present + exception changes.
- Calendar view with colors: present, absent, late, holiday, not marked.
- Monthly register export.

#### Fees and Receipts

- Fee collection dashboard.
- Student fee ledger.
- Clear statuses: Paid, Partial, Unpaid, Overdue, Refunded.
- Receipt print/download.
- Cashier close/day-end card.

#### Accounting

- Professional finance UI.
- Show ledger posting state.
- Journal entries should show debit/credit balance.
- No edit after posting; use reversal/correction flow.
- Fiscal period warnings.
- Source document links.

#### Exams and Report Cards

- Exam setup wizard.
- Mark entry table with validation.
- Missing marks warnings.
- Result publish/lock workflow.
- PDF report card download.

#### Homework and Timetable

- Homework cards grouped by date/subject.
- Timetable grid for admins.
- Timeline view for teachers/students.
- Conflict warnings for teacher, room, availability, workload, and subject-period requirements.

#### Notices and Communication

- Notice composer with audience selection.
- Read tracking and delivery status.
- Priority: Normal, Important, Urgent, Emergency.
- Parent-class teacher chat later with school-configured hours.

#### Transport

- Admin route dashboard.
- Active trips, delayed routes, vehicle/driver status.
- Student stop assignment.
- Parent tracking permissions.

#### HR/Payroll

- Staff profile tabs.
- Payroll preview, approval, posted state.
- Payslip and audit trail.

---

## 2.3 Platform / Developer UX

This experience is for SchoolOS operators, developers, support users, and future integration partners. It must stay visually separate from the school dashboard.

### Audience

- SchoolOS platform owner
- Platform super admin
- Support team
- Billing/admin team
- Developers/integration users

### Platform Areas

- Platform dashboard
- Tenant/school management
- Subscription/plans
- Usage and limits
- API health
- Job health
- Audit logs
- Support access
- Developer/API settings
- Webhooks/API keys later

### Platform Dashboard Cards

- Total Schools
- Active Schools
- Suspended Schools
- New Schools This Month
- Monthly Revenue
- API Health
- Failed Jobs
- Storage Usage
- Support Tickets later

### Developer Portal UX

Future developer-focused area should include:

- API documentation links
- API key management
- Webhook endpoints
- Request logs
- Error logs
- Rate limit visibility
- Integration guides
- Sandbox/test tenant setup

### Platform UX Rules

- Use operator-console visual style, different from school admin.
- Show cross-tenant warnings clearly.
- Never mix tenant-scoped settings with platform settings.
- Support actions must be audited.
- Developer keys and secrets must be masked.

---

# 3. App-Focused UI/UX

The app experience should be mobile-first and role-specific. It can initially be a responsive PWA inside the Next.js app, with native mobile/Expo considered later only if needed.

---

## 3.1 Parent App UX

### Parent Goals

Parents need quick answers:

- Is my child present today?
- Is there homework?
- Is there a fee due?
- Is the bus safe/on time?
- Are there new notices?
- Can I message the class teacher?

### Parent Home Screen

Sections:

- Greeting
- Child switcher
- Today summary card
- School update banner
- Quick access grid
- Homework due
- Fee due
- Bus status
- Latest notices

Quick actions:

- Attendance
- Homework
- Timetable
- Fees
- Report Card
- Transport
- Notices
- Chat Teacher
- Events

### Parent Screens

#### Attendance

- Monthly calendar.
- Present/absent/late/holiday legend.
- Monthly summary.
- Absence notes if allowed.

#### Homework

- Date-grouped homework cards.
- Subject, title, due date, status.
- Attachment count.
- Submit/view action depending on policy.

#### Fees

- Total, paid, due.
- Monthly cards.
- Receipt download.
- Payment method labels.
- Online payment later.

#### Transport

- Live bus map.
- Child-specific tracking only.
- ETA, bus number, driver name, vehicle number.
- Last updated time.
- Emergency contact.

#### Teacher Chat

- One thread per student per academic year.
- Show school chat hours.
- Outside-hours messages are queued.
- Emergency option with warning.

### Parent Safety Rules

- Parents only see their own linked children.
- Parents cannot see other students.
- Parent chat must be moderated and auditable.
- Fees and medical data require strict role checks.

---

## 3.2 Teacher App UX

### Teacher Goals

Teachers need fast daily actions:

- See today’s classes.
- Mark attendance.
- Assign homework.
- Review homework.
- Upload marks.
- Reply to parent messages.
- See substitution duties.

### Teacher Home Screen

Cards:

- Today’s Classes
- Attendance to Mark
- Homework to Review
- Parent Messages
- Substitution Duty
- Notices

### Teacher Screens

#### Today’s Classes

- Timeline by time.
- Current class indicator.
- Class, subject, room, section.
- Quick actions: mark attendance, assign homework, view students.

#### Attendance

- Class/section selector.
- Mark all present.
- Tap exceptions.
- Save and confirm.

#### Homework

- Create homework.
- Attach files.
- Set due date.
- Review submissions.
- Add comments.

#### Messages

- Parent-class teacher chat.
- Quiet hours notice.
- SLA label: `Usually replies within 1 school day`.
- Report/escalate option.

### Teacher UX Rules

- Minimize typing on mobile.
- Use quick actions.
- Do not overload teacher app with admin-only workflows.
- Respect chat quiet hours.

---

## 3.3 Student App UX

Student access must be age-aware and parent-controlled.

### Student Goals

- See today’s timetable.
- Check homework.
- View results/report cards.
- Read notices.
- Access learning resources.
- Track attendance if allowed.

### Age Verification and Phone Usage Policy

SchoolOS should classify student access into age bands:

| Age Group | Access Model | Phone Usage UX |
|---|---|---|
| Under 10 | Parent-controlled only | No independent student login by default |
| 10-12 | Limited student view | Parent approval required |
| 13-15 | Student login allowed with controls | Parent/school controlled features |
| 16+ | Expanded student portal | Still school-policy controlled |

### Parent-Controlled Student Access

Parents/school should control:

- Whether student login is enabled.
- Which modules student can access.
- Whether chat is available.
- Whether result details are visible.
- Notification preferences.
- Device/session access.

### Student Home Screen

Sections:

- Today’s classes
- Homework due
- Exam countdown
- Attendance summary
- Latest notice
- Learning resources
- Results/report card

### Student Restrictions

- No direct unrestricted teacher chat for younger students.
- No visibility into other students.
- No financial payment controls except read-only fee visibility if allowed.
- Sensitive guardian/medical information should be hidden or minimized.
- Parent can disable student app access.

---

# 4. Implementation Plan

## Phase UI-0: UI Audit and Foundation

Goal: understand current UI and prepare the design foundation.

Tasks:

- Audit current `apps/web` routes and components.
- Identify duplicate UI patterns.
- Document current dashboard, student, finance, attendance, and settings screens.
- Finalize design tokens.
- Finalize navigation groups.

Deliverables:

- UI audit notes.
- Design token plan.
- Component inventory.

---

## Phase UI-1: Global Design System

Goal: create consistent UI building blocks.

Tasks:

- Add/standardize theme tokens.
- Build shared components: PageHeader, SectionCard, StatCard, StatusBadge, EmptyState, LoadingState, ActionMenu.
- Standardize buttons, inputs, filters, cards, badges, and spacing.

Deliverables:

- Shared design components.
- Consistent visual system.

---

## Phase UI-2: Web Shell and Navigation

Goal: improve the main school admin layout.

Tasks:

- Redesign dashboard shell.
- Add grouped sidebar.
- Add active route state.
- Add module badges: Live, Phase 2, Later, Locked.
- Improve topbar with search, notification, profile, academic year/school context.

Deliverables:

- Improved web admin shell.
- Cleaner navigation.

---

## Phase UI-3: School Dashboard Redesign

Goal: make dashboard a daily command center.

Tasks:

- Add welcome/school summary section.
- Add KPI cards.
- Add attendance overview.
- Add fee collection overview.
- Add notices/events panel.
- Add pending actions/recent activity.

Deliverables:

- Modern school dashboard.

---

## Phase UI-4: Student Management UX

Goal: make student operations faster and clearer.

Tasks:

- Redesign student list.
- Add filters and action menu.
- Improve student profile with cards and tabs.
- Improve guardian, document, attendance, fee, and activity views.

Deliverables:

- Modern student directory.
- Improved student profile.

---

## Phase UI-5: Core School Workflow UX

Goal: improve daily school workflows.

Tasks:

- Attendance calendar and summary views.
- Homework cards and review flow.
- Timetable timeline/grid views.
- Exam/result/report card UX polish.
- Notice center polish.

Deliverables:

- Better academics and communication workflows.

---

## Phase UI-6: Finance and Accounting UX

Goal: make finance safe, clear, and professional.

Tasks:

- Improve fee collection screens.
- Improve student fee ledger.
- Improve receipt/cashier close UI.
- Build accounting dashboard polish.
- Add posting/fiscal-period/reversal warnings.

Deliverables:

- Production-grade finance/accounting UI.

---

## Phase UI-7: Platform and Developer UX

Goal: separate platform/operator/developer experience from school admin.

Tasks:

- Improve platform dashboard.
- Improve tenant/school management UI.
- Add health/usage cards.
- Add developer portal placeholders for API docs, keys, webhooks, logs.

Deliverables:

- Cleaner platform control plane.
- Developer portal foundation.

---

## Phase UI-8: Mobile/PWA Portal Foundation

Goal: create parent/student/teacher mobile experience as PWA-style routes.

Tasks:

- Create `MobileShell`.
- Add role-based mobile bottom nav.
- Build parent/student home.
- Build attendance, timetable, homework, fees, profile screens.
- Add transport placeholder.

Deliverables:

- Mobile portal foundation.

---

## Phase UI-9: Role-Specific App UX

Goal: deepen mobile flows for parents, teachers, students, and drivers.

Tasks:

- Parent child switcher and teacher chat.
- Teacher class/attendance/homework flow.
- Student age-aware access controls.
- Driver trip screen.
- Transport tracking UI.

Deliverables:

- Role-specific app UX.

---

## Phase UI-10: Polish and Production Readiness

Goal: make the UI ready for pilot schools.

Tasks:

- Responsive testing.
- Accessibility testing.
- Loading/empty/error states.
- Permission-denied states.
- Audit-sensitive UI review.
- Performance cleanup.
- Visual consistency pass.

Deliverables:

- Production-ready UI/UX baseline.

---

# 5. Recommended Execution Order

1. Global design system.
2. Web admin shell/navigation.
3. School dashboard.
4. Student management.
5. Attendance/homework/timetable.
6. Fees/accounting.
7. Platform/developer experience.
8. Mobile parent/student/teacher portal.
9. Transport/driver experience.
10. Final polish and accessibility.

This order avoids visual inconsistency and prevents building mobile screens before the core design system is stable.
