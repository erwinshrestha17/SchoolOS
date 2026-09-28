-- CreateEnum
CREATE TYPE "NepalEducationPolicyKind" AS ENUM ('JURISDICTION_PROFILE', 'SCHOOL_RECOGNITION', 'CURRICULUM', 'GRADING_ASSESSMENT', 'PROMOTION_REPORT_CARD', 'ACADEMIC_CALENDAR', 'GOVERNMENT_REPORTING');

-- CreateEnum
CREATE TYPE "NepalEducationPolicyScope" AS ENUM ('NATIONAL', 'PROVINCE', 'DISTRICT', 'LOCAL_LEVEL', 'SCHOOL');

-- CreateEnum
CREATE TYPE "NepalEducationPolicyReviewStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'REVIEWED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "NepalEducationPolicyVersion" (
    "id" TEXT NOT NULL,
    "policyKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" "NepalEducationPolicyKind" NOT NULL,
    "scope" "NepalEducationPolicyScope" NOT NULL,
    "tenantId" TEXT,
    "provinceId" INTEGER,
    "districtId" INTEGER,
    "localLevelId" INTEGER,
    "schoolTypeCode" TEXT,
    "recognitionAuthority" TEXT,
    "recognitionReference" TEXT,
    "isMandatoryBaseline" BOOLEAN NOT NULL DEFAULT false,
    "payloadSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "reviewStatus" "NepalEducationPolicyReviewStatus" NOT NULL DEFAULT 'DRAFT',
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

    CONSTRAINT "NepalEducationPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NepalEducationPolicyVersion_supersedesId_key" ON "NepalEducationPolicyVersion"("supersedesId");

-- CreateIndex
CREATE INDEX "NepalEducationPolicyVersion_kind_scope_reviewStatus_effecti_idx" ON "NepalEducationPolicyVersion"("kind", "scope", "reviewStatus", "effectiveFrom");

-- CreateIndex
CREATE INDEX "NepalEducationPolicyVersion_tenantId_kind_reviewStatus_effe_idx" ON "NepalEducationPolicyVersion"("tenantId", "kind", "reviewStatus", "effectiveFrom");

-- CreateIndex
CREATE INDEX "NepalEducationPolicyVersion_localLevelId_kind_reviewStatus__idx" ON "NepalEducationPolicyVersion"("localLevelId", "kind", "reviewStatus", "effectiveFrom");

-- CreateIndex
CREATE INDEX "NepalEducationPolicyVersion_policyKey_reviewStatus_effectiv_idx" ON "NepalEducationPolicyVersion"("policyKey", "reviewStatus", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "NepalEducationPolicyVersion_policyKey_version_key" ON "NepalEducationPolicyVersion"("policyKey", "version");

-- AddForeignKey
ALTER TABLE "NepalEducationPolicyVersion" ADD CONSTRAINT "NepalEducationPolicyVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NepalEducationPolicyVersion" ADD CONSTRAINT "NepalEducationPolicyVersion_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "NepalProvince"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NepalEducationPolicyVersion" ADD CONSTRAINT "NepalEducationPolicyVersion_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "NepalDistrict"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NepalEducationPolicyVersion" ADD CONSTRAINT "NepalEducationPolicyVersion_localLevelId_fkey" FOREIGN KEY ("localLevelId") REFERENCES "NepalLocalLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NepalEducationPolicyVersion" ADD CONSTRAINT "NepalEducationPolicyVersion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NepalEducationPolicyVersion" ADD CONSTRAINT "NepalEducationPolicyVersion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NepalEducationPolicyVersion" ADD CONSTRAINT "NepalEducationPolicyVersion_evidenceFileAssetId_fkey" FOREIGN KEY ("evidenceFileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NepalEducationPolicyVersion" ADD CONSTRAINT "NepalEducationPolicyVersion_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "NepalEducationPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A policy cannot be approved without independent review and source evidence.
-- These checks apply to direct database writes as well as future API workflows.
ALTER TABLE "NepalEducationPolicyVersion"
  ADD CONSTRAINT "NepalEducationPolicyVersion_valid_version"
    CHECK ("version" > 0 AND "payloadSchemaVersion" > 0),
  ADD CONSTRAINT "NepalEducationPolicyVersion_valid_dates"
    CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
  ADD CONSTRAINT "NepalEducationPolicyVersion_valid_payload"
    CHECK (jsonb_typeof("payload") = 'object'),
  ADD CONSTRAINT "NepalEducationPolicyVersion_nonblank_source"
    CHECK (btrim("policyKey") <> '' AND btrim("sourceTitle") <> ''),
  ADD CONSTRAINT "NepalEducationPolicyVersion_checksum_format"
    CHECK ("sourceChecksumSha256" IS NULL OR "sourceChecksumSha256" ~ '^[0-9a-fA-F]{64}$'),
  ADD CONSTRAINT "NepalEducationPolicyVersion_valid_lineage"
    CHECK (("version" = 1 AND "supersedesId" IS NULL)
      OR ("version" > 1 AND "supersedesId" IS NOT NULL)),
  ADD CONSTRAINT "NepalEducationPolicyVersion_scope_identity"
    CHECK (
      ("scope" = 'NATIONAL' AND "tenantId" IS NULL AND "provinceId" IS NULL AND "districtId" IS NULL AND "localLevelId" IS NULL)
      OR ("scope" = 'PROVINCE' AND "tenantId" IS NULL AND "provinceId" IS NOT NULL AND "districtId" IS NULL AND "localLevelId" IS NULL)
      OR ("scope" = 'DISTRICT' AND "tenantId" IS NULL AND "provinceId" IS NULL AND "districtId" IS NOT NULL AND "localLevelId" IS NULL)
      OR ("scope" = 'LOCAL_LEVEL' AND "tenantId" IS NULL AND "provinceId" IS NULL AND "districtId" IS NULL AND "localLevelId" IS NOT NULL)
      OR ("scope" = 'SCHOOL' AND "tenantId" IS NOT NULL AND "provinceId" IS NULL AND "districtId" IS NULL)
    ),
  ADD CONSTRAINT "NepalEducationPolicyVersion_external_baseline"
    CHECK (NOT "isMandatoryBaseline" OR "scope" <> 'SCHOOL'),
  ADD CONSTRAINT "NepalEducationPolicyVersion_review_evidence"
    CHECK (
      ("reviewStatus" IN ('DRAFT', 'IN_REVIEW') AND "reviewedById" IS NULL AND "reviewedAt" IS NULL AND "approvedById" IS NULL AND "approvedAt" IS NULL)
      OR ("reviewStatus" = 'REVIEWED' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "approvedById" IS NULL AND "approvedAt" IS NULL)
      OR ("reviewStatus" = 'REJECTED' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "approvedById" IS NULL AND "approvedAt" IS NULL AND NULLIF(btrim("reviewNote"), '') IS NOT NULL)
      OR ("reviewStatus" = 'APPROVED' AND "reviewedById" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL AND "approvedAt" >= "reviewedAt" AND "approvedById" <> "reviewedById" AND (NULLIF(btrim("sourceUri"), '') IS NOT NULL OR "evidenceFileAssetId" IS NOT NULL))
    ),
  ADD CONSTRAINT "NepalEducationPolicyVersion_recognition_context"
    CHECK ("kind" <> 'SCHOOL_RECOGNITION' OR "scope" <> 'SCHOOL' OR "reviewStatus" <> 'APPROVED'
      OR (NULLIF(btrim("schoolTypeCode"), '') IS NOT NULL AND NULLIF(btrim("recognitionAuthority"), '') IS NOT NULL AND NULLIF(btrim("recognitionReference"), '') IS NOT NULL));

-- The same policy lineage cannot approve two alternatives for one start date.
CREATE UNIQUE INDEX "NepalEducationPolicyVersion_one_approved_start"
  ON "NepalEducationPolicyVersion" ("policyKey", "effectiveFrom")
  WHERE "reviewStatus" = 'APPROVED';

CREATE FUNCTION "guard_nepal_education_policy_version"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  previous "NepalEducationPolicyVersion"%ROWTYPE;
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
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Education policy versions cannot be deleted; preserve review history';
  END IF;

  IF TG_OP = 'INSERT' AND NEW."reviewStatus" <> 'DRAFT' THEN
    RAISE EXCEPTION 'Education policy versions must start as drafts';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."reviewStatus" IN ('APPROVED', 'REJECTED') THEN
      RAISE EXCEPTION 'Approved or rejected education policy history is immutable';
    END IF;
    IF OLD."reviewStatus" = 'REVIEWED' THEN
      IF NEW."reviewStatus" NOT IN ('APPROVED', 'REJECTED')
        OR (to_jsonb(NEW) - 'reviewStatus' - 'approvedById' - 'approvedAt')
           IS DISTINCT FROM (to_jsonb(OLD) - 'reviewStatus' - 'approvedById' - 'approvedAt') THEN
        RAISE EXCEPTION 'Reviewed education policy content cannot change';
      END IF;
    END IF;
    IF OLD."reviewStatus" = 'DRAFT' AND NEW."reviewStatus" NOT IN ('DRAFT', 'IN_REVIEW') THEN
      RAISE EXCEPTION 'Education policy draft must enter review';
    END IF;
    IF OLD."reviewStatus" = 'IN_REVIEW' AND NEW."reviewStatus" NOT IN ('DRAFT', 'IN_REVIEW', 'REVIEWED', 'REJECTED') THEN
      RAISE EXCEPTION 'Education policy requires review before approval';
    END IF;
  END IF;

  IF NEW."supersedesId" IS NOT NULL THEN
    SELECT * INTO previous FROM "NepalEducationPolicyVersion" WHERE "id" = NEW."supersedesId";
    IF NOT FOUND OR previous."policyKey" IS DISTINCT FROM NEW."policyKey"
      OR previous."kind" IS DISTINCT FROM NEW."kind"
      OR previous."scope" IS DISTINCT FROM NEW."scope"
      OR previous."tenantId" IS DISTINCT FROM NEW."tenantId"
      OR previous."provinceId" IS DISTINCT FROM NEW."provinceId"
      OR previous."districtId" IS DISTINCT FROM NEW."districtId"
      OR previous."localLevelId" IS DISTINCT FROM NEW."localLevelId"
      OR previous."schoolTypeCode" IS DISTINCT FROM NEW."schoolTypeCode"
      OR previous."reviewStatus" NOT IN ('APPROVED', 'REJECTED')
      OR previous."version" + 1 <> NEW."version"
      OR previous."effectiveFrom" >= NEW."effectiveFrom" THEN
      RAISE EXCEPTION 'Education policy supersession must continue the same scope and increasing version/date';
    END IF;
  END IF;

  IF NEW."evidenceFileAssetId" IS NOT NULL THEN
    SELECT f."tenantId", t."securityDomain" INTO evidence_tenant_id, evidence_domain
      FROM "FileAsset" f JOIN "Tenant" t ON t."id" = f."tenantId"
      WHERE f."id" = NEW."evidenceFileAssetId";
    IF NOT FOUND OR (NEW."scope" = 'SCHOOL' AND evidence_tenant_id IS DISTINCT FROM NEW."tenantId")
      OR (NEW."scope" <> 'SCHOOL' AND evidence_domain <> 'PLATFORM') THEN
      RAISE EXCEPTION 'Education policy evidence must belong to the school or Platform authority';
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
      RAISE EXCEPTION 'Education policy reviewer belongs to the wrong authority domain';
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
      RAISE EXCEPTION 'Education policy approver belongs to the wrong authority domain';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "NepalEducationPolicyVersion_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "NepalEducationPolicyVersion"
  FOR EACH ROW EXECUTE FUNCTION "guard_nepal_education_policy_version"();
