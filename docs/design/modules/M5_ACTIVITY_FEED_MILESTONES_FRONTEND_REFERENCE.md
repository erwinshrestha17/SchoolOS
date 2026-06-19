# M5 Activity Feed and Milestones — Frontend Web Design Reference

**Status:** Active module-level frontend design reference.
**Updated:** 2026-06-19
**Module:** M5 Activity Feed and Milestones
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`
**Backend contract rule:** Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Purpose

M5 lets schools publish consent-aware classroom activities and record meaningful student milestones for linked families.

It replaces informal social-media sharing with school-controlled audiences, protected media, moderation, and traceable student/class tagging.

For Nepal schools, it must work for phone-first guardian audiences, bilingual captions, practical low-bandwidth media, and school consent expectations.

---

## 2. Full Feature List

### Activity dashboard

**Purpose:**
Shows publishing volume, drafts, consent blockers, reports, and parent engagement from backend.

**Users:**
Admin and authorized teachers.

**Frontend behavior:**
KPI strip plus attention queue and recent activity.

**Backend alignment:**
Backend supplies counts and scope.

### Activity composer

**Purpose:**
Creates class/student activities with title, bilingual caption, audience, date, tags, and publish controls.

**Users:**
Assigned teacher and activity editor.

**Frontend behavior:**
Sectioned composer with preview, save draft, consent check, and publish confirmation.

**Backend alignment:**
Backend validates assignment, audience, status, and idempotency.

### Media upload

**Purpose:**
Adds photos/files without public storage exposure.

**Users:**
Authorized creators.

**Frontend behavior:**
Protected upload queue with type/size/progress/retry/alt text/order.

**Backend alignment:**
File Registry owns metadata/access; processing status is backend-owned.

### Student/class tagging

**Purpose:**
Associates a post only with active authorized students/classes.

**Users:**
Assigned teacher and admin.

**Frontend behavior:**
Searchable scoped picker with selected chips and audience impact.

**Backend alignment:**
Backend validates active enrollment and assignment.

### Consent warning

**Purpose:**
Prevents unsafe publication when student/media consent policy blocks visibility.

**Users:**
Creators and approvers.

**Frontend behavior:**
Blocking/warning panel naming affected tags and safe remedies.

**Backend alignment:**
Backend consent decision is authoritative.

### Parent feed

**Purpose:**
Shows only linked-child, audience-eligible, consent-safe activities.

**Users:**
Parent.

**Frontend behavior:**
Chronological feed with protected media, child filter, and school context.

**Backend alignment:**
Purpose-limited API rechecks guardian links.

### Milestone timeline

**Purpose:**
Records developmental/academic/social milestones without comparison or harsh labels.

**Users:**
Teacher, admin, linked parent.

**Frontend behavior:**
Student timeline with category, observation, date, visibility, and protected evidence.

**Backend alignment:**
Backend owns allowed categories, scope, and visibility.

### Moderation and report flow

**Purpose:**
Lets users report content and authorized staff resolve/hide/restore with reason.

**Users:**
Parent reporter and moderator.

**Frontend behavior:**
Report dialog, moderation queue, evidence drawer, resolution timeline.

**Backend alignment:**
Backend owns case state, access removal, and audit.

### Protected media

**Purpose:**
Keeps activity and milestone files tenant/record/audience scoped.

**Users:**
All allowed viewers.

**Frontend behavior:**
Authenticated thumbnails/open/download with unavailable/revoked states.

**Backend alignment:**
File Registry and authorization remain authoritative.

---

## 3. Frontend Design Direction Based on Features

Use a feed and moderation workspace inside the standard SchoolOS app shell. Follow [the master web plan](../SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md) and [the design system](../../../apps/web/docs/DESIGN_SYSTEM.md).

- Layout: module header, optional backend KPI strip, shallow tabs, server filter bar, main workspace, and selection drawer.
- Density: compact enough for laptop operations, with decision context and field labels never sacrificed.
- Cards/tables: cards only for backend summaries; growing lists are server-paginated tables; visual media may use a grid.
- Drawers/tabs: drawers preserve list context; tabs separate stable subdomains, not arbitrary steps.
- Forms: sectioned, inline-validating, keyboard usable, and sticky-action only when long.
- Filters/actions: URL-preserved server filters; one primary action; import/export/settings under secondary actions.
- Confirmations/badges: high-risk changes require impact, reason, and confirmation; every color has text.
- States: loading, empty, no results, error, permission, locked, validation, pending, success, failure, partial, queued, stale, and file unavailable.
- Files: File Registry authenticated helpers only; never raw keys, provider links, or persistent signed URLs.
- Responsive: collapse rails to drawers, prioritize table columns, and move long filters into an expandable panel.

---

## 4. Personas and Scope Boundaries

| Persona | Can access | Must not access | Main screens |
|---|---|---|---|
| Admin | Tenant activity, moderation, consent exceptions | Other tenants | Dashboard, moderation |
| Teacher | Assigned class/student posts and milestones | Unassigned students | Composer, timeline |
| Parent | Linked-child eligible feed and reporting | Other children and internal moderation | Parent feed |

---

## 5. Recommended Route Map

> Planning routes only. Reuse current routes/contracts where present; differences need router/OpenAPI confirmation.

### Admin / Staff Routes

```text
/dashboard/activity
/dashboard/activity/new
/dashboard/activity/[activityId]
/dashboard/activity/milestones
/dashboard/activity/moderation
```

### Parent Routes

```text
/parent/feed
/parent/children/[studentId]/milestones
```

---

## 6. Screen-by-Screen Frontend Design Specification

### 1. Activity Dashboard

**Purpose:**
Monitor activity publishing and exceptions.

**Main users:**
Admin, teacher.

**Route:**
`/dashboard/activity` (planning route; reuse current route if different).

**Main features shown on this screen:**
Dashboard, drafts, consent blockers, reports.

**Layout:**
Module header, filter/context bar, Paginated activity list/cards with title, class, tags, author, audience, media, status, date, and a right drawer for activity preview, audience, tags, consent, audit.

**Header actions:**
Create Activity; More: moderation

**Filters:**
Status, class, section, author, date, media, search

**KPI cards / summary cards:**
Published; drafts; consent blocked; reported

**Main table / list / grid:**
Paginated activity list/cards with title, class, tags, author, audience, media, status, date

**Right drawer / detail panel:**
activity preview, audience, tags, consent, audit

**Forms / modals:**
None

**Confirmations:**
Archive/hide requires reason

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Summary, scoped list/detail, consent and moderation status.

**Protected files:**
Protected thumbnails/media.

**Audit behavior:**
Publish/archive/moderation actions.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 2. Activity Composer

**Purpose:**
Create and safely publish one activity.

**Main users:**
Assigned teacher, editor.

**Route:**
`/dashboard/activity/new` (planning route; reuse current route if different).

**Main features shown on this screen:**
Composer, upload, tagging, consent warning.

**Layout:**
Module header, filter/context bar, Form plus live audience/media preview, and a right drawer for audience impact, consent results, media processing.

**Header actions:**
Save Draft; Publish

**Filters:**
Class/section context, student picker

**KPI cards / summary cards:**
None

**Main table / list / grid:**
Form plus live audience/media preview

**Right drawer / detail panel:**
audience impact, consent results, media processing

**Forms / modals:**
Title, Nepali/English caption, date, tags, audience, uploads, alt text

**Confirmations:**
Publish shows recipients/tags/consent; blocked consent cannot be bypassed

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Assignments, active roster, consent validation, draft/publish.

**Protected files:**
Uploads/previews via File Registry.

**Audit behavior:**
Draft, tags, consent result, publish actor/time.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 3. Parent Feed

**Purpose:**
Show linked-child consent-safe activities.

**Main users:**
Parent.

**Route:**
`/parent/feed` (planning route; reuse current route if different).

**Main features shown on this screen:**
Parent feed and protected media.

**Layout:**
Module header, filter/context bar, Chronological cards with school/class context, caption, date, tagged child, media, report action, and a right drawer for selected post/media and safe report control.

**Header actions:**
Open Activity

**Filters:**
Child, class, date, category

**KPI cards / summary cards:**
Unread/new count only if backend provides

**Main table / list / grid:**
Chronological cards with school/class context, caption, date, tagged child, media, report action

**Right drawer / detail panel:**
selected post/media and safe report control

**Forms / modals:**
Report reason form

**Confirmations:**
Report requires reason; no edit controls

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Linked-child feed/detail and audience authorization.

**Protected files:**
Protected media with revoked/unavailable state.

**Audit behavior:**
Report submission/read state only.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 4. Milestone Timeline

**Purpose:**
Record and review one student’s milestones.

**Main users:**
Teacher, admin; parent separate projection.

**Route:**
`/dashboard/activity/milestones` (planning route; reuse current route if different).

**Main features shown on this screen:**
Milestone creation and timeline.

**Layout:**
Module header, filter/context bar, Student header plus category/date timeline and selected observation drawer, and a right drawer for observation, evidence, visibility, edits/audit.

**Header actions:**
Add Milestone

**Filters:**
Assigned class/student, category, date, visibility

**KPI cards / summary cards:**
Milestones count by backend category if useful

**Main table / list / grid:**
Student header plus category/date timeline and selected observation drawer

**Right drawer / detail panel:**
observation, evidence, visibility, edits/audit

**Forms / modals:**
Category, observation, date, visibility, evidence

**Confirmations:**
Delete/hide/change visibility requires confirmation

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Scoped student, category, timeline, mutation, visibility.

**Protected files:**
Evidence protected.

**Audit behavior:**
Create/edit/visibility change/removal.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 5. Moderation Queue

**Purpose:**
Resolve reports and remove unsafe content with evidence.

**Main users:**
Authorized moderator/admin.

**Route:**
`/dashboard/activity/moderation` (planning route; reuse current route if different).

**Main features shown on this screen:**
Report, hide, restore, escalate.

**Layout:**
Module header, filter/context bar, Case table with severity, content, reporter, reason, status, age, assignee, and a right drawer for reported content, consent/audience, evidence, actions, audit.

**Header actions:**
Resolve Case

**Filters:**
Status, severity, type, assignee, date

**KPI cards / summary cards:**
Open; urgent; hidden; resolved

**Main table / list / grid:**
Case table with severity, content, reporter, reason, status, age, assignee

**Right drawer / detail panel:**
reported content, consent/audience, evidence, actions, audit

**Forms / modals:**
Resolution, note, escalation/assignment

**Confirmations:**
Hide/restore/resolve requires reason and impact review

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Cases, safe evidence projection, allowed transitions.

**Protected files:**
Reported media protected and restricted.

**Audit behavior:**
Every report, view, assignment, decision, hide/restore.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

---

## 7. Simple Wireframe Designs

### 1. Activity Dashboard

```text
+------------------------------------------------------------------+
| Activity Dashboard                          [Create Activity] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Published; drafts; consent blocked; reported          |
+------------------------------------------------------------------+
| Filters: Status, class, section, author, date, media, search   |
+--------------------------------------------+---------------------+
| Paginated activity list/cards with title | activity preview, |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| None                                                           |
+------------------------------------------------------------------+
```

### 2. Activity Composer

```text
+------------------------------------------------------------------+
| Activity Composer                           [Save Draft] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: None                                                  |
+------------------------------------------------------------------+
| Filters: Class/section context, student picker                 |
+--------------------------------------------+---------------------+
| Form plus live audience/media preview    | audience impact,  |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Title, Nepali/English caption, date, tags, audience, uploads,  |
+------------------------------------------------------------------+
```

### 3. Parent Feed

```text
+------------------------------------------------------------------+
| Parent Feed                                 [Open Activity] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Unread/new count only if backend provides             |
+------------------------------------------------------------------+
| Filters: Child, class, date, category                          |
+--------------------------------------------+---------------------+
| Chronological cards with school/class co | selected post/med |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Report reason form                                             |
+------------------------------------------------------------------+
```

### 4. Milestone Timeline

```text
+------------------------------------------------------------------+
| Milestone Timeline                          [Add Milestone] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Milestones count by backend category if useful        |
+------------------------------------------------------------------+
| Filters: Assigned class/student, category, date, visibility    |
+--------------------------------------------+---------------------+
| Student header plus category/date timeli | observation, evid |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Category, observation, date, visibility, evidence              |
+------------------------------------------------------------------+
```

### 5. Moderation Queue

```text
+------------------------------------------------------------------+
| Moderation Queue                            [Resolve Case] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Open; urgent; hidden; resolved                        |
+------------------------------------------------------------------+
| Filters: Status, severity, type, assignee, date                |
+--------------------------------------------+---------------------+
| Case table with severity, content, repor | reported content, |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Resolution, note, escalation/assignment                        |
+------------------------------------------------------------------+
```

---

## 8. Component Plan

| Component | Purpose | Reuse existing or create? | Notes |
|---|---|---|---|
| `ModuleHeader` | Title, purpose, primary and secondary actions | Reuse | Keep school context visible. |
| `KpiGrid` / `SummaryStrip` | Backend-owned totals | Reuse | Unavailable if summary API is absent. |
| `FilterBar` | Server filtering/search | Reuse | Preserve filters where practical. |
| Paginated table / purposeful grid | Operational records | Reuse | Permission-safe columns. |
| Status badges | Lifecycle and risk | Extend shared | Text plus semantic color. |
| Detail drawer | Detail, actions, timeline | Reuse | Reauthorize mutations. |
| Validated form / sticky footer | Create/edit workflows | Reuse | Inline bounded errors. |
| Reason dialog | High-risk confirmation | Reuse | Show impact and require reason. |
| Protected file/upload controls | Authenticated file actions | Reuse | File Registry only. |
| Audit timeline | Actor, reason, transition | Reuse/create shared | Backend facts only. |
| M5 widgets | composer, media, consent, feed, milestone, and moderation widgets | Create composition | Reuse shared primitives. |

---

## 9. Backend and API Alignment

> These are capability labels, not endpoint names. Use current backend/OpenAPI/shared-contract names.

### Read APIs

Purpose-limited summary, paginated list, scoped detail, backend totals/status. **needs OpenAPI confirmation** unless verified in the current contract.

### Write / Mutation APIs

Validated create/update commands with permission, entitlement, and idempotency where relevant. **needs OpenAPI confirmation** unless verified in the current contract.

### Workflow APIs

Draft/publish/archive; consent validation; media processing; milestone visibility; moderation report/assign/hide/restore/resolve. **needs OpenAPI confirmation** unless verified in the current contract.

### Validation APIs

Assignment, active student/class tags, audience, consent, media type/size, caption, visibility. **needs OpenAPI confirmation** unless verified in the current contract.

### Report / Export Jobs

Moderation/activity exports only when justified; queued protected output. **needs OpenAPI confirmation** unless verified in the current contract.

### File Registry / Protected File APIs

Activity/milestone media and evidence use File Registry. **needs OpenAPI confirmation** unless verified in the current contract.

### Notification Events

Published activity/milestone and moderation outcomes emit M12 events. **needs OpenAPI confirmation** unless verified in the current contract.

### Accounting / Finance Boundaries

No finance ownership. **needs OpenAPI confirmation** unless verified in the current contract.

### Audit Logs

Publishing, tag/audience changes, consent result, media actions, moderation. **needs OpenAPI confirmation** unless verified in the current contract.

### Role-Scoped APIs

Parent linked-child and teacher assignment projections must be purpose-limited. **needs OpenAPI confirmation** unless verified in the current contract.

---

## 10. State Matrix

| State | When it appears | UI behavior | Backend dependency |
|---|---|---|---|
| Loading | Request pending | Layout skeleton; retain context | Request state |
| Empty | No records | Explain and offer one permitted action | Empty response |
| No search results | Filters match nothing | Preserve/clear filters | List metadata |
| Validation error | Input invalid | Inline errors and summary | Safe validation envelope |
| Permission denied | Scope fails | Reveal no forbidden data | Backend RBAC |
| Module locked | Entitlement off | Locked screen; no fake values | Entitlement guard |
| Mutation pending | Command in flight | Prevent duplicate submit | Mutation/job state |
| Success | Backend confirms | Feedback and refetch | Confirmed response |
| Failure | Safe command error | Friendly parsed error/retry | Safe error envelope |
| Partial failure | Batch partly succeeds | Itemized result/retry | Batch result |
| Queued job | Async work | Job tracker | Job API |
| Protected file unavailable | Missing/unauthorized | Safe unavailable state | File Registry |
| Stale data | Timestamp exceeds policy | Stale label and refresh | Backend timestamp |
| Consent blocked | Backend policy disallows selected audience/media | Name affected tags safely and block publish | Consent validation |

---

## 11. Security, Privacy, RBAC, and Tenant Rules

- `tenantId` isolates every query, job, export, file, and event; browser input is never trusted tenant scope.
- Backend RBAC and module entitlement are authoritative; hidden controls are UX only.
- Removed guardians lose feed/media access immediately.
- Parent feeds never expose peer-only tags, internal notes, or moderation evidence.
- Media authorization is rechecked on every open.
- Sensitive fields are omitted/masked by permission and never placed in URLs, logs, or analytics.
- Protected files use File Registry helpers; never raw object keys, provider URLs, or storage errors.
- Audit-sensitive actions display backend actor/time/reason/history only.
- Raw backend, provider, Prisma, and storage errors never reach users.

---

## 12. Nepal-Specific Requirements

- Support Nepali/English captions and names without duplicating posts.
- Optimize media previews for variable connectivity and show upload/processing status.
- Use school consent policy and guardian relationship truth; do not assume blanket photo consent.
- Milestones remain non-comparative and use respectful school language.

---

## 13. Implementation Checklist

```text
[ ] Uses SchoolOS layout and design system.
[ ] Features map to screens; every screen maps to a wireframe.
[ ] Current route/OpenAPI/contracts/permissions were inspected.
[ ] Real APIs and backend-owned totals only; no fake metrics.
[ ] Lists paginate/filter server-side.
[ ] All global and domain states exist.
[ ] Protected files use File Registry helpers.
[ ] Purpose-limited personas fail closed.
[ ] High-risk actions confirm, collect reason, prevent duplicates, and show audit state.
[ ] Unknowns say needs OpenAPI confirmation or needs backend verification.
[ ] Responsive layout preserves the main job.
```

---

## 14. Done Definition

```text
[ ] All module features are explained.
[ ] Each feature has matching frontend behavior.
[ ] Every expected screen is documented and wireframed.
[ ] Backend/API and file needs are listed without invented endpoints.
[ ] Required states and security/role boundaries are clear.
[ ] Nepal-specific needs are included.
[ ] Design is simple and implementation-friendly.
[ ] Implementation does not require module detail from the master plan.
```
