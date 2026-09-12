# SchoolOS Mobile App Design Charter — GPT-6 Astra

## Purpose

This document governs **only the design, UX, interaction architecture, visual system, responsiveness, accessibility, and frontend quality of the SchoolOS Flutter mobile application**.

It is written specifically so an advanced autonomous engineering model such as **GPT-6 Astra** can use its strengths in:

- repository-wide inspection;
- visual reasoning;
- UI hierarchy analysis;
- interaction design;
- Flutter implementation;
- cross-screen consistency;
- accessibility review;
- responsive/adaptive layout reasoning;
- iOS and Android convention awareness;
- rendered-app inspection;
- regression detection;
- iterative visual QA;
- testing and refinement.

This file is **not** a backend roadmap, API specification, database specification, finance specification, or web-design document.

Backend behavior may be referenced only when the mobile UI must represent a real backend state correctly.

The objective is to make SchoolOS feel like a **coherent, polished, trustworthy, production-grade mobile application designed specifically for frequent school use**, not a set of web screens compressed onto a phone.

---

# 1. Design Mission

The SchoolOS app must be:

- mobile-first;
- fast to understand;
- fast to operate;
- role-aware;
- one-hand friendly;
- visually calm;
- information-efficient;
- consistent across the complete app;
- accessible;
- resilient under weak connectivity;
- explicit about offline and synchronization state;
- trustworthy around sensitive school information;
- appropriate for repeated daily use;
- scalable as features grow;
- familiar on both iOS and Android;
- adapted to platform conventions without creating two different products.

The mobile app must **not** become a miniature clone of the SchoolOS web application.

Mobile exists for:

- immediate information;
- frequent daily actions;
- time-sensitive workflows;
- quick approvals;
- classroom operations;
- parent awareness;
- notifications;
- lightweight capture;
- offline-safe work;
- contextual actions.

Dense configuration, high-volume administration, large reports, bulk editing, and complex tables should remain web-first unless there is a strong mobile use case.

---

# 2. Astra Operating Principle

When Astra is asked to redesign or improve the SchoolOS app, it must not begin by randomly restyling screens.

It must follow this sequence:

```text
Inspect existing Flutter application
        ↓
Map current routes and navigation
        ↓
Map personas and feature surfaces
        ↓
Inspect existing shared widgets/tokens/theme
        ↓
Inspect representative screens from every persona
        ↓
Identify repeated UX/design problems
        ↓
Define or refine one coherent mobile design system
        ↓
Refactor shared primitives first where justified
        ↓
Improve highest-frequency flows
        ↓
Migrate remaining screens consistently
        ↓
Run app and inspect rendered output
        ↓
Test real device sizes
        ↓
Test iOS + Android behavior
        ↓
Test text scaling/accessibility
        ↓
Test loading/error/offline/sync states
        ↓
Fix visual and interaction regressions
        ↓
Re-run targeted tests and Flutter quality gates
```

Astra must prefer **systemic fixes** over isolated cosmetic patches.

If ten screens use an inconsistent card, input, list row, section header, or status badge, fix the reusable primitive or design rule rather than producing ten unrelated variants.

---

# 3. Inspect Before Redesigning

Before major visual work, inspect at minimum:

- `apps/schoolos_mobile/lib/app`
- `apps/schoolos_mobile/lib/core`
- `apps/schoolos_mobile/lib/features`
- `apps/schoolos_mobile/lib/shared`
- routing and navigation;
- app theme and design tokens;
- reusable widgets;
- typography;
- spacing;
- forms;
- buttons;
- lists;
- cards;
- dialogs;
- bottom sheets;
- status chips;
- loading states;
- error states;
- offline states;
- empty states;
- permission states;
- authentication flow;
- biometric flow;
- notifications;
- child switching;
- teacher class switching;
- principal attention/approval flows;
- profile/settings;
- current Flutter tests related to affected surfaces.

Do not assume a component is missing before searching for an existing equivalent.

Do not introduce a parallel design system when one can be evolved safely.

---

# 4. Primary Mobile Personas

The production mobile experience should primarily optimize for:

```text
Parent / Guardian
Teacher
Principal
```

Other feature code may exist in the repository, but design work must not silently expand product scope simply because a directory or route exists.

Every persona should feel like a purpose-built app experience rather than the same dashboard with different cards hidden.

---

# 5. Persona Design Philosophy

## Parent

The parent experience should answer four questions quickly:

```text
Is my child okay?
What happened today?
What requires my attention?
What do I need to do next?
```

The parent app should prioritize:

- child context;
- attendance;
- homework;
- timetable/calendar;
- published results;
- fees/receipts where enabled;
- notices;
- notifications;
- requests/corrections;
- school updates;
- transport status where enabled;
- profile/security.

The parent should never have to understand the school's internal module structure.

Use parent-facing language rather than ERP terminology.

Avoid exposing irrelevant internal IDs, workflow jargon, database concepts, posting states, or administrative terminology.

### Parent navigation target

A strong default model is:

```text
Home
Updates
Calendar
Requests
Profile
```

Child-specific features should be surfaced contextually rather than forcing every module into bottom navigation.

If multiple children are linked, the active child context must always be obvious.

Never allow a child switch to create ambiguous content ownership.

---

## Teacher

The teacher experience should optimize for **speed during a school day**.

Primary questions:

```text
What class do I have now?
What must I do next?
Which tasks are incomplete?
Can I finish this in seconds?
```

The app should prioritize:

- today's timetable;
- current/next class;
- attendance;
- assigned classes;
- homework;
- quick marks/CAS where approved;
- activity capture;
- substitutions;
- notices;
- notifications;
- offline/sync state;
- leave/self-service items;
- profile/security.

### Teacher navigation target

```text
Today
Attendance
Classes
Homework
More
```

`More` can contain lower-frequency functions such as:

- marks;
- timetable;
- activities;
- notices;
- notifications;
- leave;
- payslips where permitted;
- settings;
- sync status;
- security.

High-frequency classroom actions must not be buried under multiple menus.

---

## Principal

The principal app is an **attention and decision surface**, not a mobile replica of the admin dashboard.

Primary questions:

```text
What needs my attention now?
What requires approval?
Is the school operating normally?
What is unusually risky today?
```

The app should prioritize:

- operational overview;
- attention items;
- approvals;
- attendance exceptions;
- academic readiness;
- staff absence impact;
- critical finance exceptions;
- unresolved communication failures;
- safety alerts;
- operational disruptions;
- notifications.

### Principal navigation target

```text
Overview
Attention
Approvals
School
Notifications
```

The principal app should emphasize exceptions over raw totals.

A principal should not need to inspect ten charts to discover one urgent issue.

---

# 6. Mobile Information Architecture

Navigation must remain shallow and predictable.

Prefer:

```text
Primary destination
    ↓
Focused list
    ↓
Record/detail
    ↓
Action
```

Avoid:

```text
Menu
→ submenu
→ module menu
→ category
→ feature
→ tab
→ record
```

Rules:

- bottom navigation is reserved for highest-frequency destinations;
- use no more destinations than can remain immediately understandable;
- secondary actions belong in contextual menus, sheets, or detail surfaces;
- use tabs only where sibling views genuinely share one context;
- never duplicate the same destination in several competing navigation systems;
- preserve expected back behavior;
- deep links must land in an understandable context;
- notification deep links must preserve persona and child/class context;
- switching school/child/account context must not silently retain stale content.

---

# 7. One-Handed Usage

Design for thumb reach.

Frequent actions should generally live in the comfortable lower and middle screen zones.

Do not repeatedly place essential primary actions at the extreme top of tall phones.

Use bottom sheets, bottom actions, sticky action areas, and reachable controls where appropriate.

Examples of high-frequency actions that deserve easy reach:

- mark attendance;
- submit attendance;
- publish homework;
- acknowledge notice;
- approve/reject an item;
- switch child;
- open next class;
- retry sync;
- respond to an urgent action item.

Avoid floating action buttons unless the action is genuinely primary and the FAB does not obscure content or conflict with navigation.

---

# 8. Visual Character

SchoolOS mobile should feel:

- modern;
- professional;
- calm;
- approachable;
- dependable;
- clear;
- lightweight;
- institutionally credible.

It must **not** look like:

- a generic AI-generated SaaS dashboard;
- a banking app unless the workflow is financial;
- a social network;
- a children's game;
- a collection of Material demo screens;
- a web application placed inside a narrow viewport.

Avoid habitual AI design patterns:

- excessive gradients;
- glassmorphism everywhere;
- oversized decorative cards;
- giant titles consuming the first viewport;
- random pastel backgrounds;
- excessive pill-shaped containers;
- meaningless charts;
- icon grids with no hierarchy;
- excessive shadows;
- unnecessary animations;
- nested cards inside cards;
- ornamental blobs;
- every section using a different accent color;
- every statistic becoming a dashboard tile.

Visual hierarchy should come primarily from:

- typography;
- spacing;
- grouping;
- alignment;
- subtle surfaces;
- meaningful emphasis;
- restrained semantic color;
- position;
- progressive disclosure.

---

# 9. Design Tokens

Astra should converge the app toward explicit reusable tokens rather than arbitrary values scattered through screens.

At minimum define or normalize:

- color roles;
- typography roles;
- spacing scale;
- radii;
- elevation/surface behavior;
- icon sizes;
- control heights;
- touch target minimums;
- divider rules;
- semantic statuses;
- animation durations;
- breakpoints/adaptive rules where required.

Do not hard-code visually similar but slightly different values across screens.

Example conceptual spacing scale:

```text
4  — micro relationship
8  — tight relationship
12 — compact component spacing
16 — default component spacing
24 — section spacing
32 — strong section separation
```

The exact implementation should follow repository conventions rather than blindly copying this scale.

---

# 10. Color System

Color must communicate purpose.

Define semantic roles such as:

```text
primary
surface
surfaceVariant
background
textPrimary
textSecondary
border
success
warning
critical
information
pending
disabled
```

Rules:

- do not encode important status using color alone;
- maintain accessible contrast;
- reserve red for actual critical/error/destructive meaning;
- reserve strong accent color for meaningful emphasis;
- avoid a different arbitrary module color for every feature;
- dark mode must remain structurally coherent, not simply invert colors;
- status colors must be consistent throughout Parent, Teacher, and Principal surfaces.

---

# 11. Typography

SchoolOS already supports Latin and Devanagari typography; designs must treat Nepali as a first-class language rather than an afterthought.

Typography must remain readable under:

- English;
- Nepali;
- longer translated labels;
- large accessibility text;
- dynamic type/text scaling.

Create a clear hierarchy for:

- page title;
- section title;
- card/list title;
- body;
- supporting text;
- metadata;
- labels;
- buttons;
- status text;
- numeric emphasis.

Do not use tiny text to force information onto one line.

Do not rely on font weight alone for every hierarchy distinction.

Avoid excessive typography sizes.

This is an operational app, not an editorial landing page.

---

# 12. Icons

Icons must be:

- familiar;
- semantically correct;
- consistent in style;
- supported by labels where ambiguity exists.

Do not use icons as decoration when they add no information.

Avoid placing a colored icon container beside every list item simply because it looks modern.

Critical actions must not be icon-only unless the meaning is universally established and accessible labeling exists.

---

# 13. Cards

Cards should be used only when they express a meaningful grouped object or action.

Good uses:

- child summary;
- current class;
- approval item;
- upcoming event;
- payment/receipt summary;
- notice preview;
- operational attention item.

Bad uses:

- wrapping every heading;
- every row in a long list;
- nested cards;
- turning navigation into dozens of tiles;
- presenting data that would scan better in a simple row/section.

Prefer lists and grouped sections for repeated information.

---

# 14. Lists

Lists are one of the most important mobile primitives in SchoolOS.

A list row should clearly communicate:

```text
Primary identity
Secondary context
Status
Relevant metadata
Available action
```

Rows must remain scannable.

Use separators, spacing, or grouped surfaces instead of turning every row into a floating card.

Support:

- loading;
- empty;
- error;
- retry;
- refresh;
- pagination where required;
- stale-data indication;
- offline cached state.

Do not display infinite spinners without explaining what is happening.

---

# 15. Forms

Forms must be optimized for phones.

Rules:

- one clear task per form;
- correct keyboard/input types;
- explicit labels;
- helpful validation;
- preserve entered data after recoverable errors;
- avoid unnecessarily long forms;
- divide complex workflows into logical sections;
- do not use placeholder text as the only label;
- show required fields clearly;
- avoid modal dialogs for complex form entry;
- use bottom sheets only for short, focused interactions;
- keep submit actions visible/reachable where useful;
- prevent accidental duplicate submission;
- show submission progress when meaningful.

Errors should explain how to recover.

Bad:

```text
Invalid input
```

Better:

```text
Enter a valid Nepal mobile number.
```

---

# 16. Bottom Sheets

Use bottom sheets for:

- quick filters;
- simple selectors;
- short contextual actions;
- confirmation with supporting context;
- compact status explanations.

Do not use bottom sheets as substitutes for full screens when the workflow includes:

- many fields;
- complex validation;
- long content;
- nested navigation;
- multi-stage tasks.

Sheets must account for keyboard height and device safe areas.

---

# 17. Dialogs and Confirmation

Dialogs should be rare.

Use them for consequential decisions such as:

- destructive action;
- final submission;
- irreversible transition;
- sensitive approval;
- logout/session revocation where confirmation is useful.

A confirmation must explain the consequence.

Avoid generic:

```text
Are you sure?
```

Prefer:

```text
Submit attendance for Grade 8A?
You can no longer edit it directly after submission.
```

---

# 18. Home/Dashboard Design

A mobile home screen is not a desktop dashboard.

Do not fill the first screen with a grid of metrics.

The home screen should combine:

```text
Context
+ attention
+ next actions
+ today's information
```

Every persona should have a different content priority.

### Parent home

Prefer:

- active child identity;
- today's attendance/status;
- next important event;
- homework requiring attention;
- unread/urgent notice;
- upcoming payment or deadline where relevant;
- quick child switch.

### Teacher home

Prefer:

- current/next period;
- attendance due;
- today's classes;
- homework/marks deadlines;
- substitution changes;
- sync warning;
- actionable alerts.

### Principal home

Prefer:

- high-priority attention items;
- pending approvals;
- missing attendance submissions;
- critical staff/academic/communication exceptions;
- concise school operating status.

Charts should appear only when the trend itself supports a decision.

---

# 19. Attendance UX

Attendance is a high-frequency teacher workflow and must be exceptionally efficient.

Design goals:

- open correct class quickly;
- display only authorized roster;
- mark common state with minimal taps;
- support "mark all present" then exceptions;
- clearly distinguish present/absent/late/excused states;
- allow reason entry without excessive navigation;
- preserve draft state;
- show offline status;
- show sync state;
- prevent accidental duplicate submissions;
- clearly distinguish draft vs submitted vs finalized/locked;
- make correction flow visually distinct from ordinary editing.

A teacher should not need to open a separate screen for every student.

Sync/conflict states must never be hidden behind generic success messaging.

---

# 20. Homework UX

Teacher homework creation should be optimized for speed.

Prefer a compact workflow:

```text
Class/subject context
→ title/instructions
→ due date
→ optional attachment
→ publish/schedule
```

Parent homework presentation should emphasize:

- subject;
- task;
- due date;
- status;
- attachment;
- teacher feedback where available.

Use meaningful grouping:

```text
Due today
Upcoming
Overdue
Completed
```

Avoid presenting homework as an undifferentiated chronological feed.

---

# 21. Timetable UX

Timetable must be optimized for "what happens now/next" rather than only displaying a grid.

Teacher view should emphasize:

- current class;
- next class;
- location/room if relevant;
- substitutions;
- changes;
- day's schedule.

Parent view should emphasize the selected child's current day and upcoming schedule.

Full-week timetable remains accessible but should not dominate the initial view on small screens.

---

# 22. Results and Academic Information

Parent results must clearly distinguish:

- published/final;
- provisional where applicable;
- corrected;
- unavailable/not published.

Avoid exposing internal workflow states that parents do not need.

Use hierarchy so users can understand overall result and then drill into subject/component detail.

Do not make long academic information dependent on horizontal scrolling.

Report-card access should be clearly differentiated from quick result summaries.

---

# 23. Notices and Notifications

Do not treat notices and notifications as identical.

### Notices

Formal school communication with:

- title;
- publisher;
- date;
- audience context;
- priority;
- attachments;
- read/acknowledgement state;
- corrected/superseded state.

### Notifications

Event-driven alerts that should usually deep-link to the source context.

Notification UI must:

- group meaningfully;
- indicate unread state without excessive visual noise;
- distinguish critical from routine;
- avoid leaking sensitive detail on lock-screen previews;
- clearly identify the related child/class/context.

---

# 24. Principal Attention and Approvals

Principal attention lists must be ordered by **importance and actionability**, not just recency.

Every attention item should answer:

```text
What happened?
Why does it matter?
Which context is affected?
What action is expected?
By when?
```

Approval cards must show enough context to make a responsible decision without forcing unnecessary navigation.

Avoid one-tap destructive or high-risk approvals without confirmation.

---

# 25. Authentication UX

Authentication must feel secure but simple.

Design complete states for:

- initial login;
- invalid credentials;
- expired credentials where applicable;
- forgot password;
- reset password;
- session expiry;
- revoked session;
- tenant/school unavailable;
- account disabled;
- no network;
- server unavailable.

Never collapse all failures into:

```text
Something went wrong
```

when a safer, actionable explanation can be provided.

---

# 26. Biometric UX

After a successful first credential login, eligible Parent, Teacher, and Principal users may be offered device biometric unlock.

The UI must:

- clearly explain what biometric login does;
- identify Face ID/fingerprint/device authentication appropriately;
- make setup optional;
- provide Skip/Not now;
- allow later activation from Settings;
- maintain password/credential fallback;
- gracefully handle biometrics removed/changed/locked out;
- never imply SchoolOS stores raw biometric data.

Do not repeatedly nag a user who declines setup.

---

# 27. Offline-First UX

Offline support is a core mobile design requirement.

The interface must explicitly distinguish:

```text
Online
Offline
Cached
Draft saved locally
Waiting to sync
Syncing
Synced
Sync failed
Conflict
Access changed
```

Do not communicate offline state only through a tiny connection icon.

Users need confidence about whether work is safe.

Examples:

```text
Attendance saved on this device
Will sync when you're online
```

or:

```text
Sync conflict
This attendance record changed on the server while you were offline.
Review before continuing.
```

Never display "Saved" when the system only means "queued locally" if that distinction matters.

High-risk actions that are online-only must be visibly disabled/explained rather than failing mysteriously after input is completed.

---

# 28. Connectivity States

Design for Nepal's realistic connectivity conditions:

- slow connection;
- packet loss;
- short disconnection;
- long offline period;
- app resumed after hours;
- failed background synchronization;
- Wi-Fi/mobile network switching.

The app should avoid modal interruption for every short connection fluctuation.

Use calm persistent status for routine offline operation and stronger intervention only when an action cannot continue safely.

---

# 29. Loading States

Prefer contextual skeletons or progress states over blocking full-screen spinners.

Rules:

- do not flash loading UI for trivial cached transitions;
- retain useful previous content while refreshing when safe;
- indicate refresh separately from initial load;
- avoid layout shift;
- show progress for long upload/sync operations;
- permit cancellation when reasonable.

---

# 30. Empty States

Empty states should explain the situation and next action.

Examples:

Bad:

```text
No data
```

Better:

```text
No homework due
Nothing has been assigned for the selected child this week.
```

or:

```text
No attendance session yet
Your next assigned class starts at 10:30 AM.
```

Do not make every empty state an illustration-heavy marketing card.

---

# 31. Error States

Every important screen needs intentional error design.

Errors should distinguish, where possible:

- no connection;
- timeout;
- server unavailable;
- session expired;
- permission denied;
- no longer assigned;
- record deleted/changed;
- validation failure;
- upload failure;
- synchronization conflict.

Provide appropriate recovery:

- retry;
- refresh;
- sign in again;
- go back;
- contact school/support;
- review conflict.

Do not expose raw HTTP errors or stack traces.

---

# 32. Permission States

Camera, notification, location, biometric, and storage-related permissions must have a clear pre-permission explanation when context is not self-evident.

Explain:

- why SchoolOS needs the permission;
- what feature depends on it;
- what happens if declined.

Do not repeatedly force permission prompts.

If permanently denied, provide a clear route to system settings only when relevant.

---

# 33. Accessibility

Treat accessibility as a design requirement, not a final QA pass.

All important screens must support:

- semantic labels;
- screen readers;
- logical focus order;
- sufficient contrast;
- text scaling;
- large touch targets;
- non-color status indicators;
- reduced motion where applicable;
- predictable navigation;
- accessible form errors;
- understandable icon labels;
- Nepali and English content.

Minimum touch targets should respect platform accessibility guidance.

Do not truncate critical information under larger text sizes.

Test at significantly increased font scale.

---

# 34. iOS and Android Adaptation

SchoolOS should share one design language while respecting platform expectations.

Astra must inspect whether Flutter components behave naturally on both platforms.

Consider platform conventions for:

- back navigation;
- system gestures;
- dialogs;
- date/time pickers;
- permission handling;
- biometric terminology;
- keyboard behavior;
- scrolling physics where appropriate;
- safe areas;
- status/navigation bars;
- share/open actions;
- notification settings.

Do not produce an Android-looking app on iOS merely because Material widgets are convenient.

Do not fork every screen into platform-specific implementations without a clear UX reason.

---

# 35. Responsive and Adaptive Mobile Layout

The app must work across:

- compact phones;
- large phones;
- different aspect ratios;
- tablets where supported;
- portrait;
- landscape where a workflow legitimately supports it;
- display cutouts;
- safe-area variations.

Avoid fixed pixel assumptions that only work on one reference phone.

On wider screens, improve information arrangement rather than merely stretching mobile cards edge-to-edge.

Do not make tablet layouts a desktop dashboard by default.

---

# 36. Keyboard and Input Behavior

Forms must remain usable when the keyboard opens.

Verify:

- focused field stays visible;
- primary actions are not permanently hidden;
- scrolling works;
- bottom sheets resize safely;
- appropriate input action Next/Done is used;
- keyboard types match the field;
- dismissal feels natural;
- no overflow occurs on small devices.

---

# 37. Motion

Motion should explain relationships, not decorate the interface.

Good motion:

- navigation continuity;
- expanding details;
- state transition;
- successful completion;
- lightweight feedback.

Bad motion:

- bouncing dashboards;
- decorative entrance animation for every card;
- long transitions delaying frequent workflows;
- animation that hides state changes;
- excessive parallax.

Frequent teacher workflows should feel almost instantaneous.

Respect reduced-motion preferences where applicable.

---

# 38. Haptics

Use haptic feedback selectively for meaningful moments such as:

- confirming a deliberate action;
- selection in high-frequency controls;
- error/destructive warning where platform-appropriate.

Do not add haptics to every tap.

---

# 39. Dark Mode

If dark mode is supported or being prepared, treat it as a designed theme.

Verify:

- all text contrast;
- cards/surfaces hierarchy;
- semantic colors;
- illustrations/images;
- disabled states;
- text fields;
- dialogs/sheets;
- system bars;
- charts;
- status colors.

Do not simply invert the light palette.

---

# 40. Localization and Nepal Context

SchoolOS is Nepal-scoped.

Mobile design must support:

- English;
- Nepali Unicode;
- Devanagari typography;
- Nepal time zone;
- NPR formatting;
- BS/AD presentation where required;
- Nepal phone formats;
- long Nepal administrative locality names;
- realistic low-connectivity behavior.

Do not allow English-only spacing assumptions to break Nepali layouts.

Avoid overly narrow controls that cannot accommodate translated labels.

---

# 41. Privacy in Visual Design

Sensitive data should not be unnecessarily exposed on shared/mobile screens.

Consider privacy for:

- student information;
- guardian details;
- marks;
- attendance;
- fees;
- staff salary;
- medical/safety information;
- notifications.

Use deliberate masking or reduced previews where appropriate.

Lock-screen notifications should not reveal sensitive details unnecessarily.

Do not rely on visual hiding as authorization; server-side authorization remains authoritative.

---

# 42. Destructive and High-Risk Actions

High-risk actions require stronger visual treatment than ordinary actions.

Examples:

- final attendance submission;
- approval/rejection;
- logout all sessions;
- deleting an unpublished draft;
- irreversible administrative actions exposed on mobile.

Destructive buttons must not be visually identical to neutral actions.

Do not position destructive actions where they are easy to hit accidentally.

---

# 43. Search

Search should exist only where the dataset and workflow justify it.

Good mobile search experiences:

- immediate access;
- relevant scopes;
- clear empty results;
- recent query support only if useful;
- filters that remain understandable.

Do not place a search box on every screen.

Teachers must only search within authorized/assigned scope.

Parents should generally not need global student search.

---

# 44. Filters

Mobile filters should use concise chips, segmented controls, or a focused bottom sheet depending on complexity.

Always show active filters.

Provide an obvious way to reset.

Avoid carrying hidden filters between unrelated screens.

---

# 45. Dates and Calendars

Date presentation must remain consistent.

Avoid mixing formats arbitrarily.

When BS and AD are both supported, the relationship must be understandable and consistent.

Calendar interfaces should emphasize school-relevant events rather than imitate a generic productivity calendar.

---

# 46. Attachments and Media

Media workflows should account for mobile realities.

Design states for:

- choosing photo/file;
- camera capture;
- compression/processing;
- upload progress;
- offline draft;
- upload failure;
- retry;
- permission denied;
- file too large;
- unsupported type.

Do not block the entire screen while one attachment uploads when the workflow can remain usable.

---

# 47. Push Notifications and Deep Linking

Every push notification should have an intentional destination.

Astra must verify:

```text
Push received
→ tap
→ app opens/restores
→ authentication checked
→ correct persona context resolved
→ correct child/class/school resolved
→ source record opened
```

If the user no longer has access, show a safe state rather than a blank screen or stale cached record.

---

# 48. App Restart and Resume UX

Test:

- cold launch;
- background resume;
- session expiration while backgrounded;
- offline cold launch;
- cached content restoration;
- pending sync restoration;
- deep link cold launch;
- biometric unlock after resume;
- child/tenant access removed while app was inactive.

The app must not show blank screens during navigation/auth transitions.

---

# 49. Design System Components

Astra should identify and normalize a coherent set of reusable primitives, such as:

```text
AppScaffold
AppBar / ContextHeader
BottomNavigation
SectionHeader
PrimaryButton
SecondaryButton
DestructiveButton
IconButton
TextField
SearchField
Selector
StatusBadge
ListRow
MetricSummary (only where justified)
AttentionCard
NoticeCard
EmptyState
ErrorState
OfflineBanner
SyncIndicator
LoadingSkeleton
BottomSheetShell
ConfirmationDialog
Avatar / ChildAvatar
ContextSwitcher
```

Names above are conceptual; reuse existing project conventions when they already solve the problem.

Do not create duplicate components merely to rename them.

---

# 50. Avoid Screen-Specific Styling Drift

Astra must actively search for drift such as:

- five button styles for the same importance;
- inconsistent corner radius;
- different title spacing on each screen;
- random icon sizes;
- inconsistent bottom sheet padding;
- mixed status colors;
- inconsistent page backgrounds;
- different empty-state patterns;
- multiple unrelated loading indicators;
- different list-row heights without reason.

These are design-system bugs and should be fixed systematically.

---

# 51. Visual Density

SchoolOS is used frequently and should not waste screen space.

Aim for **comfortable operational density**, not sparse marketing-page density.

A useful screen should usually communicate meaningful information within the first viewport.

Do not add excessive top padding, giant greeting headers, or massive cards that force important content below the fold.

At the same time, avoid cramped enterprise UI that produces tiny touch targets.

---

# 52. Content Design

Mobile copy must be concise and actionable.

Prefer:

```text
Attendance submitted
```

over:

```text
Your attendance submission operation has been successfully completed.
```

Prefer human descriptions of state.

Avoid backend terms such as:

- entity;
- mutation;
- payload;
- provider callback;
- entitlement lookup;
- job status;
- HTTP error.

Use technical terminology only for advanced diagnostic/support surfaces where appropriate.

---

# 53. Trust and Feedback

Users should always know whether an action succeeded.

Use feedback proportional to importance:

- inline state change for trivial actions;
- toast/snackbar for lightweight confirmation;
- persistent state for sync/queued operations;
- dedicated completion state for consequential workflows.

Do not show repetitive success popups that slow frequent work.

---

# 54. Performance Perception

A design can feel slow even when API response times are acceptable.

Astra should optimize perceived performance through:

- immediate navigation feedback;
- cached content where safe;
- skeletons;
- optimistic UI only where correctness permits;
- reduced layout shift;
- lightweight images;
- progressive loading;
- avoiding unnecessary animation.

Never use optimistic success for authoritative operations when server acceptance is required.

---

# 55. Visual QA Protocol for Astra

A major redesign is incomplete until rendered output is inspected.

For every affected high-value screen, Astra should inspect at representative sizes such as:

```text
Small phone
Typical Android phone
Large Android phone
iPhone-class compact/standard size
Large iPhone-class size
Tablet/wide size if supported
```

Exact emulators/devices may vary.

Review:

- clipping;
- overflow;
- truncation;
- safe areas;
- keyboard overlap;
- visual hierarchy;
- touch target spacing;
- scroll behavior;
- bottom navigation;
- sheet/dialog sizing;
- font scaling;
- dark mode if supported;
- English/Nepali content;
- offline/error states.

Do not declare design work complete solely because Flutter builds successfully.

---

# 56. Interaction QA Protocol

For each redesigned flow, exercise the full interaction rather than opening only the first screen.

Examples:

### Teacher attendance

```text
Open Today
→ open class
→ mark attendance
→ mark exception
→ save draft
→ go offline
→ reopen draft
→ submit/sync
→ observe confirmation/state
```

### Parent notice

```text
Receive notification
→ open notice
→ read attachment
→ acknowledge
→ return to inbox
→ verify state
```

### Principal approval

```text
Open attention item
→ inspect context
→ approve/reject/return
→ confirm consequential action
→ verify resulting state
```

Design QA is incomplete if only static screenshots look correct.

---

# 57. Accessibility QA Protocol

For important screens, test:

- screen reader semantics;
- 200% or otherwise large text scaling where practical;
- contrast;
- non-color state communication;
- keyboard/focus behavior where relevant;
- touch target dimensions;
- orientation changes where supported;
- reduced motion;
- English/Nepali rendering.

Accessibility defects discovered during a design refactor are within scope when they affect the redesigned surface.

---

# 58. Regression Testing

After mobile UI work, run verification proportional to scope.

Typical checks:

```text
dart format
flutter analyze
relevant widget tests
relevant navigation tests
relevant state/provider tests
relevant regression tests
```

For navigation/auth changes, include route/session regression tests.

For shared design primitives, broaden verification because many screens may be affected.

Do not delete or weaken tests simply to accommodate a redesign.

---

# 59. Preserve Product Behavior

A visual redesign must not silently alter:

- authorization;
- backend semantics;
- attendance state transitions;
- marks/result rules;
- payment behavior;
- guardian scope;
- notification recipients;
- offline safety constraints;
- session security.

If a better UX requires backend capability that does not exist, surface the limitation rather than fabricating behavior client-side.

---

# 60. Astra Autonomy Rules

When repository evidence is sufficient, Astra should make reasonable design decisions and continue.

Do not stop merely because:

- many screens need migration;
- the redesign touches multiple feature directories;
- shared components require refactoring;
- visual QA reveals additional inconsistencies within the affected scope.

Continue until the requested design scope is coherent and verified.

Do not expand into unrelated backend or web work.

---

# 61. Design Prioritization

When the whole app needs improvement, prioritize in this order:

```text
1. Navigation and information architecture
2. Authentication/session/biometric flows
3. Shared design system primitives
4. Persona home screens
5. Teacher attendance and daily workflows
6. Parent child-centric daily information
7. Principal attention/approval flows
8. Notices/notifications
9. Homework/timetable
10. Results/fees/read-only high-value information
11. Profile/settings/security
12. Remaining lower-frequency screens
13. Comprehensive accessibility/responsive polish
```

Do not spend significant time polishing obscure screens while core navigation and high-frequency flows remain inconsistent.

---

# 62. Design Quality Gate

A redesigned SchoolOS mobile surface passes only if it is:

- understandable without training for its intended persona;
- visually consistent with the rest of the app;
- fast to operate;
- touch friendly;
- readable in English and Nepali;
- responsive to supported phone sizes;
- safe around notches/system areas;
- usable with larger text;
- explicit about loading/error/offline/sync state;
- compatible with iOS and Android expectations;
- free of obvious clipping/overflow;
- connected to real application behavior;
- verified interactively, not only statically.

---

# 63. Definition of Done for App Design Work

A mobile design task is not complete until all applicable items are true:

```text
[ ] existing relevant screens were audited first
[ ] information architecture was reviewed
[ ] navigation remains coherent
[ ] persona context is clear
[ ] reusable components were reused/refined
[ ] duplicate styling was reduced
[ ] visual hierarchy is intentional
[ ] spacing is consistent
[ ] typography is consistent
[ ] semantic colors are consistent
[ ] light/dark behavior is correct where supported
[ ] small phones were checked
[ ] large phones were checked
[ ] iOS behavior was considered/tested
[ ] Android behavior was considered/tested
[ ] safe areas are correct
[ ] keyboard behavior is correct
[ ] text scaling is acceptable
[ ] accessibility semantics are preserved/improved
[ ] loading state exists
[ ] empty state exists
[ ] error state exists
[ ] offline/sync state exists where relevant
[ ] permission state exists where relevant
[ ] deep linking still works where relevant
[ ] auth/session transitions remain stable
[ ] relevant Flutter tests pass
[ ] flutter analyze passes for affected work
[ ] no backend rule was duplicated as client authority
[ ] no placeholder or fake production data was introduced
[ ] rendered UI was visually inspected
[ ] affected flow was exercised interactively
```

---

# 64. Prohibited Design Behaviors

Do not:

- convert web pages directly into mobile screens;
- create a dashboard card for every piece of information;
- use large decorative headers that push actionable content down;
- add gradients merely to make the UI look modern;
- use glassmorphism as the default surface treatment;
- create a different visual identity for each module;
- hide status behind color alone;
- use tiny text to fit content;
- put critical actions outside comfortable reach without reason;
- use horizontal scrolling for normal forms/content;
- add icons without semantic value;
- add charts without decision value;
- use modal dialogs for complex workflows;
- show generic errors when a recoverable cause is known;
- label locally queued work as server-synced;
- imply offline high-risk actions are complete when they are not;
- show stale sensitive data after access revocation;
- bypass backend authorization for a smoother demo;
- invent backend data to fill visually empty designs;
- introduce inconsistent one-off components;
- break Nepali text layouts;
- ignore accessibility because a screen "looks fine";
- redesign only the happy path;
- declare completion without rendered-app inspection.

---

# 65. Final Design Standard

The final question is not:

> Does each individual SchoolOS screen look modern?

The correct question is:

> **Does the complete SchoolOS mobile application feel like one intentionally designed, production-grade school operating companion that a Parent, Teacher, or Principal can use confidently every day?**

The target experience should be recognizable by these qualities:

```text
Fast
Calm
Clear
Role-aware
Context-aware
Accessible
Offline-aware
Trustworthy
Native-feeling
Consistent
Operationally efficient
Nepal-ready
```

Astra should use its visual reasoning and implementation capability to continuously compare the rendered product against this standard, not merely generate code that compiles.

---

# 66. Astra Execution Instruction

When explicitly tasked with improving SchoolOS mobile design:

1. Read this document.
2. Inspect the actual current Flutter implementation.
3. Audit complete affected user journeys before editing.
4. Preserve real product rules and authorization.
5. Establish or refine reusable design primitives.
6. Fix information architecture before decorative styling.
7. Optimize Parent, Teacher, and Principal workflows independently.
8. Implement the redesign in Flutter using existing architecture where sound.
9. Run the app.
10. Inspect the rendered result visually.
11. Exercise real interactions.
12. Test representative device sizes.
13. Test loading, empty, error, offline, sync, permission, and revoked-access states where relevant.
14. Test accessibility and text scaling.
15. Fix defects discovered within the design scope.
16. Run proportional Flutter quality gates.
17. Do not declare completion until the mobile experience is coherent as a whole.

The goal is not a collection of attractive screenshots.

The goal is a **high-quality operational mobile product**.
