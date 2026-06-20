import type {
  OperationalDashboardSummary,
  OperationalModuleSummary,
  OperationalSummaryRouteModule,
} from '@schoolos/core';
import { request } from './client';

/**
 * Dashboard aliases are a UI contract. They deliberately map only to the
 * verified route aliases accepted by OperationalDashboardSummaryController.
 */
export const operationalSummaryApi = {
  getDashboardSummary: () =>
    request<OperationalDashboardSummary>('/dashboard/summary'),

  getModuleSummary: (module: OperationalSummaryRouteModule) =>
    request<OperationalModuleSummary>(
      `/dashboard/${encodeURIComponent(module)}/summary`,
    ),
};
