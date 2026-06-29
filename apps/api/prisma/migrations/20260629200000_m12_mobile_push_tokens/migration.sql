CREATE TABLE "MobilePushToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenEncrypted" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "deviceModel" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobilePushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobilePushToken_tenantId_tokenHash_key"
ON "MobilePushToken"("tenantId", "tokenHash");

CREATE UNIQUE INDEX "MobilePushToken_tenantId_userId_installationId_key"
ON "MobilePushToken"("tenantId", "userId", "installationId");

CREATE INDEX "MobilePushToken_tenantId_userId_lastSeenAt_idx"
ON "MobilePushToken"("tenantId", "userId", "lastSeenAt");

ALTER TABLE "MobilePushToken"
ADD CONSTRAINT "MobilePushToken_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MobilePushToken"
ADD CONSTRAINT "MobilePushToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
