import type {
  OperationalDashboardSummary,
  OperationalModuleSummary,
  OperationalSummaryRouteModule,
  PlatformDashboardSummary,
} from '@schoolos/core';
import { request, withQuery } from './client';

/**
 * Dashboard aliases are a UI contract. They deliberately map only to the
 * verified route aliases accepted by OperationalDashboardSummaryController.
 */
export const operationalSummaryApi = {
  /** `persona` selects one of the caller's homes; the server re-validates it. */
  getDashboardSummary: (persona?: string) =>
    request<OperationalDashboardSummary>(
      withQuery('/dashboard/summary', persona ? { persona } : {}),
    ),

  getModuleSummary: (module: OperationalSummaryRouteModule) =>
    request<OperationalModuleSummary>(
      `/dashboard/${encodeURIComponent(module)}/summary`,
    ),

  getPlatformSummary: () =>
    request<PlatformDashboardSummary>('/platform/summary'),
};
