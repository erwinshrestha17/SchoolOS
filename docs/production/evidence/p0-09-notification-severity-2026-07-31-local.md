# P0-09 Notification Severity / Acknowledgement Hardening (2026-07-31, local)

Status: **PARTIAL (local development complete for severity distinguishability + delivery honesty labels; not staging / controlled-pilot / provider-validated)**

## Implementation completed

- Mapped roadmap severity vocabulary onto existing `NotificationEventPriority` via `roadmapSeverityFromEventPriority` (Emergency≈MANDATORY, Urgent≈CRITICAL, Action required≈IMPORTANT, Informational≈NORMAL).
- Verified absence (`ATTENDANCE_STUDENT_ABSENT`) default priority raised from `IMPORTANT` → `CRITICAL` (quiet-hours bypass; roadmap Urgent).
- Absence parent copy renamed to **Verified absence** to distinguish from emergency notices.
- Emergency notice deliveries use `sourceType: notice_emergency` and preference category `EMERGENCY` (mandatory; not opt-outable as NOTICE).
- Notification center items expose `priority`, `severity`, and honest `deliveryState` (`SENT_TO_PROVIDER` ≠ delivered/read/acknowledged).
- Attendance event lifecycle validation accepts P0-08 statuses: `UNAUTHORIZED_DEPARTURE` for absent/consecutive; `EARLY_AUTHORIZED_DEPARTURE` for leave.

## Verification run (local)

```bash
pnpm compile:artifacts
pnpm --filter @schoolos/core build
pnpm --filter @schoolos/api exec jest \
  src/communications/notification-center.service.spec.ts \
  src/communications/notification-event.service.spec.ts \
  src/notifications/notification-preference-policy.spec.ts \
  --runInBand
pnpm --filter @schoolos/api exec tsc -p tsconfig.json --noEmit
```

Results: 24/24 focused tests pass; API typecheck pass.

## Remaining gaps (do not claim pilot-ready)

- Provider-accepted / escalated / expired delivery statuses and automated fallback escalation.
- Delivery-level acknowledgement (notice ack exists; general delivery ack does not).
- Neutral lock-screen masking (closer to P0-10).
- Digest severity as a dedicated event class.
- Real provider + fallback evidence (release gate / P0-15).

Do not treat this local slice as staging, controlled-pilot, or GA evidence.
