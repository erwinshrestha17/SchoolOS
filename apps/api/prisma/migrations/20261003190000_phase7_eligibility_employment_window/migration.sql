-- Phase 7.10: an authoritative employment is VERIFIED (current) or ENDED
-- (historical) with a recorded verification. Ending an employment sets its
-- effectiveTo, so a teacher stays eligible through the half-open window
-- [effectiveFrom, effectiveTo) and stops at its end — not at the moment the
-- row flips to ENDED. PENDING and REJECTED rows remain non-authoritative.
-- Same signature and body as the foundation function; only the employment
-- predicate changes.
CREATE OR REPLACE FUNCTION "schoolos_teacher_eligibility_live"(
  tenant_id TEXT, staff_id TEXT, assessment_id TEXT, at_time TIMESTAMPTZ,
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
  canonical_time TIMESTAMP;
  current_policy_id TEXT;
  policy_scope_rank INT;
  policy_specificity INT;
BEGIN
  canonical_time := at_time AT TIME ZONE 'UTC';
  SELECT * INTO a FROM "TeacherEligibilityAssessment"
    WHERE "id" = assessment_id AND "tenantId" = tenant_id AND "staffId" = staff_id
      AND "outcome" = 'ELIGIBLE' AND "evaluatedAt" <= canonical_time
      AND ("validUntil" IS NULL OR "validUntil" > canonical_time);
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT * INTO e FROM "StaffEmployment" WHERE "id" = a."employmentId"
    AND "tenantId" = tenant_id AND "staffId" = staff_id AND "status" IN ('VERIFIED', 'ENDED') AND "verifiedAt" IS NOT NULL
    AND "effectiveFrom" <= canonical_time AND ("effectiveTo" IS NULL OR "effectiveTo" > canonical_time);
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM "Staff" s WHERE s."id" = staff_id AND s."tenantId" = tenant_id
      AND s."status" = 'ACTIVE' AND s."joiningDate" <= canonical_time
  ) THEN RETURN FALSE; END IF;
  SELECT * INTO t FROM "TeacherProfile" WHERE "id" = a."profileId"
    AND "tenantId" = tenant_id AND "staffId" = staff_id AND "status" = 'ACTIVE'
    AND "effectiveFrom" <= canonical_time AND ("effectiveTo" IS NULL OR "effectiveTo" > canonical_time);
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT * INTO p FROM "NepalHrPolicyVersion" WHERE "id" = a."policyVersionId"
    AND "kind" = 'TEACHER_PROFESSIONAL_ELIGIBILITY' AND "reviewStatus" = 'APPROVED'
    AND "effectiveFrom" <= canonical_time AND ("effectiveTo" IS NULL OR "effectiveTo" > canonical_time)
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
        AND newer."effectiveFrom" <= canonical_time
        AND (newer."effectiveTo" IS NULL OR newer."effectiveTo" > canonical_time)
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

  -- An assessment is authoritative only while its selected policy remains
  -- the current most-specific reviewed policy for this teacher and resource.
  -- A new school/local policy with a different lineage must not leave an old
  -- national assessment live merely because the original policy is unchanged.
  policy_scope_rank := CASE p."scope"
    WHEN 'SCHOOL' THEN 4 WHEN 'LOCAL_LEVEL' THEN 3 WHEN 'DISTRICT' THEN 2
    WHEN 'PROVINCE' THEN 1 ELSE 0 END;
  policy_specificity := (p."schoolTypeCode" IS NOT NULL)::INT
    + (p."employmentType" IS NOT NULL)::INT
    + (p."postCategoryCode" IS NOT NULL)::INT
    + (p."classLevelMin" IS NOT NULL OR p."classLevelMax" IS NOT NULL)::INT
    + (p."subjectCode" IS NOT NULL)::INT;
  SELECT latest."id" INTO current_policy_id FROM (
    SELECT DISTINCT ON (candidate."policyKey") candidate.*
      FROM "NepalHrPolicyVersion" candidate
      WHERE candidate."kind" = 'TEACHER_PROFESSIONAL_ELIGIBILITY'
        AND candidate."reviewStatus" = 'APPROVED'
        AND candidate."effectiveFrom" <= canonical_time
        AND (candidate."effectiveTo" IS NULL OR candidate."effectiveTo" > canonical_time)
        AND (candidate."scope" = 'NATIONAL'
          OR candidate."scope" = 'PROVINCE' AND candidate."provinceId" = province_id
          OR candidate."scope" = 'DISTRICT' AND candidate."districtId" = district_id
          OR candidate."scope" = 'LOCAL_LEVEL' AND candidate."localLevelId" = e."localLevelId"
          OR candidate."scope" = 'SCHOOL' AND candidate."tenantId" = tenant_id
            AND candidate."localLevelId" IS NOT DISTINCT FROM e."localLevelId")
        AND (candidate."schoolTypeCode" IS NULL OR candidate."schoolTypeCode" = e."schoolTypeCode")
        AND (candidate."employmentType" IS NULL OR candidate."employmentType" = e."employmentType")
        AND (candidate."postCategoryCode" IS NULL OR candidate."postCategoryCode" = e."postCategoryCode")
        AND (candidate."classLevelMin" IS NULL OR class_level >= candidate."classLevelMin")
        AND (candidate."classLevelMax" IS NULL OR class_level <= candidate."classLevelMax")
        AND (candidate."subjectCode" IS NULL OR candidate."subjectCode" = subject_code)
      ORDER BY candidate."policyKey", candidate."effectiveFrom" DESC, candidate."version" DESC
  ) latest
  ORDER BY CASE latest."scope"
      WHEN 'SCHOOL' THEN 4 WHEN 'LOCAL_LEVEL' THEN 3 WHEN 'DISTRICT' THEN 2
      WHEN 'PROVINCE' THEN 1 ELSE 0 END DESC,
    ((latest."schoolTypeCode" IS NOT NULL)::INT
      + (latest."employmentType" IS NOT NULL)::INT
      + (latest."postCategoryCode" IS NOT NULL)::INT
      + (latest."classLevelMin" IS NOT NULL OR latest."classLevelMax" IS NOT NULL)::INT
      + (latest."subjectCode" IS NOT NULL)::INT) DESC,
    latest."effectiveFrom" DESC, latest."version" DESC, latest."id" DESC
  LIMIT 1;
  IF current_policy_id IS DISTINCT FROM p."id" THEN RETURN FALSE; END IF;
  IF EXISTS (
    SELECT 1 FROM "NepalHrPolicyVersion" competing
      WHERE competing."id" <> p."id" AND competing."policyKey" <> p."policyKey"
        AND competing."kind" = 'TEACHER_PROFESSIONAL_ELIGIBILITY'
        AND competing."reviewStatus" = 'APPROVED'
        AND competing."effectiveFrom" = p."effectiveFrom"
        AND (competing."effectiveTo" IS NULL OR competing."effectiveTo" > canonical_time)
        AND (CASE competing."scope"
          WHEN 'SCHOOL' THEN 4 WHEN 'LOCAL_LEVEL' THEN 3 WHEN 'DISTRICT' THEN 2
          WHEN 'PROVINCE' THEN 1 ELSE 0 END) = policy_scope_rank
        AND ((competing."schoolTypeCode" IS NOT NULL)::INT
          + (competing."employmentType" IS NOT NULL)::INT
          + (competing."postCategoryCode" IS NOT NULL)::INT
          + (competing."classLevelMin" IS NOT NULL OR competing."classLevelMax" IS NOT NULL)::INT
          + (competing."subjectCode" IS NOT NULL)::INT) = policy_specificity
        AND (competing."scope" = 'NATIONAL'
          OR competing."scope" = 'PROVINCE' AND competing."provinceId" = province_id
          OR competing."scope" = 'DISTRICT' AND competing."districtId" = district_id
          OR competing."scope" = 'LOCAL_LEVEL' AND competing."localLevelId" = e."localLevelId"
          OR competing."scope" = 'SCHOOL' AND competing."tenantId" = tenant_id
            AND competing."localLevelId" IS NOT DISTINCT FROM e."localLevelId")
        AND (competing."schoolTypeCode" IS NULL OR competing."schoolTypeCode" = e."schoolTypeCode")
        AND (competing."employmentType" IS NULL OR competing."employmentType" = e."employmentType")
        AND (competing."postCategoryCode" IS NULL OR competing."postCategoryCode" = e."postCategoryCode")
        AND (competing."classLevelMin" IS NULL OR class_level >= competing."classLevelMin")
        AND (competing."classLevelMax" IS NULL OR class_level <= competing."classLevelMax")
        AND (competing."subjectCode" IS NULL OR competing."subjectCode" = subject_code)
        AND NOT EXISTS (SELECT 1 FROM "NepalHrPolicyVersion" revision
          WHERE revision."policyKey" = competing."policyKey"
            AND revision."reviewStatus" = 'APPROVED'
            AND revision."effectiveFrom" > competing."effectiveFrom"
            AND revision."effectiveFrom" <= canonical_time
            AND (revision."effectiveTo" IS NULL OR revision."effectiveTo" > canonical_time))
  ) THEN RETURN FALSE; END IF;

  IF (p."requiresQualification" OR EXISTS (
    SELECT 1 FROM "NepalHrPolicyVersion" mandatory
      WHERE mandatory."kind" = 'TEACHER_PROFESSIONAL_ELIGIBILITY'
        AND mandatory."isMandatoryBaseline" AND mandatory."reviewStatus" = 'APPROVED'
        AND mandatory."effectiveFrom" <= canonical_time
        AND (mandatory."effectiveTo" IS NULL OR mandatory."effectiveTo" > canonical_time)
        AND NOT EXISTS (SELECT 1 FROM "NepalHrPolicyVersion" newer
          WHERE newer."policyKey" = mandatory."policyKey" AND newer."reviewStatus" = 'APPROVED'
            AND newer."effectiveFrom" > mandatory."effectiveFrom"
            AND newer."effectiveFrom" <= canonical_time
            AND (newer."effectiveTo" IS NULL OR newer."effectiveTo" > canonical_time))
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
        AND q."validFrom" <= canonical_time AND (q."validUntil" IS NULL OR q."validUntil" > canonical_time)
        AND (q."subjectCode" IS NULL OR q."subjectCode" = subject_code)
        AND (q."levelCode" IS NULL OR q."levelCode" = class_level::TEXT)
  ) THEN RETURN FALSE; END IF;
  IF (p."requiresLicence" OR EXISTS (
    SELECT 1 FROM "NepalHrPolicyVersion" mandatory
      WHERE mandatory."kind" = 'TEACHER_PROFESSIONAL_ELIGIBILITY'
        AND mandatory."isMandatoryBaseline" AND mandatory."reviewStatus" = 'APPROVED'
        AND mandatory."effectiveFrom" <= canonical_time
        AND (mandatory."effectiveTo" IS NULL OR mandatory."effectiveTo" > canonical_time)
        AND NOT EXISTS (SELECT 1 FROM "NepalHrPolicyVersion" newer
          WHERE newer."policyKey" = mandatory."policyKey" AND newer."reviewStatus" = 'APPROVED'
            AND newer."effectiveFrom" > mandatory."effectiveFrom"
            AND newer."effectiveFrom" <= canonical_time
            AND (newer."effectiveTo" IS NULL OR newer."effectiveTo" > canonical_time))
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
        AND l."validFrom" <= canonical_time AND (l."validUntil" IS NULL OR l."validUntil" > canonical_time)
        AND (l."subjectCode" IS NULL OR l."subjectCode" = subject_code)
        AND (l."levelCode" IS NULL OR l."levelCode" = class_level::TEXT)
  ) THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$;

-- The immutable-decision guard validates an ELIGIBLE insert against the same
-- authoritative-employment definition (verified or ended inside its window).
CREATE OR REPLACE FUNCTION "guard_teacher_eligibility_assessment"() RETURNS trigger LANGUAGE plpgsql AS $$
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
      WHERE e."id" = NEW."employmentId" AND e."status" IN ('VERIFIED', 'ENDED') AND e."verifiedAt" IS NOT NULL
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
