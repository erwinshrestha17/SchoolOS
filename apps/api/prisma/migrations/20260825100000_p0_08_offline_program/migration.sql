-- AlterEnum
ALTER TYPE "AttendanceSyncRejectionReason" ADD VALUE 'AUTHORITY_FENCED';

-- AlterTable
ALTER TABLE "HomeworkAssignment" ADD COLUMN "clientOperationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkAssignment_tenantId_clientOperationId_key" ON "HomeworkAssignment"("tenantId", "clientOperationId");

-- CreateTable
CREATE TABLE "TenantAuthorityFence" (
    "tenantId" TEXT NOT NULL,
    "authorityNodeId" TEXT NOT NULL DEFAULT 'cloud',
    "authorityEpoch" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAuthorityFence_pkey" PRIMARY KEY ("tenantId")
);

-- AddForeignKey
ALTER TABLE "TenantAuthorityFence" ADD CONSTRAINT "TenantAuthorityFence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
