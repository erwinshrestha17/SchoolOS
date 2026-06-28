ALTER TYPE "ChatEscalationStatus" ADD VALUE 'REOPENED';

ALTER TABLE "ChatEscalation"
  ADD COLUMN "resolutionNote" TEXT,
  ADD COLUMN "assignedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "reopenedAt" TIMESTAMP(3);

ALTER TABLE "Notice"
  ADD COLUMN "idempotencyKey" TEXT;

ALTER TABLE "ApprovalDecision"
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Notice_tenantId_idempotencyKey_key"
  ON "Notice"("tenantId", "idempotencyKey");

CREATE UNIQUE INDEX "ApprovalDecision_tenantId_idempotencyKey_key"
  ON "ApprovalDecision"("tenantId", "idempotencyKey");

CREATE INDEX "ChatEscalation_tenantId_escalatedToUserId_status_createdAt_idx"
  ON "ChatEscalation"("tenantId", "escalatedToUserId", "status", "createdAt");
