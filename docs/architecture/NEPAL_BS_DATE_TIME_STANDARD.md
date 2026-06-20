# Nepal BS Date and Time Standard

## Canonical policy

- **School operating timezone:** `Asia/Kathmandu`.
- **School-facing display calendar:** Bikram Sambat (BS), English month names and English numerals.
- **Timestamp storage:** UTC instants only (`timestamptz` / Prisma `DateTime`).
- **Date-only business transport:** Gregorian `YYYY-MM-DD`, explicitly interpreted as a Nepal local school date.
- **Display order:** UTC instant -> `Asia/Kathmandu` local civil date/time -> BS conversion -> English formatted value.

Never use browser timezone, host timezone, a rough year/month offset, formatted strings as operational truth, or a permanent fixed Nepal offset as the implementation source of truth.

## Shared implementations

- `packages/core/src/nepal-date.ts` is the canonical backend/web policy implementation.
- `apps/schoolos_mobile/lib/shared/utils/nepali_bs_calendar.dart` is the Flutter adapter. It uses `timezone` for IANA `Asia/Kathmandu` conversion and `nepali_utils` for validated BS conversion.
- Both platforms are pinned by the same cross-platform fixtures: `2024-04-13 = 2081-01-01` and `2026-06-20T05:00:00Z = Asar 6, 2083, 10:45 AM NPT`.

## Required helpers

Use the shared equivalents rather than direct `Intl`, `toLocale*`, `DateFormat`, browser-local `Date`, or manual date arithmetic:

```text
getNepalNow()
toNepalLocalDateTime()
formatBsDate()
formatBsDateTime()
formatBsDateForInput()
parseBsDateInput()
toGregorianDateFromBs()
toBsDateFromGregorian()
getNepalSchoolDay()
isSameNepalSchoolDay()
```

## Presets

```text
2083-03-06
Asar 6, 2083
Saturday, Asar 6, 2083
Asar 6, 2083, 10:45 AM NPT
10:45 AM NPT
2083/84
Asar 1–6, 2083
Chaitra 29, 2082 – Baisakh 2, 2083
```

## Backend query boundary example

For a daily school operation, use the UTC bounds returned from `getNepalSchoolDay()`:

```ts
const day = getNepalSchoolDay();
const records = await prisma.attendanceRecord.findMany({
  where: {
    tenantId,
    createdAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
  },
});
```

Do not construct host-local midnight through `setHours(0, 0, 0, 0)`.

## Date-only fields and migration rule

Existing `DateTime` fields must not be destructively migrated just to change display. Their display is converted to BS at the boundary.

Before changing an existing date-only business field, confirm its Prisma schema, DTO, OpenAPI definition, existing stored semantics, web/mobile payload contract, and query behavior. A migration is required only when stored legacy values are known to represent a browser/server-local day rather than a Nepal school day.

## Required review checklist for every module

1. Replace direct school-facing formatting with shared BS helpers.
2. Keep API timestamp payloads as ISO-8601 UTC strings.
3. Keep date-only payloads documented as Gregorian `YYYY-MM-DD` Nepal-local school dates until an explicitly versioned BS-input contract is approved.
4. Convert BS form input to validated Gregorian date-only values before persistence.
5. Use Nepal UTC bounds for attendance, fees, daily closing, reports, scheduled jobs, and session expiry when a school day is involved.
6. Include `NPT` whenever time context matters.
7. Add/extend unit, contract, and end-to-end coverage for the touched workflow.

## Current migration status

The shared policy, web common formatter bridge, a Nepal-time homework cron, and core/mobile fixture tests are in place. Direct formatter and date-only workflow migration remains module-by-module work; it must be verified against actual API contracts before conversion. Do not claim every SchoolOS screen has already migrated.
