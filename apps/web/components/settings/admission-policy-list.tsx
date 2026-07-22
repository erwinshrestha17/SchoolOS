"use client";

import type {
  AdmissionPolicySummary,
  AdmissionPolicyStatus,
} from "@schoolos/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { admissionPoliciesApi } from "../../lib/api/admission-policies";
import { formatSchoolDate } from "../../lib/date-utils";
import { useSession } from "../session-provider";
import { ActionMenu } from "../ui/action-menu";
import { Button } from "../ui/button";
import { DataTable } from "../ui/data-table";
import { ErrorState } from "../ui/error-state";
import { KpiCard, KpiGrid } from "../ui/kpi-card";
import type { StatusTone } from "../ui/status-badge";
import { StatusBadge } from "../ui/status-badge";

const STATUS_TONE: Record<AdmissionPolicyStatus, StatusTone> = {
  DRAFT: "draft",
  ACTIVE: "active",
  SCHEDULED: "pending",
  EXPIRED: "inactive",
  ARCHIVED: "inactive",
  NEEDS_REVIEW: "conflict",
};

export function AdmissionPolicyList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermissions } = useSession();
  const canManage = hasPermissions(["admission_policy:manage"]);

  const policiesQuery = useQuery({
    queryKey: ["admission-policies"],
    queryFn: admissionPoliciesApi.list,
  });
  const duplicateMutation = useMutation({
    mutationFn: (policyId: string) =>
      admissionPoliciesApi.duplicate(policyId, {}),
    onSuccess: (duplicated) => {
      void queryClient.invalidateQueries({ queryKey: ["admission-policies"] });
      router.push(`/dashboard/settings/admissions/${duplicated.id}/edit`);
    },
  });
  const academicYearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: api.listAcademicYears,
  });
  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: api.listClasses,
  });

  const academicYearNames = new Map(
    (academicYearsQuery.data ?? []).map((year) => [year.id, year.name]),
  );
  const classNames = new Map(
    (classesQuery.data ?? []).map((schoolClass) => [
      schoolClass.id,
      schoolClass.name,
    ]),
  );

  if (policiesQuery.isError) {
    return (
      <ErrorState
        title="Admission policies could not load"
        message="Retry to load the school's admission policies."
        onRetry={() => void policiesQuery.refetch()}
      />
    );
  }

  const summary = policiesQuery.data?.summary;

  return (
    <div className="space-y-5">
      {canManage ? (
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => router.push("/dashboard/settings/admissions/new")}
          >
            <Plus className="h-4 w-4" />
            Create Admission Policy
          </Button>
        </div>
      ) : null}

      {duplicateMutation.isError ? (
        <p
          className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-800"
          role="alert"
        >
          This policy could not be duplicated. Please try again.
        </p>
      ) : null}

      <KpiGrid>
        <KpiCard
          title="Active Policies"
          value={summary?.activePolicies ?? 0}
          loading={policiesQuery.isLoading}
          tone="success"
        />
        <KpiCard
          title="Policies needing review"
          value={summary?.policiesNeedingReview ?? 0}
          loading={policiesQuery.isLoading}
          tone="warning"
        />
        <KpiCard
          title="Applications waiting for documents"
          value={summary?.applicationsWaitingForDocuments ?? 0}
          loading={policiesQuery.isLoading}
          tone="info"
        />
        <KpiCard
          title="Applications waiting for decision"
          value={summary?.applicationsWaitingForDecision ?? 0}
          loading={policiesQuery.isLoading}
          tone="neutral"
        />
      </KpiGrid>

      <DataTable<AdmissionPolicySummary>
        isLoading={policiesQuery.isLoading}
        data={policiesQuery.data?.policies ?? []}
        getRowKey={(policy) => policy.id}
        onRowClick={(policy) =>
          router.push(`/dashboard/settings/admissions/${policy.id}`)
        }
        emptyTitle="No admission policies yet"
        emptyMessage="Create your first admission policy to control what staff see when they start a new admission."
        columns={[
          {
            header: "Policy",
            cell: (policy) => (
              <Link
                href={`/dashboard/settings/admissions/${policy.id}`}
                className="font-bold text-slate-950 hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {policy.name}
                {policy.isDefault ? (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase text-slate-500">
                    Default
                  </span>
                ) : null}
              </Link>
            ),
          },
          {
            header: "Applies to",
            cell: (policy) => (
              <span className="text-slate-600">
                {[
                  policy.classId
                    ? (classNames.get(policy.classId) ?? "Class")
                    : null,
                  policy.academicYearId
                    ? (academicYearNames.get(policy.academicYearId) ?? null)
                    : null,
                  policy.gradeBand ? policy.gradeBand.replace(/_/g, " ") : null,
                  policy.applicantType !== "BOTH"
                    ? policy.applicantType === "TRANSFER"
                      ? "Transfer"
                      : "New admission"
                    : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "All admissions"}
              </span>
            ),
          },
          {
            header: "Documents",
            cell: (policy) => `${policy.requiredDocumentCount} required`,
          },
          { header: "Assessment", cell: (policy) => policy.assessment },
          {
            header: "Approval",
            cell: (policy) =>
              policy.approvalChainSummary
                ? `${policy.approvalChainSummary.stageCount} stage${policy.approvalChainSummary.stageCount === 1 ? "" : "s"}`
                : "Front-desk",
          },
          {
            header: "Status",
            cell: (policy) => (
              <StatusBadge
                status={policy.status}
                tone={STATUS_TONE[policy.status]}
              />
            ),
          },
          {
            header: "Last updated",
            cell: (policy) => formatSchoolDate(policy.updatedAt),
          },
          {
            header: "",
            cell: (policy) => (
              <div onClick={(event) => event.stopPropagation()}>
                <ActionMenu
                  items={[
                    {
                      label: "View policy",
                      onClick: () =>
                        router.push(
                          `/dashboard/settings/admissions/${policy.id}`,
                        ),
                    },
                    ...(canManage
                      ? [
                          {
                            label: "Edit policy",
                            onClick: () =>
                              router.push(
                                `/dashboard/settings/admissions/${policy.id}/edit`,
                              ),
                          },
                          {
                            label:
                              duplicateMutation.isPending &&
                              duplicateMutation.variables === policy.id
                                ? "Duplicating policy…"
                                : "Duplicate policy",
                            disabled: duplicateMutation.isPending,
                            onClick: () => duplicateMutation.mutate(policy.id),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
