'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarCheck,
  Images,
  Megaphone,
  UserPlus,
  Users,
  Wallet,
  Calculator,
  ArrowRight,
  TrendingUp,
  School,
} from 'lucide-react';
import { api } from '../../lib/api';
import { StatCard } from '../../components/ui/stat-card';
import { SectionCard } from '../../components/ui/section-card';
import { EmptyState } from '../../components/ui/empty-state';
import { LoadingState } from '../../components/ui/loading-state';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../lib/utils';
import { useSession } from '../../components/session-provider';
import { 
  formatAdDate, 
  formatSchoolDate, 
  normalizeActivityDate 
} from '../../lib/date-utils';

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
    queryFn: () => api.listStudents(),
    enabled: status === 'authenticated',
  });
  const admissionsQuery = useQuery({
    queryKey: ['dashboard-admissions'],
    queryFn: api.listAdmissions,
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
    queryFn: api.listActivityPosts,
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
    <div className="space-y-8 animate-fade-in">
      <header className="relative overflow-hidden rounded-[2rem] bg-slate-900 px-6 py-10 text-white shadow-2xl lg:px-12">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-secondary-500/10 blur-3xl" />
        
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="phase2" className="bg-white/10 text-white border-white/20">
                Admin Command Center
              </Badge>
              <div className="h-1 w-1 rounded-full bg-white/30" />
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                {currentAcademicYear?.name ?? 'No Academic Year'}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              Namaste, <span className="text-primary-400">{session?.user.email?.split('@')[0] ?? 'User'}</span>
            </h1>
            <p className="mt-4 text-lg text-slate-300 leading-relaxed">
              Here is what is happening across <span className="font-bold text-white">{session?.tenant.name}</span> today.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/dashboard/admissions"
              className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary-500/20 transition hover:bg-primary-600 hover:-translate-y-0.5"
            >
              <UserPlus size={18} />
              New Admission
            </Link>
            <Link
              href="/dashboard/attendance"
              className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <CalendarCheck size={18} />
              Mark Attendance
            </Link>
          </div>
        </div>

        {setupWarnings.length > 0 && (
          <div className="relative mt-8 flex flex-col gap-4 rounded-2xl border border-warning-500/30 bg-warning-500/10 p-5 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-500 text-white">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="font-bold text-warning-400">Setup needs attention</p>
                <p className="mt-0.5 text-sm text-slate-300">
                  {setupWarnings.join(' · ')}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-2 rounded-xl bg-warning-500 px-4 py-2 text-xs font-bold text-slate-900 transition hover:bg-warning-400"
            >
              Open Settings
              <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </header>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Students"
          value={totalStudents}
          icon={<Users size={20} />}
          loading={studentsQuery.isLoading}
        />
        <StatCard
          title="Attendance Today"
          value={`${attendancePercent}%`}
          icon={<CalendarCheck size={20} />}
          loading={attendanceQuery.isLoading}
          trend={{
            value: attendancePercent,
            label: "Presence rate",
            isUp: attendancePercent >= 80
          }}
        />
        <StatCard
          title="Monthly Collection"
          value={formatMoney(collectedThisMonth)}
          icon={<Wallet size={20} />}
          loading={receiptsQuery.isLoading}
        />
        <StatCard
          title="Outstanding Fees"
          value={formatMoney(outstandingFees)}
          icon={<Calculator size={20} />}
          loading={defaultersQuery.isLoading}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <SectionCard
          title="Operational Alerts"
          description="Issues requiring immediate attention"
          className="lg:col-span-2"
        >
          {operationalAlerts.length > 0 ? (
            <div className="space-y-4">
              {operationalAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between",
                    alert.tone === 'danger' 
                      ? 'border-danger-100 bg-danger-50/50' 
                      : 'border-warning-100 bg-warning-50/50'
                  )}
                >
                  <div className="flex gap-4">
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      alert.tone === 'danger' ? 'bg-danger-500 text-white' : 'bg-warning-500 text-white'
                    )}>
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{alert.title}</p>
                      <p className="mt-0.5 text-sm text-slate-500">{alert.body}</p>
                    </div>
                  </div>
                  <Link
                    href={alert.href}
                    className="inline-flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700"
                  >
                    {alert.cta}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No alerts available yet"
              description="No critical alerts at this time. Your school operations are running smoothly."
              icon={<TrendingUp size={32} />}
            />
          )}
        </SectionCard>

        <SectionCard title="Quick Actions">
          <div className="grid gap-3">
            {[
              { label: 'New Admission', href: '/dashboard/admissions', icon: UserPlus },
              { label: 'Collect Fees', href: '/dashboard/finance', icon: Wallet },
              { label: 'Mark Attendance', href: '/dashboard/attendance', icon: CalendarCheck },
              { label: 'Post Update', href: '/dashboard/activity', icon: Images },
              { label: 'Send Notice', href: '/dashboard/notices', icon: Megaphone },
              { label: 'Accounting', href: '/dashboard/accounting', icon: Calculator },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="group flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/30 p-4 transition hover:border-primary-200 hover:bg-primary-50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm transition group-hover:bg-primary-500 group-hover:text-white">
                  <action.icon size={20} />
                </div>
                <span className="font-bold text-slate-700 group-hover:text-primary-700">
                  {action.label}
                </span>
                <ArrowRight size={16} className="ml-auto opacity-0 transition group-hover:opacity-100 group-hover:translate-x-1 text-primary-500" />
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Attendance Mix" description="Today's presence summary">
          <div className="space-y-6">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-extrabold text-slate-900">{attendancePercent}%</span>
              <span className="mb-1 text-sm font-bold text-slate-400">Presence</span>
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
              <AttendanceRow 
                label="Leave" 
                count={todayTotals?.leave ?? 0} 
                total={totalMarkedToday} 
                color="bg-primary-500" 
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Fee Collection" description="Monthly target tracking">
          <div className="space-y-6">
            <div className="flex items-end gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{formatMoney(collectedThisMonth)}</span>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[0.65rem]">Collection vs Due</span>
                  <span className="font-bold text-slate-900">{Math.round((collectedThisMonth / (collectedThisMonth + outstandingFees)) * 100) || 0}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div 
                    className="h-full rounded-full bg-primary-500 transition-all duration-1000" 
                    style={{ width: `${Math.min(100, (collectedThisMonth / (collectedThisMonth + outstandingFees)) * 100) || 0}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="rounded-2xl bg-success-50 p-4">
                  <p className="text-[0.65rem] font-bold uppercase tracking-wider text-success-700">Collected</p>
                  <p className="mt-1 font-bold text-success-900">{formatMoney(collectedThisMonth)}</p>
                </div>
                <div className="rounded-2xl bg-danger-50 p-4">
                  <p className="text-[0.65rem] font-bold uppercase tracking-wider text-danger-700">Outstanding</p>
                  <p className="mt-1 font-bold text-danger-900">{formatMoney(outstandingFees)}</p>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Notification Health" description="Message delivery status">
          <div className="space-y-6">
            <div className="flex items-end gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{sentDeliveries}</span>
              <span className="mb-0.5 text-sm font-bold text-slate-400">Sent Today</span>
            </div>
            
            <div className="space-y-4">
              <HealthRow label="Sent Successfully" count={sentDeliveries} total={sentDeliveries + queuedDeliveries + failedDeliveries} color="bg-success-500" />
              <HealthRow label="Queued/Pending" count={queuedDeliveries} total={sentDeliveries + queuedDeliveries + failedDeliveries} color="bg-warning-500" />
              <HealthRow label="Failed" count={failedDeliveries} total={sentDeliveries + queuedDeliveries + failedDeliveries} color="bg-danger-500" />
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Recent School Activity"
        description="Latest updates from across all modules"
        headerAction={
          <Link href="/dashboard/activity" className="text-sm font-bold text-primary-600 hover:text-primary-700">
            View All Activity
          </Link>
        }
      >
        <RecentActivityList 
          admissions={admissionsQuery.data ?? []}
          receipts={receiptsQuery.data ?? []}
          activityPosts={activityPostsQuery.data ?? []}
          notices={noticesQuery.data ?? []}
        />
      </SectionCard>
    </div>
  );
}

function AttendanceRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-900">{count} <span className="text-slate-400 font-medium">({percent}%)</span></span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function HealthRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-900">{count}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function RecentActivityList({ admissions, receipts, activityPosts, notices }: any) {
  const items = [
    ...(admissions || []).slice(0, 3).map((a: any) => ({
      title: `New Admission: ${a.student?.firstName} ${a.student?.lastName}`,
      body: `Class ${a.class?.name}`,
      date: normalizeActivityDate(a),
      icon: UserPlus,
      color: 'text-primary-500',
      bg: 'bg-primary-50',
    })),
    ...(receipts || []).slice(0, 3).map((r: any) => ({
      title: `Fee Collected: ${formatMoney(r.amount)}`,
      body: `Receipt #${r.receiptNumber}`,
      date: normalizeActivityDate(r),
      icon: Wallet,
      color: 'text-success-500',
      bg: 'bg-success-50',
    })),
    ...(activityPosts || []).slice(0, 3).map((p: any) => ({
      title: `Activity: ${p.title}`,
      body: p.category,
      date: normalizeActivityDate(p),
      icon: Images,
      color: 'text-secondary-500',
      bg: 'bg-secondary-50',
    })),
    ...(notices || []).slice(0, 3).map((n: any) => ({
      title: `Notice: ${n.title}`,
      body: n.priority,
      date: normalizeActivityDate(n),
      icon: Megaphone,
      color: 'text-warning-500',
      bg: 'bg-warning-50',
    })),
  ]
    .sort((a, b) => {
      const da = new Date(a.date).getTime() || 0;
      const db = new Date(b.date).getTime() || 0;
      return db - da;
    })
    .slice(0, 6);

  if (items.length === 0) {
    return <EmptyState title="No recent operations yet" description="Activity from all modules will appear here once you start using the system." />;
  }

  return (
    <div className="divide-y divide-slate-50">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-4 py-4 transition first:pt-0 last:pb-0 hover:bg-slate-50/50">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", item.bg, item.color)}>
            <item.icon size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
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

function sumReceiptsThisMonth(receipts: any[]) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return (receipts || []).reduce((sum, receipt) => {
    const paidAt = new Date(receipt.payment?.paidAt ?? receipt.issuedAt);
    if (paidAt.getMonth() !== currentMonth || paidAt.getFullYear() !== currentYear) return sum;
    const gross = receipt.amount ?? receipt.payment?.amount ?? 0;
    return sum + Math.max(0, gross - (receipt.refundedAmount ?? 0));
  }, 0);
}

function sumOutstandingFees(defaulters: any[], invoices: any[]) {
  if (defaulters?.length > 0) return defaulters.reduce((sum, item) => sum + item.outstanding, 0);
  return (invoices || [])
    .filter((invoice) => !['PAID', 'WAIVED'].includes(invoice.status.toUpperCase()))
    .reduce((sum, invoice) => sum + Math.max(0, invoice.totalAmount - (invoice.paidAmount ?? 0)), 0);
}
