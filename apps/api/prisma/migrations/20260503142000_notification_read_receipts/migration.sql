-- Notification Center read tracking
-- Keeps read/unread state per authenticated user without mutating delivery records.

CREATE TABLE IF NOT EXISTS "NotificationReadReceipt" (
  "tenantId" TEXT NOT NULL,
  "notificationDeliveryId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationReadReceipt_pkey"
    PRIMARY KEY ("tenantId", "notificationDeliveryId", "userId")
);

CREATE INDEX IF NOT EXISTS "NotificationReadReceipt_tenantId_userId_readAt_idx"
  ON "NotificationReadReceipt"("tenantId", "userId", "readAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationReadReceipt_tenantId_fkey') THEN
    ALTER TABLE "NotificationReadReceipt"
      ADD CONSTRAINT "NotificationReadReceipt_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationReadReceipt_notificationDeliveryId_fkey') THEN
    ALTER TABLE "NotificationReadReceipt"
      ADD CONSTRAINT "NotificationReadReceipt_notificationDeliveryId_fkey"
      FOREIGN KEY ("notificationDeliveryId") REFERENCES "NotificationDelivery"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationReadReceipt_userId_fkey') THEN
    ALTER TABLE "NotificationReadReceipt"
      ADD CONSTRAINT "NotificationReadReceipt_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
