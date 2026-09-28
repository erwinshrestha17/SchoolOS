-- Historical sessions retain their real evidence; no reviewer is invented.
ALTER TYPE "BankReconciliationStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "BankReconciliationStatus" ADD VALUE IF NOT EXISTS 'REVIEWED';
ALTER TYPE "BankReconciliationStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TABLE "BankReconciliationSession"
 ADD COLUMN "cancelledAt" TIMESTAMP(3),
 ADD COLUMN "cancelledById" TEXT,
 ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "submittedAt" TIMESTAMP(3),
 ADD COLUMN "submittedById" TEXT,
 ADD COLUMN "reviewedAt" TIMESTAMP(3),
 ADD COLUMN "reviewedById" TEXT,
 ADD COLUMN "reviewReason" TEXT,
 ADD COLUMN "sourceFingerprint" TEXT,
 ADD COLUMN "sourceSnapshot" JSONB;
-- Existing duplicate open sessions require an explicit recovery decision.
CREATE UNIQUE INDEX "BankReconciliationSession_one_unfinalized_account_key"
 ON "BankReconciliationSession" ("tenantId", "accountId") WHERE "finalizedAt" IS NULL AND "cancelledAt" IS NULL;
DROP INDEX "BankReconciliationMatch_tenantId_sessionId_bankStatementId__key";
CREATE INDEX "BankReconciliationMatch_tenantId_sessionId_bankStatementId__idx"
 ON "BankReconciliationMatch" ("tenantId", "sessionId", "bankStatementId", "journalLineId");
CREATE UNIQUE INDEX "BankReconciliationMatch_active_statement_key"
 ON "BankReconciliationMatch" ("tenantId", "bankStatementId") WHERE "status" = 'MATCHED';
CREATE UNIQUE INDEX "BankReconciliationMatch_active_journal_line_key"
 ON "BankReconciliationMatch" ("tenantId", "journalLineId") WHERE "status" = 'MATCHED' AND "journalLineId" IS NOT NULL;
