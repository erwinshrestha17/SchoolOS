# M9 Transport — Frontend Design Reference

**Status:** Active module-level frontend design reference.  
**Updated:** 2026-06-19  
**Module:** M9 Transport  
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`  
**Design system:** `apps/web/docs/DESIGN_SYSTEM.md`

This document defines implementation-ready frontend design guidance and backend-alignment expectations for M9. Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Intent

M9 manages school transport operations. It must support routes, stops, vehicles, driver/conductor assignments, student route assignment, trip state, boarding/deboarding, parent-safe trip status, GPS readiness, emergency contacts, vehicle documents, and maintenance reminders.

Core flow:

```text
Vehicle / driver setup
-> route and stop setup
-> student assignment
-> daily trip start
-> boarding / deboarding
-> status / GPS timestamp update
-> parent child-route visibility
-> emergency and maintenance workflow
```

---

## 2. Theme and Layout Alignment

Use a safety-first operations workbench:

```text
ModuleHeader
Transport KPI strip
Route/trip status tabs
FilterBar
Main route/vehicle/trip workspace
Right detail drawer
Stale status/GPS warnings
Emergency action panel
Protected document actions
```

Design rules:

- Parent status must always include timestamp and stale label where relevant.
- Driver/conductor routes must be assigned-trip scoped.
- Live map/WebSocket/SSE UI is deferred unless backend/provider/load/privacy decisions are confirmed.
- Vehicle/driver documents use protected helpers.
- Emergency actions require confirmation and audit where supported.

---

## 3. Personas and Scope

| Persona | Main job | Scope rule |
|---|---|---|
| Transport manager | Manage routes, vehicles, drivers, assignments, trips. | Tenant-scoped transport permission. |
| Driver/conductor | Run assigned trips and boarding/deboarding. | Assigned trip only. |
| Admin | Configure transport settings and documents. | Permission-gated. |
| Principal | View transport health and safety issues. | Summary/read-only unless permitted. |
| Parent | View linked child route/trip status. | Linked-child route only. |
| Student | View own route where enabled. | Self only. |

---

## 4. Recommended Route Map

```text
/dashboard/transport
/dashboard/transport/routes
/dashboard/transport/routes/[routeId]
/dashboard/transport/stops
/dashboard/transport/vehicles
/dashboard/transport/drivers
/dashboard/transport/assignments
/dashboard/transport/trips
/dashboard/transport/trips/[tripId]
/dashboard/transport/maintenance
/dashboard/transport/reports
/dashboard/transport/settings
/parent/transport
/student/transport
/mobile/driver/trips
```

---

## 5. Required Screens

### 5.1 Transport Dashboard

- KPI cards: active routes, assigned students, vehicles available, trips today, stale trips, document expiries, maintenance due.
- Quick actions: Create Route, Assign Student, Assign Driver, Start Trip, Review Stale GPS, Export Route List.
- Attention queue: unassigned students, expired vehicle docs, overlapping assignments, stale status, emergency alerts.

### 5.2 Routes and Stops

- Route list with code, name, vehicle, driver, stops, assigned students, status.
- Stop sequence with pickup/drop times.
- One-day route change workflow with reason and audit.
- Reorder/drag behavior only if backend supports it.

### 5.3 Vehicle and Driver Management

- Vehicle table with registration, capacity, documents, maintenance, status.
- Driver/conductor assignment without exposing unrelated HR/payroll fields.
- Document expiry reminders with protected files.

### 5.4 Student Assignment

- Student route assignment table with class/section, pickup stop, drop stop, guardian contact where permitted, effective date, status.
- Bulk assignment only if backend supports safe validation.
- Direct edits require conflict checks.

### 5.5 Trip Operations

Trip state:

```text
Scheduled
Started
Boarding
In progress
Delayed
Completed
Cancelled
Stale
Emergency
```

Trip screen must show:

- Assigned vehicle/driver/conductor.
- Student roster scoped to route/trip.
- Boarding/deboarding state.
- Latest status/GPS timestamp.
- Stale warning.
- Emergency contact action.

### 5.6 Parent Transport View

Parent can see only linked-child assigned route/trip information:

```text
Assigned route
Pickup/drop stop
Vehicle summary
Driver/conductor contact where policy allows
Boarding/deboarding state
Latest status timestamp
Stale label if old
Emergency notice if active
```

Do not expose full route roster, other children, driver private HR data, or internal maintenance notes.

---

## 6. Backend Alignment

Required backend capabilities:

```text
Vehicle CRUD and document APIs
Driver/conductor assignment APIs
Route/stop APIs
Student transport assignment APIs
Trip lifecycle APIs
Boarding/deboarding APIs
GPS/latest status ingest and read APIs where supported
Stale status calculation
Emergency contact/action APIs
Maintenance reminder APIs
Parent child-route scoped read APIs
M12 transport notification events
Audit logs for assignment, trip, emergency, and one-day route change
```

Backend ownership rules:

- Parent transport reads are child-route scoped.
- Driver/conductor reads are assigned-trip scoped.
- Latest status/GPS staleness is backend-owned.
- Vehicle/driver files use File Registry.
- Live map UI requires confirmed backend/provider contract.

---

## 7. Required States

```text
Loading
No route assigned
Driver not assigned
Vehicle unavailable
Trip scheduled
Trip started
Trip completed
GPS unavailable
GPS stale
Boarding pending
Student boarded
Student deboarded
Emergency active
Document expiring
Maintenance due
Permission denied
Module locked
Export queued
```

---

## 8. Implementation Checklist

```text
[ ] Reads main web design plan and design system.
[ ] Parent transport view is child-route scoped.
[ ] Driver/conductor view is assigned-trip scoped.
[ ] Stale status/GPS timestamp is visible.
[ ] Overlapping assignment checks use backend response.
[ ] Vehicle and driver documents use protected file helpers.
[ ] Emergency actions require confirmation and audit where supported.
[ ] M12 transport notifications are represented accurately.
[ ] No unconfirmed live map/SSE/WebSocket UI is introduced.
[ ] No fake transport metrics remain.
```
