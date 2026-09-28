-- CreateEnum
CREATE TYPE "ExternalAuthorityCode" AS ENUM ('NEB', 'CEHRD_IEMIS', 'TSC', 'OTHER');

-- CreateEnum
CREATE TYPE "ExternalAuthorityHandoffStatus" AS ENUM ('READY', 'EXPORTED', 'SUBMITTED', 'ACKNOWLEDGED', 'REJECTED', 'CORRECTION_REQUIRED');

-- CreateEnum
CREATE TYPE "NepalHrPolicyKind" AS ENUM ('EMPLOYMENT_POST_CLASSIFICATION', 'CONTRACT_SERVICE_CONDITIONS', 'WORKING_TIME_LEAVE', 'COMPENSATION_MINIMUM', 'STATUTORY_SCHEME_TAX', 'TEACHER_PROFESSIONAL_ELIGIBILITY');

-- CreateEnum
CREATE TYPE "NepalHrPolicyReviewStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'REVIEWED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProfessionalEvidenceStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "StaffEmploymentStatus" AS ENUM ('PENDING', 'VERIFIED', 'ENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TeacherProfileStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TeacherEligibilityOutcome" AS ENUM ('ELIGIBLE', 'INELIGIBLE');

-- AlterTable
ALTER TABLE "TeacherAssignment" ADD COLUMN     "eligibilityAssessmentId" TEXT;

ALTER TABLE "TeacherDelegation" ADD COLUMN "eligibilityAssessmentId" TEXT;

-- CreateTable
CREATE TABLE "ExternalAuthorityHandoff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authority" "ExternalAuthorityCode" NOT NULL,
    "purpose" TEXT NOT NULL,
    "externalSchoolReference" TEXT,
    "reportExportId" TEXT,
    "supersedesId" TEXT,
    "snapshotFileId" TEXT NOT NULL,
    "snapshotChecksumSha256" TEXT NOT NULL,
    "schemaAuthority" TEXT NOT NULL,
    "officialFormatVerified" BOOLEAN NOT NULL DEFAULT false,
    "directSyncSupported" BOOLEAN NOT NULL DEFAULT false,
    "status" "ExternalAuthorityHandoffStatus" NOT NULL DEFAULT 'READY',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exportedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "externalReceiptReference" TEXT,

    CONSTRAINT "ExternalAuthorityHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalAuthorityHandoffEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "handoffId" TEXT NOT NULL,
    "status" "ExternalAuthorityHandoffStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalReceiptReference" TEXT,
    "evidenceFileId" TEXT,
    "note" TEXT,

    CONSTRAINT "ExternalAuthorityHandoffEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NepalHrPolicyVersion" (
    "id" TEXT NOT NULL,
    "policyKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" "NepalHrPolicyKind" NOT NULL,
    "scope" "NepalEducationPolicyScope" NOT NULL,
    "tenantId" TEXT,
    "provinceId" INTEGER,
    "districtId" INTEGER,
    "localLevelId" INTEGER,
    "schoolTypeCode" TEXT,
    "employmentType" "StaffEmploymentType",
    "postCategoryCode" TEXT,
    "classLevelMin" INTEGER,
    "classLevelMax" INTEGER,
    "subjectCode" TEXT,
    "isMandatoryBaseline" BOOLEAN NOT NULL DEFAULT false,
    "requiresQualification" BOOLEAN,
    "requiresLicence" BOOLEAN,
    "minimumMonthlyNpr" DECIMAL(12,2),
    "payloadSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "reviewStatus" "NepalHrPolicyReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "supersedesId" TEXT,
    "sourceTitle" TEXT NOT NULL,
    "sourcePublisher" TEXT,
    "sourceUri" TEXT,
    "sourcePublishedAt" TIMESTAMP(3),
    "sourceChecksumSha256" TEXT,
    "evidenceFileAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NepalHrPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffEmployment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "employmentType" "StaffEmploymentType" NOT NULL,
    "postCategoryCode" TEXT NOT NULL,
    "schoolTypeCode" TEXT NOT NULL,
    "localLevelId" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "StaffEmploymentStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,
    "contractId" TEXT,
    "policyVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffEmployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "status" "TeacherProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherQualificationEvidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "qualification" TEXT NOT NULL,
    "institution" TEXT,
    "subjectCode" TEXT,
    "levelCode" TEXT,
    "issuedOn" TIMESTAMP(3),
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "status" "ProfessionalEvidenceStatus" NOT NULL DEFAULT 'PENDING',
    "documentId" TEXT,
    "sourceUri" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherQualificationEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingLicenceEvidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "authorityCode" TEXT NOT NULL,
    "externalReference" TEXT NOT NULL,
    "subjectCode" TEXT,
    "levelCode" TEXT,
    "issuedOn" TIMESTAMP(3),
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "status" "ProfessionalEvidenceStatus" NOT NULL DEFAULT 'PENDING',
    "documentId" TEXT,
    "sourceUri" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachingLicenceEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherEligibilityAssessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "employmentId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "qualificationId" TEXT,
    "licenceId" TEXT,
    "outcome" "TeacherEligibilityOutcome" NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "evaluatedById" TEXT,

    CONSTRAINT "TeacherEligibilityAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalAuthorityHandoff_tenantId_authority_status_createdA_idx" ON "ExternalAuthorityHandoff"("tenantId", "authority", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalAuthorityHandoff_tenantId_reportExportId_key" ON "ExternalAuthorityHandoff"("tenantId", "reportExportId");

CREATE UNIQUE INDEX "ExternalAuthorityHandoff_supersedesId_key" ON "ExternalAuthorityHandoff"("supersedesId");

-- CreateIndex
CREATE INDEX "ExternalAuthorityHandoffEvent_tenantId_handoffId_occurredAt_idx" ON "ExternalAuthorityHandoffEvent"("tenantId", "handoffId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "NepalHrPolicyVersion_supersedesId_key" ON "NepalHrPolicyVersion"("supersedesId");

-- CreateIndex
CREATE INDEX "NepalHrPolicyVersion_kind_scope_reviewStatus_effectiveFrom_idx" ON "NepalHrPolicyVersion"("kind", "scope", "reviewStatus", "effectiveFrom");

-- CreateIndex
CREATE INDEX "NepalHrPolicyVersion_tenantId_kind_reviewStatus_effectiveFr_idx" ON "NepalHrPolicyVersion"("tenantId", "kind", "reviewStatus", "effectiveFrom");

-- CreateIndex
CREATE INDEX "NepalHrPolicyVersion_localLevelId_kind_reviewStatus_effecti_idx" ON "NepalHrPolicyVersion"("localLevelId", "kind", "reviewStatus", "effectiveFrom");

-- CreateIndex
CREATE INDEX "NepalHrPolicyVersion_policyKey_reviewStatus_effectiveFrom_idx" ON "NepalHrPolicyVersion"("policyKey", "reviewStatus", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "NepalHrPolicyVersion_policyKey_version_key" ON "NepalHrPolicyVersion"("policyKey", "version");

-- CreateIndex
CREATE INDEX "StaffEmployment_tenantId_staffId_status_effectiveFrom_idx" ON "StaffEmployment"("tenantId", "staffId", "status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_staffId_key" ON "TeacherProfile"("staffId");

-- CreateIndex
CREATE INDEX "TeacherProfile_tenantId_status_effectiveFrom_idx" ON "TeacherProfile"("tenantId", "status", "effectiveFrom");

-- CreateIndex
CREATE INDEX "TeacherQualificationEvidence_tenantId_profileId_status_vali_idx" ON "TeacherQualificationEvidence"("tenantId", "profileId", "status", "validFrom");

-- CreateIndex
CREATE INDEX "TeachingLicenceEvidence_tenantId_profileId_status_validFrom_idx" ON "TeachingLicenceEvidence"("tenantId", "profileId", "status", "validFrom");

-- CreateIndex
CREATE INDEX "TeacherEligibilityAssessment_tenantId_staffId_evaluatedAt_idx" ON "TeacherEligibilityAssessment"("tenantId", "staffId", "evaluatedAt");

-- AddForeignKey
ALTER TABLE "ExternalAuthorityHandoff" ADD CONSTRAINT "ExternalAuthorityHandoff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAuthorityHandoff" ADD CONSTRAINT "ExternalAuthorityHandoff_reportExportId_fkey" FOREIGN KEY ("reportExportId") REFERENCES "ReportExport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExternalAuthorityHandoff" ADD CONSTRAINT "ExternalAuthorityHandoff_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "ExternalAuthorityHandoff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAuthorityHandoff" ADD CONSTRAINT "ExternalAuthorityHandoff_snapshotFileId_fkey" FOREIGN KEY ("snapshotFileId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAuthorityHandoff" ADD CONSTRAINT "ExternalAuthorityHandoff_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAuthorityHandoffEvent" ADD CONSTRAINT "ExternalAuthorityHandoffEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAuthorityHandoffEvent" ADD CONSTRAINT "ExternalAuthorityHandoffEvent_handoffId_fkey" FOREIGN KEY ("handoffId") REFERENCES "ExternalAuthorityHandoff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAuthorityHandoffEvent" ADD CONSTRAINT "ExternalAuthorityHandoffEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAuthorityHandoffEvent" ADD CONSTRAINT "ExternalAuthorityHandoffEvent_evidenceFileId_fkey" FOREIGN KEY ("evidenceFileId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NepalHrPolicyVersion" ADD CONSTRAINT "NepalHrPolicyVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NepalHrPolicyVersion" ADD CONSTRAINT "NepalHrPolicyVersion_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "NepalProvince"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NepalHrPolicyVersion" ADD CONSTRAINT "NepalHrPolicyVersion_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "NepalDistrict"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NepalHrPolicyVersion" ADD CONSTRAINT "NepalHrPolicyVersion_localLevelId_fkey" FOREIGN KEY ("localLevelId") REFERENCES "NepalLocalLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NepalHrPolicyVersion" ADD CONSTRAINT "NepalHrPolicyVersion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NepalHrPolicyVersion" ADD CONSTRAINT "NepalHrPolicyVersion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NepalHrPolicyVersion" ADD CONSTRAINT "NepalHrPolicyVersion_evidenceFileAssetId_fkey" FOREIGN KEY ("evidenceFileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NepalHrPolicyVersion" ADD CONSTRAINT "NepalHrPolicyVersion_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "NepalHrPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_eligibilityAssessmentId_fkey" FOREIGN KEY ("eligibilityAssessmentId") REFERENCES "TeacherEligibilityAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherDelegation" ADD CONSTRAINT "TeacherDelegation_eligibilityAssessmentId_fkey" FOREIGN KEY ("eligibilityAssessmentId") REFERENCES "TeacherEligibilityAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEmployment" ADD CONSTRAINT "StaffEmployment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEmployment" ADD CONSTRAINT "StaffEmployment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEmployment" ADD CONSTRAINT "StaffEmployment_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEmployment" ADD CONSTRAINT "StaffEmployment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "StaffContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEmployment" ADD CONSTRAINT "StaffEmployment_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "NepalHrPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffEmployment" ADD CONSTRAINT "StaffEmployment_localLevelId_fkey" FOREIGN KEY ("localLevelId") REFERENCES "NepalLocalLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherQualificationEvidence" ADD CONSTRAINT "TeacherQualificationEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherQualificationEvidence" ADD CONSTRAINT "TeacherQualificationEvidence_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherQualificationEvidence" ADD CONSTRAINT "TeacherQualificationEvidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherQualificationEvidence" ADD CONSTRAINT "TeacherQualificationEvidence_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingLicenceEvidence" ADD CONSTRAINT "TeachingLicenceEvidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingLicenceEvidence" ADD CONSTRAINT "TeachingLicenceEvidence_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingLicenceEvidence" ADD CONSTRAINT "TeachingLicenceEvidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingLicenceEvidence" ADD CONSTRAINT "TeachingLicenceEvidence_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEligibilityAssessment" ADD CONSTRAINT "TeacherEligibilityAssessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEligibilityAssessment" ADD CONSTRAINT "TeacherEligibilityAssessment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEligibilityAssessment" ADD CONSTRAINT "TeacherEligibilityAssessment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEligibilityAssessment" ADD CONSTRAINT "TeacherEligibilityAssessment_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "StaffEmployment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEligibilityAssessment" ADD CONSTRAINT "TeacherEligibilityAssessment_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "NepalHrPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEligibilityAssessment" ADD CONSTRAINT "TeacherEligibilityAssessment_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "TeacherQualificationEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEligibilityAssessment" ADD CONSTRAINT "TeacherEligibilityAssessment_licenceId_fkey" FOREIGN KEY ("licenceId") REFERENCES "TeachingLicenceEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEligibilityAssessment" ADD CONSTRAINT "TeacherEligibilityAssessment_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A policy cannot be approved without independent review and source evidence.
-- These checks apply to direct database writes as well as future API workflows.
ALTER TABLE "NepalHrPolicyVersion"
  ADD CONSTRAINT "NepalHrPolicyVersion_valid_version"
    CHECK ("version" > 0 AND "payloadSchemaVersion" > 0),
  ADD CONSTRAINT "NepalHrPolicyVersion_valid_dates"
    CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  ADD CONSTRAINT "NepalHrPolicyVersion_valid_payload"
    CHECK (jsonb_typeof("payload") = 'object'),
  ADD CONSTRAINT "NepalHrPolicyVersion_nonblank_source"
    CHECK (btrim("policyKey") <> '' AND btrim("sourceTitle") <> ''),
  ADD CONSTRAINT "NepalHrPolicyVersion_checksum_format"
    CHECK ("sourceChecksumSha256" IS NULL OR "sourceChecksumSha256" ~ '^[0-9a-fA-F]{64}$'),
  ADD CONSTRAINT "NepalHrPolicyVersion_valid_lineage"
    CHECK (("version" = 1 AND "supersedesId" IS NULL)
      OR ("version" > 1 AND "supersedesId" IS NOT NULL)),
  ADD CONSTRAINT "NepalHrPolicyVersion_scope_identity"
    CHECK (
      ("scope" = 'NATIONAL' AND "tenantId" IS NULL AND "provinceId" IS NULL AND "districtId" IS NULL AND "localLevelId" IS NULL)
      OR ("scope" = 'PROVINCE' AND "tenantId" IS NULL AND "provinceId" IS NOT NULL AND "districtId" IS NULL AND "localLevelId" IS NULL)
      OR ("scope" = 'DISTRICT' AND "tenantId" IS NULL AND "provinceId" IS NULL AND "districtId" IS NOT NULL AND "localLevelId" IS NULL)
      OR ("scope" = 'LOCAL_LEVEL' AND "tenantId" IS NULL AND "provinceId" IS NULL AND "districtId" IS NULL AND "localLevelId" IS NOT NULL)
      OR ("scope" = 'SCHOOL' AND "tenantId" IS NOT NULL AND "provinceId" IS NULL AND "districtId" IS NULL)
    ),
  ADD CONSTRAINT "NepalHrPolicyVersion_external_baseline"
    CHECK (NOT "isMandatoryBaseline" OR "scope" <> 'SCHOOL'),
  ADD CONSTRAINT "NepalHrPolicyVersion_review_evidence"
    CHECK (
      ("reviewStatus" IN ('DRAFT', 'IN_REVIEW') AND "reviewedById" IS NULL AND "reviewedAt" IS NULL AND "approvedById" IS NULL AND "approvedAt" IS NULL)
      OR ("reviewStatus" = 'REVIEWED' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "approvedById" IS NULL AND "approvedAt" IS NULL)
      OR ("reviewStatus" = 'REJECTED' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "approvedById" IS NULL AND "approvedAt" IS NULL AND NULLIF(btrim("reviewNote"), '') IS NOT NULL)
      OR ("reviewStatus" = 'APPROVED' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL AND "approvedAt" >= "reviewedAt" AND "approvedById" <> "reviewedById" AND (NULLIF(btrim("sourceUri"), '') IS NOT NULL OR "evidenceFileAssetId" IS NOT NULL))
    ),
  ADD CONSTRAINT "NepalHrPolicyVersion_teacher_requirements"
    CHECK ("reviewStatus" <> 'APPROVED' OR "kind" <> 'TEACHER_PROFESSIONAL_ELIGIBILITY'
      OR ("requiresQualification" IS NOT NULL AND "requiresLicence" IS NOT NULL)),
  ADD CONSTRAINT "NepalHrPolicyVersion_minimum_amount"
    CHECK ("minimumMonthlyNpr" IS NULL OR "minimumMonthlyNpr" >= 0),
  ADD CONSTRAINT "NepalHrPolicyVersion_level_range"
    CHECK ("classLevelMin" IS NULL OR "classLevelMax" IS NULL OR "classLevelMin" <= "classLevelMax"),
  ADD CONSTRAINT "NepalHrPolicyVersion_school_context"
    CHECK ("reviewStatus" <> 'APPROVED' OR "scope" <> 'SCHOOL'
      OR ("localLevelId" IS NOT NULL AND NULLIF(btrim("schoolTypeCode"), '') IS NOT NULL));

-- The same policy lineage cannot approve two alternatives for one start date.
CREATE UNIQUE INDEX "NepalHrPolicyVersion_one_approved_start"
  ON "NepalHrPolicyVersion" ("policyKey", "effectiveFrom")
  WHERE "reviewStatus" = 'APPROVED';

CREATE FUNCTION "guard_nepal_hr_policy_version"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  previous "NepalHrPolicyVersion"%ROWTYPE;
  evidence_tenant_id TEXT;
  reviewer_tenant_id TEXT;
  approver_tenant_id TEXT;
  reviewer_domain "SecurityDomain";
  approver_domain "SecurityDomain";
  evidence_domain "SecurityDomain";
  reviewer_status "UserStatus";
  approver_status "UserStatus";
  reviewer_tenant_active BOOLEAN;
  approver_tenant_active BOOLEAN;
  school_district_id INT;
  school_province_id INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'HR policy versions cannot be deleted; preserve review history';
  END IF;

  IF TG_OP = 'INSERT' AND NEW."reviewStatus" <> 'DRAFT' THEN
    RAISE EXCEPTION 'HR policy versions must start as drafts';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."reviewStatus" IN ('APPROVED', 'REJECTED') THEN
      RAISE EXCEPTION 'Approved or rejected HR policy history is immutable';
    END IF;
    IF OLD."reviewStatus" = 'REVIEWED' THEN
      IF NEW."reviewStatus" NOT IN ('APPROVED', 'REJECTED')
        OR (to_jsonb(NEW) - 'reviewStatus' - 'approvedById' - 'approvedAt')
           IS DISTINCT FROM (to_jsonb(OLD) - 'reviewStatus' - 'approvedById' - 'approvedAt') THEN
        RAISE EXCEPTION 'Reviewed HR policy content cannot change';
      END IF;
    END IF;
    IF OLD."reviewStatus" = 'DRAFT' AND NEW."reviewStatus" NOT IN ('DRAFT', 'IN_REVIEW') THEN
      RAISE EXCEPTION 'HR policy draft must enter review';
    END IF;
    IF OLD."reviewStatus" = 'IN_REVIEW' AND NEW."reviewStatus" NOT IN ('DRAFT', 'IN_REVIEW', 'REVIEWED', 'REJECTED') THEN
      RAISE EXCEPTION 'HR policy requires review before approval';
    END IF;
  END IF;

  IF NEW."supersedesId" IS NOT NULL THEN
    SELECT * INTO previous FROM "NepalHrPolicyVersion" WHERE "id" = NEW."supersedesId";
    IF NOT FOUND OR previous."policyKey" IS DISTINCT FROM NEW."policyKey"
      OR previous."kind" IS DISTINCT FROM NEW."kind"
      OR previous."scope" IS DISTINCT FROM NEW."scope"
      OR previous."tenantId" IS DISTINCT FROM NEW."tenantId"
      OR previous."provinceId" IS DISTINCT FROM NEW."provinceId"
      OR previous."districtId" IS DISTINCT FROM NEW."districtId"
      OR previous."localLevelId" IS DISTINCT FROM NEW."localLevelId"
      OR previous."schoolTypeCode" IS DISTINCT FROM NEW."schoolTypeCode"
      OR previous."employmentType" IS DISTINCT FROM NEW."employmentType"
      OR previous."postCategoryCode" IS DISTINCT FROM NEW."postCategoryCode"
      OR previous."classLevelMin" IS DISTINCT FROM NEW."classLevelMin"
      OR previous."classLevelMax" IS DISTINCT FROM NEW."classLevelMax"
      OR previous."subjectCode" IS DISTINCT FROM NEW."subjectCode"
      OR previous."reviewStatus" NOT IN ('APPROVED', 'REJECTED')
      OR previous."version" + 1 <> NEW."version"
      OR previous."effectiveFrom" >= NEW."effectiveFrom" THEN
      RAISE EXCEPTION 'HR policy supersession must continue the same scope and increasing version/date';
    END IF;
  END IF;

  IF NEW."evidenceFileAssetId" IS NOT NULL THEN
    SELECT f."tenantId", t."securityDomain" INTO evidence_tenant_id, evidence_domain
      FROM "FileAsset" f JOIN "Tenant" t ON t."id" = f."tenantId"
      WHERE f."id" = NEW."evidenceFileAssetId";
    IF NOT FOUND OR (NEW."scope" = 'SCHOOL' AND evidence_tenant_id IS DISTINCT FROM NEW."tenantId")
      OR (NEW."scope" <> 'SCHOOL' AND evidence_domain <> 'PLATFORM') THEN
      RAISE EXCEPTION 'HR policy evidence must belong to the school or Platform authority';
    END IF;
  END IF;

  IF NEW."reviewedById" IS NOT NULL THEN
    SELECT u."tenantId", t."securityDomain", u."status", t."isActive"
      INTO reviewer_tenant_id, reviewer_domain, reviewer_status, reviewer_tenant_active
      FROM "User" u JOIN "Tenant" t ON t."id" = u."tenantId"
      WHERE u."id" = NEW."reviewedById";
    IF NOT FOUND OR reviewer_status <> 'ACTIVE' OR NOT reviewer_tenant_active
      OR (NEW."scope" = 'SCHOOL' AND reviewer_tenant_id IS DISTINCT FROM NEW."tenantId")
      OR (NEW."scope" <> 'SCHOOL' AND reviewer_domain <> 'PLATFORM') THEN
      RAISE EXCEPTION 'HR policy reviewer belongs to the wrong authority domain';
    END IF;
  END IF;

  IF NEW."approvedById" IS NOT NULL THEN
    SELECT u."tenantId", t."securityDomain", u."status", t."isActive"
      INTO approver_tenant_id, approver_domain, approver_status, approver_tenant_active
      FROM "User" u JOIN "Tenant" t ON t."id" = u."tenantId"
      WHERE u."id" = NEW."approvedById";
    IF NOT FOUND OR approver_status <> 'ACTIVE' OR NOT approver_tenant_active
      OR (NEW."scope" = 'SCHOOL' AND approver_tenant_id IS DISTINCT FROM NEW."tenantId")
      OR (NEW."scope" <> 'SCHOOL' AND approver_domain <> 'PLATFORM') THEN
      RAISE EXCEPTION 'HR policy approver belongs to the wrong authority domain';
    END IF;
  END IF;
  -- A school cannot approve a lower remuneration floor or relax a mandatory
  -- qualification/licence requirement for the same applicable employment context.
  IF NEW."reviewStatus" = 'APPROVED' AND NEW."scope" = 'SCHOOL' THEN
    SELECT l."districtId", d."provinceId" INTO school_district_id, school_province_id
      FROM "NepalLocalLevel" l JOIN "NepalDistrict" d ON d."id" = l."districtId"
      WHERE l."id" = NEW."localLevelId";
    IF EXISTS (
      SELECT 1 FROM "NepalHrPolicyVersion" baseline
      WHERE baseline."kind" = NEW."kind" AND baseline."isMandatoryBaseline"
        AND baseline."reviewStatus" = 'APPROVED'
        AND baseline."effectiveFrom" <= NEW."effectiveFrom"
        AND (baseline."effectiveTo" IS NULL OR baseline."effectiveTo" > NEW."effectiveFrom")
        AND NOT EXISTS (SELECT 1 FROM "NepalHrPolicyVersion" newer
          WHERE newer."policyKey" = baseline."policyKey" AND newer."reviewStatus" = 'APPROVED'
            AND newer."effectiveFrom" > baseline."effectiveFrom"
            AND newer."effectiveFrom" <= NEW."effectiveFrom"
            AND (newer."effectiveTo" IS NULL OR newer."effectiveTo" > NEW."effectiveFrom"))
        AND (baseline."scope" = 'NATIONAL'
          OR baseline."scope" = 'PROVINCE' AND baseline."provinceId" = school_province_id
          OR baseline."scope" = 'DISTRICT' AND baseline."districtId" = school_district_id
          OR baseline."scope" = 'LOCAL_LEVEL' AND baseline."localLevelId" = NEW."localLevelId")
        AND (baseline."schoolTypeCode" IS NULL OR baseline."schoolTypeCode" = NEW."schoolTypeCode")
        AND (baseline."employmentType" IS NULL OR baseline."employmentType" = NEW."employmentType")
        AND (baseline."postCategoryCode" IS NULL OR baseline."postCategoryCode" = NEW."postCategoryCode")
        AND (baseline."minimumMonthlyNpr" IS NOT NULL
          AND (NEW."minimumMonthlyNpr" IS NULL OR NEW."minimumMonthlyNpr" < baseline."minimumMonthlyNpr")
          OR baseline."requiresQualification" IS TRUE AND NEW."requiresQualification" IS FALSE
          OR baseline."requiresLicence" IS TRUE AND NEW."requiresLicence" IS FALSE)
    ) THEN
      RAISE EXCEPTION 'School HR policy cannot relax an approved mandatory baseline';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "NepalHrPolicyVersion_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "NepalHrPolicyVersion"
  FOR EACH ROW EXECUTE FUNCTION "guard_nepal_hr_policy_version"();

-- The existing Staff row is an employee record; employment verification is a
-- separate, dated fact. Do not infer it from a role or legacy joining date.
ALTER TABLE "StaffEmployment"
  ADD CONSTRAINT "StaffEmployment_dates" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  ADD CONSTRAINT "StaffEmployment_verification" CHECK (
    ("status" = 'PENDING' AND "verifiedById" IS NULL AND "verifiedAt" IS NULL AND "endedAt" IS NULL)
    OR ("status" = 'VERIFIED' AND "verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "endedAt" IS NULL)
    OR ("status" = 'ENDED' AND "verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "endedAt" IS NOT NULL AND NULLIF(btrim("endReason"), '') IS NOT NULL)
    OR ("status" = 'REJECTED' AND "verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "StaffEmployment_context" CHECK (NULLIF(btrim("postCategoryCode"), '') IS NOT NULL AND NULLIF(btrim("schoolTypeCode"), '') IS NOT NULL);

ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_dates"
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

ALTER TABLE "TeacherQualificationEvidence"
  ADD CONSTRAINT "TeacherQualificationEvidence_dates" CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom"),
  ADD CONSTRAINT "TeacherQualificationEvidence_source" CHECK (NULLIF(btrim("qualification"), '') IS NOT NULL),
  ADD CONSTRAINT "TeacherQualificationEvidence_verification" CHECK (
    ("status" = 'PENDING' AND "verifiedById" IS NULL AND "verifiedAt" IS NULL AND "revokedAt" IS NULL)
    OR ("status" = 'VERIFIED' AND "verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "revokedAt" IS NULL AND ("documentId" IS NOT NULL OR NULLIF(btrim("sourceUri"), '') IS NOT NULL))
    OR ("status" = 'REJECTED' AND "verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "revokedAt" IS NULL)
    OR ("status" = 'REVOKED' AND "verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "revokedAt" IS NOT NULL AND NULLIF(btrim("revocationReason"), '') IS NOT NULL)
  );

ALTER TABLE "TeachingLicenceEvidence"
  ADD CONSTRAINT "TeachingLicenceEvidence_dates" CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom"),
  ADD CONSTRAINT "TeachingLicenceEvidence_identity" CHECK (NULLIF(btrim("authorityCode"), '') IS NOT NULL AND NULLIF(btrim("externalReference"), '') IS NOT NULL),
  ADD CONSTRAINT "TeachingLicenceEvidence_verification" CHECK (
    ("status" = 'PENDING' AND "verifiedById" IS NULL AND "verifiedAt" IS NULL AND "revokedAt" IS NULL)
    OR ("status" = 'VERIFIED' AND "verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "revokedAt" IS NULL AND ("documentId" IS NOT NULL OR NULLIF(btrim("sourceUri"), '') IS NOT NULL))
    OR ("status" = 'REJECTED' AND "verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "revokedAt" IS NULL)
    OR ("status" = 'REVOKED' AND "verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "revokedAt" IS NOT NULL AND NULLIF(btrim("revocationReason"), '') IS NOT NULL)
  );

ALTER TABLE "TeacherEligibilityAssessment"
  ADD CONSTRAINT "TeacherEligibilityAssessment_reason" CHECK (NULLIF(btrim("reasonCode"), '') IS NOT NULL),
  ADD CONSTRAINT "TeacherEligibilityAssessment_dates" CHECK ("validUntil" IS NULL OR "validUntil" > "evaluatedAt");

CREATE FUNCTION "guard_staff_employment"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Employment history cannot be deleted';
  END IF;
  IF TG_OP = 'INSERT' AND NEW."status" <> 'PENDING' THEN
    RAISE EXCEPTION 'Employment verification must begin from PENDING';
  END IF;
  IF (SELECT "tenantId" FROM "Staff" WHERE "id" = NEW."staffId") IS DISTINCT FROM NEW."tenantId"
    OR (NEW."verifiedById" IS NOT NULL AND
      (SELECT "tenantId" FROM "User" WHERE "id" = NEW."verifiedById") IS DISTINCT FROM NEW."tenantId")
    OR (NEW."contractId" IS NOT NULL AND
      (SELECT "tenantId" FROM "StaffContract" WHERE "id" = NEW."contractId" AND "staffId" = NEW."staffId") IS DISTINCT FROM NEW."tenantId")
    OR (NEW."policyVersionId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "NepalHrPolicyVersion" p WHERE p."id" = NEW."policyVersionId"
        AND p."reviewStatus" = 'APPROVED' AND (p."tenantId" IS NULL OR p."tenantId" = NEW."tenantId")
    )) THEN
    RAISE EXCEPTION 'Employment references must match the tenant, staff and approved policy';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" IN ('ENDED', 'REJECTED')
      OR (OLD."status" = 'VERIFIED' AND (
        NEW."status" <> 'ENDED' OR
        (to_jsonb(NEW) - 'status' - 'endedAt' - 'endReason' - 'effectiveTo')
          IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'endedAt' - 'endReason' - 'effectiveTo')
      )) THEN
      RAISE EXCEPTION 'Verified employment content is immutable; end it with a reason';
    END IF;
  END IF;
  IF NEW."status" = 'VERIFIED' AND EXISTS (
    SELECT 1 FROM "StaffEmployment" prior WHERE prior."tenantId" = NEW."tenantId"
      AND prior."staffId" = NEW."staffId" AND prior."id" <> NEW."id"
      AND prior."status" = 'VERIFIED'
      AND prior."effectiveFrom" < COALESCE(NEW."effectiveTo", 'infinity'::timestamp)
      AND NEW."effectiveFrom" < COALESCE(prior."effectiveTo", 'infinity'::timestamp)
  ) THEN
    RAISE EXCEPTION 'Overlapping verified employment periods are not permitted';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "StaffEmployment_guard" BEFORE INSERT OR UPDATE OR DELETE ON "StaffEmployment"
  FOR EACH ROW EXECUTE FUNCTION "guard_staff_employment"();

CREATE FUNCTION "guard_teacher_profile"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Teacher profile history cannot be deleted'; END IF;
  IF (SELECT "tenantId" FROM "Staff" WHERE "id" = NEW."staffId") IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'Teacher profile staff must belong to the tenant';
  END IF;
  IF TG_OP = 'UPDATE' AND
    (NEW."id", NEW."tenantId", NEW."staffId", NEW."effectiveFrom") IS DISTINCT FROM
    (OLD."id", OLD."tenantId", OLD."staffId", OLD."effectiveFrom") THEN
    RAISE EXCEPTION 'Teacher profile identity and start date are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "TeacherProfile_guard" BEFORE INSERT OR UPDATE OR DELETE ON "TeacherProfile"
  FOR EACH ROW EXECUTE FUNCTION "guard_teacher_profile"();

CREATE FUNCTION "guard_teacher_professional_evidence"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Professional evidence cannot be deleted';
  END IF;
  IF TG_OP = 'INSERT' AND NEW."status" <> 'PENDING' THEN
    RAISE EXCEPTION 'Professional evidence must begin from PENDING';
  END IF;
  IF (SELECT "tenantId" FROM "TeacherProfile" WHERE "id" = NEW."profileId") IS DISTINCT FROM NEW."tenantId"
    OR (NEW."documentId" IS NOT NULL AND
      (SELECT "tenantId" FROM "FileAsset" WHERE "id" = NEW."documentId" AND "softDeletedAt" IS NULL) IS DISTINCT FROM NEW."tenantId")
    OR (NEW."verifiedById" IS NOT NULL AND
      (SELECT "tenantId" FROM "User" WHERE "id" = NEW."verifiedById" AND "status" = 'ACTIVE') IS DISTINCT FROM NEW."tenantId") THEN
    RAISE EXCEPTION 'Professional evidence references must belong to the tenant';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" IN ('REJECTED', 'REVOKED') OR
      (OLD."status" = 'VERIFIED' AND (
        NEW."status" <> 'REVOKED' OR
        (to_jsonb(NEW) - 'status' - 'revokedAt' - 'revocationReason')
          IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'revokedAt' - 'revocationReason')
      )) THEN
      RAISE EXCEPTION 'Verified professional evidence is immutable except revocation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "TeacherQualificationEvidence_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "TeacherQualificationEvidence"
  FOR EACH ROW EXECUTE FUNCTION "guard_teacher_professional_evidence"();
CREATE TRIGGER "TeachingLicenceEvidence_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "TeachingLicenceEvidence"
  FOR EACH ROW EXECUTE FUNCTION "guard_teacher_professional_evidence"();

-- A decision is an immutable audit snapshot. This function is used by the
-- assignment guard and evaluates current evidence again on every activation.
CREATE FUNCTION "schoolos_teacher_eligibility_live"(
  tenant_id TEXT, staff_id TEXT, assessment_id TEXT, at_time TIMESTAMP,
  class_id TEXT DEFAULT NULL, subject_id TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE
  a "TeacherEligibilityAssessment"%ROWTYPE;
  e "StaffEmployment"%ROWTYPE;
  p "NepalHrPolicyVersion"%ROWTYPE;
  t "TeacherProfile"%ROWTYPE;
  class_level INT;
  subject_code TEXT;
  province_id INT;
  district_id INT;
BEGIN
  SELECT * INTO a FROM "TeacherEligibilityAssessment"
    WHERE "id" = assessment_id AND "tenantId" = tenant_id AND "staffId" = staff_id
      AND "outcome" = 'ELIGIBLE' AND "evaluatedAt" <= at_time
      AND ("validUntil" IS NULL OR "validUntil" > at_time);
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT * INTO e FROM "StaffEmployment" WHERE "id" = a."employmentId"
    AND "tenantId" = tenant_id AND "staffId" = staff_id AND "status" = 'VERIFIED'
    AND "effectiveFrom" <= at_time AND ("effectiveTo" IS NULL OR "effectiveTo" > at_time);
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM "Staff" s WHERE s."id" = staff_id AND s."tenantId" = tenant_id
      AND s."status" = 'ACTIVE' AND s."joiningDate" <= at_time
  ) THEN RETURN FALSE; END IF;
  SELECT * INTO t FROM "TeacherProfile" WHERE "id" = a."profileId"
    AND "tenantId" = tenant_id AND "staffId" = staff_id AND "status" = 'ACTIVE'
    AND "effectiveFrom" <= at_time AND ("effectiveTo" IS NULL OR "effectiveTo" > at_time);
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT * INTO p FROM "NepalHrPolicyVersion" WHERE "id" = a."policyVersionId"
    AND "kind" = 'TEACHER_PROFESSIONAL_ELIGIBILITY' AND "reviewStatus" = 'APPROVED'
    AND "effectiveFrom" <= at_time AND ("effectiveTo" IS NULL OR "effectiveTo" > at_time)
    AND ("tenantId" IS NULL OR "tenantId" = tenant_id)
    AND ("schoolTypeCode" IS NULL OR "schoolTypeCode" = e."schoolTypeCode")
    AND ("employmentType" IS NULL OR "employmentType" = e."employmentType")
    AND ("postCategoryCode" IS NULL OR "postCategoryCode" = e."postCategoryCode");
  IF NOT FOUND THEN RETURN FALSE; END IF;
  -- A future approved revision ends the authority of an old assessment from
  -- its effective date; old records remain interpretable under the old id.
  IF EXISTS (
    SELECT 1 FROM "NepalHrPolicyVersion" newer
      WHERE newer."policyKey" = p."policyKey" AND newer."reviewStatus" = 'APPROVED'
        AND newer."effectiveFrom" > p."effectiveFrom"
        AND newer."effectiveFrom" <= at_time
        AND (newer."effectiveTo" IS NULL OR newer."effectiveTo" > at_time)
  ) THEN RETURN FALSE; END IF;

  IF e."localLevelId" IS NOT NULL THEN
    SELECT l."districtId", d."provinceId" INTO district_id, province_id
      FROM "NepalLocalLevel" l JOIN "NepalDistrict" d ON d."id" = l."districtId"
      WHERE l."id" = e."localLevelId";
  END IF;
  IF (p."scope" = 'SCHOOL' AND (p."tenantId" <> tenant_id OR p."localLevelId" IS DISTINCT FROM e."localLevelId"))
    OR (p."scope" = 'LOCAL_LEVEL' AND p."localLevelId" IS DISTINCT FROM e."localLevelId")
    OR (p."scope" = 'DISTRICT' AND p."districtId" IS DISTINCT FROM district_id)
    OR (p."scope" = 'PROVINCE' AND p."provinceId" IS DISTINCT FROM province_id) THEN
    RETURN FALSE;
  END IF;

  IF class_id IS NOT NULL THEN
    SELECT "level" INTO class_level FROM "Class" WHERE "id" = class_id AND "tenantId" = tenant_id;
    IF NOT FOUND OR (p."classLevelMin" IS NOT NULL AND class_level < p."classLevelMin")
      OR (p."classLevelMax" IS NOT NULL AND class_level > p."classLevelMax") THEN RETURN FALSE; END IF;
  ELSIF p."classLevelMin" IS NOT NULL OR p."classLevelMax" IS NOT NULL THEN
    RETURN FALSE;
  END IF;
  IF subject_id IS NOT NULL THEN
    SELECT "code" INTO subject_code FROM "Subject" WHERE "id" = subject_id AND "tenantId" = tenant_id;
    IF NOT FOUND OR (p."subjectCode" IS NOT NULL AND p."subjectCode" <> subject_code) THEN RETURN FALSE; END IF;
  ELSIF p."subjectCode" IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  IF (p."requiresQualification" OR EXISTS (
    SELECT 1 FROM "NepalHrPolicyVersion" mandatory
      WHERE mandatory."kind" = 'TEACHER_PROFESSIONAL_ELIGIBILITY'
        AND mandatory."isMandatoryBaseline" AND mandatory."reviewStatus" = 'APPROVED'
        AND mandatory."effectiveFrom" <= at_time
        AND (mandatory."effectiveTo" IS NULL OR mandatory."effectiveTo" > at_time)
        AND NOT EXISTS (SELECT 1 FROM "NepalHrPolicyVersion" newer
          WHERE newer."policyKey" = mandatory."policyKey" AND newer."reviewStatus" = 'APPROVED'
            AND newer."effectiveFrom" > mandatory."effectiveFrom"
            AND newer."effectiveFrom" <= at_time
            AND (newer."effectiveTo" IS NULL OR newer."effectiveTo" > at_time))
        AND (mandatory."scope" = 'NATIONAL'
          OR mandatory."scope" = 'PROVINCE' AND mandatory."provinceId" = province_id
          OR mandatory."scope" = 'DISTRICT' AND mandatory."districtId" = district_id
          OR mandatory."scope" = 'LOCAL_LEVEL' AND mandatory."localLevelId" = e."localLevelId")
        AND (mandatory."schoolTypeCode" IS NULL OR mandatory."schoolTypeCode" = e."schoolTypeCode")
        AND (mandatory."employmentType" IS NULL OR mandatory."employmentType" = e."employmentType")
        AND (mandatory."postCategoryCode" IS NULL OR mandatory."postCategoryCode" = e."postCategoryCode")
        AND (mandatory."classLevelMin" IS NULL OR class_level >= mandatory."classLevelMin")
        AND (mandatory."classLevelMax" IS NULL OR class_level <= mandatory."classLevelMax")
        AND (mandatory."subjectCode" IS NULL OR mandatory."subjectCode" = subject_code)
        AND mandatory."requiresQualification"
  )) AND NOT EXISTS (
    SELECT 1 FROM "TeacherQualificationEvidence" q
      WHERE q."id" = a."qualificationId" AND q."tenantId" = tenant_id
        AND q."profileId" = t."id" AND q."status" = 'VERIFIED'
        AND q."validFrom" <= at_time AND (q."validUntil" IS NULL OR q."validUntil" > at_time)
        AND (q."subjectCode" IS NULL OR q."subjectCode" = subject_code)
        AND (q."levelCode" IS NULL OR q."levelCode" = class_level::TEXT)
  ) THEN RETURN FALSE; END IF;
  IF (p."requiresLicence" OR EXISTS (
    SELECT 1 FROM "NepalHrPolicyVersion" mandatory
      WHERE mandatory."kind" = 'TEACHER_PROFESSIONAL_ELIGIBILITY'
        AND mandatory."isMandatoryBaseline" AND mandatory."reviewStatus" = 'APPROVED'
        AND mandatory."effectiveFrom" <= at_time
        AND (mandatory."effectiveTo" IS NULL OR mandatory."effectiveTo" > at_time)
        AND NOT EXISTS (SELECT 1 FROM "NepalHrPolicyVersion" newer
          WHERE newer."policyKey" = mandatory."policyKey" AND newer."reviewStatus" = 'APPROVED'
            AND newer."effectiveFrom" > mandatory."effectiveFrom"
            AND newer."effectiveFrom" <= at_time
            AND (newer."effectiveTo" IS NULL OR newer."effectiveTo" > at_time))
        AND (mandatory."scope" = 'NATIONAL'
          OR mandatory."scope" = 'PROVINCE' AND mandatory."provinceId" = province_id
          OR mandatory."scope" = 'DISTRICT' AND mandatory."districtId" = district_id
          OR mandatory."scope" = 'LOCAL_LEVEL' AND mandatory."localLevelId" = e."localLevelId")
        AND (mandatory."schoolTypeCode" IS NULL OR mandatory."schoolTypeCode" = e."schoolTypeCode")
        AND (mandatory."employmentType" IS NULL OR mandatory."employmentType" = e."employmentType")
        AND (mandatory."postCategoryCode" IS NULL OR mandatory."postCategoryCode" = e."postCategoryCode")
        AND (mandatory."classLevelMin" IS NULL OR class_level >= mandatory."classLevelMin")
        AND (mandatory."classLevelMax" IS NULL OR class_level <= mandatory."classLevelMax")
        AND (mandatory."subjectCode" IS NULL OR mandatory."subjectCode" = subject_code)
        AND mandatory."requiresLicence"
  )) AND NOT EXISTS (
    SELECT 1 FROM "TeachingLicenceEvidence" l
      WHERE l."id" = a."licenceId" AND l."tenantId" = tenant_id
        AND l."profileId" = t."id" AND l."status" = 'VERIFIED'
        AND l."validFrom" <= at_time AND (l."validUntil" IS NULL OR l."validUntil" > at_time)
        AND (l."subjectCode" IS NULL OR l."subjectCode" = subject_code)
        AND (l."levelCode" IS NULL OR l."levelCode" = class_level::TEXT)
  ) THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$;

CREATE FUNCTION "guard_teacher_eligibility_assessment"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Teacher eligibility decisions are immutable; create a new decision';
  END IF;
  IF (SELECT "tenantId" FROM "Staff" WHERE "id" = NEW."staffId") IS DISTINCT FROM NEW."tenantId"
    OR (SELECT "tenantId" FROM "TeacherProfile" WHERE "id" = NEW."profileId" AND "staffId" = NEW."staffId") IS DISTINCT FROM NEW."tenantId"
    OR (SELECT "tenantId" FROM "StaffEmployment" WHERE "id" = NEW."employmentId" AND "staffId" = NEW."staffId") IS DISTINCT FROM NEW."tenantId"
    OR (NEW."qualificationId" IS NOT NULL AND (SELECT "tenantId" FROM "TeacherQualificationEvidence" WHERE "id" = NEW."qualificationId" AND "profileId" = NEW."profileId") IS DISTINCT FROM NEW."tenantId")
    OR (NEW."licenceId" IS NOT NULL AND (SELECT "tenantId" FROM "TeachingLicenceEvidence" WHERE "id" = NEW."licenceId" AND "profileId" = NEW."profileId") IS DISTINCT FROM NEW."tenantId")
    OR (NEW."evaluatedById" IS NOT NULL AND (SELECT "tenantId" FROM "User" WHERE "id" = NEW."evaluatedById") IS DISTINCT FROM NEW."tenantId") THEN
    RAISE EXCEPTION 'Teacher eligibility references must match one tenant and teacher';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "NepalHrPolicyVersion" p WHERE p."id" = NEW."policyVersionId"
      AND p."kind" = 'TEACHER_PROFESSIONAL_ELIGIBILITY' AND p."reviewStatus" = 'APPROVED'
      AND (p."tenantId" IS NULL OR p."tenantId" = NEW."tenantId")
      AND p."effectiveFrom" <= NEW."evaluatedAt"
      AND (p."effectiveTo" IS NULL OR p."effectiveTo" > NEW."evaluatedAt")
  ) THEN RAISE EXCEPTION 'Teacher eligibility requires an active approved policy'; END IF;
  -- The live function reads stored assessments, so initial ELIGIBLE inserts
  -- validate the same facts directly through an equivalent guarded query.
  IF NEW."outcome" = 'ELIGIBLE' AND NOT EXISTS (
    SELECT 1 FROM "StaffEmployment" e JOIN "TeacherProfile" t
      ON t."id" = NEW."profileId" AND t."staffId" = NEW."staffId"
      JOIN "NepalHrPolicyVersion" p ON p."id" = NEW."policyVersionId"
      WHERE e."id" = NEW."employmentId" AND e."status" = 'VERIFIED'
        AND e."effectiveFrom" <= NEW."evaluatedAt"
        AND (e."effectiveTo" IS NULL OR e."effectiveTo" > NEW."evaluatedAt")
        AND t."status" = 'ACTIVE' AND t."effectiveFrom" <= NEW."evaluatedAt"
        AND (t."effectiveTo" IS NULL OR t."effectiveTo" > NEW."evaluatedAt")
        AND (p."schoolTypeCode" IS NULL OR p."schoolTypeCode" = e."schoolTypeCode")
        AND (p."employmentType" IS NULL OR p."employmentType" = e."employmentType")
        AND (p."postCategoryCode" IS NULL OR p."postCategoryCode" = e."postCategoryCode")
        AND (NOT p."requiresQualification" OR EXISTS (
          SELECT 1 FROM "TeacherQualificationEvidence" q WHERE q."id" = NEW."qualificationId"
            AND q."profileId" = t."id" AND q."status" = 'VERIFIED'
            AND q."validFrom" <= NEW."evaluatedAt" AND (q."validUntil" IS NULL OR q."validUntil" > NEW."evaluatedAt")
        ))
        AND (NOT p."requiresLicence" OR EXISTS (
          SELECT 1 FROM "TeachingLicenceEvidence" l WHERE l."id" = NEW."licenceId"
            AND l."profileId" = t."id" AND l."status" = 'VERIFIED'
            AND l."validFrom" <= NEW."evaluatedAt" AND (l."validUntil" IS NULL OR l."validUntil" > NEW."evaluatedAt")
        ))
  ) THEN RAISE EXCEPTION 'ELIGIBLE decision requires current verified employment and evidence'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "TeacherEligibilityAssessment_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "TeacherEligibilityAssessment"
  FOR EACH ROW EXECUTE FUNCTION "guard_teacher_eligibility_assessment"();

CREATE FUNCTION "guard_teacher_assignment_eligibility"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" = 'ACTIVE' AND NOT schoolos_teacher_eligibility_live(
    NEW."tenantId", NEW."staffId", NEW."eligibilityAssessmentId", CURRENT_TIMESTAMP,
    NEW."classId", NEW."subjectId"
  ) THEN
    RAISE EXCEPTION 'Active teacher assignment requires current professional eligibility';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "TeacherAssignment_eligibility_guard"
  BEFORE INSERT OR UPDATE ON "TeacherAssignment"
  FOR EACH ROW EXECUTE FUNCTION "guard_teacher_assignment_eligibility"();

CREATE FUNCTION "guard_teacher_delegation_eligibility"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" = 'ACTIVE' AND NOT schoolos_teacher_eligibility_live(
    NEW."tenantId", NEW."recipientStaffId", NEW."eligibilityAssessmentId", CURRENT_TIMESTAMP,
    NEW."classId", NEW."subjectId"
  ) THEN
    RAISE EXCEPTION 'Active teacher delegation requires current professional eligibility';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "TeacherDelegation_eligibility_guard"
  BEFORE INSERT OR UPDATE ON "TeacherDelegation"
  FOR EACH ROW EXECUTE FUNCTION "guard_teacher_delegation_eligibility"();

ALTER TABLE "ExternalAuthorityHandoff"
  ADD CONSTRAINT "ExternalAuthorityHandoff_snapshot_checksum" CHECK ("snapshotChecksumSha256" ~ '^[0-9a-fA-F]{64}$'),
  ADD CONSTRAINT "ExternalAuthorityHandoff_purpose" CHECK (NULLIF(btrim("purpose"), '') IS NOT NULL AND NULLIF(btrim("schemaAuthority"), '') IS NOT NULL),
  ADD CONSTRAINT "ExternalAuthorityHandoff_no_unverified_sync" CHECK (NOT "directSyncSupported" AND NOT "officialFormatVerified");

CREATE FUNCTION "guard_external_authority_handoff"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'External authority handoff history cannot be deleted'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF pg_trigger_depth() <> 2 OR
      (to_jsonb(NEW) - 'status' - 'exportedAt' - 'submittedAt' - 'acknowledgedAt' - 'externalReceiptReference')
        IS DISTINCT FROM
      (to_jsonb(OLD) - 'status' - 'exportedAt' - 'submittedAt' - 'acknowledgedAt' - 'externalReceiptReference') THEN
      RAISE EXCEPTION 'Handoff state changes require an append-only event';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."status" <> 'READY' OR NEW."exportedAt" IS NOT NULL OR NEW."submittedAt" IS NOT NULL
    OR NEW."acknowledgedAt" IS NOT NULL OR NEW."externalReceiptReference" IS NOT NULL THEN
    RAISE EXCEPTION 'Authority handoff must begin in READY state';
  END IF;
  IF (SELECT "tenantId" FROM "FileAsset" WHERE "id" = NEW."snapshotFileId" AND "softDeletedAt" IS NULL) IS DISTINCT FROM NEW."tenantId"
    OR (SELECT "tenantId" FROM "User" WHERE "id" = NEW."createdById" AND "status" = 'ACTIVE') IS DISTINCT FROM NEW."tenantId"
    OR (NEW."reportExportId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "ReportExport" r WHERE r."id" = NEW."reportExportId"
        AND r."tenantId" = NEW."tenantId" AND r."status" = 'COMPLETED'
        AND r."fileAssetId" = NEW."snapshotFileId" AND r."checksum" = NEW."snapshotChecksumSha256"
    )) THEN
    RAISE EXCEPTION 'Handoff snapshot, actor and completed export must belong to the tenant';
  END IF;
  IF NEW."supersedesId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "ExternalAuthorityHandoff" previous
      WHERE previous."id" = NEW."supersedesId"
        AND previous."tenantId" = NEW."tenantId"
        AND previous."authority" = NEW."authority"
        AND previous."status" IN ('REJECTED', 'CORRECTION_REQUIRED')
        AND previous."snapshotChecksumSha256" <> NEW."snapshotChecksumSha256"
  ) THEN RAISE EXCEPTION 'Corrected handoff must preserve lineage and use a new snapshot'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ExternalAuthorityHandoff_guard" BEFORE INSERT OR UPDATE OR DELETE ON "ExternalAuthorityHandoff"
  FOR EACH ROW EXECUTE FUNCTION "guard_external_authority_handoff"();

CREATE FUNCTION "apply_external_authority_event"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  prior "ExternalAuthorityHandoff"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'External authority events are append-only';
  END IF;
  SELECT * INTO prior FROM "ExternalAuthorityHandoff" WHERE "id" = NEW."handoffId" FOR UPDATE;
  IF NOT FOUND OR prior."tenantId" IS DISTINCT FROM NEW."tenantId"
    OR (SELECT "tenantId" FROM "User" WHERE "id" = NEW."actorId" AND "status" = 'ACTIVE') IS DISTINCT FROM NEW."tenantId"
    OR (NEW."evidenceFileId" IS NOT NULL AND
      (SELECT "tenantId" FROM "FileAsset" WHERE "id" = NEW."evidenceFileId" AND "softDeletedAt" IS NULL) IS DISTINCT FROM NEW."tenantId") THEN
    RAISE EXCEPTION 'Authority event actor and evidence must belong to the handoff tenant';
  END IF;
  IF (prior."status" = 'READY' AND NEW."status" <> 'EXPORTED')
    OR (prior."status" = 'EXPORTED' AND NEW."status" <> 'SUBMITTED')
    OR (prior."status" = 'SUBMITTED' AND NEW."status" NOT IN ('ACKNOWLEDGED', 'REJECTED', 'CORRECTION_REQUIRED'))
    OR (prior."status" IN ('ACKNOWLEDGED', 'REJECTED', 'CORRECTION_REQUIRED')) THEN
    RAISE EXCEPTION 'Invalid external authority handoff transition';
  END IF;
  IF NEW."status" IN ('SUBMITTED', 'ACKNOWLEDGED', 'REJECTED', 'CORRECTION_REQUIRED')
    AND NEW."evidenceFileId" IS NULL THEN
    RAISE EXCEPTION 'External submission and response states require evidence';
  END IF;
  IF NEW."status" = 'ACKNOWLEDGED' AND NULLIF(btrim(NEW."externalReceiptReference"), '') IS NULL THEN
    RAISE EXCEPTION 'External acknowledgement requires an authority receipt reference';
  END IF;
  IF NEW."status" IN ('REJECTED', 'CORRECTION_REQUIRED') AND NULLIF(btrim(NEW."note"), '') IS NULL THEN
    RAISE EXCEPTION 'External rejection or correction requires a reason';
  END IF;
  UPDATE "ExternalAuthorityHandoff" SET "status" = NEW."status",
    "exportedAt" = CASE WHEN NEW."status" = 'EXPORTED' THEN NEW."occurredAt" ELSE "exportedAt" END,
    "submittedAt" = CASE WHEN NEW."status" = 'SUBMITTED' THEN NEW."occurredAt" ELSE "submittedAt" END,
    "acknowledgedAt" = CASE WHEN NEW."status" = 'ACKNOWLEDGED' THEN NEW."occurredAt" ELSE "acknowledgedAt" END,
    "externalReceiptReference" = COALESCE(NEW."externalReceiptReference", "externalReceiptReference")
    WHERE "id" = NEW."handoffId";
  RETURN NEW;
END;
$$;
CREATE TRIGGER "ExternalAuthorityHandoffEvent_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "ExternalAuthorityHandoffEvent"
  FOR EACH ROW EXECUTE FUNCTION "apply_external_authority_event"();
