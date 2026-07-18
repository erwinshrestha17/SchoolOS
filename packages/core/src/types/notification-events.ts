export const NOTIFICATION_EVENT_TYPES = [
  "STUDENT_ADMITTED",
  "ADMISSION_DOCUMENTS_REQUESTED",
  "ATTENDANCE_STUDENT_ABSENT",
  "ATTENDANCE_STUDENT_LATE",
  "ATTENDANCE_STUDENT_LEAVE",
  "ATTENDANCE_STUDENT_CONSECUTIVE_ABSENCE",
  "FEE_PAYMENT_CONFIRMED",
  "NOTICE_PUBLISHED",
  "NOTICE_ACKNOWLEDGEMENT_FOLLOW_UP",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export const NOTIFICATION_EVENT_SOURCE_MODULES = [
  "M1_ADMISSIONS",
  "M2_ATTENDANCE",
  "M3_FEES",
  "M15_NOTICES",
] as const;

export type NotificationEventSourceModule =
  (typeof NOTIFICATION_EVENT_SOURCE_MODULES)[number];

export const NOTIFICATION_EVENT_PRIORITIES = [
  "NORMAL",
  "IMPORTANT",
  "CRITICAL",
  "MANDATORY",
] as const;

export const NOTIFICATION_CHANNELS = [
  "IN_APP",
  "PUSH",
  "EMAIL",
  "SMS",
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_PREFERENCE_CATEGORIES = [
  "GENERAL",
  "ATTENDANCE",
  "FEES",
  "NOTICE",
  "SECURITY",
  "EMERGENCY",
] as const;

export type NotificationPreferenceCategory =
  (typeof NOTIFICATION_PREFERENCE_CATEGORIES)[number];

export type NotificationEventPriority =
  (typeof NOTIFICATION_EVENT_PRIORITIES)[number];

export const NOTIFICATION_EVENT_CATALOGUE: Readonly<
  Record<
    NotificationEventType,
    {
      sourceModule: NotificationEventSourceModule;
      sourceEntityType: string;
      defaultPriority: NotificationEventPriority;
    }
  >
> = {
  STUDENT_ADMITTED: {
    sourceModule: "M1_ADMISSIONS",
    sourceEntityType: "student",
    defaultPriority: "IMPORTANT",
  },
  ADMISSION_DOCUMENTS_REQUESTED: {
    sourceModule: "M1_ADMISSIONS",
    sourceEntityType: "admission_application",
    defaultPriority: "IMPORTANT",
  },
  ATTENDANCE_STUDENT_ABSENT: {
    sourceModule: "M2_ATTENDANCE",
    sourceEntityType: "attendance_record",
    defaultPriority: "IMPORTANT",
  },
  ATTENDANCE_STUDENT_LATE: {
    sourceModule: "M2_ATTENDANCE",
    sourceEntityType: "attendance_record",
    defaultPriority: "NORMAL",
  },
  ATTENDANCE_STUDENT_LEAVE: {
    sourceModule: "M2_ATTENDANCE",
    sourceEntityType: "attendance_record",
    defaultPriority: "NORMAL",
  },
  ATTENDANCE_STUDENT_CONSECUTIVE_ABSENCE: {
    sourceModule: "M2_ATTENDANCE",
    sourceEntityType: "attendance_record",
    defaultPriority: "CRITICAL",
  },
  FEE_PAYMENT_CONFIRMED: {
    sourceModule: "M3_FEES",
    sourceEntityType: "payment",
    defaultPriority: "IMPORTANT",
  },
  NOTICE_PUBLISHED: {
    sourceModule: "M15_NOTICES",
    sourceEntityType: "notice",
    defaultPriority: "NORMAL",
  },
  NOTICE_ACKNOWLEDGEMENT_FOLLOW_UP: {
    sourceModule: "M15_NOTICES",
    sourceEntityType: "notice",
    defaultPriority: "IMPORTANT",
  },
};

export function isNotificationEventType(
  value: string,
): value is NotificationEventType {
  return (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(value);
}
