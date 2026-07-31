# P0-02 Temporary Substitute, Long-Term Replacement, and Handover (2026-07-31, local)

Status: **PARTIAL (local development complete for this hardening slice; not staging / controlled-pilot validated)**

Scope: Close the create-and-assign delegation gap, link substitutions to exact `TeacherDelegation` rows, add long-term replacement + handover/pending-work dispositions, and provide a coordinator web surface.

## Implementation completed in this slice

- `createSubstitution` / draft-update assign paths now create a linked `TeacherDelegation` in the same transaction when a substitute is provided.
- `assign` / `cancel` / `complete` revoke by `timetableSubstitutionId` rather than broad scope/date matching.
- Added `TeacherReplacement`, `TeacherReplacementPendingWork`, and `TeacherHandoverNote` models + migration `20260731190000_p0_02_substitute_replacement_handover`.
- Replacement activation revokes the former assignment operational window and creates the incoming assignment without rewriting historical authorship.
- Pending-work items require explicit TRANSFER / RETURN / CANCEL disposition before completion.
- Coverage and handover notes are audited.
- Web: `/dashboard/timetable/replacements` coordinator workspace + API client methods.

## Migrations

- `apps/api/prisma/migrations/20260731190000_p0_02_substitute_replacement_handover/migration.sql`

## Commands run and results

| Check | Result | Detail |
|---|---|---|
| `pnpm db:validate` | PASS | Prisma schema valid |
| `pnpm db:generate` | PASS | Prisma client generated |
| Focused timetable/replacement suites | PASS | 28/28 |
| Staging / browser / device | NOT RUN | Remains under P0-15 |

```bash
pnpm db:validate
pnpm db:generate
pnpm --filter @schoolos/api exec jest \
  src/timetable/timetable-substitution.service.spec.ts \
  src/timetable/teacher-replacement.service.spec.ts \
  src/timetable/timetable.controller.spec.ts \
  --runInBand
```

## Honest posture

- **Do claim:** Local development complete for temporary substitute linked-delegation correctness and long-term replacement cutover/handover foundations.
- **Do not claim:** Offline revocation/cache purge (P0-03), staging validation, or controlled-pilot readiness.
- Substitute capabilities remain the existing period-attendance + homework-create set; roster/safety expansion is not claimed here.
