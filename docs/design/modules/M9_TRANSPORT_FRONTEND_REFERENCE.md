# M9 Transport — Frontend Web Design Reference

**Status:** Active module-level frontend design reference.
**Updated:** 2026-06-19
**Module:** M9 Transport
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`
**Backend contract rule:** Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Purpose

M9 manages routes, stops, vehicles, crew, student assignments, trip execution, boarding/deboarding evidence, parent status, emergencies, documents, and maintenance reminders.

It replaces static route lists and unsafe informal updates with assigned-trip scope, timestamped status, accountable student movement, and operational readiness.

For Nepal schools, it must handle landmark-based stops, variable road conditions, phone coordination, multi-shift routes, stale connectivity, vehicle document expiry, and clear emergency escalation.

---

## 2. Full Feature List

### Transport dashboard

**Purpose:**
Shows route/trip readiness, stale status, unassigned students/crew, document expiry, and incidents.

**Users:**
Transport manager, principal.

**Frontend behavior:**
Backend KPI strip and attention queues.

**Backend alignment:**
Backend owns readiness/status.

### Routes and stops

**Purpose:**
Defines ordered pickup/drop stops, landmarks, windows, and active versions.

**Users:**
Transport manager.

**Frontend behavior:**
Route table and ordered stop editor.

**Backend alignment:**
Backend validates order/version.

### Vehicles

**Purpose:**
Tracks capacity, status, registration, documents, and maintenance.

**Users:**
Transport manager.

**Frontend behavior:**
Vehicle list/profile, expiry/maintenance alerts, protected files.

**Backend alignment:**
Backend owns availability.

### Driver/conductor assignment

**Purpose:**
Assigns eligible crew to routes/trips with effective dates.

**Users:**
Transport manager.

**Frontend behavior:**
Assignment form with availability conflicts.

**Backend alignment:**
Backend validates staff/vehicle/trip eligibility.

### Student transport assignment

**Purpose:**
Links student to route, stop, direction, shift, effective period, and guardian context.

**Users:**
Transport manager.

**Frontend behavior:**
Scoped search and assignment table with capacity warnings.

**Backend alignment:**
Backend validates child/route/capacity.

### Trip lifecycle

**Purpose:**
Moves assigned trip through planned, started, in progress, completed, cancelled/emergency states.

**Users:**
Manager and assigned crew.

**Frontend behavior:**
Lifecycle controls with timestamp and reason.

**Backend alignment:**
Backend owns allowed transitions/idempotency.

### Boarding/deboarding

**Purpose:**
Records assigned student movement with duplicate/missing-stop safeguards.

**Users:**
Assigned driver/conductor.

**Frontend behavior:**
Mobile-companion-oriented manifest and scan/tap actions.

**Backend alignment:**
Backend enforces assigned trip/manifest.

### Stale GPS/status

**Purpose:**
Shows last-known time/source/accuracy and never implies live location when stale.

**Users:**
Manager and parent projection.

**Frontend behavior:**
Timestamped status badge/table; live map deferred until verified.

**Backend alignment:**
Backend/provider timestamps and policy.

### Parent child-route view

**Purpose:**
Shows linked child route/stop and safe active-trip status.

**Users:**
Parent.

**Frontend behavior:**
Child-scoped card with last update and school contact.

**Backend alignment:**
Purpose-limited API.

### Emergency flow

**Purpose:**
Raises a trip incident/emergency with reason, contacts, acknowledgement, and audit.

**Users:**
Assigned crew/manager.

**Frontend behavior:**
Prominent but confirmation-safe action and incident timeline.

**Backend alignment:**
Backend records state and emits M12 event.

### Vehicle documents and maintenance

**Purpose:**
Tracks registration/insurance/fitness/permit expiry and maintenance due/history.

**Users:**
Transport manager.

**Frontend behavior:**
Document/maintenance tables and reminders.

**Backend alignment:**
File Registry plus backend schedule/status.

---

## 3. Frontend Design Direction Based on Features

Use a route and trip operations workspace inside the standard SchoolOS app shell. Follow [the master web plan](../SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md) and [the design system](../../../apps/web/docs/DESIGN_SYSTEM.md).

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
| Transport manager | Tenant routes, vehicles, assignments, trips, documents | Other tenants | All M9 staff screens |
| Principal | Read-only readiness/incidents by permission | Crew private details | Dashboard/incidents |
| Driver / conductor | Assigned trip manifest/actions only | Other routes/trips | Companion trip |
| Parent | Linked-child route/status | Other children, crew private data, raw GPS | Parent transport |

---

## 5. Recommended Route Map

> Planning routes only. Reuse current routes/contracts where present; differences need router/OpenAPI confirmation.

### Admin / Staff Routes

```text
/dashboard/transport
/dashboard/transport/routes
/dashboard/transport/vehicles
/dashboard/transport/assignments
/dashboard/transport/trips
/dashboard/transport/incidents
```

### Parent Routes

```text
/parent/children/[studentId]/transport
```

### Driver / Mobile Companion Routes

```text
/driver/trips
/driver/trips/[tripId]
```

---

## 6. Screen-by-Screen Frontend Design Specification

### 1. Transport Dashboard

**Purpose:**
Monitor today’s readiness and exceptions.

**Main users:**
Transport manager, principal.

**Route:**
`/dashboard/transport` (planning route; reuse current route if different).

**Main features shown on this screen:**
Dashboard, stale state, expiry, maintenance, incidents.

**Layout:**
Module header, filter/context bar, Attention tables for trips/routes, unassigned crew/vehicle, stale status, document/maintenance alerts, and a right drawer for selected route/trip readiness, assignments, timestamps, audit.

**Header actions:**
Create Route; Start permitted operation

**Filters:**
Date/shift, route, vehicle, trip status, alert type

**KPI cards / summary cards:**
Routes active; trips today; in progress; stale; incidents

**Main table / list / grid:**
Attention tables for trips/routes, unassigned crew/vehicle, stale status, document/maintenance alerts

**Right drawer / detail panel:**
selected route/trip readiness, assignments, timestamps, audit

**Forms / modals:**
None

**Confirmations:**
Cancel/emergency/reminder actions require confirmation

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Summary, readiness queues, current status timestamps.

**Protected files:**
Vehicle/incident files protected.

**Audit behavior:**
Operational overrides, reminders, incidents.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 2. Routes, Stops and Assignments

**Purpose:**
Configure route versions, ordered stops, crew/vehicle and students.

**Main users:**
Transport manager.

**Route:**
`/dashboard/transport/routes` (planning route; reuse current route if different).

**Main features shown on this screen:**
Routes/stops, crew, student assignments.

**Layout:**
Module header, filter/context bar, Route list plus selected route tabs for stops, vehicle/crew, students, versions, and a right drawer for ordered stops, landmarks/windows, capacity, crew/vehicle/student assignments, history.

**Header actions:**
Add Route / Assign

**Filters:**
Active/effective date, shift, route, stop, capacity, search

**KPI cards / summary cards:**
Assigned students; capacity; unassigned; conflicts

**Main table / list / grid:**
Route list plus selected route tabs for stops, vehicle/crew, students, versions

**Right drawer / detail panel:**
ordered stops, landmarks/windows, capacity, crew/vehicle/student assignments, history

**Forms / modals:**
Route/stop order; effective assignments; pickup/drop; guardian contact-safe context

**Confirmations:**
Publish route version/remove assignment requires impact confirmation

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Routes/versions/stops, availability, capacity, assignments, validation.

**Protected files:**
Route/assignment export protected if generated.

**Audit behavior:**
Versions, ordering, assignments, overrides.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 3. Vehicles and Maintenance

**Purpose:**
Keep vehicles eligible and documents current.

**Main users:**
Transport manager.

**Route:**
`/dashboard/transport/vehicles` (planning route; reuse current route if different).

**Main features shown on this screen:**
Vehicles, documents, expiry, maintenance.

**Layout:**
Module header, filter/context bar, Vehicle table with registration, capacity, status, assigned route, document expiry, maintenance due, and a right drawer for vehicle details, protected documents, service history, assignment conflicts.

**Header actions:**
Add Vehicle; Record Maintenance

**Filters:**
Status, document alert, maintenance due, assignment, search

**KPI cards / summary cards:**
Active; unavailable; expiring; maintenance due

**Main table / list / grid:**
Vehicle table with registration, capacity, status, assigned route, document expiry, maintenance due

**Right drawer / detail panel:**
vehicle details, protected documents, service history, assignment conflicts

**Forms / modals:**
Vehicle fields; document upload/expiry; service record

**Confirmations:**
Mark unavailable/delete/override requires confirmation

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Vehicle/availability, documents, maintenance schedule/history.

**Protected files:**
Registration/insurance/fitness/permit files protected.

**Audit behavior:**
Status, files, expiry, maintenance, assignment changes.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 4. Trip Operations and Manifest

**Purpose:**
Execute one assigned trip and account for assigned students.

**Main users:**
Assigned driver/conductor; manager oversight.

**Route:**
`/driver/trips/[tripId]` (planning route; reuse current route if different).

**Main features shown on this screen:**
Trip lifecycle, boarding/deboarding, stale status, emergency.

**Layout:**
Module header, filter/context bar, Trip header and ordered stop/manifest list with student, pickup/drop, board state, exception, and a right drawer for student-safe contact/escalation context, event timestamps, incident controls.

**Header actions:**
Start / Complete Trip; Board/Deboard

**Filters:**
Current stop, board state, student search within manifest

**KPI cards / summary cards:**
Assigned; boarded; missed; deboarded; exceptions

**Main table / list / grid:**
Trip header and ordered stop/manifest list with student, pickup/drop, board state, exception

**Right drawer / detail panel:**
student-safe contact/escalation context, event timestamps, incident controls

**Forms / modals:**
Exception reason; emergency/incident details

**Confirmations:**
Start/complete/cancel/emergency and duplicate board/deboard require confirmation/idempotency

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Assigned trip/manifest, transitions, scan/tap mutations, timestamps, incident state.

**Protected files:**
Incident evidence protected if allowed.

**Audit behavior:**
Every lifecycle and student movement event, actor/device/time, exception.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 5. Parent Child Transport

**Purpose:**
Show safe route/stop and honest active-trip status.

**Main users:**
Parent.

**Route:**
`/parent/children/[studentId]/transport` (planning route; reuse current route if different).

**Main features shown on this screen:**
Child route, stop, status, stale label, contact.

**Layout:**
Module header, filter/context bar, Child assignment card plus current trip timeline/status and last update, and a right drawer for safe route/stop/trip detail; no raw crew private data or continuous raw GPS.

**Header actions:**
Contact School / View Notice

**Filters:**
Child, direction, date

**KPI cards / summary cards:**
Route; stop; scheduled window; last status

**Main table / list / grid:**
Child assignment card plus current trip timeline/status and last update

**Right drawer / detail panel:**
safe route/stop/trip detail; no raw crew private data or continuous raw GPS

**Forms / modals:**
None

**Confirmations:**
None

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Linked-child assignment and safe timestamped trip projection.

**Protected files:**
Allowed route notice only through protected helper.

**Audit behavior:**
No internal trip audit; parent view/read state only.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

### 6. Incidents and Emergency Audit

**Purpose:**
Coordinate and close transport incidents with evidence.

**Main users:**
Transport manager, principal by permission.

**Route:**
`/dashboard/transport/incidents` (planning route; reuse current route if different).

**Main features shown on this screen:**
Emergency flow, acknowledgement, resolution.

**Layout:**
Module header, filter/context bar, Incident table with severity, trip/route, raised by, status, age, acknowledgement, and a right drawer for trip context, safe student impact, contacts, evidence, M12 delivery/ack state, audit.

**Header actions:**
Acknowledge / Resolve

**Filters:**
Status, severity, route, date, assignee

**KPI cards / summary cards:**
Open; critical; acknowledged; resolved

**Main table / list / grid:**
Incident table with severity, trip/route, raised by, status, age, acknowledgement

**Right drawer / detail panel:**
trip context, safe student impact, contacts, evidence, M12 delivery/ack state, audit

**Forms / modals:**
Incident note, escalation, resolution

**Confirmations:**
Emergency broadcast, acknowledgement, resolve/reopen require reason

**States:**
All global states plus the domain states in Section 10; preserve filters and show safe retry guidance.

**Backend data needed:**
Incident lifecycle, affected scope, acknowledgements, notification event status.

**Protected files:**
Incident evidence protected.

**Audit behavior:**
Every emergency action, access, acknowledgement, resolution.

**Responsive note:**
Prioritize the primary job and essential columns; convert right rail to a drawer and keep actions reachable.

---

## 7. Simple Wireframe Designs

### 1. Transport Dashboard

```text
+------------------------------------------------------------------+
| Transport Dashboard                         [Create Route] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Routes active; trips today; in progress; stale; incid |
+------------------------------------------------------------------+
| Filters: Date/shift, route, vehicle, trip status, alert type   |
+--------------------------------------------+---------------------+
| Attention tables for trips/routes, unass | selected route/tr |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| None                                                           |
+------------------------------------------------------------------+
```

### 2. Routes, Stops and Assignments

```text
+------------------------------------------------------------------+
| Routes, Stops and Assignments               [Add Route / Assi] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Assigned students; capacity; unassigned; conflicts    |
+------------------------------------------------------------------+
| Filters: Active/effective date, shift, route, stop, capacity,  |
+--------------------------------------------+---------------------+
| Route list plus selected route tabs for  | ordered stops, la |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Route/stop order; effective assignments; pickup/drop; guardian |
+------------------------------------------------------------------+
```

### 3. Vehicles and Maintenance

```text
+------------------------------------------------------------------+
| Vehicles and Maintenance                    [Add Vehicle] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Active; unavailable; expiring; maintenance due        |
+------------------------------------------------------------------+
| Filters: Status, document alert, maintenance due, assignment,  |
+--------------------------------------------+---------------------+
| Vehicle table with registration, capacit | vehicle details,  |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Vehicle fields; document upload/expiry; service record         |
+------------------------------------------------------------------+
```

### 4. Trip Operations and Manifest

```text
+------------------------------------------------------------------+
| Trip Operations and Manifest                [Start / Complete] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Assigned; boarded; missed; deboarded; exceptions      |
+------------------------------------------------------------------+
| Filters: Current stop, board state, student search within mani |
+--------------------------------------------+---------------------+
| Trip header and ordered stop/manifest li | student-safe cont |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Exception reason; emergency/incident details                   |
+------------------------------------------------------------------+
```

### 5. Parent Child Transport

```text
+------------------------------------------------------------------+
| Parent Child Transport                      [Contact School /] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Route; stop; scheduled window; last status            |
+------------------------------------------------------------------+
| Filters: Child, direction, date                                |
+--------------------------------------------+---------------------+
| Child assignment card plus current trip  | safe route/stop/t |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| None                                                           |
+------------------------------------------------------------------+
```

### 6. Incidents and Emergency Audit

```text
+------------------------------------------------------------------+
| Incidents and Emergency Audit               [Acknowledge / Re] |
| Purpose / scope / last updated                                    |
+------------------------------------------------------------------+
| Summary: Open; critical; acknowledged; resolved                |
+------------------------------------------------------------------+
| Filters: Status, severity, route, date, assignee               |
+--------------------------------------------+---------------------+
| Incident table with severity, trip/route | trip context, saf |
| Content / form / pagination                 | Context / actions   |
+--------------------------------------------+---------------------+
| Incident note, escalation, resolution                          |
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
| M9 widgets | route/stop, vehicle/crew, assignment, trip, boarding, stale-status, emergency, and document widgets | Create composition | Reuse shared primitives. |

---

## 9. Backend and API Alignment

> These are capability labels, not endpoint names. Use current backend/OpenAPI/shared-contract names.

### Read APIs

Purpose-limited summary, paginated list, scoped detail, backend totals/status. **needs OpenAPI confirmation** unless verified in the current contract.

### Write / Mutation APIs

Validated create/update commands with permission, entitlement, and idempotency where relevant. **needs OpenAPI confirmation** unless verified in the current contract.

### Workflow APIs

Route version/publish; assignments; vehicle availability; trip start/complete/cancel; board/deboard; incident acknowledge/resolve. **needs OpenAPI confirmation** unless verified in the current contract.

### Validation APIs

Effective dates, stop order, capacity, crew/vehicle eligibility, assigned manifest, duplicate movement, stale threshold. **needs OpenAPI confirmation** unless verified in the current contract.

### Report / Export Jobs

Route/manifest/trip/incident/document reports use backend jobs and protected files. **needs OpenAPI confirmation** unless verified in the current contract.

### File Registry / Protected File APIs

Vehicle documents, incident evidence, manifests and reports use File Registry. **needs OpenAPI confirmation** unless verified in the current contract.

### Notification Events

Trip status, pickup/drop, delay and emergency events emit M12 notifications. **needs OpenAPI confirmation** unless verified in the current contract.

### Accounting / Finance Boundaries

Transport fees, payroll, maintenance accounting remain in owning modules via approved integrations. **needs OpenAPI confirmation** unless verified in the current contract.

### Audit Logs

Routes/versions, assignments, vehicle state/files, trip/student events, emergency actions. **needs OpenAPI confirmation** unless verified in the current contract.

### Role-Scoped APIs

Driver/conductor assigned-trip only; parent linked-child only; no admin payload reuse. **needs OpenAPI confirmation** unless verified in the current contract.

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
| Stale location/status | Last update exceeds backend policy | Show timestamp/source and stale warning; never show Live | Backend last-known state |

---

## 11. Security, Privacy, RBAC, and Tenant Rules

- `tenantId` isolates every query, job, export, file, and event; browser input is never trusted tenant scope.
- Backend RBAC and module entitlement are authoritative; hidden controls are UX only.
- Crew only sees assigned trip manifest and minimum safe contact context.
- Parents never see other students, crew private fields, raw object keys, or unrestricted GPS history.
- Board/deboard and trip transitions are idempotent and backend-authorized.
- Sensitive fields are omitted/masked by permission and never placed in URLs, logs, or analytics.
- Protected files use File Registry helpers; never raw object keys, provider URLs, or storage errors.
- Audit-sensitive actions display backend actor/time/reason/history only.
- Raw backend, provider, Prisma, and storage errors never reach users.

---

## 12. Nepal-Specific Requirements

- Stops may be landmark-based; support Nepali/English labels, directions, pickup/drop windows, and guardian phone context.
- Support morning/day shifts, route variants, traffic/weather delays, and intermittent connectivity with honest timestamps.
- Track local vehicle registration, insurance, fitness, permit and maintenance expiry types as configured.
- Emergency UI must support phone coordination while preserving audited system status; M12 owns delivery evidence.

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
