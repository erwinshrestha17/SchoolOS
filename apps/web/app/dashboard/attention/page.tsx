"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ModuleHeader } from "../../../components/ui/module-header";
import { DashboardAttentionPanel } from "../../../components/dashboard/dashboard-attention-panel";
import {
  OperationalSummaryError,
  OperationalSummaryLoading,
  RefreshSummaryButton,
  SummaryStatusBadge,
} from "../../../components/ui/operational-summary";
import { PermissionDenied } from "../../../components/ui/permission-denied";
import { useSchoolWebPersona } from "../../../lib/school-web-persona";
import {
  assertServerDashboardProjection,
  resolveDashboardCompositionPersona,
} from "../../../lib/dashboard-persona";
import { api } from "../../../lib/api";
import { formatSchoolDate } from "../../../lib/date-utils";
import { formatBsDateTime } from "@schoolos/core";

export default function PrincipalAttentionPage() {
  const schoolWebPersona = useSchoolWebPersona();
  const expectedPersona = resolveDashboardCompositionPersona(schoolWebPersona);
  const isPrincipal = expectedPersona === "principal";
  const dashboardQuery = useQuery({
    queryKey: ["principal-attention-centre"],
    queryFn: api.getDashboardSummary,
    enabled: isPrincipal,
    staleTime: 30_000,
  });

  const dashboard = useMemo(
    () =>
      dashboardQuery.data && isPrincipal
        ? assertServerDashboardProjection(dashboardQuery.data, "principal")
        : null,
    [dashboardQuery.data, isPrincipal],
  );

  if (!isPrincipal) {
    return (
      <PermissionDenied
        title="Attention Centre unavailable"
        description="This leadership workspace is available only to the Principal persona."
      />
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        eyebrow="Leadership"
        title="Attention Centre"
        description="Review the school-wide exceptions that need your awareness or follow-up. Routine operational work stays in the owning staff workspace."
        metadata={
          dashboard ? (
            <>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                School day: {formatSchoolDate(dashboard.schoolDay)}
              </span>
              <SummaryStatusBadge status={dashboard.status} />
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                Updated {formatBsDateTime(dashboard.generatedAt)}
                <RefreshSummaryButton
                  onClick={() => void dashboardQuery.refetch()}
                  isLoading={dashboardQuery.isFetching}
                />
              </span>
            </>
          ) : undefined
        }
        primaryAction={
          <Link
            href="/dashboard/approvals"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-6 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
          >
            Open Approval Centre
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      {dashboardQuery.isLoading ? <OperationalSummaryLoading /> : null}
      {dashboardQuery.isError ? (
        <OperationalSummaryError onRetry={() => void dashboardQuery.refetch()} />
      ) : null}
      {dashboardQuery.isSuccess && dashboardQuery.data && !dashboard ? (
        <PermissionDenied
          title="Attention Centre unavailable"
          description="The server returned a dashboard projection that does not match your current access. Refresh or sign in again."
        />
      ) : null}
      {dashboard ? <DashboardAttentionPanel items={dashboard.attentionItems} /> : null}
    </div>
  );
}
