CREATE TABLE "JournalEntrySequence" (
    "tenantId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntrySequence_pkey" PRIMARY KEY ("tenantId", "scopeKey")
);

ALTER TABLE "JournalEntrySequence"
ADD CONSTRAINT "JournalEntrySequence_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "JournalEntrySequence" ("tenantId", "scopeKey", "lastValue", "updatedAt")
SELECT
    "tenantId",
    COALESCE("fiscalYearId", 'CALENDAR-' || EXTRACT(YEAR FROM "entryDate")::INTEGER::TEXT),
    MAX(
        CASE
            WHEN "entryNumber" ~ '^JE-[0-9]{4}-[0-9]{6}$'
            THEN RIGHT("entryNumber", 6)::INTEGER
            ELSE 0
        END
    ),
    CURRENT_TIMESTAMP
FROM "JournalEntry"
GROUP BY
    "tenantId",
    COALESCE("fiscalYearId", 'CALENDAR-' || EXTRACT(YEAR FROM "entryDate")::INTEGER::TEXT)
ON CONFLICT ("tenantId", "scopeKey") DO UPDATE
SET
    "lastValue" = GREATEST("JournalEntrySequence"."lastValue", EXCLUDED."lastValue"),
    "updatedAt" = CURRENT_TIMESTAMP;
