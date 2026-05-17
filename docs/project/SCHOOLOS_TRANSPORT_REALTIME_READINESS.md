# SchoolOS Transport Real-Time Readiness

**Last updated:** 2026-05-17

This note records the backend readiness boundary before any production live transport map, parent tracking UI, or driver app work begins.

## Current Safe Scope

- Admin/trip/location backend is implemented inside the NestJS modular monolith.
- GPS ingestion validates latitude/longitude, accepts only active trips, and enforces driver assignment unless the actor has transport admin privileges.
- Redis stores the latest trip location with a six-hour TTL.
- PostgreSQL remains the durable source of truth and persists location pings only when the last persisted ping is at least 30 seconds old.
- Redis pub/sub publishes tenant/trip-scoped location updates for existing SSE consumers.
- A Redis pressure key rejects same-user trip pings faster than once per second.
- Location cleanup is tenant-scoped and requires an admin role; retention must be between 1 and 365 days.

## Not Yet Approved

- Production live map UI.
- Parent tracking UI.
- Driver app.
- ETA, geofence, overspeed, or route-deviation automation.
- Transport billing/accounting integration.

## Required Before Live Map Expansion

1. Run Docker-backed staging with Postgres, Redis, API, and web.
2. Load-test GPS ingestion with realistic driver device cadence.
3. Confirm Redis pub/sub behavior with multiple subscribers and reconnects.
4. Decide whether SSE is enough for admin-only live status or whether WebSocket fanout is needed.
5. Add operational metrics for rejected pressure pings, Redis failures, stale cache, and persisted ping counts.
6. Add browser smoke for stale/latest location states before adding map rendering.
7. Keep parent/driver/mobile routes deferred until ownership and device-auth contracts are approved.

## Recommended Next Implementation

Keep the next pass admin-only:

- Add stale-location metrics and admin labels.
- Add a report for location ingestion acceptance vs rejection counts.
- Add Redis outage fallback behavior for latest-location reads.
- Run Playwright only against seeded staging, not invented production data.
