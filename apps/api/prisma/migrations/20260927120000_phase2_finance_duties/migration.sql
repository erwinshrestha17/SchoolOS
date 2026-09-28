ALTER TYPE "FinanceRequestStatus" ADD VALUE IF NOT EXISTS 'REVIEWED';
ALTER TYPE "FinanceRequestHistoryAction" ADD VALUE IF NOT EXISTS 'REVIEWED';
ALTER TABLE "FinanceApprovalRequest"
  ADD COLUMN "approvedById" TEXT, ADD COLUMN "approvedAt" TIMESTAMP(3), ADD COLUMN "approvalNote" TEXT,
  ADD COLUMN "executedById" TEXT, ADD COLUMN "executedAt" TIMESTAMP(3),
  ADD COLUMN "policyFingerprint" TEXT, ADD COLUMN "policySnapshot" JSONB, ADD COLUMN "sourceFingerprint" TEXT,
  ADD COLUMN "requiredApprovalCount" INTEGER NOT NULL DEFAULT 1;
CREATE TABLE "FinanceApprovalDecision" (
 "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "requestId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
 "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "FinanceApprovalDecision_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "FinanceApprovalDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "FinanceApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FinanceApprovalDecision_requestId_actorUserId_key" ON "FinanceApprovalDecision"("requestId", "actorUserId");
CREATE INDEX "FinanceApprovalDecision_tenantId_requestId_createdAt_idx" ON "FinanceApprovalDecision"("tenantId", "requestId", "createdAt");
ALTER TABLE "FinanceApprovalRequest" ADD CONSTRAINT "FinanceApprovalRequest_required_approval_count_check" CHECK ("requiredApprovalCount" >= 1);
-- Historical requests retain their genuine evidence. No reviewer/approver/executor is fabricated.

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "FinanceApprovalRequest" WHERE "status" NOT IN ('REJECTED', 'EXECUTED', 'FAILED') GROUP BY "tenantId", "paymentId" HAVING COUNT(*) > 1)
 THEN RAISE EXCEPTION 'Resolve duplicate active finance requests before installing the Phase 2 constraint'; END IF;
END $$;
CREATE UNIQUE INDEX "FinanceApprovalRequest_one_active_payment_key" ON "FinanceApprovalRequest"("tenantId", "paymentId") WHERE "status" NOT IN ('REJECTED', 'EXECUTED', 'FAILED');
