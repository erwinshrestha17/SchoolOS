import type {
  ConsentRecord,
  EventSummary,
  GuardianConsentStatus,
  NoticeSummary,
  NotificationDelivery,
  NotificationDeliveryFailureSummary,
} from '@schoolos/core';
import {
  JsonBody,
  NotificationCenterSummary,
  request,
} from './client';

export const communicationsApi = {
  listNotices: () => request<NoticeSummary[]>('/notices'),
  createNotice: (body: JsonBody) =>
    request<NoticeSummary>('/notices', { method: 'POST', json: body }),
  listEvents: () => request<EventSummary[]>('/events'),
  createEvent: (body: JsonBody) =>
    request<EventSummary>('/events', { method: 'POST', json: body }),
  listNotificationDeliveries: () =>
    request<NotificationDelivery[]>('/communications/deliveries'),
  listConsents: () => request<ConsentRecord[]>('/consents'),
  getGuardianConsentStatus: (guardianId: string) =>
    request<GuardianConsentStatus[]>(
      `/consents/guardians/${encodeURIComponent(guardianId)}/status`,
    ),
  captureGuardianConsent: (guardianId: string, body: JsonBody) =>
    request<ConsentRecord>(
      `/consents/guardians/${encodeURIComponent(guardianId)}/capture`,
      { method: 'POST', json: body },
    ),
  revokeGuardianConsent: (guardianId: string, body: JsonBody) =>
    request<ConsentRecord>(
      `/consents/guardians/${encodeURIComponent(guardianId)}/revoke`,
      { method: 'POST', json: body },
    ),
  getNotificationCenter: () =>
    request<NotificationCenterSummary>('/communications/notifications'),
  markNotificationRead: (id: string) =>
    request<{ success: true }>(
      `/communications/notifications/${encodeURIComponent(id)}/read`,
      { method: 'POST' },
    ),
  markAllNotificationsRead: () =>
    request<{ success: true; markedCount: number }>(
      '/communications/notifications/mark-all-read',
      { method: 'POST' },
    ),

  // Academics - Assessment Components
  retryNotificationDelivery: (deliveryId: string) =>
    request<any>(
      `/communications/deliveries/${encodeURIComponent(deliveryId)}/retry`,
      {
        method: 'POST',
      },
    ),
  listNotificationDeliveryFailures: () =>
    request<{
      total: number;
      items: NotificationDeliveryFailureSummary[];
    }>('/communications/deliveries/failures'),
  retryFailedNotificationDeliveries: () =>
    request<any>('/communications/deliveries/retry-failed', { method: 'POST' }),

  // Payroll - PDFs
};
