# P0-04 Effective-Dated Student Roster Membership (2026-07-31, local)

Status: **PARTIAL (local development complete for enrollment segment model; not staging / controlled-pilot validated)**

## Implementation completed

- `Enrollment` gains `effectiveFrom` / `effectiveUntil`.
- Removed one-row-per-student/year uniqueness; historical segments retained.
- Mid-term class/section changes close the prior ACTIVE segment (`TRANSFERRED` + `effectiveUntil`) and create a new ACTIVE segment.
- Transfer/exit/delete/merge paths stamp `effectiveUntil`.
- Admission and seed paths set `effectiveFrom`.
- Migration: `20260731193000_p0_04_enrollment_effective_dates`.

## Honest posture

Historical attendance/marks remain linked to their original session/assessment context via existing models; full mid-term matrix browser/device evidence remains P0-15.
