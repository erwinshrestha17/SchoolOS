'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FileClock, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { api } from '../../lib/api';
import { useSession } from '../session-provider';
import { ErrorState } from '../ui/error-state';
import {
  SettingsPageHeader,
  SettingsPermissionNotice,
} from './settings-page-header';

export function ActivityConsentSettingsWorkspace() {
  const { session } = useSession();
  const permissions = session?.user.permissions ?? [];
  const canReviewStoredPreference = permissions.includes('settings:read');
  const storedSettingsQuery = useQuery({
    queryKey: ['school-settings', 'all'],
    queryFn: api.getTenantSettings,
    enabled: canReviewStoredPreference,
  });

  const storedSetting = storedSettingsQuery.data?.find(
    (setting) => setting.key === 'consent_required_for_media',
  );
  const storedValue =
    typeof storedSetting?.value === 'boolean' ? storedSetting.value : null;
  const storedPreference = !canReviewStoredPreference
    ? {
        value: 'Unavailable to your role',
        description:
          'Your role cannot review the legacy school-specific preference.',
        subdued: false,
      }
    : storedSettingsQuery.isLoading
      ? {
          value: 'Loading…',
          description:
            'Checking whether a legacy school-specific preference is stored.',
          subdued: false,
        }
      : storedSettingsQuery.isError
        ? {
            value: 'Unavailable',
            description:
              'The stored school-specific preference could not be reviewed.',
            subdued: false,
          }
        : storedValue === null
          ? {
              value: 'Not configured',
              description: 'No school-specific override is configured.',
              subdued: false,
            }
          : {
              value: storedValue ? 'Consent required' : 'Consent not required',
              description:
                'A legacy school preference is stored, but it does not override current publishing protection.',
              subdued: true,
            };
  const canOpenActivity = permissions.some(
    (permission) =>
      permission === 'activity_feed:read' ||
      permission === 'activity_feed:create',
  );
  const canOpenHistory =
    permissions.includes('settings:audit:read') ||
    permissions.includes('settings:manage');
  const schoolName = session?.tenant.name ?? 'Current school';

  return (
    <div className="space-y-6 p-4 pb-20 sm:p-6 lg:p-7">
      <SettingsPageHeader
        title="Activity, media & consent"
        description="Control whether recorded consent is required before student photos or videos can be published to families."
        scope={{
          type: 'school',
          label: `School setting · ${schoolName}`,
        }}
        access="platform-managed"
        status="Using platform default"
        actions={
          <>
            {canOpenActivity ? (
              <Link
                href="/dashboard/activity"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open Activity
              </Link>
            ) : null}
            {canOpenHistory ? (
              <Link
                href="/dashboard/settings/system/audit-log"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
              >
                <FileClock className="h-4 w-4" aria-hidden="true" />
                Change history
              </Link>
            ) : null}
          </>
        }
      />

      <SettingsPermissionNotice
        access="platform-managed"
        description="SchoolOS currently requires recorded guardian consent before student photos or videos can be published. This effective protection cannot be weakened from school settings."
      />

      <section
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        aria-labelledby="media-consent-policy-title"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h3
            id="media-consent-policy-title"
            className="font-semibold text-slate-950"
          >
            Media consent policy
          </h3>
        </div>
        <dl className="divide-y divide-slate-100">
          <PolicyFact
            icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
            label="Require media consent"
            description="Block publishing student photos and videos when recorded consent is unavailable."
            value="Required"
          />
          <PolicyFact
            label="Source"
            description="The source that currently determines publishing behaviour."
            value="SchoolOS platform policy"
          />
          <PolicyFact
            label="School-specific configuration"
            description={storedPreference.description}
            value={storedPreference.value}
            subdued={storedPreference.subdued}
          />
        </dl>
      </section>

      {storedSettingsQuery.isError ? (
        <ErrorState
          title="Saved school preference unavailable"
          message="The effective platform policy is still shown above, but the stored school-specific preference could not be reviewed."
          error={storedSettingsQuery.error}
          onRetry={() => void storedSettingsQuery.refetch()}
          className="min-h-[160px]"
        />
      ) : null}
    </div>
  );
}

function PolicyFact({
  icon,
  label,
  description,
  value,
  subdued = false,
}: {
  icon?: ReactNode;
  label: string;
  description: string;
  value: string;
  subdued?: boolean;
}) {
  return (
    <div className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
      <dt className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        {icon ? <span className="text-slate-500">{icon}</span> : null}
        {label}
      </dt>
      <dd className="text-sm leading-6 text-slate-600 sm:col-start-1">
        {description}
      </dd>
      <dd
        className={`text-sm font-semibold sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:self-center ${
          subdued ? 'text-amber-700' : 'text-slate-950'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
