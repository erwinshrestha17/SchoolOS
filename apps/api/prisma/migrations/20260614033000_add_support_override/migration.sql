-- Add support override backing table for platform tenant override sessions.

CREATE TABLE IF NOT EXISTS "SupportOverride" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "platformUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportOverride_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupportOverride_tenantId_isActive_idx" ON "SupportOverride"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "SupportOverride_platformUserId_isActive_idx" ON "SupportOverride"("platformUserId", "isActive");
CREATE INDEX IF NOT EXISTS "SupportOverride_expiresAt_idx" ON "SupportOverride"("expiresAt");

ALTER TABLE "SupportOverride"
  ADD CONSTRAINT "SupportOverride_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportOverride"
  ADD CONSTRAINT "SupportOverride_platformUserId_fkey"
  FOREIGN KEY ("platformUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
