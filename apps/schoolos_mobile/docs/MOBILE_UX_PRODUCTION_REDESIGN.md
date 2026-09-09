# SchoolOS Mobile Production UX Redesign

**Scope:** Parent, Teacher, Principal/School Leadership mobile experiences plus shared authentication, notifications, profile/settings, states, and design-system foundations.

**Goal:** Make SchoolOS feel intentionally designed for frequent phone use rather than a web dashboard reduced to mobile dimensions.

## Product principles

Every major screen must answer quickly:

1. Where am I?
2. What is important here?
3. What can I do next?
4. What happened after I acted?

The mobile application remains persona-first, task-first, role/assignment scoped, low-bandwidth aware, and backed by authoritative APIs. UI visibility is never authorization.

---

# A. UX audit

## P0 — Critical

| Finding | Why it matters | Resolution |
|---|---|---|
| Parent had six primary bottom destinations | Too many persistent choices for small phones; labels had to be artificially shrunk | Reduced to five task groups: Today, Child, Schoolwork, Updates, More |
| Persona shells used separate navigation implementations | Different spacing, label behavior, semantics, and future maintenance paths | Introduced shared `AppBottomNavigation`; Parent and `RoleShellScaffold` now consume it |
| Parent detail screens depended on old six-slot indices | A direct nav rewrite could break many deep-linked screens | Added a legacy-index normalization layer while preserving routes/contracts |
| Status/error/offline/auth rules must remain backend-authoritative | Visual redesign must not weaken permission, child, assignment, or tenant boundaries | No backend/domain authorization changes in this slice |

## P1 — High

| Finding | Why it matters | Recommended/ongoing solution |
|---|---|---|
| Parent portal has static `ParentPortalColors` across many widgets | Global dark mode exists, but some Parent surfaces can stay visually light | Migrate Parent surfaces progressively to semantic theme roles |
| Teacher Profile was a permanent primary tab | Profile is not a repeated classroom task | Reframed the tab as **More**, grouping timetable, marks, activities, leave, payslips, notices, profile/security, and settings |
| Principal mobile consumes many generic raw map payloads | Large leadership screens are harder to reason about and visually standardize | Introduce typed presentation/domain projections per snapshot as endpoints stabilize |
| Principal screens are information-rich | Leadership needs exceptions and decisions, not miniature operational dashboards | Keep Overview exception-first; use drill-down for detail and full reports on web |
| Deferred modules still have reachable mobile routes | Can add navigation noise during P0 pilot | Hide through entitlement/scope; do not promote Library/Transport/Canteen/Learning in core IA while deferred |

## P2 — Medium

- Consolidate Parent `PortalCard` variants into shared semantic `AppCard` variants.
- Standardize search/filter toolbars for large lists.
- Standardize bottom sheets and destructive confirmation flows.
- Migrate remaining hard-coded radii/paddings to tokens.
- Replace full-screen spinners with screen-shaped skeletons where content structure is known.
- Normalize pull-to-refresh and last-updated labels across role homes.
- Add selective haptics to completed attendance, approvals, and safe confirmation actions.

## P3 — Polish

- Fine-tune native transition behavior for iOS/Android.
- Refine subtle motion durations using `AppMotion`.
- Review icon consistency after IA stabilizes.
- Add final golden coverage for common device dimensions.

---

# B. New information architecture

## Parent

```text
Today
Child
Schoolwork
Updates
More
```

### Today
- Active child context and fast child switcher.
- Highest-priority action.
- Attendance/school-day summary.
- Upcoming homework/deadlines/events.
- 3–5 contextual quick actions.
- Latest school update.

### Child
- Child profile and class context.
- Attendance history.
- Academic summary/results entry points.
- Child-specific permissions and service links.

### Schoolwork
- Homework.
- Timetable.
- Exam/result entry points.
- School calendar.

### Updates
- Notices.
- Notification activity.
- School/activity updates.
- Critical/action-required information visually separated from general updates.

### More
- Fees/receipts where permitted.
- Consent/permissions.
- Parent service requests.
- Profile/security.
- Appearance/language/notification settings.
- Entitlement-driven secondary modules only when active.

Attendance remains a highly visible contextual action but no longer consumes a permanent sixth tab.

## Teacher

```text
Today
Attendance
Homework
More
```

### Today
- Current/next class.
- Attendance pending.
- Homework review queue.
- Today's timetable.
- Activity capture and class shortcuts.

### Attendance
- Assigned classes only.
- Fast mark-all-present then exceptions workflow.
- Offline draft and explicit sync states.

### Homework
- Assigned-scope homework.
- Fast create/publish.
- Review queue.

### More
- Assigned classes / Class Hub.
- Timetable.
- Marks.
- Activities/milestones.
- Notices.
- Leave.
- Payslips.
- Profile/security/settings.

## Principal / Leadership

Target primary IA remains:

```text
Overview
Attention
Approvals
School
More
```

Leadership screens should prioritize exceptions:

- Missing attendance, not total attendance records.
- Staff absence impact, not raw staff lists.
- Urgent/oldest approval, not only approval count.
- Reconciliation or collection exceptions, not accounting operations.
- Academic readiness gaps, not dense marks tables.

Full configuration, large reports, finance administration, and dense data remain web-first.

---

# C. Design system

## Semantic colors

`AppSemanticColors` defines role-independent UI meanings:

- `primary`
- `secondary`
- `background`
- `surface`
- `elevatedSurface`
- `border`
- `textPrimary`
- `textSecondary`
- `textMuted`
- `success`
- `warning`
- `error`
- `info`

Light and dark variants are provided through a `ThemeExtension`. New shared UI should consume semantic roles rather than raw palette values.

Persona accent colors remain restrained identity accents and must never replace status semantics.

## Typography

Use the existing shared hierarchy:

- Display values: rare, high-value metrics only.
- Page title/headline.
- Section title.
- Card title.
- Body.
- Secondary body/helper.
- Caption/status.
- Button/navigation label.

Inter is the primary Latin UI font; Noto Sans Devanagari remains the Nepali fallback.

## Spacing

Canonical scale:

```text
4 / 8 / 12 / 16 / 20 / 24 / 32 / 48
```

Use 16px baseline page padding on phones and increase only for wider adaptive layouts.

## Core reusable components

Already present or established:

- `AppScaffold`
- `AppButton`
- `AppTextField`
- `AppCard`
- `AppEmptyState`
- `AppExceptionView`
- `AppLoading`
- `AppSkeleton`
- `OfflineBanner`
- `StatusChip`
- `UserAvatar`
- `SectionHeader`
- `BsDatePicker`
- `AppBottomNavigation` (new canonical bottom-nav primitive)

Further component consolidation should happen only when repeated behavior is truly equivalent; avoid generic components that hide persona/business meaning.

---

# D. Screen changes in the foundation slice

## Parent shell

**Changed**
- Six destinations reduced to five.
- Labels changed from module-like destinations to user tasks.
- Navigation now uses the shared bottom-nav primitive.
- Top-bar colors use semantic light/dark roles.

**Benefit**
- Lower cognitive load.
- Better one-hand reach.
- No need to shrink six labels into narrow slots.
- More scalable grouping as features grow.

## Parent detail screens

**Changed**
- Existing detail screens map safely onto the new five-destination IA.
- Legacy indices remain accepted during incremental migration.

**Benefit**
- No big-bang route rewrite.
- Deep links and backend contracts remain intact.

## Teacher More workspace

**Changed**
- Primary `Profile` destination renamed to `More`.
- Teaching tools, self-service, notices, profile/security and settings are grouped explicitly.
- Assigned-class scope card links to assigned classes.

**Benefit**
- Primary navigation now represents daily work rather than account management.
- Secondary workflows stay close without overcrowding the bottom bar.

---

# E. Implementation changes

## Added

- `lib/app/theme/app_semantic_colors.dart`
- `lib/shared/widgets/app_bottom_navigation.dart`
- `test/mobile_navigation_ia_test.dart`
- `docs/MOBILE_UX_PRODUCTION_REDESIGN.md`

## Modified

- `lib/app/theme/app_theme.dart`
- `lib/shared/widgets/role_shell_scaffold.dart`
- `lib/shared/widgets/school_os_app_shell.dart`
- `lib/features/parent/presentation/widgets/parent_detail_widgets.dart`
- `lib/features/teacher/presentation/screens/teacher_profile_screen.dart`

No API, database, authentication, authorization, domain, or offline synchronization contract is changed by this foundation slice.

---

# F. Validation plan

Required before this redesign branch is ready to merge:

```text
dart format .
flutter analyze
flutter test
flutter test test/mobile_navigation_ia_test.dart
flutter build apk --debug (or existing project build gate)
```

Manual/device matrix:

- Small Android phone (~320–360dp width).
- Standard Android phone.
- Large Android phone.
- Standard iPhone.
- Large iPhone / Dynamic Island.
- Light and dark mode.
- System text scaling through at least 200% for critical flows.
- Keyboard open on login/forms.
- Offline/reconnect attendance flows.
- Parent child switching.
- Teacher assignment changes.
- Principal approval and attention drill-down.

Acceptance criteria:

- Daily primary tasks reachable in 1–3 taps.
- No primary bottom bar exceeds five destinations.
- No normal-content horizontal scrolling.
- Minimum accessible touch targets maintained.
- Important status never depends only on color.
- No indefinite loading without recovery.
- Offline/pending-sync states never imply server success.
- No authorization bypass introduced for UX convenience.

---

# Migration order after foundation

1. Authentication and biometric setup visual/state consistency.
2. Parent Today/Child/Schoolwork/Updates dark-theme migration.
3. Teacher Today, attendance and homework interaction polish.
4. Principal exception-first Overview and consistent approval cards/sheets.
5. Notifications categorization and deep-link affordances.
6. Profile/settings consolidation.
7. Search/filter/list patterns.
8. Screen-specific loading/empty/error/offline/permission states.
9. Accessibility/device matrix and golden tests.
10. Dead-style/component cleanup after callers have migrated.

This order intentionally avoids a blind whole-app rewrite. The design foundation is established first, then high-frequency workflows are migrated while preserving authoritative backend behavior.
