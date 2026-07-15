ALTER TABLE "NotificationDelivery"
ADD COLUMN "idempotencyKey" TEXT;

-- Existing rows keep a stable row-specific key so the forward migration is
-- safe even when historical imports contain semantic duplicates. New writes
-- use the canonical source/recipient/channel key in application code.
UPDATE "NotificationDelivery"
SET "idempotencyKey" = 'legacy:' || "id"
WHERE "idempotencyKey" IS NULL;

CREATE UNIQUE INDEX "NotificationDelivery_tenantId_idempotencyKey_key"
ON "NotificationDelivery"("tenantId", "idempotencyKey");
