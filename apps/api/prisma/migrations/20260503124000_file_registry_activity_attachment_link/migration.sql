-- File Registry / Activity Feed link stabilization
-- Keeps existing local pilot databases aligned with the current Prisma schema.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FileStatus') THEN
    CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'UPLOADED', 'FAILED', 'DELETED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "FileAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "originalFilename" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "module" TEXT,
    "entityId" TEXT,
    "status" "FileStatus" NOT NULL DEFAULT 'UPLOADED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "softDeletedAt" TIMESTAMP(3),

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FileAsset_objectKey_key" ON "FileAsset"("objectKey");
CREATE INDEX IF NOT EXISTS "FileAsset_tenantId_module_entityId_idx" ON "FileAsset"("tenantId", "module", "entityId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FileAsset_tenantId_fkey') THEN
    ALTER TABLE "FileAsset"
      ADD CONSTRAINT "FileAsset_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FileAsset_uploadedByUserId_fkey') THEN
    ALTER TABLE "FileAsset"
      ADD CONSTRAINT "FileAsset_uploadedByUserId_fkey"
      FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "ActivityAttachment"
  ADD COLUMN IF NOT EXISTS "fileAssetId" TEXT;

CREATE INDEX IF NOT EXISTS "ActivityAttachment_tenantId_activityPostId_fileAssetId_idx"
  ON "ActivityAttachment"("tenantId", "activityPostId", "fileAssetId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityAttachment_fileAssetId_fkey') THEN
    ALTER TABLE "ActivityAttachment"
      ADD CONSTRAINT "ActivityAttachment_fileAssetId_fkey"
      FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
