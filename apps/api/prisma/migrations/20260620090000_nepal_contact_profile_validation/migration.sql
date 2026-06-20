DROP INDEX IF EXISTS "Guardian_tenantId_primaryPhone_key";
CREATE INDEX "Guardian_tenantId_primaryPhone_idx" ON "Guardian"("tenantId", "primaryPhone");

ALTER TABLE "Student"
  ALTER COLUMN "dateOfBirth" TYPE DATE USING "dateOfBirth"::date;

ALTER TABLE "Staff"
  ALTER COLUMN "dateOfBirth" TYPE DATE USING "dateOfBirth"::date;

ALTER TABLE "AdmissionApplication"
  ALTER COLUMN "dateOfBirth" TYPE DATE USING "dateOfBirth"::date;
