ALTER TABLE "ApprovalRequest"
ADD COLUMN "deadlineAt" TIMESTAMP(3),
ADD COLUMN "delegatedToId" TEXT,
ADD COLUMN "delegatedById" TEXT,
ADD COLUMN "delegatedAt" TIMESTAMP(3),
ADD COLUMN "delegationReason" TEXT;

CREATE INDEX "ApprovalRequest_tenantId_delegatedToId_status_idx"
ON "ApprovalRequest"("tenantId", "delegatedToId", "status");

CREATE INDEX "ApprovalRequest_tenantId_status_deadlineAt_idx"
ON "ApprovalRequest"("tenantId", "status", "deadlineAt");

ALTER TABLE "ApprovalRequest"
ADD CONSTRAINT "ApprovalRequest_delegatedToId_fkey"
FOREIGN KEY ("delegatedToId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApprovalRequest"
ADD CONSTRAINT "ApprovalRequest_delegatedById_fkey"
FOREIGN KEY ("delegatedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
