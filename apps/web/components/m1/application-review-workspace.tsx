"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { api } from "../../lib/api";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { LoadingState } from "../ui/loading-state";
import { ProtectedFileButton } from "../ui/protected-file";
import { StatusBadge } from "../ui/status-badge";
import { formatBsDate } from "@schoolos/core";

export function ApplicationReviewWorkspace({
  studentId,
}: {
  studentId?: string;
}) {
  const admissionsQuery = useQuery({
    queryKey: ["admissions", "review-picker"],
    queryFn: () => api.listAdmissions({ page: 1, limit: 30 }),
    enabled: !studentId,
  });
  const profileQuery = useQuery({
    queryKey: ["student-profile", studentId],
    queryFn: () => api.getStudentProfile(studentId!),
    enabled: Boolean(studentId),
  });

  if (!studentId) {
    if (admissionsQuery.isLoading)
      return (
        <LoadingState variant="page" label="Loading admissions for review…" />
      );
    if (admissionsQuery.isError)
      return (
        <ErrorState
          title="Admissions could not load"
          message="No review state was changed."
          onRetry={() => void admissionsQuery.refetch()}
        />
      );
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-black text-slate-950">
          Select an enrolled admission record
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          The current backend admissions contract creates the student and
          enrollment atomically. Select a record to review its persisted details
          and documents.
        </p>
        <div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
          {(admissionsQuery.data?.items ?? []).map((admission) => (
            <Link
              key={admission.id}
              href={`/dashboard/admissions/review?studentId=${encodeURIComponent(admission.id)}`}
              className="flex items-center justify-between gap-4 p-4 transition hover:bg-slate-50"
            >
              <div>
                <strong className="text-sm text-slate-900">
                  {admission.fullNameEn}
                </strong>
                <p className="mt-1 text-xs text-slate-500">
                  {admission.studentSystemId} · {admission.className}
                  {admission.sectionName ? ` / ${admission.sectionName}` : ""}
                </p>
              </div>
              <span className="text-xs font-bold text-primary-600">
                Review record
              </span>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  if (profileQuery.isLoading)
    return (
      <LoadingState variant="page" label="Loading application review record…" />
    );
  if (profileQuery.isError || !profileQuery.data)
    return (
      <ErrorState
        title="Review record could not load"
        message="The student may not exist or you may not have access."
        onRetry={() => void profileQuery.refetch()}
      />
    );

  const profile = profileQuery.data;
  const student = profile.student;
  const primaryGuardian =
    profile.guardians.find((guardian) => guardian.isPrimary) ??
    profile.guardians[0];
  const enrollment = profile.enrollments[0];
  const verifiedDocuments = profile.documents.filter(
    (document) => document.status === "VERIFIED",
  ).length;
  const completeness = profile.documents.length
    ? Math.round((verifiedDocuments / profile.documents.length) * 100)
    : 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <main className="min-w-0 space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Avatar
                initials={(student.fullNameEn ?? "ST").slice(0, 2)}
                size="xl"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black text-slate-950">
                    {student.fullNameEn}
                  </h2>
                  <StatusBadge status={student.lifecycleStatus ?? "ACTIVE"} />
                </div>
                <p className="mt-1 text-xs font-bold text-primary-600">
                  {student.studentSystemId}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {student.gender ?? "Gender not recorded"} · DOB{" "}
                  {student.dateOfBirth
                    ? formatBsDate(student.dateOfBirth)
                    : "not recorded"}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-success-100 bg-success-50 p-4 text-center">
              <p className="text-2xl font-black text-success-700">
                {completeness}%
              </p>
              <p className="text-xs font-bold text-success-700">
                document verification
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <ReviewCard
            title="Student Details"
            icon={<UserRound className="h-4 w-4" />}
            rows={[
              ["Full name", student.fullNameEn ?? "Not recorded"],
              [
                "Class / Section",
                `${student.className ?? enrollment?.className ?? "Not assigned"} / ${student.sectionName ?? enrollment?.sectionName ?? "—"}`,
              ],
              [
                "Roll number",
                String(student.rollNumber ?? enrollment?.rollNumber ?? "—"),
              ],
              ["Mother tongue", student.motherTongue ?? "Not recorded"],
            ]}
          />
          <ReviewCard
            title="Guardian Details"
            icon={<ClipboardCheck className="h-4 w-4" />}
            rows={[
              ["Primary guardian", primaryGuardian?.fullName ?? "Not recorded"],
              ["Relationship", primaryGuardian?.relation ?? "—"],
              ["Phone", primaryGuardian?.primaryPhone ?? "—"],
              ["Email", primaryGuardian?.email ?? "—"],
            ]}
          />
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-base font-black text-slate-950">
              Uploaded Documents
            </h2>
          </div>
          {profile.documents.length === 0 ? (
            <EmptyState
              title="No uploaded documents"
              description="This admission record has no linked protected documents."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {profile.documents.map((document) => (
                <div
                  key={document.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary-500" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {document.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {document.kind.replace(/_/g, " ")} ·{" "}
                        {formatBsDate(document.uploadedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={document.status ?? "PENDING"} />
                    <ProtectedFileButton
                      fileAssetId={document.fileId}
                      fileName={document.fileName}
                      action="preview"
                      size="sm"
                      showStatus={false}
                    >
                      Preview
                    </ProtectedFileButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <aside className="h-fit space-y-4 xl:sticky xl:top-24">
        <section className="rounded-2xl border border-warning-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-warning-600" />
            <h2 className="text-base font-black text-slate-950">
              Review & Decision
            </h2>
          </div>
          <div className="mt-4 rounded-xl border border-warning-100 bg-warning-50 p-3 text-xs leading-5 text-warning-800">
            <strong className="block">Decision workflow unavailable</strong>The
            current M1 API does not expose application-stage transitions,
            reviewer scoring, interview scheduling, or approve/reject decisions.
            This route therefore cannot simulate those writes.
          </div>
          <label className="mt-4 block text-xs font-black uppercase tracking-wide text-slate-500">
            Reviewer notes
            <textarea
              rows={5}
              disabled
              placeholder="Requires an audited application-review endpoint"
              className="mt-2 text-sm font-normal normal-case tracking-normal"
            />
          </label>
          <div className="mt-4 grid gap-2">
            <Button type="button" disabled>
              <CheckCircle2 className="h-4 w-4" /> Save Decision
            </Button>
            <Button type="button" variant="outline" disabled>
              <AlertTriangle className="h-4 w-4" /> Request Changes
            </Button>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-950">
            Persisted timeline
          </h2>
          <div className="mt-4 space-y-3">
            {profile.enrollments.map((item) => (
              <div key={item.id} className="border-l-2 border-primary-200 pl-3">
                <p className="text-xs font-bold text-slate-800">
                  Enrollment {item.status}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.academicYear} · {formatBsDate(item.admissionDate)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function ReviewCard({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: ReactNode;
  rows: Array<[string, string]>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-900">
        {icon}
        <h2 className="text-sm font-black">{title}</h2>
      </div>
      <dl className="mt-4 space-y-3 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-bold text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
