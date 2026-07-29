# M1 Admissions verification (2026-07-29, local)

Status: **PASS (local development complete; not staging validated)**

Scope: P1-04 post-revoke guardian notification inbox fail-closed, admissions admin queues, guardian mobile scope, QR workspace summary, pilot-rehearsal tenant permission seed fix.

| Check | Result | Detail |
|---|---|---|
| P1-04 `mobile.service.spec` notification visibility | PASS | Direct recipient match requires `studentId: null`; child-linked deliveries drop after revoke |
| `admissions.service.spec` | PASS | 21/21 |
| `m1-admissions-http.e2e-spec` | PASS | 13/13 incl. QR summary tenant isolation |
| `pnpm verify:m1-admissions` (pilot-rehearsal-1) | PASS | 11/11 admin + parent scope checks |
| `pnpm smoke:pilot:rehearsal` | PASS | Wave 1 role boundaries incl. M1 admin routes |

## Commands run

```bash
pnpm --filter @schoolos/api test mobile.service.spec -- -t notification
pnpm --filter @schoolos/api test admissions.service.spec
pnpm --filter @schoolos/api test:e2e -- m1-admissions-http.e2e-spec
SMOKE_TENANT_SLUG=pilot-rehearsal-1 \
  SMOKE_EMAIL=admin@pilot-rehearsal.schoolos.test \
  SMOKE_PASSWORD=PilotRehearsal1! \
  SMOKE_PARENT_EMAIL=guardian.c01a001@schoolos.test \
  SMOKE_PARENT_PASSWORD=PilotRehearsal1! \
  pnpm verify:m1-admissions
pnpm smoke:pilot:rehearsal
pnpm provision:pilot-rehearsal   # refreshes role permissions (compound resource keys)
```

## Code changes in this slice

- **P1-04:** `MobileService.parentNotificationVisibility` requires `studentId: null` for direct `recipientUserId` matches so child-linked deliveries do not leak after guardian revoke.
- **Pilot seed fix:** `seed-pilot-rehearsal-tenant.ts` now parses compound permission keys (`students:qr:read`) correctly when syncing role permissions.

## Remaining M1 gaps (honest)

- **P1-05:** No DB constraint for single primary guardian (deferred).
- **Staging/pilot:** TLS VPS staging, controlled pilot owner sign-off, and fixture-gated browser E2E (reminder/waitlist/assessment/bulk import) not re-run in this capture.
- **Not claimed:** GA/production release.
