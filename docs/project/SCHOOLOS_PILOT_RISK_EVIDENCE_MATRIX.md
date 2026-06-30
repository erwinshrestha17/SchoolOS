# SchoolOS Pilot Risk-Evidence Matrix — Tracked Checklist

**Status:** Active supporting pilot gate checklist
**Owner/audience:** Product owner, engineering, QA, security, deployment owner, pilot-success owner
**Scope:** Evidence required before a paid Grade 1-10 design-partner signature and before shadow-mode cutover. This checklist does not replace the GA release policy or production readiness audit.
**Precedence:** Execution sequencing remains in `SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`; current evidence remains in `SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`; release-stage decisions remain in `../production/SCHOOLOS_GA_RELEASE_POLICY.md`.
**Last reviewed date:** 2026-07-01

---

**Gating rule:** No paid design-partner signature until the sold Grade 1-10 slice passes entitlement isolation and every money/tenant-risk row below has a named automated test plus live browser/device proof. Commercial learning (the interview screener) runs now, in parallel. Paid operational dependency comes only after this checklist is evidenced.

**No percentage targets.** Each row needs a named test and one live proof artifact (screen recording, log excerpt, or signed-off manual run) — not a coverage number.

## How to use this

For each row: name the actual test(s) that prove it, mark status, link evidence, and record who signed off. A row is not "done" because a test with a related name exists — it is done when someone can point to the proof artifact.

| Status key | Meaning |
|---|---|
| Not started | No test identified or written |
| Written | Test exists, not yet run against seeded or staging data |
| Automated-passing | Automated test passes in CI or recorded verification |
| Live-proven | Automated pass **and** a live browser/device run confirms it against seeded tenant data |

## Matrix

| # | Risk | Required proof | Named test(s) | Status | Evidence link | Signed off by |
|---|---|---|---|---|---|---|
| 1 | Cross-tenant exposure | Read, write, export, file, job, cache, and mobile denial tests across tenant boundary | | Not started | | |
| 2 | Parent scope | Linked child only; guardian removal revokes access immediately | | Not started | | |
| 3 | Teacher scope | Assigned class/section/subject only; cannot reach unassigned class by any path including deep link | | Not started | | |
| 4 | Money integrity | Duplicate payment, retry, reversal, refund, receipt issuance, cashier-close overlap | | Not started | | |
| 5 | Entitlement isolation (licensed-core) | Disabled/deferred module denied at route, API, job, file, and mobile-deep-link level — see sub-checklist below | | Not started | | |
| 6 | Suspended tenant | API, web, mobile, jobs, exports, and files all fail closed for a suspended tenant | | Not started | | |
| 7 | Protected files | Unauthorized download, expired link, cross-tenant file access all denied | | Not started | | |
| 8 | Auditability | Sensitive mutation records actor, timestamp, reason, and target | | Not started | | |
| 9 | Offline financial integrity | Parent app **blocks** offline payment initiation outright — does not queue it for later sync | | Not started | | |
| 10 | Unpublished result exposure | Unpublished marks/report card unreachable via direct URL, API, file, notification payload, or mobile deep link | | Not started | | |

## Sub-checklist: Entitlement Isolation (Row 5)

A module being "not sold" only counts if every one of these is independently true for the pilot tenant:

```text
[ ] Deferred-module web routes return module-locked or forbidden — not a blank/broken page.
[ ] Deferred-module API endpoints deny access at the server boundary.
[ ] Deferred jobs/events do not execute for that tenant (verify in queue/worker logs, not just absence of UI).
[ ] Deferred files/exports cannot be generated or accessed, including by direct file ID/URL.
[ ] Mobile deep links cannot bypass the restriction.
[ ] A tenant-admin cannot self-enable a deferred module without the approved platform path.
[ ] Shared/cross-cutting services — notification feed, global search, dashboard aggregations,
    audit/activity surfaces, scheduled exports, background jobs — filter every item they
    surface by BOTH tenant AND module entitlement, not just by tenant ID.
```

That last item is the one most likely to be missed: a notification service or principal dashboard that queries "all events for this tenant" can leak a deferred-module item even when that module's own routes are correctly locked, because it is not re-checking entitlement per item it aggregates.

## Sign-off

| Gate | Required before | Confirmed by | Date |
|---|---|---|---|
| All 10 rows live-proven | Paid design-partner signature | | |
| Entitlement isolation sub-checklist complete | Paid design-partner signature | | |
| Shadow-mode attendance + fees run completed without P0/P1 incident | Cutover from shadow to live | | |
