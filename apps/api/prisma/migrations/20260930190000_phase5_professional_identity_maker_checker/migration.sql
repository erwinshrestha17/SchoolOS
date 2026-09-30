-- Phase 5J/5L: professional identity maker-checker.
-- Employment and professional evidence record who submitted them so a
-- different person must verify, reject or revoke. Legacy rows (submitter
-- unknown) stay valid; every API-created row records its submitter.

ALTER TABLE "StaffEmployment" ADD COLUMN "submittedById" TEXT;
ALTER TABLE "TeacherQualificationEvidence" ADD COLUMN "submittedById" TEXT;
ALTER TABLE "TeachingLicenceEvidence" ADD COLUMN "submittedById" TEXT;

ALTER TABLE "StaffEmployment" ADD CONSTRAINT "StaffEmployment_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherQualificationEvidence" ADD CONSTRAINT "TeacherQualificationEvidence_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingLicenceEvidence" ADD CONSTRAINT "TeachingLicenceEvidence_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffEmployment" ADD CONSTRAINT "StaffEmployment_maker_checker"
  CHECK ("submittedById" IS NULL OR "verifiedById" IS NULL OR "submittedById" <> "verifiedById");
ALTER TABLE "TeacherQualificationEvidence" ADD CONSTRAINT "TeacherQualificationEvidence_maker_checker"
  CHECK ("submittedById" IS NULL OR "verifiedById" IS NULL OR "submittedById" <> "verifiedById");
ALTER TABLE "TeachingLicenceEvidence" ADD CONSTRAINT "TeachingLicenceEvidence_maker_checker"
  CHECK ("submittedById" IS NULL OR "verifiedById" IS NULL OR "submittedById" <> "verifiedById");

-- The submitter is part of the record's identity once written.
CREATE FUNCTION "guard_professional_submitter"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."submittedById" IS DISTINCT FROM OLD."submittedById" THEN
    RAISE EXCEPTION 'Professional record submitter is immutable';
  END IF;
  IF NEW."submittedById" IS NOT NULL AND
    (SELECT "tenantId" FROM "User" WHERE "id" = NEW."submittedById") IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'Professional record submitter must belong to the tenant';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "StaffEmployment_submitter_guard" BEFORE INSERT OR UPDATE ON "StaffEmployment"
  FOR EACH ROW EXECUTE FUNCTION "guard_professional_submitter"();
CREATE TRIGGER "TeacherQualificationEvidence_submitter_guard" BEFORE INSERT OR UPDATE ON "TeacherQualificationEvidence"
  FOR EACH ROW EXECUTE FUNCTION "guard_professional_submitter"();
CREATE TRIGGER "TeachingLicenceEvidence_submitter_guard" BEFORE INSERT OR UPDATE ON "TeachingLicenceEvidence"
  FOR EACH ROW EXECUTE FUNCTION "guard_professional_submitter"();

CREATE INDEX "StaffEmployment_submittedById_idx" ON "StaffEmployment"("submittedById");
CREATE INDEX "TeacherQualificationEvidence_submittedById_idx" ON "TeacherQualificationEvidence"("submittedById");
CREATE INDEX "TeachingLicenceEvidence_submittedById_idx" ON "TeachingLicenceEvidence"("submittedById");
