'use client';

import type { ReactNode } from 'react';
import {
  Building2,
  CircleAlert,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSession } from '../session-provider';

export type SettingsAccessState =
  | 'can-manage'
  | 'view-only'
  | 'no-access'
  | 'platform-managed';

export type SettingsMetadataItem = {
  label: string;
  icon?: ReactNode;
};

export type SettingsPageHeaderProps = {
  title: string;
  description: string;
  scope: { type: 'personal' | 'school' | 'platform'; label: string };
  access: SettingsAccessState;
  status?: string;
  actions?: ReactNode;
};

const ACCESS_LABELS: Record<SettingsAccessState, string> = {
  'can-manage': 'Can manage',
  'view-only': 'View-only',
  'no-access': 'No access',
  'platform-managed': 'Platform managed',
};

export function SettingsPageHeader({
  title,
  description,
  scope,
  access,
  status,
  actions,
}: SettingsPageHeaderProps) {
  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      <SettingsMetadata
        items={[
          {
            label: scope.label,
            icon:
              scope.type === 'personal' ? (
                <UserRound className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Building2 className="h-4 w-4" aria-hidden="true" />
              ),
          },
          {
            label: ACCESS_LABELS[access],
            icon:
              access === 'platform-managed' ? (
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              ),
          },
          ...(status
            ? [
                {
                  label: status,
                },
              ]
            : []),
        ]}
      />
    </header>
  );
}

export function SchoolSettingsPageHeader({
  title,
  description,
  access,
  status,
  actions,
}: Omit<SettingsPageHeaderProps, 'scope'>) {
  const { session } = useSession();
  const schoolName = session?.tenant.name ?? 'Current school';

  return (
    <SettingsPageHeader
      title={title}
      description={description}
      scope={{
        type: 'school',
        label: `School setting · ${schoolName}`,
      }}
      access={access}
      status={status}
      actions={actions}
    />
  );
}

export function SettingsMetadata({
  items,
  className,
}: {
  items: SettingsMetadataItem[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid overflow-hidden rounded-xl border border-slate-200 bg-white text-sm text-slate-600 sm:flex sm:flex-wrap',
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-h-11 items-center gap-2 border-b border-slate-100 px-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
        >
          {item.icon}
          <dt className="sr-only">Setting metadata</dt>
          <dd className="font-medium">{item.label}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SettingsPermissionNotice({
  access,
  title,
  description,
}: {
  access: Exclude<SettingsAccessState, 'can-manage'>;
  title?: string;
  description?: string;
}) {
  const content =
    access === 'view-only'
      ? {
          title: 'View-only access',
          description:
            'You can review this setting, but your role cannot change it.',
        }
      : access === 'platform-managed'
        ? {
            title: 'Platform managed',
            description:
              'SchoolOS manages this setting to preserve a consistent security boundary.',
          }
        : {
            title: 'No access',
            description:
              'Your current role cannot review or change this setting.',
          };

  return (
    <div
      role={access === 'no-access' ? 'alert' : 'status'}
      className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950"
    >
      <CircleAlert
        className="mt-0.5 h-5 w-5 shrink-0 text-blue-700"
        aria-hidden="true"
      />
      <div>
        <p className="font-semibold">{title ?? content.title}</p>
        <p className="mt-1 leading-6">{description ?? content.description}</p>
      </div>
    </div>
  );
}
