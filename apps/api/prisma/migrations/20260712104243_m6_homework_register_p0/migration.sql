/*
  Warnings:

  - You are about to drop the column `requestedAt` on the `FinanceApprovalRequest` table. All the data in the column will be lost.
  - You are about to drop the `AccountingSourceMapping` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "HomeworkSubmissionMethod" AS ENUM ('PHYSICAL_NOTEBOOK', 'CLASSWORK_COPY', 'PROJECT_FILE', 'ORAL_PREPARATION', 'MEMORIZATION', 'ONLINE_ATTACHMENT', 'NO_SUBMISSION_REQUIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "HomeworkSubmissionStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "HomeworkSubmissionStatus" ADD VALUE 'INCOMPLETE';
ALTER TYPE "HomeworkSubmissionStatus" ADD VALUE 'PARTIALLY_COMPLETED';
ALTER TYPE "HomeworkSubmissionStatus" ADD VALUE 'ABSENT';

-- AlterEnum
ALTER TYPE "MarkEntryStatus" ADD VALUE 'RETEST';

-- DropForeignKey
ALTER TABLE "FinanceApprovalRequest" DROP CONSTRAINT "FinanceApprovalRequest_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceApprovalRequest" DROP CONSTRAINT "FinanceApprovalRequest_tenantId_fkey";

-- DropIndex
DROP INDEX "FileAsset_tenantId_storageProvider_idx";

-- DropIndex
DROP INDEX "FileAsset_tenantId_visibility_idx";

-- DropIndex
DROP INDEX "LearningResource_tenantId_activityId_status_idx";

-- DropIndex
DROP INDEX "LearningResource_tenantId_subjectId_status_idx";

-- DropIndex
DROP INDEX "LearningResource_tenantId_topicId_status_idx";

-- AlterTable
ALTER TABLE "ChatEscalation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FinanceApprovalRequest" DROP COLUMN "requestedAt";

-- AlterTable
ALTER TABLE "HomeworkAssignment" ADD COLUMN     "parentInstructions" TEXT,
ADD COLUMN     "submissionMethod" "HomeworkSubmissionMethod" NOT NULL DEFAULT 'PHYSICAL_NOTEBOOK';

-- DropTable
DROP TABLE "AccountingSourceMapping";

-- CreateIndex
CREATE INDEX "FinanceApprovalRequest_paymentId_idx" ON "FinanceApprovalRequest"("paymentId");

-- AddForeignKey
ALTER TABLE "FinanceApprovalRequest" ADD CONSTRAINT "FinanceApprovalRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceApprovalRequest" ADD CONSTRAINT "FinanceApprovalRequest_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AdmissionAssessmentSession_tenantId_interviewerUserId_scheduled" RENAME TO "AdmissionAssessmentSession_tenantId_interviewerUserId_sched_idx";

-- RenameIndex
ALTER INDEX "ReportCardSubjectResult_tenantId_reportCardId_version_subjectId" RENAME TO "ReportCardSubjectResult_tenantId_reportCardId_version_subje_key";

-- RenameIndex
ALTER INDEX "StudentDocumentExpiryTemplate_tenantId_channel_reminderStatus_k" RENAME TO "StudentDocumentExpiryTemplate_tenantId_channel_reminderStat_key";
