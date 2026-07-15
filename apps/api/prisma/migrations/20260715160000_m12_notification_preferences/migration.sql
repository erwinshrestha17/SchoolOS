CREATE TYPE "NotificationPreferenceCategory" AS ENUM (
  'GENERAL',
  'ATTENDANCE',
  'FEES',
  'NOTICE',
  'SECURITY',
  'EMERGENCY'
);

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" "NotificationPreferenceCategory" NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "quietHoursEnabled" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationPreference_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NotificationPreference_tenantId_userId_category_channel_key"
ON "NotificationPreference"("tenantId", "userId", "category", "channel");

CREATE INDEX "NotificationPreference_tenantId_userId_updatedAt_idx"
ON "NotificationPreference"("tenantId", "userId", "updatedAt");
