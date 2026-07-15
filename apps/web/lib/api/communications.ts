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
  NotificationDeliveryOperationSummary,
  NotificationDeliveryFailureSummary,
  PaginatedResponse,
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
  attachmentFileId: string | null;
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
  approvalHistory: Array<{
    decision: string;
    reason: string | null;
    actorEmail: string | null;
    createdAt: string;
  }>;
  auditHistory: Array<{
    id: string;
    action: string;
    actorEmail: string | null;
    createdAt: string;
  }>;
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
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
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

export type NoticeAcknowledgementRecipient = {
  recipientUserId: string;
  guardianId: string | null;
  studentId: string | null;
  firstDeliveredAt: string;
  acknowledgementId: string | null;
  firstAcknowledgedAt: string | null;
  recipientLabel: string;
  recipientType: "GUARDIAN" | "STUDENT" | "USER";
};

export type NoticeAcknowledgementPage =
  PaginatedResponse<NoticeAcknowledgementRecipient>;

export type NoticeAcknowledgementFollowUpResult = {
  noticeId: string;
  requested: number;
  queued: number;
  skipped: number;
  eventId: string;
};

export type NotificationPreferenceCategory =
  import("@schoolos/core").NotificationPreferenceCategory;

export type NotificationPreferenceChannel =
  import("@schoolos/core").NotificationChannel;

export type NotificationPreferenceOverride = {
  id: string;
  category: NotificationPreferenceCategory;
  channel: NotificationPreferenceChannel;
  enabled: boolean;
  quietHoursEnabled: boolean | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationPreferenceSummary = {
  tenantDefaults: {
    timezone: "Asia/Kathmandu";
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
  };
  overrides: NotificationPreferenceOverride[];
};

export type NotificationDeliveryPage = PaginatedResponse<NotificationDelivery>;

export type NotificationDeliveryOperationPage =
  PaginatedResponse<NotificationDeliveryOperationSummary>;

export type NotificationDeliveryFailurePage =
  PaginatedResponse<NotificationDeliveryFailureSummary>;

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
  listNoticePage: (params?: {
    page?: number;
    limit?: number;
    lifecycleStatus?: NoticeLifecycleStatus;
    priority?: string;
    audienceType?: string;
    search?: string;
  }) =>
    request<PaginatedResponse<NoticeSummary>>(
      withQuery("/notices", params ?? {}),
    ),
  listNotices: () =>
    request<PaginatedResponse<NoticeSummary>>(
      withQuery("/notices", { page: 1, limit: 100 }),
    ).then((page) => page.items),
  getNoticeDetail: (noticeId: string) =>
    request<NoticeDetail>(`/notices/${encodeURIComponent(noticeId)}`),
  listNoticeUnreadRecipients: (
    noticeId: string,
    params?: { page?: number; limit?: number },
  ) =>
    request<NoticeUnreadRecipientsResult>(
      withQuery(
        `/notices/${encodeURIComponent(noticeId)}/unread-recipients`,
        params ?? {},
      ),
    ),
  acknowledgeNotice: (noticeId: string) =>
    request<{
      id: string;
      noticeId: string;
      firstAcknowledgedAt: string;
    }>(`/notices/${encodeURIComponent(noticeId)}/acknowledge`, {
      method: "POST",
    }),
  listNoticeAcknowledgements: (
    noticeId: string,
    params?: {
      page?: number;
      limit?: number;
      status?: "PENDING" | "ACKNOWLEDGED";
    },
  ) =>
    request<NoticeAcknowledgementPage>(
      withQuery(
        `/notices/${encodeURIComponent(noticeId)}/acknowledgements`,
        params ?? {},
      ),
    ),
  requestNoticeAcknowledgementFollowUp: (
    noticeId: string,
    body: {
      recipientUserIds: string[];
      reason: string;
      idempotencyKey: string;
    },
  ) =>
    request<NoticeAcknowledgementFollowUpResult>(
      `/notices/${encodeURIComponent(noticeId)}/acknowledgements/follow-up`,
      { method: "POST", json: body },
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
    request<NoticeSummary>(`/notices/${encodeURIComponent(noticeId)}/cancel`, {
      method: "POST",
      json: { reason },
    }),
  archiveNotice: (noticeId: string, reason: string) =>
    request<NoticeSummary>(`/notices/${encodeURIComponent(noticeId)}/archive`, {
      method: "POST",
      json: { reason },
    }),
  restoreNotice: (noticeId: string, reason: string) =>
    request<NoticeSummary>(`/notices/${encodeURIComponent(noticeId)}/restore`, {
      method: "POST",
      json: { reason },
    }),
  previewNoticeRecipients: (body: JsonBody) =>
    request<NoticeRecipientPreview>("/notices/recipient-preview", {
      method: "POST",
      json: body,
    }),
  listEvents: () => request<EventSummary[]>("/events"),
  createEvent: (body: JsonBody) =>
    request<EventSummary>("/events", { method: "POST", json: body }),
  listNotificationDeliveryPage: (params?: {
    page?: number;
    limit?: number;
    sourceType?: string | null;
    activityPostId?: string | null;
    status?: string | null;
    channel?: string | null;
  }) =>
    request<NotificationDeliveryPage>(
      withQuery("/communications/deliveries", {
        ...(params ?? {}),
      }),
    ),
  listNotificationDeliveryOperationPage: (params?: {
    page?: number;
    limit?: number;
    sourceType?: string | null;
    status?: string | null;
    channel?: string | null;
  }) =>
    request<NotificationDeliveryOperationPage>(
      withQuery("/communications/deliveries/operations", params ?? {}),
    ),
  listNotificationDeliveries: (params?: {
    sourceType?: string | null;
    activityPostId?: string | null;
  }) =>
    communicationsApi
      .listNotificationDeliveryPage({ page: 1, limit: 100, ...(params ?? {}) })
      .then((page) => page.items),
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
  getNotificationCenterPage: (params?: {
    page?: number;
    limit?: number;
    readStatus?: "ALL" | "READ" | "UNREAD";
    category?: NotificationPreferenceCategory;
  }) =>
    request<NotificationCenterSummary>(
      withQuery("/communications/notifications", params ?? {}),
    ),
  getNotificationCenter: () =>
    communicationsApi.getNotificationCenterPage({ page: 1, limit: 25 }),
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
  listNotificationDeliveryFailurePage: (params?: {
    page?: number;
    limit?: number;
    sourceType?: string | null;
    status?: string | null;
    channel?: string | null;
  }) =>
    request<NotificationDeliveryFailurePage>(
      withQuery("/communications/deliveries/failures", params ?? {}),
    ),
  listNotificationDeliveryFailures: () =>
    communicationsApi.listNotificationDeliveryFailurePage({
      page: 1,
      limit: 25,
    }),
  retryFailedNotificationDeliveries: (body?: { reason?: string }) =>
    request<any>("/communications/deliveries/retry-failed", {
      method: "POST",
      json: body ?? {},
    }),

  getOwnNotificationPreferences: () =>
    request<NotificationPreferenceSummary>("/notifications/preferences/me"),
  updateOwnNotificationPreference: (body: {
    category: NotificationPreferenceCategory;
    channel: NotificationPreferenceChannel;
    enabled: boolean;
    quietHoursEnabled?: boolean;
  }) =>
    request<NotificationPreferenceOverride>("/notifications/preferences/me", {
      method: "PATCH",
      json: body,
    }),
  resetOwnNotificationPreference: (
    category: NotificationPreferenceCategory,
    channel: NotificationPreferenceChannel,
  ) =>
    request<{ success: true }>(
      `/notifications/preferences/me/${encodeURIComponent(category)}/${encodeURIComponent(channel)}`,
      { method: "DELETE" },
    ),

  // Payroll - PDFs
};
