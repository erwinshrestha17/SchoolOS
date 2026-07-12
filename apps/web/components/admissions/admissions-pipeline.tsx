"use client";

import {
  ADMISSION_CASE_DISPLAY_STATUSES,
  formatBsDate,
  formatBsDateTime,
  LEGACY_ADMISSION_APPLICATION_STATUSES,
  type AdmissionApplication,
  type AdmissionApplicationStatus,
  type LegacyAdmissionApplicationStatus,
} from "@schoolos/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileWarning,
  Loader2,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { LoadingState } from "../ui/loading-state";
import { StatusBadge } from "../ui/status-badge";

const PAGE_SIZE = 25;

const APPLICATION_STATUSES: Array<{
  value: AdmissionApplicationStatus;
  label: string;
}> = [
  { value: "DRAFT", label: "Draft" },
  { value: "NEEDS_INFORMATION", label: "Needs Information" },
  { value: "WAITING_FOR_REVIEW", label: "Waiting Review" },
  { value: "READY_TO_ADMIT", label: "Ready to Admit" },
  { value: "APPROVED", label: "Approved" },
  { value: "ADMITTED", label: "Admitted" },
  { value: "NOT_ADMITTED", label: "Not Admitted" },
  { value: "CLOSED", label: "Closed" },
  { value: "INQUIRY", label: "Inquiry" },
  { value: "APPLICATION", label: "Application" },
  { value: "DOCUMENT_PENDING", label: "Documents Pending" },
  { value: "ENTRANCE_INTERVIEW", label: "Entrance / Interview" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "ENROLLED", label: "Enrolled" },
  { value: "REJECTED", label: "Rejected" },
];

const NEXT_STATUSES: Record<
  LegacyAdmissionApplicationStatus,
  LegacyAdmissionApplicationStatus[]
> = {
  INQUIRY: ["APPLICATION", "DOCUMENT_PENDING", "REJECTED"],
  APPLICATION: [
    "DOCUMENT_PENDING",
    "ENTRANCE_INTERVIEW",
    "ACCEPTED",
    "REJECTED",
  ],
  DOCUMENT_PENDING: [
    "APPLICATION",
    "ENTRANCE_INTERVIEW",
    "ACCEPTED",
    "REJECTED",
  ],
  ENTRANCE_INTERVIEW: ["DOCUMENT_PENDING", "ACCEPTED", "REJECTED"],
  ACCEPTED: ["REJECTED"],
  ENROLLED: [],
  REJECTED: [],
};

export function AdmissionsPipeline() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState<AdmissionApplicationStatus | "">("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionError, setActionError] = useState("");

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: api.listClasses,
  });
  const academicYearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: api.listAcademicYears,
  });
  const applicationsQuery = useQuery({
    queryKey: ["admission-applications", deferredSearch, classId, status, page],
    queryFn: () =>
      api.listAdmissionApplications({
        search: deferredSearch || undefined,
        classId: classId || undefined,
        status: status || undefined,
        page,
        limit: PAGE_SIZE,
      }),
  });

  const applications = useMemo(
    () => applicationsQuery.data?.items ?? [],
    [applicationsQuery.data?.items],
  );
  const selected =
    applications.find((application) => application.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId && !applications.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [applications, selectedId]);

  const statusMutation = useMutation({
    mutationFn: ({
      applicationId,
      nextStatus,
      reason,
    }: {
      applicationId: string;
      nextStatus: LegacyAdmissionApplicationStatus;
      reason?: string;
    }) =>
      api.updateAdmissionApplicationStatus(applicationId, {
        status: nextStatus,
        ...(reason ? { reason } : {}),
      }),
    onSuccess: (updated) => {
      setRejectionReason("");
      setActionError("");
      void queryClient.invalidateQueries({
        queryKey: ["admission-applications"],
      });
      queryClient.setQueriesData(
        { queryKey: ["admission-applications"] },
        (current: unknown) => replaceApplication(current, updated),
      );
    },
    onError: (error) => {
      setActionError(
        error instanceof Error
          ? error.message
          : "Application status could not be changed.",
      );
    },
  });

  const filteredCount = applicationsQuery.data?.total ?? 0;
  if (classesQuery.isError || academicYearsQuery.isError) {
    return (
      <ErrorState
        title="Admission filters could not load"
        message="No application state was changed."
        onRetry={() => {
          void classesQuery.refetch();
          void academicYearsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid min-h-[580px] gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-4 border-b border-slate-100 bg-slate-50/70 p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_190px_190px]">
              <label className="relative">
                <span className="sr-only">Search applications</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Student, guardian, or phone"
                  className="pl-9"
                />
              </label>
              <select
                value={classId}
                onChange={(event) => {
                  setClassId(event.target.value);
                  setPage(1);
                }}
                aria-label="Filter by requested class"
              >
                <option value="">All requested classes</option>
                {(classesQuery.data ?? []).map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </option>
                ))}
              </select>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(
                    event.target.value as AdmissionApplicationStatus | "",
                  );
                  setPage(1);
                }}
                aria-label="Filter by application stage"
              >
                <option value="">All application stages</option>
                {APPLICATION_STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {applicationsQuery.isLoading ? (
            <LoadingState
              variant="skeleton"
              label="Loading admission applications…"
            />
          ) : applicationsQuery.isError ? (
            <ErrorState
              title="Applications could not load"
              message="Your filters are preserved. Retry without changing workflow state."
              onRetry={() => void applicationsQuery.refetch()}
            />
          ) : applications.length === 0 ? (
            <EmptyState
              title="No applications found"
              description={
                search || classId || status
                  ? "No application matches the current filters."
                  : "Create the first inquiry/application to start the review pipeline."
              }
              action={
                <Link
                  href="/dashboard/admissions/new"
                  className="inline-flex min-h-11 items-center rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 text-sm font-bold text-white hover:bg-[var(--color-mod-admissions-text)]"
                >
                  New application
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Applicant</th>
                    <th className="px-4 py-3">Guardian</th>
                    <th className="px-4 py-3">Requested class</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">Duplicate review</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {applications.map((application) => {
                    const duplicateCount =
                      application.duplicateReview?.matches?.length ?? 0;
                    const active = application.id === selectedId;
                    return (
                      <tr
                        key={application.id}
                        className={
                          active
                            ? "bg-[var(--color-mod-admissions-soft)]"
                            : "hover:bg-slate-50"
                        }
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="group min-h-11 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-admissions-border)]"
                            onClick={() => {
                              setSelectedId(application.id);
                              setActionError("");
                              setRejectionReason("");
                            }}
                          >
                            <strong className="flex items-center gap-1 text-slate-900 group-hover:text-[var(--color-mod-admissions-text)]">
                              {application.fullNameEn}
                              <ChevronRight
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                            </strong>
                            <span className="text-xs text-slate-500">
                              {applicationSourceLabel(application.source)}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block font-semibold text-slate-700">
                            {application.guardianFullName ||
                              "Guardian not recorded"}
                          </span>
                          <span className="text-xs text-slate-500">
                            {application.guardianPhone || "Phone not recorded"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {classNameFor(
                            application.classId,
                            classesQuery.data ?? [],
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={application.status} />
                        </td>
                        <td className="px-4 py-3">
                          {duplicateCount ? (
                            <StatusBadge
                              status={`${duplicateCount} TO REVIEW`}
                              tone="pending"
                            />
                          ) : (
                            <StatusBadge status="NO WARNING" tone="approved" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {formatBsDateTime(application.updatedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 p-4">
            <p className="text-xs font-semibold text-slate-500">
              Page {applicationsQuery.data?.page ?? page} · {filteredCount}{" "}
              matching applications
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!applicationsQuery.data?.hasNextPage}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </section>

        <aside
          className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24"
          aria-label="Application review panel"
        >
          {!selected ? (
            <div className="py-12 text-center">
              <ClipboardCheck className="mx-auto h-10 w-10 text-[var(--color-mod-admissions-accent)]" />
              <h2 className="mt-3 text-base font-black text-slate-950">
                Application review
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Select an application to review recorded details, duplicate
                warnings, workflow actions, and enrollment state.
              </p>
            </div>
          ) : (
            <ApplicationInspector
              key={selected.id}
              application={selected}
              classes={classesQuery.data ?? []}
              academicYears={academicYearsQuery.data ?? []}
              rejectionReason={rejectionReason}
              setRejectionReason={setRejectionReason}
              actionError={actionError}
              mutationPending={statusMutation.isPending}
              onTransition={(nextStatus) => {
                if (
                  nextStatus === "REJECTED" &&
                  rejectionReason.trim().length < 5
                ) {
                  setActionError(
                    "Enter a rejection reason of at least five characters.",
                  );
                  return;
                }
                statusMutation.mutate({
                  applicationId: selected.id,
                  nextStatus,
                  reason:
                    nextStatus === "REJECTED"
                      ? rejectionReason.trim()
                      : undefined,
                });
              }}
              onEnrolled={() => {
                void queryClient.invalidateQueries({
                  queryKey: ["admission-applications"],
                });
                void queryClient.invalidateQueries({ queryKey: ["students"] });
                void queryClient.invalidateQueries({
                  queryKey: ["admissions"],
                });
              }}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function ApplicationInspector({
  application,
  classes,
  academicYears,
  rejectionReason,
  setRejectionReason,
  actionError,
  mutationPending,
  onTransition,
  onEnrolled,
}: {
  application: AdmissionApplication;
  classes: Array<{ id: string; name: string }>;
  academicYears: Array<{ id: string; name: string }>;
  rejectionReason: string;
  setRejectionReason: (value: string) => void;
  actionError: string;
  mutationPending: boolean;
  onTransition: (status: LegacyAdmissionApplicationStatus) => void;
  onEnrolled: () => void;
}) {
  const duplicateMatches = application.duplicateReview?.matches ?? [];
  const isUnifiedCaseStatus = isAdmissionCaseDisplayStatus(application.status);
  const nextStatuses = isLegacyApplicationStatus(application.status)
    ? NEXT_STATUSES[application.status]
    : [];

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-100 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-black text-slate-950">
            {application.fullNameEn}
          </h2>
          <StatusBadge status={application.status} />
        </div>
        <p className="mt-2 text-xs font-semibold text-slate-500">
          Created {formatBsDateTime(application.createdAt)}
        </p>
      </div>

      <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-xs">
        <InspectorRow
          label="Academic year"
          value={academicYearNameFor(application.academicYearId, academicYears)}
        />
        <InspectorRow
          label="Requested class"
          value={classNameFor(application.classId, classes)}
        />
        <InspectorRow
          label="Guardian"
          value={application.guardianFullName || "Guardian not recorded"}
        />
        <InspectorRow
          label="Guardian phone"
          value={application.guardianPhone || "Guardian phone not entered"}
        />
        <InspectorRow
          label="Previous school"
          value={application.previousSchool || "Previous school not recorded"}
        />
        <InspectorRow
          label="Date of birth"
          value={
            application.dateOfBirth
              ? formatBsDate(application.dateOfBirth)
              : "Date of birth not entered"
          }
        />
      </dl>

      {application.notes ? (
        <div>
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
            Review notes
          </h3>
          <p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-100 p-3 text-sm text-slate-700">
            {application.notes}
          </p>
        </div>
      ) : null}

      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
            Duplicate review
          </h3>
          <StatusBadge
            status={
              duplicateMatches.length
                ? `${duplicateMatches.length} WARNING`
                : "NO WARNING"
            }
            tone={duplicateMatches.length ? "pending" : "approved"}
          />
        </div>
        {duplicateMatches.length ? (
          <div className="mt-2 space-y-2">
            {duplicateMatches.slice(0, 3).map((match) => (
              <div
                key={match.studentId}
                className="rounded-xl border border-warning-200 bg-warning-50 p-3"
              >
                <p className="text-xs font-black text-warning-900">
                  {match.fullNameEn} · {match.studentSystemId}
                </p>
                <p className="mt-1 text-xs text-warning-800">
                  {match.matchTypes.join(", ") || "Possible duplicate"}
                </p>
              </div>
            ))}
            <Link
              href="/dashboard/admissions/duplicates"
              className="inline-flex text-xs font-bold text-[var(--color-mod-admissions-text)] hover:text-[var(--color-mod-admissions-accent)]"
            >
              Open full duplicate review
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            The backend returned no duplicate warning when this application was
            created.
          </p>
        )}
      </div>

      {isUnifiedCaseStatus ? (
        <Link
          href={`/dashboard/admissions/applications/${application.id}`}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-soft)] px-4 text-sm font-bold text-[var(--color-mod-admissions-text)] transition hover:bg-white"
        >
          Open review workspace
        </Link>
      ) : null}

      {application.status === "ACCEPTED" ? (
        <EnrollmentConversion
          application={application}
          onEnrolled={onEnrolled}
        />
      ) : null}

      {(application.status === "ENROLLED" ||
        application.status === "ADMITTED") &&
      application.convertedStudentId ? (
        <div className="rounded-xl border border-success-200 bg-success-50 p-4">
          <div className="flex items-center gap-2 text-success-800">
            <CheckCircle2 className="h-4 w-4" />
            <strong className="text-sm">Student enrolled</strong>
          </div>
          <Link
            href={`/dashboard/students/${application.convertedStudentId}`}
            className="mt-3 inline-flex text-sm font-bold text-success-800 underline"
          >
            Open student profile
          </Link>
        </div>
      ) : null}

      {nextStatuses.length ? (
        <div className="border-t border-slate-100 pt-4">
          <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
            Allowed workflow actions
          </h3>
          {nextStatuses.includes("REJECTED") ? (
            <label className="mt-3 block space-y-2 text-xs font-bold text-slate-700">
              Rejection reason
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                placeholder="Required only when rejecting"
              />
            </label>
          ) : null}
          <div className="mt-3 grid gap-2">
            {nextStatuses.map((nextStatus) => (
              <Button
                key={nextStatus}
                type="button"
                variant={nextStatus === "REJECTED" ? "outline" : "default"}
                disabled={mutationPending}
                onClick={() => onTransition(nextStatus)}
                className={
                  nextStatus === "REJECTED"
                    ? "border-danger-200 text-danger-700 hover:bg-danger-50"
                    : ""
                }
              >
                {mutationPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {transitionLabel(nextStatus)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {(application.status === "REJECTED" ||
        application.status === "NOT_ADMITTED") &&
      application.rejectedReason ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-3">
          <p className="text-xs font-black uppercase tracking-wide text-danger-700">
            Rejection reason
          </p>
          <p className="mt-1 text-sm text-danger-800">
            {application.rejectedReason}
          </p>
        </div>
      ) : null}

      {actionError ? (
        <p
          className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-xs font-bold text-danger-800"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}
    </div>
  );
}

function EnrollmentConversion({
  application,
  onEnrolled,
}: {
  application: AdmissionApplication;
  onEnrolled: () => void;
}) {
  const academicYearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: api.listAcademicYears,
  });
  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: api.listClasses,
  });
  const sectionsQuery = useQuery({
    queryKey: ["sections"],
    queryFn: api.listSections,
  });

  const [form, setForm] = useState({
    dateOfBirth: application.dateOfBirth?.slice(0, 10) ?? "",
    gender: application.gender ?? "FEMALE",
    admissionDate: new Date().toISOString().slice(0, 10),
    academicYearId: application.academicYearId ?? "",
    classId: application.classId ?? "",
    sectionId: application.sectionId ?? "",
    guardianFullName: application.guardianFullName ?? "",
    guardianRelation: application.guardianRelation ?? "guardian",
    guardianPhone: application.guardianPhone ?? "",
    mediumOfInstruction: "English",
    disabilityFlag: "",
    confirmNoDisability: false,
  });
  const [error, setError] = useState("");

  const availableSections = useMemo(
    () =>
      (sectionsQuery.data ?? []).filter((section) => {
        const candidateClassId = section.classId ?? section.class?.id;
        return !form.classId || candidateClassId === form.classId;
      }),
    [form.classId, sectionsQuery.data],
  );

  const mutation = useMutation({
    mutationFn: () =>
      api.enrollAdmissionApplication(application.id, {
        firstNameEn: application.firstNameEn,
        lastNameEn: application.lastNameEn,
        ...(application.firstNameNp
          ? { firstNameNp: application.firstNameNp }
          : {}),
        ...(application.lastNameNp
          ? { lastNameNp: application.lastNameNp }
          : {}),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        admissionDate: new Date(form.admissionDate).toISOString(),
        academicYearId: form.academicYearId,
        classId: form.classId,
        ...(form.sectionId ? { sectionId: form.sectionId } : {}),
        mediumOfInstruction: form.mediumOfInstruction,
        ...(form.disabilityFlag ? { disabilityFlag: form.disabilityFlag } : {}),
        confirmNoDisability: form.confirmNoDisability,
        guardians: [
          {
            fullName: form.guardianFullName,
            relation: form.guardianRelation,
            primaryPhone: form.guardianPhone,
            isPrimary: true,
            receivesAlerts: true,
          },
        ],
        documents: [],
      }),
    onSuccess: () => {
      setError("");
      onEnrolled();
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Application could not be enrolled.",
      );
    },
  });

  function update(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    setError("");
    if (
      !form.dateOfBirth ||
      !form.admissionDate ||
      !form.academicYearId ||
      !form.classId ||
      !form.guardianFullName.trim() ||
      !form.guardianRelation.trim() ||
      !form.guardianPhone.trim()
    ) {
      setError("Complete all required enrollment and guardian fields.");
      return;
    }
    if (!form.confirmNoDisability && !form.disabilityFlag.trim()) {
      setError(
        "Confirm no known disability or record the applicable disability information.",
      );
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="rounded-xl border border-success-200 bg-success-50/60 p-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-success-700" />
        <h3 className="text-sm font-black text-success-900">
          Accepted — ready for enrollment review
        </h3>
      </div>
      <p className="mt-1 text-xs text-success-800">
        The backend creates the student, enrollment, and guardian atomically.
      </p>
      <div className="mt-4 grid gap-3">
        <CompactField label="Date of birth">
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(event) => update("dateOfBirth", event.target.value)}
          />
        </CompactField>
        <CompactField label="Gender">
          <select
            value={form.gender}
            onChange={(event) => update("gender", event.target.value)}
          >
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
        </CompactField>
        <CompactField label="Admission date">
          <input
            type="date"
            value={form.admissionDate}
            onChange={(event) => update("admissionDate", event.target.value)}
          />
        </CompactField>
        <CompactField label="Academic year">
          <select
            value={form.academicYearId}
            onChange={(event) => update("academicYearId", event.target.value)}
          >
            <option value="">Select academic year</option>
            {(academicYearsQuery.data ?? []).map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </CompactField>
        <CompactField label="Class">
          <select
            value={form.classId}
            onChange={(event) => {
              update("classId", event.target.value);
              update("sectionId", "");
            }}
          >
            <option value="">Select class</option>
            {(classesQuery.data ?? []).map((schoolClass) => (
              <option key={schoolClass.id} value={schoolClass.id}>
                {schoolClass.name}
              </option>
            ))}
          </select>
        </CompactField>
        <CompactField label="Section">
          <select
            value={form.sectionId}
            onChange={(event) => update("sectionId", event.target.value)}
          >
            <option value="">No section</option>
            {availableSections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </CompactField>
        <CompactField label="Guardian name">
          <input
            value={form.guardianFullName}
            onChange={(event) => update("guardianFullName", event.target.value)}
          />
        </CompactField>
        <CompactField label="Guardian relationship">
          <input
            value={form.guardianRelation}
            onChange={(event) => update("guardianRelation", event.target.value)}
          />
        </CompactField>
        <CompactField label="Guardian phone">
          <input
            value={form.guardianPhone}
            onChange={(event) => update("guardianPhone", event.target.value)}
            inputMode="tel"
          />
        </CompactField>
        <CompactField label="Medium of instruction">
          <input
            value={form.mediumOfInstruction}
            onChange={(event) =>
              update("mediumOfInstruction", event.target.value)
            }
          />
        </CompactField>
        <CompactField label="Disability information">
          <input
            value={form.disabilityFlag}
            onChange={(event) => update("disabilityFlag", event.target.value)}
            disabled={form.confirmNoDisability}
            placeholder="Record only when applicable"
          />
        </CompactField>
        <label className="flex items-start gap-2 text-xs font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={form.confirmNoDisability}
            onChange={(event) => {
              update("confirmNoDisability", event.target.checked);
              if (event.target.checked) update("disabilityFlag", "");
            }}
            className="mt-0.5 h-4 w-4"
          />
          Confirm no known disability has been reported.
        </label>
      </div>
      {error ? (
        <p
          className="mt-3 rounded-lg border border-danger-200 bg-danger-50 p-2 text-xs font-bold text-danger-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        className="mt-4 w-full"
        disabled={
          mutation.isPending ||
          academicYearsQuery.isLoading ||
          classesQuery.isLoading ||
          sectionsQuery.isLoading
        }
        onClick={submit}
      >
        {mutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        Confirm and enroll student
      </Button>
    </div>
  );
}

function InspectorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-bold text-slate-800">{value}</dd>
    </div>
  );
}

function CompactField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 text-xs font-bold text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function classNameFor(
  classId: string | null,
  classes: Array<{ id: string; name: string }>,
) {
  if (!classId) return "Class not selected";
  return classes.find((item) => item.id === classId)?.name ?? "Unavailable";
}

function academicYearNameFor(
  academicYearId: string | null,
  academicYears: Array<{ id: string; name: string }>,
) {
  if (!academicYearId) return "Academic year not assigned";
  return (
    academicYears.find((item) => item.id === academicYearId)?.name ??
    "Academic year unavailable"
  );
}

function applicationSourceLabel(source: string | null) {
  if (!source) return "Source not recorded";
  const labels: Record<string, string> = {
    OFFICE_WALK_IN: "Office walk-in",
    PARENT_ONLINE: "Parent online",
    PHONE_INQUIRY: "Phone inquiry",
    TRANSFER_REQUEST: "Transfer request",
    IMPORT: "Import",
  };
  return labels[source] ?? source;
}

function transitionLabel(status: LegacyAdmissionApplicationStatus) {
  const labels: Record<LegacyAdmissionApplicationStatus, string> = {
    INQUIRY: "Move to inquiry",
    APPLICATION: "Move to application",
    DOCUMENT_PENDING: "Mark documents pending",
    ENTRANCE_INTERVIEW: "Move to entrance / interview",
    ACCEPTED: "Accept application",
    ENROLLED: "Enroll student",
    REJECTED: "Reject application",
  };
  return labels[status];
}

function isLegacyApplicationStatus(
  status: AdmissionApplicationStatus,
): status is LegacyAdmissionApplicationStatus {
  return (LEGACY_ADMISSION_APPLICATION_STATUSES as readonly string[]).includes(
    status,
  );
}

function isAdmissionCaseDisplayStatus(status: AdmissionApplicationStatus) {
  return (ADMISSION_CASE_DISPLAY_STATUSES as readonly string[]).includes(
    status,
  );
}

function replaceApplication(
  current: unknown,
  updated: AdmissionApplication,
): unknown {
  if (!current || typeof current !== "object" || !("items" in current)) {
    return current;
  }
  const result = current as {
    items?: AdmissionApplication[];
    [key: string]: unknown;
  };
  if (!Array.isArray(result.items)) return current;
  return {
    ...result,
    items: result.items.map((item) =>
      item.id === updated.id ? updated : item,
    ),
  };
}
