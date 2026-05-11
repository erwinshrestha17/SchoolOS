-- Phase 2B.1 Timetable conflict-engine schema hardening
-- Existing Phase 2B tables are already part of the baseline. This migration adds
-- database-level query support and duplicate prevention for conflict detection.

CREATE INDEX IF NOT EXISTS "TimetableSlot_tenantId_academicYearId_dayOfWeek_staffId_idx"
  ON "TimetableSlot"("tenantId", "academicYearId", "dayOfWeek", "staffId");

CREATE INDEX IF NOT EXISTS "TimetableSlot_tenantId_academicYearId_dayOfWeek_roomId_idx"
  ON "TimetableSlot"("tenantId", "academicYearId", "dayOfWeek", "roomId");

CREATE INDEX IF NOT EXISTS "TimetableSlot_tenantId_academicYearId_dayOfWeek_class_section_idx"
  ON "TimetableSlot"("tenantId", "academicYearId", "dayOfWeek", "classId", "sectionId");

CREATE INDEX IF NOT EXISTS "TimetableSlot_tenantId_versionId_dayOfWeek_startsAt_endsAt_idx"
  ON "TimetableSlot"("tenantId", "versionId", "dayOfWeek", "startsAt", "endsAt");

CREATE INDEX IF NOT EXISTS "TimetableVersion_tenantId_academicYearId_status_effective_idx"
  ON "TimetableVersion"("tenantId", "academicYearId", "status", "effectiveFrom", "effectiveTo");

CREATE INDEX IF NOT EXISTS "TeacherAvailability_tenantId_staffId_academic_day_time_idx"
  ON "TeacherAvailability"("tenantId", "staffId", "academicYearId", "dayOfWeek", "startsAt", "endsAt");

CREATE INDEX IF NOT EXISTS "TeacherWorkloadLimit_tenantId_staff_academic_idx"
  ON "TeacherWorkloadLimit"("tenantId", "staffId", "academicYearId");

CREATE INDEX IF NOT EXISTS "TimetableSubstitution_tenantId_slot_date_status_idx"
  ON "TimetableSubstitution"("tenantId", "timetableSlotId", "date", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "TimetableSlot_unique_version_class_section_day_time"
  ON "TimetableSlot"("tenantId", "versionId", "classId", COALESCE("sectionId", ''), "dayOfWeek", "startsAt", "endsAt")
  WHERE "versionId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "TimetableSlot_unique_version_teacher_day_time"
  ON "TimetableSlot"("tenantId", "versionId", "staffId", "dayOfWeek", "startsAt", "endsAt")
  WHERE "versionId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "TimetableSlot_unique_version_room_day_time"
  ON "TimetableSlot"("tenantId", "versionId", "roomId", "dayOfWeek", "startsAt", "endsAt")
  WHERE "versionId" IS NOT NULL AND "roomId" IS NOT NULL;
