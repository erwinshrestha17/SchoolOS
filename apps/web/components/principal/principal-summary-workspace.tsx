"use client";

import type {
  OperationalModuleSummary,
  OperationalSummaryMetricValue,
  OperationalSummaryRouteModule,
} from "@schoolos/core";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { api } from "../../lib/api";
import { useSchoolWebPersona } from "../../lib/school-web-persona";
import { ModuleHeader } from "../ui/module-header";
import { LoadingState } from "../ui/loading-state";
import { ErrorState } from "../ui/error-state";
import { PermissionDenied } from "../ui/permission-denied";
import { ModuleLockedState } from "../ui/module-locked-state";
import { SectionCard } from "../ui/section-card";
import { SummaryStatusBadge } from "../ui/operational-summary";

export type PrincipalMetricDefinition = {
  key: string;
  label: string;
  description?: string;
};

export type PrincipalSummaryDefinition = {
  module: OperationalSummaryRouteModule;
  title: string;
  description: string;
  moduleName: string;
  metrics: PrincipalMetricDefinition[];
};

export function PrincipalSummaryWorkspace({
  eyebrow = "Leadership oversight",
  title,
  description,
  definitions,
  attentionHref = "/dashboard/attention",
}: {
  eyebrow?: string;
  title: string;
  description: string;
  definitions: PrincipalSummaryDefinition[];
  attentionHref?: string | null;
}) {
  const persona = useSchoolWebPersona();
  const queries = useQueries({
    queries: definitions.map((definition) => ({
      queryKey: ["principal-summary", definition.module],
      queryFn: () => api.getModuleSummary(definition.module),
      enabled: persona === "principal",
      staleTime: 30_000,
    })),
  });

  if (persona !== "principal") {
    return (
      <PermissionDenied
        title={`${title} unavailable`}
        description="This read-only leadership workspace is available only to the Principal persona."
      />
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="space-y-5">
        {definitions.map((definition, index) => (
          <PrincipalSummarySection
            key={definition.module}
            definition={definition}
            query={queries[index]}
            attentionHref={attentionHref}
          />
        ))}
      </div>
    </div>
  );
}

function PrincipalSummarySection({
  definition,
  query,
  attentionHref,
}: {
  definition: PrincipalSummaryDefinition;
  query: UseQueryResult<OperationalModuleSummary, Error>;
  attentionHref: string | null;
}) {
  if (query.isLoading) {
    return (
      <LoadingState
        variant="spinner"
        label={`Loading ${definition.moduleName.toLowerCase()} summary…`}
      />
    );
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title={`Could not load ${definition.moduleName.toLowerCase()} summary`}
        message="This leadership summary is temporarily unavailable. Please retry."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const summary = query.data as OperationalModuleSummary;
  if (summary.status === "locked") {
    return (
      <ModuleLockedState
        moduleName={definition.moduleName}
        description="This leadership summary is unavailable because the module is not enabled for this school."
      />
    );
  }
  if (summary.status === "permissionDenied") {
    return (
      <PermissionDenied
        title={`${definition.moduleName} summary unavailable`}
        description="Your current Principal access does not include this module summary. No module data is shown."
      />
    );
  }

  const visibleMetrics = definition.metrics.map((metric) => ({
    ...metric,
    value: metricValue(summary, metric.key),
  }));
  const openAttention = summary.attentionItems.filter((item) => item.count > 0);

  return (
    <SectionCard
      title={definition.title}
      description={definition.description}
      headerAction={<SummaryStatusBadge status={summary.status} />}
      footer={
        attentionHref && openAttention.length ? (
          <Link
            href={attentionHref}
            className="inline-flex items-center gap-2 text-sm font-bold text-[var(--primary)] transition hover:text-[var(--primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-soft)] focus-visible:ring-offset-2"
          >
            Review related attention items
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : undefined
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleMetrics.map((metric) => (
          <article key={metric.key} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {metric.label}
            </p>
            <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              {formatMetric(metric.value)}
            </p>
            {metric.description ? (
              <p className="mt-1 text-xs font-medium leading-5 text-slate-600">
                {metric.description}
              </p>
            ) : null}
          </article>
        ))}
      </div>

      {summary.status === "partial" ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-600">
          Some information is temporarily unavailable. Available backend data is shown above.
        </p>
      ) : null}

      {openAttention.length ? (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-sm font-bold text-slate-950">Exceptions reported</p>
          <ul className="mt-2 space-y-2">
            {openAttention.slice(0, 4).map((item) => (
              <li
                key={item.key}
                className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5"
              >
                <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                  {item.label}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-700">
                  {formatMetric(item.count)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          No exceptions are reported in this summary.
        </div>
      )}
    </SectionCard>
  );
}

function metricValue(summary: OperationalModuleSummary, key: string) {
  return Object.prototype.hasOwnProperty.call(summary.summary, key)
    ? summary.summary[key]
    : null;
}

function formatMetric(value: OperationalSummaryMetricValue) {
  if (value === null || value === undefined) return "Unavailable";
  if (typeof value === "number") return new Intl.NumberFormat("en-NP").format(value);
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return new Intl.NumberFormat("en-NP", { maximumFractionDigits: 2 }).format(Number(value));
  }
  return value;
}
