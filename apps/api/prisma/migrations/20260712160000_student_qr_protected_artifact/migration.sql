ALTER TABLE "StudentQrCredential"
ADD COLUMN "fileAssetId" TEXT;

CREATE UNIQUE INDEX "StudentQrCredential_fileAssetId_key"
ON "StudentQrCredential"("fileAssetId");

CREATE UNIQUE INDEX "StudentQrCredential_one_active_per_student"
ON "StudentQrCredential"("tenantId", "studentId")
WHERE "status" = 'ACTIVE';
