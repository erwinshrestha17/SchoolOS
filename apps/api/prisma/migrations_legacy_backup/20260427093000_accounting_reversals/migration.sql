-- Add explicit journal reversal support without mutating original posted entries.
ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'REVERSAL';

ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "reversalOfId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'JournalEntry_reversalOfId_fkey'
  ) THEN
    ALTER TABLE "JournalEntry"
      ADD CONSTRAINT "JournalEntry_reversalOfId_fkey"
      FOREIGN KEY ("reversalOfId")
      REFERENCES "JournalEntry"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "JournalEntry_tenantId_reversalOfId_idx"
  ON "JournalEntry"("tenantId", "reversalOfId");
