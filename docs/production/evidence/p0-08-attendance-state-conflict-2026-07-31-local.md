# P0-08 Attendance State / Conflict Hardening (2026-07-31, local)

Status: **PARTIAL (local development complete for parent-official visibility, correction independence, status vocabulary, and alert cutoff semantics; not staging / controlled-pilot validated)**

## Implementation completed

- Parent list/summary/correction paths require `attendanceSession.submittedAt != null` so drafts are never treated as official parent attendance.
- Correction review rejects the original session submitter and the correction requester (independent reviewer).
- Corrections cannot be opened against unsubmitted sessions.
- Prisma `AttendanceStatus` expanded with `EARLY_AUTHORIZED_DEPARTURE`, `UNAUTHORIZED_DEPARTURE`, and `PERIOD_ABSENT` (migration `20260731200000_p0_08_attendance_status_vocabulary`).
- Parent labels, summary/matrix counts, and post-lock alert routing recognize the new statuses.
- Sync rejection classifier maps already-submitted conflicts to `STALE_DRAFT`.
- Parent/staff absence alerts continue to emit only after session lock cutoff, not on draft or just-submitted unfinished sessions.
- List attendance payloads expose canonical `state` via `resolveAttendanceSessionState`.

## Verification run (local)

```bash
pnpm compile:artifacts
pnpm db:generate
pnpm db:migrate
pnpm --filter @schoolos/core build
pnpm --filter @schoolos/api exec jest src/attendance/attendance.service.spec.ts --runInBand
pnpm --filter @schoolos/api exec jest src/attendance/m2-attendance-hardening.service.spec.ts --runInBand
pnpm --filter @schoolos/api exec tsc -p tsconfig.json --noEmit
```

Results: migrations applied; attendance.service.spec 94/94 pass; m2 hardening 4/4 pass; API typecheck pass.

## Remaining gaps (do not claim pilot-ready)

- ~~Student approved-leave auto-link into attendance records~~ → completed locally in `p0-08-student-leave-auto-link-2026-07-31-local.md`.
- Full conflict evidence matrix (device/server/sync timestamps completeness) and multi-user/multi-device offline scenario suite (release gate / P0-15).
- Period attendance as a distinct operational surface (P1-06 still waits on residual P0-08 work).
- Authenticated browser/device proof.

Do not treat this local slice as staging, controlled-pilot, or GA evidence.
