CREATE TYPE "CommunicationTemplateCategory" AS ENUM (
  'GENERAL',
  'HOLIDAY',
  'EMERGENCY',
  'FEES',
  'EXAMS',
  'TRANSPORT_DELAY',
  'EVENT'
);

CREATE TYPE "CommunicationTemplateChannel" AS ENUM (
  'IN_APP',
  'PUSH',
  'SMS',
  'EMAIL'
);

CREATE TYPE "CommunicationTemplateStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE TABLE "CommunicationTemplate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "category" "CommunicationTemplateCategory" NOT NULL DEFAULT 'GENERAL',
  "channel" "CommunicationTemplateChannel" NOT NULL DEFAULT 'IN_APP',
  "language" TEXT NOT NULL DEFAULT 'en',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "CommunicationTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationTemplate_tenantId_key_version_key"
  ON "CommunicationTemplate"("tenantId", "key", "version");

CREATE INDEX "CommunicationTemplate_tenantId_status_category_idx"
  ON "CommunicationTemplate"("tenantId", "status", "category");

CREATE INDEX "CommunicationTemplate_tenantId_key_status_idx"
  ON "CommunicationTemplate"("tenantId", "key", "status");

ALTER TABLE "CommunicationTemplate"
  ADD CONSTRAINT "CommunicationTemplate_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
