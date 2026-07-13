ALTER TABLE "ActivityAttachment"
ADD COLUMN "thumbnailFileAssetId" TEXT;

CREATE INDEX "ActivityAttachment_thumbnailFileAssetId_idx"
ON "ActivityAttachment"("thumbnailFileAssetId");

ALTER TABLE "ActivityAttachment"
ADD CONSTRAINT "ActivityAttachment_thumbnailFileAssetId_fkey"
FOREIGN KEY ("thumbnailFileAssetId") REFERENCES "FileAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
