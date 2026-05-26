-- File Registry metadata hardening for provider-neutral signed access.
CREATE TYPE "FileVisibility" AS ENUM ('PRIVATE', 'TENANT', 'OWNER');

ALTER TABLE "FileAsset"
  ADD COLUMN "storageProvider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN "bucket" TEXT,
  ADD COLUMN "checksumSha256" TEXT,
  ADD COLUMN "ownerType" TEXT,
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "visibility" "FileVisibility" NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "FileAsset"
SET
  "ownerType" = COALESCE("module", 'file_registry'),
  "ownerId" = "entityId",
  "deletedAt" = "softDeletedAt"
WHERE "ownerType" IS NULL;

CREATE INDEX "FileAsset_tenantId_ownerType_ownerId_idx"
  ON "FileAsset"("tenantId", "ownerType", "ownerId");

CREATE INDEX "FileAsset_tenantId_storageProvider_idx"
  ON "FileAsset"("tenantId", "storageProvider");

CREATE INDEX "FileAsset_tenantId_visibility_idx"
  ON "FileAsset"("tenantId", "visibility");
