import type {
  FinancePayableDetail,
  FinancePayableView,
  FinanceVendorView,
  PayablesAgingResponse,
  PayablesSetup,
  VendorBillView,
} from '@schoolos/core';
import { request, withQuery } from './client';

/**
 * Phase 7.11c — accounts payable. Money goes over the wire as NPR decimal
 * strings typed by the user; the web never adds, ages or computes tax.
 */
type Page<T> = {
  items: T[];
  pagination: { page: number; limit: number; total: number };
};

export type ReportAccountMapping = {
  id: string;
  mappingType: string;
  accountId: string;
  account: { id: string; code: string; name: string; type: string };
};

export const payablesApi = {
  getPayablesSetup: () => request<PayablesSetup>('/accounting/payables-setup'),
  listVendors: (params: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) =>
    request<Page<FinanceVendorView>>(withQuery('/accounting/vendors', params)),
  createVendor: (body: {
    legalName: string;
    displayName?: string;
    panNumber?: string;
    phone?: string;
    email?: string;
    address?: string;
  }) =>
    request<FinanceVendorView>('/accounting/vendors', {
      method: 'POST',
      json: body,
    }),
  deactivateVendor: (id: string, reason: string) =>
    request<FinanceVendorView>(
      `/accounting/vendors/${encodeURIComponent(id)}/deactivate`,
      { method: 'POST', json: { reason } },
    ),
  listVendorBills: (params: {
    search?: string;
    status?: string;
    vendorId?: string;
    page?: number;
    limit?: number;
  }) =>
    request<Page<VendorBillView>>(
      withQuery('/accounting/vendor-bills', params),
    ),
  getVendorBill: (id: string) =>
    request<VendorBillView>(
      `/accounting/vendor-bills/${encodeURIComponent(id)}`,
    ),
  createVendorBill: (body: {
    idempotencyKey: string;
    vendorId: string;
    vendorBillNumber?: string;
    expenseDate: string;
    dueDate?: string;
    description: string;
    expenseAccountId: string;
    amount: string;
    taxAmount?: string;
  }) =>
    request<VendorBillView>('/accounting/vendor-bills', {
      method: 'POST',
      json: body,
    }),
  submitVendorBill: (id: string) =>
    request<VendorBillView>(
      `/accounting/vendor-bills/${encodeURIComponent(id)}/submit`,
      { method: 'POST', json: {} },
    ),
  approveVendorBill: (id: string, expectedFingerprint: string) =>
    request<VendorBillView>(
      `/accounting/vendor-bills/${encodeURIComponent(id)}/approve`,
      { method: 'POST', json: { expectedFingerprint } },
    ),
  rejectVendorBill: (id: string, reason: string) =>
    request<VendorBillView>(
      `/accounting/vendor-bills/${encodeURIComponent(id)}/reject`,
      { method: 'POST', json: { reason } },
    ),
  reverseVendorBill: (
    id: string,
    body: { reason: string; reversalDate?: string },
  ) =>
    request<VendorBillView>(
      `/accounting/vendor-bills/${encodeURIComponent(id)}/reverse`,
      { method: 'POST', json: body },
    ),
  listPayables: (params: {
    search?: string;
    status?: string;
    vendorId?: string;
    page?: number;
    limit?: number;
  }) =>
    request<Page<FinancePayableView>>(
      withQuery('/accounting/payables', params),
    ),
  getPayable: (id: string) =>
    request<FinancePayableDetail>(
      `/accounting/payables/${encodeURIComponent(id)}`,
    ),
  settlePayable: (
    id: string,
    body: {
      idempotencyKey: string;
      amount: string;
      withheldTaxAmount?: string;
      paymentAccountId: string;
      settledAt: string;
      paymentReference?: string;
    },
  ) =>
    request<FinancePayableDetail>(
      `/accounting/payables/${encodeURIComponent(id)}/settlements`,
      { method: 'POST', json: body },
    ),
  reversePayableSettlement: (
    id: string,
    body: { reason: string; reversalDate?: string },
  ) =>
    request<FinancePayableDetail>(
      `/accounting/payable-settlements/${encodeURIComponent(id)}/reverse`,
      { method: 'POST', json: body },
    ),
  getPayablesAging: (params: {
    asOfDate?: string;
    bucket?: string;
    vendorId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    request<PayablesAgingResponse>(
      withQuery('/accounting/reports/payables-aging', params),
    ),
  getReportAccountMappings: () =>
    request<ReportAccountMapping[]>('/accounting/reports/mappings'),
  updateReportAccountMappings: (
    mappings: Array<{ mappingType: string; accountId: string }>,
  ) =>
    request<{ success: boolean; count: number }>(
      '/accounting/reports/mappings',
      {
        method: 'PUT',
        json: { mappings },
      },
    ),
};
