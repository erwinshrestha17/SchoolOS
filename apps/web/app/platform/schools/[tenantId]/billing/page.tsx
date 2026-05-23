'use client';

import type { PlatformSaaSInvoiceSummary, PlatformTenantDetail } from '@schoolos/core';
import { ArrowLeft, CreditCard, FileClock } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PlatformBoundaryNote,
  PlatformEmptyState,
  PlatformInlineError,
  PlatformSectionSkeleton,
} from '../../../_components/platform-operator-states';
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
    return <PlatformSectionSkeleton rows={6} />;
  }

  if (error || !tenant) {
    return (
      <PlatformInlineError
        title="Tenant billing unavailable"
        message={error ?? 'The requested tenant could not be loaded.'}
      />
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
            Review SchoolOS-to-school subscription billing for this tenant.
          </p>
        </div>
        <Button asChild className="rounded-2xl bg-slate-900 px-6 font-bold hover:bg-slate-800">
          <Link href={`/platform/schools/${tenant.id}/change-plan`}>Change plan</Link>
        </Button>
      </header>

      <PlatformBoundaryNote title="SaaS billing boundary">
        This is SchoolOS-to-school subscription billing. It is not M3 student fee collection, and it does not post school ledger entries into M9 Accounting.
      </PlatformBoundaryNote>

      <div className="grid gap-4 md:grid-cols-3">
        <BillingMetric label="Subscription" value={tenant.subscription?.planName ?? 'No plan'} helper={tenant.subscription?.status ?? 'UNASSIGNED'} />
        <BillingMetric label="Unpaid balance" value={formatMoney(unpaidBalance)} helper={`${unpaidInvoices.length} unpaid invoice${unpaidInvoices.length === 1 ? '' : 's'}`} warning={unpaidBalance > 0} />
        <BillingMetric label="Overdue invoices" value={overdueInvoices.length.toLocaleString()} helper="Needs billing follow-up" warning={overdueInvoices.length > 0} />
      </div>

      <Card className="rounded-3xl border-slate-100 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-cyan-700">
            <CreditCard size={16} />
            Platform subscription invoices
          </div>
          <CardTitle className="text-2xl font-black">SaaS invoices</CardTitle>
          <CardDescription>
            These invoices are SchoolOS platform billing records. Student fee invoices remain in M3 Fees, and school accounting reports remain in M9 Accounting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <PlatformEmptyState
              icon={FileClock}
              title="No SaaS invoices yet"
              description="Create invoices from the tenant detail billing workflow when needed. No fake billing records are shown here."
            />
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
