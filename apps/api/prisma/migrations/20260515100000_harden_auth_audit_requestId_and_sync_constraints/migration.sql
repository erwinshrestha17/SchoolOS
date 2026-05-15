-- Manual migration to sync schema with missing historical changes and add requestId to AuditLog.

-- AlterTable: AuditLog
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
CREATE INDEX IF NOT EXISTS "AuditLog_requestId_idx" ON "AuditLog"("requestId");

-- AlterTable: CanteenPosSale
ALTER TABLE "CanteenPosSale" ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
ALTER TABLE "CanteenPosSale" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- CreateUniqueIndex: CanteenPosSale
DO $$ BEGIN
    CREATE UNIQUE INDEX "CanteenPosSale_receiptNumber_key" ON "CanteenPosSale"("receiptNumber");
EXCEPTION
    WHEN duplicate_table THEN null;
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE UNIQUE INDEX "CanteenPosSale_idempotencyKey_key" ON "CanteenPosSale"("idempotencyKey");
EXCEPTION
    WHEN duplicate_table THEN null;
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: CanteenWalletTransaction
ALTER TABLE "CanteenWalletTransaction" ADD COLUMN IF NOT EXISTS "reversalOfId" TEXT;
ALTER TABLE "CanteenWalletTransaction" ADD COLUMN IF NOT EXISTS "correctionOfId" TEXT;

-- CreateUniqueIndex: CanteenWalletTransaction
DO $$ BEGIN
    CREATE UNIQUE INDEX "CanteenWalletTransaction_reversalOfId_key" ON "CanteenWalletTransaction"("reversalOfId");
EXCEPTION
    WHEN duplicate_table THEN null;
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE UNIQUE INDEX "CanteenWalletTransaction_correctionOfId_key" ON "CanteenWalletTransaction"("correctionOfId");
EXCEPTION
    WHEN duplicate_table THEN null;
    WHEN duplicate_object THEN null;
END $$;

-- CreateUniqueIndex: Enrollment
DO $$ BEGIN
    CREATE UNIQUE INDEX "Enrollment_tenantId_academicYearId_studentId_key" ON "Enrollment"("tenantId", "academicYearId", "studentId");
EXCEPTION
    WHEN duplicate_table THEN null;
    WHEN duplicate_object THEN null;
END $$;

-- CreateUniqueIndex: SubjectWeeklyRequirement
DO $$ BEGIN
    CREATE UNIQUE INDEX "SubjectWeeklyRequirement_tenantId_academicYearId_classId_sectionId_subjectId_key" ON "SubjectWeeklyRequirement"("tenantId", "academicYearId", "classId", "sectionId", "subjectId");
EXCEPTION
    WHEN duplicate_table THEN null;
    WHEN duplicate_object THEN null;
END $$;
