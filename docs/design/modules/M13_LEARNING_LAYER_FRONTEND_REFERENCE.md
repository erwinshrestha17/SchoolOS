# M13 Learning Layer — Frontend Web Design Reference

**Status:** Active module-level frontend design reference.
**Updated:** 2026-06-19
**Module:** M13 Learning Layer
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`
**Backend contract rule:** Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Purpose

M13 is a school-controlled, teacher-led learning layer for activity creation, protected resources, smart-board delivery, lab/session runtime, student attempts, progress review, and child-safe parent summaries.

It supports structured classroom practice without becoming an open social platform, public ranking system, broad home-learning product, or unapproved AI tutor.

For Nepal schools, it must work with shared labs, smart boards, controlled devices, intermittent connectivity, local curriculum context, bilingual resources, and non-comparative family communication.

---

## 2. Full Feature List

### Learning dashboard

**Purpose:**
Shows assigned activities, upcoming/live sessions, completion, review queues, resource issues, and backend progress summaries.

**Users:**
Teacher and admin.

**Frontend behavior:**
Backend KPI strip with action queues.

**Backend alignment:**
Backend owns totals/scope.

### Activity builder

**Purpose:**
Creates teacher-authored learning activities, instructions, questions/tasks, resources, assignment, and publish state.

**Users:**
Assigned teacher.

**Frontend behavior:**
Sectioned builder with student preview and validation.

**Backend alignment:**
Backend validates assignment/content/lifecycle.

### Resource library

**Purpose:**
Stores protected reusable classroom resources with type, subject/class, owner, version, and availability.

**Users:**
Teacher/admin.

**Frontend behavior:**
Paginated library, upload, preview, link-to-activity.

**Backend alignment:**
File Registry and backend scope.

### Smart-board mode

**Purpose:**
Presents an activity with large controls, minimal private data, and teacher control.

**Users:**
Teacher/classroom display.

**Frontend behavior:**
Focused full-screen presentation with activity/session state.

**Backend alignment:**
Backend supplies safe presentation projection.

### Lab/session runtime

**Purpose:**
Creates expiring session code/QR and controls start/pause/end/expiry for assigned learners.

**Users:**
Teacher and student runtime.

**Frontend behavior:**
Teacher control screen plus purpose-limited student join/runtime.

**Backend alignment:**
Backend owns codes, roster, lifecycle, expiry.

### Student attempts

**Purpose:**
Captures one student’s answers/progress/results under active session and policy.

**Users:**
Student.

**Frontend behavior:**
Simple task runner with save/submit/reconnect states where approved.

**Backend alignment:**
Backend owns attempt/session/self scope and scoring.

### Teacher progress review

**Purpose:**
Shows backend completion/performance by assigned class and activity without harsh labels.

**Users:**
Teacher.

**Frontend behavior:**
Roster/progress table and selected attempt review.

**Backend alignment:**
Backend computes summary and scope.

### Parent learning summary

**Purpose:**
Shows linked-child activity/progress summary without comparison, ranking, or peer data.

**Users:**
Parent.

**Frontend behavior:**
Child selector, recent activities, strengths/next steps if teacher/backend-provided.

**Backend alignment:**
Purpose-limited linked-child API.

### Protected learning resources

**Purpose:**
Keeps files tenant/class/session/role scoped.

**Users:**
Allowed users.

**Frontend behavior:**
Authenticated preview/download with unavailable/expired state.

**Backend alignment:**
File Registry authorizes every access.

### No leaderboard

**Purpose:**
Prevents public ranking and comparison harm.

**Users:**
All users.

**Frontend behavior:**
No rank, percentile, peer score table, or celebratory competition surface.

**Backend alignment:**
Backend contracts must not expose unnecessary peers.

### No AI runtime unless approved

**Purpose:**
Keeps recommendations, grading, tutoring, and generation deterministic/teacher-owned until M14 approval.

**Users:**
All users.

**Frontend behavior:**
No AI tutor/generator/prediction controls; honest unavailable/deferred state if referenced.

**Backend alignment:**
No LLM/AI endpoint use.

---

## 3. Frontend Design Direction Based on Features

Use a teacher-led classroom learning workspace under the standard shell. Follow [the master web design plan](../SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md) and [the design system](../../../apps/web/docs/DESIGN_SYSTEM.md).

- **Layout style:** Module header, backend summary strip when useful, shallow tabs, server filter bar, primary workspace, and optional right drawer.
- **Page density:** Operational laptop density with readable labels and preserved decision context.
- **Cards/table usage:** Cards summarize backend facts; growing records use paginated tables; specialized grids appear only when the job requires them.
- **Drawer usage:** Drawers show selection context and audit without losing filters; full routes handle long forms and complex review.
- **Tabs/subnavigation:** Separate stable subdomains; do not hide required sequence or validation inside arbitrary tabs.
- **Forms:** Sectioned and keyboard usable with inline errors; sticky footer for long workflows; save drafts only when persisted by backend.
- **Filters/quick actions:** Server filtering; one primary action; exports/imports/settings under `More Actions`.
- **Confirmations/status:** High-risk actions show impact and reason; text accompanies semantic color.
- **States:** Loading, empty, no results, error, permission, locked, validation, pending, success, failure, partial, queued, stale, and file unavailable.
- **Protected files:** File Registry authenticated helpers only; no raw storage keys, provider links, or persistent signed URLs.
- **Responsive behavior:** Collapse rails to drawers, prioritize columns, expand filters on demand, and preserve the main action.

---

## 4. Personas and Scope Boundaries

| Persona | Can access | Must not access | Main screens |
|---|---|---|---|
| Admin | Tenant learning setup/oversight by permission | Other tenants and student private attempts without need | Dashboard/resources |
| Teacher | Assigned activities, sessions, progress | Unassigned classes/attempts | Builder, session, review |
| Student | Own active-session runtime and own result | Peers and inactive sessions | Join/runtime/results |
| Parent | Linked-child non-comparative summary | Other children/attempt details beyond policy | Parent summary |

---

## 5. Recommended Route Map

> Planning routes only. Reuse current routes and names; any addition/difference needs route/OpenAPI confirmation.

### Admin / Staff Routes

```text
/dashboard/learning
/dashboard/learning/activities
/dashboard/learning/activities/[activityId]
/dashboard/learning/resources
/dashboard/learning/sessions/[sessionId]
/dashboard/learning/progress
```

### Parent Routes

```text
/parent/children/[studentId]/learning
```

### Student Routes

```text
/student/learning/join
/student/learning/sessions/[sessionId]
```

---

## 6. Screen-by-Screen Frontend Design Specification

### 1. Learning Dashboard

**Purpose:**
Prioritize teacher learning work and session readiness.

**Main users:**
Teacher, admin.

**Route:**
`/dashboard/learning` (planning route; reuse current route if different).

**Main features shown on this screen:**
Dashboard, activity/session/resource/review queues.

**Layout:**
Module header, context/filter bar, Tables/cards for draft/published activities, upcoming/live sessions, attempts awaiting review, resource failures, and a right drawer for selected activity/session summary, assignment, resources, audit.

**Header actions:**
Create Activity / Start Session

**Filters:**
Class, section, subject, activity status, session date/state, search

**KPI cards / summary cards:**
Assigned activities; live/upcoming sessions; completion; review queue from backend

**Main table / list / grid:**
Tables/cards for draft/published activities, upcoming/live sessions, attempts awaiting review, resource failures

**Right drawer / detail panel:**
selected activity/session summary, assignment, resources, audit

**Forms / modals:**
None

**Confirmations:**
End/cancel session and archive require confirmation

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Assigned summary/list/detail, session state, backend progress metrics.

**Protected files:**
Resource previews protected.

**Audit behavior:**
Activity/session lifecycle, exports.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 2. Activity Builder and Resources

**Purpose:**
Create, validate, preview, and publish assigned learning content.

**Main users:**
Assigned teacher.

**Route:**
`/dashboard/learning/activities/[activityId]` (planning route; reuse current route if different).

**Main features shown on this screen:**
Builder, resource library, protected files.

**Layout:**
Module header, context/filter bar, Section navigation for details, tasks/questions, resources, assignment, student preview, and a right drawer for validation, assigned audience, resource versions/availability, audit.

**Header actions:**
Save Draft / Publish

**Filters:**
Subject, class/section assignment; resource search/picker

**KPI cards / summary cards:**
None

**Main table / list / grid:**
Section navigation for details, tasks/questions, resources, assignment, student preview

**Right drawer / detail panel:**
validation, assigned audience, resource versions/availability, audit

**Forms / modals:**
Title, bilingual instructions, tasks/options/answers where supported, duration, assignment, resources

**Confirmations:**
Publish/archive/replace resource requires impact confirmation

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Assignments, content schema, validation, draft/version, publish transition.

**Protected files:**
Uploads/links/previews via File Registry.

**Audit behavior:**
Versions, resources, assignment, publish/archive.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 3. Smart-Board and Teacher Session Control

**Purpose:**
Run a controlled classroom/lab session.

**Main users:**
Teacher.

**Route:**
`/dashboard/learning/sessions/[sessionId]` (planning route; reuse current route if different).

**Main features shown on this screen:**
Smart-board, expiring code/QR, session lifecycle, roster state.

**Layout:**
Module header, context/filter bar, Large presentation/control area with code/QR, timer/status, joined roster summary, activity steps, and a right drawer for selected student status only when needed; no public scores.

**Header actions:**
Start / Pause / End Session

**Filters:**
Roster status, task step; no broad student search

**KPI cards / summary cards:**
Expected; joined; active; submitted; disconnected from backend

**Main table / list / grid:**
Large presentation/control area with code/QR, timer/status, joined roster summary, activity steps

**Right drawer / detail panel:**
selected student status only when needed; no public scores

**Forms / modals:**
Session settings permitted before start

**Confirmations:**
Start/end/regenerate code requires confirmation; code expiry explicit

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Activity projection, assigned roster, session code/QR, lifecycle, presence/progress.

**Protected files:**
Activity resources protected and session-scoped.

**Audit behavior:**
Code generation, joins, lifecycle, teacher control, exceptions.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 4. Student Session Runtime

**Purpose:**
Let one authenticated/session-authorized student complete assigned work.

**Main users:**
Student.

**Route:**
`/student/learning/sessions/[sessionId]` (planning route; reuse current route if different).

**Main features shown on this screen:**
Join, attempt, save/submit, own result.

**Layout:**
Module header, context/filter bar, Focused task view with progress, resource panel, answer area, connection/sync state, and a right drawer for current task/resources and own saved/submitted state.

**Header actions:**
Save / Submit Attempt

**Filters:**
None; task navigation only

**KPI cards / summary cards:**
Own progress only

**Main table / list / grid:**
Focused task view with progress, resource panel, answer area, connection/sync state

**Right drawer / detail panel:**
current task/resources and own saved/submitted state

**Forms / modals:**
Answer inputs defined by activity contract

**Confirmations:**
Final submit confirmation; resubmission only if backend permits

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Expiring join/session authorization, own attempt, save/version, submit/result.

**Protected files:**
Session-scoped resources through protected helper.

**Audit behavior:**
Own join/save/submit/reconnect; no peers.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 5. Teacher Progress Review

**Purpose:**
Review assigned class completion and individual attempts constructively.

**Main users:**
Teacher.

**Route:**
`/dashboard/learning/progress` (planning route; reuse current route if different).

**Main features shown on this screen:**
Progress summaries and attempt review.

**Layout:**
Module header, context/filter bar, Activity/class summary plus roster table with completion, attempts, backend score/status, review state, and a right drawer for selected own-scope attempt, responses, teacher feedback, timeline.

**Header actions:**
Open Attempt / Record Feedback

**Filters:**
Class, section, subject, activity, completion/review state

**KPI cards / summary cards:**
Assigned; started; submitted; reviewed; average only if backend safely provides

**Main table / list / grid:**
Activity/class summary plus roster table with completion, attempts, backend score/status, review state

**Right drawer / detail panel:**
selected own-scope attempt, responses, teacher feedback, timeline

**Forms / modals:**
Feedback/marking only where contract supports

**Confirmations:**
Publish feedback/reopen attempt requires reason/confirmation

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Assigned progress summary, attempts, rubric/scoring, feedback workflow.

**Protected files:**
Attempt resources/evidence protected.

**Audit behavior:**
Review, feedback, score override/reopen if permitted.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 6. Parent Learning Summary

**Purpose:**
Give guardians a calm linked-child learning summary.

**Main users:**
Parent.

**Route:**
`/parent/children/[studentId]/learning` (planning route; reuse current route if different).

**Main features shown on this screen:**
Recent activities, completion, teacher-provided next steps; no leaderboard.

**Layout:**
Module header, context/filter bar, Child header, recent activity cards, subject summaries, teacher comments/resources allowed for parent, and a right drawer for selected activity summary and allowed teacher feedback; no peer comparison.

**Header actions:**
Open Activity Summary

**Filters:**
Child, academic period, subject

**KPI cards / summary cards:**
Completed/in progress/needs support only from backend-approved language

**Main table / list / grid:**
Child header, recent activity cards, subject summaries, teacher comments/resources allowed for parent

**Right drawer / detail panel:**
selected activity summary and allowed teacher feedback; no peer comparison

**Forms / modals:**
None

**Confirmations:**
None

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Linked-child non-comparative summary and allowed resource metadata.

**Protected files:**
Parent-allowed resources protected.

**Audit behavior:**
Read/open only; no private attempt or peer data.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

### 7. Resource Library

**Purpose:**
Manage reusable protected learning resources.

**Main users:**
Teacher/admin.

**Route:**
`/dashboard/learning/resources` (planning route; reuse current route if different).

**Main features shown on this screen:**
Resource upload, version, assignment/use references.

**Layout:**
Module header, context/filter bar, Paginated resource table/grid with title, type, subject/class, owner, version, use count, status, and a right drawer for preview, version history, activity usage, permissions, audit.

**Header actions:**
Upload Resource

**Filters:**
Type, subject, class, owner, status, search

**KPI cards / summary cards:**
Available; processing; failed; unavailable

**Main table / list / grid:**
Paginated resource table/grid with title, type, subject/class, owner, version, use count, status

**Right drawer / detail panel:**
preview, version history, activity usage, permissions, audit

**Forms / modals:**
Metadata, upload, replacement/version note

**Confirmations:**
Archive/replace requires usage impact confirmation

**States:**
All global states plus Section 10 domain states. Errors are bounded and school-friendly; filters and safe current data remain visible.

**Backend data needed:**
Paginated resources, metadata, processing, versions, usage links.

**Protected files:**
All resource access via File Registry.

**Audit behavior:**
Upload/version/archive/access where required.

**Responsive note:**
Keep the main job and action visible, prioritize columns, and turn the right rail into a drawer.

---

## 7. Simple Wireframe Designs

### 1. Learning Dashboard

```text
+------------------------------------------------------------------+
| Learning Dashboard                          [Create Activity ] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Assigned activities; live/upcoming sessions; completi |
+------------------------------------------------------------------+
| Filters: Class, section, subject, activity status, session dat |
+--------------------------------------------+---------------------+
| Tables/cards for draft/published activit | selected activity |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: None                                              |
+------------------------------------------------------------------+
```

### 2. Activity Builder and Resources

```text
+------------------------------------------------------------------+
| Activity Builder and Resources              [Save Draft / Pub] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: None                                                  |
+------------------------------------------------------------------+
| Filters: Subject, class/section assignment; resource search/pi |
+--------------------------------------------+---------------------+
| Section navigation for details, tasks/qu | validation, assig |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Title, bilingual instructions, tasks/options/answ |
+------------------------------------------------------------------+
```

### 3. Smart-Board and Teacher Session Control

```text
+------------------------------------------------------------------+
| Smart-Board and Teacher Session Control     [Start / Pause / ] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Expected; joined; active; submitted; disconnected fro |
+------------------------------------------------------------------+
| Filters: Roster status, task step; no broad student search     |
+--------------------------------------------+---------------------+
| Large presentation/control area with cod | selected student  |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Session settings permitted before start           |
+------------------------------------------------------------------+
```

### 4. Student Session Runtime

```text
+------------------------------------------------------------------+
| Student Session Runtime                     [Save / Submit At] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Own progress only                                     |
+------------------------------------------------------------------+
| Filters: None; task navigation only                            |
+--------------------------------------------+---------------------+
| Focused task view with progress, resourc | current task/reso |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Answer inputs defined by activity contract        |
+------------------------------------------------------------------+
```

### 5. Teacher Progress Review

```text
+------------------------------------------------------------------+
| Teacher Progress Review                     [Open Attempt / R] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Assigned; started; submitted; reviewed; average only  |
+------------------------------------------------------------------+
| Filters: Class, section, subject, activity, completion/review  |
+--------------------------------------------+---------------------+
| Activity/class summary plus roster table | selected own-scop |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Feedback/marking only where contract supports     |
+------------------------------------------------------------------+
```

### 6. Parent Learning Summary

```text
+------------------------------------------------------------------+
| Parent Learning Summary                     [Open Activity Su] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Completed/in progress/needs support only from backend |
+------------------------------------------------------------------+
| Filters: Child, academic period, subject                       |
+--------------------------------------------+---------------------+
| Child header, recent activity cards, sub | selected activity |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: None                                              |
+------------------------------------------------------------------+
```

### 7. Resource Library

```text
+------------------------------------------------------------------+
| Resource Library                            [Upload Resource] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Available; processing; failed; unavailable            |
+------------------------------------------------------------------+
| Filters: Type, subject, class, owner, status, search           |
+--------------------------------------------+---------------------+
| Paginated resource table/grid with title | preview, version  |
| Main content / form / pagination            | Context / actions   |
+--------------------------------------------+---------------------+
| Form/dialog: Metadata, upload, replacement/version note        |
+------------------------------------------------------------------+
```

---

## 8. Component Plan

| Component | Purpose | Reuse existing or create? | Notes |
|---|---|---|---|
| `ModuleHeader` | Context, title, one primary action | Reuse | Secondary work in `More Actions`. |
| `KpiGrid` / `SummaryStrip` | Backend totals/status | Reuse | Honest unavailable state if missing. |
| `FilterBar` | Server search/filters | Reuse | Preserve URL state where practical. |
| Paginated table / purpose grid | Growing records | Reuse | Permission-safe column priority. |
| Status badge | Lifecycle/health/risk | Extend shared | Text plus semantic color. |
| Detail drawer | Detail/actions/audit | Reuse | Reauthorize mutation. |
| Validated form / sticky footer | Creation and workflow | Reuse | Safe field errors. |
| Confirmation/reason dialog | High-risk change | Reuse | Show exact impact. |
| Protected file/upload controls | Authenticated files | Reuse | File Registry only. |
| Audit timeline | Actor/reason/state history | Reuse/create shared | Backend facts only. |
| M13 widgets | activity builder, resource, smart-board, session, attempt, progress, and parent-summary widgets | Create composition | Reuse base primitives. |

---

## 9. Backend and API Alignment

> Capability labels are planning terms, not endpoint names. Use verified current OpenAPI/shared-contract names.

### Read APIs

Purpose-limited summaries, paginated lists, scoped details, and backend-owned totals/status. **needs OpenAPI confirmation** unless verified in the current contract.

### Write / Mutation APIs

Validated commands with RBAC/entitlement and idempotency where relevant. **needs OpenAPI confirmation** unless verified in the current contract.

### Workflow APIs

Activity draft/publish/archive; resource process/version; session code/start/pause/end/expire; attempt save/submit/reopen; feedback publish. **needs OpenAPI confirmation** unless verified in the current contract.

### Validation APIs

Teacher assignment, activity schema, resource access/type, session roster/code/expiry, attempt self scope/version, scoring/review policy. **needs OpenAPI confirmation** unless verified in the current contract.

### Report / Export Jobs

Progress/session exports only when school-justified, backend-generated, non-comparative, and protected. **needs OpenAPI confirmation** unless verified in the current contract.

### File Registry / Protected File APIs

Learning resources, attempt evidence and reports use File Registry with class/session/role scope. **needs OpenAPI confirmation** unless verified in the current contract.

### Notification Events

Session start/change, assignment, submission/review and summary-ready events may emit M12 notifications. **needs OpenAPI confirmation** unless verified in the current contract.

### Accounting / Finance Boundaries

No accounting/payment ownership. **needs OpenAPI confirmation** unless verified in the current contract.

### Audit Logs

Activity/resource versions, session/code lifecycle, joins, attempts, review/feedback, protected access where policy requires. **needs OpenAPI confirmation** unless verified in the current contract.

### Role-Scoped APIs

Teacher assigned class/subject; student active-session/self; parent linked-child non-comparative APIs. **needs OpenAPI confirmation** unless verified in the current contract.

---

## 10. State Matrix

| State | When it appears | UI behavior | Backend dependency |
|---|---|---|---|
| Loading | Request pending | Layout skeleton; preserve context | Request state |
| Empty | No records | Explanation and one permitted action | Empty response |
| No search results | Filters match nothing | Preserve filters; clear action | List metadata |
| Validation error | Input invalid | Inline errors and summary | Safe validation envelope |
| Permission denied | Scope fails | No forbidden detail | Backend RBAC |
| Module locked | Entitlement off | Locked state; no fake values | Entitlement guard |
| Mutation pending | Command in flight | Prevent duplicate action | Mutation/job status |
| Success | Confirmed | Feedback and refetch | Response |
| Failure | Safe error | Friendly retry | Safe error envelope |
| Partial failure | Batch partly succeeds | Itemized outcome | Batch result |
| Queued job | Async work | Job status tracker | Job API |
| Protected file unavailable | Missing/unauthorized | Safe unavailable state | File Registry |
| Stale data | Timestamp too old | Stale badge and refresh | Backend timestamp |
| Session expired or inactive | Code/session window is no longer valid | Block join/save as policy requires and show teacher contact/rejoin guidance | Backend session lifecycle |

---

## 11. Security, Privacy, RBAC, and Tenant Rules

- `tenantId` isolates all queries, jobs, exports, files, events, caches, and audit records.
- Backend RBAC and module entitlement are truth; frontend hiding is UX only.
- No public leaderboard, peer attempt list, open student chat, harsh labels, or broad home-learning access.
- Session codes/QR expire and never replace authenticated tenant/roster checks.
- No AI tutor, generation, prediction, adaptive runtime, or automated decision unless M14 is explicitly approved.
- Sensitive fields are omitted/masked by backend permission and never placed in URLs, logs, analytics, or exports without authorization.
- Protected files use File Registry helpers; never expose object keys, provider URLs, secrets, or raw internal errors.
- Audit-sensitive actions show backend actor/time/reason/history; the UI invents no audit facts.

---

## 12. Nepal-Specific Requirements

- Support shared computer labs, smart boards and controlled devices with teacher-visible session state.
- Use class/section/subject and local curriculum context, bilingual titles/instructions/resources where provided.
- Design for intermittent connectivity with explicit saved/pending/failed states only where backend supports safe replay.
- Parent summaries are low-bandwidth, child-scoped, non-comparative, and use respectful language.
- No assumption that every student has a personal home device.

---

## 13. Implementation Checklist

```text
[ ] Uses master SchoolOS layout, theme, and design system.
[ ] Every feature maps to a screen and every screen to a wireframe.
[ ] Current routes/OpenAPI/contracts/permissions/tests were inspected.
[ ] Real APIs and backend totals only; no fake production data.
[ ] Growing lists filter and paginate server-side.
[ ] Global and domain states are implemented.
[ ] Protected files use File Registry helpers.
[ ] Purpose-limited roles fail closed.
[ ] High-risk actions confirm impact, collect reason, avoid duplicates, and expose audit status.
[ ] Unknowns say needs OpenAPI confirmation or needs backend verification.
[ ] Responsive layout keeps the main job usable.
```

---

## 14. Done Definition

```text
[ ] All module features are explained with frontend behavior.
[ ] Every expected screen is specified and wireframed.
[ ] Backend/API, job, event, file, audit, and scope needs are listed.
[ ] States, security boundaries, and Nepal-specific needs are clear.
[ ] No endpoint shape or backend truth is invented.
[ ] Design is simple and implementation-ready.
[ ] Module implementation does not depend on deep detail in the master plan.
```
