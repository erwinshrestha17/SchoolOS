"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Bus, Utensils } from "lucide-react";
import { ModuleHeader } from "../../../../components/ui/module-header";
import { ErrorState } from "../../../../components/ui/error-state";
import { LoadingState } from "../../../../components/ui/loading-state";
import { ModuleLockedState } from "../../../../components/ui/module-locked-state";
import { PermissionDenied } from "../../../../components/ui/permission-denied";
import { SectionCard } from "../../../../components/ui/section-card";
import { request } from "../../../../lib/api/client";
import { usePermissionAccess } from "../../../../lib/permissions-ui";
import { useSchoolWebPersona } from "../../../../lib/school-web-persona";

type ModuleStatus = "ready" | "empty" | "partial" | "locked";
type OperationsModuleSummary = {
  status: ModuleStatus;
  metrics: Record<string, number | string | null>;
};
type PrincipalOperationsSummary = {
  generatedAt: string;
  schoolDay: string;
  modules: {
    library: OperationsModuleSummary;
    transport: OperationsModuleSummary;
    canteen: OperationsModuleSummary;
  };
};

export default function PrincipalOperationsOverviewPage() {
  const persona = useSchoolWebPersona();
  const access = usePermissionAccess();
  const canRead = access.hasPermission("reports:read");
  const summaryQuery = useQuery({
    queryKey: ["principal-operations-summary"],
    queryFn: () =>
      request<PrincipalOperationsSummary>("/dashboard/principal/operations-summary"),
    enabled: persona === "principal" && canRead,
    staleTime: 30_000,
  });

  if (access.resolution === "loading") {
    return <LoadingState variant="page" label="Checking operations access…" />;
  }
  if (persona !== "principal" || !canRead) {
    return (
      <PermissionDenied
        title="School Operations unavailable"
        description="This read-only leadership summary requires Principal report access."
      />
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        eyebrow="School readiness"
        title="School Operations Overview"
        description="Review Library, Transport, and Canteen health without opening operational desks or mutation controls."
      />
      {summaryQuery.isLoading ? (
        <LoadingState variant="page" label="Loading school operations…" />
      ) : null}
      {summaryQuery.isError ? (
        <ErrorState
          title="Could not load school operations"
          message="The leadership summary is temporarily unavailable. Please retry."
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : null}
      {summaryQuery.data ? (
        <div className="grid gap-5 xl:grid-cols-3">
          <OperationsCard
            name="Library"
            icon={BookOpen}
            summary={summaryQuery.data.modules.library}
            metrics={[
              ["activeLoans", "Active loans"],
              ["overdueLoans", "Overdue loans"],
              ["returnsDueToday", "Returns due today"],
              ["lostOrDamagedCopies", "Lost or damaged copies"],
            ]}
          />
          <OperationsCard
            name="Transport"
            icon={Bus}
            summary={summaryQuery.data.modules.transport}
            metrics={[
              ["activeTripsToday", "Active trips today"],
              ["delayedTrips", "Delayed trips"],
              ["tripsWithStaleGps", "Trips with stale GPS"],
              ["vehicleDocumentRisks", "Vehicle document risks"],
            ]}
          />
          <OperationsCard
            name="Canteen"
            icon={Utensils}
            summary={summaryQuery.data.modules.canteen}
            metrics={[
              ["completedSalesToday", "Completed sales"],
              ["servingsToday", "Meals served today"],
              ["outOfStockItems", "Out-of-stock items"],
              ["salesTodayAmount", "Sales amount today"],
            ]}
            moneyKey="salesTodayAmount"
          />
        </div>
      ) : null}
    </div>
  );
}

function OperationsCard({
  name,
  icon: Icon,
  summary,
  metrics,
  moneyKey,
}: {
  name: string;
  icon: typeof BookOpen;
  summary: OperationsModuleSummary;
  metrics: Array<[string, string]>;
  moneyKey?: string;
}) {
  if (summary.status === "locked") {
    return <ModuleLockedState moduleName={name} className="h-full" />;
  }

  return (
    <SectionCard
      title={name}
      description={
        summary.status === "partial"
          ? "Available information is shown. Some metrics are temporarily unavailable."
          : "Read-only leadership signals from this school operation."
      }
      headerAction={
        <span className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      }
    >
      <dl className="space-y-3">
        {metrics.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2.5">
            <dt className="text-sm font-semibold text-slate-700">{label}</dt>
            <dd className="text-sm font-black text-slate-950">
              {formatValue(summary.metrics[key], key === moneyKey)}
            </dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}

function formatValue(value: number | string | null | undefined, money: boolean) {
  if (value === null || value === undefined) return "Unavailable";
  if (money) {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? new Intl.NumberFormat("en-NP", {
          style: "currency",
          currency: "NPR",
          maximumFractionDigits: 2,
        }).format(numeric)
      : "Unavailable";
  }
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? new Intl.NumberFormat("en-NP").format(numeric)
    : String(value);
}
