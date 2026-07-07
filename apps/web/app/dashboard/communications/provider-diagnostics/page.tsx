'use client';

import type { CommunicationProviderDiagnosticChannel } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileText,
  RefreshCcw,
  Settings,
} from 'lucide-react';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { useSession } from '@/components/session-provider';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { KpiCard, KpiGrid } from '@/components/ui/kpi-card';
import { LoadingState } from '@/components/ui/loading-state';
import { ModuleHeader } from '@/components/ui/module-header';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { PermissionDenied } from '@/components/ui/permission-denied';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { communicationsApi } from '@/lib/api/communications';

export default function ProviderDiagnosticsPage() {
  const { session } = useSession();
  const permissions = new Set(session?.user.permissions ?? []);
  const canReadDeliveries = permissions.has('communications:read_deliveries');

  const diagnosticsQuery = useQuery({
    queryKey: ['communications', 'provider-diagnostics'],
    queryFn: communicationsApi.getCommunicationsProviderDiagnostics,
    enabled: canReadDeliveries,
  });
  const diagnostics = diagnosticsQuery.data;

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Provider Diagnostics"
        description="Review notification delivery health, failures, retries, and callback status."
      >
        <KpiGrid className="sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Provider Mode"
            loading={diagnosticsQuery.isLoading}
            value={diagnostics ? formatMode(diagnostics.overallMode) : 'Unavailable'}
            icon={<Settings size={20} />}
            tone={
              diagnostics?.overallMode === 'configured' ? 'success' : 'neutral'
            }
            description="Allowed modes are disabled, dev log, mock, or configured."
          />
          <KpiCard
            title="Health"
            loading={diagnosticsQuery.isLoading}
            value={diagnostics ? formatMode(diagnostics.health) : 'Unavailable'}
            icon={<Activity size={20} />}
            tone={
              diagnostics?.health === 'degraded'
                ? 'warning'
                : diagnostics?.health === 'healthy'
                  ? 'success'
                  : 'neutral'
            }
            description="Current delivery health across channels."
          />
          <KpiCard
            title="Failed"
            loading={diagnosticsQuery.isLoading}
            value={
              diagnostics
                ? diagnostics.channels.reduce(
                    (total, channel) => total + channel.failedCount,
                    0,
                  )
                : 'Unavailable'
            }
            icon={<AlertTriangle size={20} />}
            tone={
              diagnostics?.channels.some((channel) => channel.failedCount > 0)
                ? 'danger'
                : 'neutral'
            }
            description="Failed delivery records across channels."
          />
          <KpiCard
            title="Retryable"
            loading={diagnosticsQuery.isLoading}
            value={
              diagnostics
                ? diagnostics.channels.reduce(
                    (total, channel) => total + channel.retryableCount,
                    0,
                  )
                : 'Unavailable'
            }
            icon={<RefreshCcw size={20} />}
            tone={
              diagnostics?.channels.some(
                (channel) => channel.retryableCount > 0,
              )
                ? 'warning'
                : 'neutral'
            }
            description="Failed or retry-pending records."
          />
        </KpiGrid>
      </ModuleHeader>

      <ModuleTabs
        items={[
          {
            href: '/dashboard/communications',
            label: 'Notices',
            icon: FileText,
          },
          {
            href: '/dashboard/communications/provider-diagnostics',
            label: 'Provider Diagnostics',
            icon: Settings,
          },
        ]}
        accentColor="rose"
        variant="light"
      />

      {!canReadDeliveries ? (
        <PermissionDenied
          showNavigation={false}
          className="mt-6"
          title="Provider diagnostics are restricted"
          description="You do not have permission to view notification delivery diagnostics."
        />
      ) : (
        <SectionCard
          className="mt-6"
          title="Channel Health"
          description="Email, SMS, and push delivery health for this school."
        >
          {diagnosticsQuery.isLoading ? (
            <LoadingState label="Loading provider diagnostics..." />
          ) : diagnosticsQuery.isError ? (
            <ErrorState
              title="Provider diagnostics unavailable"
              message="Safe provider diagnostics could not be loaded. Try again."
              onRetry={() => void diagnosticsQuery.refetch()}
            />
          ) : diagnostics?.channels.length ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {diagnostics.channels.map((channel) => (
                <ProviderChannelCard key={channel.channel} channel={channel} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No provider diagnostics"
              description="No notification provider channels are available for this school."
            />
          )}
        </SectionCard>
      )}
    </DashboardPageShell>
  );
}

function ProviderChannelCard({
  channel,
}: {
  channel: CommunicationProviderDiagnosticChannel;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-black text-slate-950">{channel.label}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {channel.channel}
          </p>
        </div>
        <StatusBadge
          status={channel.health}
          label={formatMode(channel.health)}
          tone={
            channel.health === 'healthy'
              ? 'approved'
              : channel.health === 'degraded'
                ? 'pending'
                : 'inactive'
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <DiagnosticStat label="Mode" value={formatMode(channel.mode)} />
        <DiagnosticStat
          label="Callback"
          value={formatMode(channel.callbackStatus)}
        />
        <DiagnosticStat label="Deliveries" value={channel.deliveryCount} />
        <DiagnosticStat label="Sent" value={channel.sentCount} />
        <DiagnosticStat label="Failed" value={channel.failedCount} />
        <DiagnosticStat label="Retryable" value={channel.retryableCount} />
      </div>

      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="flex items-start gap-2">
          {channel.health === 'healthy' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
          )}
          <p className="text-xs font-semibold leading-5 text-slate-600">
            {channel.message}
          </p>
        </div>
      </div>
    </div>
  );
}

function DiagnosticStat({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-950">
        {value ?? 'Unavailable'}
      </p>
    </div>
  );
}

function formatMode(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
