ALTER TYPE "JournalEntryStatus" ADD VALUE IF NOT EXISTS 'REVIEWED';
ALTER TABLE "JournalEntry" ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewNote" TEXT,
  ADD COLUMN "approvedSourceFingerprint" TEXT;
-- Historical approvals are not backfilled with fictitious review evidence.
