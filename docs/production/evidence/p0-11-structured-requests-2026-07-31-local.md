# P0-11 Structured Requests / Independent Dispute Review (2026-07-31, local)

Status: **PARTIAL (local development complete for independent resolve, escalate reassignment, category capability, and active-case dedup; not staging / controlled-pilot validated)**

## Implementation completed

- **Independent resolve:** requester cannot resolve; assigned first responder cannot resolve (must escalate to another manager).
- **Escalate reassignment:** `EscalateSchoolServiceRequestDto` requires `assignedToUserId` ≠ current assignee; updates assignment + HIGH priority.
- **Category capability gates:** `ATTENDANCE` → `ATTENDANCE_VIEW`, `ACADEMICS` → `ACADEMICS_VIEW`, `FEES_AND_PAYMENTS` → `FEES_VIEW` (in addition to complaint capability).
- **Active-case dedup:** one open `GENERAL_COMPLAINT` per child+category.
- **Idempotency race:** Prisma `P2002` on create returns same-actor existing request instead of 500.
- Mobile principal escalate path updated to require reassignment target.

Attendance corrections and student leave already enforce independent review (P0-08). Payment disputes reuse service-request independence rules above.

## Verification run (local)

```bash
pnpm --filter @schoolos/api exec jest \
  src/service-requests/service-requests.service.spec.ts \
  src/mobile/mobile-principal.controller.spec.ts \
  --runInBand
pnpm --filter @schoolos/api exec tsc -p tsconfig.json --noEmit
```

Results: 21/21 focused tests pass; API typecheck pass.

## Remaining gaps (do not claim pilot-ready)

- Dedicated homework / urgent-concern request types (still GENERAL_COMPLAINT approximations).
- Parent note API (school can write PARENT-visible notes; parents reply via reopen/attachments).
- Web Action Centre UI for service-request queues.
- Cross-guardian invoice dispute dedup; browser/device matrix (P0-15).

Do not treat this local slice as staging, controlled-pilot, or GA evidence.
