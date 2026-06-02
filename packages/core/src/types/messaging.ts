import type { ParentTeacherSenderRole, ParentTeacherMessagePriority, ParentTeacherMessageStatus, ParentTeacherThreadStatus, ChatAvailabilityAppliesToRole } from './common.js';

export type ConversationSummary = {
  id: string;
  type: string;
  title: string | null;
  classId: string | null;
  sectionId: string | null;
  studentId: string | null;
  guardianId: string | null;
  updatedAt: string;
  messages?: MessageSummary[];
};

export type MessageSummary = {
  id: string;
  conversationId: string;
  senderUserId: string | null;
  body: string;
  attachmentUrl: string | null;
  status: string;
  createdAt: string;
};

export type MessageReadReceiptSummary = {
  id: string;
  messageId: string;
  readerUserId: string | null;
  guardianId: string | null;
  readAt: string;
};

export type ParentTeacherMessageSummary = {
  id: string;
  threadId: string;
  senderUserId: string;
  senderRole: ParentTeacherSenderRole;
  message: string;
  priority: ParentTeacherMessagePriority;
  status: ParentTeacherMessageStatus;
  sentAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ParentTeacherThreadSummary = {
  id: string;
  tenantId: string;
  academicYearId: string;
  studentId: string;
  guardianId: string;
  classTeacherId: string;
  status: ParentTeacherThreadStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  closedByUserId: string | null;
  closeReason: string | null;
  student?: {
    id: string;
    firstNameEn: string;
    lastNameEn: string;
    studentSystemId: string;
    class?: { name: string } | null;
    sectionRef?: { name: string } | null;
  } | null;
  guardian?: {
    id: string;
    fullName: string;
    relation: string;
    userId: string | null;
  } | null;
  classTeacher?: {
    id: string;
    firstName: string;
    lastName: string;
    userId: string;
  } | null;
  academicYear?: {
    id: string;
    name: string;
  } | null;
  latestMessages?: ParentTeacherMessageSummary[];
  sla?: string;
};

export type ChatAvailabilityRuleSummary = {
  id: string;
  tenantId: string;
  dayOfWeek: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
  appliesToRole: ChatAvailabilityAppliesToRole;
  createdAt: string;
  updatedAt: string;
};

export type ChatAvailabilityStatus = {
  isAvailable: boolean;
  timezone: string;
  currentDayOfWeek: number;
  currentTime: string;
  notice: string;
  sla: string;
  nextWindow: string | null;
};

export type SendParentTeacherMessageResult = {
  message: ParentTeacherMessageSummary;
  availability: ChatAvailabilityStatus;
  queuedNotice: string | null;
  sla: string;
};
