"use client";

import type { OperationalNextAction } from "@schoolos/core";
import { formatBsDateTime } from "@schoolos/core";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ActionMenuItem } from "../../components/ui/action-menu";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AdminDashboard } from "../../components/dashboard/admin-dashboard";
import { PrincipalDashboard } from "../../components/dashboard/principal-dashboard";
import { HrDashboard } from "../../components/dashboard/hr-dashboard";
import { AccountantDashboard } from "../../components/dashboard/accountant-dashboard";
import { TeacherTodayWorkspace } from "../../components/dashboard/teacher-today-workspace";
import { useTeacherAccess } from "../../lib/teacher-access";
import { useSchoolWebPersona } from "../../lib/school-web-persona";
import {
  assertServerDashboardProjection,
  isSupportedDashboardPersona,
  resolveDashboardCompositionPersona,
} from "../../lib/dashboard-persona";
import { ModuleHeader } from "../../components/ui/module-header";
import {
  OperationalSummaryError,
  OperationalSummaryLoading,
  RefreshSummaryButton,
  resolveOperationalSummaryAction,
  SummaryStatusBadge,
} from "../../components/ui/operational-summary";
import { EmptyState } from "../../components/ui/empty-state";
import { LoadingState } from "../../components/ui/loading-state";
import { PermissionDenied } from "../../components/ui/permission-denied";
import { usePermissionAccess } from "../../lib/permissions-ui";
import { useSession } from "../../components/session-provider";
import { api } from "../../lib/api";
import { formatSchoolDate } from "../../lib/date-utils";

export default function DashboardPage() {
  const router = useRouter();
  const { session } = useSession();
  const { isTeacherPersona } = useTeacherAccess();
  const schoolWebPersona = useSchoolWebPersona();
  const { resolution: permissionResolution } = usePermissionAccess();
  const expectedPersona = resolveDashboardCompositionPersona(schoolWebPersona);
  const canFetchDashboard = isSupportedDashboardPersona(schoolWebPersona);
  const tenantId = session?.tenant.id;

  const dashboardQuery = useQuery({
    queryKey: ["operational-dashboard-summary", tenantId],
    queryFn: api.getDashboardSummary,
    staleTime: 30_000,
    enabled:
      canFetchDashboard &&
      !isTeacherPersona &&
      permissionResolution === "granted" &&
      expectedPersona !== null,
  });

  const projectedDashboard = useMemo(
    () =>
      dashboardQuery.data && expectedPersona
        ? assertServerDashboardProjection(dashboardQuery.data, expectedPersona)
        : null,
    [dashboardQuery.data, expectedPersona],
  );

  const compositionPersona =
    projectedDashboard?.compositionPersona ?? expectedPersona;

  const safeNextActions = (projectedDashboard?.nextActions ?? [])
    .map((action) => ({ action, href: resolveOperationalSummaryAction(action) }))
    .filter((item): item is { action: OperationalNextAction; href: string } =>
      Boolean(item.href),
    );

  const attentionCount = (projectedDashboard?.attentionItems ?? []).filter(
    (item) => item.count > 0,
  ).length;
  const [firstNextAction, ...remainingNextActions] = safeNextActions;
  const primaryAction =
    attentionCount > 0
      ? {
          label: `Review ${attentionCount} attention item${attentionCount === 1 ? "" : "s"}`,
          href: "#needs-attention",
        }
      : firstNextAction
        ? { label: firstNextAction.action.label, href: firstNextAction.href }
        : null;

  const menuNextActions =
    attentionCount > 0 ? safeNextActions : remainingNextActions;
  const quickActions: ActionMenuItem[] = menuNextActions
    .slice(0, 5)
    .map(({ action, href }) => ({
      label: action.label,
      onClick: () => router.push(href),
    }));

  const headerCopy =
    compositionPersona === "principal"
      ? {
          eyebrow: "Executive oversight",
          title: "Executive Dashboard",
          description:
            "Critical attention items, approvals, and school readiness for leadership decisions.",
        }
      : compositionPersona === "admin"
        ? {
            eyebrow: "School operations",
            title: "Operations Dashboard",
            description:
              "Daily operating snapshot for admissions, attendance, fees, and configuration readiness.",
          }
        : compositionPersona === "hr"
          ? {
              eyebrow: "People operations",
              title: "HR Dashboard",
              description:
                "Staff availability, payroll readiness, and people operations follow-up.",
            }
          : compositionPersona === "accountant"
            ? {
                eyebrow: "Finance operations",
                title: "Finance Dashboard",
                description:
                  "Fees collections, accounting readiness, and payroll posting status.",
              }
            : {
                eyebrow: "School workspace",
                title: "Home",
                description:
                  "Use the sidebar to open your assigned modules. This account does not receive a school-wide dashboard summary.",
              };

  if (isTeacherPersona) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          eyebrow="My Teaching"
          title="Today"
          description="Your classes, attendance, and homework for today."
        />
        <TeacherTodayWorkspace />
      </div>
    );
  }

  if (permissionResolution === "loading") {
    return (
      <div className="space-y-6">
        <ModuleHeader
          eyebrow={headerCopy.eyebrow}
          title={headerCopy.title}
          description={headerCopy.description}
        />
        <LoadingState variant="page" label="Checking workspace access…" />
      </div>
    );
  }

  if (!canFetchDashboard || !expectedPersona) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          eyebrow={headerCopy.eyebrow}
          title={headerCopy.title}
          description={headerCopy.description}
        />
        <EmptyState
          title="Module workspace"
          description="Your role uses focused module workspaces instead of a school-wide dashboard. Open a module from the sidebar to get started."
        />
      </div>
    );
  }

  const projectionMismatch =
    dashboardQuery.isSuccess &&
    dashboardQuery.data &&
    projectedDashboard === null;

  return (
    <div className="space-y-6">
      <ModuleHeader
        eyebrow={headerCopy.eyebrow}
        title={headerCopy.title}
        description={headerCopy.description}
        metadata={
          projectedDashboard ? (
            <>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                School day: {formatSchoolDate(projectedDashboard.schoolDay)}
              </span>
              <SummaryStatusBadge status={projectedDashboard.status} />
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                Updated {formatBsDateTime(projectedDashboard.generatedAt)}
                <RefreshSummaryButton
                  onClick={() => void dashboardQuery.refetch()}
                  isLoading={dashboardQuery.isFetching}
                />
              </span>
            </>
          ) : undefined
        }
        primaryAction={
          primaryAction ? (
            <Link
              href={primaryAction.href}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-6 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
            >
              {primaryAction.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : undefined
        }
        moreActionItems={quickActions.length ? quickActions : undefined}
      />

      {dashboardQuery.isLoading ? <OperationalSummaryLoading /> : null}
      {dashboardQuery.isError ? (
        <OperationalSummaryError onRetry={() => void dashboardQuery.refetch()} />
      ) : null}
      {projectionMismatch ? (
        <PermissionDenied
          title="Dashboard unavailable"
          description="The server returned a dashboard projection that does not match your current access. Refresh or sign in again."
        />
      ) : null}
      {projectedDashboard ? (
        compositionPersona === "admin" ? (
          <AdminDashboard dashboard={projectedDashboard} />
        ) : compositionPersona === "principal" ? (
          <PrincipalDashboard dashboard={projectedDashboard} />
        ) : compositionPersona === "hr" ? (
          <HrDashboard dashboard={projectedDashboard} />
        ) : compositionPersona === "accountant" ? (
          <AccountantDashboard dashboard={projectedDashboard} />
        ) : null
      ) : null}
    </div>
  );
}
