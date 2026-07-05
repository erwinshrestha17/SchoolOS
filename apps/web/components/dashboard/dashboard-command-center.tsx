"use client";

import {
  formatBsDateTime,
  type OperationalAttentionItem,
  type OperationalDashboardSummary,
  type OperationalModuleSummary,
  type OperationalSummaryMetricValue,
  type OperationalSummaryModule,
} from "@schoolos/core";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bus,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  GraduationCap,
  Landmark,
  Library,
  MessageSquare,
  Receipt,
  School,
  Utensils,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { prioritizeByAttention } from "../../lib/dashboard/prioritize-by-attention";
import { cn } from "../../lib/utils";
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
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <AttentionCenter
          attentionItems={attentionItems}
          moduleMap={moduleMap}
        />

        <DashboardSection
          eyebrow="School pulse"
          title="Today at a glance"
          description="Live, permission-filtered signals from the school day."
        >
          {pulseCards.length ? (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              {pulseCards.map((card) => (
                <PulseCard key={card.label} card={card} />
              ))}
            </div>
          ) : (
            <DashboardUnavailableState message="Today’s school pulse is not available yet. You can still open the operational workspaces below." />
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="Daily operations"
          title="Run today’s school workflows"
          description="Open the operational workspace that needs your attention without loading full lists here."
        >
          {dailyModules.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {dailyModules.map((summary) => (
                <OperationalWorkspaceCard
                  key={summary.module}
                  summary={summary}
                />
              ))}
            </div>
          ) : (
            <DashboardUnavailableState message="No daily-operation summaries are available for your current access." />
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="Academics & learning"
          title="Academic readiness"
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
      </div>

      <aside
        aria-label="Dashboard context"
        className="space-y-6 xl:sticky xl:top-6"
      >
        <NextActionsPanel dashboard={dashboard} />
        <RecentActivityPanel dashboard={dashboard} />
        <SystemReadinessPanel modules={dashboard.modules} />
      </aside>
    </div>
  );
}

function AttentionCenter({
  attentionItems,
  moduleMap,
}: {
  attentionItems: OperationalDashboardSummary["attentionItems"];
  moduleMap: Map<OperationalSummaryModule, OperationalModuleSummary>;
}) {
  return (
    <SectionCard
      title="Needs attention today"
      description={
        attentionItems.length
          ? "Start with the issues that can affect today’s school operations."
          : "No school-wide items currently need attention."
      }
      headerAction={
        attentionItems.length ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
            {attentionItems.length} to review
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            All clear
          </span>
        )
      }
    >
      {attentionItems.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {attentionItems.slice(0, 5).map((item) => (
            <AttentionCard
              key={`${item.module}-${item.key}`}
              item={item}
              moduleSummary={moduleMap.get(item.module)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold text-slate-900">
                No immediate school-wide issues are reported.
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Continue with the daily workspaces below, or refresh this view
                when new activity is expected.
              </p>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function AttentionCard({
  item,
  moduleSummary,
}: {
  item: OperationalDashboardSummary["attentionItems"][number];
  moduleSummary: OperationalModuleSummary | undefined;
}) {
  const definition = MODULE_DEFINITIONS[item.module];
  const presentation = severityPresentation[item.severity];
  const directHref = safeRoute({
    key: item.key,
    label: item.label,
    route: item.action,
  });
  const fallbackAction = moduleSummary ? firstSafeAction(moduleSummary) : null;
  const action = directHref
    ? { label: "Review", href: directHref }
    : fallbackAction;

  return (
    <article
      className={cn(
        "rounded-2xl border p-4 transition-shadow hover:shadow-sm",
        presentation.className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={cn("mt-0.5 h-5 w-5 shrink-0", presentation.iconClassName)}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
              {presentation.label}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {definition.shortLabel}
            </span>
          </div>
          <p className="mt-2 text-sm font-bold leading-5 text-slate-950">
            {item.label}
          </p>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            {formatNumber(item.count)} item{item.count === 1 ? "" : "s"} to
            review in {definition.shortLabel}.
          </p>
          {action ? (
            <Link
              href={action.href}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--primary)] transition hover:text-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2"
            >
              {action.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function PulseCard({ card }: { card: PulseCard }) {
  const Icon = card.icon;
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "inline-flex rounded-xl border p-2.5",
            card.accentClass,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        {card.href ? (
          <ArrowRight
            className="mt-1 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">
        {card.label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {card.value}
      </p>
      <p className="mt-1 text-sm leading-5 text-slate-600">
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
    "group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)] focus:ring-offset-2";

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
}: {
  summary: OperationalModuleSummary;
  compact?: boolean;
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
        {summary.status === "partial" ? (
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

function NextActionsPanel({
  dashboard,
}: {
  dashboard: OperationalDashboardSummary;
}) {
  const actions = dashboard.nextActions
    .map((action) => ({ label: action.label, href: safeRoute(action) }))
    .filter((action): action is SafeAction => Boolean(action.href))
    .slice(0, 5);

  return (
    <SectionCard
      title="Open a workspace"
      description="Continue with an authorized school workflow."
      className="overflow-hidden"
      noPadding
    >
      {actions.length ? (
        <div className="divide-y divide-slate-100">
          {actions.map((action) => (
            <Link
              key={`${action.label}-${action.href}`}
              href={action.href}
              className="group flex items-center gap-3 px-5 py-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 lg:px-6"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">{action.label}</span>
              <ArrowRight
                className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      ) : (
        <DashboardUnavailableState
          message="No additional dashboard actions are available for your current access."
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

function SystemReadinessPanel({
  modules,
}: {
  modules: OperationalModuleSummary[];
}) {
  const visibleModules = modules
    .filter((module) => module.status !== "permissionDenied")
    .slice(0, 8);

  return (
    <SectionCard
      title="Module readiness"
      description="A compact view of the enabled school workspaces."
      noPadding
    >
      <div className="divide-y divide-slate-100">
        {visibleModules.map((module) => {
          const definition = MODULE_DEFINITIONS[module.module];
          const readiness = readinessPresentation(module.status);
          return (
            <div
              key={module.module}
              className="flex items-center gap-3 px-5 py-3.5 lg:px-6"
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 shrink-0 rounded-full",
                  readiness.dotClassName,
                )}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 text-sm font-semibold text-slate-700">
                {definition.shortLabel}
              </span>
              <span className="shrink-0 text-xs font-bold text-slate-500">
                {readiness.label}
              </span>
            </div>
          );
        })}
      </div>
    </SectionCard>
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

function buildPulseCards(
  dashboard: OperationalDashboardSummary,
  moduleMap: Map<OperationalSummaryModule, OperationalModuleSummary>,
): PulseCard[] {
  const cards: PulseCard[] = [];
  const attendance = moduleMap.get("m2_attendance");
  const fees = moduleMap.get("m3_fees");
  const academics = moduleMap.get("m4_academics");
  const transport = moduleMap.get("m8b_transport");

  const presentToday = metric(attendance, "presentToday");
  const expectedStudents = metric(attendance, "expectedStudents");
  if (presentToday !== null || expectedStudents !== null) {
    cards.push({
      label: "Attendance",
      value: hasMeaningfulValue(presentToday)
        ? `${formatMetric("presentToday", presentToday)} present`
        : "Not started",
      description:
        expectedStudents !== null
          ? `${formatMetric("expectedStudents", expectedStudents)} active students in the current school record.`
          : "Attendance data is available for today.",
      icon: CalendarClock,
      accentClass: MODULE_DEFINITIONS.m2_attendance.accentClass,
      href: attendance ? (firstSafeAction(attendance)?.href ?? null) : null,
      actionLabel: "Open attendance",
    });
  }

  const collectedToday = metric(fees, "collectedTodayAmount");
  const paymentCount = metric(fees, "paymentCountToday");
  if (collectedToday !== null || paymentCount !== null) {
    cards.push({
      label: "Collections",
      value:
        collectedToday !== null
          ? formatMetric("collectedTodayAmount", collectedToday)
          : "No collection total",
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

  const marksOpen = metric(academics, "marksOpen");
  const reportCardBlockers = metric(academics, "reportCardPublishBlockers");
  if (marksOpen !== null || reportCardBlockers !== null) {
    cards.push({
      label: "Academic readiness",
      value: hasMeaningfulValue(marksOpen)
        ? `${formatMetric("marksOpen", marksOpen)} open`
        : "No open marks",
      description:
        reportCardBlockers !== null
          ? `${formatMetric("reportCardPublishBlockers", reportCardBlockers)} report-card blocker${reportCardBlockers === 1 ? "" : "s"} reported.`
          : "Academic summary is available for review.",
      icon: GraduationCap,
      accentClass: MODULE_DEFINITIONS.m4_academics.accentClass,
      href: academics ? (firstSafeAction(academics)?.href ?? null) : null,
      actionLabel: "Open academics",
    });
  }

  const activeTrips = metric(transport, "activeTripsToday");
  const delayedTrips = metric(transport, "delayedTrips");
  if (activeTrips !== null || delayedTrips !== null) {
    cards.push({
      label: "Transport",
      value:
        activeTrips !== null
          ? `${formatMetric("activeTripsToday", activeTrips)} active`
          : "No active trips",
      description:
        delayedTrips !== null
          ? `${formatMetric("delayedTrips", delayedTrips)} delayed trip${delayedTrips === 1 ? "" : "s"} reported.`
          : "Transport information is available for today.",
      icon: Bus,
      accentClass: MODULE_DEFINITIONS.m8b_transport.accentClass,
      href: transport ? (firstSafeAction(transport)?.href ?? null) : null,
      actionLabel: "Open transport",
    });
  }

  return cards.slice(0, 4);
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

function readinessPresentation(status: OperationalModuleSummary["status"]) {
  return {
    ready: { label: "Available", dotClassName: "bg-emerald-500" },
    empty: { label: "Clear", dotClassName: "bg-slate-400" },
    partial: { label: "Partial", dotClassName: "bg-amber-500" },
    locked: { label: "Not enabled", dotClassName: "bg-slate-300" },
    permissionDenied: { label: "Access limited", dotClassName: "bg-slate-300" },
  }[status];
}

function formatRecentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return formatBsDateTime(date);
}
