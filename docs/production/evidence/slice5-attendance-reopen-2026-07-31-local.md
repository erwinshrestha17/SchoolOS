# Slice 5 — Attendance Reopen / Correction / Re-lock (2026-07-31, local)

Status: **PARTIAL (local development complete; not staging / controlled-pilot validated)**

## Objective

Close the Slice 2 deferral: wire a dedicated locked-session override UI to `attendance:override_lock`, keep correction/conflict review fail-closed on `attendance:review_conflicts`, and surface honest re-lock messaging after audited changes.

## Implementation completed

- **`apps/web/lib/api/attendance.ts`** — `overrideLockedAttendanceSession()` → `PATCH /attendance/sessions/:id/override`
- **`apps/web/components/forms/attendance-form.tsx`** — override mode for `canOverrideLock` on locked/submitted sessions: audited reason, changed-student diff, confirm dialog (“Apply & re-lock”), records remain locked after save
- **`apps/web/components/attendance/attendance-correction-review.tsx`** — fail-closed `PermissionDenied` without review authority
- **`apps/web/components/attendance/attendance-m2-workspaces.tsx`** — correction detail: policy-backed min reason, lock-state escalation notice, approved re-lock copy
- **`apps/web/components/attendance/attendance-conflict-review.tsx`** — review actions gated on `canReviewConflicts`
- **`apps/web/test/slice5-attendance-lock-override-contract.test.mjs`** — focused contract coverage

## Verification run (local)

```bash
pnpm --filter @schoolos/web typecheck
node --test apps/web/test/slice5-attendance-lock-override-contract.test.mjs \
  apps/web/test/m2-attendance-workspace-contract.test.mjs \
  apps/web/test/permissions-ui-contract.test.mjs
```

Results: web typecheck exit 0; focused contracts **16/16 pass**.

## Remaining gaps

- Authenticated browser proof for override + correction approval matrix
- Period/session attendance route (`/dashboard/attendance/sessions/:id`) still documents daily-only backend contract
- Staging HTTP verification against seeded principal/admin override identities

Do not treat this local slice as staging, controlled-pilot, or GA evidence.
