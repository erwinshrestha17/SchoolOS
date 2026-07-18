'use client';

import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PREFERENCE_CATEGORIES,
  type NotificationChannel,
  type NotificationPreferenceCategory,
  type PermissionKey,
} from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Clock3, RotateCcw, Save } from 'lucide-react';
import { useState } from 'react';
import { communicationsApi } from '@/lib/api/communications';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { ModuleHeader } from '@/components/ui/module-header';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';
import { PermissionDenied } from '@/components/ui/permission-denied';
import { StatusBadge } from '@/components/ui/status-badge';
import { useSession } from '@/components/session-provider';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';

export function NotificationPreferencesWorkspace({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const permissions = new Set<PermissionKey>(session?.user.permissions ?? []);
  const canView = permissions.has('notifications:view_own');
  const [category, setCategory] =
    useState<NotificationPreferenceCategory>('NOTICE');
  const [channel, setChannel] = useState<NotificationChannel>('IN_APP');
  const [enabled, setEnabled] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState<
    boolean | undefined
  >(undefined);

  const preferencesQuery = useQuery({
    queryKey: ['notification-preferences', 'me'],
    queryFn: communicationsApi.getOwnNotificationPreferences,
    enabled: canView,
  });
  const currentOverride = preferencesQuery.data?.overrides.find(
    (item) => item.category === category && item.channel === channel,
  );
  const mandatory = category === 'SECURITY' || category === 'EMERGENCY';

  const saveMutation = useMutation({
    mutationFn: () =>
      communicationsApi.updateOwnNotificationPreference({
        category,
        channel,
        enabled: mandatory ? true : enabled,
        ...(quietHoursEnabled === undefined ? {} : { quietHoursEnabled }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['notification-preferences', 'me'],
      }),
  });
  const resetMutation = useMutation({
    mutationFn: () =>
      communicationsApi.resetOwnNotificationPreference(category, channel),
    onSuccess: async () => {
      setEnabled(true);
      setQuietHoursEnabled(undefined);
      await queryClient.invalidateQueries({
        queryKey: ['notification-preferences', 'me'],
      });
    },
  });

  function selectPair(
    nextCategory: NotificationPreferenceCategory,
    nextChannel: NotificationChannel,
  ) {
    setCategory(nextCategory);
    setChannel(nextChannel);
    const override = preferencesQuery.data?.overrides.find(
      (item) => item.category === nextCategory && item.channel === nextChannel,
    );
    setEnabled(override?.enabled ?? true);
    setQuietHoursEnabled(override?.quietHoursEnabled ?? undefined);
  }

  const content = (
    <>
      {embedded ? (
        <SettingsPageHeader
          title="Notifications"
          description="Choose allowed personal channels while keeping mandatory school safety and security messages enabled."
          scope={{ type: 'personal', label: 'Personal setting' }}
          access={canView ? 'can-manage' : 'no-access'}
        />
      ) : (
        <ModuleHeader
          eyebrow="Notifications"
          title="Notifications"
          description="Choose allowed personal channels while keeping mandatory school safety and security messages enabled."
        />
      )}
      {!canView ? (
        <PermissionDenied
          showNavigation={false}
          title="Notification preferences are restricted"
          description="Your role cannot view or change this notification inbox preference."
        />
      ) : preferencesQuery.isLoading ? (
        <LoadingState label="Loading effective notification preferences..." />
      ) : preferencesQuery.isError ? (
        <ErrorState
          title="Preferences unavailable"
          message="Your current notification preferences could not be loaded."
          onRetry={() => void preferencesQuery.refetch()}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <PreferenceSelect
                label="Category"
                value={category}
                options={NOTIFICATION_PREFERENCE_CATEGORIES}
                onChange={(value) =>
                  selectPair(value as NotificationPreferenceCategory, channel)
                }
              />
              <PreferenceSelect
                label="Channel"
                value={channel}
                options={NOTIFICATION_CHANNELS}
                onChange={(value) =>
                  selectPair(category, value as NotificationChannel)
                }
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-950">
                    Effective preference
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {currentOverride ? 'Personal override' : 'Tenant default'}{' '}
                    for {label(category)} via {label(channel)}.
                  </p>
                </div>
                <StatusBadge
                  status={currentOverride ? 'OVERRIDE' : 'DEFAULT'}
                  label={currentOverride ? 'User override' : 'Tenant default'}
                />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Toggle
                  label="Channel enabled"
                  description={
                    mandatory
                      ? 'Mandatory emergency and security messages cannot be disabled.'
                      : 'Turn off only this category and channel combination.'
                  }
                  checked={mandatory ? true : enabled}
                  disabled={mandatory}
                  onChange={setEnabled}
                />
                <Toggle
                  label="Use quiet hours"
                  description="Delay eligible messages during the school’s Nepal-time quiet-hours window."
                  checked={
                    quietHoursEnabled ??
                    preferencesQuery.data!.tenantDefaults.quietHoursEnabled
                  }
                  disabled={mandatory}
                  onChange={setQuietHoursEnabled}
                />
              </div>
            </div>

            {saveMutation.isError || resetMutation.isError ? (
              <p
                role="alert"
                className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700"
              >
                The preference could not be updated. Your last saved setting is
                still active.
              </p>
            ) : null}
            {saveMutation.isSuccess ? (
              <p
                role="status"
                className="rounded-xl border border-success-200 bg-success-50 p-3 text-sm text-success-700"
              >
                Preference saved.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saveMutation.isPending || resetMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                <Save size={16} />{' '}
                {saveMutation.isPending ? 'Saving...' : 'Save preference'}
              </button>
              <button
                type="button"
                disabled={
                  !currentOverride ||
                  saveMutation.isPending ||
                  resetMutation.isPending
                }
                onClick={() => resetMutation.mutate()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                <RotateCcw size={16} />{' '}
                {resetMutation.isPending
                  ? 'Resetting...'
                  : 'Reset to tenant default'}
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Clock3 size={18} />
                <h2 className="font-bold text-slate-950">Quiet hours</h2>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                <Fact label="Timezone" value="Nepal time (Asia/Kathmandu)" />
                <Fact
                  label="Starts"
                  value={preferencesQuery.data!.tenantDefaults.quietHoursStart}
                />
                <Fact
                  label="Ends"
                  value={preferencesQuery.data!.tenantDefaults.quietHoursEnd}
                />
              </dl>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                The school owns this time window. Eligible jobs re-check the
                current policy when delivery runs.
              </p>
            </section>
            <section className="rounded-2xl border border-info-200 bg-info-50 p-5 text-sm text-info-900">
              <div className="flex gap-3">
                <BellRing className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  Critical messages may bypass quiet hours. Mandatory emergency
                  and security rules remain backend-enforced.
                </p>
              </div>
            </section>
          </aside>
        </div>
      )}
    </>
  );

  return embedded ? (
    <div className="space-y-6 p-4 pb-20 sm:p-6 lg:p-7">{content}</div>
  ) : (
    <DashboardPageShell>{content}</DashboardPageShell>
  );
}

function PreferenceSelect({
  label: title,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {title}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {label(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label: title,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1"
      />
      <span>
        <span className="block text-sm font-bold text-slate-900">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>
    </label>
  );
}

function Fact({ label: title, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{title}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function label(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}
