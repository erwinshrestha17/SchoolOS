# SchoolOS — Implementation Spec (Design → Production Handoff)

**Purpose of this file:** this repo holds a Claude-Design export (prototype HTML/JS + a design-system bundle) for **SchoolOS**, built from `erwinshrestha17/SchoolOS`. It is *not* the production codebase. Hand this file to a Claude Code session opened directly against `erwinshrestha17/SchoolOS` (`apps/web`) and have it implement the six module screens below **for real** — wired to actual data, persistence, auth, and role/entitlement checks — not the prototype's fake in-memory state.

If that session can also read this bundle's `project/` folder (tokens, component `.jsx`/`.d.ts`/`.prompt.md`, and `project/ui_kits/web/*`), use it as secondary reference. This spec is written to be self-contained regardless, since token values, component contracts, and screen behavior are inlined below.

---

## 0. What already exists vs. what's new

Per the design system's own notes, these **already exist** in `apps/web` and should NOT be rebuilt from scratch — only extended/reused:
- **UI primitives** (`components/ui/*`): `Button`, `Input`, `Checkbox`, `Card` (+ sub-parts), `Badge`, `StatusBadge`, `Avatar`, `MoneyDisplay`, `Progress`, `StatCard`. Exact contracts are in §2 — verify the live components still match; if they've drifted, the live code wins (don't "fix" it to match this spec).
- **Dashboard primitives** (`components/dashboard/*`): `StatCard`, `QuickActionCard`.
- **App shell** (`components/layout/*`): `Sidebar`, `TopBar`, `Logo`.
- **Screens**: Login, Home (command center), Fees & Receipts (list), Students (directory).

**Net-new work** — the six staff-facing screens designed in the Claude Design session, described in full in §3:
1. **Take Attendance** (`/attendance` or existing route)
2. **Collect a Payment** — fee counter (opens from Fees screen's primary action)
3. **Admissions** — application review queue
4. **Exams & Results** — marks entry
5. **Notices & Communication** — compose/send
6. **Reports & Exports** — report gallery

Plus: confirm truly plan-gated modules (Transport, Canteen, Library, HR/Staff, Accounting, Homework & Timetable, Learning, Activity Feed — whichever aren't built yet) render the existing `ModuleLockedState` component honestly rather than fabricated screens.

**First step for the implementing agent:** grep the live repo for each screen name/route before writing anything — some of these six may already be partially scaffolded. Don't duplicate; extend.

---

## 1. Product context & non-negotiables

SchoolOS is a **Nepal-first, multi-tenant school-management SaaS** in Internal QA / controlled-pilot preparation—the daily operating desk for School (Grade 1-10) and Higher Secondary (Grade 11-12 / +2). Guiding principle, every screen: **one screen = one main job.** Every screen answers *Where am I? What needs attention? What can I safely do next?*

**Voice / content rules — apply to every string you write:**
- School terms, not system terms: *Student* (not "entity"), *Guardian* (not "relation"), *Receipt*, *Class/Section*, *Staff*, *School Settings*, *Not enabled* (not "unauthorized module").
- Errors are school-friendly, never raw: *"Attendance is locked for this date."* / *"Receipt download is unavailable right now."* / *"This report is being prepared. You can download it when it's ready."* Never surface `403 Forbidden`, Prisma errors, stack traces, or raw object keys to the UI.
- "You / your" framing, addressed at the school ("your school").
- **Honest, never fake.** Prefer an empty/locked/error state over a fabricated number. **Official totals (fee amounts, KPI aggregates, grade calculations for the record) are backend-owned — never trust a client-side sum as the source of truth for anything persisted or printed on a receipt.** The client may *mirror* a computation live for responsiveness (e.g. the fee counter running total, exam grade-as-you-type), but the value that gets saved/printed must be recomputed and validated server-side.
- Casing: Title Case for page/section titles, sentence case for body copy, UPPERCASE tracked micro-labels for KPI/field labels and table headers.
- No emoji, ever. Meaning is carried by text + a Lucide icon + a semantic color — never color alone.
- One primary action per page header (top-right `Button`); everything else goes under a "More Actions" affordance.

**Icons:** Lucide only (`lucide-react`), 2px stroke, 24×24 grid. No emoji, no hand-drawn SVG, no unicode-as-icon.

**RBAC / entitlements — apply to every screen below:**
- Every module screen must check the user's **role/permission scope** (e.g. a teacher sees only their assigned classes' attendance/exam data; a principal/admin sees full scope) — mirror however the existing codebase already scopes queries (tenant + role), do not invent a new authorization layer.
- Every module screen must check the school's **plan entitlement** for that feature. If not entitled, render the existing `ModuleLockedState` instead of the screen — fail closed, no partial data leakage.

---

## 2. Design tokens & component contracts (source of truth: `apps/web/app/globals.css` + `components/ui/*`)

These are the exact values already established for SchoolOS — use them as the check against what's live; don't reinterpret or round them.

### Colors
```css
--primary: #155EEF; --primary-dark: #0B3A88; --primary-soft: #EAF1FF;
--secondary: #7C3AED; --secondary-soft: #F3E8FF;
--background: #F3F7FB; --surface: #FFFFFF; --surface-subtle: #F8FAFC;
--ink: #0F172A; --text-secondary: #475569; --muted: #64748B; --line: #E2E8F0;
--slate-50:#F8FAFC; --slate-100:#F1F5F9; --slate-200:#E2E8F0; --slate-300:#CBD5E1;
--slate-400:#94A3B8; --slate-500:#64748B; --slate-600:#475569; --slate-700:#334155;
--slate-800:#1E293B; --slate-900:#0F172A; --slate-950:#020617;
--success:#16A34A; --success-soft:#DCFCE7; --success-700:#15803D;
--warning:#D97706; --warning-soft:#FEF3C7; --warning-700:#B45309;
--danger:#DC2626;  --danger-soft:#FEE2E2;  --danger-700:#B91C1C;
--info:#0284C7;    --info-soft:#E0F2FE;    --info-700:#0369A1;
```
**Module accents (location only, never status)** used in this spec: `attendance` `#059669`/soft `#ECFDF5`/text `#047857`; `fees` `#D97706`/`#FFFBEB`/`#92400E`; `academics` `#7C3AED`/`#F5F3FF`/`#6D28D9`; `admissions` `#2563EB`/`#EFF6FF`/`#1D4ED8`; `notices` `#E11D48`/`#FFF1F2`/`#BE123C`; `reports` `#0891B2`/`#ECFEFF`/`#0E7490`.

### Type
Single family **Inter**, 400→900. `--text-3xl` (30px/900 weight) page titles, KPI values ~800 weight, uppercase tracked (`0.06em`) 12px micro-labels for field/table-header text. No other font.

### Radius / shadow
Inputs 8px, icon tiles/small buttons 12px, **cards/panels/buttons 16px**, large panels 24px, chips/avatars fully round. Cards: white, `1px solid rgba(226,232,240,.7)` border, `shadow-sm`; on hover lift `translateY(-1..-4px)` + `0 12px 20px -12px rgba(15,23,42,.18)`. Buttons/links `active:scale(.98)`. Focus ring: `0 0 0 3px var(--primary-soft)`.

### Layout
Fixed left sidebar 264px (collapsible 72px), sticky 64px topbar (`rgba(255,255,255,.95)` + `blur(8px)`), padded max-width ~1200–1280px work area.

### Component contracts (verify live code matches; these are the intended props)
- **`Button`**: `variant`: `default | outline | secondary | ghost | link | destructive`; `size`: `default | sm | lg | icon`; `isLoading?: boolean` (spinner + auto-disable).
- **`Input`**: standard input props + `invalid?: boolean` (danger focus/border).
- **`Checkbox`**: `label?`, `checked`, `onChange(checked: boolean)`, `disabled?`.
- **`Card`** (+ `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`): `hover?: boolean` adds the lift.
- **`Badge`**: `variant`: `default | secondary | outline | destructive | success | warning | info | neutral`. For simple tags/counts.
- **`StatusBadge`**: `status: string` (raw domain status e.g. `PAID`, `OVERDUE`, `PENDING`, `PUBLISHED`, `LOCKED` — auto-mapped to tone), optional `label` override, optional `tone` override. Use for *record* status; use `Badge` for plain tags.
- **`Avatar`**: `src?`, `alt?`, `initials?` (1–2 letters, gradient-tile fallback), `size`: `sm | md | lg | xl`.
- **`MoneyDisplay`**: `amount: number | string | null | undefined`, `currency?` (default NPR), `maximumFractionDigits?`, `mutedZero?`. Always route money rendering through this, never hand-format.
- **`Progress`**: `value` 0–100 (clamped), `tone`: `primary | success | warning | danger`.
- **`StatCard`**: `title`, `value`, `icon?`, `trend?: { value, label?, isUp }`, `description?`, `href?`. Backend-owned values only.
- **`EmptyState`**: `title`, `description`, `icon?`, `action?` (one permitted next step, not several).
- **`ModuleLockedState`**: `moduleName?`, `description?`, `planName?`, `featureKey?`, `actions?`. Shows *no data*, only the entitlement message.
- **`QuickActionCard`**: `label`, `description?`, `href?`, `icon?`, `accent`: one of `dashboard | admissions | attendance | fees | academics | homework | library | notices | slate`.

---

## 3. Screen specs

For each screen: purpose, layout, interaction, data shape, and functional (backend) requirements. Visuals should match what's described; exact pixel values live in `project/ui_kits/web/screens*.jsx` in this bundle if the implementing session has it attached — otherwise the descriptions below plus §2 tokens are sufficient to rebuild faithfully using the existing component library and Tailwind-equivalent utility values already in the app.

### 3.1 Take Attendance
**Job:** staff mark a class's daily attendance in seconds, touching only exceptions.

**Layout:** `ModuleHeader`-style page header (eyebrow "Daily Operations · Attendance", title "Take attendance", description: *"Everyone starts marked present. Just tap the few students who are absent or late, then save. No typing needed."*). Below: a row of context pills (section/class, subject or "Morning register", date) + a "Mark all present" outline button. Then a responsive grid (`auto-fill, minmax(300px,1fr)`, 12px gap) of student cards: avatar + status dot, name, roll number, and a 3-way segmented control (Present / Absent / Late) with 44px-tall tap targets — selected state uses the state's soft background + strong text + colored border, unselected is neutral. A **sticky bottom bar** (left-offset by sidebar width) shows live Present/Absent/Late counts and a single "Save attendance" button; after save it flips to a confirmed state ("Attendance saved") and the button disables.

**Default state:** every student starts **Present** — this is the core UX principle, not just a convenience default.

**Data needed:**
- Roster for the selected class/section + date: `{ studentId, name, rollNo }[]`.
- Existing attendance for that date if already marked (so re-opening the screen shows the saved state, not a reset-to-present).
- Save payload: `{ classId, date, marks: { studentId, status: 'PRESENT'|'ABSENT'|'LATE' }[] }`.

**Business rules:**
- If attendance for this class+date is already **locked** (e.g. past a submission cutoff, or already finalized), show the school-friendly locked message ("Attendance is locked for this date.") instead of an editable grid — don't silently allow edits that won't persist.
- A teacher only sees/edits classes they're assigned to; admin/principal can see across classes (scope this the same way other class-scoped screens in the app already do).
- Persist per-student status; don't require typing for anything.

### 3.2 Collect a Payment (Fee Counter)
**Job:** a guided, error-resistant 1-2-3 flow for front-desk staff to take a fee payment and print a receipt. Opens from the Fees & Receipts screen's primary "Collect payment" action.

**Layout:** three-column-ish composition — (1) a searchable student picker (name/roll search, list shows name + class + total due), (2) a fee-items panel for the selected student: each due item as a large tappable row with a checkbox, label, amount, and an "Overdue" chip on overdue items — staff can deselect items they're not collecting today, (3) a payment-method chooser (Cash / eSewa / Khalti / Bank transfer / Cheque as large tap targets). A bold **total bar** (dark primary background) shows "Amount to collect" in large type and the "Collect & print receipt" button, disabled with an inline hint until a method is chosen and at least one item is selected. On submit, a success state shows amount received, student, method, a receipt number, and confirmation that a guardian SMS was sent, with "Print receipt" and "Collect another" actions.

**Data needed:**
- Selected student's outstanding fee items: `{ id, label, amount, overdue: boolean }[]`, guardian name, class.
- Available payment methods (from school config, not hardcoded, since methods may vary per school/tenant).
- Submit payload: `{ studentId, itemIds: string[], method, amountExpected }`.

**Critical business rule — do not skip this:** the amount actually charged/recorded must be **computed and validated server-side** from the selected item IDs (`sum of amounts for itemIds`), not trusted from a client-submitted total. The client may show a live running total for UX, but the persisted/printed amount comes from the server's recomputation, and the endpoint should reject if the client and server totals disagree (defense against stale client state, not just malice). Receipt numbers are backend-generated (sequential/tenant-scoped), never client-invented. Trigger the guardian-notification (SMS/app) side effect server-side on successful collection, and reflect the actual outcome ("guardian SMS sent: yes/no") rather than always claiming success.

### 3.3 Admissions
**Job:** review incoming applications and decide quickly.

**Layout:** page header (eyebrow "Students · Admissions", primary action "New application"). Four `StatCard`s: Applications, In review, Awaiting documents, Seats left (all backend-owned aggregates — do not compute from the list already loaded on the page, since that list may be paginated/filtered). Below, a queue: each row shows avatar, applicant name, grade + application ID, guardian name, a document-completeness indicator ("Documents complete" success / "Documents pending" warning), applied-date, a `StatusBadge` for stage, and (for undecided rows) actions: **Approve** (only enabled/shown when docs are complete), **Request documents** (when docs are incomplete), and **Decline** (styled as a low-emphasis/ghost destructive action, kept visually separate from the routine actions). Decided rows (Approved/Rejected) render dimmed/read-only, sorted to the bottom.

**Data needed:** `{ id, name, grade, guardian, appliedAt, stage: PENDING|REVIEW|APPROVED|REJECTED, documentsComplete: boolean }[]`, KPI aggregates from the backend.

**Business rules:**
- Approve/Decline/Request-documents are state transitions that should be audited (who decided, when) — follow whatever audit pattern the rest of the app uses for similar admin actions.
- Decline is a meaningful, hard-to-reverse action on a real applicant — confirm before committing if the app's convention is to confirmation-gate destructive actions (per the design system's rule: destructive actions are kept separate and confirmation-gated).

### 3.4 Exams & Results
**Job:** fast marks entry for a class/subject/exam, with live feedback.

**Layout:** page header (eyebrow "Academics · Exams & Results", title "Enter marks"). Context pills: exam name, subject, class, "Full marks N · pass M". A table: Roll, Student, Marks (number input, bounded 0–max), Grade (auto-computed client-side as the user types, purely for feedback), Result (`StatusBadge` Pass/Fail). Footer note: *"Marks are saved as a draft until you publish results to guardians."* + a "Save marks" button. A side panel shows live **class summary**: class average (`value/max`), pass rate as a `Progress` bar + "N of M students passed", and a top-scorer card.

**Grade bands** (percentage of max marks): ≥90 → A+, ≥80 → A, ≥70 → B+, ≥60 → B, ≥50 → C+, ≥40 → C, else NG (not graded/fail). These are the bands from the design; confirm against the school's actual grading policy in the live repo since grading scales can be configurable per school — if the repo already has a grading-scale concept, use that instead of hardcoding these bands.

**Data needed:** roster for class+subject+exam with existing marks if any (`{ studentId, rollNo, name, marks: number|null }[]`), `maxMarks`, `passMarks`.

**Business rules:**
- "Save marks" persists a **draft** state — results are not visible to guardians until a separate, explicit **publish** action (mentioned in the footer copy; check whether the live app already models a marks-entry/publish distinction, and if not, at minimum don't conflate "saved" with "guardian-visible").
- Grade computation shown live in the UI is for staff feedback; whatever the backend considers the source of truth for a student's official grade should be (re)computed server-side from the saved marks, not trusted from the client payload.
- Scope to the teacher's assigned class/subject unless the user has broader (admin) scope.

### 3.5 Notices & Communication
**Job:** compose one message, send it to the right audience over the right channels, with a live preview before sending.

**Layout:** page header ("Send a notice", description: *"Write once, reach every guardian on the school app and by SMS. See exactly how it will look before you send."*). Composer card: Title input, Message textarea (with live character count + "about N SMS per parent" estimate at 160 chars/segment), an audience chooser (chip group — e.g. All parents / By grade / By section / Parents with dues / All staff — sourced from the school's actual segmentation options, not hardcoded), and channel toggles (School app — "Free · instant"; SMS — "Charged per message"). Footer: a warning note that high-priority notices to all parents need principal approval, and a "Send notice" button (disabled if no channel selected) that flips to a sent confirmation. Beside the composer: a **live guardian-app preview** (phone-frame mock showing exactly how the title/message/channels will render to a guardian) and a **recent notices** list (title, `StatusBadge` for delivery status, audience/channel/reach summary).

**Data needed:** available audience segments (from the school's actual class/section/tenant structure), recent notices with real delivery status/reach, character-to-SMS-segment math (confirm actual SMS provider's segment length, don't assume 160 if the provider uses unicode/concatenated-SMS rules differently).

**Business rules:**
- High-priority + all-parents notices require an approval step before sending — if the app already has an approval-queue pattern (the dashboard's "Pending approvals" card in Home suggests it does), route through that instead of sending immediately.
- Delivery status/reach numbers must reflect actual provider callbacks, not an optimistic "sent" the instant the button is clicked — if provider delivery is async, show a pending/sending state first.

### 3.6 Reports & Exports
**Job:** let staff request and download standard reports without hitting a raw file browser or backend job UI.

**Layout:** header ("Reports & Exports", description: *"Pick a report and we'll prepare it for you. Larger reports take a moment — you can download them here once they're ready."*). Reports grouped by section (e.g. Finance, Academics, Operations) as a card grid: icon tile (module-accent "reports" color), report name, one-line description, format tag (e.g. "PDF · Excel"), and a right-aligned action that's one of: **Generate** (idle) → **Preparing…** (spinner, in-flight) → **Download** (ready).

**Data needed:** the report catalog (name, description, formats, which group) — likely already defined server-side per the app's export/report-generation system; don't hardcode the catalog in the frontend if the backend can supply it (schools may have different available reports based on plan/modules).

**Business rules:**
- "Generate" should kick off a real (likely async/background) report job; the frontend should poll or subscribe for completion rather than using a fixed client-side timeout like the prototype does.
- Downloads must go through the app's protected-file/authorization flow (per this app's stated pattern of "protected-file helpers" and RBAC) — never a public/unauthenticated URL.
- If report generation fails, show the honest error copy ("Report download is unavailable right now.") — never a raw error.

---

## 4. Cross-cutting implementation notes

- **Reuse, don't reimplement:** every screen above composes the existing `components/ui/*` and `components/dashboard/*` primitives (§2). Do not create parallel Button/Card/Badge implementations inside these screens.
- **Sidebar/nav:** ensure `components/layout/Sidebar` has (or gets) entries for any of these six modules not yet linked, matching the existing grouping convention (e.g. "Students" group holds Admissions; "Daily Operations" holds Attendance/Fees; "Academics" holds Exams & Results; "Communication" holds Notices; "Reports" holds Reports & Exports).
- **Routing:** follow the existing Next.js App Router URL/segment conventions already used by Login/Home/Fees/Students — don't invent a new routing pattern for the new screens.
- **Loading/error/empty states:** every screen needs a real loading state (skeleton or spinner consistent with the rest of the app) and a real error state (school-friendly copy per §1), in addition to the "happy path" described above — the prototype only showed the happy path with mock data.
- **No fabricated data:** anywhere the prototype used illustrative numbers (e.g. "1,182 / 1,240 marked", "Rs 2,48,500 collected"), the real implementation must source that from actual queries — if a number can't be computed cheaply/correctly yet, prefer an honest loading/unavailable state over a wrong number.
- **Verify before ship:** per this project's own engineering norms, drive each new screen end-to-end in a running instance (not just type-check) before considering it done — the `/verify` skill or equivalent should be used if available in that repo.

---

## 5. Suggested execution order

1. Confirm current state of the six screens in the live repo (some may be stubs, locked states, or partially built) — do not assume a blank slate.
2. Attendance + Collect Payment first (highest daily-use value per the original design conversation).
3. Admissions, Exams & Results.
4. Notices & Communication, Reports & Exports.
5. Sweep: confirm every module either has a real screen or an honest `ModuleLockedState`, and that Sidebar nav is fully wired.
