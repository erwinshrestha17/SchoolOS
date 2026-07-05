"use client";

import {
  formatBsDate,
  formatBsDateTime,
  type AdmissionCaseReviewAction,
  type ReviewAdmissionCasePayload,
} from "@schoolos/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Loader2,
  ShieldAlert,
  UserCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { admissionCasesApi } from "../../lib/api/admission-cases";
import { useSession } from "../session-provider";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { LoadingState } from "../ui/loading-state";
import { ProtectedFileButton } from "../ui/protected-file";
import { StatusBadge } from "../ui/status-badge";

const ACTIONS_REQUIRING_REASON = new Set<AdmissionCaseReviewAction>([
  "REQUEST_INFORMATION",
  "APPROVE",
  "REJECT",
  "ESCALATE_TO_PRINCIPAL",
  "CLOSE",
]);

const ACTION_COPY: Record<
  AdmissionCaseReviewAction,
  { label: string; confirmation: string }
> = {
  REQUEST_INFORMATION: {
    label: "Request information",
    confirmation: "Request information",
  },
  ASSIGN_REVIEWER: {
    label: "Assign to me",
    confirmation: "Assign to me",
  },
  MARK_READY_FOR_REVIEW: {
    label: "Send for review",
    confirmation: "Send for review",
  },
  APPROVE: {
    label: "Approve application",
    confirmation: "Approve application",
  },
  REJECT: {
    label: "Do not admit",
    confirmation: "Confirm decision",
  },
  ESCALATE_TO_PRINCIPAL: {
    label: "Escalate to principal",
    confirmation: "Escalate case",
  },
  CLOSE: {
    label: "Close case",
    confirmation: "Close case",
  },
};

export function ApplicationReviewWorkspace({
  admissionCaseId,
}: {
  admissionCaseId: string;
}) {
  const queryClient = useQueryClient();
  const { session, hasPermissions } = useSession();
  const [selectedAction, setSelectedAction] =
    useState<AdmissionCaseReviewAction | null>(null);
  const [reason, setReason] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const caseQuery = useQuery({
    queryKey: ["admission-case", admissionCaseId],
    queryFn: () => admissionCasesApi.getCase(admissionCaseId),
  });

  const mutation = useMutation({
    mutationFn: (payload: ReviewAdmissionCasePayload) =>
      admissionCasesApi.reviewCase(admissionCaseId, payload),
    onSuccess: async (_, payload) => {
      setSuccessMessage(`${ACTION_COPY[payload.action].label} was recorded.`);
      setSelectedAction(null);
      setReason("");
      await queryClient.invalidateQueries({
        queryKey: ["admission-case", admissionCaseId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["admission-case-queues"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["admission-applications"],
      });
    },
    onError: () => setSuccessMessage(""),
  });

  if (caseQuery.isLoading) {
    return <LoadingState variant="page" label="Loading application review…" />;
  }

  if (caseQuery.isError || !caseQuery.data) {
    return (
      <ErrorState
        title="Application review could not load"
        message="The case may not exist in this school, or you may not have access. No review state was changed."
        onRetry={() => void caseQuery.refetch()}
      />
    );
  }

  const admissionCase = caseQuery.data;
  const canReview = hasPermissions(["students:manage_lifecycle"]);
  const availableActions = admissionCase.review.availableActions;
  const actionRequiresReason =
    selectedAction !== null && ACTIONS_REQUIRING_REASON.has(selectedAction);
  const actionCanSubmit =
    selectedAction !== null &&
    (!actionRequiresReason || reason.trim().length >= 5) &&
    (selectedAction !== "ASSIGN_REVIEWER" || Boolean(session?.user.id));

  function submitAction() {
    if (!selectedAction || !actionCanSubmit) return;
    mutation.mutate({
      action: selectedAction,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
      ...(selectedAction === "ASSIGN_REVIEWER" && session?.user.id
        ? { reviewerUserId: session.user.id }
        : {}),
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <main className="min-w-0 space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-mod-admissions-soft)] text-[var(--color-mod-admissions-text)]">
                <UserRound className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black text-slate-950">
                    {admissionCase.student.firstNameEn}{" "}
                    {admissionCase.student.lastNameEn}
                  </h2>
                  <StatusBadge status={admissionCase.displayStatus} />
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {admissionCase.nextActionLabel}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Updated {formatBsDateTime(admissionCase.updatedAt)}
                </p>
              </div>
            </div>
            <Link
              href={`/dashboard/admissions/cases/${admissionCase.id}`}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Open full case
            </Link>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-3">
          <ReviewCard
            title="Student"
            rows={[
              [
                "Date of birth",
                admissionCase.student.dateOfBirth
                  ? formatBsDate(admissionCase.student.dateOfBirth)
                  : "Not recorded",
              ],
              ["Gender", label(admissionCase.student.gender)],
              ["Source", label(admissionCase.source)],
            ]}
          />
          <ReviewCard
            title="Guardian"
            rows={[
              ["Name", admissionCase.guardian.fullName ?? "Not recorded"],
              [
                "Relationship",
                admissionCase.guardian.relationship ?? "Not recorded",
              ],
              ["Phone", admissionCase.guardian.phone ?? "Not recorded"],
            ]}
          />
          <ReviewCard
            title="Requested placement"
            rows={[
              [
                "Academic year",
                admissionCase.classSection.academicYearName ?? "Not selected",
              ],
              ["Class", admissionCase.classSection.className ?? "Not selected"],
              [
                "Section",
                admissionCase.classSection.sectionName ?? "Not selected",
              ],
            ]}
          />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-950">
                Eligibility and blockers
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                These checks are owned by the admission case service.
              </p>
            </div>
            <StatusBadge
              status={
                admissionCase.missingRequiredFields.length ||
                admissionCase.missingRequiredDocuments.length ||
                admissionCase.duplicateRisk
                  ? "ACTION NEEDED"
                  : "CHECKED"
              }
              tone={
                admissionCase.missingRequiredFields.length ||
                admissionCase.missingRequiredDocuments.length ||
                admissionCase.duplicateRisk
                  ? "pending"
                  : "approved"
              }
            />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ReviewIssue
              title="Missing information"
              items={admissionCase.missingRequiredFields}
            />
            <ReviewIssue
              title="Missing documents"
              items={admissionCase.missingRequiredDocuments}
            />
            {admissionCase.duplicateRisk ? (
              <ReviewIssue
                title="Possible duplicate"
                items={admissionCase.duplicateCandidates.map(
                  (candidate) =>
                    `${candidate.fullNameEn} · ${candidate.studentSystemId}`,
                )}
                warning
              />
            ) : null}
            {admissionCase.capacityStatus?.state === "FULL" ? (
              <ReviewIssue
                title="Section capacity"
                items={[
                  `Capacity ${admissionCase.capacityStatus.capacity}; enrolled ${admissionCase.capacityStatus.enrolled}.`,
                ]}
                warning
              />
            ) : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-base font-black text-slate-950">
              Admission documents
            </h2>
          </div>
          {admissionCase.documents.length === 0 ? (
            <EmptyState
              title="No admission documents"
              description="This case has no protected admission documents attached."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {admissionCase.documents.map((document) => (
                <div
                  key={document.fileId}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {document.title ?? label(document.kind)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {label(document.kind)}
                      </p>
                    </div>
                  </div>
                  <ProtectedFileButton
                    fileAssetId={document.fileId}
                    fileName={document.title ?? label(document.kind)}
                    action="preview"
                    size="sm"
                    showStatus={false}
                  >
                    Preview
                  </ProtectedFileButton>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <aside className="h-fit space-y-4 xl:sticky xl:top-24">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-[var(--color-mod-admissions-accent)]" />
            <h2 className="text-base font-black text-slate-950">
              Review decision
            </h2>
          </div>

          {!canReview ? (
            <div className="mt-4 rounded-xl border border-warning-100 bg-warning-50 p-3 text-xs leading-5 text-warning-800">
              <strong className="block">Read-only review</strong>
              You can view this case, but the backend requires the student
              lifecycle permission for review decisions.
            </div>
          ) : availableActions.length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
              <strong className="block">No review action available</strong>
              This case is approved, admitted, closed, or otherwise outside an
              editable review stage.
            </div>
          ) : (
            <div className="mt-4 grid gap-2">
              {availableActions.map((action) => (
                <Button
                  key={action}
                  type="button"
                  variant={action === "APPROVE" ? "default" : "outline"}
                  onClick={() => {
                    setSelectedAction(action);
                    setReason("");
                    setSuccessMessage("");
                  }}
                >
                  {action === "APPROVE" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : action === "ASSIGN_REVIEWER" ? (
                    <UserCheck className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  {ACTION_COPY[action].label}
                </Button>
              ))}
            </div>
          )}

          {selectedAction ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-black text-slate-900">
                {ACTION_COPY[selectedAction].label}
              </h3>
              {selectedAction === "ASSIGN_REVIEWER" ? (
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  This assigns the case to your authenticated school user. A
                  broader reviewer directory is not exposed by this workflow.
                </p>
              ) : (
                <label className="mt-3 block text-xs font-bold text-slate-700">
                  {actionRequiresReason ? "Decision reason" : "Review note"}
                  <textarea
                    rows={4}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={
                      actionRequiresReason
                        ? "Record a clear reason for the audit history."
                        : "Optional note for this transition."
                    }
                    className="mt-2 font-normal"
                  />
                </label>
              )}
              {actionRequiresReason &&
              reason.trim().length > 0 &&
              reason.trim().length < 5 ? (
                <p className="mt-2 text-xs font-semibold text-danger-700">
                  Enter at least five characters.
                </p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedAction(null);
                    setReason("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!actionCanSubmit || mutation.isPending}
                  onClick={submitAction}
                >
                  {mutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {ACTION_COPY[selectedAction].confirmation}
                </Button>
              </div>
            </div>
          ) : null}

          {mutation.isError ? (
            <p
              className="mt-4 rounded-xl border border-danger-100 bg-danger-50 p-3 text-xs font-semibold text-danger-800"
              role="alert"
            >
              {mutation.error instanceof Error
                ? mutation.error.message
                : "The review action could not be recorded."}
            </p>
          ) : null}
          {successMessage ? (
            <p
              className="mt-4 rounded-xl border border-success-100 bg-success-50 p-3 text-xs font-semibold text-success-800"
              role="status"
            >
              {successMessage}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-950">
            Review ownership
          </h2>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Reviewer</dt>
              <dd className="text-right font-bold text-slate-800">
                {admissionCase.review.reviewerUserId
                  ? admissionCase.review.reviewerUserId === session?.user.id
                    ? "Assigned to you"
                    : "Assigned reviewer"
                  : "Not assigned"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Due date</dt>
              <dd className="text-right font-bold text-slate-800">
                {admissionCase.review.dueDate
                  ? formatBsDate(admissionCase.review.dueDate)
                  : "Not set"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-950">Review history</h2>
          {admissionCase.review.history.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              No review decision has been recorded for this case.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {[...admissionCase.review.history]
                .reverse()
                .map((event, index) => (
                  <div
                    key={`${event.at}-${event.action}-${index}`}
                    className="border-l-2 border-primary-200 pl-3"
                  >
                    <p className="text-xs font-bold text-slate-800">
                      {label(event.action)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatBsDateTime(event.at)}
                    </p>
                    {event.reason ? (
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {event.reason}
                      </p>
                    ) : null}
                  </div>
                ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-warning-100 bg-warning-50 p-4 text-xs leading-5 text-warning-900">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <strong className="block">Still unavailable</strong>
              Reviewer scoring and interview scheduling are not shown because M1
              has no backend-owned rubric, score contract, or persisted
              interview record yet.
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}

function ReviewCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-black text-slate-950">{title}</h2>
      <dl className="mt-4 space-y-3 text-xs">
        {rows.map(([rowLabel, value]) => (
          <div key={rowLabel} className="flex justify-between gap-4">
            <dt className="text-slate-500">{rowLabel}</dt>
            <dd className="text-right font-bold text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ReviewIssue({
  title,
  items,
  warning = false,
}: {
  title: string;
  items: string[];
  warning?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-success-100 bg-success-50 p-3 text-xs font-semibold text-success-800">
        {title}: none
      </div>
    );
  }
  return (
    <div
      className={`rounded-xl border p-3 text-xs ${
        warning
          ? "border-warning-100 bg-warning-50 text-warning-900"
          : "border-danger-100 bg-danger-50 text-danger-900"
      }`}
    >
      <p className="font-black">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        {items.map((item) => (
          <li key={item}>{label(item)}</li>
        ))}
      </ul>
    </div>
  );
}

function label(value: string | null) {
  if (!value) return "Not recorded";
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
