"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BS_MONTH_NAMES_EN,
  formatBsDateTime,
  toBsDateFromGregorian,
} from "@schoolos/core";
import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileClock,
  FileText,
  LockKeyhole,
  MessageSquare,
  Save,
  Search,
  Settings,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  AttendanceMonthlyRegister,
  AttendanceRegisterExportSummary,
  M2FollowUpQueue,
} from "@/lib/api/attendance";
import { AttendanceForm } from "@/components/forms/attendance-form";
import { AttendanceAnalytics } from "./attendance-analytics";
import { AttendanceConflictReview } from "./attendance-conflict-review";
import { AttendanceCorrectionReview } from "./attendance-correction-review";
import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { LoadingState } from "@/components/ui/loading-state";
import { LockedRecordBanner } from "@/components/ui/locked-record-banner";
import { ModuleHeader } from "@/components/ui/module-header";
import { ModuleTabs } from "@/components/ui/module-tabs";
import { ProtectedFileButton } from "@/components/ui/protected-file";
import { SectionCard } from "@/components/ui/section-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

const today = new Date().toISOString().slice(0, 10);
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

const attendanceTabs = [
  { href: "/dashboard/attendance", label: "Overview", icon: BarChart3 },
  { href: "/dashboard/attendance/mark", label: "Today", icon: CalendarCheck },
  {
    href: "/dashboard/attendance/register",
    label: "Class Register",
    icon: FileText,
  },
  {
    href: "/dashboard/attendance/corrections",
    label: "Corrections",
    icon: ClipboardCheck,
  },
  {
    href: "/dashboard/attendance/anomalies",
    label: "Anomalies",
    icon: ShieldAlert,
  },
  {
    href: "/dashboard/attendance/follow-ups",
    label: "Follow-ups",
    icon: MessageSquare,
  },
  {
    href: "/dashboard/attendance/offline-drafts",
    label: "Offline Drafts",
    icon: Save,
  },
  { href: "/dashboard/attendance/reports", label: "Reports", icon: Download },
  { href: "/dashboard/settings/attendance", label: "Settings", icon: Settings },
];

export function AttendanceOverviewWorkspace() {
  const router = useRouter();
  const analyticsQuery = useQuery({
    queryKey: ["attendance-analytics"],
    queryFn: api.listAttendanceAnalytics,
  });
  const anomaliesQuery = useQuery({
    queryKey: ["attendance-anomalies"],
    queryFn: api.listAttendanceAnomalies,
  });
  const correctionsQuery = useQuery({
    queryKey: ["attendance-corrections", "PENDING", 1],
    queryFn: () =>
      api.listAttendanceCorrections({ status: "PENDING", limit: 10 }),
  });
  const conflictsQuery = useQuery({
    queryKey: ["attendance-conflicts"],
    queryFn: api.listAttendanceConflicts,
  });
  const followUpsQuery = useQuery({
    queryKey: ["attendance-m2-follow-ups", thirtyDaysAgo, today],
    queryFn: () =>
      api.listM2FollowUps({ fromDate: thirtyDaysAgo, toDate: today }),
  });

  const analytics = analyticsQuery.data;
  const totals = analytics?.todaySummary.totals;
  const totalMarked = totals
    ? totals.present +
      totals.absent +
      totals.late +
      totals.leave +
      totals.sickLeave +
      totals.excusedLeave +
      totals.unexcusedLeave
    : 0;
  const attendanceRate =
    totalMarked > 0
      ? Math.round((totals!.present / totalMarked) * 1000) / 10
      : null;
  const pendingClasses =
    anomaliesQuery.data?.anomalies.unsubmittedWorkingDays.length ?? null;

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Smart Attendance"
        description="Track daily attendance, late arrivals, corrections, and alerts across the school."
        primaryAction={
          <Button onClick={() => router.push("/dashboard/attendance/mark")}>
            <CalendarCheck className="h-4 w-4" />
            Mark Attendance
          </Button>
        }
        moreActionItems={[
          {
            label: "Bulk actions",
            icon: <Users size={16} />,
            onClick: () => router.push("/dashboard/attendance/register"),
          },
          {
            label: "Exports and reports",
            icon: <Download size={16} />,
            onClick: () => router.push("/dashboard/attendance/reports"),
          },
          {
            label: "Settings",
            icon: <Settings size={16} />,
            onClick: () => router.push("/dashboard/settings/attendance"),
          },
        ]}
      >
        <KpiGrid className="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard
            title="Attendance today"
            value={
              analyticsQuery.isLoading
                ? "Loading"
                : attendanceRate === null
                  ? "Unavailable"
                  : `${attendanceRate}%`
            }
            icon={<Users size={20} />}
            tone="info"
            href="/dashboard/attendance/mark"
            description="Backend attendance analytics."
          />
          <KpiCard
            title="Classes pending"
            value={
              anomaliesQuery.isLoading
                ? "Loading"
                : (pendingClasses ?? "Unavailable")
            }
            icon={<AlertTriangle size={20} />}
            tone={pendingClasses ? "warning" : "neutral"}
            href="/dashboard/attendance/anomalies"
          />
          <KpiCard
            title="Absent students"
            value={
              analyticsQuery.isLoading
                ? "Loading"
                : (totals?.absent ?? "Unavailable")
            }
            icon={<XCircle size={20} />}
            tone="danger"
            href="/dashboard/attendance/follow-ups"
          />
          <KpiCard
            title="Late arrivals"
            value={
              analyticsQuery.isLoading
                ? "Loading"
                : (totals?.late ?? "Unavailable")
            }
            icon={<FileClock size={20} />}
            tone="warning"
            href="/dashboard/attendance/follow-ups"
          />
          <KpiCard
            title="Pending corrections"
            value={
              correctionsQuery.isLoading
                ? "Loading"
                : (correctionsQuery.data?.total ?? "Unavailable")
            }
            icon={<ClipboardCheck size={20} />}
            tone={
              (correctionsQuery.data?.total ?? 0) > 0 ? "warning" : "neutral"
            }
            href="/dashboard/attendance/corrections"
          />
          <KpiCard
            title="Attendance rate"
            value={
              attendanceRate === null ? "Unavailable" : `${attendanceRate}%`
            }
            icon={<BarChart3 size={20} />}
            tone="success"
            href="/dashboard/attendance/reports"
          />
        </KpiGrid>
      </ModuleHeader>

      <ModuleTabs
        items={attendanceTabs}
        accentColor="emerald"
        variant="light"
      />

      <FilterBar
        label="Attendance Filters"
        description="Backend summaries remain the source of truth for this overview."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <InputLike label="Date" value={today} />
          <InputLike label="Class" value="All classes" />
          <InputLike label="Section" value="All sections" />
          <InputLike label="Status" value="All statuses" />
        </div>
      </FilterBar>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <SectionCard
            title="Class Attendance Status"
            description="Latest submitted class sessions from the attendance analytics API."
          >
            {analyticsQuery.isLoading ? (
              <LoadingState label="Loading class attendance status..." />
            ) : analyticsQuery.isError ? (
              <ErrorState
                title="Attendance overview unavailable"
                onRetry={() => void analyticsQuery.refetch()}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class / Section</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(analytics?.latestSessions ?? [])
                    .slice(0, 8)
                    .map((session) => (
                      <TableRow key={session.sessionId}>
                        <TableCell className="font-bold text-slate-900">
                          {session.className}
                          {session.sectionName
                            ? ` / ${session.sectionName}`
                            : ""}
                        </TableCell>
                        <TableCell>
                          {formatDate(session.attendanceDate)}
                        </TableCell>
                        <TableCell>{session.totals.present}</TableCell>
                        <TableCell>{session.totals.absent}</TableCell>
                        <TableCell>{session.totals.late}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              session.submittedAt ? "success" : "warning"
                            }
                          >
                            {session.submittedAt ? "Completed" : "Pending"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <TrendPanel analytics={analytics} />
            <ActivityPanel
              analytics={analytics}
              correctionsTotal={correctionsQuery.data?.total ?? 0}
            />
          </div>

          <AttendanceAnalytics
            analytics={analytics}
            anomalies={anomaliesQuery.data}
            isLoadingAnomalies={anomaliesQuery.isLoading}
            anomaliesError={
              anomaliesQuery.isError
                ? "Attendance anomaly checks could not load."
                : ""
            }
          />
        </div>

        <div className="space-y-6">
          <ClassSummaryPanel analytics={analytics} />
          <SectionCard title="Quick Actions">
            <ActionList
              items={[
                ["Mark class attendance", "/dashboard/attendance/mark"],
                ["View register", "/dashboard/attendance/register"],
                ["Review corrections", "/dashboard/attendance/corrections"],
                ["Follow-up queue", "/dashboard/attendance/follow-ups"],
              ]}
            />
          </SectionCard>
          <AtRiskPanel
            queue={followUpsQuery.data}
            isLoading={followUpsQuery.isLoading}
          />
          {conflictsQuery.isLoading ? (
            <LoadingState label="Loading conflict review queue..." />
          ) : conflictsQuery.isError ? (
            <ErrorState
              title="Conflict review queue unavailable"
              onRetry={() => void conflictsQuery.refetch()}
            />
          ) : (
            <AttendanceConflictReview conflicts={conflictsQuery.data ?? []} />
          )}
        </div>
      </div>
    </DashboardPageShell>
  );
}

export function AttendanceMarkWorkspace() {
  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Daily Attendance Marking"
        description="Mark attendance for today by class, section, and supported daily session."
        primaryAction={<Badge variant="info">Daily scope</Badge>}
      />
      <ModuleTabs
        items={attendanceTabs}
        accentColor="emerald"
        variant="light"
      />
      <LockedRecordBanner
        label="Lock-window states are backend enforced"
        reason="Open, locked, override-required, correction-window, and expired states are returned by attendance roster/session APIs where supported. This daily form preserves entries on recoverable failures."
      />
      <AttendanceForm />
    </DashboardPageShell>
  );
}

export function AttendanceSessionUnavailableWorkspace({
  sessionId,
}: {
  sessionId: string;
}) {
  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Class Session Attendance"
        description="Period/session attendance is not enabled until a tenant-safe timetable-period attendance contract exists."
      />
      <ModuleTabs
        items={attendanceTabs}
        accentColor="emerald"
        variant="light"
      />
      <EmptyState
        title="Period session contract unavailable"
        description={`Session ${sessionId} cannot be opened because the current backend persists daily class attendance only. No QR, biometric, or period authority is inferred in the browser.`}
        icon={<ShieldAlert size={32} />}
        action={
          <Link
            className="text-sm font-bold text-[var(--color-mod-attendance-text)]"
            href="/dashboard/attendance/mark"
          >
            Open daily attendance
          </Link>
        }
      />
    </DashboardPageShell>
  );
}

export function AttendanceRegisterWorkspace({
  monthly = false,
}: {
  monthly?: boolean;
}) {
  const router = useRouter();
  const [academicYearId, setAcademicYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [currentBsDate] = useState(() => toBsDateFromGregorian(new Date()));
  const [bsMonth, setBsMonth] = useState(currentBsDate.month);
  const [bsYear, setBsYear] = useState(currentBsDate.year);
  const [exportMessage, setExportMessage] = useState("");
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
  const registerQuery = useQuery({
    queryKey: [
      "attendance-register",
      academicYearId,
      classId,
      sectionId,
      bsMonth,
      bsYear,
    ],
    queryFn: () =>
      api.getAttendanceRegister({
        academicYearId,
        classId,
        sectionId: sectionId || null,
        bsMonth,
        bsYear,
      }),
    enabled: Boolean(academicYearId && classId),
  });

  useEffect(() => {
    const current =
      academicYearsQuery.data?.find((item) => item.isCurrent) ??
      academicYearsQuery.data?.[0];
    if (current && !academicYearId) setAcademicYearId(current.id);
    const firstClass = classesQuery.data?.[0];
    if (firstClass && !classId) setClassId(firstClass.id);
  }, [academicYearId, academicYearsQuery.data, classId, classesQuery.data]);

  const register = registerQuery.data;
  const summary = summarizeRegister(register);
  const availableSections = (sectionsQuery.data ?? []).filter(
    (section) => !classId || (section.classId ?? section.class?.id) === classId,
  );

  async function exportRegister(format: "csv" | "pdf") {
    if (!academicYearId || !classId) return;
    await api.exportAttendanceRegister(
      {
        academicYearId,
        classId,
        sectionId: sectionId || null,
        bsMonth,
        bsYear,
      },
      format,
    );
    setExportMessage(
      `${format.toUpperCase()} export prepared by the attendance backend.`,
    );
  }

  return (
    <DashboardPageShell>
      <ModuleHeader
        title={
          monthly ? "Monthly Attendance Register" : "Class Attendance Register"
        }
        description={
          monthly
            ? "View monthly attendance in a compact matrix."
            : "Review attendance records by date, class, and section."
        }
        primaryAction={
          <Button
            onClick={() => void exportRegister("csv")}
            disabled={!register?.matrix.length}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
        moreActionItems={[
          {
            label: "Download PDF",
            icon: <FileText size={16} />,
            onClick: () => void exportRegister("pdf"),
          },
          {
            label: "Review corrections",
            icon: <ClipboardCheck size={16} />,
            onClick: () => router.push("/dashboard/attendance/corrections"),
          },
        ]}
      >
        <KpiGrid className="sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Completed registers"
            value={summary.completedDays}
            icon={<CheckCircle2 size={20} />}
            tone="success"
          />
          <KpiCard
            title="Pending registers"
            value={summary.pendingDays}
            icon={<FileClock size={20} />}
            tone={summary.pendingDays ? "warning" : "neutral"}
          />
          <KpiCard
            title="Locked days"
            value="Policy gated"
            icon={<LockKeyhole size={20} />}
            tone="neutral"
            description="Lock policy comes from backend session state."
          />
          <KpiCard
            title="Average attendance"
            value={
              summary.attendanceRate === null
                ? "Unavailable"
                : `${summary.attendanceRate}%`
            }
            icon={<BarChart3 size={20} />}
            tone="info"
          />
        </KpiGrid>
      </ModuleHeader>
      <ModuleTabs
        items={attendanceTabs}
        accentColor="emerald"
        variant="light"
      />
      <FilterBar
        label="Register Filters"
        description="Server-side class, section, academic year, and BS month filters."
      >
        <div className="grid gap-3 md:grid-cols-5">
          <SelectLike
            label="Academic year"
            value={academicYearId}
            onChange={setAcademicYearId}
            options={(academicYearsQuery.data ?? []).map((item) => [
              item.id,
              item.name,
            ])}
          />
          <SelectLike
            label="Class"
            value={classId}
            onChange={(value) => {
              setClassId(value);
              setSectionId("");
            }}
            options={(classesQuery.data ?? []).map((item) => [
              item.id,
              item.name,
            ])}
          />
          <SelectLike
            label="Section"
            value={sectionId}
            onChange={setSectionId}
            options={[
              ["", "All sections"],
              ...availableSections.map(
                (item) => [item.id, item.name] as [string, string],
              ),
            ]}
          />
          <SelectLike
            label="BS month"
            value={String(bsMonth)}
            onChange={(value) => setBsMonth(Number(value))}
            options={BS_MONTH_NAMES_EN.map((name, index) => [
              String(index + 1),
              name,
            ])}
          />
          <InputLike
            label="BS year"
            value={String(bsYear)}
            onChange={(value) => setBsYear(Number(value) || currentBsDate.year)}
          />
        </div>
      </FilterBar>
      {exportMessage ? <Notice tone="success">{exportMessage}</Notice> : null}
      {registerQuery.isLoading ? (
        <LoadingState label="Loading attendance register..." />
      ) : registerQuery.isError ? (
        <ErrorState
          title="Register unavailable"
          onRetry={() => void registerQuery.refetch()}
        />
      ) : register ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <MonthlyMatrix register={register} />
          <RegisterSnapshot register={register} summary={summary} />
        </div>
      ) : (
        <EmptyState
          title="Select a class"
          description="Choose an academic year and class to load the backend BS monthly register."
          icon={<FileText size={32} />}
        />
      )}
    </DashboardPageShell>
  );
}

export function AttendanceCorrectionsQueueWorkspace() {
  const [status, setStatus] = useState("PENDING");
  const correctionsQuery = useQuery({
    queryKey: ["attendance-corrections", status],
    queryFn: () =>
      api.listAttendanceCorrections({ status: status || null, limit: 25 }),
  });
  const auditQuery = useQuery({
    queryKey: ["attendance-m2-correction-audit", thirtyDaysAgo, today],
    queryFn: () =>
      api.listM2CorrectionAudit({ fromDate: thirtyDaysAgo, toDate: today }),
  });

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Attendance Corrections"
        description="Review and manage requests to correct attendance records."
        primaryAction={
          <Tooltip content="No export contract for this queue yet">
            <span className="inline-flex">
              <Button variant="outline" disabled>
                <Download className="h-4 w-4" />
                Export queue
              </Button>
            </span>
          </Tooltip>
        }
      >
        <KpiGrid className="sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            title="Pending requests"
            value={correctionsQuery.data?.total ?? "Loading"}
            icon={<ClipboardCheck size={20} />}
            tone="warning"
          />
          <KpiCard
            title="Reviewed audit rows"
            value={auditQuery.data?.total ?? "Loading"}
            icon={<FileText size={20} />}
            tone="info"
          />
          <KpiCard
            title="Escalated"
            value="Unavailable"
            icon={<AlertTriangle size={20} />}
            tone="neutral"
            description="No persisted escalation contract."
          />
          <KpiCard
            title="Due soon"
            value="Unavailable"
            icon={<FileClock size={20} />}
            tone="neutral"
          />
          <KpiCard
            title="Average resolution"
            value="Unavailable"
            icon={<BarChart3 size={20} />}
            tone="neutral"
          />
        </KpiGrid>
      </ModuleHeader>
      <ModuleTabs
        items={attendanceTabs}
        accentColor="emerald"
        variant="light"
      />
      <ModuleTabs
        items={[
          { value: "PENDING", label: "Inbox" },
          { value: "APPROVED", label: "Reviewed" },
          { value: "ESCALATED", label: "Escalated" },
          { value: "", label: "Audit log" },
        ]}
        activeValue={status}
        onValueChange={setStatus}
        accentColor="emerald"
        variant="light"
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard
          title="Correction Request Table"
          description="Server-paginated correction requests scoped by tenant and backend permissions."
        >
          {correctionsQuery.isLoading ? (
            <LoadingState label="Loading correction requests..." />
          ) : correctionsQuery.isError ? (
            <ErrorState
              title="Corrections unavailable"
              onRetry={() => void correctionsQuery.refetch()}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Original</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(correctionsQuery.data?.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-bold text-blue-700">
                      {item.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{correctionStudentName(item)}</TableCell>
                    <TableCell>{item.previousStatus ?? "No record"}</TableCell>
                    <TableCell>{item.requestedStatus}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "PENDING" ? "warning" : "success"
                        }
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link
                        className="text-sm font-bold text-blue-700"
                        href={`/dashboard/attendance/corrections/${item.id}`}
                      >
                        Open review
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
        <SectionCard title="Queue Summary">
          <SummaryRows
            rows={[
              ["Pending", String(correctionsQuery.data?.total ?? "...")],
              ["Escalated", "Unavailable"],
              ["Due soon", "Unavailable"],
              ["Policy notes", "Backend reason required"],
            ]}
          />
        </SectionCard>
      </div>
      <AttendanceCorrectionReview
        corrections={correctionsQuery.data?.items ?? []}
        isLoading={correctionsQuery.isLoading}
        total={correctionsQuery.data?.total ?? 0}
      />
    </DashboardPageShell>
  );
}

export function AttendanceCorrectionDetailWorkspace({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const correctionQuery = useQuery({
    queryKey: ["attendance-correction", id],
    queryFn: () => api.getAttendanceCorrection(id),
  });
  const approveMutation = useMutation({
    mutationFn: () =>
      api.approveAttendanceCorrection(id, { reviewReason: reason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["attendance-correction", id],
      });
      void queryClient.invalidateQueries({
        queryKey: ["attendance-corrections"],
      });
    },
  });
  const rejectMutation = useMutation({
    mutationFn: () =>
      api.rejectAttendanceCorrection(id, { reviewReason: reason }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["attendance-correction", id],
      }),
  });
  const correction = correctionQuery.data;

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Correction Review"
        description="Review a single attendance correction request with before/after comparison and audit-safe metadata."
        primaryAction={
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={reason.trim().length < 8 || approveMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              {approveMutation.isPending ? "Approving..." : "Approve"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={reason.trim().length < 8 || rejectMutation.isPending}
            >
              <XCircle className="h-4 w-4" />
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </div>
        }
      />
      {correctionQuery.isLoading ? (
        <LoadingState label="Loading correction detail..." />
      ) : correctionQuery.isError ? (
        <ErrorState
          title="Correction detail unavailable"
          onRetry={() => void correctionQuery.refetch()}
        />
      ) : correction ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <SectionCard
              title={correctionStudentName(correction)}
              description={`Request ${correction.id}`}
            >
              <div className="grid gap-4 md:grid-cols-4">
                <InfoBlock
                  label="Date"
                  value={formatDate(correction.attendanceDate)}
                />
                <InfoBlock label="Priority" value="Policy" />
                <InfoBlock
                  label="Submitted"
                  value={formatDateTime(correction.requestedAt)}
                />
                <InfoBlock label="Lock state" value={correction.lockState} />
              </div>
            </SectionCard>
            <SectionCard title="Attendance Record Comparison">
              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <ComparisonCard
                  tone="danger"
                  title="Original Record"
                  rows={correction.comparison.original}
                />
                <div className="hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 md:flex">
                  →
                </div>
                <ComparisonCard
                  tone="success"
                  title="Requested Change"
                  rows={correction.comparison.requested}
                />
              </div>
            </SectionCard>
            <SectionCard title="Evidence">
              {correction.evidence.supported ? (
                <p className="text-sm text-slate-600">
                  {correction.evidence.items.length} protected evidence files.
                </p>
              ) : (
                <Notice tone="warning">{correction.evidence.message}</Notice>
              )}
            </SectionCard>
          </div>
          <div className="space-y-6">
            <SectionCard title="Decision Panel">
              <LockedRecordBanner
                label="Lock-window policy"
                reason={correction.lockPolicy.explanation}
              />
              <label className="mt-4 block text-xs font-black uppercase tracking-wide text-slate-500">
                Decision reason
              </label>
              <textarea
                className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-attendance-border)]"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Required audit reason..."
              />
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Minimum reason length: 8 characters from tenant policy defaults.
              </p>
            </SectionCard>
            <SectionCard title="Approval History">
              <SummaryRows
                rows={[
                  ["Request submitted", formatDateTime(correction.requestedAt)],
                  [
                    "Under review",
                    correction.reviewedAt ? "Reviewed" : "Pending",
                  ],
                  ["Decision", correction.status],
                ]}
              />
            </SectionCard>
          </div>
        </div>
      ) : null}
    </DashboardPageShell>
  );
}

export function AttendanceOfflineDraftsWorkspace() {
  const draftsQuery = useQuery({
    queryKey: ["attendance-drafts"],
    queryFn: api.listAttendanceDrafts,
  });
  const conflictsQuery = useQuery({
    queryKey: ["attendance-m2-offline-conflicts", thirtyDaysAgo, today],
    queryFn: () =>
      api.listM2OfflineConflicts({
        fromDate: thirtyDaysAgo,
        toDate: today,
        limit: 50,
      }),
  });

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Offline Draft Sync"
        description="Review local draft state, server draft records, sync conflicts, rejected submissions, and sync audit."
      />
      <ModuleTabs
        items={attendanceTabs}
        accentColor="emerald"
        variant="light"
      />
      <Notice tone="info">
        Attendance drafts are stored in IndexedDB on this browser and server
        drafts are tenant/user scoped. Session clear removes browser-visible
        auth metadata; drafts are reconciled through backend sync IDs.
      </Notice>
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Server Drafts">
          {draftsQuery.isLoading ? (
            <LoadingState label="Loading drafts..." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(draftsQuery.data ?? []).map((draft) => (
                  <TableRow key={draft.id}>
                    <TableCell>
                      {draft.class?.name ?? draft.classId}
                      {draft.section?.name ? ` / ${draft.section.name}` : ""}
                    </TableCell>
                    <TableCell>{formatDate(draft.attendanceDate)}</TableCell>
                    <TableCell>
                      <Badge variant="info">Saved on this device/server</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
        <SectionCard title="Sync Queue and Conflicts">
          {conflictsQuery.isLoading ? (
            <LoadingState label="Loading sync audit..." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(conflictsQuery.data?.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.clientSubmissionId}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.syncStatus === "REJECTED"
                            ? "destructive"
                            : "warning"
                        }
                      >
                        {item.syncStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.rejectionReason ?? "Review conflict metadata"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>
    </DashboardPageShell>
  );
}

export function AttendanceAnomaliesWorkspace() {
  const anomaliesQuery = useQuery({
    queryKey: ["attendance-m2-hardened-anomalies", thirtyDaysAgo, today],
    queryFn: () =>
      api.listM2HardenedAnomalies({ fromDate: thirtyDaysAgo, toDate: today }),
  });

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Anomaly Triage"
        description="Triage backend-detected attendance anomalies without storing fake browser-only resolution state."
      />
      <ModuleTabs
        items={attendanceTabs}
        accentColor="emerald"
        variant="light"
      />
      {anomaliesQuery.isLoading ? (
        <LoadingState label="Loading anomaly checks..." />
      ) : anomaliesQuery.isError ? (
        <ErrorState
          title="Anomalies unavailable"
          onRetry={() => void anomaliesQuery.refetch()}
        />
      ) : (
        <SectionCard
          title="Anomaly Queue"
          description="Persisted triage is unavailable until backend triage records are added; actions remain read-only."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(anomaliesQuery.data?.anomalies ?? []).map((item, index) => (
                <TableRow key={`${item.code ?? "anomaly"}-${index}`}>
                  <TableCell>
                    {String(item.code ?? item.title ?? "ANOMALY")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.severity === "HIGH" ? "destructive" : "warning"
                      }
                    >
                      {String(item.severity ?? "MEDIUM")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {String(item.className ?? "Class scope")}
                  </TableCell>
                  <TableCell>
                    {formatDate(String(item.attendanceDate ?? today))}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">Open</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}
    </DashboardPageShell>
  );
}

export function AttendanceFollowUpsWorkspace() {
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const queueQuery = useQuery({
    queryKey: ["attendance-m2-follow-ups", thirtyDaysAgo, today],
    queryFn: () =>
      api.listM2FollowUps({ fromDate: thirtyDaysAgo, toDate: today }),
  });
  const previewMutation = useMutation({
    mutationFn: () =>
      api.runM2FollowUps({
        fromDate: thirtyDaysAgo,
        toDate: today,
        dryRun: true,
      }),
  });
  const dispatchMutation = useMutation({
    mutationFn: () =>
      api.runM2FollowUps({
        fromDate: thirtyDaysAgo,
        toDate: today,
        dryRun: false,
        operationalReason: reason,
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["attendance-m2-follow-ups"],
      }),
  });

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Attendance Follow-ups"
        description="Repeated absence and late follow-up queue from backend attendance policy."
      />
      <ModuleTabs
        items={attendanceTabs}
        accentColor="emerald"
        variant="light"
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <SectionCard title="Follow-up Queue">
          <FollowUpTable
            queue={queueQuery.data}
            isLoading={queueQuery.isLoading}
          />
        </SectionCard>
        <SectionCard title="Dispatch Controls">
          <Notice tone="warning">
            Provider mode, guardian consent, quiet hours, disabled providers,
            retry, and duplicate suppression are backend-owned through M10
            delivery records.
          </Notice>
          <label className="mt-4 block text-xs font-black uppercase tracking-wide text-slate-500">
            Operational reason
          </label>
          <textarea
            className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="mt-4 grid gap-2">
            <Button variant="outline" onClick={() => previewMutation.mutate()}>
              <Search className="h-4 w-4" />
              Preview follow-up
            </Button>
            <Button
              onClick={() => dispatchMutation.mutate()}
              disabled={reason.trim().length < 8}
            >
              <MessageSquare className="h-4 w-4" />
              Dispatch selected queue
            </Button>
          </div>
        </SectionCard>
      </div>
    </DashboardPageShell>
  );
}

export function AttendanceStudentProfileWorkspace({
  studentId,
}: {
  studentId: string;
}) {
  const historyQuery = useQuery({
    queryKey: ["attendance-student-history", studentId],
    queryFn: () =>
      api.getAttendanceStudentHistory(studentId, {
        startDate: thirtyDaysAgo,
        endDate: today,
      }),
  });
  const summaryQuery = useQuery({
    queryKey: ["attendance-student-summary", studentId],
    queryFn: () => api.getAttendanceStudentSummary(studentId),
  });
  const summary = summaryQuery.data;

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Student Attendance Profile"
        description="Attendance-focused student profile with backend-scoped history and parent/teacher access enforcement."
      />
      <KpiGrid className="sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Overall attendance"
          value={
            summary ? `${Math.round(summary.percentage * 10) / 10}%` : "Loading"
          }
          icon={<BarChart3 size={20} />}
          tone="success"
        />
        <KpiCard
          title="Present"
          value={summary?.totals.present ?? "Loading"}
          icon={<CheckCircle2 size={20} />}
          tone="success"
        />
        <KpiCard
          title="Absent"
          value={summary?.totals.absent ?? "Loading"}
          icon={<XCircle size={20} />}
          tone="danger"
        />
        <KpiCard
          title="Late"
          value={summary?.totals.late ?? "Loading"}
          icon={<FileClock size={20} />}
          tone="warning"
        />
      </KpiGrid>
      <SectionCard title="Recent Attendance History">
        {historyQuery.isLoading ? (
          <LoadingState label="Loading student attendance..." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Remark</TableHead>
                <TableHead>Marked by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(historyQuery.data ?? []).map((item) => (
                <TableRow key={`${item.sessionId}-${item.date}`}>
                  <TableCell>{formatDate(item.date)}</TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>{item.remark ?? "-"}</TableCell>
                  <TableCell>{item.markedBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </DashboardPageShell>
  );
}

export function AttendanceReportsWorkspace() {
  const analyticsQuery = useQuery({
    queryKey: ["attendance-analytics"],
    queryFn: api.listAttendanceAnalytics,
  });
  const exportHistoryQuery = useQuery({
    queryKey: ["attendance-register-exports", 1, 8],
    queryFn: () => api.listAttendanceRegisterExports({ page: 1, limit: 8 }),
  });
  const analytics = analyticsQuery.data;
  const retainedExports = exportHistoryQuery.data?.items ?? [];

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Attendance Reports & Analytics"
        description="Analyze attendance trends across classes, sections, grades, and time periods from server-generated analytics."
        primaryAction={
          <Link
            href="/dashboard/attendance/register"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Open register exports
          </Link>
        }
      >
        <KpiGrid className="sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            title="School attendance rate"
            value={
              analytics
                ? `${analytics.monthlyAttendance.attendancePercent}%`
                : "Loading"
            }
            icon={<Users size={20} />}
            tone="info"
          />
          <KpiCard
            title="Students below 80%"
            value={analytics?.below80Warnings?.length ?? "Loading"}
            icon={<AlertTriangle size={20} />}
            tone="warning"
          />
          <KpiCard
            title="Avg late arrivals"
            value={analytics?.todaySummary.totals.late ?? "Loading"}
            icon={<FileClock size={20} />}
            tone="warning"
          />
          <KpiCard
            title="Perfect attendance"
            value="Unavailable"
            icon={<CheckCircle2 size={20} />}
            tone="neutral"
          />
          <KpiCard
            title="Leave utilization"
            value={analytics?.todaySummary.totals.leave ?? "Loading"}
            icon={<CalendarCheck size={20} />}
            tone="info"
          />
        </KpiGrid>
      </ModuleHeader>
      <ModuleTabs
        items={attendanceTabs}
        accentColor="emerald"
        variant="light"
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <TrendPanel analytics={analytics} />
          <SectionCard
            title="Report Results"
            description="Server-side analytics result rows. Official PDF/CSV snapshots are retained by the attendance backend and protected through File Registry."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class / Section</TableHead>
                  <TableHead>Attendance rate</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Absent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(analytics?.latestSessions ?? []).map((session) => {
                  const total = session.totals.totalStudents || 1;
                  const rate =
                    Math.round((session.totals.present / total) * 1000) / 10;
                  return (
                    <TableRow key={session.sessionId}>
                      <TableCell>
                        {session.className}
                        {session.sectionName ? ` / ${session.sectionName}` : ""}
                      </TableCell>
                      <TableCell>{rate}%</TableCell>
                      <TableCell>{session.totals.present}</TableCell>
                      <TableCell>{session.totals.late}</TableCell>
                      <TableCell>{session.totals.absent}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </SectionCard>
          <SectionCard
            title="Retained Register Exports"
            description="Monthly register export jobs retained by the attendance module. Downloads stay behind authenticated protected-file access."
          >
            {exportHistoryQuery.isLoading ? (
              <LoadingState label="Loading retained attendance exports..." />
            ) : exportHistoryQuery.isError ? (
              <ErrorState
                title="Retained exports could not load"
                message="Attendance export history remains unavailable until the backend responds."
                onRetry={() => void exportHistoryQuery.refetch()}
              />
            ) : retainedExports.length === 0 ? (
              <EmptyState
                title="No retained exports yet"
                description="Generate a monthly register export from the Class Register workspace to create the first protected snapshot."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Snapshot</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retainedExports.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatBsDateTime(item.createdAt)}</TableCell>
                      <TableCell>{item.format.toUpperCase()}</TableCell>
                      <TableCell>
                        <ExportStatusBadge status={item.status} />
                      </TableCell>
                      <TableCell>
                        {item.file ? (
                          <div className="flex flex-col gap-1">
                            <ProtectedFileButton
                              fileAssetId={item.file.fileAssetId}
                              fileName={item.file.fileName}
                              action="download"
                              showStatus={false}
                            >
                              <Download className="h-4 w-4" />
                              Download protected file
                            </ProtectedFileButton>
                            <span className="text-xs font-semibold text-slate-500">
                              {item.file.fileName} · {formatFileSize(item.file.sizeBytes)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">
                            Protected file unavailable
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.completedAt
                          ? formatBsDateTime(item.completedAt)
                          : "Not completed"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </div>
        <SectionCard title="Report Summary">
          <SummaryRows
            rows={[
              [
                "Lifecycle",
                "Requested / queued / processing / completed / failed",
              ],
              ["Download", "Protected File Registry helper"],
              ["Retained exports", String(exportHistoryQuery.data?.total ?? 0)],
            ]}
          />
        </SectionCard>
      </div>
    </DashboardPageShell>
  );
}

export function AttendanceSettingsWorkspace() {
  const queryClient = useQueryClient();
  const policyQuery = useQuery({
    queryKey: ["attendance-m2-policy"],
    queryFn: api.getM2Policy,
  });
  const statesQuery = useQuery({
    queryKey: ["attendance-m2-states"],
    queryFn: api.getM2States,
  });
  const [lateThreshold, setLateThreshold] = useState("");
  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateM2Policy({
        lateFollowUpThreshold: Number(lateThreshold) || undefined,
      }),
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["attendance-m2-policy"],
      }),
  });
  const policy = policyQuery.data?.policy;

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Attendance Settings"
        description="Configure attendance rules, lock windows, calendar policy, notifications, and role summaries from backend policy APIs."
        primaryAction={
          lateThreshold ? (
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? "Saving…" : "Save Settings"}
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="School Attendance Policy">
            <SummaryRows
              rows={[
                ["Default mark state", "Present by daily attendance default"],
                [
                  "Late follow-up threshold",
                  String(policy?.lateFollowUpThreshold ?? "Loading"),
                ],
                [
                  "Half-day rule",
                  statesQuery.data?.persisted.some(
                    (state) => state.code === "HALF_DAY",
                  )
                    ? "Supported"
                    : "Unavailable",
                ],
                [
                  "Leave categories",
                  statesQuery.data?.persisted
                    .filter((state) => state.code.includes("LEAVE"))
                    .map((state) => state.label)
                    .join(", ") ?? "Loading",
                ],
              ]}
            />
            <label className="mt-4 block text-xs font-black uppercase tracking-wide text-slate-500">
              Late follow-up threshold
            </label>
            <input
              className="premium-input mt-2"
              value={lateThreshold}
              onChange={(event) => setLateThreshold(event.target.value)}
              placeholder="4"
            />
          </SectionCard>
          <SectionCard title="Lock Window Settings">
            <SummaryRows
              rows={[
                [
                  "Teacher submission deadline",
                  `${policy?.cutoffHour ?? "--"}:${String(policy?.cutoffMinute ?? 0).padStart(2, "0")}`,
                ],
                [
                  "Correction review reason",
                  `${policy?.correctionReviewMinReasonLength ?? "--"} chars minimum`,
                ],
                [
                  "Override reason",
                  `${policy?.lockOverrideMinReasonLength ?? "--"} chars minimum`,
                ],
                ["Historical locked dates", "Backend session lockAt"],
              ]}
            />
          </SectionCard>
          <SectionCard title="Notification Policy">
            <SummaryRows
              rows={[
                [
                  "Parent absence notifications",
                  policy?.notifyParentsForAbsence ? "Enabled" : "Disabled",
                ],
                [
                  "Parent late notifications",
                  policy?.notifyParentsForLate ? "Enabled" : "Disabled",
                ],
                [
                  "Channels",
                  policy?.parentNotificationChannels.join(", ") ?? "Loading",
                ],
                [
                  "Provider state",
                  "Read through M10 delivery/provider records",
                ],
              ]}
            />
          </SectionCard>
          <SectionCard title="Role Permissions Summary">
            <SummaryRows
              rows={[
                ["Teacher", "Assigned class/section/subject only"],
                ["Attendance admin", "Review/override where permissions allow"],
                ["Parent", "Linked child summaries only"],
                ["Student", "Own/session scoped only"],
              ]}
            />
          </SectionCard>
        </div>
        <SectionCard title="Policy Summary">
          <SummaryRows
            rows={[
              ["Rule highlights", statesQuery.data?.supportPolicy ?? "Loading"],
              [
                "Audit history",
                "Policy updates recorded by backend audit service",
              ],
              [
                "Device configuration",
                "Biometric/device setup is not part of M2",
              ],
            ]}
          />
        </SectionCard>
      </div>
    </DashboardPageShell>
  );
}

function MonthlyMatrix({ register }: { register: AttendanceMonthlyRegister }) {
  const days = Array.from(
    { length: register.daysCount },
    (_, index) => index + 1,
  );
  return (
    <SectionCard
      title={`${register.className}${register.sectionName ? ` / ${register.sectionName}` : ""}`}
      description={`${register.periodLabel} · Compact monthly matrix from backend register data.`}
      noPadding
    >
      <div className="overflow-auto">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b bg-white p-3 text-left text-xs font-black uppercase text-slate-500">
                Student
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  className="border-b p-2 text-center text-xs font-black text-slate-500"
                >
                  {day}
                </th>
              ))}
              <th className="border-b p-2 text-center text-xs font-black text-slate-500">
                P
              </th>
              <th className="border-b p-2 text-center text-xs font-black text-slate-500">
                A
              </th>
              <th className="border-b p-2 text-center text-xs font-black text-slate-500">
                L
              </th>
            </tr>
          </thead>
          <tbody>
            {register.matrix.map((student) => (
              <tr key={student.studentId}>
                <td className="sticky left-0 z-10 border-b bg-white p-3 font-bold text-slate-900">
                  {student.name}
                  <div className="text-xs text-slate-500">
                    Roll {student.rollNumber ?? "-"}
                  </div>
                </td>
                {student.attendance.map((entry) => (
                  <td
                    key={entry.day}
                    className={cn(
                      "border-b p-2 text-center text-xs font-black",
                      statusColor(entry.status),
                    )}
                  >
                    {statusShort(entry.status)}
                  </td>
                ))}
                <td className="border-b p-2 text-center font-bold text-success-700">
                  {student.totals.PRESENT}
                </td>
                <td className="border-b p-2 text-center font-bold text-danger-700">
                  {student.totals.ABSENT}
                </td>
                <td className="border-b p-2 text-center font-bold text-warning-700">
                  {student.totals.LATE}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function RegisterSnapshot({
  register,
  summary,
}: {
  register: AttendanceMonthlyRegister;
  summary: ReturnType<typeof summarizeRegister>;
}) {
  return (
    <div className="space-y-6">
      <SectionCard title="Register Snapshot">
        <SummaryRows
          rows={[
            [
              "Class",
              `${register.className}${register.sectionName ? ` / ${register.sectionName}` : ""}`,
            ],
            ["Period", register.periodLabel],
            ["Total students", String(register.matrix.length)],
            [
              "Attendance rate",
              summary.attendanceRate === null
                ? "Unavailable"
                : `${summary.attendanceRate}%`,
            ],
            ["Most absences", summary.mostAbsences],
            ["Perfect attendance", String(summary.perfectAttendance)],
            ["Leave days", String(summary.leaveDays)],
          ]}
        />
      </SectionCard>
      <SectionCard title="Legend">
        <SummaryRows
          rows={[
            ["P", "Present"],
            ["A", "Absent"],
            ["L", "Late"],
            ["LV", "Leave"],
            ["-", "Holiday / not marked"],
          ]}
        />
      </SectionCard>
    </div>
  );
}

function TrendPanel({
  analytics,
}: {
  analytics:
    | Awaited<ReturnType<typeof api.listAttendanceAnalytics>>
    | undefined;
}) {
  return (
    <SectionCard
      title="Weekly Attendance Trend"
      description="Latest server analytics shown as a compact trend list."
    >
      <div className="space-y-3">
        {(analytics?.classHeatmap ?? []).slice(0, 6).map((item) => (
          <div
            key={`${item.className}-${item.sectionName}-${item.attendanceDate}`}
            className="flex items-center justify-between rounded-xl bg-slate-50 p-3"
          >
            <span className="text-sm font-bold text-slate-800">
              {item.className}
              {item.sectionName ? ` / ${item.sectionName}` : ""}
            </span>
            <span className="text-sm font-black text-blue-700">
              {item.attendancePercent}%
            </span>
          </div>
        ))}
        {!analytics?.classHeatmap?.length ? (
          <p className="text-sm text-slate-500">Trend data unavailable.</p>
        ) : null}
      </div>
    </SectionCard>
  );
}

function ActivityPanel({
  analytics,
  correctionsTotal,
}: {
  analytics:
    | Awaited<ReturnType<typeof api.listAttendanceAnalytics>>
    | undefined;
  correctionsTotal: number;
}) {
  return (
    <SectionCard title="Recent Attendance Activity">
      <div className="space-y-3">
        {(analytics?.latestSessions ?? []).slice(0, 4).map((session) => (
          <div
            key={session.sessionId}
            className="rounded-xl border border-slate-100 p-3"
          >
            <p className="text-sm font-bold text-slate-900">
              Attendance marked for {session.className}
              {session.sectionName ? ` / ${session.sectionName}` : ""}
            </p>
            <p className="text-xs text-slate-500">
              {formatDateTime(session.submittedAt ?? session.attendanceDate)}
            </p>
          </div>
        ))}
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-sm font-bold text-slate-900">
            {correctionsTotal} correction requests pending
          </p>
          <p className="text-xs text-slate-500">From correction queue API</p>
        </div>
      </div>
    </SectionCard>
  );
}

function ClassSummaryPanel({
  analytics,
}: {
  analytics:
    | Awaited<ReturnType<typeof api.listAttendanceAnalytics>>
    | undefined;
}) {
  const latest = analytics?.latestSessions?.[0];
  return (
    <SectionCard title="Class Summary">
      {latest ? (
        <SummaryRows
          rows={[
            [
              "Class",
              `${latest.className}${latest.sectionName ? ` / ${latest.sectionName}` : ""}`,
            ],
            ["Total students", String(latest.totals.totalStudents)],
            ["Present", String(latest.totals.present)],
            ["Absent", String(latest.totals.absent)],
            ["Late", String(latest.totals.late)],
          ]}
        />
      ) : (
        <p className="text-sm text-slate-500">Class summary unavailable.</p>
      )}
    </SectionCard>
  );
}

function AtRiskPanel({
  queue,
  isLoading,
}: {
  queue: M2FollowUpQueue | undefined;
  isLoading: boolean;
}) {
  return (
    <SectionCard title="At-Risk Students Today">
      {isLoading ? (
        <LoadingState label="Loading follow-up queue..." />
      ) : (
        <div className="space-y-3">
          {(queue?.items ?? []).slice(0, 4).map((item) => (
            <Link
              key={item.studentId}
              href={`/dashboard/attendance/students/${item.studentId}`}
              className="block rounded-xl border border-slate-100 p-3 hover:bg-slate-50"
            >
              <p className="text-sm font-bold text-slate-900">
                {item.fullNameEn}
              </p>
              <p className="text-xs text-slate-500">
                {item.className}
                {item.sectionName ? ` / ${item.sectionName}` : ""} ·{" "}
                {item.absences} absences · {item.lates} late
              </p>
            </Link>
          ))}
          {!queue?.items?.length ? (
            <p className="text-sm text-slate-500">
              No current at-risk follow-ups.
            </p>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}

function FollowUpTable({
  queue,
  isLoading,
}: {
  queue: M2FollowUpQueue | undefined;
  isLoading: boolean;
}) {
  if (isLoading) return <LoadingState label="Loading follow-up queue..." />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead>Absences</TableHead>
          <TableHead>Late</TableHead>
          <TableHead>Consecutive</TableHead>
          <TableHead>Channels</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(queue?.items ?? []).map((item) => (
          <TableRow key={item.studentId}>
            <TableCell>
              <Link
                className="font-bold text-blue-700"
                href={`/dashboard/attendance/students/${item.studentId}`}
              >
                {item.fullNameEn}
              </Link>
              <div className="text-xs text-slate-500">
                {item.className}
                {item.sectionName ? ` / ${item.sectionName}` : ""}
              </div>
            </TableCell>
            <TableCell>{item.absences}</TableCell>
            <TableCell>{item.lates}</TableCell>
            <TableCell>{item.consecutiveAbsences}</TableCell>
            <TableCell>
              {item.recommendedChannels.join(", ") || "Provider unavailable"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function InputLike({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.65rem] font-black uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <input
        className="premium-input"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={!onChange}
      />
    </label>
  );
}

function SelectLike({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.65rem] font-black uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <select
        className="premium-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "all"} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "info" | "warning" | "success";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm font-semibold",
        tone === "success" &&
          "border-success-100 bg-success-50 text-success-700",
        tone === "warning" &&
          "border-warning-100 bg-warning-50 text-warning-800",
        tone === "info" && "border-info-100 bg-info-50 text-info-800",
      )}
    >
      {children}
    </div>
  );
}

function SummaryRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="space-y-3">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
        >
          <span className="text-sm font-semibold text-slate-500">{label}</span>
          <span className="text-right text-sm font-black text-slate-900">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function ActionList({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="space-y-2">
      {items.map(([label, href]) => (
        <Link
          key={href}
          href={href}
          className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-slate-50"
        >
          {label}
          <span aria-hidden>→</span>
        </Link>
      ))}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function ComparisonCard({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: Record<string, string | null>;
  tone: "success" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        tone === "success"
          ? "border-success-100 bg-success-50/40"
          : "border-danger-100 bg-danger-50/40",
      )}
    >
      <h3
        className={cn(
          "text-sm font-black",
          tone === "success" ? "text-success-800" : "text-danger-800",
        )}
      >
        {title}
      </h3>
      <div className="mt-4 space-y-2">
        {Object.entries(rows).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3 text-sm">
            <span className="font-semibold capitalize text-slate-500">
              {key.replace(/[A-Z]/g, " $&")}
            </span>
            <span className="text-right font-bold text-slate-900">
              {value ?? "-"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PRESENT") return <Badge variant="success">Present</Badge>;
  if (status === "ABSENT") return <Badge variant="destructive">Absent</Badge>;
  if (status === "LATE") return <Badge variant="warning">Late</Badge>;
  if (status.includes("LEAVE")) return <Badge variant="info">Leave</Badge>;
  return <Badge variant="neutral">{status}</Badge>;
}

function ExportStatusBadge({
  status,
}: {
  status: AttendanceRegisterExportSummary["status"];
}) {
  if (status === "COMPLETED") {
    return <Badge variant="success">Completed</Badge>;
  }
  if (status === "QUEUED" || status === "RUNNING") {
    return (
      <Badge variant="info">
        {status === "QUEUED" ? "Queued" : "Running"}
      </Badge>
    );
  }
  if (status === "FAILED" || status === "CANCELLED") {
    return (
      <Badge variant={status === "FAILED" ? "destructive" : "warning"}>
        {status === "FAILED" ? "Failed" : "Cancelled"}
      </Badge>
    );
  }
  return <Badge variant="neutral">{status}</Badge>;
}

function formatFileSize(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return "0 KB";
  }
  if (sizeBytes < 1024 * 1024) {
    return `${Math.ceil(sizeBytes / 1024)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function correctionStudentName(correction: {
  student?: {
    firstNameEn?: string | null;
    lastNameEn?: string | null;
    studentSystemId?: string | null;
  } | null;
}) {
  const name = [correction.student?.firstNameEn, correction.student?.lastNameEn]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || correction.student?.studentSystemId || "Student record";
}

function summarizeRegister(register: AttendanceMonthlyRegister | undefined) {
  if (!register) {
    return {
      completedDays: 0,
      pendingDays: 0,
      attendanceRate: null,
      mostAbsences: "Unavailable",
      perfectAttendance: 0,
      leaveDays: 0,
    };
  }
  const completedDays = new Set<number>();
  let present = 0;
  let marked = 0;
  let leaveDays = 0;
  let perfectAttendance = 0;
  let mostAbsences = { name: "Unavailable", count: -1 };
  for (const row of register.matrix) {
    present += row.totals.PRESENT;
    marked +=
      row.totals.PRESENT +
      row.totals.ABSENT +
      row.totals.LATE +
      row.totals.LEAVE;
    leaveDays += row.totals.LEAVE;
    if (row.totals.ABSENT === 0 && row.totals.LATE === 0)
      perfectAttendance += 1;
    if (row.totals.ABSENT > mostAbsences.count)
      mostAbsences = { name: row.name, count: row.totals.ABSENT };
    row.attendance.forEach((entry) => {
      if (entry.status !== "NOT_MARKED") completedDays.add(entry.day);
    });
  }
  return {
    completedDays: completedDays.size,
    pendingDays: Math.max(register.daysCount - completedDays.size, 0),
    attendanceRate:
      marked > 0 ? Math.round((present / marked) * 1000) / 10 : null,
    mostAbsences:
      mostAbsences.count > 0
        ? `${mostAbsences.name} (${mostAbsences.count})`
        : "Unavailable",
    perfectAttendance,
    leaveDays,
  };
}

function statusShort(status: string) {
  if (status === "PRESENT") return "P";
  if (status === "ABSENT") return "A";
  if (status === "LATE") return "L";
  if (status.includes("LEAVE")) return "LV";
  if (status === "HOLIDAY") return "-";
  return "-";
}

function statusColor(status: string) {
  if (status === "PRESENT") return "text-success-700 bg-success-50";
  if (status === "ABSENT") return "text-danger-700 bg-danger-50";
  if (status === "LATE") return "text-warning-700 bg-warning-50";
  if (status.includes("LEAVE")) return "text-info-700 bg-info-50";
  return "text-slate-300 bg-slate-50";
}
