# P0-08 Attendance Leave Auto-Link (2026-07-31, local)

Status: **PARTIAL (local development complete for student leave → attendance auto-link; not staging / controlled-pilot validated)**

## Implementation completed

- New `StudentLeaveRequest` model + migration `20260731210000_p0_08_student_leave_requests`.
- Staff can create/list/review student leave (`/attendance/student-leave-requests*`); parents create/list via mobile (`/mobile/students/:id/leave-requests`) gated by `LEAVE_MANAGE` + `confirmStudentId`.
- Leave type maps to existing attendance statuses (`SICK` → `SICK_LEAVE`, default → `EXCUSED_LEAVE`).
- **Approve-time:** stamps unsubmitted draft session records; submitted/locked days become anomalies (no silent overwrite).
- **Submit-time:** approved leave fills default status when the teacher does not pass an exception.
- **Roster-time:** approved leave surfaces before submission (`leaveInformed`, `approvedLeaveRequestId`).
- Independent review: requester cannot approve/reject own leave request.
- Demo seed includes `LEAVE_MANAGE` for guardian capabilities.

## Verification run (local)

```bash
pnpm compile:artifacts
pnpm db:generate
pnpm db:migrate
pnpm --filter @schoolos/core build
pnpm --filter @schoolos/api exec jest src/attendance/attendance.service.spec.ts --runInBand
pnpm --filter @schoolos/api exec tsc -p tsconfig.json --noEmit
```

Results: migration applied; attendance.service.spec 98/98 pass; API typecheck pass.

## Remaining P0-08 gaps

- Full conflict evidence matrix and multi-user/offline scenario suite (P0-15).
- Parent mobile leave UI polish (API exists; companion screens still thin/absent).
- Period attendance as distinct operational surface (P1-06).

Do not treat this local slice as staging, controlled-pilot, or GA evidence.
