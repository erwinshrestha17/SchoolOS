# M9 Transport — Web Reference Analysis

**Status:** Supporting design analysis for the SchoolOS M9 Transport web implementation pass.  
**Updated:** 2026-06-19  
**Master design source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` remains the active web frontend source of truth. Backend/OpenAPI/shared contract types remain authoritative for fields, routes, permissions, totals, mutations, exports, protected files, parent scope, driver scope, and GPS semantics.

This document replaces the obsolete `M8B_TRANSPORT_WEB_REFERENCE_ANALYSIS.md` numbering. Transport is now **M9**, not M8B.

---

## 1. Product Intent

M9 Transport manages school route operations, not a generic vehicle list.

It must help schools manage:

```text
Vehicles -> Drivers/conductors -> Routes/stops -> Student assignments -> Trips -> Boarding/deboarding -> Parent status -> GPS readiness -> Emergency workflow -> Maintenance reminders
```

---

## 2. Non-Negotiable Frontend Rules

- Parent status must be child-route scoped.
- Driver/conductor views must be assigned-trip scoped.
- Transport screens must show timestamp and stale-state labels for trip/GPS status.
- Live map, WebSocket, SSE, ETA, route deviation, geofence, and overspeed UI remain deferred unless backend/provider/load/privacy decisions are confirmed.
- Emergency contact actions must be confirmation-aware and audited where supported.
- Vehicle/driver document files must use File Registry-backed protected access.
- Do not expose unrelated student academic, fee, guardian, or private profile details inside transport surfaces.

---

## 3. Recommended Route Map

```text
/dashboard/transport
/dashboard/transport/routes
/dashboard/transport/routes/:routeId
/dashboard/transport/stops
/dashboard/transport/vehicles
/dashboard/transport/drivers
/dashboard/transport/assignments
/dashboard/transport/trips
/dashboard/transport/trips/:tripId
/dashboard/transport/maintenance
/dashboard/transport/reports
/dashboard/transport/settings
/parent/transport
/mobile/driver/trips
```

Use existing app route conventions where they differ. Mark unknowns as `needs OpenAPI confirmation`.

---

## 4. Required Screens

### 4.1 Transport Dashboard

- KPI cards: active routes, assigned students, vehicles available, trips today, late/stale trips, expiring documents.
- Quick actions: create route, assign student, assign driver, start trip, review stale GPS, export route list.
- Operational widgets: route coverage, trip timeline, vehicle status, document expiry, emergency alerts.

### 4.2 Routes and Stops

- Route list with search, route code, start/end, stops, assigned students, vehicle, driver/conductor, active state.
- Stop sequence editor with safe drag/reorder only if backend supports it.
- One-day route change workflow with reason and audit.

### 4.3 Vehicle and Driver Assignment

- Vehicle documents, expiry reminders, service/maintenance status.
- Driver/conductor profile references without exposing unrelated HR/payroll fields.
- Assignment conflict detection for overlapping trips.

### 4.4 Trip Operations

- Start/end trip.
- Boarding/deboarding state.
- Latest GPS/status timestamp with stale label.
- Emergency contact flow.
- Parent-safe trip status.

### 4.5 Parent Transport View

Parent can see only linked-child assigned route/trip information:

- assigned route/vehicle
- pickup/drop stop
- driver/conductor contact where policy allows
- boarding/deboarding state
- latest status timestamp
- stale label if data is old

Parent must not see other children, full route roster, driver private HR data, or internal maintenance notes.

---

## 5. Required UX States

```text
Loading
Empty
No assigned route
Permission denied
Module locked
Trip not started
Trip completed
GPS unavailable
GPS stale
Driver not assigned
Vehicle document expiring
Emergency mode
Partial failure
Export queued
```

---

## 6. QA Checklist

- Parent transport view is child-scoped.
- Driver trip view is assignment-scoped.
- Stale GPS/status is labelled, never hidden.
- Overlapping trip assignments are blocked or flagged by backend response.
- Vehicle and driver documents use protected file helpers.
- Emergency actions require confirmation and audit where supported.
- No live-map-only UI is introduced without confirmed backend/provider contract.
