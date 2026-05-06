/*
  Warnings:

  - You are about to drop the `NotificationReadReceipt` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CanteenMealPlan" DROP CONSTRAINT "CanteenMealPlan_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenMealServing" DROP CONSTRAINT "CanteenMealServing_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenMealServing" DROP CONSTRAINT "CanteenMealServing_mealPlanId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenMealServing" DROP CONSTRAINT "CanteenMealServing_servedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenMealServing" DROP CONSTRAINT "CanteenMealServing_studentId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenMealServing" DROP CONSTRAINT "CanteenMealServing_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenMenuItem" DROP CONSTRAINT "CanteenMenuItem_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenPosSale" DROP CONSTRAINT "CanteenPosSale_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenPosSale" DROP CONSTRAINT "CanteenPosSale_staffId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenPosSale" DROP CONSTRAINT "CanteenPosSale_studentId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenPosSale" DROP CONSTRAINT "CanteenPosSale_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenPosSale" DROP CONSTRAINT "CanteenPosSale_walletId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenPosSaleItem" DROP CONSTRAINT "CanteenPosSaleItem_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenPosSaleItem" DROP CONSTRAINT "CanteenPosSaleItem_saleId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenPosSaleItem" DROP CONSTRAINT "CanteenPosSaleItem_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenSpendingControl" DROP CONSTRAINT "CanteenSpendingControl_studentId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenSpendingControl" DROP CONSTRAINT "CanteenSpendingControl_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenStudentEnrollment" DROP CONSTRAINT "CanteenStudentEnrollment_mealPlanId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenStudentEnrollment" DROP CONSTRAINT "CanteenStudentEnrollment_studentId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenStudentEnrollment" DROP CONSTRAINT "CanteenStudentEnrollment_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenWallet" DROP CONSTRAINT "CanteenWallet_studentId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenWallet" DROP CONSTRAINT "CanteenWallet_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenWalletTransaction" DROP CONSTRAINT "CanteenWalletTransaction_createdByUserId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenWalletTransaction" DROP CONSTRAINT "CanteenWalletTransaction_studentId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenWalletTransaction" DROP CONSTRAINT "CanteenWalletTransaction_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CanteenWalletTransaction" DROP CONSTRAINT "CanteenWalletTransaction_walletId_fkey";

-- DropForeignKey
ALTER TABLE "ChatAbuseReport" DROP CONSTRAINT "ChatAbuseReport_reportedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "ChatAbuseReport" DROP CONSTRAINT "ChatAbuseReport_reviewedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "ChatAbuseReport" DROP CONSTRAINT "ChatAbuseReport_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ChatAvailabilityRule" DROP CONSTRAINT "ChatAvailabilityRule_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ChatEscalation" DROP CONSTRAINT "ChatEscalation_escalatedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "ChatEscalation" DROP CONSTRAINT "ChatEscalation_escalatedToUserId_fkey";

-- DropForeignKey
ALTER TABLE "ChatEscalation" DROP CONSTRAINT "ChatEscalation_resolvedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "ChatEscalation" DROP CONSTRAINT "ChatEscalation_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "NotificationReadReceipt" DROP CONSTRAINT "NotificationReadReceipt_notificationDeliveryId_fkey";

-- DropForeignKey
ALTER TABLE "NotificationReadReceipt" DROP CONSTRAINT "NotificationReadReceipt_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "NotificationReadReceipt" DROP CONSTRAINT "NotificationReadReceipt_userId_fkey";

-- DropForeignKey
ALTER TABLE "ParentTeacherMessage" DROP CONSTRAINT "ParentTeacherMessage_senderUserId_fkey";

-- DropForeignKey
ALTER TABLE "ParentTeacherMessage" DROP CONSTRAINT "ParentTeacherMessage_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ParentTeacherThread" DROP CONSTRAINT "ParentTeacherThread_academicYearId_fkey";

-- DropForeignKey
ALTER TABLE "ParentTeacherThread" DROP CONSTRAINT "ParentTeacherThread_classTeacherId_fkey";

-- DropForeignKey
ALTER TABLE "ParentTeacherThread" DROP CONSTRAINT "ParentTeacherThread_closedByUserId_fkey";

-- DropForeignKey
ALTER TABLE "ParentTeacherThread" DROP CONSTRAINT "ParentTeacherThread_guardianId_fkey";

-- DropForeignKey
ALTER TABLE "ParentTeacherThread" DROP CONSTRAINT "ParentTeacherThread_studentId_fkey";

-- DropForeignKey
ALTER TABLE "ParentTeacherThread" DROP CONSTRAINT "ParentTeacherThread_tenantId_fkey";

-- DropIndex
DROP INDEX "ActivityAttachment_tenantId_activityPostId_fileAssetId_idx";

-- DropIndex
DROP INDEX "HomeworkAssignment_tenantId_academicYearId_classId_sectionI_idx";

-- DropIndex
DROP INDEX "Staff_employeeId_key";

-- AlterTable
ALTER TABLE "CanteenMealPlan" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CanteenMealServing" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CanteenMenuItem" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CanteenPosSale" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CanteenPosSaleItem" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CanteenSpendingControl" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CanteenStudentEnrollment" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CanteenWallet" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CanteenWalletTransaction" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "HomeworkAssignment" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "HomeworkSubmission" ADD COLUMN     "submissionContent" TEXT;

-- AlterTable
ALTER TABLE "ReportCard" ADD COLUMN     "publishStatus" TEXT DEFAULT 'UNPUBLISHED',
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedById" TEXT,
ADD COLUMN     "unpublishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TransportStudentAssignment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TransportTrip" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TransportTripStudentStatus" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "NotificationReadReceipt";

-- CreateTable
CREATE TABLE "ReceiptReprintHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "reprintedById" TEXT,
    "reprintedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "ReceiptReprintHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReceiptReprintHistory_tenantId_receiptId_idx" ON "ReceiptReprintHistory"("tenantId", "receiptId");

-- CreateIndex
CREATE INDEX "HomeworkAttachment_tenantId_submissionId_idx" ON "HomeworkAttachment"("tenantId", "submissionId");

-- CreateIndex
CREATE INDEX "ActivityAttachment_fileAssetId_idx" ON "ActivityAttachment"("fileAssetId");

-- CreateIndex
CREATE INDEX "CanteenPosSale_tenantId_studentId_idx" ON "CanteenPosSale"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "CanteenPosSaleItem_tenantId_saleId_idx" ON "CanteenPosSaleItem"("tenantId", "saleId");

-- CreateIndex
CREATE INDEX "CanteenPosSaleItem_tenantId_menuItemId_idx" ON "CanteenPosSaleItem"("tenantId", "menuItemId");

-- CreateIndex
CREATE INDEX "CanteenSpendingControl_tenantId_studentId_idx" ON "CanteenSpendingControl"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "CanteenWallet_tenantId_studentId_idx" ON "CanteenWallet"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_tenantId_studentId_status_idx" ON "HomeworkSubmission"("tenantId", "studentId", "status");

-- AddForeignKey
ALTER TABLE "ReceiptReprintHistory" ADD CONSTRAINT "ReceiptReprintHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptReprintHistory" ADD CONSTRAINT "ReceiptReprintHistory_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptReprintHistory" ADD CONSTRAINT "ReceiptReprintHistory_reprintedById_fkey" FOREIGN KEY ("reprintedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAttachment" ADD CONSTRAINT "HomeworkAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAttachment" ADD CONSTRAINT "HomeworkAttachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAttachment" ADD CONSTRAINT "HomeworkAttachment_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenMenuItem" ADD CONSTRAINT "CanteenMenuItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenMealPlan" ADD CONSTRAINT "CanteenMealPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenStudentEnrollment" ADD CONSTRAINT "CanteenStudentEnrollment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenStudentEnrollment" ADD CONSTRAINT "CanteenStudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenStudentEnrollment" ADD CONSTRAINT "CanteenStudentEnrollment_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "CanteenMealPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenMealServing" ADD CONSTRAINT "CanteenMealServing_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenMealServing" ADD CONSTRAINT "CanteenMealServing_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenMealServing" ADD CONSTRAINT "CanteenMealServing_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CanteenStudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenMealServing" ADD CONSTRAINT "CanteenMealServing_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "CanteenMealPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenMealServing" ADD CONSTRAINT "CanteenMealServing_servedByUserId_fkey" FOREIGN KEY ("servedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWallet" ADD CONSTRAINT "CanteenWallet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWallet" ADD CONSTRAINT "CanteenWallet_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWalletTransaction" ADD CONSTRAINT "CanteenWalletTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWalletTransaction" ADD CONSTRAINT "CanteenWalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CanteenWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWalletTransaction" ADD CONSTRAINT "CanteenWalletTransaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWalletTransaction" ADD CONSTRAINT "CanteenWalletTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSale" ADD CONSTRAINT "CanteenPosSale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSale" ADD CONSTRAINT "CanteenPosSale_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSale" ADD CONSTRAINT "CanteenPosSale_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSale" ADD CONSTRAINT "CanteenPosSale_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CanteenWallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSale" ADD CONSTRAINT "CanteenPosSale_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSaleItem" ADD CONSTRAINT "CanteenPosSaleItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSaleItem" ADD CONSTRAINT "CanteenPosSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "CanteenPosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPosSaleItem" ADD CONSTRAINT "CanteenPosSaleItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "CanteenMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenSpendingControl" ADD CONSTRAINT "CanteenSpendingControl_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenSpendingControl" ADD CONSTRAINT "CanteenSpendingControl_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "CanteenMealPlan_tenant_status_idx" RENAME TO "CanteenMealPlan_tenantId_status_idx";

-- RenameIndex
ALTER INDEX "CanteenMealServing_tenant_served_date_idx" RENAME TO "CanteenMealServing_tenantId_mealDate_servedAt_idx";

-- RenameIndex
ALTER INDEX "CanteenMenuItem_tenant_name_category_idx" RENAME TO "CanteenMenuItem_tenantId_name_category_idx";

-- RenameIndex
ALTER INDEX "CanteenMenuItem_tenant_status_idx" RENAME TO "CanteenMenuItem_tenantId_status_idx";

-- RenameIndex
ALTER INDEX "CanteenPosSale_tenant_sale_date_idx" RENAME TO "CanteenPosSale_tenantId_saleDate_idx";

-- RenameIndex
ALTER INDEX "CanteenPosSale_tenant_status_idx" RENAME TO "CanteenPosSale_tenantId_status_idx";

-- RenameIndex
ALTER INDEX "CanteenSpendingControl_tenant_student_unique" RENAME TO "CanteenSpendingControl_tenantId_studentId_key";

-- RenameIndex
ALTER INDEX "CanteenStudentEnrollment_tenant_plan_status_idx" RENAME TO "CanteenStudentEnrollment_tenantId_mealPlanId_status_idx";

-- RenameIndex
ALTER INDEX "CanteenStudentEnrollment_tenant_student_idx" RENAME TO "CanteenStudentEnrollment_tenantId_studentId_idx";

-- RenameIndex
ALTER INDEX "CanteenWallet_tenant_student_unique" RENAME TO "CanteenWallet_tenantId_studentId_key";

-- RenameIndex
ALTER INDEX "CanteenWalletTransaction_tenant_transaction_date_idx" RENAME TO "CanteenWalletTransaction_tenantId_transactionDate_idx";

-- RenameIndex
ALTER INDEX "CanteenWalletTransaction_tenant_wallet_idx" RENAME TO "CanteenWalletTransaction_tenantId_walletId_idx";

-- RenameIndex
ALTER INDEX "HomeworkAssignment_tenantId_academicYearId_classId_sectionId_st" RENAME TO "HomeworkAssignment_tenantId_academicYearId_classId_sectionI_idx";

-- RenameIndex
ALTER INDEX "HomeworkAssignment_tenantId_subjectId_assignedByStaffId_status_" RENAME TO "HomeworkAssignment_tenantId_subjectId_assignedByStaffId_sta_idx";

-- RenameIndex
ALTER INDEX "JournalEntry_tenantId_sourceModule_sourceType_sourceId_postingT" RENAME TO "JournalEntry_tenantId_sourceModule_sourceType_sourceId_post_key";

-- RenameIndex
ALTER INDEX "TimetableVersion_tenantId_academicYearId_classId_sectionId_stat" RENAME TO "TimetableVersion_tenantId_academicYearId_classId_sectionId__idx";
