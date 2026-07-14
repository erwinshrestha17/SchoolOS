-- M15 persisted notice lifecycle foundation.
-- Existing timestamp columns remain stable compatibility fields. Legacy rows are
-- backfilled from the only lifecycle evidence available before this migration.

CREATE TYPE "NoticeLifecycleStatus" AS ENUM (
  'DRAFT',
  'APPROVAL_PENDING',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED',
  'CANCELLED',
  'EXPIRED',
  'ARCHIVED'
);

ALTER TABLE "Notice"
  ADD COLUMN "lifecycleStatus" "NoticeLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "approvalRequestId" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedById" TEXT,
  ADD COLUMN "archiveReason" TEXT,
  ADD COLUMN "archivedFromStatus" "NoticeLifecycleStatus";

UPDATE "Notice" AS notice
SET "approvalRequestId" = (
  SELECT request.id
  FROM "ApprovalRequest" AS request
  WHERE request."tenantId" = notice."tenantId"
    AND request."targetModule" IN ('communications', 'notices')
    AND request."targetType" = 'notice'
    AND request."targetId" = notice.id
    AND request."workflowType" = 'EMERGENCY_HIGH_IMPACT_NOTICE'
  ORDER BY request."createdAt" DESC
  LIMIT 1
);

UPDATE "Notice" AS notice
SET "lifecycleStatus" = CASE
  WHEN notice."publishedAt" IS NOT NULL
    THEN 'PUBLISHED'::"NoticeLifecycleStatus"
  WHEN notice."scheduledFor" IS NOT NULL
    THEN 'SCHEDULED'::"NoticeLifecycleStatus"
  WHEN approval.status IN ('DRAFT', 'PENDING')
    THEN 'APPROVAL_PENDING'::"NoticeLifecycleStatus"
  WHEN approval.status IN ('APPROVED', 'APPLIED', 'APPLY_FAILED')
    THEN 'APPROVED'::"NoticeLifecycleStatus"
  ELSE 'DRAFT'::"NoticeLifecycleStatus"
END
FROM "ApprovalRequest" AS approval
WHERE approval.id = notice."approvalRequestId";

UPDATE "Notice"
SET "lifecycleStatus" = CASE
  WHEN "publishedAt" IS NOT NULL THEN 'PUBLISHED'::"NoticeLifecycleStatus"
  WHEN "scheduledFor" IS NOT NULL THEN 'SCHEDULED'::"NoticeLifecycleStatus"
  ELSE 'DRAFT'::"NoticeLifecycleStatus"
END
WHERE "approvalRequestId" IS NULL;

CREATE INDEX "Notice_tenantId_lifecycleStatus_scheduledFor_idx"
  ON "Notice"("tenantId", "lifecycleStatus", "scheduledFor");
