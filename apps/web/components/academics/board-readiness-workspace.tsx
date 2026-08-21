"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  formatBsDate,
  type BoardReadinessState,
  type BoardReadinessTrack,
} from "@schoolos/core";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "@/components/session-provider";
import {
  academicsWorkspaceOverflowTabs,
  academicsWorkspaceTabs,
} from "@/components/academics/academics-tabs";
import { api } from "@/lib/api";
import { ModuleHeader } from "@/components/ui/module-header";
import { WorkspaceTabs } from "@/components/ui/module-tabs";
import { WorkSurface } from "@/components/ui/work-surface";
import { SummaryCard, SummaryGrid } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { Button } from "@/components/ui/button";

const TRACKS: Array<{
  value: BoardReadinessTrack;
  label: string;
  description: string;
}> = [
  {
    value: "GRADE_8",
    label: "Grade 8",
    description: "Grade 8 school and municipality examination preparation",
  },
  {
    value: "SEE",
    label: "SEE",
    description: "Grade 10 Secondary Education Examination preparation",
  },
  {
    value: "GRADE_12",
    label: "Grade 12",
    description: "Grade 12 national board examination preparation",
  },
];

export function BoardReadinessWorkspace() {
  const { hasPermissions } = useSession();
  const canRead =
    hasPermissions(["academics:read"]) || hasPermissions(["academics:manage"]);
  const [track, setTrack] = useState<BoardReadinessTrack>("GRADE_8");
  const readinessQuery = useQuery({
    queryKey: ["board-exam-readiness", track],
    queryFn: () => api.getBoardExamReadiness(track),
    enabled: canRead,
  });
  const readiness = readinessQuery.data;
  const readyCount =
    readiness?.indicators.filter((item) => item.state === "READY").length ?? 0;
  const attentionCount =
    readiness?.indicators.filter((item) => item.state === "NEEDS_ATTENTION")
      .length ?? 0;
  const blockedCount =
    readiness?.indicators.filter(
      (item) => item.state === "BLOCKED" || item.state === "UNAVAILABLE",
    ).length ?? 0;

  return (
    <div className="space-y-6" data-module="academics">
      <ModuleHeader
        eyebrow="M4 • Examination readiness"
        title="Board Examination Readiness"
        description="Review current-year completion and data-readiness checks for Grade 8, SEE, and Grade 12. These are operational checks, not predictions of student results."
      />
      <WorkspaceTabs
        items={academicsWorkspaceTabs}
        overflowItems={academicsWorkspaceOverflowTabs}
      />

      {!canRead ? (
        <PermissionDenied
          title="Board examination readiness is not available for your role"
          description="Ask a school administrator if you need access to examination-readiness checks."
          showNavigation={false}
        />
      ) : (
        <>
          <WorkSurface
            title="Readiness track"
            description="Each track uses active students, the latest examination term, submitted marks, report-card generation, and iEMIS data checks from the current academic year."
          >
            <div className="grid gap-3 md:grid-cols-3">
              {TRACKS.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  variant={track === item.value ? "default" : "outline"}
                  className="h-auto min-h-20 justify-start whitespace-normal p-4 text-left"
                  onClick={() => setTrack(item.value)}
                >
                  <span>
                    <span className="block font-bold">{item.label}</span>
                    <span className="mt-1 block text-xs font-medium opacity-80">
                      {item.description}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          </WorkSurface>

          {readinessQuery.isLoading ? (
            <LoadingState
              variant="spinner"
              label="Loading board examination readiness…"
            />
          ) : readinessQuery.isError ? (
            <ErrorState
              title="Readiness checks unavailable"
              message="The current readiness checks could not be loaded. No score has been inferred."
              onRetry={() => void readinessQuery.refetch()}
            />
          ) : !readiness ? (
            <EmptyState
              title="No readiness response"
              description="The school has not returned readiness information for this track."
            />
          ) : (
            <>
              <SummaryGrid>
                <SummaryCard
                  label="Checks ready"
                  value={readyCount}
                  icon={<CheckCircle2 />}
                  tone="success"
                  description={`${readiness.indicators.length} readiness checks`}
                />
                <SummaryCard
                  label="Need attention"
                  value={attentionCount}
                  icon={<AlertTriangle />}
                  tone={attentionCount > 0 ? "warning" : "success"}
                  description="Incomplete operational preparation"
                />
                <SummaryCard
                  label="Blocked or unavailable"
                  value={blockedCount}
                  icon={<ShieldAlert />}
                  tone={blockedCount > 0 ? "danger" : "success"}
                  description="Configuration or source-data gap"
                />
                <SummaryCard
                  label="Overall state"
                  value={readinessLabel(readiness.state)}
                  icon={<ClipboardCheck />}
                  tone={readinessTone(readiness.state)}
                  description={`Generated ${formatBsDate(readiness.generatedAt)}`}
                />
              </SummaryGrid>

              <WorkSurface
                title={`${TRACKS.find((item) => item.value === track)?.label ?? track} checks`}
                description={`Current academic year • Grade ${readiness.classLevel} • Rules-only, non-predictive readiness`}
              >
                <div className="space-y-3">
                  {readiness.indicators.map((indicator) => (
                    <article
                      key={indicator.code}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-bold text-slate-950">
                            {indicator.label}
                          </h3>
                          <p className="mt-1 text-sm text-slate-600">
                            {indicator.explanation}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-800">
                            {indicator.observed === null ||
                            indicator.expected === null
                              ? "Count unavailable"
                              : `${indicator.observed} of ${indicator.expected}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <StatusBadge status={indicator.state} />
                          {indicator.actionRoute ? (
                            <Link
                              href={indicator.actionRoute}
                              className="inline-flex items-center gap-1 text-sm font-bold text-[var(--color-mod-academics-text)] hover:underline"
                            >
                              Review source
                              <ArrowRight className="size-4" />
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </WorkSurface>

              <WorkSurface
                title="Source status"
                description="Unavailable and empty sources remain explicit; they are never converted into a zero-readiness score."
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {Object.entries(readiness.sourceStates).map(
                    ([source, state]) => (
                      <div
                        key={source}
                        className="rounded-xl border border-slate-200 p-3"
                      >
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          {source.replace(/([A-Z])/g, " $1")}
                        </p>
                        <p className="mt-1 font-semibold capitalize text-slate-900">
                          {state.replace(/_/g, " ").toLowerCase()}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </WorkSurface>
            </>
          )}
        </>
      )}
    </div>
  );
}

function readinessLabel(state: BoardReadinessState) {
  return state.replace(/_/g, " ").toLowerCase();
}

function readinessTone(state: BoardReadinessState) {
  if (state === "READY") return "success" as const;
  if (state === "NEEDS_ATTENTION") return "warning" as const;
  return "danger" as const;
}
