"use client";

import {
  formatBsDate,
  formatBsDateTime,
  type StudentProfile,
} from "@schoolos/core";
import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  History,
  Printer,
  QrCode,
  RefreshCw,
  Search,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { api } from "../../lib/api";
import { StudentQrCard } from "../students/profile/student-qr-card";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { KpiCard, KpiGrid } from "../ui/kpi-card";
import { LoadingState } from "../ui/loading-state";
import { StatusBadge } from "../ui/status-badge";

export function QrIdWorkspace() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StudentProfile | null>(null);
  const [pdfError, setPdfError] = useState("");

  const studentsQuery = useQuery({
    queryKey: ["students", "qr-workspace", deferredSearch, page],
    queryFn: () =>
      api.listStudents({
        search: deferredSearch || undefined,
        page,
        limit: 20,
      }),
  });

  if (studentsQuery.isLoading)
    return (
      <LoadingState variant="page" label="Loading QR and ID card records…" />
    );
  if (studentsQuery.isError)
    return (
      <ErrorState
        title="QR card records could not load"
        message="No credentials were changed."
        onRetry={() => void studentsQuery.refetch()}
      />
    );

  const students = studentsQuery.data?.items ?? [];
  const currentPageActive = students.filter(
    (student) => student.qrCredential?.status === "ACTIVE",
  ).length;
  const currentPageInactive = students.filter(
    (student) =>
      student.qrCredential && student.qrCredential.status !== "ACTIVE",
  ).length;

  async function openIdCard(studentId: string, token?: string) {
    setPdfError("");
    try {
      await api.openStudentDocumentPdf(studentId, "id-card", token);
    } catch (error) {
      setPdfError(
        error instanceof Error ? error.message : "ID card could not be opened.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <KpiGrid className="sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          title="Active QR Cards"
          value="Unavailable"
          icon={<QrCode size={19} />}
          tone="neutral"
          description={`${currentPageActive} active on this page; no aggregate endpoint`}
        />
        <KpiCard
          title="Pending Prints"
          value="Unavailable"
          icon={<Printer size={19} />}
          tone="neutral"
          description="Print queue API is not available"
        />
        <KpiCard
          title="Rotated This Month"
          value="Unavailable"
          icon={<RefreshCw size={19} />}
          tone="neutral"
          description="Credential history is student-scoped"
        />
        <KpiCard
          title="Inactive Cards"
          value="Unavailable"
          icon={<CreditCard size={19} />}
          tone="neutral"
          description={`${currentPageInactive} inactive on this page`}
        />
        <KpiCard
          title="Scan Events Today"
          value="Unavailable"
          icon={<History size={19} />}
          tone="neutral"
          description="Scan audit is student-scoped"
        />
      </KpiGrid>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative flex-1">
              <span className="sr-only">Search QR card records</span>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by student name or admission number"
                className="pl-9"
              />
            </label>
            <p className="text-xs font-semibold text-slate-500">
              {studentsQuery.data?.total ?? 0} student records
            </p>
          </div>
          {students.length === 0 ? (
            <EmptyState
              title="No card records"
              description="No students match the current search."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[780px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Class / Section</th>
                    <th className="px-4 py-3">Card No.</th>
                    <th className="px-4 py-3">QR Status</th>
                    <th className="px-4 py-3">Issue Date</th>
                    <th className="px-4 py-3">Last Scanned</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((student) => {
                    const name =
                      student.fullNameEn ||
                      [student.firstNameEn, student.lastNameEn]
                        .filter(Boolean)
                        .join(" ") ||
                      "Unnamed student";
                    const active = selected?.id === student.id;
                    return (
                      <tr
                        key={student.id}
                        onClick={() => setSelected(student)}
                        className={`cursor-pointer transition ${active ? "bg-primary-50" : "hover:bg-slate-50"}`}
                      >
                        <td className="px-4 py-3">
                          <strong className="block text-slate-900">
                            {name}
                          </strong>
                          <span className="text-xs text-slate-500">
                            {student.studentSystemId}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-600">
                          {student.className ??
                            student.class?.name ??
                            "Not assigned"}{" "}
                          / {student.sectionName ?? student.section ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                          {student.qrCredential
                            ? `QR-${student.studentSystemId}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={
                              student.qrCredential?.status ?? "NOT_GENERATED"
                            }
                            tone={
                              student.qrCredential?.status === "ACTIVE"
                                ? "active"
                                : "inactive"
                            }
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {student.qrCredential?.createdAt
                            ? formatBsDate(student.qrCredential.createdAt)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {student.qrCredential?.lastScannedAt
                            ? formatBsDateTime(
                                student.qrCredential.lastScannedAt,
                              )
                            : "Never"}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelected(student);
                            }}
                          >
                            Manage
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 p-4">
            <p className="text-xs font-semibold text-slate-500">Page {page}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!studentsQuery.data?.hasNextPage}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </section>

        <aside
          className="h-fit xl:sticky xl:top-24"
          aria-label="QR card inspector"
        >
          {selected ? (
            <StudentQrCard
              studentId={selected.id}
              studentSystemId={selected.studentSystemId}
              qrCredential={selected.qrCredential ?? null}
              onOpenIdCard={(token) => void openIdCard(selected.id, token)}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <QrCode className="mx-auto h-9 w-9 text-primary-500" />
              <h2 className="mt-3 text-base font-black text-slate-950">
                Card Preview
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Select a student to view credential status, secure generation
                controls, rotation history, and scan audit.
              </p>
            </div>
          )}
          {pdfError ? (
            <p
              className="mt-3 rounded-xl border border-danger-100 bg-danger-50 p-3 text-xs font-bold text-danger-700"
              role="alert"
            >
              {pdfError}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
