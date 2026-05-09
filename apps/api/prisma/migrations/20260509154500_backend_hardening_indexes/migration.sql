-- Backend hardening indexes for tenant-scoped high-volume query paths.
-- These indexes are intentionally additive and use IF NOT EXISTS to keep the
-- migration safe across partially indexed pilot databases.

CREATE INDEX IF NOT EXISTS "NotificationDelivery_tenant_source_idx"
ON "NotificationDelivery" ("tenantId", "sourceType", "sourceId");

CREATE INDEX IF NOT EXISTS "NotificationDelivery_tenant_recipient_idx"
ON "NotificationDelivery" ("tenantId", "recipientUserId");

CREATE INDEX IF NOT EXISTS "NotificationDelivery_tenant_status_created_idx"
ON "NotificationDelivery" ("tenantId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "NotificationReadReceipt_tenant_user_read_idx"
ON "NotificationReadReceipt" ("tenantId", "userId", "readAt");

CREATE INDEX IF NOT EXISTS "NotificationReadReceipt_tenant_delivery_user_idx"
ON "NotificationReadReceipt" ("tenantId", "notificationDeliveryId", "userId");

CREATE INDEX IF NOT EXISTS "HomeworkAssignment_tenant_status_due_idx"
ON "HomeworkAssignment" ("tenantId", "status", "dueDate");

CREATE INDEX IF NOT EXISTS "HomeworkAssignment_tenant_class_section_idx"
ON "HomeworkAssignment" ("tenantId", "classId", "sectionId");

CREATE INDEX IF NOT EXISTS "HomeworkSubmission_tenant_student_idx"
ON "HomeworkSubmission" ("tenantId", "studentId");

CREATE INDEX IF NOT EXISTS "HomeworkAttachment_tenant_file_idx"
ON "HomeworkAttachment" ("tenantId", "fileAssetId");

CREATE INDEX IF NOT EXISTS "TimetableSlot_tenant_staff_day_idx"
ON "TimetableSlot" ("tenantId", "staffId", "dayOfWeek");

CREATE INDEX IF NOT EXISTS "TimetableSlot_tenant_room_day_idx"
ON "TimetableSlot" ("tenantId", "roomId", "dayOfWeek");

CREATE INDEX IF NOT EXISTS "TimetableSlot_tenant_class_section_idx"
ON "TimetableSlot" ("tenantId", "classId", "sectionId");

CREATE INDEX IF NOT EXISTS "TimetableSubstitution_tenant_date_status_idx"
ON "TimetableSubstitution" ("tenantId", "date", "status");

CREATE INDEX IF NOT EXISTS "Conversation_tenant_student_year_idx"
ON "Conversation" ("tenantId", "studentId", "academicYearId");

CREATE INDEX IF NOT EXISTS "Message_tenant_conversation_created_idx"
ON "Message" ("tenantId", "conversationId", "createdAt");

CREATE INDEX IF NOT EXISTS "MessageReadReceipt_tenant_user_read_idx"
ON "MessageReadReceipt" ("tenantId", "userId", "readAt");
