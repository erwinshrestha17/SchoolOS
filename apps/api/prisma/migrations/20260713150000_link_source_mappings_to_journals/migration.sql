ALTER TABLE "JournalEntry"
ADD COLUMN "sourceMappingId" TEXT;

CREATE INDEX "JournalEntry_tenantId_sourceMappingId_idx"
ON "JournalEntry"("tenantId", "sourceMappingId");

ALTER TABLE "JournalEntry"
ADD CONSTRAINT "JournalEntry_sourceMappingId_fkey"
FOREIGN KEY ("sourceMappingId") REFERENCES "AccountingSourceMapping"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
