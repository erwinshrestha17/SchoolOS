# SchoolOS Mobile App Design — Astra Flutter Design & Execution Playbook

## Authority

This file is a **scoped mobile design and Flutter frontend execution playbook** for SchoolOS.

It applies to:

- `apps/schoolos_mobile`
- Parent mobile UX
- Teacher mobile UX
- Principal mobile UX
- Flutter design-system, accessibility, adaptation, offline-state, and visual QA work

This file is **not** an independent repository source of truth.

`AGENTS.md` remains authoritative for:

- product scope;
- Nepal-only roadmap boundaries;
- personas and access boundaries;
- module status;
- tenant isolation;
- authentication/authorization;
- financial/accounting rules;
- compliance;
- protected data;
- offline safety boundaries;
- backend authority;
- release and verification policy.

If this playbook conflicts with `AGENTS.md`, **`AGENTS.md` wins**.

This playbook may refine the mobile experience only within those boundaries.

---

# 1. Purpose

Guide GPT-6 Astra/Codex when auditing, redesigning, implementing, visually verifying, and continuously improving the SchoolOS Flutter application.

Use Astra's strengths in:

- repository-wide Flutter inspection;
- visual reasoning;
- interaction design;
- mobile information architecture;
- reusable widget/system consolidation;
- adaptive iOS/Android behavior;
- accessibility review;
- rendered-app inspection;
- regression detection;
- offline/sync-state UX;
- iterative device QA.

The goal is to make SchoolOS feel like a **coherent, polished, trustworthy, production-grade school companion app**, not a compressed copy of the Web application.

---

# 2. Mobile Product Role

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

Dense configuration, bulk administration, large reports, complex financial operations, high-risk corrections, and governance remain Web-first unless `AGENTS.md` or an explicit task defines a safe mobile use case.

---

# 3. Existing Flutter Context

SchoolOS Mobile currently uses technologies including:

- Flutter / Dart;
- Riverpod;
- GoRouter;
- Dio;
- Flutter Secure Storage;
- local authentication/biometrics;
- Firebase Messaging;
- connectivity awareness;
- Nepal date/localization utilities;
- platform permissions/location/media utilities where enabled.

Repository structure includes:

- `lib/app`
- `lib/core`
- `lib/features`
- `lib/shared`

Astra should improve the existing app and shared primitives before introducing overlapping architecture or a parallel design system.

---

# 4. Astra Execution Sequence

For broad mobile redesign or UX work:

```text
Read AGENTS.md
    ↓
Read this playbook
    ↓
Inspect Flutter routes/navigation
    ↓
Map Parent/Teacher/Principal flows
    ↓
Inspect theme/tokens/shared widgets
    ↓
Run the actual app
    ↓
Inspect representative screens
    ↓
Identify systemic UX/design problems
    ↓
Refine shared mobile design system
    ↓
Improve highest-frequency flows
    ↓
Migrate remaining screens consistently
    ↓
Test iOS/Android adaptation
    ↓
Test accessibility/text scaling
    ↓
Test loading/error/offline/sync states
    ↓
Run targeted Flutter quality gates
    ↓
Re-run and verify
```

Do not begin a broad redesign by randomly restyling individual screens.

Prefer systemic reusable fixes.

---

# 5. Mobile Personas

Primary production mobile personas:

- Parent / Guardian;
- Teacher;
- Principal.

Other feature code may exist, but design work MUST NOT silently expand product scope merely because a route/directory exists.

Every persona should feel purpose-built rather than like the same dashboard with hidden cards.

---

# 6. Parent Experience

The Parent experience should quickly answer:

```text
Is my child okay?
What happened today?
What requires my attention?
What do I need to do next?
```

Prioritize:

- active child identity;
- attendance;
- homework;
- timetable/calendar;
- published results;
- fees/receipts where enabled;
- notices;
- notifications;
- service/correction requests;
- school updates;
- transport status where enabled;
- profile/security.

Parents should not need to understand internal ERP/module terminology.

Never expose internal IDs, posting jargon, administrative workflow internals, or implementation detail without a real user need.

### Navigation target

```text
Home
Updates
Calendar
Requests
Profile
```

Child-specific features should be surfaced contextually.

When multiple children are linked, active child context MUST always be obvious.

A child switch MUST NOT retain ambiguous or unauthorized stale content.

---

# 7. Teacher Experience

Teacher mobile should optimize for speed during the school day.

Primary questions:

```text
What class do I have now?
What must I do next?
Which tasks are incomplete?
Can I finish this in seconds?
```

Prioritize:

- today's timetable;
- current/next class;
- attendance;
- assigned classes;
- homework;
- quick marks/CAS where safely enabled;
- activity capture;
- substitutions;
- notices;
- notifications;
- offline/sync state;
- leave/self-service;
- profile/security.

### Navigation target

```text
Today
Attendance
Classes
Homework
More
```

`More` may contain lower-frequency functions.

High-frequency classroom actions must not be buried beneath several menus.

Design visibility MUST NOT imply assignment authority; backend authorization remains authoritative.

---

# 8. Principal Experience

Principal mobile is an **attention and decision surface**, not a miniature Admin dashboard.

Primary questions:

```text
What needs my attention now?
What requires approval?
Is the school operating normally?
What is unusually risky today?
```

Prioritize:

- operational overview;
- attention items;
- approvals;
- attendance exceptions;
- academic readiness;
- staff absence impact;
- critical finance exceptions;
- communication failures;
- safety/operational alerts;
- notifications.

### Navigation target

```text
Overview
Attention
Approvals
School
Notifications
```

Emphasize exceptions over raw totals.

---

# 9. Shared SchoolOS Cross-Surface Contract

Mobile must share the same product semantics as Web for:

- terminology;
- business-state names;
- semantic status meaning;
- success/warning/error/critical semantics;
- Nepali + English quality;
- accessibility principles;
- sensitive-data treatment;
- identity context;
- date/time/currency meaning;
- loading/error/empty-state language principles;
- icon meaning for equivalent concepts.

Mobile does **not** require pixel parity with Web.

Mobile-specific patterns are expected where appropriate:

- bottom navigation;
- compact lists;
- bottom sheets;
- sticky/reachable actions;
- one-handed controls;
- adaptive iOS/Android conventions;
- explicit offline/sync affordances;
- gesture-aware interactions.

Never copy Web tables/navigation directly into mobile merely for consistency.

---

# 10. Mobile Information Architecture

Prefer shallow, predictable navigation:

```text
Primary destination
    ↓
Focused list
    ↓
Detail
    ↓
Action
```

Avoid deep module-oriented chains.

Rules:

- bottom navigation is reserved for highest-frequency destinations;
- secondary actions belong in contextual menus, sheets, or details;
- tabs are for genuine sibling views sharing one context;
- avoid duplicate destinations across competing navigation systems;
- preserve intuitive back behavior;
- deep links must land in understandable context;
- notification deep links must preserve persona + child/class context;
- context switches must not retain stale content.

---

# 11. One-Handed Use

Design for thumb reach.

Frequent actions should generally be placed in comfortable lower/middle screen zones where appropriate.

Use:

- bottom actions;
- sticky action regions;
- bottom sheets;
- reachable controls.

Examples:

- mark/submit attendance;
- publish homework;
- acknowledge notice;
- approve/reject;
- switch child;
- open next class;
- retry sync.

Avoid floating action buttons unless they are genuinely the dominant action and do not obstruct content/navigation.

---

# 12. Visual Character

SchoolOS Mobile should feel:

- modern;
- calm;
- professional;
- approachable;
- dependable;
- lightweight;
- institutionally credible;
- consistent across personas.

It must not look like:

- a generic AI SaaS app;
- a social network;
- a children's game;
- a collection of Material demos;
- a banking app outside financial flows;
- a web app squeezed onto a phone.

Avoid excessive:

- gradients;
- glassmorphism;
- oversized decorative cards;
- giant titles;
- random pastel backgrounds;
- pills everywhere;
- meaningless charts;
- icon grids;
- shadows;
- animations;
- nested cards;
- ornamental decoration.

Hierarchy should primarily come from typography, spacing, grouping, alignment, subtle surfaces, restrained semantic color, and progressive disclosure.

---

# 13. Design Tokens

Converge toward explicit reusable tokens for:

- color roles;
- typography roles;
- spacing;
- radii;
- elevation/surface behavior;
- icon sizes;
- control heights;
- minimum touch targets;
- dividers;
- semantic statuses;
- motion durations;
- adaptive breakpoints/rules where required.

Do not scatter slightly different hard-coded values across screens.

---

# 14. Color and Semantic Status

Use semantic roles such as:

- primary;
- surface/background;
- primary/secondary text;
- border;
- success;
- warning;
- critical;
- information;
- pending;
- disabled;
- draft;
- submitted;
- finalized;
- locked;
- published;
- failed;
- conflicted.

Rules:

- important meaning must not depend on color alone;
- maintain accessible contrast;
- reserve red for actual error/critical/destructive meaning;
- use strong accent sparingly;
- avoid arbitrary feature colors;
- dark mode must remain structurally coherent if supported;
- equivalent states must mean the same thing as Web.

---

# 15. Typography

SchoolOS supports Latin and Devanagari. Nepali must be treated as a first-class language.

Typography must remain usable with:

- English;
- Nepali;
- longer translated labels;
- dynamic text scaling;
- accessibility font sizes.

Use a clear hierarchy for page title, section title, row/card title, body, supporting text, metadata, labels, buttons, status, and numeric emphasis.

Do not use tiny text merely to keep content on one line.

---

# 16. Lists and Cards

Lists are a primary mobile primitive.

A good row communicates:

```text
Primary identity
Secondary context
Status
Relevant metadata
Available action
```

Use separators, grouping, and spacing instead of making every row a floating card.

Use cards only for meaningful grouped objects/actions such as:

- active child summary;
- current class;
- approval item;
- upcoming event;
- notice preview;
- payment/receipt summary;
- attention item.

Avoid nested cards and grid-of-tiles navigation unless genuinely superior.

---

# 17. Forms

Mobile forms should:

- focus on one clear task;
- use correct input/keyboard types;
- use explicit labels;
- provide recoverable validation;
- preserve entered data after recoverable failures;
- break complex forms into logical sections;
- clearly show required fields;
- avoid placeholder-only labels;
- avoid complex forms inside dialogs;
- keep submission actions reachable when useful;
- prevent accidental duplicate submission;
- show progress for meaningful network actions.

Errors should tell the user how to recover.

---

# 18. Bottom Sheets and Dialogs

Use bottom sheets for:

- quick filters;
- simple selectors;
- short contextual actions;
- compact explanations;
- brief confirmations.

Use full screens for complex, long, nested, multi-stage, or validation-heavy workflows.

Dialogs should be rare and reserved for consequential choices.

Confirmations should explain the consequence rather than say only “Are you sure?”.

---

# 19. Home Screen Principles

Mobile home is not a desktop dashboard.

Use:

```text
Context
+ attention
+ next actions
+ today's information
```

Do not fill the first screen with a grid of metrics.

### Parent home

Prioritize active child, today's status, homework/notice attention, next event, upcoming deadline/payment when relevant.

### Teacher home

Prioritize current/next class, attendance due, today's classes, substitutions, deadlines, sync warnings.

### Principal home

Prioritize high-priority attention, pending approvals, missing attendance, critical operational/academic/staff/communication exceptions.

---

# 20. Attendance UX

Attendance is a high-frequency authoritative workflow.

Design for:

- exact assigned roster;
- fast exception marking;
- clear draft/submitted/finalized state;
- offline draft visibility;
- pending sync visibility;
- failure/conflict visibility;
- safe retry;
- clear locked state;
- correction request path.

Never imply that a locally edited draft is final authoritative attendance before server acceptance.

Do not hide sync conflicts.

---

# 21. Homework / Class / Academic UX

Teacher flows should minimize taps for:

- choosing assigned context;
- creating homework;
- setting due date;
- attaching media;
- reviewing submissions;
- giving quick feedback;
- checking current/next class.

Academic result/marks screens must visually distinguish draft, submitted, locked, and published states consistently with `AGENTS.md`.

Do not expose unpublished parent data.

---

# 22. Principal Approval UX

Approval screens must show enough context to make a decision safely.

Include where relevant:

- what is being approved;
- who/what is affected;
- current state;
- reason/evidence;
- consequence of approval/rejection;
- audit-relevant confirmation.

Do not optimize approvals into blind swipe actions when context matters.

---

# 23. Authentication and Biometrics

Mobile auth UX must respect `AGENTS.md`.

Design for:

```text
Credential login
→ first successful login
→ optional biometric prompt when supported
→ user may skip
→ enable later in Settings
→ secure credential fallback
```

Also design intentional states for:

- expired session;
- revoked session;
- disabled account;
- changed school/tenant context;
- biometric unavailable;
- biometric failure;
- secure fallback.

Never imply that biometric authentication replaces server authorization.

---

# 24. Offline and Synchronization UX

The App playbook governs **how** safe offline state is communicated, not **what high-risk operations are allowed offline**. `AGENTS.md` controls that boundary.

Every offline-capable workflow should distinguish states such as:

- local draft;
- saved locally;
- pending sync;
- syncing;
- synced;
- stale;
- failed;
- conflicted;
- rejected because authority changed.

Principles:

- never show “saved” when only local persistence occurred unless wording makes that clear;
- never silently overwrite newer authoritative server data;
- explain conflicts in user language;
- provide retry when safe;
- show stale-data state when material;
- after role/assignment/guardian/session changes, now-unauthorized cached data must disappear/become inaccessible.

High-risk offline mutations prohibited by `AGENTS.md` remain prohibited regardless of design convenience.

---

# 25. Notifications and Deep Links

Notifications should:

- avoid sensitive lock-screen details;
- use clear action-oriented copy;
- deep-link to the correct persona/context;
- preserve child/class/school context;
- handle corrected/superseded notices clearly;
- handle expired/unauthorized deep-link targets gracefully.

Never route a user into data they are no longer authorized to access.

---

# 26. Loading, Empty, Error, Permission, and Offline States

Every meaningful screen should intentionally support:

- loading;
- empty;
- offline cached;
- no connection;
- API failure;
- no permission;
- disabled feature;
- stale state;
- partial failure;
- sync failure/conflict where applicable.

Never present unauthorized state as empty data.

Never present failed data as zero.

Avoid infinite spinners without explanation.

---

# 27. iOS and Android Adaptation

SchoolOS should remain one product while respecting platform conventions.

Consider platform-appropriate behavior for:

- back navigation;
- safe areas;
- system bars;
- text selection;
- haptics;
- permissions;
- biometrics;
- modal presentation;
- keyboard behavior;
- scrolling physics where appropriate.

Do not fork the entire visual identity by platform.

Use adaptive behavior only when it materially improves native usability.

---

# 28. Responsive and Device Adaptation

Test representative:

- small phones;
- large phones;
- common Android aspect ratios;
- iPhone safe areas/notches;
- accessibility text scaling;
- landscape only where the flow genuinely supports it;
- tablet layouts where SchoolOS chooses to support them.

Do not hard-code layouts around one flagship device size.

---

# 29. Accessibility

Audit:

- semantic labels;
- screen reader order;
- dynamic text scaling;
- touch target sizes;
- contrast;
- focus where applicable;
- non-color status communication;
- reduced motion;
- keyboard support on larger devices where relevant;
- accessible authentication alternatives;
- Nepali screen-reader/text behavior where possible.

Accessibility must be tested in priority flows, not only inferred from widgets.

---

# 30. Deferred Modules and Scope

Astra may visually normalize existing deferred-module screens when they are directly encountered in an explicitly scoped task.

Astra MUST NOT reactivate, expand, or promote deferred modules merely because feature code exists.

P0 scope restrictions in `AGENTS.md` remain authoritative.

---

# 31. Visual QA

When device/emulator tooling is available:

```text
Inspect source
→ Run app
→ Navigate real flow
→ Observe rendered result
→ Identify visual/interaction defects
→ Implement
→ Re-run
→ Compare
→ Repeat
```

For changed high-value flows, inspect:

- representative Android device;
- representative iOS device when available;
- small/large text;
- light/dark mode if supported;
- offline/no-network state;
- loading/empty/error states;
- long Nepali/English content;
- app restart/resume where state matters.

Do not rely only on source assumptions.

---

# 32. Verification

This playbook inherits the verification hierarchy in `AGENTS.md`.

For mobile UI-only work, usually run:

- targeted widget/unit tests;
- `flutter analyze`;
- affected navigation/state tests;
- rendered app inspection;
- representative device-size checks;
- accessibility/text-scaling checks.

If the design task changes auth, routing, offline state, permissions, finance, protected data, or synchronization logic, escalate verification according to `AGENTS.md`.

Visual QA alone is never sufficient for security- or data-sensitive changes.

---

# 33. Mobile Definition of Done

A mobile design task is complete only when applicable items pass:

- persona workflow is faster/clearer;
- one-handed usage is considered;
- navigation remains shallow/predictable;
- shared primitives are used consistently;
- equivalent states look/behave consistently;
- loading/empty/error/offline/permission states are intentional;
- sync state is truthful;
- child/class/school context is always clear;
- iOS/Android adaptation is reasonable;
- accessibility/text scaling is checked;
- Nepali/English presentation remains sound;
- no backend/security authority was moved into the client;
- prohibited high-risk offline actions remain prohibited;
- relevant tests/analyze pass;
- rendered output was inspected for broad design work;
- no unrelated module scope was expanded.

---

# Final Mobile Principle

SchoolOS Mobile should feel like **one intentionally designed, production-grade school operating companion** that Parent, Teacher, and Principal users can trust every day.

Use this playbook together with `AGENTS.md`.

`AGENTS.md` owns product/security/domain authority. This file owns the **mobile-specific design and Flutter execution discipline** within that authority.
