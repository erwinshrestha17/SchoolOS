-- AlterTable
ALTER TABLE "AttendanceCorrectionRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "hashVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "parentTokenId" TEXT,
ADD COLUMN     "replacedByTokenId" TEXT,
ADD COLUMN     "revokedReason" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "TenantSubscription" ADD COLUMN     "addOns" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- RenameIndex
ALTER INDEX "AttendanceCorrectionRequest_tenantId_attendanceSessionId_status" RENAME TO "AttendanceCorrectionRequest_tenantId_attendanceSessionId_st_idx";

-- RenameIndex
ALTER INDEX "AttendanceCorrectionRequest_tenantId_requestedById_requestedAt_" RENAME TO "AttendanceCorrectionRequest_tenantId_requestedById_requeste_idx";
