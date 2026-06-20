import type { PaginatedResponse, PlatformAuditLog } from '@schoolos/core';
import { request } from './client';

type AuditFilters = {
  page?: number;
  limit?: number;
  action?: string;
  resource?: string;
};

export const settingsGovernanceApi = {
  listTenantAuditLogs: (filters: AuditFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.action?.trim()) params.set('action', filters.action.trim());
    if (filters.resource?.trim()) params.set('resource', filters.resource.trim());
    const suffix = params.toString();
    return request<PaginatedResponse<PlatformAuditLog>>(`/settings/audit-logs${suffix ? `?${suffix}` : ''}`);
  },
};
