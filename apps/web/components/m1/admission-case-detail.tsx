"use client";

import type {
  AdmissionCase,
  CreateAdmissionCasePayload,
  ReviewAdmissionCasePayload,
} from "@schoolos/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Loader2,
  ShieldAlert,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "../../lib/api";
import { admissionCasesApi } from "../../lib/api/admission-cases";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { ErrorState } from "../ui/error-state";
import { ProtectedFileButton } from "../ui/protected-file";
import { SectionCard } from "../ui/section-card";

export function AdmissionCaseDetail({
  admissionCaseId,
}: {
  admissionCaseId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reviewAction, setReviewAction] = useState<
    Exclude<ReviewAdmissionCasePayload["action"], "REJECT"> | null
  >(null);
  const [reason, setReason] = useState("");
  const [confirmDuplicateOverride, setConfirmDuplicateOverride] =
    useState(false);
  // "Not admit" is a hard-to-reverse decision on a real applicant, so it gets
  // its own confirmation dialog and destructive styling instead of sharing
  // the inline reason panel used by the reversible review actions.
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const caseQuery = useQuery({
    queryKey: ["admission-case", admissionCaseId],
    queryFn: () => admissionCasesApi.getCase(admissionCaseId),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["admission-case", admissionCaseId],
    });
    await queryClient.invalidateQueries({
      queryKey: ["admission-case-queues"],
    });
  };

  const reviewMutation = useMutation({
    mutationFn: (payload: ReviewAdmissionCasePayload) =>
      admissionCasesApi.reviewCase(admissionCaseId, payload),
    onSuccess: async () => {
      setReviewAction(null);
      setReason("");
      setRejectDialogOpen(false);
      setRejectReason("");
      await refresh();
    },
  });

  const directAdmitMutation = useMutation({
    mutationFn: () =>
      admissionCasesApi.directAdmit(
        admissionCaseId,
        confirmDuplicateOverride
          ? { overrideDuplicate: true, overrideReason: reason }
          : {},
      ),
    onSuccess: (result) => router.push(result.redirectPath),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => admissionCasesApi.finalize(admissionCaseId, {}),
    onSuccess: (result) => router.push(result.redirectPath),
  });

  if (caseQuery.isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading admission case…
      </div>
    );
  }
  if (caseQuery.isError || !caseQuery.data) {
    return (
      <ErrorState
        title="Admission case could not load"
        message="No admission details were changed. Retry to view the current case."
        onRetry={() => void caseQuery.refetch()}
      />
    );
  }

  const admissionCase = caseQuery.data;
  const canFinalize = admissionCase.displayStatus === "APPROVED";
  const canDirectAdmit =
    (admissionCase.canAdmitDirectly || admissionCase.canOverrideDuplicate) &&
    admissionCase.displayStatus !== "ADMITTED";
  const availableReviewActions = new Set(admissionCase.review.availableActions);
  const mutationError =
    readError(reviewMutation.error) ||
    readError(directAdmitMutation.error) ||
    readError(finalizeMutation.error);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-500">Admission case</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            {admissionCase.student.firstNameEn}{" "}
            {admissionCase.student.lastNameEn}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {admissionCase.nextActionLabel}
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-800">
          {statusLabel(admissionCase.displayStatus)}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard
          title="Student"
          description="Saved admission-case information"
        >
          <Detail
            label="English name"
            value={`${admissionCase.student.firstNameEn} ${admissionCase.student.lastNameEn}`}
          />
          <Detail
            label="Nepali name"
            value={
              [
                admissionCase.student.firstNameNp,
                admissionCase.student.lastNameNp,
              ]
                .filter(Boolean)
                .join(" ") || "Not added"
            }
          />
          <Detail
            label="Date of birth"
            value={admissionCase.student.dateOfBirth ?? "Not added"}
          />
          <Detail
            label="Gender"
            value={
              admissionCase.student.gender
                ? statusLabel(admissionCase.student.gender)
                : "Not added"
            }
          />
        </SectionCard>
        <SectionCard
          title="Guardian"
          description="Portal access is not created by admission"
        >
          <Detail
            label="Name"
            value={admissionCase.guardian.fullName ?? "Not added"}
          />
          <Detail
            label="Relationship"
            value={admissionCase.guardian.relationship ?? "Not added"}
          />
          <Detail
            label="Phone"
            value={admissionCase.guardian.phone ?? "Not added"}
          />
          <Detail
            label="Email"
            value={admissionCase.guardian.email ?? "Not added"}
          />
        </SectionCard>
        <SectionCard title="Placement" description="Saved academic placement">
          <Detail
            label="Academic year"
            value={admissionCase.classSection.academicYearName ?? "Not added"}
          />
          <Detail
            label="Class"
            value={admissionCase.classSection.className ?? "Not added"}
          />
          <Detail
            label="Section"
            value={admissionCase.classSection.sectionName ?? "Not selected"}
          />
          <Detail
            label="Admission date"
            value={admissionCase.academic.admissionDate ?? "Not added"}
          />
        </SectionCard>
      </div>

      {admissionCase.documents.length > 0 ? (
        <SectionCard
          title="Admission documents"
          description="Protected files linked to this admission case."
        >
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {admissionCase.documents.map((document) => (
              <li
                key={document.fileId}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {document.title ?? humanize(document.kind)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {humanize(document.kind)}
                  </p>
                </div>
                <ProtectedFileButton
                  fileAssetId={document.fileId}
                  fileName={document.title ?? humanize(document.kind)}
                  action="preview"
                  size="sm"
                  showStatus={false}
                >
                  View protected file
                </ProtectedFileButton>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Admission check"
        description="The backend decides whether this case can be admitted now."
      >
        <div className="space-y-3">
          {admissionCase.missingRequiredFields.length > 0 ? (
            <Issue
              title="Information needed"
              items={admissionCase.missingRequiredFields}
            />
          ) : null}
          {admissionCase.missingRequiredDocuments.length > 0 ? (
            <Issue
              title="Documents needed"
              items={admissionCase.missingRequiredDocuments}
            />
          ) : null}
          {admissionCase.duplicateRisk ? (
            <Issue
              title="Possible duplicate"
              warning
              items={admissionCase.duplicateCandidates.map(
                (candidate) =>
                  `${candidate.fullNameEn} · ${candidate.className}${candidate.sectionName ? ` ${candidate.sectionName}` : ""}`,
              )}
            />
          ) : null}
          {admissionCase.requiresReview ? (
            <Issue
              title="Review required"
              warning
              items={[
                admissionCase.requiresApproval
                  ? "Principal approval is required before finalizing this admission."
                  : "This admission must be reviewed before it can be finalized.",
              ]}
            />
          ) : null}
          {admissionCase.capacityStatus?.state === "FULL" ? (
            <Issue
              title="Section capacity is full"
              items={[
                `Capacity: ${admissionCase.capacityStatus.capacity}; enrolled: ${admissionCase.capacityStatus.enrolled}.`,
              ]}
            />
          ) : null}
          {admissionCase.capacityStatus?.state === "NEARLY_FULL" ? (
            <Issue
              title="Section capacity is nearly full"
              warning
              items={[
                `Capacity: ${admissionCase.capacityStatus.capacity}; enrolled: ${admissionCase.capacityStatus.enrolled}.`,
              ]}
            />
          ) : null}
          {!admissionCase.missingRequiredFields.length &&
          !admissionCase.missingRequiredDocuments.length &&
          !admissionCase.duplicateRisk &&
          !admissionCase.requiresReview ? (
            <p className="flex items-center gap-2 rounded-xl border border-success-200 bg-success-50 p-3 text-sm font-bold text-success-800">
              <CheckCircle2 className="h-5 w-5" />
              This case is ready to admit.
            </p>
          ) : null}
        </div>
      </SectionCard>

      {admissionCase.displayStatus === "WAITING_FOR_REVIEW" &&
      admissionCase.approvalChain ? (
        <SectionCard
          title="Approval chain"
          description="This admission needs sequential sign-off before it can be finalized."
        >
          <p className="text-sm font-semibold text-slate-800">
            Stage {admissionCase.approvalChain.currentStageIndex ?? 1}
            {admissionCase.approvalChain.totalStages
              ? ` of ${admissionCase.approvalChain.totalStages}`
              : ""}
            {" — waiting on "}
            {admissionCase.approvalChain.currentStageRole ??
              admissionCase.approvalChain.currentStagePermission ??
              "principal/admin"}
          </p>
        </SectionCard>
      ) : null}

      {admissionCase.missingRequiredFields.length > 0 ? (
        <AdmissionCaseMissingDetails
          admissionCase={admissionCase}
          onSaved={refresh}
        />
      ) : null}
      {admissionCase.missingRequiredDocuments.length > 0 ? (
        <AdmissionCaseDocumentUpload
          admissionCase={admissionCase}
          onSaved={refresh}
        />
      ) : null}

      {admissionCase.followUps.length > 0 ? (
        <SectionCard
          title="After admission"
          description="These are follow-up cards, not payment or admission blockers."
        >
          <ul className="space-y-2 text-sm text-slate-700">
            {admissionCase.followUps.map((item) => (
              <li
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                key={item.code}
              >
                {item.label}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {admissionCase.canOverrideDuplicate ? (
        <SectionCard
          title="Duplicate override"
          description="Your permission allows direct admission only after recording why this is a different student. No records will be merged."
        >
          <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={confirmDuplicateOverride}
              onChange={(event) =>
                setConfirmDuplicateOverride(event.target.checked)
              }
            />
            I have reviewed the duplicate warning.
          </label>
          <label className="mt-3 block space-y-2 text-sm font-bold text-slate-700">
            <span>Reason for override</span>
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explain why this is not the same student."
            />
          </label>
        </SectionCard>
      ) : null}

      {reviewAction ? (
        <SectionCard
          title={
            reviewAction === "REQUEST_INFORMATION"
              ? "Request information"
              : reviewAction === "APPROVE"
                ? "Approve this admission case"
                : reviewAction === "WAITLIST"
                  ? "Waitlist this applicant"
                  : "Review this admission"
          }
          description="A reason is recorded in the admission audit history."
        >
          <label className="block space-y-2 text-sm font-bold text-slate-700">
            <span>Reason</span>
            <textarea
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Write a clear school-office reason."
            />
          </label>
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReviewAction(null);
                setReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={reviewMutation.isPending || reason.trim().length < 5}
              onClick={() =>
                reviewMutation.mutate({
                  action: reviewAction,
                  reason: reason.trim(),
                })
              }
            >
              {reviewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Confirm
            </Button>
          </div>
        </SectionCard>
      ) : null}

      {mutationError ? (
        <p
          className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-800"
          role="alert"
        >
          {mutationError}
        </p>
      ) : null}

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <Link
          href="/dashboard/admissions"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to admissions
        </Link>
        <div className="flex flex-wrap gap-2">
          {availableReviewActions.has("REQUEST_INFORMATION") ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setReviewAction("REQUEST_INFORMATION")}
            >
              <ShieldAlert className="h-4 w-4" />
              Request information
            </Button>
          ) : null}
          {availableReviewActions.has("APPROVE") ? (
            <Button
              type="button"
              onClick={() => setReviewAction("APPROVE")}
            >
              <ClipboardCheck className="h-4 w-4" />
              Approve
            </Button>
          ) : null}
          {availableReviewActions.has("REJECT") ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setRejectDialogOpen(true)}
            >
              <AlertTriangle className="h-4 w-4" />
              Do not admit
            </Button>
          ) : null}
          {availableReviewActions.has("WAITLIST") ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setReviewAction("WAITLIST")}
            >
              <AlertTriangle className="h-4 w-4" />
              Waitlist
            </Button>
          ) : null}
          {availableReviewActions.has("PROMOTE_FROM_WAITLIST") ? (
            <Button
              type="button"
              disabled={reviewMutation.isPending}
              onClick={() =>
                reviewMutation.mutate({ action: "PROMOTE_FROM_WAITLIST" })
              }
            >
              {reviewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserRoundCheck className="h-4 w-4" />
              )}
              Promote from waitlist
            </Button>
          ) : null}
          {canFinalize ? (
            <Button
              type="button"
              disabled={finalizeMutation.isPending}
              onClick={() => finalizeMutation.mutate()}
            >
              {finalizeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserRoundCheck className="h-4 w-4" />
              )}
              Finalize admission
            </Button>
          ) : null}
          {canDirectAdmit ? (
            <Button
              type="button"
              disabled={
                directAdmitMutation.isPending ||
                (admissionCase.canOverrideDuplicate &&
                  (!confirmDuplicateOverride || !reason.trim()))
              }
              onClick={() => directAdmitMutation.mutate()}
            >
              {directAdmitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserRoundCheck className="h-4 w-4" />
              )}
              {admissionCase.canOverrideDuplicate
                ? "Admit with override"
                : "Admit student"}
            </Button>
          ) : null}
          {admissionCase.displayStatus === "ADMITTED" &&
          admissionCase.admittedStudentId ? (
            <Link
              href={`/dashboard/students/${admissionCase.admittedStudentId}`}
              className="inline-flex min-h-11 items-center rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 text-sm font-bold text-white"
            >
              Open student profile
            </Link>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        isOpen={rejectDialogOpen}
        title="Do not admit this applicant?"
        description="This records a final decision on the admission case and is kept in the admission audit history. It does not delete any saved information, but the family will need to start a new application to be reconsidered."
        confirmLabel="Do not admit"
        destructive
        isConfirming={reviewMutation.isPending}
        confirmDisabled={rejectReason.trim().length < 5}
        onClose={() => {
          setRejectDialogOpen(false);
          setRejectReason("");
        }}
        onConfirm={() =>
          reviewMutation.mutate({
            action: "REJECT",
            reason: rejectReason.trim(),
          })
        }
      >
        <label className="block space-y-2 text-sm font-bold text-slate-700">
          <span>Reason</span>
          <textarea
            rows={4}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Write a clear school-office reason."
          />
        </label>
        {rejectDialogOpen && reviewMutation.isError ? (
          <p
            className="mt-2 text-sm font-semibold text-danger-700"
            role="alert"
          >
            {readError(reviewMutation.error)}
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 py-2.5 last:border-b-0">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function AdmissionCaseMissingDetails({
  admissionCase,
  onSaved,
}: {
  admissionCase: AdmissionCase;
  onSaved: () => Promise<void>;
}) {
  const [corrections, setCorrections] = useState<
    Partial<CreateAdmissionCasePayload>
  >({});
  const needsPlacement = admissionCase.missingRequiredFields.some((field) =>
    ["academicYearId", "classId", "sectionId"].includes(field),
  );
  const academicYears = useQuery({
    queryKey: ["academic-years"],
    queryFn: api.listAcademicYears,
    enabled: needsPlacement,
  });
  const classes = useQuery({
    queryKey: ["classes"],
    queryFn: api.listClasses,
    enabled: needsPlacement,
  });
  const sections = useQuery({
    queryKey: ["sections"],
    queryFn: api.listSections,
    enabled: needsPlacement,
  });
  const classId = corrections.classId ?? admissionCase.academic.classId ?? "";
  const availableSections = (sections.data ?? []).filter(
    (section) => (section.classId ?? section.class?.id) === classId,
  );
  const mutation = useMutation({
    mutationFn: () =>
      admissionCasesApi.updateCase(admissionCase.id, corrections),
    onSuccess: async () => {
      setCorrections({});
      await onSaved();
    },
  });
  const update = <K extends keyof CreateAdmissionCasePayload>(
    key: K,
    value: CreateAdmissionCasePayload[K],
  ) => setCorrections((current) => ({ ...current, [key]: value }));

  return (
    <SectionCard
      title="Complete missing information"
      description="Only the fields still required by school policy are shown. Saved admission details are not repeated."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {admissionCase.missingRequiredFields.map((field) => {
          if (field === "dateOfBirth")
            return (
              <CorrectionField key={field} label="Date of birth">
                <input
                  type="date"
                  value={corrections.dateOfBirth ?? ""}
                  onChange={(event) =>
                    update("dateOfBirth", event.target.value)
                  }
                />
              </CorrectionField>
            );
          if (field === "gender")
            return (
              <CorrectionField key={field} label="Gender">
                <select
                  value={corrections.gender ?? ""}
                  onChange={(event) =>
                    update(
                      "gender",
                      event.target
                        .value as CreateAdmissionCasePayload["gender"],
                    )
                  }
                >
                  <option value="">Select gender</option>
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="OTHER">Other</option>
                </select>
              </CorrectionField>
            );
          if (field === "guardianFullName")
            return (
              <CorrectionField key={field} label="Guardian full name">
                <input
                  value={corrections.guardianFullName ?? ""}
                  onChange={(event) =>
                    update("guardianFullName", event.target.value)
                  }
                />
              </CorrectionField>
            );
          if (field === "guardianRelation")
            return (
              <CorrectionField key={field} label="Guardian relationship">
                <input
                  value={corrections.guardianRelation ?? ""}
                  onChange={(event) =>
                    update("guardianRelation", event.target.value)
                  }
                />
              </CorrectionField>
            );
          if (field === "guardianPhone")
            return (
              <CorrectionField key={field} label="Guardian phone">
                <input
                  inputMode="tel"
                  value={corrections.guardianPhone ?? ""}
                  onChange={(event) =>
                    update("guardianPhone", event.target.value)
                  }
                />
              </CorrectionField>
            );
          if (field === "guardianEmail")
            return (
              <CorrectionField key={field} label="Guardian email">
                <input
                  type="email"
                  value={corrections.guardianEmail ?? ""}
                  onChange={(event) =>
                    update("guardianEmail", event.target.value)
                  }
                />
              </CorrectionField>
            );
          if (field === "academicYearId")
            return (
              <CorrectionField key={field} label="Academic year">
                <select
                  value={corrections.academicYearId ?? ""}
                  onChange={(event) =>
                    update("academicYearId", event.target.value)
                  }
                >
                  <option value="">Select academic year</option>
                  {(academicYears.data ?? []).map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </CorrectionField>
            );
          if (field === "classId")
            return (
              <CorrectionField key={field} label="Class">
                <select
                  value={corrections.classId ?? ""}
                  onChange={(event) => {
                    update("classId", event.target.value);
                    update("sectionId", undefined);
                  }}
                >
                  <option value="">Select class</option>
                  {(classes.data ?? []).map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {schoolClass.name}
                    </option>
                  ))}
                </select>
              </CorrectionField>
            );
          if (field === "sectionId")
            return (
              <CorrectionField key={field} label="Section">
                <select
                  value={corrections.sectionId ?? ""}
                  disabled={!classId}
                  onChange={(event) => update("sectionId", event.target.value)}
                >
                  <option value="">Select section</option>
                  {availableSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </CorrectionField>
            );
          if (field === "previousSchool")
            return (
              <CorrectionField key={field} label="Previous school">
                <input
                  value={corrections.previousSchool ?? ""}
                  onChange={(event) =>
                    update("previousSchool", event.target.value)
                  }
                />
              </CorrectionField>
            );
          if (field === "admissionDate")
            return (
              <CorrectionField key={field} label="Admission date">
                <input
                  type="date"
                  value={corrections.admissionDate ?? ""}
                  onChange={(event) =>
                    update("admissionDate", event.target.value)
                  }
                />
              </CorrectionField>
            );
          if (field === "nationalStudentId")
            return (
              <CorrectionField key={field} label="IEMIS student ID">
                <input
                  value={corrections.nationalStudentId ?? ""}
                  onChange={(event) =>
                    update("nationalStudentId", event.target.value)
                  }
                />
              </CorrectionField>
            );
          if (field === "emergencyName")
            return (
              <CorrectionField key={field} label="Emergency contact name">
                <input
                  value={corrections.emergencyName ?? ""}
                  onChange={(event) =>
                    update("emergencyName", event.target.value)
                  }
                />
              </CorrectionField>
            );
          if (field === "emergencyPhone")
            return (
              <CorrectionField key={field} label="Emergency contact phone">
                <input
                  inputMode="tel"
                  value={corrections.emergencyPhone ?? ""}
                  onChange={(event) =>
                    update("emergencyPhone", event.target.value)
                  }
                />
              </CorrectionField>
            );
          return (
            <p
              key={field}
              className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm font-semibold text-warning-900"
            >
              {humanize(field)} needs backend-supported correction.
            </p>
          );
        })}
      </div>
      {academicYears.isError || classes.isError || sections.isError ? (
        <p className="mt-3 rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-800">
          Academic setup could not load. Retry before saving placement details.
        </p>
      ) : null}
      {mutation.error ? (
        <p className="mt-3 rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-800">
          {readError(mutation.error)}
        </p>
      ) : null}
      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          disabled={mutation.isPending || Object.keys(corrections).length === 0}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Save missing details
        </Button>
      </div>
    </SectionCard>
  );
}

function CorrectionField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm font-bold text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function AdmissionCaseDocumentUpload({
  admissionCase,
  onSaved,
}: {
  admissionCase: AdmissionCase;
  onSaved: () => Promise<void>;
}) {
  const [kind, setKind] = useState(
    admissionCase.missingRequiredDocuments[0] ?? "OTHER",
  );
  const uploadedRef = useRef<{
    fileId: string;
    kind: string;
    title: string;
  } | null>(null);
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      let nextDocument = uploadedRef.current;
      if (!nextDocument) {
        const uploaded = await api.uploadFile(
          file,
          "admissions",
          admissionCase.id,
        );
        nextDocument = { fileId: uploaded.id, kind, title: file.name };
      }
      uploadedRef.current = nextDocument;
      return admissionCasesApi.updateCase(admissionCase.id, {
        documents: [...admissionCase.documents, nextDocument],
      });
    },
    onSuccess: async () => {
      uploadedRef.current = null;
      await onSaved();
    },
  });

  return (
    <SectionCard
      title="Add required documents"
      description="Files use the protected File Registry. No storage key or permanent URL is shown."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <CorrectionField label="Document type">
          <select
            value={kind}
            onChange={(event) => {
              uploadedRef.current = null;
              setKind(event.target.value);
            }}
          >
            {admissionCase.missingRequiredDocuments.map((documentKind) => (
              <option key={documentKind} value={documentKind}>
                {humanize(documentKind)}
              </option>
            ))}
          </select>
        </CorrectionField>
        <label
          className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 text-sm font-bold text-white ${mutation.isPending ? "pointer-events-none opacity-60" : ""}`}
        >
          Upload document
          <input
            className="sr-only"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            disabled={mutation.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) mutation.mutate(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      {mutation.error ? (
        <p className="mt-3 rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-800">
          {readError(mutation.error)}
        </p>
      ) : null}
    </SectionCard>
  );
}

function Issue({
  title,
  items,
  warning = false,
}: {
  title: string;
  items: string[];
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-sm ${warning ? "border-warning-200 bg-warning-50 text-warning-900" : "border-danger-200 bg-danger-50 text-danger-900"}`}
    >
      <p className="flex items-center gap-2 font-bold">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {items.map((item) => (
          <li key={item}>{humanize(item)}</li>
        ))}
      </ul>
    </div>
  );
}

function statusLabel(value: string) {
  return humanize(value);
}
function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function readError(error: unknown) {
  return error instanceof Error
    ? error.message
    : error
      ? "The admission action could not be completed."
      : "";
}
