'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarCheck,
  ClipboardList,
  Images,
  Megaphone,
  Settings,
  UserPlus,
  Users,
  Wallet,
  Calculator,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import type {
  ActivityPost,
  AdmissionSummary,
  NoticeSummary,
  ReceiptView,
} from '@schoolos/core';
import { api } from '../../lib/api';
import { StatCard } from '../../components/ui/stat-card';
import { SectionCard } from '../../components/ui/section-card';
import { TeacherDashboard } from '../../components/academics/teacher-dashboard';
import { EmptyState } from '../../components/ui/empty-state';
import { LoadingState } from '../../components/ui/loading-state';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/utils';
import { useSession } from '../../components/session-provider';
import { formatSchoolDate, normalizeActivityDate } from '../../lib/date-utils';

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function DashboardPage() {
  const { session, status } = useSession();

  const academicYearsQuery = useQuery({
    queryKey: ['dashboard-academic-years'],
    queryFn: api.listAcademicYears,
    enabled: status === 'authenticated',
  });
  const classesQuery = useQuery({
    queryKey: ['dashboard-classes'],
    queryFn: api.listClasses,
    enabled: status === 'authenticated',
  });
  const feePlansQuery = useQuery({
    queryKey: ['dashboard-fee-plans'],
    queryFn: api.listFeePlans,
    enabled: status === 'authenticated',
  });
  const studentsQuery = useQuery({
    queryKey: ['dashboard-students'],
    queryFn: () => api.listStudents({ limit: 1000 }),
    enabled: status === 'authenticated',
  });
  const admissionsQuery = useQuery({
    queryKey: ['dashboard-admissions'],
    queryFn: () => api.listAdmissions({ limit: 10 }),
    enabled: status === 'authenticated',
  });
  const attendanceQuery = useQuery({
    queryKey: ['dashboard-attendance-analytics'],
    queryFn: api.listAttendanceAnalytics,
    enabled: status === 'authenticated',
  });
  const invoicesQuery = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: api.listInvoices,
    enabled: status === 'authenticated',
  });
  const defaultersQuery = useQuery({
    queryKey: ['dashboard-defaulters'],
    queryFn: () => api.listDefaulters(),
    enabled: status === 'authenticated',
  });
  const receiptsQuery = useQuery({
    queryKey: ['dashboard-receipts'],
    queryFn: api.listReceipts,
    enabled: status === 'authenticated',
  });
  const activityPostsQuery = useQuery({
    queryKey: ['dashboard-activity-posts'],
    queryFn: () => api.listActivityPosts(),
    enabled: status === 'authenticated',
  });
  const noticesQuery = useQuery({
    queryKey: ['dashboard-notices'],
    queryFn: api.listNotices,
    enabled: status === 'authenticated',
  });
  const deliveriesQuery = useQuery({
    queryKey: ['dashboard-notification-deliveries'],
    queryFn: api.listNotificationDeliveries,
    enabled: status === 'authenticated',
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

  const totalStudents = studentsQuery.data?.total ?? 0;
  const todayTotals = attendanceQuery.data?.todaySummary.totals;
  const totalMarkedToday = todayTotals?.totalStudents ?? 0;
  const attendancePercent =
    totalMarkedToday > 0
      ? Math.round(((todayTotals?.present ?? 0) / totalMarkedToday) * 100)
      : 0;

  const collectedThisMonth = sumReceiptsThisMonth(receiptsQuery.data ?? []);
  const collectedToday = sumReceiptsToday(receiptsQuery.data ?? []);
  const outstandingFees = sumOutstandingFees(
    defaultersQuery.data ?? [],
    invoicesQuery.data ?? [],
  );
  const collectionBase = collectedThisMonth + outstandingFees;
  const collectionRate =
    collectionBase > 0
      ? Math.round((collectedThisMonth / collectionBase) * 100)
      : 0;
  const recentAdmissions = admissionsQuery.data?.items ?? [];

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
  const todayLabel = formatSchoolDate(new Date(), 'BOTH');

  const operationalAlerts = [
    ...setupWarnings.map((warning) => ({
      tone: 'warning' as const,
      title: warning,
      body: 'Finish setup in Settings before running a live school day.',
      href: '/dashboard/settings',
      cta: 'Open Settings',
    })),
    ...(totalMarkedToday === 0
      ? [
          {
            tone: 'warning' as const,
            title: 'Attendance not marked today',
            body: 'Make sure to mark attendance for all classes today.',
            href: '/dashboard/attendance',
            cta: 'Mark Attendance',
          },
        ]
      : []),
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
            href: '/dashboard/fees',
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
  ];

  const isInitialLoading =
    academicYearsQuery.isLoading ||
    classesQuery.isLoading ||
    studentsQuery.isLoading ||
    attendanceQuery.isLoading ||
    receiptsQuery.isLoading;

  if (isInitialLoading) {
    return <LoadingState variant="page" label="Gathering school insights..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Setup needs attention */}
      <header className="rounded-2xl border border-[var(--color-mod-dashboard-border)] bg-white px-5 py-6 shadow-sm lg:px-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-mod-dashboard-text)]">
              School day header
            </p>
            <h1 className="mt-2 text-[30px] font-extrabold leading-[38px] text-slate-950 sm:text-[36px] sm:leading-[44px]">
              School Dashboard
            </h1>
            <p className="mt-3 text-sm leading-[22px] text-slate-600 sm:text-base sm:leading-[26px]">
              Namaste,{' '}
              <span className="font-bold text-slate-950">
                {session?.user.email?.split('@')[0] ?? 'User'}
              </span>
              . Here is what needs attention across{' '}
              <span className="font-bold text-slate-950">
                {session?.tenant.name}
              </span>{' '}
              today.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="info">
                {currentAcademicYear?.name ?? 'Academic year not set'}
              </Badge>
              <Badge variant="neutral">{todayLabel}</Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--color-mod-dashboard-border)] bg-[var(--color-mod-dashboard-bg)] p-3">
              <DashboardHeroMetric
                label="Alerts"
                value={operationalAlerts.length}
              />
              <DashboardHeroMetric label="Queued" value={queuedDeliveries} />
              <DashboardHeroMetric label="Sent" value={sentDeliveries} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard/admissions"
                className="flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-dashboard-accent)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[var(--color-mod-dashboard-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-dashboard-border)] focus:ring-offset-2"
              >
                <UserPlus size={18} />
                New Admission
              </Link>
              <Link
                href="/dashboard/attendance"
                className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-mod-dashboard-border)] hover:text-[var(--color-mod-dashboard-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-dashboard-border)] focus:ring-offset-2"
              >
                <CalendarCheck size={18} />
                Mark Attendance
              </Link>
            </div>
          </div>
        </div>
      </header>

      {session?.user.roles.includes('teacher') && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-1 w-8 bg-[var(--color-mod-dashboard-accent)] rounded-full" />
            <h2 className="text-xl font-black text-slate-900">
              Teacher Insights
            </h2>
          </div>
          <TeacherDashboard />
        </section>
      )}

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value={totalStudents}
          icon={<Users size={20} />}
          loading={studentsQuery.isLoading}
          tone="dashboard"
          href="/dashboard/students"
        />
        <StatCard
          title="Today's Attendance"
          value={`${attendancePercent}%`}
          icon={<CalendarCheck size={20} />}
          loading={attendanceQuery.isLoading}
          tone={attendancePercent >= 80 ? 'success' : 'warning'}
          trend={{
            value: attendancePercent,
            label: 'Presence rate',
            isUp: attendancePercent >= 80,
          }}
          href="/dashboard/attendance"
        />
        <StatCard
          title="Fee Collected Today"
          value={formatMoney(collectedToday)}
          icon={<Wallet size={20} />}
          loading={receiptsQuery.isLoading}
          tone="success"
          href="/dashboard/fees"
        />
        <StatCard
          title="Outstanding Fees"
          value={formatMoney(outstandingFees)}
          icon={<Calculator size={20} />}
          loading={defaultersQuery.isLoading}
          tone={outstandingFees > 0 ? 'danger' : 'neutral'}
          href="/dashboard/fees"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <div className="space-y-6">
        {operationalAlerts.length > 0 ? (
          <SectionCard
            title="Attention Required"
            description="Operational items that need a school staff decision today."
          >
            <div className="grid gap-3 md:grid-cols-3">
              {operationalAlerts.slice(0, 3).map((alert) => (
                <Link
                  key={alert.title}
                  href={alert.href}
                  className={cn(
                    'group rounded-xl border p-4 text-sm transition hover:-translate-y-0.5',
                    alertToneStyles[alert.tone],
                  )}
                >
                  <p className="font-bold">{alert.title}</p>
                  <p className="mt-1 opacity-85">{alert.body}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide">
                    {alert.cta}
                    <ArrowRight
                      size={13}
                      className="transition group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              ))}
            </div>
          </SectionCard>
        ) : (
          <SectionCard
            title="No alerts available yet"
            description="Setup, attendance, fees, and communication alerts will appear here."
          >
            <p className="text-sm text-slate-500">
              Setup, attendance, fee, and communication alerts will appear here.
            </p>
          </SectionCard>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Attendance Snapshot" description="Today's presence summary">
          <div className="space-y-6">
            <div className="flex items-end gap-2">
              <span className="text-[36px] font-extrabold leading-[44px] text-slate-900 tabular-nums">
                {attendancePercent}%
              </span>
              <span className="mb-1 text-sm font-bold text-slate-400">
                Presence
              </span>
            </div>

            <div className="space-y-4">
              <AttendanceRow
                label="Present"
                count={todayTotals?.present ?? 0}
                total={totalMarkedToday}
                color="bg-success-500"
              />
              <AttendanceRow
                label="Absent"
                count={todayTotals?.absent ?? 0}
                total={totalMarkedToday}
                color="bg-danger-500"
              />
              <AttendanceRow
                label="Late"
                count={todayTotals?.late ?? 0}
                total={totalMarkedToday}
                color="bg-warning-500"
              />
            </div>
            <Link
              href="/dashboard/attendance"
              className="mt-4 block text-center text-sm font-bold text-[var(--color-mod-dashboard-accent)] hover:text-[var(--color-mod-dashboard-text)]"
            >
              View Detailed Reports
            </Link>
          </div>
        </SectionCard>

        <SectionCard title="Fee Snapshot" description="Monthly target tracking">
          <div className="space-y-6">
            <div className="flex items-end gap-2">
              <span className="text-2xl font-extrabold leading-8 text-slate-900 tabular-nums">
                {formatMoney(collectedThisMonth)}
              </span>
              <span className="mb-0.5 text-sm font-bold text-slate-400">
                Collected
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[0.65rem]">
                    Collection Target
                  </span>
                  <span className="font-bold text-slate-900">
                    {collectionRate}%
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[var(--color-mod-dashboard-accent)] transition-all duration-1000"
                    style={{
                      width: `${Math.min(100, collectionRate)}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="rounded-2xl bg-success-50 p-4">
                  <p className="text-[0.65rem] font-bold uppercase tracking-wider text-success-700">
                    Collected
                  </p>
                  <p className="mt-1 font-bold text-success-900">
                    {formatMoney(collectedThisMonth)}
                  </p>
                </div>
                <div className="rounded-2xl bg-danger-50 p-4">
                  <p className="text-[0.65rem] font-bold uppercase tracking-wider text-danger-700">
                    Outstanding
                  </p>
                  <p className="mt-1 font-bold text-danger-900">
                    {formatMoney(outstandingFees)}
                  </p>
                </div>
              </div>
            </div>
            <Link
              href="/dashboard/fees"
              className="mt-4 block text-center text-sm font-bold text-[var(--color-mod-dashboard-accent)] hover:text-[var(--color-mod-dashboard-text)]"
            >
              Manage Collections
            </Link>
          </div>
        </SectionCard>
        </div>

        <SectionCard
          title="Admissions / Student Movement"
          description="Recent admissions and student-record movement from backend data."
        >
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-mod-admissions-border bg-mod-admissions-soft p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-mod-admissions-text">
                Admissions in queue
              </p>
              <p className="mt-2 text-[30px] font-extrabold leading-[38px] text-slate-950 tabular-nums">
                {admissionsQuery.data?.total ?? recentAdmissions.length}
              </p>
              <Link
                href="/dashboard/admissions"
                className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-mod-admissions-text hover:text-[var(--color-mod-dashboard-text)]"
              >
                Open admissions
                <ArrowRight size={14} />
              </Link>
            </div>
            {recentAdmissions.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recentAdmissions.slice(0, 4).map((admission) => (
                  <div
                    key={admission.id}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {admission.fullNameEn}
                      </p>
                      <p className="text-xs leading-[18px] text-slate-500">
                        {admission.sectionName
                          ? `${admission.className} ${admission.sectionName}`
                          : admission.className}
                      </p>
                    </div>
                    <Badge variant="info" className="shrink-0">
                      {admission.latestEnrollment?.status ?? 'Review'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No admissions in queue"
                description="Recent admission records will appear here after staff create them."
                icon={<UserPlus size={32} />}
              />
            )}
          </div>
        </SectionCard>
        </div>

        <aside className="space-y-6">
        <SectionCard
          title="Communication Health"
          description="Notification delivery status from recent backend records."
        >
          <div className="grid grid-cols-3 gap-2">
            <DashboardHeroMetric label="Sent" value={sentDeliveries} />
            <DashboardHeroMetric label="Queued" value={queuedDeliveries} />
            <DashboardHeroMetric label="Failed" value={failedDeliveries} />
          </div>
          <Link
            href="/dashboard/notices"
            className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-[var(--color-mod-dashboard-accent)] hover:text-[var(--color-mod-dashboard-text)]"
          >
            Review notices
            <ArrowRight size={14} />
          </Link>
        </SectionCard>

        <SectionCard title="Dedicated Module Links">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Admissions', href: '/dashboard/admissions', icon: UserPlus },
              { label: 'Attendance', href: '/dashboard/attendance', icon: CalendarCheck },
              { label: 'Fees', href: '/dashboard/fees', icon: Wallet },
              { label: 'Activity Feed', href: '/dashboard/activity', icon: Images },
              { label: 'Notices', href: '/dashboard/notices', icon: Megaphone },
              { label: 'Settings', href: '/dashboard/settings', icon: Settings },
              { label: 'Reports', href: '/dashboard/reports', icon: ClipboardList },
              { label: 'Accounting', href: '/dashboard/accounting', icon: Calculator },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="group flex min-h-[108px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-center transition hover:border-[var(--color-mod-dashboard-border)] hover:bg-[var(--color-mod-dashboard-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-dashboard-border)] focus:ring-offset-2"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-500 shadow-sm transition group-hover:border-[var(--color-mod-dashboard-border)] group-hover:text-[var(--color-mod-dashboard-accent)]">
                  <action.icon size={24} />
                </div>
                <span className="text-center text-xs font-bold text-slate-700 group-hover:text-[var(--color-mod-dashboard-text)]">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Notices & Announcements"
          className="lg:col-span-2"
          headerAction={
            <Link
              href="/dashboard/notices"
              className="text-sm font-bold text-[var(--color-mod-dashboard-accent)] hover:text-[var(--color-mod-dashboard-text)]"
            >
              Go to Communications
            </Link>
          }
        >
          {noticesQuery.data && noticesQuery.data.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {noticesQuery.data.slice(0, 4).map((notice) => (
                <div
                  key={notice.id}
                  className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      notice.priority.toUpperCase() === 'HIGH'
                        ? 'bg-danger-50 text-danger-500'
                        : 'bg-[var(--color-mod-dashboard-bg)] text-[var(--color-mod-dashboard-accent)]',
                    )}
                  >
                    <Megaphone size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {notice.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {notice.audienceType} •{' '}
                      {formatSchoolDate(
                        notice.publishedAt || notice.createdAt,
                        'BOTH',
                      )}
                    </p>
                  </div>
                  <Badge
                    variant={
                      notice.priority.toUpperCase() === 'HIGH'
                        ? 'destructive'
                        : 'neutral'
                    }
                  >
                    {notice.priority}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No active notices"
              description="Important school announcements will appear here."
              icon={<Megaphone size={32} />}
            />
          )}
        </SectionCard>

        <SectionCard
          title="Recent Activity"
          description="Latest operations across modules"
          className="lg:col-span-1"
        >
          <RecentActivityList
            admissions={admissionsQuery.data?.items ?? []}
            receipts={receiptsQuery.data ?? []}
            activityPosts={activityPostsQuery.data ?? []}
            notices={noticesQuery.data ?? []}
          />
        </SectionCard>
        </aside>
      </div>
    </div>
  );
}

const alertToneStyles = {
  warning: 'border-warning-200 bg-warning-50 text-warning-900 hover:bg-warning-100',
  danger: 'border-danger-200 bg-danger-50 text-danger-900 hover:bg-danger-100',
} as const;

function DashboardHeroMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-extrabold leading-none text-slate-950 tabular-nums">
        {value}
      </p>
    </div>
  );
}

function AttendanceRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-900">
          {count}{' '}
          <span className="text-slate-400 font-medium">({percent}%)</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all duration-1000', color)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

type RecentActivityListProps = {
  admissions: AdmissionSummary[];
  receipts: ReceiptView[];
  activityPosts: ActivityPost[];
  notices: NoticeSummary[];
};

type RecentActivityItem = {
  title: string;
  body: string;
  date: string;
  icon: LucideIcon;
  color: string;
  bg: string;
};

function RecentActivityList({
  admissions,
  receipts,
  activityPosts,
  notices,
}: RecentActivityListProps) {
  const items = [
    ...admissions.slice(0, 3).map((admission) => ({
      title: `New Admission: ${admission.fullNameEn}`,
      body: admission.sectionName
        ? `${admission.className} ${admission.sectionName}`
        : admission.className,
      date: normalizeActivityDate(admission),
      icon: UserPlus,
      color: 'text-[var(--color-mod-dashboard-accent)]',
      bg: 'bg-[var(--color-mod-dashboard-bg)]',
    })),
    ...receipts.slice(0, 3).map((receipt) => ({
      title: `Fee Collected: ${formatMoney(receipt.amount ?? receipt.payment?.amount ?? 0)}`,
      body: `Receipt #${receipt.receiptNumber}`,
      date: normalizeActivityDate(receipt),
      icon: Wallet,
      color: 'text-success-500',
      bg: 'bg-success-50',
    })),
    ...activityPosts.slice(0, 3).map((post) => ({
      title: `Activity: ${post.title}`,
      body: post.category,
      date: normalizeActivityDate(post),
      icon: Images,
      color: 'text-secondary-500',
      bg: 'bg-secondary-50',
    })),
    ...notices.slice(0, 3).map((notice) => ({
      title: `Notice: ${notice.title}`,
      body: notice.priority,
      date: normalizeActivityDate(notice),
      icon: Megaphone,
      color: 'text-warning-500',
      bg: 'bg-warning-50',
    })),
  ] satisfies RecentActivityItem[];

  const sortedItems = items
    .sort((a, b) => {
      const da = new Date(a.date).getTime() || 0;
      const db = new Date(b.date).getTime() || 0;
      return db - da;
    })
    .slice(0, 6);

  if (sortedItems.length === 0) {
    return (
      <EmptyState
        title="No recent operations yet"
        description="Activity from all modules will appear here once you start using the system."
      />
    );
  }

  return (
    <div className="divide-y divide-slate-50">
      {sortedItems.map((item, idx) => (
        <div
          key={idx}
          className="flex items-center gap-4 py-4 transition first:pt-0 last:pb-0 hover:bg-slate-50/50"
        >
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              item.bg,
              item.color,
            )}
          >
            <item.icon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">
              {item.title}
            </p>
            <p className="truncate text-xs text-slate-500">{item.body}</p>
          </div>
          <div className="text-right">
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
              {formatSchoolDate(item.date, 'BOTH')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function sumReceiptsThisMonth(receipts: ReceiptView[]) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return (receipts || []).reduce((sum, receipt) => {
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
  invoices: Array<{
    status: string;
    totalAmount: number;
    paidAmount?: number;
  }>,
) {
  if (defaulters?.length > 0) {
    return defaulters.reduce((sum, item) => sum + item.outstanding, 0);
  }
  return (invoices || [])
    .filter((invoice) => !['PAID', 'WAIVED'].includes(invoice.status.toUpperCase()))
    .reduce(
      (sum, invoice) =>
        sum + Math.max(0, invoice.totalAmount - (invoice.paidAmount ?? 0)),
      0,
    );
}

function sumReceiptsToday(receipts: ReceiptView[]) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  return (receipts || []).reduce((sum, receipt) => {
    const paidAtDate = new Date(receipt.payment?.paidAt ?? receipt.issuedAt);
    const paidAtStr = paidAtDate.toISOString().slice(0, 10);
    if (paidAtStr !== todayStr) {
      return sum;
    }
    const gross = receipt.amount ?? receipt.payment?.amount ?? 0;
    return sum + Math.max(0, gross - (receipt.refundedAmount ?? 0));
  }, 0);
}
