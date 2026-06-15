'use client';

import type {
  ActivityPost,
  AdmissionSummary,
  NoticeSummary,
  PermissionKey,
} from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bus,
  CalendarCheck,
  Calculator,
  ClipboardList,
  Clock3,
  GraduationCap,
  Images,
  LockKeyhole,
  Megaphone,
  Settings,
  ShieldCheck,
  Soup,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useEntitlements } from '../../components/entitlements-provider';
import { useSession } from '../../components/session-provider';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { KpiCard, KpiGrid } from '../../components/ui/kpi-card';
import { LoadingState } from '../../components/ui/loading-state';
import { ModuleHeader } from '../../components/ui/module-header';
import { SectionCard } from '../../components/ui/section-card';
import { StatusBadge } from '../../components/ui/status-badge';
import { api } from '../../lib/api';
import { formatSchoolDate, normalizeActivityDate } from '../../lib/date-utils';
import { cn } from '../../lib/utils';

type AccessConfig = {
  module?: string;
  permissions: PermissionKey[];
};

type QuickAction = AccessConfig & {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

type OperationCard = {
  label: string;
  href: string;
  icon: LucideIcon;
  status: string;
  detail: string;
  state: 'ready' | 'warning' | 'unavailable' | 'locked';
};

type ModuleSummaryCard = AccessConfig & {
  label: string;
  href: string;
  icon: LucideIcon;
  summary: string;
  detail: string;
  unavailableReason?: string;
};

type RecentActivityItem = {
  title: string;
  body: string;
  date: string;
  icon: LucideIcon;
};

const dashboardSummaryApiNeeds = [
  // Existing list APIs are intentionally not used as official dashboard totals.
  // W2 should move these to summary endpoints before showing school-wide values.
  'api.listInvoices',
  'api.listDefaulters',
  'api.listReceipts',
  'api.listNotificationDeliveries',
];

const quickActions: QuickAction[] = [
  {
    label: 'New Admission',
    description: 'Start a real admission workflow',
    href: '/dashboard/admissions',
    icon: UserPlus,
    module: 'students',
    permissions: ['students:create'],
  },
  {
    label: 'Mark Attendance',
    description: 'Open today’s attendance register',
    href: '/dashboard/attendance',
    icon: CalendarCheck,
    module: 'attendance',
    permissions: ['attendance:mark'],
  },
  {
    label: 'Collect Fee',
    description: 'Open the fee collection counter',
    href: '/dashboard/fees',
    icon: Wallet,
    module: 'fees',
    permissions: ['payments:collect'],
  },
  {
    label: 'Create Activity Post',
    description: 'Share a classroom update',
    href: '/dashboard/activity',
    icon: Images,
    module: 'activity',
    permissions: ['activity_feed:create'],
  },
  {
    label: 'Create Notice',
    description: 'Send a school announcement',
    href: '/dashboard/notices',
    icon: Megaphone,
    module: 'notices',
    permissions: ['notices:create'],
  },
  {
    label: 'Open Settings',
    description: 'Review school setup',
    href: '/dashboard/settings',
    icon: Settings,
    permissions: ['settings:read'],
  },
];

const moduleSummaries: ModuleSummaryCard[] = [
  {
    label: 'Admissions',
    href: '/dashboard/admissions',
    icon: UserPlus,
    module: 'students',
    permissions: ['students:read', 'students:create'],
    summary: 'Admission queue',
    detail: 'Uses admissions list metadata.',
  },
  {
    label: 'Attendance',
    href: '/dashboard/attendance',
    icon: CalendarCheck,
    module: 'attendance',
    permissions: ['attendance:read', 'attendance:mark'],
    summary: 'Today’s attendance',
    detail: 'Uses attendance analytics.',
  },
  {
    label: 'Fees',
    href: '/dashboard/fees',
    icon: Wallet,
    module: 'fees',
    permissions: ['fees:manage', 'fees:bill', 'payments:collect'],
    summary: 'Fee operations',
    detail: 'Needs dashboard fee summary API.',
    unavailableReason: 'Needs backend summary API',
  },
  {
    label: 'Activity Feed',
    href: '/dashboard/activity',
    icon: Images,
    module: 'activity',
    permissions: ['activity_feed:read', 'activity_feed:create'],
    summary: 'Recent activity posts',
    detail: 'Uses activity feed records.',
  },
  {
    label: 'Notices',
    href: '/dashboard/notices',
    icon: Megaphone,
    module: 'notices',
    permissions: ['notices:read', 'notices:create'],
    summary: 'Communications',
    detail: 'Recent notices and delivery failures.',
  },
  {
    label: 'Transport',
    href: '/dashboard/transport',
    icon: Bus,
    module: 'transport',
    permissions: ['transport:read', 'transport:manage', 'transport:operate'],
    summary: 'Trip status',
    detail: 'Uses transport reports.',
  },
  {
    label: 'Canteen',
    href: '/dashboard/canteen',
    icon: Soup,
    module: 'canteen',
    permissions: [
      'canteen:menu:read',
      'canteen:plans:read',
      'canteen:enrollments:read',
    ],
    summary: 'Meal service',
    detail: 'Uses daily meal report.',
  },
  {
    label: 'Library',
    href: '/dashboard/library',
    icon: BookOpen,
    module: 'library',
    permissions: ['library:read', 'library:manage'],
    summary: 'Library follow-up',
    detail: 'Uses overdue metadata.',
  },
  {
    label: 'Accounting',
    href: '/dashboard/accounting',
    icon: Calculator,
    module: 'accounting',
    permissions: ['accounting:read', 'accounting:reports:read'],
    summary: 'Accounting status',
    detail: 'Needs dashboard accounting summary API.',
    unavailableReason: 'Needs backend summary API',
  },
];

const alertToneStyles = {
  info: 'border-info-100 bg-info-50 text-info-800 hover:bg-info-100',
  warning: 'border-warning-200 bg-warning-50 text-warning-900 hover:bg-warning-100',
  danger: 'border-danger-200 bg-danger-50 text-danger-900 hover:bg-danger-100',
} as const;

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function DashboardPage() {
  const { session, status } = useSession();
  const { hasModule, loading: entitlementsLoading } = useEntitlements();

  const isAuthenticated = status === 'authenticated';
  const currentDate = new Date();
  const today = todayIso();

  function hasAnyPermission(permissions: PermissionKey[]) {
    if (!permissions.length) return true;
    const granted = new Set(session?.user.permissions ?? []);
    return permissions.some((permission) => granted.has(permission));
  }

  function canAccess(config: AccessConfig) {
    if (!isAuthenticated || !hasAnyPermission(config.permissions)) return false;
    if (!config.module) return true;
    return !entitlementsLoading && hasModule(config.module);
  }

  function isLocked(config: AccessConfig) {
    return Boolean(
      config.module &&
        isAuthenticated &&
        hasAnyPermission(config.permissions) &&
        !entitlementsLoading &&
        !hasModule(config.module),
    );
  }

  const canReadAcademicYears = canAccess({
    permissions: ['academic_years:read'],
  });
  const canReadClasses = canAccess({ permissions: ['classes:read'] });
  const canReadFees = canAccess({
    module: 'fees',
    permissions: ['fees:manage', 'fees:bill', 'payments:collect'],
  });
  const canReadStudents = canAccess({
    module: 'students',
    permissions: ['students:read'],
  });
  const canReadAdmissions = canAccess({
    module: 'students',
    permissions: ['students:read', 'students:create'],
  });
  const canReadAttendance = canAccess({
    module: 'attendance',
    permissions: ['attendance:read', 'attendance:mark'],
  });
  const canReadActivity = canAccess({
    module: 'activity',
    permissions: ['activity_feed:read'],
  });
  const canReadNotices = canAccess({
    module: 'notices',
    permissions: ['notices:read'],
  });
  const canReadTransport = canAccess({
    module: 'transport',
    permissions: ['transport:read', 'transport:manage', 'transport:operate'],
  });
  const canReadCanteen = canAccess({
    module: 'canteen',
    permissions: [
      'canteen:menu:read',
      'canteen:plans:read',
      'canteen:enrollments:read',
    ],
  });
  const canReadLibrary = canAccess({
    module: 'library',
    permissions: ['library:read', 'library:manage'],
  });
  const canReviewAttendanceCorrections = canAccess({
    module: 'attendance',
    permissions: ['attendance:read', 'attendance:mark'],
  });
  const canReviewLeaveRequests = canAccess({
    permissions: ['hr:read', 'payroll:read', 'payroll:manage'],
  });

  const academicYearsQuery = useQuery({
    queryKey: ['dashboard-academic-years'],
    queryFn: api.listAcademicYears,
    enabled: canReadAcademicYears,
  });
  const classesQuery = useQuery({
    queryKey: ['dashboard-classes'],
    queryFn: api.listClasses,
    enabled: canReadClasses,
  });
  const feePlansQuery = useQuery({
    queryKey: ['dashboard-fee-plans'],
    queryFn: api.listFeePlans,
    enabled: canReadFees,
  });
  const studentsQuery = useQuery({
    queryKey: ['dashboard-students'],
    queryFn: () => api.listStudents({ limit: 1 }),
    enabled: canReadStudents,
  });
  const admissionsQuery = useQuery({
    queryKey: ['dashboard-admissions'],
    queryFn: () => api.listAdmissions({ limit: 4 }),
    enabled: canReadAdmissions,
  });
  const attendanceQuery = useQuery({
    queryKey: ['dashboard-attendance-analytics'],
    queryFn: api.listAttendanceAnalytics,
    enabled: canReadAttendance,
  });
  const attendanceCorrectionsQuery = useQuery({
    queryKey: ['dashboard-attendance-corrections', 'PENDING'],
    queryFn: () => api.listAttendanceCorrections({ status: 'PENDING', limit: 1 }),
    enabled: canReviewAttendanceCorrections,
  });
  const leaveRequestsQuery = useQuery({
    queryKey: ['dashboard-leave-requests'],
    queryFn: api.listLeaveRequests,
    enabled: canReviewLeaveRequests,
  });
  const activityPostsQuery = useQuery({
    queryKey: ['dashboard-activity-posts'],
    queryFn: () => api.listActivityPosts({ status: 'PUBLISHED' }),
    enabled: canReadActivity,
  });
  const noticesQuery = useQuery({
    queryKey: ['dashboard-notices'],
    queryFn: api.listNotices,
    enabled: canReadNotices,
  });
  const notificationFailuresQuery = useQuery({
    queryKey: ['dashboard-notification-delivery-failures'],
    queryFn: api.listNotificationDeliveryFailures,
    enabled: canReadNotices,
  });
  const transportReportsQuery = useQuery({
    queryKey: ['dashboard-transport-reports'],
    queryFn: api.getReports,
    enabled: canReadTransport,
  });
  const canteenMealReportQuery = useQuery({
    queryKey: ['dashboard-canteen-daily-meal-count', today],
    queryFn: () => api.getDailyMealCountReport({ date: today }),
    enabled: canReadCanteen,
  });
  const libraryOverdueQuery = useQuery({
    queryKey: ['dashboard-library-overdue'],
    queryFn: () => api.listOverdue({ page: '1', limit: '1' }),
    enabled: canReadLibrary,
  });

  const currentAcademicYear =
    academicYearsQuery.data?.find((year) => year.isCurrent) ??
    academicYearsQuery.data?.[0] ??
    null;
  const classCount = classesQuery.data?.length ?? 0;
  const activeFeePlanCount =
    feePlansQuery.data?.filter((plan) => plan.isActive).length ?? 0;
  const setupWarnings = [
    canReadAcademicYears && !currentAcademicYear
      ? 'Create an academic year'
      : null,
    canReadClasses && classCount === 0 ? 'Create at least one class' : null,
    canReadFees && activeFeePlanCount === 0
      ? 'Configure an active fee plan'
      : null,
  ].filter(Boolean) as string[];

  const attendanceTotals = attendanceQuery.data?.todaySummary.totals;
  const presentToday = attendanceTotals?.present ?? null;
  const absentToday = attendanceTotals?.absent ?? null;
  const lateToday = attendanceTotals?.late ?? null;
  const markedToday = attendanceTotals?.totalStudents ?? null;
  const attendancePercent =
    markedToday && markedToday > 0 && presentToday !== null
      ? Math.round((presentToday / markedToday) * 100)
      : null;
  const pendingAdmissions = admissionsQuery.data?.total ?? null;
  const recentAdmissions = admissionsQuery.data?.items ?? [];
  const pendingAttendanceCorrections =
    attendanceCorrectionsQuery.data?.total ?? null;
  const pendingLeaveRequests =
    leaveRequestsQuery.data?.filter((request) =>
      request.status.toUpperCase().includes('PENDING'),
    ).length ?? null;
  const transportReports = transportReportsQuery.data ?? null;
  const canteenMealRows = canteenMealReportQuery.data ?? [];
  const mealsServedToday = canteenMealRows.reduce((sum, row) => {
    if (row.status !== 'SERVED') return sum;
    return sum + row._count._all;
  }, 0);
  const libraryOverdueTotal = libraryOverdueQuery.data?.meta.total ?? null;
  const notificationFailureTotal = notificationFailuresQuery.data?.total ?? null;

  const visibleQuickActions = quickActions.filter((action) =>
    canAccess(action),
  );
  const headerActions = visibleQuickActions.slice(0, 4);
  const primaryRole = formatRole(session?.user.roles[0]);

  const operationalStatus =
    setupWarnings.length > 0
      ? 'Setup needs attention before the next live school day.'
      : attendancePercent === null
        ? 'Operational summaries are filtered by your role.'
        : attendancePercent === 0
          ? 'Attendance has not been marked yet today.'
          : 'Core school operations are visible for your role today.';

  const dashboardErrors = [
    academicYearsQuery.error,
    studentsQuery.error,
    attendanceQuery.error,
    admissionsQuery.error,
  ].filter(Boolean);

  if (entitlementsLoading || status === 'loading') {
    return <LoadingState variant="page" label="Preparing the school command center..." />;
  }

  if (dashboardErrors.length > 0 && !studentsQuery.data && !attendanceQuery.data) {
    return (
      <ErrorState
        title="Could not load dashboard summaries"
        message="Some school command center data could not be loaded. Please retry or open the module workspace directly."
        showReload
      />
    );
  }

  const kpiCards = [
    canReadStudents
      ? {
          title: 'Total Students',
          value: studentsQuery.data?.total ?? 'Unavailable',
          description: studentsQuery.data
            ? 'From student directory metadata'
            : 'Student count unavailable',
          icon: <Users className="h-5 w-5" />,
          tone: 'dashboard' as const,
          href: '/dashboard/students',
        }
      : null,
    canReadAttendance
      ? {
          title: 'Present Today',
          value: presentToday ?? 'Unavailable',
          description:
            attendancePercent !== null
              ? `${attendancePercent}% of marked attendance`
              : 'Attendance summary unavailable',
          icon: <CalendarCheck className="h-5 w-5" />,
          tone:
            attendancePercent !== null && attendancePercent >= 80
              ? ('success' as const)
              : ('warning' as const),
          href: '/dashboard/attendance',
        }
      : null,
    canReadAttendance
      ? {
          title: 'Absent Today',
          value: absentToday ?? 'Unavailable',
          description:
            lateToday !== null
              ? `${lateToday} late entries in today’s summary`
              : 'Attendance summary unavailable',
          icon: <AlertTriangle className="h-5 w-5" />,
          tone:
            absentToday !== null && absentToday > 0
              ? ('warning' as const)
              : ('neutral' as const),
          href: '/dashboard/attendance',
        }
      : null,
    canReadAdmissions
      ? {
          title: 'Pending Admissions',
          value: pendingAdmissions ?? 'Unavailable',
          description: admissionsQuery.data
            ? 'From admissions queue metadata'
            : 'Admissions queue unavailable',
          icon: <UserPlus className="h-5 w-5" />,
          tone: 'info' as const,
          href: '/dashboard/admissions',
        }
      : null,
    canReadFees
      ? {
          title: 'Fees Collected Today',
          value: 'Unavailable',
          description: 'Needs backend summary API',
          icon: <Wallet className="h-5 w-5" />,
          tone: 'neutral' as const,
          href: '/dashboard/fees',
        }
      : null,
    canReadTransport
      ? {
          title: 'Transport Trips',
          value: transportReports?.activeTrips ?? 'Unavailable',
          description: transportReports
            ? `${transportReports.logsToday} transport logs today`
            : 'Transport report unavailable',
          icon: <Bus className="h-5 w-5" />,
          tone: 'dashboard' as const,
          href: '/dashboard/transport',
        }
      : null,
  ].filter(isDefined).slice(0, 6);

  const operationCards = ([
    canReadAttendance
      ? {
          label: 'Attendance',
          href: '/dashboard/attendance',
          icon: CalendarCheck,
          status:
            attendancePercent !== null
              ? `${attendancePercent}% present`
              : 'Unavailable',
          detail:
            markedToday !== null
              ? `${markedToday} student attendance records counted today`
              : 'Needs attendance summary for today',
          state:
            attendancePercent === null
              ? 'unavailable'
              : attendancePercent >= 80
                ? 'ready'
                : 'warning',
        }
      : null,
    canReadFees
      ? {
          label: 'Fees',
          href: '/dashboard/fees',
          icon: Wallet,
          status: 'Needs summary API',
          detail: 'Daily fee collection should come from backend summary data.',
          state: 'unavailable',
        }
      : null,
    canReadNotices
      ? {
          label: 'Notices',
          href: '/dashboard/notices',
          icon: Megaphone,
          status:
            notificationFailureTotal !== null
              ? `${notificationFailureTotal} delivery issue${notificationFailureTotal === 1 ? '' : 's'}`
              : 'Delivery status unavailable',
          detail: 'Recent notices and failed-delivery summary only.',
          state:
            notificationFailureTotal && notificationFailureTotal > 0
              ? 'warning'
              : 'ready',
        }
      : null,
    canReadTransport
      ? {
          label: 'Transport',
          href: '/dashboard/transport',
          icon: Bus,
          status:
            transportReports !== null
              ? `${transportReports.activeTrips} active trip${transportReports.activeTrips === 1 ? '' : 's'}`
              : 'Unavailable',
          detail:
            transportReports !== null
              ? `${transportReports.activeAssignments} active assignments`
              : 'Transport report unavailable',
          state:
            transportReports?.vehicleFitnessAlerts?.length ||
            transportReports?.driverLicenseAlerts?.length
              ? 'warning'
              : transportReports
                ? 'ready'
                : 'unavailable',
        }
      : null,
    canReadCanteen
      ? {
          label: 'Canteen',
          href: '/dashboard/canteen',
          icon: Soup,
          status: canteenMealReportQuery.data
            ? `${mealsServedToday} meal${mealsServedToday === 1 ? '' : 's'} served`
            : 'Unavailable',
          detail: 'Daily meal-count report only; POS sales need summary API.',
          state: canteenMealReportQuery.data ? 'ready' : 'unavailable',
        }
      : null,
    canReadLibrary
      ? {
          label: 'Library',
          href: '/dashboard/library',
          icon: BookOpen,
          status:
            libraryOverdueTotal !== null
              ? `${libraryOverdueTotal} overdue item${libraryOverdueTotal === 1 ? '' : 's'}`
              : 'Unavailable',
          detail: 'Overdue metadata from library reports.',
          state:
            libraryOverdueTotal && libraryOverdueTotal > 0
              ? 'warning'
              : libraryOverdueTotal === null
                ? 'unavailable'
                : 'ready',
        }
      : null,
  ] satisfies Array<OperationCard | null>).filter(isDefined);

  const alerts = [
    ...setupWarnings.map((warning) => ({
      tone: 'warning' as const,
      title: warning,
      body: 'Finish setup in Settings before running a live school day.',
      href: '/dashboard/settings',
      cta: 'Open Settings',
    })),
    canReadAttendance && attendancePercent === 0
      ? {
          tone: 'warning' as const,
          title: 'Attendance not marked today',
          body: 'Open the attendance workspace before the school day moves ahead.',
          href: '/dashboard/attendance',
          cta: 'Mark Attendance',
        }
      : null,
    canReadAttendance && (attendanceQuery.data?.below80Warnings?.length ?? 0) > 0
      ? {
          tone: 'danger' as const,
          title: `${attendanceQuery.data?.below80Warnings?.length ?? 0} attendance risk${attendanceQuery.data?.below80Warnings?.length === 1 ? '' : 's'}`,
          body: 'Students below 80% attendance need follow-up.',
          href: '/dashboard/attendance',
          cta: 'Review Attendance',
        }
      : null,
    canReadNotices && (notificationFailureTotal ?? 0) > 0
      ? {
          tone: 'danger' as const,
          title: `${notificationFailureTotal} failed delivery${notificationFailureTotal === 1 ? '' : 'ies'}`,
          body: 'Review communications before relying on parent delivery.',
          href: '/dashboard/notices',
          cta: 'Review Notices',
        }
      : null,
  ].filter(isDefined);

  const approvalRows = [
    canReviewAttendanceCorrections
      ? {
          label: 'Attendance corrections',
          count: pendingAttendanceCorrections,
          href: '/dashboard/attendance/corrections',
          unavailable: false,
        }
      : null,
    canReviewLeaveRequests
      ? {
          label: 'Leave requests',
          count: pendingLeaveRequests,
          href: '/dashboard/hr/leave',
          unavailable: false,
        }
      : null,
    {
      label: 'Fee discounts and waivers',
      count: null,
      href: '/dashboard/fees',
      unavailable: true,
    },
    {
      label: 'Activity moderation',
      count: null,
      href: '/dashboard/activity/moderation',
      unavailable: true,
    },
  ].filter(isDefined);

  const recentActivity = buildRecentActivity({
    admissions: recentAdmissions,
    activityPosts: activityPostsQuery.data ?? [],
    notices: noticesQuery.data ?? [],
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <ModuleHeader
        eyebrow="School command center"
        title={session?.tenant.name ?? 'School Dashboard'}
        description="A role-aware view of today’s school operations, alerts, module health, and safe shortcuts."
        primaryAction={
          headerActions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {headerActions.map((action) => (
                <HeaderQuickAction key={action.href} action={action} />
              ))}
            </div>
          ) : null
        }
        metadata={
          <>
            <StatusBadge
              status="ACTIVE"
              label={primaryRole}
              tone="published"
            />
            <StatusBadge
              status="INFO"
              label={currentAcademicYear?.name ?? 'Academic year unavailable'}
              tone="info"
            />
            <StatusBadge
              status="INFO"
              label={formatSchoolDate(currentDate, 'BOTH')}
              tone="info"
            />
          </>
        }
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-[var(--color-mod-dashboard-border)] bg-[var(--color-mod-dashboard-bg)] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-mod-dashboard-text)]">
              Operational status
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {operationalStatus}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <DashboardHeroMetric label="Alerts" value={alerts.length} />
            <DashboardHeroMetric
              label="Approvals"
              value={knownApprovalCount(approvalRows)}
            />
            <DashboardHeroMetric
              label="Modules"
              value={moduleSummaries.filter((module) => canAccess(module)).length}
            />
          </div>
        </div>
      </ModuleHeader>

      {kpiCards.length > 0 ? (
        <KpiGrid className="xl:grid-cols-6">
          {kpiCards.map((card) => (
            <KpiCard
              key={card.title}
              title={card.title}
              value={card.value}
              description={card.description}
              icon={card.icon}
              tone={card.tone}
              href={card.href}
              loading={false}
            />
          ))}
        </KpiGrid>
      ) : (
        <EmptyState
          title="No dashboard KPIs available"
          description="Your role does not have access to school-wide dashboard KPI summaries."
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.85fr)]">
        <div className="space-y-6">
          <SectionCard
            title="Today’s Operations"
            description="Only real module summaries are shown. Missing summary APIs are marked unavailable."
          >
            {operationCards.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {operationCards.map((operation) => (
                  <OperationStatusCard
                    key={operation.label}
                    operation={operation}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No operations visible"
                description="Today’s operation cards are filtered by your role and module access."
              />
            )}
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Pending Approvals"
              description="Approval counts use existing APIs where available."
            >
              <div className="space-y-3">
                {approvalRows.map((row) => (
                  <ApprovalRow key={row.label} row={row} />
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Alerts"
              description="Highest-impact school operation alerts first."
            >
              {alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.slice(0, 4).map((alert) => (
                    <Link
                      key={alert.title}
                      href={alert.href}
                      className={cn(
                        'group block rounded-xl border p-4 text-sm transition hover:-translate-y-0.5',
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
              ) : (
                <EmptyState
                  title="No alerts available yet"
                  description="Setup, attendance, delivery, and high-impact module alerts will appear here."
                />
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Module Summary"
            description="Cards are permission-filtered. Locked modules never show fake values."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {moduleSummaries
                .filter(
                  (module) => hasAnyPermission(module.permissions),
                )
                .map((module) => (
                  <ModuleSummaryTile
                    key={module.label}
                    module={module}
                    locked={isLocked(module)}
                    visible={canAccess(module)}
                    summary={resolveModuleSummary(module.label, {
                      pendingAdmissions,
                      attendancePercent,
                      notificationFailureTotal,
                      transportReports,
                      mealsServedToday,
                      libraryOverdueTotal,
                      activityPosts: activityPostsQuery.data ?? [],
                    })}
                  />
                ))}
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-6">
          <SectionCard
            title="Recent Activity"
            description="Safe recent records from modules your role can access."
          >
            {recentActivity.length > 0 ? (
              <RecentActivityTimeline items={recentActivity} />
            ) : (
              <EmptyState
                title="No recent operations yet"
                description="Recent admissions, notices, and activity feed records will appear here after staff use those modules."
              />
            )}
          </SectionCard>

          <SectionCard
            title="Quick Actions"
            description="Role-safe shortcuts to real module routes."
          >
            {visibleQuickActions.length > 0 ? (
              <div className="grid gap-3">
                {visibleQuickActions.map((action) => (
                  <QuickActionTile key={action.href} action={action} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No quick actions available"
                description="Your current role does not expose command-center shortcuts."
              />
            )}
          </SectionCard>

          <SectionCard title="Unavailable Dashboard Summaries">
            <div className="space-y-3">
              {dashboardSummaryApiNeeds.map((apiNeed) => (
                <div
                  key={apiNeed}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                >
                  <p className="font-bold text-slate-900">
                    Needs backend summary API
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {apiNeed} remains a module list API and is not used as an
                    official dashboard total.
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}

function HeaderQuickAction({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  return (
    <Link
      href={action.href}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--color-mod-dashboard-accent)] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-dashboard-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-dashboard-border)] focus:ring-offset-2"
    >
      <Icon className="h-4 w-4" />
      {action.label}
    </Link>
  );
}

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

function OperationStatusCard({ operation }: { operation: OperationCard }) {
  const Icon = operation.icon;
  return (
    <Link
      href={operation.href}
      className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[var(--color-mod-dashboard-border)] hover:bg-[var(--color-mod-dashboard-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-dashboard-border)] focus:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-600">
          <Icon className="h-5 w-5" />
        </div>
        <StatusBadge
          status={operation.state}
          label={operation.state}
          tone={operationTone(operation.state)}
        />
      </div>
      <p className="mt-4 text-sm font-bold text-slate-950">
        {operation.label}
      </p>
      <p className="mt-1 text-lg font-extrabold text-slate-950">
        {operation.status}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        {operation.detail}
      </p>
    </Link>
  );
}

function ApprovalRow({
  row,
}: {
  row: {
    label: string;
    count: number | null;
    href: string;
    unavailable: boolean;
  };
}) {
  return (
    <Link
      href={row.href}
      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm transition hover:border-[var(--color-mod-dashboard-border)] hover:bg-[var(--color-mod-dashboard-bg)]"
    >
      <div className="min-w-0">
        <p className="font-bold text-slate-900">{row.label}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {row.unavailable
            ? 'Needs backend summary API'
            : row.count === null
              ? 'Pending count unavailable'
              : 'Ready for review'}
        </p>
      </div>
      <StatusBadge
        status={row.unavailable ? 'INFO' : 'PENDING'}
        label={row.unavailable ? 'Unavailable' : String(row.count ?? 0)}
        tone={row.unavailable ? 'info' : 'pending'}
      />
    </Link>
  );
}

function ModuleSummaryTile({
  module,
  locked,
  visible,
  summary,
}: {
  module: ModuleSummaryCard;
  locked: boolean;
  visible: boolean;
  summary: string;
}) {
  const Icon = module.icon;

  if (locked) {
    return (
      <div className="rounded-xl border border-warning-100 bg-warning-50 p-4">
        <div className="flex items-center gap-3">
          <LockKeyhole className="h-5 w-5 text-warning-700" />
          <p className="font-bold text-warning-900">{module.label}</p>
        </div>
        <p className="mt-2 text-xs leading-5 text-warning-800">
          Module locked for this school plan. No module values are shown.
        </p>
      </div>
    );
  }

  if (!visible) return null;

  return (
    <Link
      href={module.href}
      className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[var(--color-mod-dashboard-border)] hover:bg-[var(--color-mod-dashboard-bg)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-600">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-slate-950">{module.label}</p>
            <p className="text-xs text-slate-500">{module.summary}</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--color-mod-dashboard-accent)]" />
      </div>
      <p className="mt-3 text-sm font-bold text-slate-900">
        {module.unavailableReason ?? summary}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{module.detail}</p>
    </Link>
  );
}

function QuickActionTile({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  return (
    <Link
      href={action.href}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-[var(--color-mod-dashboard-border)] hover:bg-[var(--color-mod-dashboard-bg)]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-600">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">
          {action.label}
        </p>
        <p className="truncate text-xs text-slate-500">{action.description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--color-mod-dashboard-accent)]" />
    </Link>
  );
}

function RecentActivityTimeline({ items }: { items: RecentActivityItem[] }) {
  return (
    <div className="divide-y divide-slate-100">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={`${item.title}-${item.date}`}
            className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 text-slate-600">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-950">
                {item.title}
              </p>
              <p className="truncate text-xs text-slate-500">{item.body}</p>
              <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-wide text-slate-400">
                {formatSchoolDate(item.date, 'BOTH')}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function buildRecentActivity({
  admissions,
  activityPosts,
  notices,
}: {
  admissions: AdmissionSummary[];
  activityPosts: ActivityPost[];
  notices: NoticeSummary[];
}) {
  return [
    ...admissions.slice(0, 3).map((admission) => ({
      title: `Admission: ${admission.fullNameEn}`,
      body: admission.sectionName
        ? `${admission.className} ${admission.sectionName}`
        : admission.className,
      date: normalizeActivityDate(admission),
      icon: UserPlus,
    })),
    ...activityPosts.slice(0, 3).map((post) => ({
      title: `Activity post: ${post.title}`,
      body: post.category,
      date: normalizeActivityDate(post),
      icon: Images,
    })),
    ...notices.slice(0, 3).map((notice) => ({
      title: `Notice: ${notice.title}`,
      body: notice.priority,
      date: normalizeActivityDate(notice),
      icon: Megaphone,
    })),
  ]
    .sort((a, b) => {
      const firstDate = new Date(a.date).getTime() || 0;
      const secondDate = new Date(b.date).getTime() || 0;
      return secondDate - firstDate;
    })
    .slice(0, 6);
}

function resolveModuleSummary(
  label: string,
  data: {
    pendingAdmissions: number | null;
    attendancePercent: number | null;
    notificationFailureTotal: number | null;
    transportReports: { activeTrips: number } | null;
    mealsServedToday: number;
    libraryOverdueTotal: number | null;
    activityPosts: ActivityPost[];
  },
) {
  if (label === 'Admissions') {
    return data.pendingAdmissions === null
      ? 'Admission summary unavailable'
      : `${data.pendingAdmissions} admission record${data.pendingAdmissions === 1 ? '' : 's'}`;
  }
  if (label === 'Attendance') {
    return data.attendancePercent === null
      ? 'Attendance summary unavailable'
      : `${data.attendancePercent}% present today`;
  }
  if (label === 'Activity Feed') {
    return `${data.activityPosts.length} recent post${data.activityPosts.length === 1 ? '' : 's'}`;
  }
  if (label === 'Notices') {
    return data.notificationFailureTotal === null
      ? 'Delivery summary unavailable'
      : `${data.notificationFailureTotal} failed deliver${data.notificationFailureTotal === 1 ? 'y' : 'ies'}`;
  }
  if (label === 'Transport') {
    return data.transportReports === null
      ? 'Transport report unavailable'
      : `${data.transportReports.activeTrips} active trip${data.transportReports.activeTrips === 1 ? '' : 's'}`;
  }
  if (label === 'Canteen') {
    return `${data.mealsServedToday} meal${data.mealsServedToday === 1 ? '' : 's'} served today`;
  }
  if (label === 'Library') {
    return data.libraryOverdueTotal === null
      ? 'Library overdue summary unavailable'
      : `${data.libraryOverdueTotal} overdue item${data.libraryOverdueTotal === 1 ? '' : 's'}`;
  }
  return 'Needs backend summary API';
}

function knownApprovalCount(
  rows: Array<{
    label: string;
    count: number | null;
    href: string;
    unavailable: boolean;
  }>,
) {
  return rows.reduce((sum, row) => sum + (row.count ?? 0), 0);
}

function operationTone(state: OperationCard['state']) {
  if (state === 'ready') return 'approved';
  if (state === 'warning') return 'pending';
  if (state === 'locked') return 'locked';
  return 'info';
}

function formatRole(role?: string) {
  if (!role) return 'School staff';
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
