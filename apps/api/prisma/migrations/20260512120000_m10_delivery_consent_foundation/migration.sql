-- Align active Prisma schema with the existing M10 communications hardening service.

ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'RETRY_PENDING';
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TABLE IF NOT EXISTS "NoticeReadReceipt" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" text NOT NULL,
  "noticeId" text NOT NULL,
  "userId" text NOT NULL,
  "recipientUserId" text,
  "guardianId" text,
  "studentId" text,
  "readAt" timestamp NOT NULL DEFAULT now(),
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "NoticeReadReceipt_tenantId_noticeId_userId_key"
ON "NoticeReadReceipt"("tenantId", "noticeId", "userId");

CREATE INDEX IF NOT EXISTS "NoticeReadReceipt_tenantId_noticeId_readAt_idx"
ON "NoticeReadReceipt"("tenantId", "noticeId", "readAt");

ALTER TABLE "GuardianConsent"
ADD COLUMN IF NOT EXISTS "consentTemplateId" text,
ADD COLUMN IF NOT EXISTS "templateKey" text,
ADD COLUMN IF NOT EXISTS "templateVersion" text;

CREATE TABLE IF NOT EXISTS "ConsentTemplate" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" text NOT NULL,
  "key" text NOT NULL,
  "consentType" text NOT NULL,
  "version" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "status" text NOT NULL DEFAULT 'DRAFT',
  "effectiveFrom" timestamp,
  "publishedAt" timestamp,
  "archivedAt" timestamp,
  "createdById" text NOT NULL,
  "updatedById" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConsentTemplate_tenantId_key_version_key"
ON "ConsentTemplate"("tenantId", "key", "version");

CREATE INDEX IF NOT EXISTS "ConsentTemplate_tenantId_consentType_status_effectiveFrom_idx"
ON "ConsentTemplate"("tenantId", "consentType", "status", "effectiveFrom");

CREATE TABLE IF NOT EXISTS "CommunicationPreference" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" text NOT NULL,
  "guardianId" text NOT NULL,
  "marketingOptOutAt" timestamp,
  "marketingOptOutById" text,
  "marketingOptOutReason" text,
  "marketingOptOutSource" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommunicationPreference_tenantId_guardianId_key"
ON "CommunicationPreference"("tenantId", "guardianId");

ALTER TABLE "NotificationDelivery"
ADD COLUMN IF NOT EXISTS "retryCount" integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastRetryAt" timestamp,
ADD COLUMN IF NOT EXISTS "retryReason" text,
ADD COLUMN IF NOT EXISTS "requestedById" text,
ADD COLUMN IF NOT EXISTS "providerMessageId" text,
ADD COLUMN IF NOT EXISTS "failureReason" text,
ADD COLUMN IF NOT EXISTS "failureCode" text,
ADD COLUMN IF NOT EXISTS "deliveredAt" timestamp,
ADD COLUMN IF NOT EXISTS "failedAt" timestamp;

CREATE INDEX IF NOT EXISTS "NotificationDelivery_tenantId_noticeId_status_createdAt_idx"
ON "NotificationDelivery"("tenantId", "noticeId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "NotificationDelivery_tenantId_recipientUserId_status_createdAt_idx"
ON "NotificationDelivery"("tenantId", "recipientUserId", "status", "createdAt");
