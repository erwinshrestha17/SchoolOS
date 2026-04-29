'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  Images,
  Megaphone,
  Settings,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '../../lib/api';

const moneyFormatter = new Intl.NumberFormat('en-NP', {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('en-NP', {
  dateStyle: 'medium',
});

export default function DashboardPage() {
  const academicYearsQuery = useQuery({
    queryKey: ['dashboard-academic-years'],
    queryFn: api.listAcademicYears,
  });
  const classesQuery = useQuery({
    queryKey: ['dashboard-classes'],
    queryFn: api.listClasses,
  });
  const feePlansQuery = useQuery({
    queryKey: ['dashboard-fee-plans'],
    queryFn: api.listFeePlans,
  });
  const studentsQuery = useQuery({
    queryKey: ['dashboard-students'],
    queryFn: api.listStudents,
  });
  const admissionsQuery = useQuery({
    queryKey: ['dashboard-admissions'],
    queryFn: api.listAdmissions,
  });
  const attendanceQuery = useQuery({
    queryKey: ['dashboard-attendance-analytics'],
    queryFn: api.listAttendanceAnalytics,
  });
  const invoicesQuery = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: api.listInvoices,
  });
  const defaultersQuery = useQuery({
    queryKey: ['dashboard-defaulters'],
    queryFn: () => api.listDefaulters(),
  });
  const receiptsQuery = useQuery({
    queryKey: ['dashboard-receipts'],
    queryFn: api.listReceipts,
  });
  const activityPostsQuery = useQuery({
    queryKey: ['dashboard-activity-posts'],
    queryFn: api.listActivityPosts,
  });
  const noticesQuery = useQuery({
    queryKey: ['dashboard-notices'],
    queryFn: api.listNotices,
  });
  const deliveriesQuery = useQuery({
    queryKey: ['dashboard-notification-deliveries'],
    queryFn: api.listNotificationDeliveries,
  });

  const currentAcademicYear =
    academicYearsQuery.data?.find((year) => year.isCurrent) ??
    academicYearsQuery.data?.[0] ??
    null;
  const classCount = classesQuery.data?.length ?? 0;
  const activeFeePlanCount =
    feePlansQuery.data?.filter((plan) => plan.isActive).length ?? 0;
  const setupWarnings = [
    !currentAcademicYear ? 'Create an academic year' : null,
    classCount === 0 ? 'Create at least one class' : null,
    activeFeePlanCount === 0 ? 'Configure an active fee plan' : null,
  ].filter(Boolean) as string[];

  const totalStudents = studentsQuery.data?.length ?? 0;
  const todayTotals = attendanceQuery.data?.todaySummary.totals;
  const totalMarkedToday = todayTotals?.totalStudents ?? 0;
  const attendancePercent =
    totalMarkedToday > 0
      ? Math.round(((todayTotals?.present ?? 0) / totalMarkedToday) * 100)
      : 0;
  const collectedThisMonth = sumReceiptsThisMonth(receiptsQuery.data ?? []);
  const outstandingFees = sumOutstandingFees(
    defaultersQuery.data ?? [],
    invoicesQuery.data ?? [],
  );
  const failedDeliveries =
    deliveriesQuery.data?.filter(
      (delivery) => delivery.status.toUpperCase() === 'FAILED',
    ).length ?? 0;
  const queuedDeliveries =
    deliveriesQuery.data?.filter((delivery) =>
      ['PENDING', 'QUEUED', 'RETRYING'].includes(delivery.status.toUpperCase()),
    ).length ?? 0;
  const sentDeliveries =
    deliveriesQuery.data?.filter(
      (delivery) => delivery.status.toUpperCase() === 'SENT',
    ).length ?? 0;

  const operationalAlerts = [
    ...setupWarnings.map((warning) => ({
      tone: 'warning' as const,
      title: warning,
      body: 'Finish setup in Settings before running a live school day.',
      href: '/dashboard/settings',
      cta: 'Open Settings',
    })),
    ...(attendanceQuery.data?.below80Warnings?.length
      ? [
          {
            tone: 'danger' as const,
            title: `${attendanceQuery.data.below80Warnings.length} attendance risk${attendanceQuery.data.below80Warnings.length === 1 ? '' : 's'}`,
            body: 'Students below 80% attendance need follow-up.',
            href: '/dashboard/attendance',
            cta: 'Review Attendance',
          },
        ]
      : []),
    ...((defaultersQuery.data?.length ?? 0) > 0
      ? [
          {
            tone: 'danger' as const,
            title: `${defaultersQuery.data?.length ?? 0} overdue fee record${defaultersQuery.data?.length === 1 ? '' : 's'}`,
            body: 'Review defaulters and send reminders from Fee Collection.',
            href: '/dashboard/finance',
            cta: 'Open Fees',
          },
        ]
      : []),
    ...(failedDeliveries > 0
      ? [
          {
            tone: 'danger' as const,
            title: `${failedDeliveries} failed notification${failedDeliveries === 1 ? '' : 's'}`,
            body: 'Check delivery status before relying on parent communication.',
            href: '/dashboard/notices',
            cta: 'Review Notices',
          },
        ]
      : []),
    ...(activityPostsQuery.isSuccess && (activityPostsQuery.data?.length ?? 0) === 0
      ? [
          {
            tone: 'neutral' as const,
            title: 'No recent activity posts',
            body: 'Create a classroom activity update to keep guardians engaged.',
            href: '/dashboard/activity',
            cta: 'Create Activity',
          },
        ]
      : []),
  ];

  const recentItems = buildRecentItems({
    admissions: admissionsQuery.data ?? [],
    receipts: receiptsQuery.data ?? [],
    attendanceSessions: attendanceQuery.data?.latestSessions ?? [],
    activityPosts: activityPostsQuery.data ?? [],
    notices: noticesQuery.data ?? [],
    deliveries: deliveriesQuery.data ?? [],
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="label mb-2">Phase 1 Operations</p>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Admin Command Center
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Daily school operations summary for admissions, attendance, fees,
              activity feed, and parent communications.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
              Academic Year
            </p>
            {academicYearsQuery.isLoading ? (
              <SkeletonLine className="mt-2 h-5 w-32" />
            ) : (
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {currentAcademicYear?.name ?? 'Not configured'}
              </p>
            )}
          </div>
        </div>

        {setupWarnings.length > 0 && (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Setup needs attention</p>
                <p className="mt-1 text-amber-800">
                  {setupWarnings.join(' · ')}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/settings"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white"
            >
              Finish Setup
            </Link>
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          accent="bg-primary-500"
          isLoading={studentsQuery.isLoading}
          label="Total Students"
          value={String(totalStudents)}
          detail="Active student profiles"
        />
        <KpiCard
          accent="bg-success-500"
          isLoading={attendanceQuery.isLoading}
          label="Today's Attendance"
          value={`${attendancePercent}%`}
          detail={`${todayTotals?.present ?? 0} present of ${totalMarkedToday}`}
        />
        <KpiCard
          accent="bg-emerald-500"
          isLoading={receiptsQuery.isLoading}
          label="Fee Collected This Month"
          value={formatMoney(collectedThisMonth)}
          detail="Receipt-backed collections"
        />
        <KpiCard
          accent="bg-warning-500"
          isLoading={defaultersQuery.isLoading || invoicesQuery.isLoading}
          label="Outstanding Fees"
          value={formatMoney(outstandingFees)}
          detail={`${defaultersQuery.data?.length ?? 0} overdue record${defaultersQuery.data?.length === 1 ? '' : 's'}`}
        />
        <KpiCard
          accent={failedDeliveries > 0 ? 'bg-danger-500' : 'bg-slate-500'}
          isLoading={deliveriesQuery.isLoading}
          label="Delivery Health"
          value={`${failedDeliveries} failed`}
          detail={`${queuedDeliveries} queued · ${sentDeliveries} sent`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Operational Alerts" error={firstError([
          academicYearsQuery.error,
          classesQuery.error,
          feePlansQuery.error,
          attendanceQuery.error,
          defaultersQuery.error,
          deliveriesQuery.error,
          activityPostsQuery.error,
        ])}>
          {allLoading([
            academicYearsQuery.isLoading,
            classesQuery.isLoading,
            feePlansQuery.isLoading,
            attendanceQuery.isLoading,
            defaultersQuery.isLoading,
            deliveriesQuery.isLoading,
            activityPostsQuery.isLoading,
          ]) ? (
            <StackedSkeleton />
          ) : operationalAlerts.length > 0 ? (
            <div className="space-y-3">
              {operationalAlerts.slice(0, 5).map((alert) => (
                <AlertRow key={`${alert.title}-${alert.href}`} alert={alert} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No alerts available yet"
              body="SchoolOS will surface setup, attendance, fee, notification, and activity risks here as data arrives."
            />
          )}
        </Panel>

        <Panel title="Quick Actions">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {quickActions.map((action) => (
              <Link
              key={`${action.href}-${action.label}`}
                href={action.href}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
              >
                <action.icon className="h-5 w-5 text-gray-400" />
                {action.label}
              </Link>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Panel title="Fee Snapshot">
          <ProgressSummary
            label="Collected vs outstanding"
            value={collectedThisMonth}
            total={collectedThisMonth + outstandingFees}
            valueLabel={formatMoney(collectedThisMonth)}
            totalLabel={formatMoney(outstandingFees)}
          />
        </Panel>

        <Panel title="Attendance Mix">
          <AttendanceBars
            absent={todayTotals?.absent ?? 0}
            late={todayTotals?.late ?? 0}
            leave={todayTotals?.leave ?? 0}
            present={todayTotals?.present ?? 0}
            total={totalMarkedToday}
          />
        </Panel>

        <Panel title="Notification Status">
          <DeliveryBars
            failed={failedDeliveries}
            queued={queuedDeliveries}
            sent={sentDeliveries}
          />
        </Panel>
      </section>

      <Panel title="Recent Activity" error={firstError([
        admissionsQuery.error,
        receiptsQuery.error,
        attendanceQuery.error,
        activityPostsQuery.error,
        noticesQuery.error,
        deliveriesQuery.error,
      ])}>
        {allLoading([
          admissionsQuery.isLoading,
          receiptsQuery.isLoading,
          attendanceQuery.isLoading,
          activityPostsQuery.isLoading,
          noticesQuery.isLoading,
          deliveriesQuery.isLoading,
        ]) ? (
          <StackedSkeleton />
        ) : recentItems.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {recentItems.slice(0, 8).map((item) => (
              <div
                key={`${item.kind}-${item.id}`}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {item.title}
                  </p>
                  <p className="text-sm text-gray-500">{item.body}</p>
                </div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  {item.date ? formatDate(item.date) : item.kind}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No recent operations yet"
            body="Admissions, receipts, attendance sessions, activity posts, and notices will appear here."
            href="/dashboard/settings"
            cta="Open Settings"
          />
        )}
      </Panel>
    </div>
  );
}

function KpiCard({
  accent,
  detail,
  isLoading,
  label,
  value,
}: {
  accent: string;
  detail: string;
  isLoading: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="shell-card p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="label">{label}</p>
        <span className={`h-3 w-3 rounded-full ${accent}`} />
      </div>
      {isLoading ? (
        <div className="space-y-3">
          <SkeletonLine className="h-8 w-24" />
          <SkeletonLine className="h-3 w-36" />
        </div>
      ) : (
        <>
          <p className="text-3xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
          <p className="mt-2 text-sm text-gray-500">{detail}</p>
        </>
      )}
    </div>
  );
}

function Panel({
  children,
  error,
  title,
}: {
  children: React.ReactNode;
  error?: unknown;
  title: string;
}) {
  return (
    <section className="shell-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
      </div>
      {error ? <ErrorCard error={error} /> : children}
    </section>
  );
}

function AlertRow({
  alert,
}: {
  alert: {
    tone: 'danger' | 'neutral' | 'warning';
    title: string;
    body: string;
    href: string;
    cta: string;
  };
}) {
  const toneClass =
    alert.tone === 'danger'
      ? 'border-danger-200 bg-danger-50 text-danger-600'
      : alert.tone === 'warning'
        ? 'border-warning-200 bg-warning-50 text-warning-600'
        : 'border-gray-200 bg-gray-50 text-gray-600';

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">{alert.title}</p>
          <p className="mt-1 text-sm opacity-85">{alert.body}</p>
        </div>
        <Link
          href={alert.href}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-semibold text-gray-900 shadow-sm"
        >
          {alert.cta}
        </Link>
      </div>
    </div>
  );
}

function ProgressSummary({
  label,
  total,
  totalLabel,
  value,
  valueLabel,
}: {
  label: string;
  total: number;
  totalLabel: string;
  value: number;
  valueLabel: string;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-semibold text-gray-900">{percent}%</span>
      </div>
      <div
        className="h-3 rounded-full bg-gray-100"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-3 rounded-full bg-success-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <p>
          <span className="block text-gray-500">Collected</span>
          <span className="font-semibold text-gray-900">{valueLabel}</span>
        </p>
        <p>
          <span className="block text-gray-500">Outstanding</span>
          <span className="font-semibold text-gray-900">{totalLabel}</span>
        </p>
      </div>
    </div>
  );
}

function AttendanceBars({
  absent,
  late,
  leave,
  present,
  total,
}: {
  absent: number;
  late: number;
  leave: number;
  present: number;
  total: number;
}) {
  return (
    <div className="space-y-3">
      {[
        ['Present', present, 'bg-success-500'],
        ['Absent', absent, 'bg-danger-500'],
        ['Late', late, 'bg-warning-500'],
        ['Leave', leave, 'bg-primary-500'],
      ].map(([label, rawValue, color]) => {
        const value = Number(rawValue);
        const percent = total > 0 ? Math.round((value / total) * 100) : 0;

        return (
          <MiniBar
            key={label}
            color={String(color)}
            label={String(label)}
            percent={percent}
            value={String(value)}
          />
        );
      })}
    </div>
  );
}

function DeliveryBars({
  failed,
  queued,
  sent,
}: {
  failed: number;
  queued: number;
  sent: number;
}) {
  const total = failed + queued + sent;

  return (
    <div className="space-y-3">
      <MiniBar
        color="bg-success-500"
        label="Sent"
        percent={total > 0 ? Math.round((sent / total) * 100) : 0}
        value={String(sent)}
      />
      <MiniBar
        color="bg-warning-500"
        label="Queued"
        percent={total > 0 ? Math.round((queued / total) * 100) : 0}
        value={String(queued)}
      />
      <MiniBar
        color="bg-danger-500"
        label="Failed"
        percent={total > 0 ? Math.round((failed / total) * 100) : 0}
        value={String(failed)}
      />
    </div>
  );
}

function MiniBar({
  color,
  label,
  percent,
  value,
}: {
  color: string;
  label: string;
  percent: number;
  value: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-900">{value}</span>
      </div>
      <div
        className="h-2 rounded-full bg-gray-100"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function EmptyState({
  body,
  cta,
  href,
  title,
}: {
  body: string;
  cta?: string;
  href?: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center">
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
        {body}
      </p>
      {href && cta && (
        <Link
          href={href}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white"
        >
          {cta}
        </Link>
      )}
    </div>
  );
}

function ErrorCard({ error }: { error: unknown }) {
  return (
    <div className="rounded-2xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-600">
      <p className="font-semibold">This section could not load.</p>
      <p className="mt-1 opacity-85">
        {error instanceof Error ? error.message : 'Please retry after checking your session.'}
      </p>
    </div>
  );
}

function StackedSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonLine className="h-14 w-full" />
      <SkeletonLine className="h-14 w-full" />
      <SkeletonLine className="h-14 w-4/5" />
    </div>
  );
}

function SkeletonLine({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className}`} />;
}

function sumReceiptsThisMonth(
  receipts: Array<{
    amount?: number;
    issuedAt: string;
    payment?: { amount: number; paidAt: string };
    refundedAmount?: number;
  }>,
) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return receipts.reduce((sum, receipt) => {
    const paidAt = new Date(receipt.payment?.paidAt ?? receipt.issuedAt);

    if (
      paidAt.getMonth() !== currentMonth ||
      paidAt.getFullYear() !== currentYear
    ) {
      return sum;
    }

    const gross = receipt.amount ?? receipt.payment?.amount ?? 0;
    return sum + Math.max(0, gross - (receipt.refundedAmount ?? 0));
  }, 0);
}

function sumOutstandingFees(
  defaulters: Array<{ outstanding: number }>,
  invoices: Array<{ paidAmount?: number; status: string; totalAmount: number }>,
) {
  if (defaulters.length > 0) {
    return defaulters.reduce((sum, item) => sum + item.outstanding, 0);
  }

  return invoices
    .filter((invoice) => !['PAID', 'WAIVED'].includes(invoice.status.toUpperCase()))
    .reduce(
      (sum, invoice) =>
        sum + Math.max(0, invoice.totalAmount - (invoice.paidAmount ?? 0)),
      0,
    );
}

function buildRecentItems({
  activityPosts,
  admissions,
  attendanceSessions,
  deliveries,
  notices,
  receipts,
}: {
  activityPosts: Array<{
    id: string;
    title: string;
    category: string;
    publishedAt: string | null;
  }>;
  admissions: Array<{
    id: string;
    fullNameEn: string;
    studentSystemId: string;
    latestEnrollment: { academicYear: string } | null;
  }>;
  attendanceSessions: Array<{
    sessionId: string;
    attendanceDate: string;
    className: string;
    sectionName: string | null;
    submittedAt: string | null;
  }>;
  deliveries: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  notices: Array<{
    id: string;
    title: string;
    priority: string;
    createdAt?: string;
    publishedAt: string | null;
  }>;
  receipts: Array<{
    id: string;
    receiptNumber: string;
    issuedAt: string;
    amount?: number;
    student?: { name: string };
  }>;
}) {
  return [
    ...admissions.slice(0, 3).map((item) => ({
      id: item.id,
      kind: 'Admission',
      title: `Admitted ${item.fullNameEn}`,
      body: `${item.studentSystemId}${item.latestEnrollment ? ` · ${item.latestEnrollment.academicYear}` : ''}`,
      date: null,
    })),
    ...receipts.slice(0, 3).map((item) => ({
      id: item.id,
      kind: 'Receipt',
      title: `Receipt ${item.receiptNumber}`,
      body: `${item.student?.name ?? 'Student'} · ${formatMoney(item.amount ?? 0)}`,
      date: item.issuedAt,
    })),
    ...attendanceSessions.slice(0, 3).map((item) => ({
      id: item.sessionId,
      kind: 'Attendance',
      title: `Attendance submitted for ${item.className}`,
      body: item.sectionName ? `Section ${item.sectionName}` : 'Class session',
      date: item.submittedAt ?? item.attendanceDate,
    })),
    ...activityPosts.slice(0, 3).map((item) => ({
      id: item.id,
      kind: 'Activity',
      title: item.title,
      body: item.category.replace(/_/g, ' '),
      date: item.publishedAt,
    })),
    ...notices.slice(0, 3).map((item) => ({
      id: item.id,
      kind: 'Notice',
      title: item.title,
      body: `${item.priority.toLowerCase()} priority`,
      date: item.publishedAt ?? item.createdAt ?? null,
    })),
    ...deliveries.slice(0, 3).map((item) => ({
      id: item.id,
      kind: 'Delivery',
      title: item.title,
      body: `Delivery ${item.status.toLowerCase()}`,
      date: item.createdAt,
    })),
  ].sort((first, second) => {
    const firstTime = first.date ? new Date(first.date).getTime() : 0;
    const secondTime = second.date ? new Date(second.date).getTime() : 0;
    return secondTime - firstTime;
  });
}

function formatMoney(amount: number) {
  return `Rs. ${moneyFormatter.format(amount)}`;
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

function firstError(errors: unknown[]) {
  return errors.find(Boolean);
}

function allLoading(values: boolean[]) {
  return values.every(Boolean);
}

const quickActions = [
  {
    href: '/dashboard/admissions/create',
    label: 'Admit Student',
    icon: UserPlus,
  },
  {
    href: '/dashboard/admissions',
    label: 'View Students',
    icon: Users,
  },
  {
    href: '/dashboard/attendance',
    label: 'Mark Attendance',
    icon: CalendarCheck,
  },
  {
    href: '/dashboard/finance/collect',
    label: 'Collect Fee',
    icon: Wallet,
  },
  {
    href: '/dashboard/activity/create',
    label: 'Create Activity Post',
    icon: Images,
  },
  {
    href: '/dashboard/notices/create',
    label: 'Create Notice',
    icon: Megaphone,
  },
  {
    href: '/dashboard/notices/deliveries',
    label: 'Review Deliveries',
    icon: Bell,
  },
  {
    href: '/dashboard/settings',
    label: 'Open Settings',
    icon: Settings,
  },
];