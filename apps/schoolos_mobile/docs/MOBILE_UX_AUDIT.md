# SchoolOS Mobile — Phase 1 UX/Responsiveness/Size Audit

**Status:** Snapshot as of 2026-07-11, main branch (commits through `52c68cba`). Updated after Phase 5 real-device verification.

**Scope:** `apps/schoolos_mobile`, Parent / Teacher / Principal personas only, per `docs/DESIGN_SYSTEM.md` and the mobile companion-app brief. Driver/Staff/Admin/Student surfaces are noted where they share code with the three in-scope personas, but were not independently audited.

**Methodology:** Direct code review of every persona screen and its shared widgets, plus adversarial Flutter widget tests (compact width 320px, text scale 1.0/1.3/1.5x) that actually rendered each screen and asserted `tester.takeException() == null`. Findings below are backed by either a passing/failing test run or a direct code citation — nothing here is inferred without checking the source. Performance (frame timing, rebuild counts, API dedup) was **not profiled** this pass; see the Performance section for why that's called out explicitly rather than guessed at.

---

## 1. Persona flow maps

### Parent
```
Login → SchoolOsAppShell (bottom nav: Today | Children | Homework | Notices | More)
  Today        → child switcher, attention/urgent-action card, quick actions grid, latest update
  Children     → linked-child roster, tap → child detail (attendance/homework/fees summary)
  Homework     → per-child homework list → homework detail
  Notices      → notice list → notice detail
  More         → Attendance, Fees, Report Cards, Calendar, Transport, Canteen, Consents,
                 Library, Chat, Activity, Learning summary, Timetable, Profile, Settings
```
Fees, report cards, and protected receipts/documents are reached via **More**, not the primary tab bar — consistent with the brief's priority list, but worth knowing that "Fees" (a top brief priority) is two taps deep (More → Fees), not one.

### Teacher
```
Login → RoleShellScaffold (bottom nav: Today | Attendance | Homework | Messages | Profile)
  Today       → current/next class, homework summary, messages summary, notices
  Attendance  → class picker → roster → mark → submit (offline-draft aware)
  Homework    → list/filter → create/edit/publish → review submissions
  Messages    → thread list → thread detail → reply
  Profile     → assigned/notices summary cards, My Timetable, Notices, Leave Requests (stub),
                Payslips (locked), Help
```
Class Hub (`teacherClass/:id`) and Timetable are reached from Today/Profile, not the tab bar.

### Principal
```
Login → PrincipalShell (bottom nav: Today | Attention | Approvals | Notices | More)
  Today      → attention-count card, metric grid, alerts, quick actions, recent updates
  Attention  → filterable prioritized issue list, assign-to-me
  Approvals  → tabbed (pending/approved/rejected) request list → review sheet
  Notices    → emergency notice compose/preview/send
  More       → Students, Admissions, Academics, Fees, Transport, Canteen, Library, Tasks,
               Walkthroughs, Reports, Escalations, Profile, Settings
```
Matches the brief's "attention-first, approval-first, summary-first" intent — Today surfaces counts and links out rather than embedding full lists.

---

## 2. Screen inventory

73 registered routes total. In-scope personas:

| Persona | Routes | Notes |
|---|---|---|
| Parent | 21 | `SchoolOsAppShell` (tabbed) + 17 standalone detail/snapshot screens |
| Teacher | 11 | `RoleShellScaffold`-based Today/Attendance/Homework/Messages/Profile + Class Hub, Timetable, Message Thread |
| Principal | 19 | `PrincipalShell`-based Today/Attention/Approvals/More + 12 `PrincipalSnapshotScreen` variants keyed by snapshot type (fees, staff, academics, transport, canteen, library, admissions, reports, attendance-risk) |
| Shared | 9 | splash, login, forgot-password, home-redirect, profile, change-password, settings, notifications, notices |
| Out of scope (reachable) | 5 | Driver (4 routes), Staff (5 routes, `StaffDashboard` reachable, shares `QuickActionCard`/`RoleShellScaffold`) |
| Out of scope (unreachable) | 1 | `AdminDashboard` is routed (`adminHome`) but ADMIN is explicitly out of product scope per the brief; `StudentDashboard` exists in code but has **no route** — dead code |

Full route → screen mapping is in `lib/app/router.dart`; not duplicated here since it will drift.

---

## 3. Responsive layout problems — found and fixed this pass

All 10 were confirmed by a failing widget test before the fix, and a passing one after. Root causes cluster into two patterns:

**Pattern A — `GridView.count(childAspectRatio: fixed)`:** the cell height is locked to a width/ratio and does not grow with text scale. At 1.3–1.5x accessibility text scale, wrapped or larger text no longer fits the fixed cell height → `RenderFlex` vertical overflow.

**Pattern B — a `Row` with a trailing dynamic-width element (count, chevron, or both) and no `Expanded`/`Flexible`/width bound:** at large text scale or in a squeezed multi-column layout, the fixed-width children alone exceed the available row width → horizontal overflow.

| # | Location | Pattern | Fix |
|---|---|---|---|
| 1 | `principal_screens.dart` `_SummaryStrip` (Attention Center) | B | Bounded value text width + ellipsis |
| 2 | `principal_screens.dart` `_SummaryCards` (shared, 7 call sites: dashboard, approvals, escalations, emergency notice, tasks, walkthroughs, fee snapshot) | A | Replaced `GridView.count` with `Wrap` + computed item width — content-driven height |
| 3 | `teacher_app_widgets.dart` `TeacherTaskCard` (shared, 4 call sites) | B | Bounded trailing value text (`ConstrainedBox` + ellipsis) |
| 4 | `teacher_homework_screen.dart` `_Meta` | B | Wrapped label in `Flexible` + ellipsis |
| 5 | `teacher_homework_screen.dart` Assignments/To-review card row | B | Stacks to 1 column below 360px width |
| 6 | `parent_calendar_screen.dart` `_DayCell` (BS calendar grid) | A | `FittedBox(scaleDown)` around cell content |
| 7 | `parent_calendar_screen.dart` `_LegendDot` | B | Wrapped label in `Flexible` + ellipsis |
| 8 | `parent_portal_home_tab.dart` + `parent_portal_detail_screens.dart` `ActionTile` grids (2 call sites) | A | `Wrap`-based layout, same as #2 |
| 9 | `teacher_profile_screen.dart` Assigned/Notices card row | B | Same stacking fix as #5 (this card also sets `onTap`, adding a chevron that made it worse) |
| 10 | `admin_dashboard.dart` / `staff_dashboard.dart` `QuickActionCard` grids | A | `Wrap`-based layout, same as #2 (fixed via a background task, same session) |

**Screens reviewed and already safe** (proper `Expanded`/`Flexible`/`Wrap` usage, verified by reading, not just assumed): teacher attendance, timetable, messages, class hub; principal admissions, staff/students snapshots, escalations + review sheet; parent fees, report cards, transport, canteen, library, activity, consents, updates tab.

**A second, unrelated bug class found via the same testing process:** `ListTile.onTap` inside an opaque `AppCard` (no intervening `Material`) makes tap ink-splash feedback invisible — a real accessibility/feedback issue, not overflow. Found and fixed in `teacher_profile_screen.dart` `_MenuTile` and `principal_screens.dart` `_MenuGroup`. The codebase already has the correct pattern elsewhere (`_StudentSummaryRow` wraps in `Material(color: transparent)`) — these two just missed it. **Not exhaustively audited** — there are ~20 more `ListTile` call sites across the app; only the two found via test execution were fixed. Worth a dedicated pass if tap-feedback consistency matters.

### Phase 5 addendum — 2 more bugs found only by real-device testing

Widget tests simulate layout accurately but can miss things a real device surfaces immediately. Verified on a Pixel 10 Pro emulator (Android, arm64) at 360×640 (smallest matrix entry) and at the OS's real accessibility text-scale setting (`Settings → font_scale`, not a simulated `TextScaler` — the actual system setting):

| # | Location | What real-device testing caught that widget tests didn't | Fix |
|---|---|---|---|
| 11 | `principal_screens.dart` `_SummaryStrip` (Attention Center Critical/High/Medium) | The earlier ellipsis fix (bug #1 above) prevented the *crash*, but on an actual 360px phone at **normal 1.0x text scale** — not even scaled up — completely ordinary labels ("Critical", "Medium") rendered as "Critic…"/"Medi…", illegible in totally normal use. Adversarial tests only assert `no exception`; they don't catch "renders but is unreadable." | Replaced `_SummaryStrip` with the already-Wrap-based `_SummaryCards` (same shared component as fix #2) and deleted the now-dead class |
| 12 | `principal_screens.dart` `_PrincipalBottomNav` | At real OS text scale 1.3x, "Approvals" wrapped to "Approval"/"s" on two lines. This nav bar is Principal-specific (not `RoleShellScaffold`, which Teacher/Parent use and which already has compact label sizing) — it was simply missed when that fix was applied elsewhere | Applied the same `NavigationBarTheme` compact-label treatment `RoleShellScaffold` already uses |

Both verified fixed with a before/after screenshot on-device, not just a re-run test. Commits `44b1d635`, `52c68cba`.

**Takeaway:** adversarial widget testing (this audit's primary method) is good at catching crashes but can miss "renders without crashing but is illegible" — that class of bug needs actual visual inspection, ideally on a real device/emulator, not just `tester.takeException()`. The `ListTile` tap-feedback gap noted above is the same category of "compiles clean, tests green, but wrong in practice."

---

## 4. Accessibility problems

- **Text scale 1.3x/1.5x:** the 10 overflow bugs above are the concrete accessibility findings from this pass — text that clips or crashes at large scale is a hard accessibility failure, not a nice-to-have. All now verified overflow-free at 1.5x on a 320px-wide device.
- **Tap feedback:** see the `Material`/`ListTile` finding above — partial fix, not exhaustive.
- **Not audited this pass:** screen-reader label coverage (`Semantics`/`tooltip` completeness), color contrast ratios, focus order for keyboard/switch navigation, reduced-motion support. These need a dedicated pass with accessibility-scanner tooling or TalkBack/VoiceOver manual walkthroughs — static code review alone can't verify them reliably.

---

## 5. Navigation problems

- **Bottom-nav item counts:** Parent (`SchoolOsAppShell`), Teacher, and Principal shells all use exactly 5 primary items, matching the brief's recommended structure and the "≤5 items" rule.
- **One dead-code inconsistency found:** `RoleShellScaffold._itemsForRole('PARENT')` defines a *different*, 6-item nav set (Home, Children, Attendance, Homework, Notices, More) than what `SchoolOsAppShell` actually shows. Verified via `grep` that `RoleShellScaffold` is never invoked with `role: 'PARENT'` anywhere in the codebase — **this is unreachable dead code, not a live bug.** Worth deleting so a future edit doesn't accidentally wire it up and reintroduce the inconsistency.
- Role/permission-gated navigation, deep-link re-authorization, and logout state-clearing were not independently re-verified this pass (prior session memory notes these were addressed earlier; not re-confirmed here — treat as unverified until re-checked).

---

## 6. Performance findings

**Not measured this pass.** No DevTools timeline capture, no frame-build profiling, no API call-count audit was run. The brief's performance checklist (rebuild frequency, request duplication, JSON parsing cost, list virtualization) needs an actual profiling session against a running app/emulator — static review can flag obvious anti-patterns (none of the obvious ones — unbounded `ListView` without builders, missing `const`, N+1 provider watches — turned up during the extensive code reading this pass) but can't produce real numbers. Flag this as the next concrete gap if performance is a priority.

---

## 7. App size (measured, see commit `7a098a70`)

| Artifact | Before | After removing 5 unused packages | Change |
|---|---|---|---|
| AAB (arm64 target, `--analyze-size`) | 30.5 MB | 21.9 MB | −28% |
| Split APK arm64-v8a (most common device) | 28.3 MB | 21.8 MB | −23% |
| Split APK armeabi-v7a | 24.2 MB | 19.5 MB | −19% |
| Split APK x86_64 | 30.8 MB | 23.4 MB | −24% |

arm64-v8a now sits at 21.8 MB, comfortably inside the brief's 25–35 MB "preferred" Android guardrail.

A plain multi-ABI `flutter build appbundle --release` (the actual Play Console upload artifact, no `--target-platform` restriction) is **59.3 MB** — this is the upload size, not the per-device download size. Play's dynamic delivery serves only the matching ABI slice per device, which is what the single-ABI numbers above approximate; there's no `bundletool` available in this environment to get Play's exact per-device figure (downloading it wasn't attempted — installing and running new executables from the internet is outside what this session does without explicit sign-off).

**iOS: not measured.** Xcode is only a Command Line Tools install on the machine used for this audit (`xcodebuild -version` fails; `flutter doctor` flags it incomplete). No iOS build, archive, or size estimate is possible without a full Xcode install on a Mac.

### Largest remaining contributors (arm64-v8a, post-cleanup)
- `libflutter.so` — ~11 MB. Fixed Flutter engine cost, not reducible without deferred-loading tricks that would hurt the "one cohesive app" goal.
- `libapp.so` (Dart AOT) — ~8 MB, of which `package:flutter` is 3 MB and the app's own code (`package:schoolos_mobile`) is 1 MB.
- `classes.dex` — 832 KB (Android/Kotlin plugin glue).
- Assets — 142 KB. **No bundled image/media assets exist in the project** (no `assets:` section in `pubspec.yaml`); icon fonts are already tree-shaken 97–99%.

### Package/asset contributors — action taken
Found via `grep -rl "package:$pkg/" lib/` for every direct dependency in `pubspec.yaml`: **5 of 24 direct dependencies had zero usages anywhere in `lib/`** — `mobile_scanner` (pulled in a 4.7 MB Google ML Kit native barcode-scanner lib, `libbarhopper_v3.so`, plus Play Services/Firebase transitive properties, for a feature nothing in the app calls), `flutter_local_notifications`, `qr_flutter`, `web_socket_channel`, `json_annotation` (no `.g.dart` files exist either). All 5 removed in commit `7a098a70`; `flutter analyze` clean and 139/139 tests still pass after removal.

---

## 8. Backend/API gaps (self-documented in code, verified present)

These are honest in-app messages already written by the team acknowledging a missing backend contract — not assumptions on my part:

| Screen | Gap |
|---|---|
| Principal Tasks | "Follow-up task creation is not enabled in the principal app yet. Use the school operations workspace for now." |
| Principal Walkthroughs | New-observation capture and follow-up capture both explicitly disabled, read-only |
| Parent Consents | Trip permission requests: "not enabled in the parent app yet" |
| Parent Consents | Authorized pickup: "No pickup contact is activated from mobile" |
| Teacher Messages | Search box exists but doesn't filter — "uses the backend thread filter in the next mobile refinement" |
| Teacher Profile | "My Timetable" tile subtitle reads "Needs mobile timetable DTO" — **this appears stale**: `TeacherTimetableScreen` (linked from that same tile) already renders real `TeacherTimetableSnapshot` data from `teacherTimetableProvider`, fully functional, tested this session. Needs a product/backend check to confirm whether the label is outdated or whether there's a narrower remaining gap this label refers to. |
| Teacher Profile | "Leave Requests" tile: "Needs own-staff teacher route confirmation" — not wired to any route (`onTap: null`), genuinely unimplemented |
| Parent child documents | `child_profile_screen.dart` lists protected documents with status badges but **has no download/preview action at all** — `ParentRepository` only has download methods for receipts, report cards, and homework attachments, not generic student documents. Flagged as a real gap in an earlier session, not yet actioned. |

---

## 9. Mobile-DTO / admin-API-shape findings

- **Teacher and Parent** screens consistently consume typed domain models (`TeacherHomeworkItem`, `ParentFeeInvoice`, `ParentDashboardSummary`, etc.) built by `fromJson` factories in `domain/*_models.dart` files — this is the correct pattern.
- **Principal** screens are the outlier: almost everything (`_DashboardBody`, `_SnapshotBody`, `_ItemList`, `_SummaryCards`, escalations, approvals, tasks, walkthroughs) consumes raw `Map<String, dynamic>` straight from the API response, read with ad-hoc helpers (`_string()`, `_num()`, `_list()`) instead of typed models. This isn't necessarily wrong — it may reflect that principal snapshot endpoints are intentionally generic/shared — but it means there's no compile-time safety on principal screens the way there is for teacher/parent, and it's worth confirming with backend whether these are genuine mobile-shaped DTOs or the same shape used by the web admin dashboard. Not enough evidence from the frontend alone to say which; flagging as a question for backend/API confirmation rather than a confirmed defect.

---

## 10. Summary

12 real overflow/accessibility/tap-feedback bugs found and fixed across this audit (commits `59aeb79b`, `8037889f`, `ef3ab420`, `44b1d635`, `52c68cba`) — 10 from adversarial widget testing, 2 more (bugs #11–12) found only by actually running the app on a real device/emulator, which is itself a finding: widget tests alone weren't sufficient. One dead-code navigation inconsistency found (safe to delete, not urgent). One meaningful size win shipped (−23% on the most common Android ABI) by removing confirmed-unused dependencies (commit `7a098a70`). Full Phase 5 verification checklist (`pub get`, `dart format`, `analyze`, `test`, debug APK, release AAB) passes clean; iOS build fails immediately due to incomplete Xcode, not a code issue. Two open items need a decision from you, not more code archaeology: the stale "Needs mobile timetable DTO" label, and whether Principal's raw-JSON-map pattern is intentional.

**Not done this pass, needed before claiming "production-ready":** accessibility scanner/screen-reader pass, real performance profiling, iOS build/size (blocked on tooling — needs a full Xcode install), and login-gated real-device QA beyond Principal (this session's device testing authenticated as Principal only; Parent and Teacher personas were verified via widget tests but not walked on-device).
