-- M0 platform webhook registry and delivery history foundation.
ALTER TYPE "TenantSubscriptionStatus" ADD VALUE IF NOT EXISTS 'OVERDUE';

CREATE TYPE "PlatformWebhookEndpointStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "PlatformWebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'RETRYING');

CREATE TABLE "PlatformWebhookEndpoint" (
  "id" TEXT NOT NULL,
  "ownerType" TEXT NOT NULL,
  "tenantId" TEXT,
  "url" TEXT NOT NULL,
  "signingSecretHash" TEXT NOT NULL,
  "eventTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "PlatformWebhookEndpointStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT,
  "disabledAt" TIMESTAMP(3),
  "disabledBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformWebhookDelivery" (
  "id" TEXT NOT NULL,
  "endpointId" TEXT NOT NULL,
  "tenantId" TEXT,
  "eventType" TEXT NOT NULL,
  "payloadChecksum" TEXT NOT NULL,
  "status" "PlatformWebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "responseCode" INTEGER,
  "responseMessageSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),

  CONSTRAINT "PlatformWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformWebhookEndpoint_tenantId_status_idx"
  ON "PlatformWebhookEndpoint"("tenantId", "status");

CREATE INDEX "PlatformWebhookEndpoint_ownerType_status_idx"
  ON "PlatformWebhookEndpoint"("ownerType", "status");

CREATE INDEX "PlatformWebhookDelivery_endpointId_createdAt_idx"
  ON "PlatformWebhookDelivery"("endpointId", "createdAt");

CREATE INDEX "PlatformWebhookDelivery_tenantId_eventType_createdAt_idx"
  ON "PlatformWebhookDelivery"("tenantId", "eventType", "createdAt");

CREATE INDEX "PlatformWebhookDelivery_status_createdAt_idx"
  ON "PlatformWebhookDelivery"("status", "createdAt");

ALTER TABLE "PlatformWebhookEndpoint"
  ADD CONSTRAINT "PlatformWebhookEndpoint_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlatformWebhookDelivery"
  ADD CONSTRAINT "PlatformWebhookDelivery_endpointId_fkey"
  FOREIGN KEY ("endpointId") REFERENCES "PlatformWebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlatformWebhookDelivery"
  ADD CONSTRAINT "PlatformWebhookDelivery_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
