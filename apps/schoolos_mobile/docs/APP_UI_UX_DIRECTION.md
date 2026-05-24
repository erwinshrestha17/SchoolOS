# SchoolOS Mobile Professional UI/UX Direction

This document defines the visual and interaction direction for the SchoolOS Flutter app. The goal is a professional school app that feels premium, calm, trustworthy, fast, and simple for real parents, teachers, drivers, staff, students, and principals.

The app should not look like a generic school template or a crowded admin dashboard. It should feel like a modern mobile product designed around daily school life.

## 1. Design Positioning

SchoolOS Mobile should feel:

```txt
Calm like a trusted school office
Fast like a classroom tool
Clear like a parent update app
Reliable like a transport safety app
Secure like a finance/staff self-service app
```

Design keywords:
- Professional
- Clean
- Warm
- Trustworthy
- Child-first
- Action-first
- Offline-aware
- Low-friction
- Nepal-friendly

Avoid:
- Too many colors
- Dense admin tables
- Generic flat card grids
- Tiny labels
- Decorative screens with no purpose
- Overloaded dashboards
- Desktop UI copied into mobile
- Heavy gradients everywhere
- Unclear icon-only actions

## 2. Visual Inspiration Direction

Use the provided reference images as inspiration, not as something to copy exactly.

Good ideas to adopt:
- Spacious dashboard cards
- Soft rounded containers
- Clear top greeting area
- Calendar and timetable cards
- Professional academic icon grid only where useful
- Transport map-first layout for bus tracking
- Clean assignment/homework cards
- Strong primary action placement
- Bottom navigation with daily workflows
- Calm background surfaces with subtle depth

Things to improve beyond the references:
- Better role separation
- Stronger information hierarchy
- More consistent spacing
- More professional typography
- Better empty/loading/offline states
- Less decorative clutter
- Better accessibility and touch targets
- Clearer sensitive-data handling

## 3. Design System Principles

### One screen, one job

Every screen must have one primary purpose.

Examples:
- Parent home: understand child today
- Teacher attendance: mark and submit attendance quickly
- Driver trip: safely operate the active trip
- Fees: understand due amount and receipts
- Notices: read and acknowledge school messages
- Approvals: approve or reject pending requests

### Progressive disclosure

Show simple summaries first. Let the user drill down only when needed.

Example:
- Parent home shows: `Rs. 8,500 due`
- Fee detail shows: invoice lines, payments, receipts, due dates

### Mobile-first, not dashboard-first

Avoid desktop tables. Use:
- Cards
- Grouped lists
- Timelines
- Status chips
- Summary rows
- Calendar views
- Bottom sheets for filters/actions
- Detail screens for complex information

### Trust through clarity

For parents and staff, clarity is more important than visual decoration. Important states like absent, fee due, bus arriving, homework pending, payslip available, or approval pending must be immediately visible.

## 4. Brand and Color Direction

Use a calm school-professional palette.

Recommended direction:
- Primary: deep school blue or indigo
- Background: soft off-white / cool grey
- Surface: white or very light slate
- Text: dark slate/navy
- Success: green
- Warning: amber
- Error: red
- Info: blue

Color rules:
- Use primary color for main navigation and primary actions.
- Use semantic colors only for status meaning.
- Do not assign random colors to every module.
- Do not rely on color alone; always use labels/icons too.
- Keep backgrounds calm and readable.

## 5. Typography Direction

Typography should feel premium and readable.

Rules:
- Use clear hierarchy: title, section title, body, caption, status.
- Do not use tiny text for important school information.
- Minimum readable body text should feel comfortable on low-end Android phones.
- Use medium/semi-bold weight for titles and card labels.
- Use regular weight for descriptions.
- Use tabular/consistent number styling for money, times, and counts where possible.

Text should be simple:
- Use `Fees due` instead of `Outstanding receivables`
- Use `Bus arriving in 12 min` instead of `ETA calculated`
- Use `Attendance not submitted` instead of `Pending attendance workflow`

## 6. Spacing, Radius, and Touch Targets

Use consistent spacing tokens.

Recommended rhythm:
- Screen horizontal padding: 16–20px
- Section spacing: 20–28px
- Card internal padding: 16–20px
- Grid gap: 12–16px
- Touch target minimum: 44px
- Cards radius: 20–28px
- Small chips radius: 999px

Rules:
- Do not compress everything to show more modules.
- Important actions should be large enough for one-handed use.
- Use breathing room around parent-facing information.
- Teacher/driver screens can be denser, but never cramped.

## 7. Common Components

Create and reuse these components consistently:

```txt
AppScaffold
AppTopBar
AppBottomNav
AppButton
AppTextField
AppCard
AppMetricCard
AppActionCard
AppListTile
AppStatusChip
AppAvatar
AppEmptyState
AppErrorView
AppLoadingSkeleton
OfflineBanner
LastUpdatedLabel
SectionHeader
AmountText
DateStatusLabel
PermissionBlockedView
```

Component rules:
- Buttons must clearly show loading/disabled states.
- Inputs must show validation messages below fields.
- Cards must not hide primary actions.
- Icon buttons need accessibility labels.
- Lists must support empty/error/loading states.
- Status chips must use clear text, not color only.

## 8. Role-Based Home Screen Direction

### Parent Home

Primary job: see child’s day quickly.

Recommended sections:
1. Greeting + selected child
2. Today summary cards
3. Important alerts
4. Daily modules
5. Latest notice/activity
6. More services

Suggested cards:
- Attendance today
- Homework pending
- Fees due
- Bus status
- Notice unread
- Canteen balance

Primary action examples:
- View child profile
- Pay/view fees later
- Open today’s homework

### Teacher Home

Primary job: complete today’s school actions quickly.

Recommended sections:
1. Today’s first/next class
2. Attendance action card
3. Homework action
4. Substitution alert
5. Messages/notices
6. Class list shortcut

Primary action examples:
- Mark attendance
- Create homework
- Open timetable

### Student Home

Primary job: know what to study/do today.

Recommended sections:
1. Today’s timetable
2. Homework due
3. Notices
4. Results/report card alerts
5. Activity feed

Primary action examples:
- Open homework
- View timetable

### Driver Home

Primary job: operate the active trip safely.

Recommended sections:
1. Current route/trip state
2. Start/complete trip button
3. Next stop
4. Students onboard/remaining
5. Emergency contact
6. GPS sharing status

Primary action examples:
- Start trip
- Mark boarded/dropped
- Complete trip

### Staff Home

Primary job: self-service and notices.

Recommended sections:
1. Profile summary
2. Leave status
3. Payslip card
4. Notices
5. Pending requests

Primary action examples:
- Request leave
- View payslip

### Principal/Admin Home

Primary job: monitor and approve.

Recommended sections:
1. School day health summary
2. Pending approvals
3. Attendance alerts
4. Finance snapshot
5. Transport alerts
6. Emergency notice action

Primary action examples:
- Open approvals
- Send emergency notice

## 9. Module Screen UX Rules

### Attendance

Teacher screen:
- Show selected class/section at top.
- Show attendance date clearly.
- Provide bulk `Mark all present` action.
- Use large status buttons: Present, Absent, Late, Leave.
- Show submit button fixed near bottom when unsaved changes exist.
- Support offline draft state.

Parent screen:
- Show today status first.
- Monthly calendar below.
- Explain colors with labels.
- Show absence/late summary.

### Homework

Student/parent:
- Group by due date: Today, Tomorrow, This Week, Older.
- Show subject, teacher, due date, status, attachments.
- Use clear chips: Pending, Submitted, Late, Checked.

Teacher:
- Keep create form short.
- Class/section, subject, title, due date, attachment, instructions.
- Use draft/publish states.

### Fees

Parent:
- Show total due first.
- Show due date and payment status.
- Show invoice cards, not tables.
- Receipt download/share action must be clear.
- Payment gateway should be added only when backend flow is ready.

Admin/principal:
- Show summary only on mobile.
- Deep accounting stays in web dashboard.

### Notices

- Unread notices should be obvious.
- Emergency notices should have strong but controlled visual treatment.
- Notice detail should show audience, date, attachments, and read status.
- Push notifications should open the correct notice detail.

### Transport

Parent:
- Map-first active trip view.
- Show bus status above map.
- Show driver/vehicle card.
- Show ETA and last updated time.
- Boarded/dropped notifications must be clear.

Driver:
- Trip state must be impossible to miss.
- Primary button changes by state: Start Trip, Mark Stop, Complete Trip.
- Emergency contact must be easy to access.
- Do not distract the driver with non-trip modules.

### Canteen

Parent:
- Wallet balance first.
- Low balance warning.
- Spending controls and meal history.

Canteen staff:
- Scanner-first flow.
- Allergy warning must be prominent.
- Serve action must be clear and confirmable.

### HR / Payroll

Staff:
- Payslip screens are sensitive.
- Mask bank/salary details where permission requires.
- Add re-auth/biometric later for sensitive actions.

### Approvals

Admin/principal:
- Approval list should show requester, type, amount/impact, urgency, and date.
- Approval detail should show context and history.
- Approve/reject must allow comments where needed.

## 10. Loading, Empty, Error, and Offline States

Every API screen must handle:
- Loading
- Success
- Empty
- Error
- Offline
- Unauthorized
- Forbidden
- Server error
- Timeout

Use skeleton loaders for content areas. Avoid center spinners except for full-screen startup.

Human-friendly messages:
- `Could not load attendance. Please try again.`
- `You do not have permission to view this page.`
- `You are offline. Showing last saved data.`
- `Session expired. Please log in again.`
- `No homework due today.`
- `No notices yet.`

Do not show raw backend stack traces or internal exception names.

## 11. Offline UX

Offline is part of the product, not an edge case.

Show:
- Offline banner
- Last updated timestamp
- Cached data state
- Sync status: Pending, Synced, Failed, Retry

High-priority offline areas:
- Teacher attendance drafts
- Driver trip update queue
- Parent child profile cache
- Homework viewing
- Notice viewing
- Timetable viewing

Do not queue financial/payment actions unless backend idempotency is explicitly ready.

## 12. Accessibility and Usability

Rules:
- Touch target minimum 44px.
- Icon buttons must have semantic labels.
- Text contrast must be readable in sunlight.
- Support dynamic text scaling where practical.
- Avoid putting important text inside images.
- Use readable date/time formats.
- Do not rely only on color for status.

## 13. Professional Polish Checklist

Before a screen is accepted:

```txt
[ ] One clear primary purpose
[ ] One clear primary action
[ ] Proper loading state
[ ] Helpful empty state
[ ] Human-friendly error state
[ ] Offline state where relevant
[ ] Last updated timestamp where data can be stale
[ ] Permission-blocked state if role lacks access
[ ] No sensitive data leaked
[ ] No raw backend errors
[ ] Uses shared components
[ ] Uses theme tokens
[ ] No hardcoded random colors
[ ] No giant widget file
[ ] No business logic inside widgets
[ ] Works on small Android screen
[ ] Works with large text reasonably
```

## 14. Design Implementation Priority

Build visual quality in this order:

```txt
1. Theme tokens and typography
2. App shell and role bottom navigation
3. Reusable cards/buttons/inputs/chips
4. Parent dashboard polished
5. Teacher attendance polished
6. Notices polished
7. Homework and fees polished
8. Transport map/trip screens polished
9. Staff/admin approvals polished
10. App icon, splash, release polish
```

## 15. Final Direction

SchoolOS Mobile should not feel like a copied admin panel. It should feel like a trusted daily school companion:

- Parents open it to understand their child’s day.
- Teachers open it to complete classroom work quickly.
- Drivers open it to run safe trips.
- Staff open it for secure self-service.
- Principals open it to approve and monitor the school day.

Professional UI/UX means fewer distractions, clearer status, faster actions, safer data, and consistent design everywhere.
