CREATE TABLE "ReceiptSequence" (
    "tenantId" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptSequence_pkey" PRIMARY KEY ("tenantId", "fiscalYear")
);

ALTER TABLE "ReceiptSequence"
ADD CONSTRAINT "ReceiptSequence_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ReceiptSequence" ("tenantId", "fiscalYear", "lastValue", "updatedAt")
SELECT
    "tenantId",
    "fiscalYear",
    MAX(
        CASE
            WHEN "receiptNumber" ~ '^REC-[0-9]{4}-[0-9]{4}-[0-9]{5}$'
            THEN RIGHT("receiptNumber", 5)::INTEGER
            ELSE 0
        END
    ),
    CURRENT_TIMESTAMP
FROM "Receipt"
WHERE "fiscalYear" IS NOT NULL
GROUP BY "tenantId", "fiscalYear"
ON CONFLICT ("tenantId", "fiscalYear") DO UPDATE
SET
    "lastValue" = GREATEST("ReceiptSequence"."lastValue", EXCLUDED."lastValue"),
    "updatedAt" = CURRENT_TIMESTAMP;
