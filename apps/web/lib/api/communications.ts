import type {
  CommunicationTemplatePage,
  CommunicationTemplateSummary,
  CommunicationsProviderDiagnostics,
  CommunicationsSummary,
  ConsentRecord,
  EventSummary,
  GuardianConsentStatus,
  NoticeLifecycleStatus,
  NoticeSummary,
  NotificationDelivery,
  NotificationDeliveryFailureSummary,
} from "@schoolos/core";
import {
  JsonBody,
  NotificationCenterSummary,
  request,
  withQuery,
} from "./client";

export type NoticeDetail = {
  id: string;
  title: string;
  body: string;
  priority: string;
  audienceType: string;
  classId: string | null;
  className: string | null;
  sectionId: string | null;
  sectionName: string | null;
  createdBy: {
    id: string;
    email: string | null;
  } | null;
  attachmentUrl: string | null;
  lifecycleStatus: NoticeLifecycleStatus;
  approvalRequestId: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  archivedFromStatus: NoticeLifecycleStatus | null;
  createdAt: string;
  updatedAt: string;
  deliverySummary: {
    total: number;
    queued: number;
    sent: number;
    failed: number;
    skipped: number;
  };
};

export type NoticeUnreadRecipient = {
  deliveryId: string;
  channel: string;
  status: string;
  destination: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  recipientUserId: string | null;
  recipientEmail: string | null;
  guardian: {
    id: string;
    fullName: string;
    primaryPhone: string | null;
    email: string | null;
  } | null;
  student: {
    id: string;
    studentSystemId: string;
    fullName: string;
    className: string | null;
    sectionName: string | null;
  } | null;
};

export type NoticeUnreadRecipientsResult = {
  noticeId: string;
  totalDeliveries: number;
  readCount: number;
  unreadCount: number;
  recipients: NoticeUnreadRecipient[];
};

export type NoticeRecipientPreview = {
  audienceType: string;
  classId: string | null;
  sectionId: string | null;
  priority: string;
  channels: string[];
  recipientCount: number;
  allowedRecipientCount: number;
  skippedRecipientCount: number;
  estimatedDeliveryRows: number;
};

export type NotificationDeliveryAnalytics = {
  byStatus: Array<{ status: string; count: number }>;
  byChannel: Array<{ channel: string; count: number }>;
  emergencyNoticeCount: number;
};

export const communicationsApi = {
  getCommunicationsSummary: () =>
    request<CommunicationsSummary>("/communications/summary"),
  getCommunicationsProviderDiagnostics: () =>
    request<CommunicationsProviderDiagnostics>(
      "/communications/provider-diagnostics",
    ),
  listCommunicationTemplates: (params?: { page?: number; limit?: number }) =>
    request<CommunicationTemplatePage>(
      withQuery("/communications/templates", params ?? {}),
    ),
  createCommunicationTemplate: (body: JsonBody) =>
    request<CommunicationTemplateSummary>("/communications/templates", {
      method: "POST",
      json: body,
    }),
  updateCommunicationTemplate: (templateId: string, body: JsonBody) =>
    request<CommunicationTemplateSummary>(
      `/communications/templates/${encodeURIComponent(templateId)}`,
      {
        method: "PATCH",
        json: body,
      },
    ),
  publishCommunicationTemplate: (templateId: string) =>
    request<CommunicationTemplateSummary>(
      `/communications/templates/${encodeURIComponent(templateId)}/publish`,
      { method: "POST" },
    ),
  archiveCommunicationTemplate: (templateId: string) =>
    request<CommunicationTemplateSummary>(
      `/communications/templates/${encodeURIComponent(templateId)}/archive`,
      { method: "POST" },
    ),
  listNotices: () => request<NoticeSummary[]>("/notices"),
  getNoticeDetail: (noticeId: string) =>
    request<NoticeDetail>(`/notices/${encodeURIComponent(noticeId)}`),
  listNoticeUnreadRecipients: (noticeId: string) =>
    request<NoticeUnreadRecipientsResult>(
      `/notices/${encodeURIComponent(noticeId)}/unread-recipients`,
    ),
  createNotice: (body: JsonBody) =>
    request<NoticeSummary>("/notices", { method: "POST", json: body }),
  createNoticeDraft: (body: JsonBody) =>
    request<NoticeSummary>("/notices/drafts", { method: "POST", json: body }),
  updateNoticeDraft: (noticeId: string, body: JsonBody) =>
    request<NoticeSummary>(`/notices/${encodeURIComponent(noticeId)}`, {
      method: "PATCH",
      json: body,
    }),
  publishNotice: (noticeId: string) =>
    request<{ notice: NoticeSummary }>(
      `/notices/${encodeURIComponent(noticeId)}/publish`,
      { method: "POST" },
    ),
  scheduleNotice: (noticeId: string, scheduledFor: string) =>
    request<NoticeSummary>(
      `/notices/${encodeURIComponent(noticeId)}/schedule`,
      { method: "POST", json: { scheduledFor } },
    ),
  cancelNotice: (noticeId: string, reason: string) =>
    request<NoticeSummary>(
      `/notices/${encodeURIComponent(noticeId)}/cancel`,
      { method: "POST", json: { reason } },
    ),
  archiveNotice: (noticeId: string, reason: string) =>
    request<NoticeSummary>(
      `/notices/${encodeURIComponent(noticeId)}/archive`,
      { method: "POST", json: { reason } },
    ),
  restoreNotice: (noticeId: string, reason: string) =>
    request<NoticeSummary>(
      `/notices/${encodeURIComponent(noticeId)}/restore`,
      { method: "POST", json: { reason } },
    ),
  previewNoticeRecipients: (body: JsonBody) =>
    request<NoticeRecipientPreview>("/notices/recipient-preview", {
      method: "POST",
      json: body,
    }),
  listEvents: () => request<EventSummary[]>("/events"),
  createEvent: (body: JsonBody) =>
    request<EventSummary>("/events", { method: "POST", json: body }),
  listNotificationDeliveries: (params?: {
    sourceType?: string | null;
    activityPostId?: string | null;
  }) =>
    request<NotificationDelivery[]>(
      withQuery("/communications/deliveries", params ?? {}),
    ),
  getNotificationDeliveryAnalytics: () =>
    request<NotificationDeliveryAnalytics>(
      "/communications/deliveries/analytics",
    ),
  listConsents: () => request<ConsentRecord[]>("/consents"),
  getGuardianConsentStatus: (guardianId: string) =>
    request<GuardianConsentStatus[]>(
      `/consents/guardians/${encodeURIComponent(guardianId)}/status`,
    ),
  captureGuardianConsent: (guardianId: string, body: JsonBody) =>
    request<ConsentRecord>(
      `/consents/guardians/${encodeURIComponent(guardianId)}/capture`,
      { method: "POST", json: body },
    ),
  revokeGuardianConsent: (guardianId: string, body: JsonBody) =>
    request<ConsentRecord>(
      `/consents/guardians/${encodeURIComponent(guardianId)}/revoke`,
      { method: "POST", json: body },
    ),
  getNotificationCenter: () =>
    request<NotificationCenterSummary>("/communications/notifications"),
  markNotificationRead: (id: string) =>
    request<{ success: true }>(
      `/communications/notifications/${encodeURIComponent(id)}/read`,
      { method: "POST" },
    ),
  markAllNotificationsRead: () =>
    request<{ success: true; markedCount: number }>(
      "/communications/notifications/mark-all-read",
      { method: "POST" },
    ),

  // Academics - Assessment Components
  retryNotificationDelivery: (deliveryId: string, body?: { reason?: string }) =>
    request<any>(
      `/communications/deliveries/${encodeURIComponent(deliveryId)}/retry`,
      {
        method: "POST",
        json: body ?? {},
      },
    ),
  listNotificationDeliveryFailures: () =>
    request<{
      total: number;
      items: NotificationDeliveryFailureSummary[];
    }>("/communications/deliveries/failures"),
  retryFailedNotificationDeliveries: (body?: { reason?: string }) =>
    request<any>("/communications/deliveries/retry-failed", {
      method: "POST",
      json: body ?? {},
    }),

  // Payroll - PDFs
};
