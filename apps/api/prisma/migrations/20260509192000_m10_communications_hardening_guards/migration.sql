-- M10 Communications, Notifications, Consent, and Parent-Class Teacher Chat hardening.
-- Adds notice read state, consent templates/preferences, retry metadata, read receipts,
-- moderation indexes, and cross-tenant/lifecycle DB guardrails.

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

CREATE UNIQUE INDEX IF NOT EXISTS "NoticeReadReceipt_tenant_notice_user_uidx"
ON "NoticeReadReceipt"("tenantId", "noticeId", "userId");

CREATE INDEX IF NOT EXISTS "NoticeReadReceipt_tenant_notice_idx"
ON "NoticeReadReceipt"("tenantId", "noticeId", "readAt");

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

CREATE UNIQUE INDEX IF NOT EXISTS "ConsentTemplate_tenant_key_version_uidx"
ON "ConsentTemplate"("tenantId", "key", "version");

CREATE INDEX IF NOT EXISTS "ConsentTemplate_tenant_type_status_idx"
ON "ConsentTemplate"("tenantId", "consentType", "status", "effectiveFrom");

ALTER TABLE "GuardianConsent"
ADD COLUMN IF NOT EXISTS "consentTemplateId" text,
ADD COLUMN IF NOT EXISTS "templateKey" text,
ADD COLUMN IF NOT EXISTS "templateVersion" text;

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

CREATE UNIQUE INDEX IF NOT EXISTS "CommunicationPreference_tenant_guardian_uidx"
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

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationDelivery_idempotency_uidx"
ON "NotificationDelivery"("tenantId", "sourceType", "sourceId", "recipientUserId", "guardianId", "studentId", "channel");

CREATE INDEX IF NOT EXISTS "NotificationDelivery_tenant_notice_status_idx"
ON "NotificationDelivery"("tenantId", "noticeId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "NotificationDelivery_tenant_recipient_status_idx"
ON "NotificationDelivery"("tenantId", "recipientUserId", "status", "createdAt");

CREATE TABLE IF NOT EXISTS "ParentTeacherMessageReadReceipt" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" text NOT NULL,
  "messageId" text NOT NULL,
  "threadId" text NOT NULL,
  "userId" text NOT NULL,
  "recipientType" text NOT NULL,
  "readAt" timestamp NOT NULL DEFAULT now(),
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ParentTeacherMessageReadReceipt_tenant_message_user_uidx"
ON "ParentTeacherMessageReadReceipt"("tenantId", "messageId", "userId");

CREATE INDEX IF NOT EXISTS "ParentTeacherMessageReadReceipt_tenant_thread_user_idx"
ON "ParentTeacherMessageReadReceipt"("tenantId", "threadId", "userId", "readAt");

CREATE OR REPLACE FUNCTION "enforce_consent_template_guard"()
RETURNS trigger AS $$
BEGIN
  IF COALESCE(TRIM(NEW."key"), '') = '' THEN
    RAISE EXCEPTION 'Consent template key is required';
  END IF;

  IF COALESCE(TRIM(NEW."version"), '') = '' THEN
    RAISE EXCEPTION 'Consent template version is required';
  END IF;

  IF COALESCE(TRIM(NEW."title"), '') = '' OR COALESCE(TRIM(NEW."body"), '') = '' THEN
    RAISE EXCEPTION 'Consent template title and body are required';
  END IF;

  IF NEW."status" NOT IN ('DRAFT', 'PUBLISHED', 'ARCHIVED') THEN
    RAISE EXCEPTION 'Invalid consent template status';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" = 'PUBLISHED' AND (
    NEW."body" IS DISTINCT FROM OLD."body" OR
    NEW."title" IS DISTINCT FROM OLD."title" OR
    NEW."version" IS DISTINCT FROM OLD."version" OR
    NEW."key" IS DISTINCT FROM OLD."key"
  ) THEN
    RAISE EXCEPTION 'Published consent template content/version cannot be silently edited';
  END IF;

  IF NEW."status" = 'PUBLISHED' AND NEW."publishedAt" IS NULL THEN
    NEW."publishedAt" := now();
  END IF;

  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "consent_template_guard" ON "ConsentTemplate";
CREATE TRIGGER "consent_template_guard"
BEFORE INSERT OR UPDATE
ON "ConsentTemplate"
FOR EACH ROW
EXECUTE FUNCTION "enforce_consent_template_guard"();

CREATE OR REPLACE FUNCTION "enforce_notice_read_receipt_guard"()
RETURNS trigger AS $$
DECLARE
  notice_tenant_id text;
  user_tenant_id text;
  guardian_tenant_id text;
  student_tenant_id text;
BEGIN
  SELECT "tenantId" INTO notice_tenant_id FROM "Notice" WHERE "id" = NEW."noticeId";
  IF notice_tenant_id IS NULL OR notice_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Notice read receipt notice is missing or outside tenant';
  END IF;

  SELECT "tenantId" INTO user_tenant_id FROM "User" WHERE "id" = NEW."userId";
  IF user_tenant_id IS NULL OR user_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Notice read receipt user is missing or outside tenant';
  END IF;

  IF NEW."guardianId" IS NOT NULL THEN
    SELECT "tenantId" INTO guardian_tenant_id FROM "Guardian" WHERE "id" = NEW."guardianId";
    IF guardian_tenant_id IS NULL OR guardian_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Notice read receipt guardian is missing or outside tenant';
    END IF;
  END IF;

  IF NEW."studentId" IS NOT NULL THEN
    SELECT "tenantId" INTO student_tenant_id FROM "Student" WHERE "id" = NEW."studentId";
    IF student_tenant_id IS NULL OR student_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Notice read receipt student is missing or outside tenant';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "notice_read_receipt_guard" ON "NoticeReadReceipt";
CREATE TRIGGER "notice_read_receipt_guard"
BEFORE INSERT OR UPDATE
ON "NoticeReadReceipt"
FOR EACH ROW
EXECUTE FUNCTION "enforce_notice_read_receipt_guard"();

CREATE OR REPLACE FUNCTION "enforce_communication_preference_guard"()
RETURNS trigger AS $$
DECLARE
  guardian_tenant_id text;
BEGIN
  SELECT "tenantId" INTO guardian_tenant_id FROM "Guardian" WHERE "id" = NEW."guardianId";
  IF guardian_tenant_id IS NULL OR guardian_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Communication preference guardian is missing or outside tenant';
  END IF;

  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "communication_preference_guard" ON "CommunicationPreference";
CREATE TRIGGER "communication_preference_guard"
BEFORE INSERT OR UPDATE
ON "CommunicationPreference"
FOR EACH ROW
EXECUTE FUNCTION "enforce_communication_preference_guard"();

CREATE OR REPLACE FUNCTION "prevent_invalid_notification_delivery_transition"()
RETURNS trigger AS $$
BEGIN
  IF NEW."status"::text NOT IN ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'CANCELLED', 'SUPPRESSED', 'SKIPPED') THEN
    RAISE EXCEPTION 'Invalid notification delivery status';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status"::text IN ('DELIVERED', 'CANCELLED', 'SUPPRESSED', 'SKIPPED') AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'Terminal notification delivery status cannot transition silently';
  END IF;

  IF NEW."status"::text = 'FAILED' AND NEW."failedAt" IS NULL THEN
    NEW."failedAt" := now();
  END IF;

  IF NEW."status"::text IN ('SENT', 'DELIVERED') AND NEW."sentAt" IS NULL THEN
    NEW."sentAt" := now();
  END IF;

  IF NEW."status"::text = 'DELIVERED' AND NEW."deliveredAt" IS NULL THEN
    NEW."deliveredAt" := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "notification_delivery_transition_guard" ON "NotificationDelivery";
CREATE TRIGGER "notification_delivery_transition_guard"
BEFORE INSERT OR UPDATE
ON "NotificationDelivery"
FOR EACH ROW
EXECUTE FUNCTION "prevent_invalid_notification_delivery_transition"();

CREATE OR REPLACE FUNCTION "enforce_parent_teacher_message_read_receipt_guard"()
RETURNS trigger AS $$
DECLARE
  message_tenant_id text;
  message_thread_id text;
  user_tenant_id text;
BEGIN
  SELECT "tenantId", "threadId" INTO message_tenant_id, message_thread_id FROM "ParentTeacherMessage" WHERE "id" = NEW."messageId";

  IF message_tenant_id IS NULL OR message_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Message read receipt message is missing or outside tenant';
  END IF;

  IF message_thread_id <> NEW."threadId" THEN
    RAISE EXCEPTION 'Message read receipt thread does not match message';
  END IF;

  SELECT "tenantId" INTO user_tenant_id FROM "User" WHERE "id" = NEW."userId";
  IF user_tenant_id IS NULL OR user_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Message read receipt user is missing or outside tenant';
  END IF;

  IF NEW."recipientType" NOT IN ('PARENT', 'TEACHER', 'ADMIN') THEN
    RAISE EXCEPTION 'Invalid message read receipt recipient type';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "parent_teacher_message_read_receipt_guard" ON "ParentTeacherMessageReadReceipt";
CREATE TRIGGER "parent_teacher_message_read_receipt_guard"
BEFORE INSERT OR UPDATE
ON "ParentTeacherMessageReadReceipt"
FOR EACH ROW
EXECUTE FUNCTION "enforce_parent_teacher_message_read_receipt_guard"();

CREATE UNIQUE INDEX IF NOT EXISTS "ParentTeacherThread_tenant_student_guardian_teacher_year_open_uidx"
ON "ParentTeacherThread"("tenantId", "studentId", "guardianId", "classTeacherId", "academicYearId")
WHERE "status" = 'OPEN';

CREATE INDEX IF NOT EXISTS "ParentTeacherThread_tenant_teacher_status_idx"
ON "ParentTeacherThread"("tenantId", "classTeacherId", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "ParentTeacherThread_tenant_guardian_status_idx"
ON "ParentTeacherThread"("tenantId", "guardianId", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "ParentTeacherMessage_tenant_thread_sent_idx"
ON "ParentTeacherMessage"("tenantId", "threadId", "sentAt");

CREATE INDEX IF NOT EXISTS "ChatEscalation_tenant_status_idx"
ON "ChatEscalation"("tenantId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "ChatAbuseReport_tenant_status_idx"
ON "ChatAbuseReport"("tenantId", "status", "createdAt");
