-- CreateEnum
CREATE TYPE "AdmissionPolicyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SCHEDULED', 'EXPIRED', 'ARCHIVED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "AdmissionPolicyApplicantType" AS ENUM ('NEW', 'TRANSFER', 'BOTH');

-- CreateEnum
CREATE TYPE "AdmissionDocumentTiming" AS ENUM ('BEFORE_REVIEW', 'BEFORE_ENROLLMENT');

-- AlterTable
ALTER TABLE "AdmissionApplication" ADD COLUMN     "policyResolutionReason" TEXT,
ADD COLUMN     "policyVersionId" TEXT;

-- CreateTable
CREATE TABLE "AdmissionPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "status" "AdmissionPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "academicYearId" TEXT,
    "classId" TEXT,
    "gradeBand" TEXT,
    "applicantType" "AdmissionPolicyApplicantType" NOT NULL DEFAULT 'BOTH',
    "source" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "currentVersionId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "AdmissionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionPolicyVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "AdmissionPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "admissionMode" TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "transferStudent" BOOLEAN,
    "requiredFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requireSection" BOOLEAN NOT NULL DEFAULT false,
    "requireDocumentReview" BOOLEAN NOT NULL DEFAULT false,
    "requireInterview" BOOLEAN NOT NULL DEFAULT false,
    "requirePrincipalApproval" BOOLEAN NOT NULL DEFAULT false,
    "requireTransferCertificate" BOOLEAN NOT NULL DEFAULT false,
    "requirePriorMarksheet" BOOLEAN NOT NULL DEFAULT false,
    "requireStreamOrMarksReview" BOOLEAN NOT NULL DEFAULT false,
    "allowAdmissionWithDocumentsPending" BOOLEAN NOT NULL DEFAULT true,
    "enforceCapacityWhenAvailable" BOOLEAN NOT NULL DEFAULT false,
    "capacityOverride" INTEGER,
    "approvalLevel" TEXT,
    "notesForOffice" TEXT,
    "activatedAt" TIMESTAMP(3),
    "activatedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionPolicyDocumentRequirement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "documentKind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "requiresOriginalVerification" BOOLEAN NOT NULL DEFAULT false,
    "timing" "AdmissionDocumentTiming" NOT NULL DEFAULT 'BEFORE_ENROLLMENT',
    "expiresAfterDays" INTEGER,
    "canBeWaived" BOOLEAN NOT NULL DEFAULT false,
    "waivableByRoleKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionPolicyDocumentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionPolicy_currentVersionId_key" ON "AdmissionPolicy"("currentVersionId");

-- CreateIndex
CREATE INDEX "AdmissionPolicy_tenantId_status_idx" ON "AdmissionPolicy"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AdmissionPolicy_tenantId_academicYearId_classId_idx" ON "AdmissionPolicy"("tenantId", "academicYearId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionPolicy_tenantId_slug_key" ON "AdmissionPolicy"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "AdmissionPolicyVersion_tenantId_policyId_createdAt_idx" ON "AdmissionPolicyVersion"("tenantId", "policyId", "createdAt");

-- CreateIndex
CREATE INDEX "AdmissionPolicyVersion_tenantId_status_idx" ON "AdmissionPolicyVersion"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionPolicyVersion_policyId_version_key" ON "AdmissionPolicyVersion"("policyId", "version");

-- CreateIndex
CREATE INDEX "AdmissionPolicyDocumentRequirement_tenantId_policyVersionId_idx" ON "AdmissionPolicyDocumentRequirement"("tenantId", "policyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionPolicyDocumentRequirement_policyVersionId_document_key" ON "AdmissionPolicyDocumentRequirement"("policyVersionId", "documentKind");

-- CreateIndex
CREATE INDEX "AdmissionApplication_tenantId_policyVersionId_idx" ON "AdmissionApplication"("tenantId", "policyVersionId");

-- AddForeignKey
ALTER TABLE "AdmissionPolicy" ADD CONSTRAINT "AdmissionPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionPolicy" ADD CONSTRAINT "AdmissionPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionPolicy" ADD CONSTRAINT "AdmissionPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionPolicy" ADD CONSTRAINT "AdmissionPolicy_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "AdmissionPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionPolicyVersion" ADD CONSTRAINT "AdmissionPolicyVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionPolicyVersion" ADD CONSTRAINT "AdmissionPolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AdmissionPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionPolicyVersion" ADD CONSTRAINT "AdmissionPolicyVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionPolicyVersion" ADD CONSTRAINT "AdmissionPolicyVersion_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionPolicyDocumentRequirement" ADD CONSTRAINT "AdmissionPolicyDocumentRequirement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionPolicyDocumentRequirement" ADD CONSTRAINT "AdmissionPolicyDocumentRequirement_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "AdmissionPolicyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "AdmissionPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
