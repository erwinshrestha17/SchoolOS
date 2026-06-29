ALTER TABLE "ActivityPost"
  ADD COLUMN "clientSubmissionId" TEXT;

CREATE UNIQUE INDEX "ActivityPost_tenantId_createdById_clientSubmissionId_key"
  ON "ActivityPost"("tenantId", "createdById", "clientSubmissionId");
