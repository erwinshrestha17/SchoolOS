# M8B Transport — Web Reference Analysis

**Status:** Supporting M8B design analysis for the SchoolOS web implementation pass.  
**Updated:** 2026-06-19  
**Master design source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` remains the active web frontend source of truth. Backend/OpenAPI/shared contract types remain authoritative for fields, routes, permissions, totals, mutations, exports, protected files, parent scope, driver scope, and GPS semantics. This document records the focused reference-screen analysis and should be consolidated into the master web plan during the next master-doc curation pass.

---

## 1. Purpose

M8B is the school transport command center. It must help school transport administrators, route managers, drivers/conductors, and parents manage routes, stops, vehicles, assignments, trips, GPS freshness, parent-visible bus status, safety alerts, documents, maintenance, and trip history.

The supplied references define three distinct transport experiences:

| Surface | Main user | Primary job |
|---|---|---|
| Admin web | Administrator / Transport Manager | Plan routes, assign vehicles/staff/students, dispatch trips, monitor GPS status, resolve conflicts, and review reports. |
| Parent portal | Parent / guardian | View only the linked child’s assigned bus status, pickup window, latest update, and transport contacts. |
| Driver/conductor mobile companion | Driver / conductor | Start trips, mark boarding/drop-off/absent states, sync GPS, call emergency contacts, and complete trips safely. |

M8B must feel operational and safety-critical. It should not look like a decorative dashboard or a generic vehicle register.

Every M8B screen keeps the SchoolOS rule: **one screen = one main job**.

---

## 2. Product and Privacy Boundaries

| Persona | Allowed visibility | Must not expose |
|---|---|---|
| School admin / transport manager | Tenant-scoped routes, stops, vehicles, driver/conductor assignments, student transport assignments, trip state, GPS freshness, validation alerts, exports, and reports. | Cross-tenant data, raw provider secrets, unrelated academic/private student details, or unsupported live tracking claims. |
| Driver / conductor | Assigned trips, assigned stops, assigned student manifest, guardian/emergency contact, medical/safety notes needed for trip execution, own GPS sync state. | Other routes, unrelated students, finance/payroll data, internal admin queues, or other drivers’ private records. |
| Parent / guardian | Linked child’s transport assignment, current trip state, pickup/drop window, latest update, stale-label warnings, and approved transport contacts. | Other children, full manifests, internal conflicts, exact location unless school policy and backend support explicitly allow it. |
| Principal | Decision-level summaries, safety exceptions, delayed trips, stale GPS count, capacity and document expiry risks. | Unnecessary raw operational detail where a summary is sufficient. |

Parent, driver, and mobile surfaces must use purpose-limited APIs. Do not reuse admin-shaped payloads directly.

---

## 3. Recommended Route Map

```text
/dashboard/transport
/dashboard/transport/routes
/dashboard/transport/vehicles
/dashboard/transport/staff
/dashboard/transport/students
/dashboard/transport/trips
/dashboard/transport/trips/[tripId]/manifest
/dashboard/transport/gps
/dashboard/transport/history

/parent/transport/status
/parent/transport/schedule
/parent/transport/contacts

/driver/trips/assigned
/driver/trips/[tripId]/manifest
```

Route naming must follow the existing Next.js app-router structure if the repository already defines a different stable path. Treat unknown route/API contracts as `needs OpenAPI confirmation` rather than inventing endpoints.

---

## 4. Workspace Pattern

```text
Header: Transport
Purpose: Manage routes, vehicles, trips, staff assignments, GPS status, and parent bus visibility.
Primary action: Contextual to the page, such as Add Route, Add Vehicle, Assign Students, Create Trip, or Start Trip.
Secondary actions: More Actions, import/export, history, and report actions.

KPI strip: Backend-provided module summaries only.
Tabs/pages: Overview | Routes & Stops | Vehicles | Staff | Students | Trips | Manifest | GPS | History/Reports
Filters: Route | Vehicle | Driver | Conductor | Class | Section | Stop | Shift | Trip status | GPS state | Document state
Main area: One task-first table, kanban board, manifest, route detail, GPS table, or report surface.
Right rail: Selected route, vehicle, staff member, student assignment, or trip detail. The right rail is not decorative.
```

KPI cards, utilization percentages, trip totals, stale-GPS counts, document-expiry counts, maintenance counts, and parent-visible summaries must come from backend summary/list metadata or render an honest unavailable state. The browser must not invent operational truth.

---

## 5. Delivery Priority

| Priority | Screens | Outcome |
|---|---|---|
| **P0** | Transport Dashboard; Routes & Stops; Vehicle Fleet; Staff Assignment; Student Transport Assignment | Core transport setup and validation are understandable and real-API backed. |
| **P1** | Trip Dispatch Board; Trip Manifest; GPS Status and Sync Health | Daily dispatch, boarding/drop-off, and latest GPS status are operationally safe. |
| **P2** | Parent Assigned Bus Status; Driver Assigned Trip Mobile Flow; Trip History Exports | Purpose-limited parent/driver experiences and reporting are polished. |
| **Deferred** | Live map, WebSocket/SSE tracking, ETA, route deviation, geofence, overspeed | Implement only after backend/provider/load/privacy decisions and tests are confirmed. |

---

## 6. Transport Dashboard Overview

**Main job:** summarize today’s transport operation and show what needs immediate attention.

```text
Header: Transport Dashboard Overview
Primary action: Create Trip or Start Trip, depending on operational context
KPI strip: Active Routes | Active Vehicles | Trips Today | In-Progress Trips | Students Assigned | GPS Stale Alerts | Vehicle Document Expiry | Maintenance Due
Quick actions: Add Route | Add Vehicle | Assign Students | Create Trip | Start Trip | Export Trip History
Main: Trip status breakdown, route utilization, upcoming expiries, GPS sync alerts, today timeline
Bottom: Current trip status and latest GPS cache tables
Footer: Last updated timestamp and Nepal Time note
```

Recommended attention order:

1. Critical alerts: stale GPS during active trip, delayed trips, overlapping assignments, expired documents, out-of-service vehicle assigned to trip.
2. Today’s active/in-progress trips.
3. Route utilization and student assignment capacity.
4. Upcoming document expiry and maintenance.
5. Historical export/report actions.

The dashboard should be an aggregation page, not a full editing workspace.

---

## 7. Routes & Stops Management

**Main job:** design, organize, validate, and edit transport routes and stop sequences.

```text
Header: Routes & Stops Management
Primary action: Add Route
Secondary actions: Import Routes, export, duplicate selected route
KPI strip: Total Routes | Active Stops | Average Route Occupancy | Route Change Requests
Filters: Route Type | Shift | Driver | Vehicle | Active Status | Search
Main: Server-paginated route list with selected row highlight
Right rail: Route details, route summary, stop sequence, pickup windows, route path sequence, actions
Bottom: Validation alerts and re-validation action where API supports it
```

Required route validation alerts:

- Vehicle double-booked.
- Driver/conductor overlapping assignment.
- Stop time conflict.
- Route capacity full.
- Stop capacity exceeded.
- Student assigned to multiple active routes.
- One-day route change conflict.

Conflict flow:

```text
Validation Alert
-> View Details
-> Conflict Panel
-> Suggested Fixes where backend provides them
-> Apply / Ignore with Reason where policy allows
```

Route path visualizations should use a sequence/stepper first. Do not introduce live maps for route editing unless the backend/provider decision is confirmed.

---

## 8. Vehicle Fleet, Documents & Maintenance

**Main job:** manage vehicles, document validity, service state, route assignment, and safety readiness.

```text
Header: Vehicle Fleet, Documents & Maintenance
Primary action: Add Vehicle
KPI strip: Total Vehicles | Active Vehicles | Insurance Expiring | Fitness Expiring | Maintenance Due | Out of Service
Filters: Vehicle Type | Seating Capacity | Status | Maintenance State | Document Expiry
Main: Vehicle fleet table
Right rail: Vehicle profile, assigned route, driver, odometer, document cards, maintenance summary, emergency equipment checklist, actions
```

Document states must be explicit:

| State | UI behavior |
|---|---|
| Valid | Green badge and valid-through date. |
| Expiring soon | Orange badge with days remaining. |
| Expired | Red badge, high-priority alert, assignment warning. |
| Missing | Red outline/warning; upload action if allowed. |
| Pending verification | Blue/gray badge; do not present as valid. |

Vehicle actions must be permission-aware and mutation-safe:

- Assign route.
- Upload/replace document.
- Add maintenance.
- Mark out of service.
- View all documents.
- View maintenance history.

Private vehicle documents must use File Registry-backed protected file helpers. Never expose raw object keys, permanent URLs, or unauthenticated file downloads.

---

## 9. Drivers, Conductors & Assignment Control

**Main job:** manage transport staff records, license validity, trip assignments, and availability.

```text
Header: Drivers, Conductors & Assignment Control
Primary action: Add Staff
KPI strip: Active Drivers | Active Conductors | License Expiry Soon | Assigned Today | Unassigned Staff | Background Check Pending
Filters: Role | Availability | Assigned Route | License Status | Vehicle Type
Main: Driver/conductor table
Right rail: Selected staff profile, emergency contact, license details, assignment summary, recent trips, documents, today's assignments, quick actions
```

Do not overload one status badge. Separate these concepts:

| Concept | Examples |
|---|---|
| Employment status | Active, Suspended, Archived |
| Availability status | Available, Leave, Off Duty |
| Assignment status | Assigned, Unassigned |
| Trip status | On Trip, Completed, Not Started |
| Document/license status | Valid, Expiring Soon, Expired, Missing |

Assignment changes should show impact before saving when they affect today’s trips or parent-visible status.

---

## 10. Student Transport Assignment

**Main job:** assign students to route, vehicle, pickup/drop stops, shift, guardian contact, and special trip notes.

```text
Header: Student Transport Assignment
Primary action: Bulk Assign or Assign Route, depending on selection state
KPI strip: Students Assigned | Pending Assignment | Route Capacity Used | Stop Capacity Warnings | Route Change Requests | Special Pickup Notes
Filters: Class | Section | Route | Stop | Shift | Assignment Status
Main: Student assignment table
Right rail: Selected student transport profile, guardian/emergency contact, notes, history, quick actions, validation alerts
```

Bulk assignment flow:

```text
Select Students
-> Bulk Assign
-> Choose Route
-> Choose Pickup Stop
-> Choose Drop Stop
-> Choose Shift
-> Preview Capacity Impact
-> Confirm Assignment
```

Preview must show:

- Route capacity before/after.
- Stop capacity before/after.
- Students missing guardian contact.
- Students missing emergency contact.
- Students with medical/special trip notes.
- Overlapping assignment or route-change conflicts.

Parent-visible fields should be clearly distinguished from internal admin notes.

---

## 11. Trip Dispatch & Operations Board

**Main job:** create, assign, start, monitor, complete, and audit daily trips.

```text
Header: Trip Dispatch & Operations Board
Primary action: Create Trip
Secondary actions: Bulk Assign | Start Selected | Mark Complete | Export Manifest
KPI strip: Trips Scheduled Today | Ready to Start | In Progress | Completed | Delayed Trips | Unassigned Trips
Alert banner: Vehicle/driver/conductor double-booking and other blocking validation alerts
Main: Kanban board grouped by trip state
Right rail: Selected trip summary, staff assignment, route overview, completion checklist, timeline, manifest link
```

Recommended status model:

```ts
type TripStatus =
  | "NOT_STARTED"
  | "READY_TO_START"
  | "IN_PROGRESS"
  | "DELAYED"
  | "ARRIVED"
  | "COMPLETED"
  | "CANCELLED";
```

High-impact actions require confirmation and visible pending/success/error states:

- Start trip.
- Mark complete.
- Cancel trip.
- Reassign driver/conductor.
- Reassign vehicle.
- Override validation conflict.
- Publish or update parent-visible trip status.

---

## 12. Trip Manifest, Boarding & Drop-off

**Main job:** manage stop-wise student boarding, drop-off, absent status, emergency contact, and safety notes during a trip.

```text
Header: Trip Manifest, Boarding & Drop-off
Top: Trip ID, route, vehicle, driver, stop progress, live sync state
Left: Stop list with boarded/dropped/absent/pending counts
Main: Student manifest table for selected/current stop
Actions: Mark Boarded | Mark Dropped | Mark Absent | Call Guardian | Print Manifest
Bottom: Trip-safe information cards for the selected student
```

Safety-critical information must be visually prominent:

- Allergy/medical condition.
- Required medication note.
- Authorized pickup person.
- Emergency contact.
- Special pickup/drop-off note.
- Student absence/leave note.

Offline/poor-network states are required for driver/conductor execution:

```text
Online
Poor Network
Offline - Saving Locally
Pending Local Changes
Sync Failed
Syncing
Synced
Background Location Disabled
GPS Permission Required
```

The UI must prevent accidental mass changes and must show which updates are synced versus locally queued.

---

## 13. GPS Status, Sync Health & Trip History

**Main job:** review latest GPS cache, stale warnings, signal quality, persisted history fallback, and exportable trip history.

```text
Header: GPS Status, Sync Health & Trip History
KPI strip: Latest GPS Feeds | Stale Location Alerts | Good Signal | Fair Signal | Poor Signal | History Exports
Filters: Date Range | Vehicle | Driver | Signal Quality | Trip Status
Main: Latest GPS cache table
Side/bottom: Persisted history fallback, export history, fleet signal quality summary
```

Recommended GPS freshness thresholds:

| GPS state | Rule | UI |
|---|---:|---|
| Fresh | Last sync under 5 min | Green |
| Delayed | 5-15 min | Orange |
| Stale | 15-30 min | Red |
| Critical stale | 30+ min | Red + alert |

The source must be visible where backend provides it:

- Driver device.
- GPS hardware device.
- Gateway.
- Manual fallback.
- Persisted historical fallback.

Do not show an active live map or continuous tracking UI until live tracking has approved backend/provider/load/privacy support.

---

## 14. Parent Portal — Assigned Bus Status

**Main job:** give parents clear, scoped, child-safe visibility into the assigned bus status.

```text
Header: Assigned Bus Status
Child selector: Linked children only
Summary: Not Started | En Route | Delayed | Arrived | Stale Location
Main: Student card with route, vehicle, driver, conductor, assigned stop, pickup window, current status
Alerts: Latest update and stale-location warning where applicable
Cards: Today's trip progress, transport contacts, upcoming pickup information, recent notifications
```

Parent copy must be simple and trust-building. Show stale status honestly, for example:

```text
Location has not updated recently. Please contact transport in-charge for urgent assistance.
```

Do not show internal route conflicts, other students, full manifests, staff-private fields, or exact live coordinates unless school policy and backend support explicitly allow it.

---

## 15. Driver / Conductor Mobile Direction

**Main job:** complete assigned trip operations quickly and safely on a mobile device.

```text
Header: Assigned Trip
Top: Route, vehicle, trip code, status, online/offline state
Progress: Stop timeline with current stop highlighted
Primary actions: Start Trip | Boarding | Drop-off | Complete
Main: Students for current stop with board/drop/absent actions
GPS card: Last sync, signal quality, background location, retry sync
Emergency cards: Emergency Contacts | Call School | View Stop List | End Trip
Footer: Trip Safe Mode / location-sharing state
```

Mobile implementation priorities:

- One-hand operation.
- Large tap targets.
- Outdoor readability.
- Low-end Android performance.
- Poor-network and offline queue behavior.
- Confirmation before ending trip.
- Clear GPS permission/background-location state.
- Parent-visible updates only after successful backend acceptance or explicitly labeled queued state.

---

## 16. Component Checklist

Required shared/module components:

```text
TransportKpiCard
TransportStatusBadge
SignalQualityBadge
ExpiryBadge
ValidationAlertCard
TransportActionButton
RoutePathStepper
TripProgressStepper
StopSequenceTable
VehicleDocumentCard
MaintenanceTimeline
AssignmentStatusPill
TripCard
TripKanbanColumn
SelectedEntityPanel
ParentBusStatusCard
GpsSyncStatusCard
StudentManifestTable
EmergencyContactCard
MedicalNoteCard
PickupAuthorizationCard
OfflineSyncBanner
```

Shared composition primitives:

```text
SchoolOSModuleShell
ModuleHeader
ModuleToolbar
FilterBar
SearchInput
DataTable
RightDetailDrawer
ActionButtonGroup
PaginationControls
EmptyState
LoadingSkeleton
ErrorState
AuditFooter
ConfirmationDialog
ImpactPreviewPanel
```

---

## 17. Status Color Rules

| Meaning | Color family |
|---|---|
| Active, Assigned, En Route, Valid, Good Signal, Completed where operationally successful | Green |
| Pending, Warning, Delayed, Expiring Soon, Fair Signal | Orange |
| Expired, Out of Service, Absent, Stale, Poor Signal, Critical conflict | Red |
| Not Started, Neutral, Off Duty, Disabled | Gray |
| Arrived, Completed secondary/step state, Round Trip | Purple |
| Selected, Current Stop, Primary action, Active navigation | Blue |

Status color cannot be the only meaning. Every status also needs a readable label and accessible contrast.

---

## 18. Required Table Behavior

All M8B dense tables must support:

- Server-side pagination.
- Server-side filtering for growing datasets.
- Backend-provided total counts.
- Sticky header where useful.
- Active filter chips.
- Row hover and selected-row highlight.
- One primary row action.
- Secondary row actions under `More`.
- Bulk selection only where safe.
- Export actions only where backend supports export.
- Loading, empty, error, permission-denied, module-locked, and slow-network states.
- Sensitive columns hidden unless permission allows.

Important tables:

| Screen | Table |
|---|---|
| Dashboard | Current Trip Status; Latest GPS Cache |
| Routes | Route List; Stop Sequence |
| Vehicles | Vehicle Fleet; Documents; Maintenance History |
| Staff | Driver/Conductor Table |
| Students | Student Transport Assignment |
| Trips | Trip list or Kanban source data |
| Manifest | Student Boarding/Drop-off Table |
| GPS | Latest GPS Cache; Persisted History; Export History |

---

## 19. Validation and Safety Rules

M8B must surface validation issues aggressively because transport changes can affect student safety and parent-visible status.

Required validation alerts:

- Vehicle double-booked.
- Driver/conductor double-booked.
- Route capacity full.
- Stop capacity exceeded.
- Student assigned to multiple active routes.
- Missing guardian contact.
- Missing emergency contact.
- Missing or expired vehicle document.
- Driver license expired.
- Vehicle out of service but assigned to trip.
- GPS stale during active trip.
- Pickup/drop-off status mismatch.
- Completion attempted before checklist is satisfied.
- Parent-visible status update failed or is queued.

High-impact write actions need confirmation, impact preview where applicable, pending state, success/error state, and audit/reason where backend policy requires it.

---

## 20. Implementation Notes

1. Keep live map, SSE, and WebSocket UI deferred until backend/provider/load/privacy decisions are confirmed.
2. Use latest GPS/status tables and clear stale labels first.
3. Keep parent and driver data child/assignment-scoped and fail-closed.
4. Do not calculate official route utilization, trip totals, or GPS fleet health in the browser unless the API explicitly defines it as display-only metadata.
5. Do not use fake transport data in production screens.
6. Use protected file helpers for vehicle documents, staff documents, exports, manifests, and reports.
7. Use Nepal Time labels where trip operations are time-sensitive.
8. Use server-refetched truth after every assignment, trip, manifest, GPS, or document mutation.
9. Keep offline/poor-network states explicit for mobile and driver workflows.
10. Keep implementation aligned with `apps/web/docs/DESIGN_SYSTEM.md`, backend OpenAPI/contracts, and existing route structure.
