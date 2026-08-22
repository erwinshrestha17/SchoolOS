"use client";

import { formatBsDateTime } from "@schoolos/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { ModuleHeader } from "../../../components/ui/module-header";
import { Button } from "../../../components/ui/button";
import { EmptyState } from "../../../components/ui/empty-state";
import { ErrorState } from "../../../components/ui/error-state";
import { LoadingState } from "../../../components/ui/loading-state";
import { PermissionDenied } from "../../../components/ui/permission-denied";
import { SectionCard } from "../../../components/ui/section-card";
import { api, type ApprovalDecision, type ApprovalRequestSummary } from "../../../lib/api";
import { usePermissionAccess } from "../../../lib/permissions-ui";
import { useSchoolWebPersona } from "../../../lib/school-web-persona";

export default function PrincipalApprovalCentrePage() {
  const schoolWebPersona = useSchoolWebPersona();
  const access = usePermissionAccess();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirmDecision, setConfirmDecision] = useState<ApprovalDecision | null>(null);
  const isPrincipal = schoolWebPersona === "principal";
  const canRead = access.hasPermission("advanced:approvals:read");
  const canDecide = access.hasPermission("advanced:approvals:decide");

  const approvalQuery = useQuery({
    queryKey: ["principal-approval-centre"],
    queryFn: api.listApprovalRequests,
    enabled: isPrincipal && canRead,
    staleTime: 20_000,
  });

  const reviewable = useMemo(
    () =>
      (approvalQuery.data ?? []).filter(
        (request) =>
          request.status === "PENDING" &&
          canActorReviewRequest(request, access.session),
      ),
    [approvalQuery.data, access.session],
  );

  const selected =
    reviewable.find((request) => request.id === selectedId) ??
    reviewable[0] ??
    null;

  const decisionMutation = useMutation({
    mutationFn: async (decision: ApprovalDecision) => {
      if (!selected) throw new Error("No approval request selected");
      if (decision === "REJECT" && !reason.trim()) {
        throw new Error("Rejection reason is required");
      }
      return api.decideApprovalRequest(selected.id, {
        decision,
        reason: reason.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
    },
    onSuccess: async () => {
      setReason("");
      setConfirmDecision(null);
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: ["principal-approval-centre"] });
      await queryClient.invalidateQueries({ queryKey: ["operational-dashboard-summary"] });
    },
  });

  if (access.resolution === "loading") {
    return <LoadingState variant="page" label="Checking approval access…" />;
  }

  if (!isPrincipal || !canRead) {
    return (
      <PermissionDenied
        title="Approval Centre unavailable"
        description="This workspace is available only to Principals with approval review access."
      />
    );
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        eyebrow="Leadership"
        title="Approval Centre"
        description="Review genuine school decisions that require your authority. Routine follow-up items stay in the Attention Centre."
      />

      {approvalQuery.isLoading ? (
        <LoadingState variant="page" label="Loading approvals…" />
      ) : null}
      {approvalQuery.isError ? (
        <ErrorState
          title="Could not load approvals"
          message="The approval queue is unavailable right now. Please retry."
          onRetry={() => void approvalQuery.refetch()}
        />
      ) : null}

      {approvalQuery.isSuccess && reviewable.length === 0 ? (
        <EmptyState
          title="No approvals waiting"
          description="There are no pending decisions assigned to your current Principal access."
        />
      ) : null}

      {reviewable.length ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <SectionCard
            title="Waiting for your decision"
            description={`${reviewable.length} pending request${reviewable.length === 1 ? "" : "s"} matched your current role and permissions.`}
          >
            <div className="space-y-2">
              {reviewable.map((request) => {
                const active = selected?.id === request.id;
                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(request.id);
                      setReason("");
                      setConfirmDecision(null);
                      decisionMutation.reset();
                    }}
                    className={`w-full rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 ${
                      active
                        ? "border-[var(--primary)] bg-[var(--primary-soft)]/35"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950">
                          {request.title}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-600">
                          {workflowLabel(request.workflowType)} · {moduleLabel(request.targetModule)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-amber-700">
                        Pending
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-5 text-slate-700">
                      {request.reason}
                    </p>
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      Submitted {formatBsDateTime(request.createdAt)}
                    </p>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {selected ? (
            <SectionCard
              title="Review decision"
              description="Check the request, its safe context, and the decision impact before confirming."
            >
              <div className="space-y-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Request
                  </p>
                  <h2 className="mt-2 text-lg font-black text-slate-950">
                    {selected.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {selected.reason}
                  </p>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <ReviewFact label="Workflow" value={workflowLabel(selected.workflowType)} />
                    <ReviewFact label="Module" value={moduleLabel(selected.targetModule)} />
                    <ReviewFact label="Record type" value={humanize(selected.targetType)} />
                    <ReviewFact
                      label="Deadline"
                      value={selected.deadlineAt ? formatBsDateTime(selected.deadlineAt) : "No deadline set"}
                    />
                  </dl>
                </div>

                <SafeContext context={selected.safeContext} />

                <div>
                  <label htmlFor="approval-reason" className="text-sm font-bold text-slate-900">
                    Decision note
                  </label>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Required when rejecting. Add a short reason for approvals when it helps the audit trail.
                  </p>
                  <textarea
                    id="approval-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={4}
                    maxLength={500}
                    className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)]"
                    placeholder="Add a clear decision note…"
                  />
                </div>

                {decisionMutation.isError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800" role="alert">
                    {confirmDecision === "REJECT" && !reason.trim()
                      ? "Enter a rejection reason before confirming."
                      : "The decision could not be saved. Nothing was changed. Please retry."}
                  </div>
                ) : null}

                {confirmDecision ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      {confirmDecision === "APPROVE" ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                      ) : (
                        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
                      )}
                      <div>
                        <p className="font-bold text-slate-950">
                          Confirm {confirmDecision === "APPROVE" ? "approval" : "rejection"}
                        </p>
                        <p className="mt-1 text-sm leading-5 text-slate-600">
                          This creates an audited decision and may immediately apply the module&apos;s registered final action.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setConfirmDecision(null);
                          decisionMutation.reset();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant={confirmDecision === "REJECT" ? "destructive" : "default"}
                        isLoading={decisionMutation.isPending}
                        disabled={confirmDecision === "REJECT" && !reason.trim()}
                        onClick={() => decisionMutation.mutate(confirmDecision)}
                      >
                        Confirm {confirmDecision === "APPROVE" ? "approval" : "rejection"}
                      </Button>
                    </div>
                  </div>
                ) : canDecide ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        decisionMutation.reset();
                        setConfirmDecision("REJECT");
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        decisionMutation.reset();
                        setConfirmDecision("APPROVE");
                      }}
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                      Approve
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    You can review this request, but your current access does not allow decisions.
                  </div>
                )}
              </div>
            </SectionCard>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function canActorReviewRequest(
  request: ApprovalRequestSummary,
  session: ReturnType<typeof usePermissionAccess>["session"],
) {
  if (!session) return false;
  if (request.delegatedToId && request.delegatedToId !== session.user.id) {
    return false;
  }
  const step = [...request.steps]
    .sort((left, right) => left.sequence - right.sequence)
    .find((item) => item.status === "PENDING");
  if (!step) return false;

  const roles = new Set(session.user.roles.map((role) => role.toLowerCase()));
  const permissions = new Set(session.user.permissions);
  const roleMatches = !step.approverRole || roles.has(step.approverRole.toLowerCase());
  const permissionMatches =
    !step.approverPermission || permissions.has(step.approverPermission as never);
  return roleMatches && permissionMatches;
}

function SafeContext({ context }: { context: Record<string, unknown> | null }) {
  const entries = Object.entries(context ?? {}).filter(
    ([, value]) =>
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean",
  );
  if (!entries.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-slate-900">Decision context</p>
        <p className="mt-1 text-sm text-slate-600">
          No additional safe context was attached to this request.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-bold text-slate-900">Decision context</p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {entries.slice(0, 8).map(([key, value]) => (
          <ReviewFact key={key} label={humanize(key)} value={String(value ?? "Not provided")} />
        ))}
      </dl>
    </div>
  );
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function workflowLabel(value: string) {
  const labels: Record<string, string> = {
    FEE_REVERSAL_REFUND: "Fee reversal or refund",
    SCHOLARSHIP_DISCOUNT: "Scholarship or discount",
    MARKS_CORRECTION: "Marks correction",
    ATTENDANCE_CORRECTION: "Attendance correction",
    LEAVE_REQUEST: "Leave request",
    PAYROLL_POSTING_REVERSAL: "Payroll posting or reversal",
    STUDENT_TRANSFER_WITHDRAWAL: "Student transfer or withdrawal",
    DOCUMENT_DELETION_ARCHIVE: "Document deletion or archive",
    EMERGENCY_HIGH_IMPACT_NOTICE: "High-impact notice",
    PLATFORM_SUPPORT_OVERRIDE: "Platform support override",
    ADMISSION_CASE: "Admission case",
    FISCAL_PERIOD_REOPEN: "Fiscal period reopen",
  };
  return labels[value] ?? humanize(value);
}

function moduleLabel(value: string) {
  const labels: Record<string, string> = {
    attendance: "Attendance",
    academics: "Academics",
    fees: "Fees & receipts",
    finance: "Finance",
    hr: "Staff & HR",
    payroll: "Payroll",
    admissions: "Admissions",
    students: "Students",
    notices: "Notices",
    communications: "Communication",
    accounting: "Accounting",
  };
  return labels[value.toLowerCase()] ?? humanize(value);
}

function humanize(value: string) {
  return value
    .replace(/[_:-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
