# M8B Hostel — Web Reference Analysis

**Status:** Supporting M8B design analysis for the SchoolOS web implementation pass.  
**Updated:** 2026-06-19  
**Master design source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` remains the active web frontend source of truth. Backend/OpenAPI/shared contract types remain authoritative for fields, routes, permissions, totals, mutations, exports, protected files, parent scope, warden scope, finance handoff, and audit semantics. This document records the focused reference-screen analysis and should be consolidated into the master web plan during the next master-doc curation pass.

---

## 1. Scope Note

The supplied 2026-06-19 references show the mature SchoolOS desktop and mobile frontend language through M8C Canteen screens, while the sidebar taxonomy in those references positions M8B as **Hostel**. This appendix adapts the proven SchoolOS workbench patterns from those references into a hostel-specific M8B design direction.

This document is design guidance only. It does not claim that a hostel backend, routes, permissions, seed data, mobile APIs, or browser tests already exist. Every screen, metric, filter, action, and document flow below requires backend/OpenAPI/shared-contract confirmation before implementation.

If the current repository still contains older M8 numbering where M8B is Transport, do not rename or remove implemented Transport surfaces from code based only on this design appendix. Treat M8B Hostel as an approved design reference requiring product/module-contract reconciliation before route or permission changes.

---

## 2. Purpose

M8B Hostel is the school residential-operations command center. It should help hostel administrators, wardens, gate/security staff, finance users, maintenance staff, parents, and school leadership manage student residence safely and efficiently.

The module should cover:

- Hostel overview and attention dashboard.
- Blocks, floors, rooms, beds, and capacity.
- Resident profile and hostel assignment.
- Roll call, attendance, check-in, and check-out.
- Leave, gate pass, late return, and visitor management.
- Medical, allergy, discipline, and welfare alerts.
- Hostel fee plan and finance invoice handoff.
- Room/facility maintenance and issue tracking.
- Parent-scoped hostel status visibility.
- Mobile warden/gate scanner flow with offline/retry-safe states.

M8B must feel like a **safety-first campus operations control center**, not a decorative dashboard or a simple room register.

Every screen keeps the SchoolOS rule: **one screen = one main job**.

---

## 3. Design DNA Extracted From References

The references establish these reusable frontend patterns:

| Pattern | Required M8B Hostel use |
|---|---|
| Persistent SchoolOS shell | Same left sidebar, compact topbar, school/year context, global search, notification state, role menu, status pill, and Nepal Time footer. |
| KPI strip | Backend-owned hostel summaries only. No fake occupancy, attendance, fee, or alert counts. |
| Quick actions | Primary operational shortcuts such as Add Resident, Assign Room, Record Roll Call, Create Leave Pass, Register Visitor, Report Maintenance, and Sync Hostel Fees. |
| Data table + right rail | Main list/grid for work, selected record detail rail for context and actions. |
| Safety alert cards | Medical/allergy/discipline/welfare alerts shown before high-risk actions. |
| Retry-safe finance and sync language | Fee handoff, protected receipt/download, offline scan, and duplicate prevention states must be explicit. |
| Parent portal simplification | Parents see only linked-child hostel status, leave/gate-pass history, notices, receipts, and warden contact. |
| Mobile scanner flow | Warden/gate flow must prioritize QR scan, verified student state, safety warnings, action confirmation, offline queue, and retry sync. |

---

## 4. Product and Privacy Boundaries

| Persona | Allowed visibility | Must not expose |
|---|---|---|
| Hostel admin / warden | Tenant-scoped hostel blocks, rooms, beds, residents, roll calls, leave/gate pass, visitors, alerts, maintenance, fee-handoff status, and audit events. | Cross-tenant data, unrelated academic/private details, raw file keys, internal platform controls, or unsupported live/security claims. |
| Gate/security staff | Assigned gate actions, approved passes, visitor verification, check-in/check-out state, late return alerts, and emergency contact where policy allows. | Full finance data, broad student profiles, unrelated room occupancy, or internal staff notes outside gate work. |
| Parent / guardian | Linked child’s hostel assignment, today’s attendance/status, approved leave/gate-pass history, hostel notices, receipts, and warden contact. | Other residents, full room roster, internal discipline notes, other guardians, or broad hostel occupancy details. |
| Principal / leadership | Decision-level summaries: occupancy, safety exceptions, pending approvals, fee handoff, maintenance risk, and incident trend. | Unnecessary raw operational detail where summary is sufficient. |
| Maintenance staff | Assigned room/facility issues, status, photos/documents where authorized, and resolution checklist. | Student-private records unrelated to the assigned issue. |

Parent, gate, maintenance, and mobile surfaces must use purpose-limited APIs. Do not reuse admin-shaped payloads directly.

---

## 5. Recommended Route Map

```text
/dashboard/hostel
/dashboard/hostel/rooms
/dashboard/hostel/residents
/dashboard/hostel/attendance
/dashboard/hostel/leave
/dashboard/hostel/gate-pass
/dashboard/hostel/visitors
/dashboard/hostel/fees
/dashboard/hostel/maintenance
/dashboard/hostel/reports
/dashboard/hostel/settings

/parent/hostel/overview
/parent/hostel/leave
/parent/hostel/receipts

/warden/hostel/scanner
/warden/hostel/roll-call
/warden/hostel/gate
```

Route naming must follow the existing Next.js app-router structure if the repository already defines a different stable path. Treat unknown route/API contracts as `needs OpenAPI confirmation` rather than inventing endpoints.

---

## 6. Navigation Structure

Recommended M8B subnavigation:

```text
Overview
Rooms & Beds
Residents
Attendance / Roll Call
Leave & Gate Pass
Visitors
Fees & Handoff
Maintenance
Reports
Settings
```

MVP-safe subnavigation:

```text
Overview
Rooms & Beds
Residents
Attendance
Leave & Visitors
Fees
Maintenance
Reports
```

Sidebar taxonomy from the supplied references:

```text
M8 - Operations (Campus)
M8A - Transport
M8B - Hostel
M8C - Canteen
M8D - Library
M8E - Store & Inventory
M8F - Assets
M8G - Maintenance
```

Do not change the actual product taxonomy in code until product ownership, route ownership, module entitlement, permissions, API contracts, and migration/backward-compatibility decisions are confirmed.

---

## 7. Delivery Priority

| Priority | Screens | Outcome |
|---|---|---|
| **P0** | Hostel Dashboard; Rooms & Beds; Residents; Attendance/Roll Call; Leave & Visitors | Core hostel operation is understandable and real-API backed. |
| **P1** | Gate Pass; Visitor Verification; Medical/Discipline Alert Handling; Maintenance | Safety-sensitive hostel workflows become auditable and operationally safe. |
| **P2** | Hostel Fees & Handoff; Parent Hostel Portal; Warden Mobile Scanner | Finance, parent visibility, and mobile execution are polished. |
| **Deferred** | Live CCTV/security integrations, biometric attendance, real-time location inside hostel, AI risk prediction | Implement only after backend/provider/privacy/security decisions and tests are confirmed. |

---

## 8. Hostel Dashboard Overview

**Main job:** summarize hostel operations and surface what needs immediate attention.

```text
Header: Hostel Dashboard Overview
Purpose: Real-time overview of hostel occupancy, student safety, attendance, leave, visitors, fees, and maintenance.
Primary action: Record Roll Call or Add Resident, depending on operational context
KPI strip: Occupied Beds | Available Beds | Students Present Today | Pending Leave Requests | Active Visitors Today | Medical Alerts | Maintenance Issues | Fee Handoff Pending
Quick actions: Add Resident | Assign Room / Bed | Record Roll Call | Create Leave Pass | Register Visitor | Report Maintenance | Sync Hostel Fees | Export Report
Main: Today’s hostel schedule, recent hostel activity, pending leave requests, room occupancy alerts, safety alerts, maintenance issues, fee handoff summary
Bottom: Parent visibility summary, protected document note, last updated timestamp, Nepal Time note
```

Recommended attention order:

1. High-risk safety alerts: medical issue, severe allergy, unauthorized exit, missing roll-call student, unknown visitor, late return.
2. Pending leave/gate-pass approvals.
3. Today’s check-in/check-out and roll-call state.
4. Room occupancy and maintenance-blocked rooms.
5. Hostel fee handoff and protected receipts/documents.
6. Parent-visible updates.

The dashboard should be an aggregation page, not a full editing workspace.

---

## 9. Rooms, Blocks & Bed Allocation

**Main job:** manage hostel capacity, room state, and bed assignment.

```text
Header: Rooms, Blocks & Bed Allocation
Primary action: Assign Room / Bed
KPI strip: Total Beds | Occupied Beds | Available Beds | Maintenance Blocked | Over-capacity Rooms | Reserved Beds
Filters: Block | Floor | Gender / Hostel Type | Capacity | Room Status | Class | Search
Main: Room grid or server-paginated room table
Right rail: Selected room details, bed map, assigned residents, capacity, warden, room assets, maintenance state, recent history
```

Recommended room states:

```text
Available
Full
Over Capacity
Under Maintenance
Reserved
Blocked
Inactive
```

Room card hierarchy:

```text
Room A-204
Boys Block A
4 / 4 beds occupied
Status: Full
Warden: Pooja B.
```

Assignment preview must show:

- Room capacity before/after.
- Hostel block/floor rule compatibility.
- Existing room residents if policy allows staff visibility.
- Medical/allergy/discipline considerations.
- Maintenance-blocked state.
- Fee/plan requirement if hostel assignment depends on billing.

---

## 10. Resident Hostel Profile

**Main job:** inspect and manage one resident’s hostel assignment, status, and safety-sensitive context.

```text
Header: Student Hostel Profile / Residents
Primary action: Add Resident or Change Room, depending on selection state
KPI strip: Active Residents | New Admissions | Pending Room Assignment | On Leave | Restricted / Watchlist | Low Fee Balance
Filters: Student | Class | Section | Block | Room | Status | Alert state
Main: Resident table with selected row state
Right rail: Student photo, hostel ID, class, room, bed, status, guardian contact, medical alerts, discipline/welfare notes, leave history, fee state, recent check-in/out, quick actions
```

Quick actions:

```text
Change Room
Record Leave
Mark Check-in
Mark Check-out
Add Note
Contact Guardian
Restrict Hostel Access
View Audit Trail
```

Sensitive actions must require permission, reason, confirmation, and audit.

---

## 11. Attendance, Roll Call & Check-in/out

**Main job:** verify residents during roll call and record hostel presence safely.

```text
Header: Hostel Attendance, Roll Call & Check-in/out
Primary action: Start Roll Call or Confirm Present
Left: QR scanner / student search / roll-call session selector
Center: Verified student profile, room/bed, current status, leave status, medical/discipline alerts, action confirmation
Right rail: Scan activity, failed scans, override audit events, missing students
```

Required states:

```text
Student Verified
Present
Already Checked In
On Approved Leave
Missing From Roll Call
Late Return
Unauthorized Exit
Medical Alert
Restricted Access
Unknown QR
Expired QR
Offline - Queued
Sync Failed
```

Confirmation actions:

```text
Confirm Present
Mark Late
Mark Absent
Confirm Check-in
Confirm Check-out
Override with Reason
```

Override rule:

```text
Any override of leave, attendance, late return, unauthorized exit, unknown QR, expired QR, or restricted-access state requires a reason, backend authorization, and audit record.
```

---

## 12. Leave, Gate Pass & Visitor Management

**Main job:** review and control movement into and out of hostel safely.

Recommended tabs:

```text
Leave Requests
Gate Passes
Visitors
Late Returns
History
```

Leave table:

| Student | Room | Leave Type | From | To | Guardian Approval | Status | Action |
|---|---|---|---|---|---|---|---|

Visitor table:

| Visitor | Student | Relation | Entry Time | ID Verified | Status | Action |
|---|---|---|---|---|---|---|

Right rail for selected request should show:

- Student details.
- Room/bed.
- Guardian and emergency contact.
- Leave purpose.
- Requested dates/times.
- Previous leave and late-return history.
- Visitor identity/document verification state.
- Approval chain.
- Audit log.
- Approve/reject/override actions.

Security-sensitive copy should be explicit:

```text
Approve Gate Pass
Reject with Reason
Override with Reason
Verify Visitor ID
Mark Returned
Escalate to Warden
```

Do not allow silent approve/reject actions.

---

## 13. Hostel Fees & Finance Handoff

**Main job:** manage recurring hostel plans and safely sync hostel fees to finance.

```text
Header: Hostel Plans & Fee Invoice Handoff
Purpose: Manage recurring hostel plans and sync hostel fees to finance as invoices.
Primary action: Create Hostel Plan
KPI strip: Active Hostel Plans | Students Subscribed | Invoice Handoff Pending | Linked Fee Amount | Failed Syncs
Tabs: Monthly Plans | Term Plans | Class-specific Plans | Deposits | History
Filters: Plan status | Sync state | Class | Hostel block | Date range
Main: Plan table with selected row
Right rail: Plan details, students, rules, discount/deposit rules, finance handoff, linked invoice preview, sync history, retry-safe notice
```

Recommended plan types:

```text
Monthly Hostel Plan
Term Hostel Plan
Boarding + Lodging Plan
Security Deposit Plan
Class-specific Hostel Plan
Special Exam Stay Plan
```

Finance handoff copy should reuse the reference language:

```text
Retry-safe handoff enabled.
Safe to retry. Duplicate invoices will be prevented.
```

Handoff must be backend-owned, idempotent, and audited. The browser must not calculate official invoice totals.

---

## 14. Hostel Maintenance & Room Issues

**Main job:** track room/facility problems and resolve maintenance work safely.

```text
Header: Hostel Maintenance & Room Issues
Primary action: Report Maintenance Issue
KPI strip: Open Issues | Critical Issues | Resolved Today | Rooms Blocked | Monthly Maintenance Cost
Filters: Block | Room | Category | Priority | Status | Assigned Staff
Main: Maintenance issue table
Right rail: Issue details, room, affected residents, photos/documents, assigned staff, cost estimate, resolution checklist, audit timeline
```

Categories:

```text
Electrical
Plumbing
Furniture
Cleaning
Pest Control
Internet
Security
Other
```

Status model:

```text
Open
Assigned
In Progress
Resolved
Blocked
Reopened
Cancelled
```

Private photos/documents must use File Registry-backed protected file helpers. Never expose raw object keys or permanent public URLs.

---

## 15. Parent Hostel Portal

**Main job:** give parents clear, scoped visibility into their child’s hostel status.

```text
Header: Parent Hostel Overview
Child selector: Linked children only
Cards: Room / Bed | Today’s Attendance | Leave Status | Hostel Fee Status | Warden Contact | Safety / Medical Notes
Sections: Today’s Hostel Status | Recent Hostel Activity | Leave Requests | Gate Pass History | Fee Receipts | Hostel Notices | Warden Contact
```

Parent-visible copy should be simple:

```text
Your child is present in hostel today.
Leave request is waiting for school approval.
Receipt is protected and downloadable.
Contact the hostel warden for urgent assistance.
```

Parents must not see:

- Other students.
- Full room roster.
- Internal staff notes.
- Discipline details unless policy explicitly permits parent visibility.
- Broad hostel occupancy details.
- Raw receipt/PDF object URLs.

---

## 16. Mobile Warden / Gate Scanner

**Main job:** let wardens or gate staff scan, verify, confirm, and sync hostel movement quickly.

```text
Header: SchoolOS
State: Online / Offline / Synced just now / Sync failed
Module: M8B Hostel
Screen: Warden Scanner / Gate Flow
Scanner: Scan Student QR or Gate Pass QR
Student card: Photo, name, class, room, bed, status
Safety alerts: Medical alert, allergy warning, discipline/welfare restriction, leave restriction
Current status: In Hostel | On Leave | Checked Out | Late Return | Restricted
Actions: Confirm Check-in | Confirm Check-out | Confirm Present | Scan Next | View History | Retry Sync
Footer: Retry-safe action note
```

Mobile rules:

- Large tap targets.
- One-hand operation.
- Low-end Android performance.
- Poor-network and offline queue behavior.
- Confirmation before high-risk movement actions.
- Clear synced vs queued vs failed states.
- No admin-wide hostel data on gate/mobile screens.

---

## 17. Shared Component Checklist

Required shared/module components:

```text
HostelKpiCard
HostelStatusBadge
RoomOccupancyCard
BedAssignmentGrid
ResidentProfileRail
RollCallScannerPanel
HostelQrResolver
SafetyAlertCard
LeaveRequestQueue
GatePassStatusBadge
VisitorVerificationCard
MaintenanceIssueTable
HostelFeeHandoffPanel
ParentHostelSummaryCard
MobileSyncStateBanner
ReasonConfirmationDialog
ProtectedFileButton
ProtectedFileLink
AuditTimeline
```

Shared primitives should own visual state, accessible semantics, and safe empty/error/permission/locked behavior. Feature components own real API integration and domain vocabulary.

---

## 18. Status and Color Rules

Use module accent only for location. Semantic state remains explicit through labels, badges, accessible names, and text.

| State type | Visual direction | Examples |
|---|---|---|
| Success / safe | Green | Present, Synced, Approved, Returned, Resolved |
| Warning / pending | Orange | Pending approval, Late return, Low fee balance, Maintenance due |
| Critical / unsafe | Red | Missing from roll call, Unauthorized exit, Medical risk, Unknown visitor |
| Draft / informational | Blue | Draft pass, Awaiting sync, Info note |
| Locked / archived | Gray | Archived resident, Locked plan, Inactive room |

Do not rely on color alone.

---

## 19. Data Contract Checklist Before Implementation

Confirm or add purpose-limited contracts for:

| Surface | Minimum data needed | Confirmation status |
|---|---|---|
| Hostel dashboard | Occupancy, attendance, leave, visitor, safety, maintenance, fee-handoff, and parent-visibility summaries. | needs summary API / OpenAPI confirmation |
| Rooms & beds | Blocks, floors, rooms, beds, occupancy, room status, room assets, capacity rules. | needs module DTO confirmation |
| Residents | Hostel assignments, status, guardian contact, safety alerts, leave history, fee state. | needs module DTO / permission confirmation |
| Roll call/scanner | QR resolution, roll-call session, attendance state, leave state, alert state, offline queue acceptance. | needs scanner contract confirmation |
| Leave/gate/visitor | Requests, approvals, visitor verification, movement status, audit history. | needs workflow contract confirmation |
| Hostel fees | Plans, enrollments/subscriptions, linked fee heads, invoice preview, sync state, retry state. | needs finance handoff contract confirmation |
| Maintenance | Issues, room links, photos/files, assigned staff, status history, cost fields. | needs maintenance contract / File Registry confirmation |
| Parent hostel | Linked-child summaries only, receipts, notices, leave/gate history. | needs parent-scoped contract confirmation |
| Mobile warden | Assigned scope, scanner state, offline queue, sync response, safe error mapper. | needs mobile contract confirmation |

All aggregation must remain server-owned and role-filtered. The frontend may compose independently fetched safe summaries only when each contract is explicitly approved and no cross-module calculation becomes an official truth source.

---

## 20. Browser and Mobile E2E Priorities

When M8B Hostel routes exist, prioritize workflow E2E over pixel-perfect screenshot tests:

```text
Hostel dashboard:
- permission-filtered KPI cards
- unavailable/locked module state
- quick action visibility
- alert drill-through

Rooms & beds:
- room filter + selected room rail
- capacity warning
- maintenance-blocked room cannot be assigned without permitted override

Residents:
- server filter + selected resident rail
- guardian contact permission state
- protected document state

Roll call/scanner:
- student QR/search -> verified profile -> safety alert -> confirmation
- missing/late/unauthorized override requires reason
- duplicate scan and expired/unknown QR state

Leave/gate/visitor:
- approve/reject with reason
- visitor ID verification state
- late return audit event

Fees:
- plan selection -> invoice preview -> idempotent sync/retry state
- failed sync row remains actionable without duplicate invoice claim

Parent portal:
- child-scoped hostel overview
- no other resident/room roster leakage
- protected receipt download state

Mobile scanner:
- online scan success
- offline queued action
- retry sync result
- restricted action permission denial
```

---

## 21. Implementation Boundary

This reference update is design documentation only.

It does **not**:

```text
claim a hostel backend is implemented
claim M8B numbering has been migrated in code
claim any missing API exists
claim seeded hostel data exists
claim parent/warden hostel mobile APIs exist
claim fee handoff is implemented for hostel
approve biometric attendance
approve live CCTV/security integrations
replace backend RBAC, tenant guards, entitlement checks, File Registry, finance idempotency, audit, OpenAPI, or E2E verification
```

The next implementation work must inspect current `apps/web` routes/components, API client helpers, backend controllers/DTOs/OpenAPI, shared contracts, module permissions/entitlements, seed data, and tests before changing code.
