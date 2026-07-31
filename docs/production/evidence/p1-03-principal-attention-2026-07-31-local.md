# P1-03 Principal Attention View (2026-07-31, local)

Status: **PARTIAL (local development complete for consolidated queue coverage + owning-module drill-through; not staging / controlled-pilot validated)**

## Implementation completed

Consolidated Principal Attention queues now cover the roadmap set with drill-through to owning modules (no new workflow engine):

| Queue | Web `/dashboard/summary` | Mobile `GET /mobile/principal/attention` |
|---|---|---|
| Pending staff leave | Yes → `/dashboard/hr/leave` | Yes → `/principal/approvals` |
| Attendance corrections | Yes → `/dashboard/attendance/corrections` | Yes → `/principal/approvals` |
| Result corrections | Yes → `/dashboard/academics/report-cards` (`pendingReportCardCorrections`) | Yes → `/principal/academics-readiness` |
| Urgent notices | Yes → notices | Yes → `/principal/notices` |
| Missing attendance submissions | Yes → register | Yes → `/principal/attendance-risk` |
| Unresolved high-priority parent cases | Deferred (web Action Centre residual from P0-11) | Yes — HIGH or overdue only → `/principal/service-requests/:id` |

Additional hardening:

- Mobile Attention filters parent service requests to **HIGH priority or overdue** (lower-priority active cases stay on the dedicated queue).
- Flutter `PrincipalAttentionScreen` drills into any `/principal/...` owning route (previously only service-request routes were tappable).

## Verification run (local)

```bash
pnpm --filter @schoolos/api exec jest \
  src/mobile/mobile-principal.service.spec.ts \
  src/operational-summary/operational-summary.service.spec.ts \
  --runInBand
cd apps/schoolos_mobile && flutter test \
  test/mobile_blank_screen_regression_test.dart \
  --name "principal attention"
```

Results: API focused suites **36/36 pass**; Flutter principal-attention regression **pass**.

## Remaining gaps (do not claim pilot-ready)

- Web Action Centre UI for high-priority parent service-request queue (still P0-11 residual).
- Authenticated browser E2E and device QA for Attention drill-through (P0-15 matrix).
- Student leave (parent-submitted) as a distinct attention queue item, if product wants it separate from staff leave / attendance corrections.

Do not treat this local slice as staging, controlled-pilot, or GA evidence.
