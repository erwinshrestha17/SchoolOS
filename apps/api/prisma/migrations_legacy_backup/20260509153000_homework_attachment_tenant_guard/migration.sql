-- Guardrail for Homework attachments.
-- A HomeworkAttachment must point to a tenant-owned, uploaded, non-deleted FileAsset
-- and to a HomeworkSubmission from the same tenant.

-- REPAIR: Create missing HomeworkAttachment table if it doesn't exist
CREATE TABLE IF NOT EXISTS "HomeworkAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "submissionId" TEXT,
    "assignmentId" TEXT,
    "fileAssetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkAttachment_pkey" PRIMARY KEY ("id")
);

-- REPAIR: Add foreign keys for HomeworkAttachment
DO $$ BEGIN
    ALTER TABLE "HomeworkAttachment" ADD CONSTRAINT "HomeworkAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "HomeworkAttachment" ADD CONSTRAINT "HomeworkAttachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "HomeworkAttachment" ADD CONSTRAINT "HomeworkAttachment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "HomeworkAttachment" ADD CONSTRAINT "HomeworkAttachment_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- REPAIR: Add missing columns and constraints to various tables
DO $$ BEGIN
    -- Section
    ALTER TABLE "Section" ADD COLUMN "classTeacherId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Section" ADD CONSTRAINT "Section_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    -- Staff
    ALTER TABLE "Staff" ADD COLUMN "staffCode" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Staff" ADD COLUMN "department" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Staff" ADD COLUMN "designation" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Staff" ADD COLUMN "employmentType" "StaffEmploymentType";
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Staff" ADD COLUMN "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Staff" ADD COLUMN "contractStatus" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Staff" ADD COLUMN "emergencyContactName" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Staff" ADD COLUMN "emergencyContactPhone" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Staff" ADD COLUMN "emergencyContactRelation" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Staff_tenantId_staffCode_key') THEN
        CREATE UNIQUE INDEX "Staff_tenantId_staffCode_key" ON "Staff"("tenantId", "staffCode");
    END IF;
END $$;

DO $$ BEGIN
    -- Student
    ALTER TABLE "Student" ADD COLUMN "photoFileId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Student_photoFileId_key') THEN
        CREATE UNIQUE INDEX "Student_photoFileId_key" ON "Student"("photoFileId");
    END IF;
END $$;

DO $$ BEGIN
    ALTER TABLE "Student" ADD CONSTRAINT "Student_photoFileId_fkey" FOREIGN KEY ("photoFileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    -- Missing Student columns
    ALTER TABLE "Student" ADD COLUMN "qrCode" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Student" ADD COLUMN "studentIdentityCode" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Student_qrCode_key') THEN
        CREATE UNIQUE INDEX "Student_qrCode_key" ON "Student"("qrCode");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Student_studentIdentityCode_key') THEN
        CREATE UNIQUE INDEX "Student_studentIdentityCode_key" ON "Student"("studentIdentityCode");
    END IF;
END $$;

-- StudentDocument Status Enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudentDocumentStatus') THEN
        CREATE TYPE "StudentDocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'REPLACED', 'REJECTED', 'VERIFIED');
    END IF;
END $$;

DO $$ BEGIN
    -- StudentDocument
    ALTER TABLE "StudentDocument" ADD COLUMN "fileId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StudentDocument" ADD COLUMN "status" "StudentDocumentStatus" NOT NULL DEFAULT 'ACTIVE';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StudentDocument" ADD COLUMN "notes" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StudentDocument" ADD COLUMN "expiryDate" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StudentDocument" ADD COLUMN "verifiedAt" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StudentDocument" ADD COLUMN "verifiedById" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StudentDocument" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- StudentDocumentHistory table
CREATE TABLE IF NOT EXISTS "StudentDocumentHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT,
    "action" TEXT NOT NULL,
    "documentTitle" TEXT,
    "documentKind" TEXT,
    "performedBy" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDocumentHistory_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "StudentDocumentHistory" ADD CONSTRAINT "StudentDocumentHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StudentDocumentHistory" ADD CONSTRAINT "StudentDocumentHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StudentDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- StudentIdentity table
CREATE TABLE IF NOT EXISTS "StudentIdentity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "identityCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,

    CONSTRAINT "StudentIdentity_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'StudentIdentity_identityCode_key') THEN
        CREATE UNIQUE INDEX "StudentIdentity_identityCode_key" ON "StudentIdentity"("identityCode");
    END IF;
END $$;

DO $$ BEGIN
    ALTER TABLE "StudentIdentity" ADD CONSTRAINT "StudentIdentity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StudentIdentity" ADD CONSTRAINT "StudentIdentity_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- StudentMergeHistory table
CREATE TABLE IF NOT EXISTS "StudentMergeHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceStudentId" TEXT NOT NULL,
    "targetStudentId" TEXT NOT NULL,
    "mergedById" TEXT,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "StudentMergeHistory_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "StudentMergeHistory" ADD CONSTRAINT "StudentMergeHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StudentMergeHistory" ADD CONSTRAINT "StudentMergeHistory_sourceStudentId_fkey" FOREIGN KEY ("sourceStudentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StudentMergeHistory" ADD CONSTRAINT "StudentMergeHistory_targetStudentId_fkey" FOREIGN KEY ("targetStudentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "StudentMergeHistory" ADD CONSTRAINT "StudentMergeHistory_mergedById_fkey" FOREIGN KEY ("mergedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    -- Attendance enums
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceCorrectionStatus') THEN
        CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
    END IF;
END $$;

-- AttendanceCorrectionRequest table
CREATE TABLE IF NOT EXISTS "AttendanceCorrectionRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "attendanceRecordId" TEXT,
    "attendanceSessionId" TEXT,
    "studentId" TEXT NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "requestedStatus" "AttendanceStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AttendanceCorrectionRequest_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AccountingReportMappingType Enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountingReportMappingType') THEN
        CREATE TYPE "AccountingReportMappingType" AS ENUM ('CASH', 'BANK', 'VAT_OUTPUT', 'VAT_INPUT', 'TDS_PAYABLE', 'PF_EMPLOYEE_PAYABLE', 'PF_EMPLOYER_PAYABLE', 'PF_PAYABLE', 'RETAINED_EARNINGS');
    END IF;
END $$;

-- AccountingReportAccountMapping table
CREATE TABLE IF NOT EXISTS "AccountingReportAccountMapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mappingType" "AccountingReportMappingType" NOT NULL,
    "chartAccountId" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingReportAccountMapping_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "AccountingReportAccountMapping" ADD CONSTRAINT "AccountingReportAccountMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BankStatement table
CREATE TABLE IF NOT EXISTS "BankStatement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "openingBalance" DECIMAL(12,2) NOT NULL,
    "closingBalance" DECIMAL(12,2) NOT NULL,
    "statementFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    -- Payment enums
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
        CREATE TYPE "PaymentStatus" AS ENUM ('SUCCESS', 'REVERSED', 'FAILED');
    END IF;
END $$;

DO $$ BEGIN
    -- Payment
    ALTER TABLE "Payment" ADD COLUMN "status" "PaymentStatus" NOT NULL DEFAULT 'SUCCESS';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Payment" ADD COLUMN "idempotencyKey" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Payment" ADD COLUMN "isAdvance" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Payment" ADD COLUMN "recognizedAt" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Payment" ADD COLUMN "reversedAt" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Payment" ADD COLUMN "reversedById" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Payment" ADD COLUMN "reversalReason" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Payment_tenantId_idempotencyKey_key') THEN
        CREATE UNIQUE INDEX "Payment_tenantId_idempotencyKey_key" ON "Payment"("tenantId", "idempotencyKey");
    END IF;
END $$;

DO $$ BEGIN
    -- Invoice
    ALTER TABLE "Invoice" ADD COLUMN "fiscalYear" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Invoice" ADD COLUMN "billNumber" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Invoice" ADD COLUMN "reportCardBlocked" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Invoice" ADD COLUMN "hallTicketBlocked" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    -- ReportCard Status Enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportCardStatus') THEN
        CREATE TYPE "ReportCardStatus" AS ENUM ('DRAFT', 'FINALIZED', 'PUBLISHED', 'ARCHIVED');
    END IF;
END $$;

DO $$ BEGIN
    -- ReportCard
    ALTER TABLE "ReportCard" ADD COLUMN "publishedAt" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ReportCard" ADD COLUMN "publishedById" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ReportCard" ADD COLUMN "templateVersion" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    -- Update status column to use ReportCardStatus if it exists but is old type
    -- or just add it if missing (initially it used GradeLockStatus)
    ALTER TABLE "ReportCard" ALTER COLUMN "status" TYPE "ReportCardStatus" USING "status"::text::"ReportCardStatus";
EXCEPTION WHEN OTHERS THEN
    DO $inner$ BEGIN
        ALTER TABLE "ReportCard" ADD COLUMN "status" "ReportCardStatus" NOT NULL DEFAULT 'DRAFT';
    EXCEPTION WHEN duplicate_column THEN NULL; END $inner$;
END $$;

DO $$ BEGIN
    -- TimetableSlot
    ALTER TABLE "TimetableSlot" ADD COLUMN "roomId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "TimetableSlot" ADD COLUMN "versionId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "TimetableSlot" ADD COLUMN "periodId" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    -- HomeworkAssignment
    ALTER TABLE "HomeworkAssignment" ADD COLUMN "assignedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "HomeworkAssignment" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "HomeworkAssignment" ADD COLUMN "attachmentMetadata" JSONB;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;


CREATE OR REPLACE FUNCTION "enforce_homework_attachment_tenant_guard"()
RETURNS trigger AS $$
DECLARE
  file_tenant_id text;
  file_status text;
  file_soft_deleted_at timestamp;
  submission_tenant_id text;
BEGIN
  SELECT "tenantId", "status"::text, "softDeletedAt"
    INTO file_tenant_id, file_status, file_soft_deleted_at
  FROM "FileAsset"
  WHERE "id" = NEW."fileAssetId";

  IF file_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Homework attachment file asset does not exist';
  END IF;

  IF file_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Homework attachment file asset is outside this tenant';
  END IF;

  IF file_status <> 'UPLOADED' THEN
    RAISE EXCEPTION 'Homework attachment file asset is not uploaded';
  END IF;

  IF file_soft_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Homework attachment file asset is deleted';
  END IF;

  SELECT "tenantId"
    INTO submission_tenant_id
  FROM "HomeworkSubmission"
  WHERE "id" = NEW."submissionId";

  IF submission_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Homework attachment submission does not exist';
  END IF;

  IF submission_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Homework attachment submission is outside this tenant';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "homework_attachment_tenant_guard" ON "HomeworkAttachment";

CREATE TRIGGER "homework_attachment_tenant_guard"
BEFORE INSERT OR UPDATE OF "tenantId", "submissionId", "fileAssetId"
ON "HomeworkAttachment"
FOR EACH ROW
EXECUTE FUNCTION "enforce_homework_attachment_tenant_guard"();

CREATE INDEX IF NOT EXISTS "HomeworkAttachment_tenantId_fileAssetId_idx"
ON "HomeworkAttachment" ("tenantId", "fileAssetId");
