CREATE TYPE "SchoolServiceRequestType" AS ENUM (
  'GENERAL_COMPLAINT',
  'PAYMENT_DISPUTE'
);

CREATE TYPE "SchoolServiceRequestCategory" AS ENUM (
  'ACADEMICS',
  'ATTENDANCE',
  'FEES_AND_PAYMENTS',
  'SCHOOL_OPERATIONS',
  'OTHER'
);

CREATE TYPE "SchoolServiceRequestPriority" AS ENUM ('NORMAL', 'HIGH');

CREATE TYPE "SchoolServiceRequestStatus" AS ENUM (
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'CANCELLED'
);

CREATE TYPE "SchoolServiceRequestNoteVisibility" AS ENUM (
  'PARENT',
  'INTERNAL'
);

CREATE TABLE "SchoolServiceRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "requestedById" TEXT NOT NULL,
  "type" "SchoolServiceRequestType" NOT NULL,
  "category" "SchoolServiceRequestCategory" NOT NULL,
  "priority" "SchoolServiceRequestPriority" NOT NULL DEFAULT 'NORMAL',
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "SchoolServiceRequestStatus" NOT NULL DEFAULT 'OPEN',
  "idempotencyKey" TEXT NOT NULL,
  "assignedToId" TEXT,
  "assignedById" TEXT,
  "assignedAt" TIMESTAMP(3),
  "responseDeadline" TIMESTAMP(3) NOT NULL,
  "escalatedAt" TIMESTAMP(3),
  "escalatedById" TEXT,
  "escalationReason" TEXT,
  "resolutionSummary" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "parentConfirmedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "reopenedAt" TIMESTAMP(3),
  "reopenReason" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SchoolServiceRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchoolServiceRequestNote" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "visibility" "SchoolServiceRequestNoteVisibility" NOT NULL DEFAULT 'PARENT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SchoolServiceRequestNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchoolServiceRequestAttachment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "fileAssetId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SchoolServiceRequestAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolServiceRequest_tenantId_idempotencyKey_key"
ON "SchoolServiceRequest"("tenantId", "idempotencyKey");

CREATE INDEX "SchoolServiceRequest_tenantId_status_priority_deadline_idx"
ON "SchoolServiceRequest"("tenantId", "status", "priority", "responseDeadline");

CREATE INDEX "SchoolServiceRequest_tenantId_studentId_createdAt_idx"
ON "SchoolServiceRequest"("tenantId", "studentId", "createdAt");

CREATE INDEX "SchoolServiceRequest_tenantId_requestedById_createdAt_idx"
ON "SchoolServiceRequest"("tenantId", "requestedById", "createdAt");

CREATE INDEX "SchoolServiceRequest_tenantId_assignedToId_status_idx"
ON "SchoolServiceRequest"("tenantId", "assignedToId", "status");

CREATE INDEX "SchoolServiceRequest_tenantId_invoiceId_status_idx"
ON "SchoolServiceRequest"("tenantId", "invoiceId", "status");

CREATE INDEX "SchoolServiceRequestNote_tenantId_requestId_createdAt_idx"
ON "SchoolServiceRequestNote"("tenantId", "requestId", "createdAt");

CREATE UNIQUE INDEX "SchoolServiceRequestAttachment_requestId_fileAssetId_key"
ON "SchoolServiceRequestAttachment"("requestId", "fileAssetId");

CREATE INDEX "SchoolServiceRequestAttachment_tenant_request_created_idx"
ON "SchoolServiceRequestAttachment"("tenantId", "requestId", "createdAt");

ALTER TABLE "SchoolServiceRequest"
ADD CONSTRAINT "SchoolServiceRequest_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceRequest"
ADD CONSTRAINT "SchoolServiceRequest_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceRequest"
ADD CONSTRAINT "SchoolServiceRequest_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceRequest"
ADD CONSTRAINT "SchoolServiceRequest_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceRequest"
ADD CONSTRAINT "SchoolServiceRequest_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceRequest"
ADD CONSTRAINT "SchoolServiceRequest_assignedById_fkey"
FOREIGN KEY ("assignedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceRequest"
ADD CONSTRAINT "SchoolServiceRequest_escalatedById_fkey"
FOREIGN KEY ("escalatedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceRequest"
ADD CONSTRAINT "SchoolServiceRequest_resolvedById_fkey"
FOREIGN KEY ("resolvedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceRequest"
ADD CONSTRAINT "SchoolServiceRequest_closedById_fkey"
FOREIGN KEY ("closedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceRequestNote"
ADD CONSTRAINT "SchoolServiceRequestNote_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceRequestNote"
ADD CONSTRAINT "SchoolServiceRequestNote_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "SchoolServiceRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceRequestNote"
ADD CONSTRAINT "SchoolServiceRequestNote_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceRequestAttachment"
ADD CONSTRAINT "SchoolServiceRequestAttachment_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceRequestAttachment"
ADD CONSTRAINT "SchoolServiceRequestAttachment_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "SchoolServiceRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceRequestAttachment"
ADD CONSTRAINT "SchoolServiceRequestAttachment_fileAssetId_fkey"
FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceRequestAttachment"
ADD CONSTRAINT "SchoolServiceRequestAttachment_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
