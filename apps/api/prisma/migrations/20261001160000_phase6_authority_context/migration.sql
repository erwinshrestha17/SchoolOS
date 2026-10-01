-- Phase 6.0b — Historical authority context on authoritative teaching writes.
--
-- An attendance submission and a marks SUBMIT/RESUBMIT now record which
-- assignment (or substitution delegation) and which immutable professional
-- eligibility assessment authorized them. Assessments reference their
-- NepalHrPolicyVersion, so a later re-assessment or policy version change
-- never rewrites the context in which a historical record was made.
-- Nullable: legacy rows and school-administrator writes carry no grant.

-- AlterTable
ALTER TABLE "AttendanceSession" ADD COLUMN     "submittedAssignmentId" TEXT,
ADD COLUMN     "submittedDelegationId" TEXT,
ADD COLUMN     "submittedEligibilityAssessmentId" TEXT;

-- AlterTable
ALTER TABLE "MarkSheetTransition" ADD COLUMN     "assignmentId" TEXT,
ADD COLUMN     "eligibilityAssessmentId" TEXT;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_submittedEligibilityAssessmentId_fkey" FOREIGN KEY ("submittedEligibilityAssessmentId") REFERENCES "TeacherEligibilityAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarkSheetTransition" ADD CONSTRAINT "MarkSheetTransition_eligibilityAssessmentId_fkey" FOREIGN KEY ("eligibilityAssessmentId") REFERENCES "TeacherEligibilityAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defence in depth: a referenced assessment always belongs to the same school.
CREATE OR REPLACE FUNCTION schoolos_authority_context_tenant_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  assessment_id text;
BEGIN
  IF TG_TABLE_NAME = 'AttendanceSession' THEN
    assessment_id := NEW."submittedEligibilityAssessmentId";
  ELSE
    assessment_id := NEW."eligibilityAssessmentId";
  END IF;
  IF assessment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "TeacherEligibilityAssessment" a
    WHERE a.id = assessment_id AND a."tenantId" = NEW."tenantId"
  ) THEN
    RAISE EXCEPTION 'Eligibility assessment % is not in tenant %', assessment_id, NEW."tenantId"
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "AttendanceSession_authority_context_tenant_guard"
  BEFORE INSERT OR UPDATE OF "submittedEligibilityAssessmentId", "tenantId"
  ON "AttendanceSession"
  FOR EACH ROW EXECUTE FUNCTION schoolos_authority_context_tenant_guard();

CREATE TRIGGER "MarkSheetTransition_authority_context_tenant_guard"
  BEFORE INSERT OR UPDATE OF "eligibilityAssessmentId", "tenantId"
  ON "MarkSheetTransition"
  FOR EACH ROW EXECUTE FUNCTION schoolos_authority_context_tenant_guard();
