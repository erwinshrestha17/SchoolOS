-- M0 Platform Core: tenant-scoped platform API key management.
CREATE TYPE "PlatformApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "PlatformApiKey" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "keySuffix" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "PlatformApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  "revokeReason" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformApiKey_prefix_key" ON "PlatformApiKey"("prefix");
CREATE UNIQUE INDEX "PlatformApiKey_keyHash_key" ON "PlatformApiKey"("keyHash");
CREATE INDEX "PlatformApiKey_tenantId_status_idx" ON "PlatformApiKey"("tenantId", "status");
CREATE INDEX "PlatformApiKey_tenantId_createdAt_idx" ON "PlatformApiKey"("tenantId", "createdAt");
CREATE INDEX "PlatformApiKey_expiresAt_idx" ON "PlatformApiKey"("expiresAt");

ALTER TABLE "PlatformApiKey"
  ADD CONSTRAINT "PlatformApiKey_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
