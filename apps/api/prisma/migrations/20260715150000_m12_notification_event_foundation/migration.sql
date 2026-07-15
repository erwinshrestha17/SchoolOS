CREATE TYPE "NotificationEventType" AS ENUM (
  'STUDENT_ADMITTED',
  'ATTENDANCE_STUDENT_ABSENT',
  'ATTENDANCE_STUDENT_LATE',
  'ATTENDANCE_STUDENT_LEAVE',
  'ATTENDANCE_STUDENT_CONSECUTIVE_ABSENCE',
  'FEE_PAYMENT_CONFIRMED',
  'NOTICE_PUBLISHED',
  'NOTICE_ACKNOWLEDGEMENT_FOLLOW_UP'
);

CREATE TYPE "NotificationEventSourceModule" AS ENUM (
  'M1_ADMISSIONS',
  'M2_ATTENDANCE',
  'M3_FEES',
  'M15_NOTICES'
);

CREATE TYPE "NotificationEventPriority" AS ENUM (
  'NORMAL',
  'IMPORTANT',
  'CRITICAL',
  'MANDATORY'
);

CREATE TYPE "NotificationEventStatus" AS ENUM (
  'ACCEPTED',
  'DISPATCHED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "NotificationEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" "NotificationEventType" NOT NULL,
  "sourceModule" "NotificationEventSourceModule" NOT NULL,
  "sourceEntityType" TEXT NOT NULL,
  "sourceEntityId" TEXT NOT NULL,
  "actorId" TEXT,
  "priority" "NotificationEventPriority" NOT NULL DEFAULT 'NORMAL',
  "metadata" JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "status" "NotificationEventStatus" NOT NULL DEFAULT 'ACCEPTED',
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispatchedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationEvent_tenantId_fkey" FOREIGN KEY ("tenantId")
    REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "NotificationEvent_actorId_fkey" FOREIGN KEY ("actorId")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "NotificationDelivery"
ADD COLUMN "notificationEventId" TEXT;

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_notificationEventId_fkey"
FOREIGN KEY ("notificationEventId") REFERENCES "NotificationEvent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "NotificationEvent_tenantId_idempotencyKey_key"
ON "NotificationEvent"("tenantId", "idempotencyKey");

CREATE INDEX "NotificationEvent_tenantId_type_createdAt_idx"
ON "NotificationEvent"("tenantId", "type", "createdAt");

CREATE INDEX "NotificationEvent_tenantId_status_createdAt_idx"
ON "NotificationEvent"("tenantId", "status", "createdAt");

CREATE INDEX "notification_event_source_idx"
ON "NotificationEvent"(
  "tenantId",
  "sourceModule",
  "sourceEntityType",
  "sourceEntityId"
);

CREATE INDEX "NotificationDelivery_tenantId_notificationEventId_idx"
ON "NotificationDelivery"("tenantId", "notificationEventId");
