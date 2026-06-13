-- M1 Admissions backend depth: durable import history and expiry reminder templates.

CREATE TABLE "AdmissionImportBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceFileName" TEXT,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "confirmDuplicates" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "createdRows" INTEGER NOT NULL DEFAULT 0,
    "validatedRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "errorReportCsv" TEXT,
    "metadata" JSONB,
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdmissionImportRow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "studentId" TEXT,
    "studentSystemId" TEXT,
    "errors" JSONB,
    "duplicates" JSONB,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionImportRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentDocumentExpiryTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "reminderStatus" TEXT NOT NULL,
    "subjectTemplate" TEXT,
    "messageTemplate" TEXT NOT NULL,
    "daysBeforeExpiry" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDocumentExpiryTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdmissionApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INQUIRY',
    "firstNameEn" TEXT NOT NULL,
    "lastNameEn" TEXT NOT NULL,
    "firstNameNp" TEXT,
    "lastNameNp" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender",
    "guardianFullName" TEXT,
    "guardianRelation" TEXT,
    "guardianPhone" TEXT,
    "guardianEmail" TEXT,
    "academicYearId" TEXT,
    "classId" TEXT,
    "sectionId" TEXT,
    "previousSchool" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "duplicateReview" JSONB,
    "convertedStudentId" TEXT,
    "rejectedReason" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdmissionImportBatch_tenantId_createdAt_idx" ON "AdmissionImportBatch"("tenantId", "createdAt");
CREATE INDEX "AdmissionImportBatch_tenantId_status_createdAt_idx" ON "AdmissionImportBatch"("tenantId", "status", "createdAt");

CREATE UNIQUE INDEX "AdmissionImportRow_batchId_rowNumber_key" ON "AdmissionImportRow"("batchId", "rowNumber");
CREATE INDEX "AdmissionImportRow_tenantId_batchId_idx" ON "AdmissionImportRow"("tenantId", "batchId");
CREATE INDEX "AdmissionImportRow_tenantId_status_createdAt_idx" ON "AdmissionImportRow"("tenantId", "status", "createdAt");

CREATE UNIQUE INDEX "StudentDocumentExpiryTemplate_tenantId_channel_reminderStatus_key" ON "StudentDocumentExpiryTemplate"("tenantId", "channel", "reminderStatus");
CREATE INDEX "StudentDocumentExpiryTemplate_tenantId_isActive_idx" ON "StudentDocumentExpiryTemplate"("tenantId", "isActive");

CREATE INDEX "AdmissionApplication_tenantId_status_createdAt_idx" ON "AdmissionApplication"("tenantId", "status", "createdAt");
CREATE INDEX "AdmissionApplication_tenantId_classId_status_idx" ON "AdmissionApplication"("tenantId", "classId", "status");
CREATE INDEX "AdmissionApplication_tenantId_guardianPhone_idx" ON "AdmissionApplication"("tenantId", "guardianPhone");
CREATE INDEX "AdmissionApplication_tenantId_convertedStudentId_idx" ON "AdmissionApplication"("tenantId", "convertedStudentId");

ALTER TABLE "AdmissionImportBatch" ADD CONSTRAINT "AdmissionImportBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdmissionImportRow" ADD CONSTRAINT "AdmissionImportRow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdmissionImportRow" ADD CONSTRAINT "AdmissionImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AdmissionImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentDocumentExpiryTemplate" ADD CONSTRAINT "StudentDocumentExpiryTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
