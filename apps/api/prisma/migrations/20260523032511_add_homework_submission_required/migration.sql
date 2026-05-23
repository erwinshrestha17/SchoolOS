/*
  Warnings:

  - The `status` column on the `StaffLeaveRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[tenantId,academicYearId,classId,sectionId,subjectId]` on the table `SubjectWeeklyRequirement` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StaffDocumentKind" AS ENUM ('ID_CARD', 'CITIZENSHIP', 'CONTRACT', 'ACADEMIC_CERTIFICATE', 'PAN_CARD', 'OFFER_LETTER', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffLifecycleEventType" AS ENUM ('HIRED', 'PROMOTED', 'TRANSFERRED', 'ON_LEAVE', 'RETURNED', 'TERMINATED', 'RESIGNED', 'STATUS_CHANGE', 'CONTRACT_RENEWAL');

-- CreateEnum
CREATE TYPE "ActivityPostStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StudentQrStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterEnum
ALTER TYPE "CanteenMenuItemStatus" ADD VALUE 'ARCHIVED';

-- AlterEnum
ALTER TYPE "LibraryCopyStatus" ADD VALUE 'ARCHIVED';

-- AlterEnum
ALTER TYPE "StaffStatus" ADD VALUE 'RESIGNED';

-- DropIndex
DROP INDEX "CasRecord_tenantId_academicYearId_studentId_idx";

-- DropIndex
DROP INDEX "Enrollment_tenantId_studentId_academicYearId_key";

-- DropIndex
DROP INDEX "SaaSInvoice_dueDate_idx";

-- DropIndex
DROP INDEX "SaaSInvoice_tenantId_status_idx";

-- DropIndex
DROP INDEX "TeacherWorkloadLimit_tenantId_staff_academic_idx";

-- DropIndex
DROP INDEX "TimetableSlot_tenantId_academicYearId_dayOfWeek_class_section_i";

-- DropIndex
DROP INDEX "TimetableSlot_tenantId_academicYearId_dayOfWeek_roomId_idx";

-- DropIndex
DROP INDEX "TimetableSlot_tenantId_academicYearId_dayOfWeek_staffId_idx";

-- DropIndex
DROP INDEX "TimetableSlot_tenantId_versionId_dayOfWeek_startsAt_endsAt_idx";

-- DropIndex
DROP INDEX "TimetableSubstitution_tenantId_slot_date_status_idx";

-- DropIndex
DROP INDEX "TimetableVersion_tenantId_academicYearId_status_effective_idx";

-- DropIndex
DROP INDEX "TransportTrip_tenantId_routeId_idx";

-- DropIndex
DROP INDEX "TransportTrip_tenantId_vehicleId_idx";

-- AlterTable
ALTER TABLE "ActivityAttachment" ADD COLUMN     "optimizedObjectKey" TEXT,
ADD COLUMN     "optimizedSizeBytes" INTEGER,
ADD COLUMN     "processingStatus" TEXT DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "ActivityPost" ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedById" TEXT,
ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatedById" TEXT,
ADD COLUMN     "moderationReason" TEXT,
ADD COLUMN     "softDeletedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ActivityPostStatus" NOT NULL DEFAULT 'PENDING_APPROVAL';

-- AlterTable
ALTER TABLE "CanteenMealServing" ADD COLUMN     "overriddenById" TEXT,
ADD COLUMN     "overrideReason" TEXT;

-- AlterTable
ALTER TABLE "CanteenMenuItem" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CanteenWalletTransaction" ADD COLUMN     "reason" TEXT;

-- AlterTable
ALTER TABLE "CasRecord" ALTER COLUMN "subjectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CommunicationPreference" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "marketingOptOutAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ConsentTemplate" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "effectiveFrom" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "publishedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "archivedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "HomeworkAssignment" ADD COLUMN     "submissionRequired" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "LibraryBook" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LibraryCopy" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NoticeReadReceipt" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "readAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NotificationDelivery" ALTER COLUMN "lastRetryAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "deliveredAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "failedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN     "reversalAt" TIMESTAMP(3),
ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedById" TEXT;

-- AlterTable
ALTER TABLE "ReportCard" ADD COLUMN     "fileId" TEXT,
ADD COLUMN     "isCurrent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "StaffLeaveRequest" DROP COLUMN "status",
ADD COLUMN     "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "TransportTrip" ADD COLUMN     "delayMinutes" INTEGER,
ADD COLUMN     "delayReason" TEXT,
ADD COLUMN     "isDelayed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TransportVehicle" ADD COLUMN     "insuranceExpiry" TIMESTAMP(3),
ADD COLUMN     "pollutionExpiry" TIMESTAMP(3),
ADD COLUMN     "registrationExpiry" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SupportOverride" (
    "id" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "kind" "StaffDocumentKind" NOT NULL,
    "fileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "StudentDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLifecycleEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "eventType" "StaffLifecycleEventType" NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentQrCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "StudentQrStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastScannedAt" TIMESTAMP(3),

    CONSTRAINT "StudentQrCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCardHistory" (
    "id" TEXT NOT NULL,
    "reportCardId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "examTermId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "totalMarks" DECIMAL(10,2) NOT NULL,
    "maxMarks" DECIMAL(10,2) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "grade" TEXT NOT NULL,
    "gpa" DECIMAL(3,2) NOT NULL,
    "remarks" TEXT,
    "version" INTEGER NOT NULL,
    "fileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportCardHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCardCorrectionRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportCardId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ReportCardCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibrarySetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "finePerDay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "maxFineAmount" DECIMAL(12,2),
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "lostBookChargeMultiplier" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibrarySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenSupplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "panNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanteenSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenInventoryItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "currentStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minStockLevel" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "defaultSupplierId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanteenInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenPurchaseBill" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "billDate" DATE NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanteenPurchaseBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenPurchaseBillItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseBillId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "expiryDate" DATE,
    "batchNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanteenPurchaseBillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenStockMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "reason" TEXT,
    "note" TEXT,
    "movementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanteenStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenWastage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "wastageDate" DATE NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanteenWastage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportOverride_platformUserId_isActive_idx" ON "SupportOverride"("platformUserId", "isActive");

-- CreateIndex
CREATE INDEX "SupportOverride_tenantId_isActive_idx" ON "SupportOverride"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "SupportOverride_expiresAt_idx" ON "SupportOverride"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffDocument_fileId_key" ON "StaffDocument"("fileId");

-- CreateIndex
CREATE INDEX "StaffDocument_tenantId_staffId_idx" ON "StaffDocument"("tenantId", "staffId");

-- CreateIndex
CREATE INDEX "StaffLifecycleEvent_tenantId_staffId_idx" ON "StaffLifecycleEvent"("tenantId", "staffId");

-- CreateIndex
CREATE INDEX "StudentQrCredential_tenantId_studentId_idx" ON "StudentQrCredential"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "StudentQrCredential_tenantId_status_idx" ON "StudentQrCredential"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentQrCredential_tenantId_studentId_key" ON "StudentQrCredential"("tenantId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentQrCredential_tokenHash_key" ON "StudentQrCredential"("tokenHash");

-- CreateIndex
CREATE INDEX "ReportCardHistory_tenantId_reportCardId_idx" ON "ReportCardHistory"("tenantId", "reportCardId");

-- CreateIndex
CREATE INDEX "ReportCardCorrectionRequest_tenantId_reportCardId_status_idx" ON "ReportCardCorrectionRequest"("tenantId", "reportCardId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LibrarySetting_tenantId_key" ON "LibrarySetting"("tenantId");

-- CreateIndex
CREATE INDEX "CanteenSupplier_tenantId_name_idx" ON "CanteenSupplier"("tenantId", "name");

-- CreateIndex
CREATE INDEX "CanteenInventoryItem_tenantId_name_category_idx" ON "CanteenInventoryItem"("tenantId", "name", "category");

-- CreateIndex
CREATE UNIQUE INDEX "CanteenInventoryItem_tenantId_sku_key" ON "CanteenInventoryItem"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "CanteenPurchaseBill_tenantId_billDate_idx" ON "CanteenPurchaseBill"("tenantId", "billDate");

-- CreateIndex
CREATE UNIQUE INDEX "CanteenPurchaseBill_tenantId_supplierId_billNumber_key" ON "CanteenPurchaseBill"("tenantId", "supplierId", "billNumber");

-- CreateIndex
CREATE INDEX "CanteenPurchaseBillItem_tenantId_purchaseBillId_idx" ON "CanteenPurchaseBillItem"("tenantId", "purchaseBillId");

-- CreateIndex
CREATE INDEX "CanteenPurchaseBillItem_tenantId_inventoryItemId_idx" ON "CanteenPurchaseBillItem"("tenantId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "CanteenStockMovement_tenantId_inventoryItemId_idx" ON "CanteenStockMovement"("tenantId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "CanteenStockMovement_tenantId_movementDate_idx" ON "CanteenStockMovement"("tenantId", "movementDate");

-- CreateIndex
CREATE INDEX "CanteenWastage_tenantId_inventoryItemId_idx" ON "CanteenWastage"("tenantId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "CanteenWastage_tenantId_wastageDate_idx" ON "CanteenWastage"("tenantId", "wastageDate");

-- CreateIndex
CREATE INDEX "ActivityPost_tenantId_status_idx" ON "ActivityPost"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_userId_action_createdAt_idx" ON "AuditLog"("userId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_action_createdAt_idx" ON "AuditLog"("tenantId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "CasRecord_tenantId_academicYearId_idx" ON "CasRecord"("tenantId", "academicYearId");

-- CreateIndex
CREATE INDEX "CasRecord_tenantId_classId_sectionId_idx" ON "CasRecord"("tenantId", "classId", "sectionId");

-- CreateIndex
CREATE INDEX "CasRecord_tenantId_subjectId_idx" ON "CasRecord"("tenantId", "subjectId");

-- CreateIndex
CREATE INDEX "CasRecord_tenantId_studentId_idx" ON "CasRecord"("tenantId", "studentId");

-- CreateIndex
CREATE INDEX "CasRecord_tenantId_observedOn_idx" ON "CasRecord"("tenantId", "observedOn");

-- CreateIndex
CREATE INDEX "Enrollment_tenantId_admissionNumber_idx" ON "Enrollment"("tenantId", "admissionNumber");

-- CreateIndex
CREATE INDEX "Guardian_tenantId_email_idx" ON "Guardian"("tenantId", "email");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_tenantId_dueDate_status_idx" ON "HomeworkAssignment"("tenantId", "dueDate", "status");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_tenantId_classId_sectionId_dueDate_idx" ON "HomeworkAssignment"("tenantId", "classId", "sectionId", "dueDate");

-- CreateIndex
CREATE INDEX "HomeworkReminderBatch_tenantId_reminderType_createdAt_idx" ON "HomeworkReminderBatch"("tenantId", "reminderType", "createdAt");

-- CreateIndex
CREATE INDEX "HomeworkReminderBatch_tenantId_status_createdAt_idx" ON "HomeworkReminderBatch"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_studentId_status_idx" ON "Invoice"("tenantId", "studentId", "status");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_academicYearId_studentId_idx" ON "Invoice"("tenantId", "academicYearId", "studentId");

-- CreateIndex
CREATE INDEX "LibraryFine_tenantId_status_idx" ON "LibraryFine"("tenantId", "status");

-- CreateIndex
CREATE INDEX "LibraryFine_tenantId_issueId_idx" ON "LibraryFine"("tenantId", "issueId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_studentId_paidAt_idx" ON "Payment"("tenantId", "studentId", "paidAt");

-- CreateIndex
CREATE INDEX "Receipt_tenantId_issuedAt_idx" ON "Receipt"("tenantId", "issuedAt");

-- CreateIndex
CREATE INDEX "SaaSInvoice_tenantId_status_issueDate_idx" ON "SaaSInvoice"("tenantId", "status", "issueDate");

-- CreateIndex
CREATE INDEX "SaaSInvoice_dueDate_status_idx" ON "SaaSInvoice"("dueDate", "status");

-- CreateIndex
CREATE INDEX "SaaSInvoice_invoiceNumber_idx" ON "SaaSInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_tenantId_staffId_status_idx" ON "StaffLeaveRequest"("tenantId", "staffId", "status");

-- CreateIndex
CREATE INDEX "Student_tenantId_admissionNumber_idx" ON "Student"("tenantId", "admissionNumber");

-- CreateIndex
CREATE INDEX "Student_tenantId_lifecycleStatus_idx" ON "Student"("tenantId", "lifecycleStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectWeeklyRequirement_tenantId_academicYearId_classId_se_key" ON "SubjectWeeklyRequirement"("tenantId", "academicYearId", "classId", "sectionId", "subjectId");

-- CreateIndex
CREATE INDEX "TimetableSlot_tenantId_versionId_dayOfWeek_startsAt_idx" ON "TimetableSlot"("tenantId", "versionId", "dayOfWeek", "startsAt");

-- CreateIndex
CREATE INDEX "TimetableSubstitution_tenantId_timetableSlotId_date_idx" ON "TimetableSubstitution"("tenantId", "timetableSlotId", "date");

-- CreateIndex
CREATE INDEX "TransportTrip_tenantId_routeId_createdAt_idx" ON "TransportTrip"("tenantId", "routeId", "createdAt");

-- CreateIndex
CREATE INDEX "TransportTrip_tenantId_vehicleId_createdAt_idx" ON "TransportTrip"("tenantId", "vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "TransportTrip_tenantId_driverAssignmentId_createdAt_idx" ON "TransportTrip"("tenantId", "driverAssignmentId", "createdAt");

-- CreateIndex
CREATE INDEX "TransportVehicle_tenantId_insuranceExpiry_idx" ON "TransportVehicle"("tenantId", "insuranceExpiry");

-- CreateIndex
CREATE INDEX "TransportVehicle_tenantId_fitnessCertificateExp_idx" ON "TransportVehicle"("tenantId", "fitnessCertificateExp");

-- AddForeignKey
ALTER TABLE "SupportOverride" ADD CONSTRAINT "SupportOverride_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportOverride" ADD CONSTRAINT "SupportOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLifecycleEvent" ADD CONSTRAINT "StaffLifecycleEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLifecycleEvent" ADD CONSTRAINT "StaffLifecycleEvent_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLifecycleEvent" ADD CONSTRAINT "StaffLifecycleEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQrCredential" ADD CONSTRAINT "StudentQrCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQrCredential" ADD CONSTRAINT "StudentQrCredential_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPost" ADD CONSTRAINT "ActivityPost_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPost" ADD CONSTRAINT "ActivityPost_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPost" ADD CONSTRAINT "ActivityPost_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardHistory" ADD CONSTRAINT "ReportCardHistory_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "ReportCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardHistory" ADD CONSTRAINT "ReportCardHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardHistory" ADD CONSTRAINT "ReportCardHistory_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardHistory" ADD CONSTRAINT "ReportCardHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardHistory" ADD CONSTRAINT "ReportCardHistory_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardCorrectionRequest" ADD CONSTRAINT "ReportCardCorrectionRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardCorrectionRequest" ADD CONSTRAINT "ReportCardCorrectionRequest_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "ReportCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardCorrectionRequest" ADD CONSTRAINT "ReportCardCorrectionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardCorrectionRequest" ADD CONSTRAINT "ReportCardCorrectionRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryFine" ADD CONSTRAINT "LibraryFine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryFine" ADD CONSTRAINT "LibraryFine_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "LibraryIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibrarySetting" ADD CONSTRAINT "LibrarySetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenMealServing" ADD CONSTRAINT "CanteenMealServing_overriddenById_fkey" FOREIGN KEY ("overriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWalletTransaction" ADD CONSTRAINT "CanteenWalletTransaction_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "CanteenWalletTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWalletTransaction" ADD CONSTRAINT "CanteenWalletTransaction_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "CanteenWalletTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenSupplier" ADD CONSTRAINT "CanteenSupplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenInventoryItem" ADD CONSTRAINT "CanteenInventoryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenInventoryItem" ADD CONSTRAINT "CanteenInventoryItem_defaultSupplierId_fkey" FOREIGN KEY ("defaultSupplierId") REFERENCES "CanteenSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPurchaseBill" ADD CONSTRAINT "CanteenPurchaseBill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPurchaseBill" ADD CONSTRAINT "CanteenPurchaseBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "CanteenSupplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPurchaseBill" ADD CONSTRAINT "CanteenPurchaseBill_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPurchaseBillItem" ADD CONSTRAINT "CanteenPurchaseBillItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPurchaseBillItem" ADD CONSTRAINT "CanteenPurchaseBillItem_purchaseBillId_fkey" FOREIGN KEY ("purchaseBillId") REFERENCES "CanteenPurchaseBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenPurchaseBillItem" ADD CONSTRAINT "CanteenPurchaseBillItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "CanteenInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenStockMovement" ADD CONSTRAINT "CanteenStockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenStockMovement" ADD CONSTRAINT "CanteenStockMovement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "CanteenInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenStockMovement" ADD CONSTRAINT "CanteenStockMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWastage" ADD CONSTRAINT "CanteenWastage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWastage" ADD CONSTRAINT "CanteenWastage_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "CanteenInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenWastage" ADD CONSTRAINT "CanteenWastage_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AttendanceDraft_tenantId_academicYearId_classId_sectionId_atten" RENAME TO "AttendanceDraft_tenantId_academicYearId_classId_sectionId_a_idx";

-- RenameIndex
ALTER INDEX "AttendanceDraft_tenantId_userId_classId_sectionId_attendanceDat" RENAME TO "AttendanceDraft_tenantId_userId_classId_sectionId_attendanc_key";

-- RenameIndex
ALTER INDEX "NotificationDelivery_tenantId_recipientUserId_status_createdAt_" RENAME TO "NotificationDelivery_tenantId_recipientUserId_status_create_idx";

-- RenameIndex
ALTER INDEX "SubjectWeeklyRequirement_tenantId_academicYearId_classId_sectio" RENAME TO "SubjectWeeklyRequirement_tenantId_academicYearId_classId_se_idx";

-- RenameIndex
ALTER INDEX "TeacherAvailability_tenantId_staffId_academic_day_time_idx" RENAME TO "TeacherAvailability_tenantId_staffId_academicYearId_dayOfWe_idx";
