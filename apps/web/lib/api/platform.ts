import type {
  PaginatedResponse,
  PaginatedResult,
  PlatformApiKeyCreated,
  PlatformApiKeySummary,
  PlatformAuditLog,
  PlatformDashboardSummary,
  PlatformDemoRequestDetail,
  PlatformDemoRequestStatus,
  PlatformDemoRequestSummary,
  PlatformFailedJobSummary,
  PlatformHealthSummary,
  PlatformOnboardingChecklist,
  PlatformPlanSummary,
  PlatformProviderConfigSummary,
  PlatformProviderReadinessDetail,
  PlatformQueueSummary,
  PlatformSaaSInvoiceSummary,
  PlatformTenantDetail,
  PlatformTenantSubscriptionSummary,
  PlatformTenantSummary,
  PlatformWebhookDeliverySummary,
  PlatformWebhookEndpointSummary,
  TenantSettingSummary,
} from '@schoolos/core';
import {
  AssignPlatformTenantSubscriptionPayload,
  JsonBody,
  PlatformAuditLogFilters,
  PlatformSupportOverridePayload,
  TenantLogoAccess,
  TenantLogoUploadResult,
  readFileAsBase64,
  request,
  withQuery,
} from './client';
import {
  clearSupportOverride,
  setSupportOverride,
} from '../session';

export const platformApi = {
  listPlatformTenants: () =>
    request<PlatformTenantSummary[]>('/platform/tenants'),
  listPlatformTenantsPage: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    plan?: string;
  }) =>
    request<PaginatedResult<PlatformTenantSummary>>(
      withQuery('/platform/tenants/page', {
        ...params,
        page: params?.page?.toString(),
        limit: params?.limit?.toString(),
      }),
    ),
  getPlatformTenantDetail: (tenantId: string) =>
    request<PlatformTenantDetail>(
      `/platform/tenants/${encodeURIComponent(tenantId)}`,
    ),
  updatePlatformTenantStatus: (
    tenantId: string,
    isActive: boolean,
    reason?: string,
  ) =>
    request<{ success: true }>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/status`,
      {
        method: 'PATCH',
        json: { isActive, reason },
      },
    ),
  listPlatformAuditLogs: (params?: PlatformAuditLogFilters) =>
    request<PaginatedResult<PlatformAuditLog>>(
      withQuery('/platform/audit-logs', {
        ...params,
        page: params?.page?.toString(),
        limit: params?.limit?.toString(),
      }),
    ),
  enterPlatformSupportOverride: async (
    body: PlatformSupportOverridePayload,
  ) => {
    const res = await request<{
      success: true;
      overrideId: string;
      expiresAt: string;
    }>('/platform/support/override/enter', { method: 'POST', json: body });
    setSupportOverride(body.tenantId, body.reason);
    return res;
  },
  exitPlatformSupportOverride: async () => {
    const res = await request<{ success: true }>(
      '/platform/support/override/exit',
      {
        method: 'POST',
      },
    );
    clearSupportOverride();
    return res;
  },
  getPlatformDashboard: () =>
    request<PlatformDashboardSummary>('/platform/dashboard'),
  listPlatformPlans: () => request<PlatformPlanSummary[]>('/platform/plans'),
  createPlatformPlan: (body: JsonBody) =>
    request<PlatformPlanSummary>('/platform/plans', {
      method: 'POST',
      json: body,
    }),
  updatePlatformPlan: (planId: string, body: JsonBody) =>
    request<PlatformPlanSummary>(
      `/platform/plans/${encodeURIComponent(planId)}`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  assignPlatformTenantSubscription: (
    tenantId: string,
    body: AssignPlatformTenantSubscriptionPayload,
  ) =>
    request<PlatformTenantSubscriptionSummary>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/subscriptions`,
      { method: 'POST', json: body },
    ),
  assignPlatformSubscription: (
    tenantId: string,
    body: AssignPlatformTenantSubscriptionPayload,
  ) =>
    request<PlatformTenantSubscriptionSummary>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/subscriptions`,
      { method: 'POST', json: body },
    ),
  updatePlatformSubscriptionStatus: (
    tenantId: string,
    subId: string,
    body: { status: string; notes?: string },
  ) =>
    request<PlatformTenantSubscriptionSummary>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/subscriptions/${encodeURIComponent(subId)}`,
      { method: 'PATCH', json: body },
    ),
  setPlatformFeatureOverride: (tenantId: string, body: JsonBody) =>
    request(
      `/platform/tenants/${encodeURIComponent(tenantId)}/feature-overrides`,
      { method: 'POST', json: body },
    ),
  listPlatformUsageCounters: (tenantId: string) =>
    request(`/platform/tenants/${encodeURIComponent(tenantId)}/usage-counters`),
  getPlatformBillingProfile: (tenantId: string) =>
    request(
      `/platform/tenants/${encodeURIComponent(tenantId)}/billing-profile`,
    ),
  updatePlatformBillingProfile: (tenantId: string, body: JsonBody) =>
    request(
      `/platform/tenants/${encodeURIComponent(tenantId)}/billing-profile`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  listPlatformSaaSInvoices: (tenantId: string) =>
    request<PlatformSaaSInvoiceSummary[]>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/saas-invoices`,
    ),
  createPlatformSaaSInvoice: (tenantId: string, body: JsonBody) =>
    request<PlatformSaaSInvoiceSummary>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/saas-invoices`,
      { method: 'POST', json: body },
    ),
  recordPlatformSaaSPayment: (
    tenantId: string,
    invoiceId: string,
    body: JsonBody,
  ) =>
    request<PlatformSaaSInvoiceSummary>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/saas-invoices/${encodeURIComponent(invoiceId)}/payments`,
      { method: 'POST', json: body },
    ),
  cancelPlatformSaaSInvoice: (
    tenantId: string,
    invoiceId: string,
    body: JsonBody,
  ) =>
    request<PlatformSaaSInvoiceSummary>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/saas-invoices/${encodeURIComponent(invoiceId)}/cancel`,
      { method: 'POST', json: body },
    ),
  listPlatformApiKeys: (tenantId: string) =>
    request<PlatformApiKeySummary[]>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/api-keys`,
    ),
  createPlatformApiKey: (tenantId: string, body: JsonBody) =>
    request<PlatformApiKeyCreated>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/api-keys`,
      { method: 'POST', json: body },
    ),
  revokePlatformApiKey: (tenantId: string, apiKeyId: string, body: JsonBody) =>
    request<PlatformApiKeySummary>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/api-keys/${encodeURIComponent(apiKeyId)}/revoke`,
      { method: 'POST', json: body },
    ),
  listPlatformProviders: () =>
    request<PlatformProviderConfigSummary[]>('/platform/providers'),
  upsertPlatformProvider: (body: JsonBody) =>
    request<PlatformProviderConfigSummary>('/platform/providers', {
      method: 'POST',
      json: body,
    }),
  testPlatformProviderConnection: (id: string) =>
    request<PlatformProviderReadinessDetail>(
      `/platform/providers/${encodeURIComponent(id)}/test`,
      {
        method: 'POST',
      },
    ),
  getPlatformProviderReadiness: (id: string) =>
    request<PlatformProviderReadinessDetail>(
      `/platform/providers/${encodeURIComponent(id)}/readiness`,
    ),
  listPlatformWebhookEndpoints: () =>
    request<PlatformWebhookEndpointSummary[]>('/platform/webhook-endpoints'),
  createPlatformWebhookEndpoint: (body: JsonBody) =>
    request<PlatformWebhookEndpointSummary>('/platform/webhook-endpoints', {
      method: 'POST',
      json: body,
    }),
  updatePlatformWebhookEndpoint: (id: string, body: JsonBody) =>
    request<PlatformWebhookEndpointSummary>(
      `/platform/webhook-endpoints/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  listPlatformWebhookDeliveries: (endpointId?: string) =>
    request<PlatformWebhookDeliverySummary[]>(
      `/platform/webhook-deliveries${endpointId ? `?endpointId=${encodeURIComponent(endpointId)}` : ''}`,
    ),
  getPlatformProvidersReadiness: () =>
    request<any[]>('/platform/providers/readiness'),
  updatePlatformProviderStatus: (id: string, body: JsonBody) =>
    request<PlatformProviderConfigSummary>(
      `/platform/providers/${encodeURIComponent(id)}/status`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  getPlatformQueueHealth: () =>
    request<PlatformQueueSummary[]>('/platform/queues'),
  listPlatformFailedJobs: (params?: {
    queueName?: string;
    page?: number;
    limit?: number;
  }) =>
    request<PaginatedResult<PlatformFailedJobSummary>>(
      withQuery('/platform/queues/failed-jobs', {
        ...params,
        page: params?.page?.toString(),
        limit: params?.limit?.toString(),
      }),
    ),
  getPlatformJobDetail: (queueName: string, jobId: string) =>
    request<PlatformFailedJobSummary>(
      `/platform/queues/${encodeURIComponent(queueName)}/jobs/${encodeURIComponent(jobId)}`,
    ),
  removePlatformJob: (queueName: string, jobId: string, reason: string) =>
    request<{ success: true }>(
      `/platform/queues/${encodeURIComponent(queueName)}/jobs/${encodeURIComponent(jobId)}`,
      {
        method: 'DELETE',
        json: { reason },
      },
    ),
  retryPlatformFailedJob: (body: JsonBody) =>
    request('/platform/queues/retry', { method: 'POST', json: body }),
  getPlatformHealth: () => request<PlatformHealthSummary>('/platform/health'),
  listPlatformReportExports: (params?: {
    tenantId?: string;
    module?: string;
    status?: string;
    reportType?: string;
    page?: number;
    limit?: number;
  }) => request<any>(withQuery('/platform/report-exports', params ?? {})),
  getTenantOnboardingChecklist: (tenantId: string) =>
    request<PlatformOnboardingChecklist>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/onboarding`,
    ),
  setTenantOnboardingOverride: (tenantId: string, body: JsonBody) =>
    request<PlatformOnboardingChecklist>(
      `/platform/tenants/${encodeURIComponent(tenantId)}/onboarding/override`,
      { method: 'POST', json: body },
    ),
  getTenantSettings: () => request<TenantSettingSummary[]>('/settings'),
  getPublicTenantSettings: () =>
    request<TenantSettingSummary[]>('/settings/public'),
  getSchoolOnboardingChecklist: () =>
    request<PlatformOnboardingChecklist>('/settings/onboarding'),
  listTenantAuditLogs: (
    params?: Omit<PlatformAuditLogFilters, 'tenantId'>,
  ) =>
    request<PaginatedResult<PlatformAuditLog>>(
      withQuery('/settings/audit-logs', {
        ...params,
        page: params?.page?.toString(),
        limit: params?.limit?.toString(),
      }),
    ),
  updateTenantSetting: (key: string, value: any) =>
    request<{ success: true }>(`/settings/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      json: { value },
    }),
  uploadSchoolLogo: async (file: File, note?: string) => {
    const base64Content = await readFileAsBase64(file);

    return request<TenantLogoUploadResult>('/settings/branding/logo', {
      method: 'POST',
      json: {
        fileName: file.name,
        mimeType: file.type,
        base64Content,
        ...(note ? { note } : {}),
      },
    });
  },
  getSchoolLogoPreview: () =>
    request<TenantLogoAccess>('/settings/branding/logo/preview'),
  getSchoolLogoDownload: () =>
    request<TenantLogoAccess>('/settings/branding/logo/download'),
  removeSchoolLogo: () =>
    request<{ success: true; removed: boolean }>('/settings/branding/logo', {
      method: 'DELETE',
    }),
  listPlatformDemoRequests: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: PlatformDemoRequestStatus | 'all';
    dateFrom?: string;
    dateTo?: string;
  }) =>
    request<PaginatedResponse<PlatformDemoRequestSummary>>(
      withQuery('/platform/demo-requests', {
        ...params,
        page: params?.page?.toString(),
        limit: params?.limit?.toString(),
      }),
    ),
  getPlatformDemoRequest: (id: string) =>
    request<PlatformDemoRequestDetail>(
      `/platform/demo-requests/${encodeURIComponent(id)}`,
    ),
  updatePlatformDemoRequestStatus: (
    id: string,
    body: { status: PlatformDemoRequestStatus; internalNotes?: string },
  ) =>
    request<PlatformDemoRequestDetail>(
      `/platform/demo-requests/${encodeURIComponent(id)}/status`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
};
