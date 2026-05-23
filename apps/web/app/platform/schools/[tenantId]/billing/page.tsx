'use client';

import type { PlatformSaaSInvoiceSummary, PlatformTenantDetail } from '@schoolos/core';
import { AlertTriangle, ArrowLeft, CreditCard, FileClock, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '../../../../../lib/api';

export default function PlatformTenantBillingPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [tenant, setTenant] = useState<PlatformTenantDetail | null>(null);
  const [invoices, setInvoices] = useState<PlatformSaaSInvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      api.getPlatformTenantDetail(tenantId),
      api.listPlatformSaaSInvoices(tenantId),
    ])
      .then(([tenantDetail, invoiceList]) => {
        if (!mounted) return;
        setTenant(tenantDetail);
        setInvoices(Array.isArray(invoiceList) ? invoiceList : []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message ?? 'Failed to load tenant SaaS billing.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [tenantId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-3xl bg-slate-100" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-800">
        <div className="flex items-center gap-3 font-black">
          <AlertTriangle size={20} />
          Tenant billing unavailable
        </div>
        <p className="mt-2 text-sm">{error ?? 'The requested tenant could not be loaded.'}</p>
        <Button asChild className="mt-5 rounded-2xl" variant="outline">
          <Link href="/platform/schools">Back to schools</Link>
        </Button>
      </div>
    );
  }

  const unpaidInvoices = invoices.filter((invoice) => !['PAID', 'CANCELLED'].includes(invoice.status));
  const overdueInvoices = invoices.filter((invoice) => invoice.status === 'OVERDUE');
  const unpaidBalance = unpaidInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.balanceAmount ?? 0),
    0,
  );

  return (
    <div className="space-y-8">
      <Link
        href={`/platform/schools/${tenant.id}`}
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Back to tenant detail
      </Link>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="neutral">SchoolOS SaaS Billing</Badge>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">
            {tenant.name} billing
          </h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            Review SchoolOS-to-school subscription billing for this tenant. This is not M3 student fee collection and does not post school ledger entries into M9 Accounting.
          </p>
        </div>
        <Button asChild className="rounded-2xl bg-slate-900 px-6 font-bold hover:bg-slate-800">
          <Link href={`/platform/schools/${tenant.id}/change-plan`}>Change plan</Link>
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <BillingMetric label="Subscription" value={tenant.subscription?.planName ?? 'No plan'} helper={tenant.subscription?.status ?? 'UNASSIGNED'} />
        <BillingMetric label="Unpaid balance" value={formatMoney(unpaidBalance)} helper={`${unpaidInvoices.length} unpaid invoice${unpaidInvoices.length === 1 ? '' : 's'}`} warning={unpaidBalance > 0} />
        <BillingMetric label="Overdue invoices" value={overdueInvoices.length.toLocaleString()} helper="Needs billing follow-up" warning={overdueInvoices.length > 0} />
      </div>

      <Card className="rounded-3xl border-slate-100 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-cyan-700">
            <CreditCard size={16} />
            SaaS billing boundary
          </div>
          <CardTitle className="text-2xl font-black">Platform subscription invoices</CardTitle>
          <CardDescription>
            These invoices are SchoolOS platform billing records. Student fee invoices remain in M3 Fees, and school accounting reports remain in M9 Accounting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
              <FileClock className="mx-auto text-slate-300" size={40} />
              <p className="mt-4 font-black text-slate-900">No SaaS invoices yet</p>
              <p className="mt-1 text-sm text-slate-500">Create invoices from the tenant detail billing workflow when needed.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Invoice</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Issued</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Amount</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Balance</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-4 font-mono text-xs font-black text-slate-900">{invoice.invoiceNumber}</td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(invoice.issueDate)}</td>
                      <td className="px-5 py-4 font-black text-slate-900">{invoice.currency} {Number(invoice.amount).toLocaleString()}</td>
                      <td className="px-5 py-4 font-black text-slate-900">{invoice.currency} {Number(invoice.balanceAmount).toLocaleString()}</td>
                      <td className="px-5 py-4">
                        <Badge variant={invoice.status === 'PAID' ? 'success' : invoice.status === 'OVERDUE' ? 'destructive' : 'neutral'}>
                          {invoice.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BillingMetric({
  label,
  value,
  helper,
  warning = false,
}: {
  label: string;
  value: string;
  helper: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
      <p className={warning ? 'mt-1 text-sm font-semibold text-rose-700' : 'mt-1 text-sm text-slate-500'}>{helper}</p>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString();
}

function formatMoney(value: number) {
  return `NPR ${value.toLocaleString()}`;
}
