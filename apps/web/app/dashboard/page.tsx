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
import { OperationalDashboardLayout } from "../../components/dashboard/operational-dashboard-layout";
import { TeacherTodayWorkspace } from "../../components/dashboard/teacher-today-workspace";
import { useTeacherAccess } from "../../lib/teacher-access";
import { useSchoolWebPersona } from "../../lib/school-web-persona";
import {
  projectDashboardForPersona,
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
import { LoadingState } from "../../components/ui/loading-state";
import { usePermissionAccess } from "../../lib/permissions-ui";
import { api } from "../../lib/api";
import { formatSchoolDate } from "../../lib/date-utils";

export default function DashboardPage() {
  const router = useRouter();
  const { isTeacherPersona } = useTeacherAccess();
  const schoolWebPersona = useSchoolWebPersona();
  const { resolution: permissionResolution } = usePermissionAccess();
  const compositionPersona = resolveDashboardCompositionPersona(
    schoolWebPersona,
  );

  const dashboardQuery = useQuery({
    queryKey: ["operational-dashboard-summary", compositionPersona],
    queryFn: api.getDashboardSummary,
    staleTime: 30_000,
    enabled: !isTeacherPersona && permissionResolution === "granted",
  });

  const projectedDashboard = useMemo(
    () =>
      dashboardQuery.data
        ? projectDashboardForPersona(dashboardQuery.data, compositionPersona)
        : null,
    [dashboardQuery.data, compositionPersona],
  );

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
        : {
            eyebrow: "School operations",
            title: "School Overview",
            description: "Daily operating snapshot for your school.",
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
      {projectedDashboard ? (
        compositionPersona === "admin" ? (
          <AdminDashboard dashboard={projectedDashboard} />
        ) : compositionPersona === "principal" ? (
          <PrincipalDashboard dashboard={projectedDashboard} />
        ) : (
          <OperationalDashboardLayout
            dashboard={projectedDashboard}
            persona="general"
          />
        )
      ) : null}
    </div>
  );
}
