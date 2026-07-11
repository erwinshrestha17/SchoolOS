"use client";

import {
  formatBsDateTime,
  getNepalNow,
  type NoticeSummary,
  type OperationalAttentionItem,
  type OperationalDashboardSummary,
  type OperationalModuleSummary,
  type OperationalNextAction,
  type OperationalSummaryMetricValue,
  type OperationalSummaryModule,
  type TimetableSlotSummary,
} from "@schoolos/core";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bus,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock3,
  GraduationCap,
  Landmark,
  Library,
  Megaphone,
  MessageSquare,
  Receipt,
  School,
  Settings,
  UserCheck,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { api } from "../../lib/api";
import { prioritizeByAttention } from "../../lib/dashboard/prioritize-by-attention";
import { cn } from "../../lib/utils";
import { PriorityBadge } from "../forms/communications-form";
import { useSession } from "../session-provider";
import { resolveOperationalSummaryAction } from "../ui/operational-summary";
import { SectionCard } from "../ui/section-card";

type ModuleGroup = "daily" | "academic" | "queue";

type DashboardModuleDefinition = {
  label: string;
  shortLabel: string;
  group: ModuleGroup;
  icon: LucideIcon;
  accentClass: string;
};

type SafeAction = {
  label: string;
  href: string;
};

type PulseCard = {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  accentClass: string;
  href: string | null;
  actionLabel: string;
};

const MODULE_DEFINITIONS: Record<
  OperationalSummaryModule,
  DashboardModuleDefinition
> = {
  m1_students: {
    label: "Admissions & Student Profiles",
    shortLabel: "Students & Admissions",
    group: "queue",
    icon: Users,
    accentClass: "text-blue-700 bg-blue-50 border-blue-100",
  },
  m2_attendance: {
    label: "Smart Attendance",
    shortLabel: "Attendance",
    group: "daily",
    icon: CalendarClock,
    accentClass: "text-emerald-700 bg-emerald-50 border-emerald-100",
  },
  m3_fees: {
    label: "Fees & Receipts",
    shortLabel: "Fees",
    group: "daily",
    icon: Wallet,
    accentClass: "text-amber-700 bg-amber-50 border-amber-100",
  },
  m4_academics: {
    label: "Academics, Exams & Report Cards",
    shortLabel: "Academics",
    group: "academic",
    icon: GraduationCap,
    accentClass: "text-violet-700 bg-violet-50 border-violet-100",
  },
  m5_activity: {
    label: "Activity Feed & Milestones",
    shortLabel: "Activity Feed",
    group: "queue",
    icon: MessageSquare,
    accentClass: "text-pink-700 bg-pink-50 border-pink-100",
  },
  m6_homework_timetable: {
    label: "Homework & Timetable",
    shortLabel: "Homework & Timetable",
    group: "academic",
    icon: BookOpen,
    accentClass: "text-sky-700 bg-sky-50 border-sky-100",
  },
  m7_hr_payroll: {
    label: "HR & Payroll",
    shortLabel: "HR & Payroll",
    group: "queue",
    icon: Users,
    accentClass: "text-purple-700 bg-purple-50 border-purple-100",
  },
  m8a_library: {
    label: "Library",
    shortLabel: "Library",
    group: "queue",
    icon: Library,
    accentClass: "text-teal-700 bg-teal-50 border-teal-100",
  },
  m8b_transport: {
    label: "Transport",
    shortLabel: "Transport",
    group: "daily",
    icon: Bus,
    accentClass: "text-orange-700 bg-orange-50 border-orange-100",
  },
  m8c_canteen: {
    label: "Canteen",
    shortLabel: "Canteen",
    group: "daily",
    icon: Utensils,
    accentClass: "text-lime-700 bg-lime-50 border-lime-100",
  },
  m9_accounting: {
    label: "Accounting & Finance",
    shortLabel: "Accounting",
    group: "queue",
    icon: Landmark,
    accentClass: "text-cyan-800 bg-cyan-50 border-cyan-100",
  },
  m10_communications: {
    label: "Notices & Communication",
    shortLabel: "Communication",
    group: "daily",
    icon: MessageSquare,
    accentClass: "text-rose-700 bg-rose-50 border-rose-100",
  },
  m11_intelligence: {
    label: "Intelligence / AI",
    shortLabel: "Intelligence",
    group: "queue",
    icon: CircleAlert,
    accentClass: "text-slate-600 bg-slate-50 border-slate-200",
  },
  m12_learning: {
    label: "Learning Layer",
    shortLabel: "Learning",
    group: "academic",
    icon: School,
    accentClass: "text-indigo-700 bg-indigo-50 border-indigo-100",
  },
};

const DAILY_MODULES: OperationalSummaryModule[] = [
  "m2_attendance",
  "m3_fees",
  "m8b_transport",
  "m8c_canteen",
  "m10_communications",
];

const ACADEMIC_MODULES: OperationalSummaryModule[] = [
  "m4_academics",
  "m6_homework_timetable",
  "m12_learning",
];

const QUEUE_MODULES: OperationalSummaryModule[] = [
  "m1_students",
  "m7_hr_payroll",
  "m8a_library",
  "m5_activity",
  "m9_accounting",
];

const METRIC_LABELS: Record<string, string> = {
  applicationsNeedingReview: "Applications to review",
  unverifiedDocuments: "Unverified documents",
  duplicateCandidates: "Duplicate candidates",
  iemisReadinessBlockers: "IEMIS blockers",
  expectedStudents: "Active students",
  presentToday: "Present today",
  attendanceSessionsToday: "Attendance sessions",
  unsubmittedRegisters: "Unsubmitted registers",
  pendingCorrections: "Pending corrections",
  collectedTodayAmount: "Collected today",
  paymentCountToday: "Confirmed payments",
  overdueInvoices: "Overdue invoices",
  invoicesDueToday: "Invoices due today",
  cashierVarianceRisks: "Cashier variance risks",
  overdueFeesAmount: "Overdue fees",
  staffPresentToday: "Staff present today",
  marksOpen: "Open marks entries",
  pendingMarkLocks: "Pending mark locks",
  reportCardPublishBlockers: "Report-card blockers",
  homeworkDueToday: "Homework due today",
  overdueHomework: "Overdue homework",
  unassignedSubstitutionsToday: "Unassigned substitutions",
  pendingLeaveRequests: "Pending leave requests",
  contractsExpiringSoon: "Contracts expiring soon",
  overdueLoans: "Overdue loans",
  delayedTrips: "Delayed trips",
  tripsWithStaleGps: "Trips with stale GPS",
  vehicleDocumentRisks: "Vehicle document risks",
  outOfStockItems: "Out-of-stock items",
  unpostedJournals: "Unposted journals",
  unreconciledStatements: "Unreconciled statements",
  failedDeliveries: "Failed deliveries",
  highImpactNoticesAwaitingPublication: "High-impact notices pending",
  liveSessions: "Live sessions",
  activeParticipants: "Active participants",
  sessionRisks: "Session risks",
};

const severityPresentation: Record<
  OperationalAttentionItem["severity"],
  { label: string; className: string; iconClassName: string }
> = {
  critical: {
    label: "Urgent",
    className: "border-rose-200 bg-rose-50/70",
    iconClassName: "text-rose-600",
  },
  warning: {
    label: "Warning",
    className: "border-amber-200 bg-amber-50/70",
    iconClassName: "text-amber-600",
  },
  info: {
    label: "Review",
    className: "border-blue-200 bg-blue-50/70",
    iconClassName: "text-blue-600",
  },
};

export function DashboardCommandCenter({
  dashboard,
}: {
  dashboard: OperationalDashboardSummary;
}) {
  const moduleMap = new Map(
    dashboard.modules.map((module) => [module.module, module]),
  );
  const attentionItems = dashboard.attentionItems.filter(
    (item) => item.count > 0,
  );
  const pulseCards = buildPulseCards(dashboard, moduleMap);
  const attendanceRate = computeAttendanceRate(moduleMap);
  // Within each section, whichever module most urgently needs attention
  // today leads — a cashier's Daily operations naturally opens on Fees when
  // collections are overdue, a teacher's on Attendance when a register is
  // unsubmitted — using each module's own real attentionItems, not a
  // guessed role.
  const dailyModules = prioritizeByAttention(
    orderedModules(moduleMap, DAILY_MODULES),
  );
  const academicModules = prioritizeByAttention(
    orderedModules(moduleMap, ACADEMIC_MODULES),
  );
  const queueModules = prioritizeByAttention(
    orderedModules(moduleMap, QUEUE_MODULES),
  );

  return (
    <div className="space-y-6">
      <DashboardSection
        eyebrow="School pulse"
        title="Today at a glance"
        description="Live, permission-filtered signals from the school day."
      >
        {pulseCards.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {pulseCards.map((card) => (
              <PulseCard key={card.label} card={card} />
            ))}
          </div>
        ) : (
          <DashboardUnavailableState message="Today’s school pulse is not available yet. You can still open the operational workspaces below." />
        )}
      </DashboardSection>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0 space-y-6">
        <DashboardSection
          eyebrow="Today's operations"
          title="Run today’s school workflows"
          description="Open the operational workspace that needs your attention without loading full lists here."
        >
          {dailyModules.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {dailyModules.map((summary) => (
                <OperationalWorkspaceCard
                  key={summary.module}
                  summary={summary}
                  ringPercent={
                    summary.module === "m2_attendance" ? attendanceRate : null
                  }
                />
              ))}
            </div>
          ) : (
            <DashboardUnavailableState message="No daily-operation summaries are available for your current access." />
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="Academics & learning"
          title="Academic snapshot"
          description="Teaching, assessment, timetable, and controlled learning-session status."
        >
          {academicModules.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {academicModules.map((summary) => (
                <OperationalWorkspaceCard
                  key={summary.module}
                  summary={summary}
                  compact
                />
              ))}
            </div>
          ) : (
            <DashboardUnavailableState message="No academic summary is available for your current access." />
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="Department queues"
          title="Work that can wait, but should not be missed"
          description="Records, people, governance, and operational follow-up grouped by responsibility."
        >
          {queueModules.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {queueModules.map((summary) => (
                <WorkQueueCard key={summary.module} summary={summary} />
              ))}
            </div>
          ) : (
            <DashboardUnavailableState message="No department work queues are available for your current access." />
          )}
        </DashboardSection>

        <QuickActionsSection dashboard={dashboard} />
      </div>

      <aside
        aria-label="Dashboard context"
        className="space-y-6 xl:sticky xl:top-6"
      >
        <PendingApprovalsPanel
          attentionItems={attentionItems}
          moduleMap={moduleMap}
        />
        <TodaysTimetablePanel />
        <RecentActivityPanel dashboard={dashboard} />
        <RecentNoticesPanel />
      </aside>
      </div>
    </div>
  );
}

// Maps an approved dashboard route to the module it belongs to purely for
// icon/color presentation — every route here already exists in
// APPROVED_DASHBOARD_ROUTES (operational-summary.tsx); this list only
// decides which real MODULE_DEFINITIONS icon a quick-action tile shows.
const QUICK_ACTION_ROUTE_MODULES: Array<[string, OperationalSummaryModule]> = [
  ["/dashboard/admissions", "m1_students"],
  ["/dashboard/students", "m1_students"],
  ["/dashboard/attendance", "m2_attendance"],
  ["/dashboard/fees", "m3_fees"],
  ["/dashboard/academics", "m4_academics"],
  ["/dashboard/activity", "m5_activity"],
  ["/dashboard/homework", "m6_homework_timetable"],
  ["/dashboard/timetable", "m6_homework_timetable"],
  ["/dashboard/hr", "m7_hr_payroll"],
  ["/dashboard/payroll", "m7_hr_payroll"],
  ["/dashboard/library", "m8a_library"],
  ["/dashboard/transport", "m8b_transport"],
  ["/dashboard/canteen", "m8c_canteen"],
  ["/dashboard/accounting", "m9_accounting"],
  ["/dashboard/notices", "m10_communications"],
  ["/dashboard/learning", "m12_learning"],
];

function quickActionPresentation(href: string): {
  icon: LucideIcon;
  accentClass: string;
} {
  const match = QUICK_ACTION_ROUTE_MODULES.find(([prefix]) => href.startsWith(prefix));
  if (match) {
    const definition = MODULE_DEFINITIONS[match[1]];
    return { icon: definition.icon, accentClass: definition.accentClass };
  }
  return { icon: Settings, accentClass: "text-slate-600 bg-slate-50 border-slate-200" };
}

function QuickActionsSection({
  dashboard,
}: {
  dashboard: OperationalDashboardSummary;
}) {
  const actions = dashboard.nextActions
    .map((action) => ({ action, href: safeRoute(action) }))
    .filter(
      (item): item is { action: OperationalNextAction; href: string } =>
        Boolean(item.href),
    )
    .slice(0, 6);

  return (
    <DashboardSection
      eyebrow="Quick actions"
      title="Jump into a workflow"
      description="Bounded, permission-filtered shortcuts to what needs doing next — every tile opens a real authorized workspace."
    >
      {actions.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {actions.map(({ action, href }) => {
            const { icon: Icon, accentClass } = quickActionPresentation(href);
            return (
              <Link
                key={`${action.key}-${href}`}
                href={href}
                className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-center transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2"
              >
                <span
                  className={cn(
                    "inline-flex rounded-xl border p-3",
                    accentClass,
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-bold leading-5 text-slate-900">
                  {action.label}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <DashboardUnavailableState message="No additional quick actions are available for your current access." />
      )}
    </DashboardSection>
  );
}

function PendingApprovalsPanel({
  attentionItems,
  moduleMap,
}: {
  attentionItems: OperationalDashboardSummary["attentionItems"];
  moduleMap: Map<OperationalSummaryModule, OperationalModuleSummary>;
}) {
  const items = attentionItems.slice(0, 6);

  return (
    <SectionCard
      title="Pending Approvals & Alerts"
      description={
        items.length
          ? "Start with the issues that can affect today’s school operations."
          : "No approvals or alerts need your attention right now."
      }
      headerAction={
        items.length ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
            <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
            {items.length}
          </span>
        ) : (
          <CheckCircle2
            className="h-5 w-5 text-emerald-500"
            aria-hidden="true"
          />
        )
      }
    >
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <PendingApprovalRow
              key={`${item.module}-${item.key}`}
              item={item}
              moduleSummary={moduleMap.get(item.module)}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
          <p className="text-sm leading-5 text-slate-700">
            No school-wide items currently need attention.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

function PendingApprovalRow({
  item,
  moduleSummary,
}: {
  item: OperationalDashboardSummary["attentionItems"][number];
  moduleSummary: OperationalModuleSummary | undefined;
}) {
  const definition = MODULE_DEFINITIONS[item.module];
  const Icon = definition.icon;
  const presentation = severityPresentation[item.severity];
  const directHref = safeRoute({
    key: item.key,
    label: item.label,
    route: item.action,
  });
  const fallbackAction = moduleSummary ? firstSafeAction(moduleSummary) : null;
  const href = directHref ?? fallbackAction?.href ?? null;

  const content = (
    <>
      <span
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
          presentation.className,
        )}
      >
        <Icon
          className={cn("h-4 w-4", presentation.iconClassName)}
          aria-hidden="true"
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">
          {item.label}
        </p>
        <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
          {formatNumber(item.count)} {item.count === 1 ? "item" : "items"}{" "}
          pending in {definition.shortLabel}
        </p>
      </div>
      {href ? (
        <ArrowRight
          className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  const className =
    "group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2";

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function PulseCard({ card }: { card: PulseCard }) {
  const Icon = card.icon;
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "inline-flex rounded-xl border p-3",
            card.accentClass,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {card.href ? (
          <ArrowRight
            className="mt-1 h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <p className="mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">
        {card.label}
      </p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
        {card.value}
      </p>
      <p className="mt-1.5 text-sm leading-5 text-slate-600">
        {card.description}
      </p>
      {card.href ? (
        <span className="mt-4 inline-flex text-sm font-bold text-[var(--primary)]">
          {card.actionLabel}
        </span>
      ) : null}
    </>
  );

  const className =
    "group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2";

  return card.href ? (
    <Link href={card.href} className={className}>
      {content}
    </Link>
  ) : (
    <article className={className}>{content}</article>
  );
}

function OperationalWorkspaceCard({
  summary,
  compact = false,
  ringPercent = null,
}: {
  summary: OperationalModuleSummary;
  compact?: boolean;
  ringPercent?: number | null;
}) {
  const definition = MODULE_DEFINITIONS[summary.module];
  const Icon = definition.icon;
  const attention = summary.attentionItems.find((item) => item.count > 0);
  const action = firstSafeAction(summary);
  const metrics = meaningfulMetrics(summary, compact ? 1 : 2);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "inline-flex shrink-0 rounded-xl border p-2.5",
              definition.accentClass,
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">
              {definition.shortLabel}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">
              {statusLabel(summary.status)}
            </p>
          </div>
        </div>
        {ringPercent !== null ? (
          <RadialGauge
            percent={ringPercent}
            colorClass="text-emerald-500"
          />
        ) : summary.status === "partial" ? (
          <CircleAlert
            className="h-5 w-5 shrink-0 text-amber-500"
            aria-label="Some information is unavailable"
          />
        ) : null}
      </div>

      <div className="mt-5">
        {attention ? (
          <>
            <p className="text-lg font-black leading-6 text-slate-950">
              {formatNumber(attention.count)} to review
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              {attention.label}
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-black leading-6 text-slate-950">
              {workspaceState(summary.status)}
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              {workspaceDescription(summary, metrics.length)}
            </p>
          </>
        )}
      </div>

      {metrics.length ? (
        <div
          className={cn(
            "mt-5 grid gap-2",
            compact ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {metrics.map(([key, value]) => (
            <div key={key} className="rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-slate-500">
                {metricLabel(key)}
              </p>
              <p className="mt-1 text-sm font-black text-slate-900">
                {formatMetric(key, value)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--primary)] transition hover:text-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </article>
  );
}

function WorkQueueCard({ summary }: { summary: OperationalModuleSummary }) {
  const definition = MODULE_DEFINITIONS[summary.module];
  const Icon = definition.icon;
  const action = firstSafeAction(summary);
  const attention = summary.attentionItems
    .filter((item) => item.count > 0)
    .slice(0, 2);
  const metrics = meaningfulMetrics(summary, 2);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "inline-flex rounded-xl border p-2.5",
            definition.accentClass,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-950">
            {definition.shortLabel}
          </p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {statusLabel(summary.status)}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        {attention.length ? (
          attention.map((item) => (
            <div key={item.key} className="flex items-start gap-2.5 text-sm">
              <span
                className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-500"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 font-semibold leading-5 text-slate-800">
                {item.label}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                {formatNumber(item.count)}
              </span>
            </div>
          ))
        ) : metrics.length ? (
          metrics.map(([key, value]) => (
            <div
              key={key}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="min-w-0 text-slate-600">{metricLabel(key)}</span>
              <span className="shrink-0 font-black text-slate-950">
                {formatMetric(key, value)}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm leading-5 text-slate-600">
            {workspaceDescription(summary, 0)}
          </p>
        )}
      </div>

      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--primary)] transition hover:text-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </article>
  );
}

/**
 * ISO weekday (1=Monday ... 7=Sunday), matching the real dayOfWeek
 * convention confirmed from the timetable builder UI
 * (components/timetable/tabs/timetable-builder-tab.tsx's DAYS array), not
 * JavaScript's Date.getDay() (0=Sunday ... 6=Saturday) — a mismatch that
 * would silently show the wrong day's schedule. Built from getNepalNow()'s
 * already-Nepal-local calendar fields (pure calendar arithmetic, not
 * .toLocaleString()/Intl.DateTimeFormat rendering) per this codebase's rule
 * that dashboard/component code must go through the shared Nepal-date
 * utilities rather than ad-hoc browser-local formatting.
 */
function currentNepalIsoWeekday(): number {
  const now = getNepalNow();
  const jsWeekday = new Date(Date.UTC(now.year, now.month - 1, now.day)).getUTCDay();
  return jsWeekday === 0 ? 7 : jsWeekday;
}

function currentNepalTimeHHmm(): string {
  const now = getNepalNow();
  return `${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}`;
}

function formatTimeRangeLabel(startsAt: string, endsAt: string): string {
  return `${formatClockTime(startsAt)} – ${formatClockTime(endsAt)}`;
}

function formatClockTime(value: string): string {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const twelveHour = hour % 12 || 12;
  return `${twelveHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

type TimetableSlotStatus = "ongoing" | "upcoming" | "completed";

function timetableSlotStatus(
  slot: TimetableSlotSummary,
  nowHHmm: string,
): TimetableSlotStatus {
  if (nowHHmm >= slot.startsAt && nowHHmm < slot.endsAt) return "ongoing";
  if (nowHHmm < slot.startsAt) return "upcoming";
  return "completed";
}

const timetableStatusPresentation: Record<
  TimetableSlotStatus,
  { label: string; className: string }
> = {
  ongoing: { label: "Ongoing", className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" },
  upcoming: { label: "Upcoming", className: "bg-blue-50 text-blue-700 ring-1 ring-blue-100" },
  completed: { label: "Completed", className: "bg-slate-100 text-slate-500 ring-1 ring-slate-200" },
};

function TodaysTimetablePanel() {
  const { hasPermissions, status } = useSession();
  const canReadTimetable = hasPermissions(["timetable:read"]);
  const dayOfWeek = currentNepalIsoWeekday();

  // Admin/principal roles get the school-wide (not single-class) timetable
  // from this endpoint when classId is omitted — confirmed against
  // apps/api/src/timetable/timetable.service.ts's isPrivilegedTimetableActor
  // scoping before wiring this up.
  const timetableQuery = useQuery({
    queryKey: ["dashboard-todays-timetable", dayOfWeek],
    queryFn: () => api.listTimetable({ dayOfWeek, limit: 50 }),
    enabled: status === "authenticated" && canReadTimetable,
    staleTime: 60_000,
  });

  if (!canReadTimetable) return null;

  const nowHHmm = currentNepalTimeHHmm();
  const slots = (timetableQuery.data?.items ?? [])
    .slice()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 6);

  return (
    <SectionCard
      title="Today’s timetable"
      description="Scheduled periods for the current school day."
      headerAction={
        <Link
          href="/dashboard/timetable"
          className="text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-dark)]"
        >
          View full timetable
        </Link>
      }
      noPadding
    >
      {timetableQuery.isLoading ? (
        <div className="p-5 text-sm text-slate-500">
          Loading today’s timetable…
        </div>
      ) : timetableQuery.isError ? (
        <DashboardUnavailableState
          message="Today’s timetable is temporarily unavailable."
          compact
        />
      ) : slots.length ? (
        <div className="divide-y divide-slate-100">
          {slots.map((slot) => {
            const presentation =
              timetableStatusPresentation[timetableSlotStatus(slot, nowHHmm)];
            const classLabel = [slot.class?.name, slot.section?.name]
              .filter(Boolean)
              .join(" – ");
            return (
              <div key={slot.id} className="flex items-start gap-3 px-5 py-3 lg:px-6">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {slot.subject?.name ?? "Period"}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                    {formatTimeRangeLabel(slot.startsAt, slot.endsAt)}
                    {classLabel ? ` · ${classLabel}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase",
                    presentation.className,
                  )}
                >
                  {presentation.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <DashboardUnavailableState
          message="No classes are scheduled for today."
          compact
        />
      )}
    </SectionCard>
  );
}

function RecentActivityPanel({
  dashboard,
}: {
  dashboard: OperationalDashboardSummary;
}) {
  const items = dashboard.recentItems.slice(0, 6);

  return (
    <SectionCard
      title="Recent activity"
      description="Permission-filtered school events from the latest summary."
      headerAction={
        <Clock3 className="h-5 w-5 text-slate-400" aria-hidden="true" />
      }
      noPadding
    >
      {items.length ? (
        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const definition = MODULE_DEFINITIONS[item.module];
            const Icon = definition.icon;
            return (
              <div key={item.id} className="flex gap-3 px-5 py-4 lg:px-6">
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                    definition.accentClass,
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {definition.shortLabel}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-slate-800">
                    {item.label}
                  </p>
                  <time
                    className="mt-1 block text-xs text-slate-500"
                    dateTime={item.occurredAt}
                  >
                    {formatRecentDate(item.occurredAt)}
                  </time>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <DashboardUnavailableState
          message="No recent operational activity is available right now."
          compact
        />
      )}
    </SectionCard>
  );
}

function RecentNoticesPanel() {
  const { hasPermissions, status } = useSession();
  const canReadNotices = hasPermissions(["notices:read"]);

  // Real M12 notices list (title/priority/audience type/publish time, no
  // recipient or delivery data) — not the generic notification-center inbox.
  // Reuses the same shared query key as the Notices workspace so repeat
  // visits don't refetch.
  const noticesQuery = useQuery({
    queryKey: ["notices-list"],
    queryFn: api.listNotices,
    enabled: status === "authenticated" && canReadNotices,
    staleTime: 60_000,
  });

  if (!canReadNotices) return null;

  const notices = (noticesQuery.data ?? [])
    .slice()
    .sort((a, b) =>
      (b.publishedAt ?? b.scheduledFor ?? b.createdAt ?? "").localeCompare(
        a.publishedAt ?? a.scheduledFor ?? a.createdAt ?? "",
      ),
    )
    .slice(0, 5);

  return (
    <SectionCard
      title="Recent notices"
      description="The latest published and scheduled school notices."
      headerAction={
        <Megaphone className="h-5 w-5 text-slate-400" aria-hidden="true" />
      }
      noPadding
    >
      {noticesQuery.isLoading ? (
        <div className="p-5 text-sm text-slate-500">
          Loading recent notices…
        </div>
      ) : noticesQuery.isError ? (
        <DashboardUnavailableState
          message="Recent notices are temporarily unavailable."
          compact
        />
      ) : notices.length ? (
        <div className="divide-y divide-slate-100">
          {notices.map((notice) => (
            <RecentNoticeRow key={notice.id} notice={notice} />
          ))}
        </div>
      ) : (
        <DashboardUnavailableState
          message="No notices have been published recently."
          compact
        />
      )}
    </SectionCard>
  );
}

function RecentNoticeRow({ notice }: { notice: NoticeSummary }) {
  const timestamp =
    notice.publishedAt ?? notice.scheduledFor ?? notice.createdAt ?? null;
  const isScheduled = !notice.publishedAt && Boolean(notice.scheduledFor);

  return (
    <Link
      href={`/dashboard/notices/${notice.id}`}
      className="group flex items-start gap-3 px-5 py-4 transition hover:bg-slate-50 lg:px-6"
    >
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-700">
        <Megaphone className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold leading-5 text-slate-900">
          {notice.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <PriorityBadge priority={notice.priority} />
          {isScheduled ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-slate-600">
              Scheduled
            </span>
          ) : null}
        </div>
        {timestamp ? (
          <time className="mt-1.5 block text-xs text-slate-500" dateTime={timestamp}>
            {formatBsDateTime(timestamp)}
          </time>
        ) : null}
      </div>
    </Link>
  );
}

function DashboardSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-4 flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {eyebrow}
        </p>
        <h2 className="text-xl font-black tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function DashboardUnavailableState({
  message,
  compact = false,
}: {
  message: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-slate-50 text-sm leading-6 text-slate-600",
        compact ? "m-5 p-4 lg:m-6" : "p-5",
      )}
    >
      {message}
    </div>
  );
}

/**
 * The top KPI strip. Exactly six candidate cards, matching the reference
 * layout — but each one only renders when its real backend field(s) exist;
 * a missing metric drops the card rather than showing a fake 0. No card
 * here reports a value the backend didn't compute (see overdueFeesAmount /
 * staffPresentToday added to operational-summary.service.ts 2026-07-10
 * specifically so these two cards would be real instead of omitted).
 */
function buildPulseCards(
  dashboard: OperationalDashboardSummary,
  moduleMap: Map<OperationalSummaryModule, OperationalModuleSummary>,
): PulseCard[] {
  const cards: PulseCard[] = [];
  const attendance = moduleMap.get("m2_attendance");
  const fees = moduleMap.get("m3_fees");
  const hr = moduleMap.get("m7_hr_payroll");

  const expectedStudents = metric(attendance, "expectedStudents");
  const attendanceRate = computeAttendanceRate(moduleMap);
  if (expectedStudents !== null) {
    cards.push({
      label: "Active Students",
      value: formatMetric("expectedStudents", expectedStudents),
      description:
        attendanceRate !== null
          ? `${attendanceRate}% present today.`
          : "Active students in the current school record.",
      icon: Users,
      accentClass: "text-blue-700 bg-blue-50 border-blue-100",
      href: attendance ? (firstSafeAction(attendance)?.href ?? null) : null,
      actionLabel: "Open attendance",
    });
  }

  const presentToday = metric(attendance, "presentToday");
  if (presentToday !== null) {
    cards.push({
      label: "Present Today",
      value: hasMeaningfulValue(presentToday)
        ? formatMetric("presentToday", presentToday)
        : "Not started",
      description:
        attendanceRate !== null
          ? `${attendanceRate}% of enrolled.`
          : "Attendance data is available for today.",
      icon: CalendarClock,
      accentClass: MODULE_DEFINITIONS.m2_attendance.accentClass,
      href: attendance ? (firstSafeAction(attendance)?.href ?? null) : null,
      actionLabel: "Open attendance",
    });
  }

  const collectedToday = metric(fees, "collectedTodayAmount");
  const paymentCount = metric(fees, "paymentCountToday");
  if (collectedToday !== null) {
    cards.push({
      label: "Collected Today",
      value: formatMetric("collectedTodayAmount", collectedToday),
      description:
        paymentCount !== null
          ? `${formatMetric("paymentCountToday", paymentCount)} confirmed payment${paymentCount === 1 ? "" : "s"} today.`
          : "Collection information is available for today.",
      icon: Receipt,
      accentClass: MODULE_DEFINITIONS.m3_fees.accentClass,
      href: fees ? (firstSafeAction(fees)?.href ?? null) : null,
      actionLabel: "Open fees",
    });
  }

  // A real sum across every module's attentionItems (already fetched, not
  // a second query) — honest because both the total and the category count
  // are real numbers, but it has no single destination route, so the card
  // is informational (no href) rather than pointing at one arbitrary module.
  const attentionItems = dashboard.attentionItems.filter((item) => item.count > 0);
  if (attentionItems.length) {
    const pendingApprovalsTotal = attentionItems.reduce(
      (sum, item) => sum + item.count,
      0,
    );
    cards.push({
      label: "Pending Approvals",
      value: formatNumber(pendingApprovalsTotal),
      description: "Requires your action across "
        + `${attentionItems.length} categor${attentionItems.length === 1 ? "y" : "ies"}.`,
      icon: ClipboardList,
      accentClass: "text-rose-700 bg-rose-50 border-rose-100",
      href: null,
      actionLabel: "",
    });
  }

  const staffPresentToday = metric(hr, "staffPresentToday");
  const staffOnLeave = metric(hr, "staffOnApprovedLeaveToday");
  if (staffPresentToday !== null) {
    cards.push({
      label: "Staff Present",
      value: formatMetric("staffPresentToday", staffPresentToday),
      description:
        staffOnLeave !== null
          ? `${formatMetric("staffOnApprovedLeaveToday", staffOnLeave)} on approved leave today.`
          : "Staff attendance is available for today.",
      icon: UserCheck,
      accentClass: "text-purple-700 bg-purple-50 border-purple-100",
      href: hr ? (firstSafeAction(hr)?.href ?? null) : null,
      actionLabel: "Open HR & Payroll",
    });
  }

  const overdueFeesAmount = metric(fees, "overdueFeesAmount");
  const overdueInvoices = metric(fees, "overdueInvoices");
  if (overdueFeesAmount !== null) {
    cards.push({
      label: "Overdue Fees",
      value: formatMetric("overdueFeesAmount", overdueFeesAmount),
      description:
        overdueInvoices !== null
          ? `${formatMetric("overdueInvoices", overdueInvoices)} overdue invoice${overdueInvoices === 1 ? "" : "s"}.`
          : "Overdue fee information is available for today.",
      icon: CircleAlert,
      accentClass: "text-red-700 bg-red-50 border-red-100",
      href: fees ? (firstSafeAction(fees)?.href ?? null) : null,
      actionLabel: "Open fees",
    });
  }

  return cards.slice(0, 6);
}

function orderedModules(
  moduleMap: Map<OperationalSummaryModule, OperationalModuleSummary>,
  modules: OperationalSummaryModule[],
) {
  return modules
    .map((module) => moduleMap.get(module))
    .filter((module): module is OperationalModuleSummary => Boolean(module));
}

function meaningfulMetrics(summary: OperationalModuleSummary, limit: number) {
  return Object.entries(summary.summary)
    .filter(([, value]) => hasMeaningfulValue(value))
    .slice(0, limit);
}

function metric(
  summary: OperationalModuleSummary | undefined,
  key: string,
): OperationalSummaryMetricValue | null {
  return summary?.summary[key] ?? null;
}

/**
 * A simple ratio of two real backend numbers (present/expected students) —
 * not a projection, trend, or invented target — safe to render as a percent
 * since both inputs are the attendance module's own point-in-time figures.
 * Shared by the pulse card and the Attendance operations card's ring so both
 * show the same honest number.
 */
function computeAttendanceRate(
  moduleMap: Map<OperationalSummaryModule, OperationalModuleSummary>,
): number | null {
  const presentToday = metric(moduleMap.get("m2_attendance"), "presentToday");
  const expectedStudents = metric(
    moduleMap.get("m2_attendance"),
    "expectedStudents",
  );
  return typeof presentToday === "number" &&
    typeof expectedStudents === "number" &&
    expectedStudents > 0
    ? Math.round((presentToday / expectedStudents) * 100)
    : null;
}

function RadialGauge({
  percent,
  size = 56,
  strokeWidth = 5,
  colorClass,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  colorClass: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="img"
      aria-label={`${clamped}%`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        className="fill-none stroke-slate-100"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className={cn("fill-none stroke-current transition-all duration-500", colorClass)}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-slate-900 font-black"
        style={{ fontSize: size * 0.26 }}
      >
        {clamped}%
      </text>
    </svg>
  );
}

function firstSafeAction(summary: OperationalModuleSummary): SafeAction | null {
  for (const action of summary.nextActions) {
    const href = safeRoute(action);
    if (href) return { label: action.label, href };
  }
  return null;
}

function safeRoute(action: {
  key: string;
  label: string;
  route: string;
}): string | null {
  return resolveOperationalSummaryAction(action);
}

function metricLabel(key: string) {
  return (
    METRIC_LABELS[key] ??
    key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (value) => value.toUpperCase())
  );
}

function formatMetric(key: string, value: OperationalSummaryMetricValue) {
  if (value === null) return "—";
  const formatted = typeof value === "number" ? formatNumber(value) : value;
  return key.endsWith("Amount") ? `NPR ${formatted}` : formatted;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-NP").format(value);
}

function hasMeaningfulValue(value: OperationalSummaryMetricValue | null) {
  if (value === null) return false;
  if (typeof value === "number") return value !== 0;
  return !/^0(?:\.0+)?$/.test(value.trim());
}

function statusLabel(status: OperationalModuleSummary["status"]) {
  return {
    ready: "Current information available",
    empty: "No open work reported",
    partial: "Some information unavailable",
    locked: "Not enabled",
    permissionDenied: "Access limited",
  }[status];
}

function workspaceState(status: OperationalModuleSummary["status"]) {
  return {
    ready: "No current alerts",
    empty: "No open work",
    partial: "Summary partial",
    locked: "Module not enabled",
    permissionDenied: "Access limited",
  }[status];
}

function workspaceDescription(
  summary: OperationalModuleSummary,
  metricCount: number,
) {
  if (summary.status === "partial") {
    return "Available information is shown. Some details are temporarily unavailable.";
  }
  if (summary.status === "locked") {
    return "This module is not enabled for the school.";
  }
  if (summary.status === "permissionDenied") {
    return "You do not have permission to view this workspace.";
  }
  if (metricCount) {
    return "Current operational information is available below.";
  }
  return "No outstanding operational work is currently reported.";
}

function formatRecentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return formatBsDateTime(date);
}
