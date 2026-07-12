"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Calendar,
  Users,
  Clock,
  Bell,
  FileCheck2,
  AlertCircle,
  ChevronLeft,
  Trash2,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  FileText,
  Download,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { api, type HomeworkRegisterRow } from "@/lib/api";
import { useSession } from "@/components/session-provider";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { ActionMenu } from "@/components/ui/action-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Toast, ToastTone } from "@/components/ui/toast";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { HomeworkReviewModal } from "@/components/homework/homework-review-modal";
import { formatBsDate, formatBsDateTime, type HomeworkSubmissionSummary } from "@schoolos/core";
import { FormField, TextArea } from "@/components/ui/form-field";

type HomeworkNotice = {
  title: string;
  description?: string;
  tone: ToastTone;
};

// Register-mode statuses a teacher can set from the completion register.
// Mirrors the subset of HomeworkSubmissionStatus relevant to physical/offline
// checking (as opposed to the digital SUBMITTED/LATE/REVIEWED/NEEDS_CORRECTION
// flow handled by HomeworkReviewModal for ONLINE_ATTACHMENT homework).
const REGISTER_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "COMPLETED", label: "Completed" },
  { value: "INCOMPLETE", label: "Incomplete" },
  { value: "ABSENT", label: "Absent" },
  { value: "NOT_SUBMITTED", label: "Not submitted" },
  { value: "PARTIALLY_COMPLETED", label: "Partially completed" },
  { value: "EXCUSED", label: "Excused" },
];

// Single neutral label used for every flagged follow-up row. Do not swap in
// language like "lazy"/"weak"/"poor performer"/"high risk" here.
const FOLLOW_UP_LABEL = "Needs follow-up";

export function HomeworkDetailPage({ homeworkId }: { homeworkId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { session } = useSession();

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [showMarkAllDialog, setShowMarkAllDialog] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [notice, setNotice] = useState<HomeworkNotice | null>(null);
  // Local draft of in-progress note edits, committed to the backend on blur
  // via statusMutation (UpdateHomeworkSubmissionStatusDto now accepts an
  // optional teacherRemarks alongside status).
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const homeworkQuery = useQuery({
    queryKey: ["homework-detail", homeworkId],
    queryFn: () => api.getHomework(homeworkId),
    enabled: Boolean(homeworkId),
  });

  const homeworkData = homeworkQuery.data as any;
  const isRegisterMode = Boolean(
    homeworkData?.submissionMethod &&
      homeworkData.submissionMethod !== "ONLINE_ATTACHMENT",
  );
  const isStudentOrParentSession = Boolean(
    session?.user.roles.includes("student") ||
      session?.user.roles.includes("parent"),
  );
  // The register is a teacher/admin tool; student and parent sessions never
  // see it even if they somehow land on this route for physical homework.
  const showRegister = isRegisterMode && !isStudentOrParentSession;

  const activeTab =
    searchParams.get("tab") || (showRegister ? "register" : "submissions");

  const submissionsQuery = useQuery({
    queryKey: ["homework-submissions", homeworkId],
    queryFn: () => api.listHomeworkAssignmentSubmissions(homeworkId),
    enabled: Boolean(homeworkId),
  });

  const registerQuery = useQuery({
    queryKey: ["homework-register", homeworkId],
    queryFn: () => api.getHomeworkRegister(homeworkId),
    enabled: Boolean(homeworkId) && showRegister,
  });

  const bulkCompleteMutation = useMutation({
    mutationFn: () => api.bulkCompleteHomeworkRegister(homeworkId, {}),
    onSuccess: (data) => {
      queryClient.setQueryData(["homework-register", homeworkId], data);
      setShowMarkAllDialog(false);
      setNotice({
        title: "Marked all students completed",
        description:
          "Adjust individual rows below for any exceptions (absent, incomplete, etc.).",
        tone: "success",
      });
    },
    onError: (error: any) => {
      setShowMarkAllDialog(false);
      setNotice({
        title: "Could not mark all completed",
        description: error.message || "Failed to update the completion register",
        tone: "danger",
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      submissionId,
      status,
      teacherRemarks,
    }: {
      submissionId: string;
      status: string;
      teacherRemarks?: string;
    }) =>
      api.updateHomeworkSubmissionStatus(submissionId, {
        status,
        teacherRemarks,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["homework-register", homeworkId],
      });
    },
    onError: (error: any) => {
      setNotice({
        title: "Could not update status",
        description:
          error.message || "Failed to update this student's status",
        tone: "danger",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelHomework(homeworkId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["homework-detail", homeworkId],
      });
      setShowCancelDialog(false);
      setNotice({ title: "Homework cancelled", tone: "success" });
    },
    onError: (error: any) => {
      setNotice({
        title: "Could not cancel homework",
        description: error.message || "Failed to cancel homework",
        tone: "danger",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteHomework(homeworkId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["homework-list"] });
      router.push("/dashboard/homework");
    },
    onError: (error: any) => {
      setShowDeleteDialog(false);
      setNotice({
        title: "Could not delete draft",
        description: error.message || "Failed to delete this draft",
        tone: "danger",
      });
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: () => api.sendHomeworkReminders(homeworkId),
    onSuccess: () => {
      setShowReminderDialog(false);
      setNotice({
        title: "Reminders sent",
        description: "Student reminder notifications were queued.",
        tone: "success",
      });
    },
    onError: (error: any) => {
      setNotice({
        title: "Could not send reminders",
        description: error.message || "Failed to send reminders",
        tone: "danger",
      });
    },
  });

  if (homeworkQuery.isLoading)
    return <LoadingState variant="page" label="Loading homework details..." />;
  if (homeworkQuery.isError || !homeworkQuery.data) {
    return (
      <EmptyState
        title="Homework Not Found"
        description="The homework assignment you are looking for does not exist or has been removed."
        action={
          <Link href="/dashboard/homework">
            <Button variant="outline" className="rounded-xl">
              Back to Homework
            </Button>
          </Link>
        }
      />
    );
  }

  const homework = homeworkQuery.data as any;

  if (isStudentOrParentSession) {
    return <StudentHomeworkSubmissionView homeworkId={homeworkId} homework={homework} />;
  }

  function noteValueFor(row: HomeworkRegisterRow): string {
    return noteDrafts[row.submissionId] ?? row.teacherRemarks ?? "";
  }

  function commitNoteDraft(row: HomeworkRegisterRow, value: string) {
    setNoteDrafts((prev) => ({ ...prev, [row.submissionId]: value }));
    if (value === (row.teacherRemarks ?? "")) return;
    statusMutation.mutate({
      submissionId: row.submissionId,
      status: row.status,
      teacherRemarks: value,
    });
  }

  const registerColumns = [
    {
      header: "Roll",
      accessorKey: "rollNumber",
      cell: (row: HomeworkRegisterRow) => (
        <span className="text-sm font-medium text-slate-700">
          {row.rollNumber ?? "—"}
        </span>
      ),
    },
    {
      header: "Student",
      accessorKey: "studentName",
      cell: (row: HomeworkRegisterRow) => (
        <span className="font-bold text-slate-900">{row.studentName}</span>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: HomeworkRegisterRow) => {
        const isRowUpdating =
          statusMutation.isPending &&
          statusMutation.variables?.submissionId === row.submissionId;
        const knownOption = REGISTER_STATUS_OPTIONS.some(
          (option) => option.value === row.status,
        );
        return (
          <Select
            aria-label={`Status for ${row.studentName}`}
            value={row.status}
            disabled={isRowUpdating}
            className="min-w-[10rem]"
            onChange={(event) =>
              statusMutation.mutate({
                submissionId: row.submissionId,
                status: event.target.value,
                teacherRemarks: noteValueFor(row),
              })
            }
          >
            {!knownOption ? (
              <option value={row.status}>{row.status}</option>
            ) : null}
            {REGISTER_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        );
      },
    },
    {
      header: "Teacher note",
      accessorKey: "teacherRemarks",
      cell: (row: HomeworkRegisterRow) => (
        <Input
          aria-label={`Teacher note for ${row.studentName}`}
          defaultValue={noteValueFor(row)}
          placeholder="Add a note"
          className="min-w-[12rem]"
          onBlur={(event) => commitNoteDraft(row, event.target.value)}
        />
      ),
    },
    {
      header: "Follow-up",
      cell: (row: HomeworkRegisterRow) =>
        row.followUp?.flagged ? (
          <Tooltip
            content={`Incomplete/absent/not-submitted in ${row.followUp.incompleteCount} of the last ${row.followUp.consideredCount} assignments`}
          >
            <Badge variant="warning">{FOLLOW_UP_LABEL}</Badge>
          </Tooltip>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ];

  const submissionColumns = [
    {
      header: "Student",
      accessorKey: "student.fullNameEn",
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">
            {row.student?.fullNameEn}
          </span>
          <span className="text-xs text-slate-500">
            {row.student?.studentSystemId}
          </span>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: any) => <StatusBadge status={row.status} />,
    },
    {
      header: "Submitted At",
      accessorKey: "submittedAt",
      cell: (row: any) =>
        row.submittedAt ? formatBsDateTime(row.submittedAt) : "—",
    },
    {
      header: "Score",
      accessorKey: "score",
      cell: (row: any) => (
        <span className="font-medium">
          {row.score !== null ? `${row.score} / ${homework.maxScore}` : "—"}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (row: any) => (
        <ActionMenu
          items={[
            {
              label: "Review",
              icon: <FileCheck2 className="h-4 w-4" />,
              onClick: () => {
                setSelectedSubmission(row);
                setIsReviewModalOpen(true);
              },
            },
            {
              label: "Message Student",
              icon: <MessageSquare className="h-4 w-4" />,
              onClick: () =>
                router.push(
                  `/dashboard/messages/new?studentId=${row.studentId}`,
                ),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {notice ? (
        <Toast
          title={notice.title}
          description={notice.description}
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Tooltip content="Back to homework">
            <Link href="/dashboard/homework">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Back to homework"
                className="rounded-full h-10 w-10"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            </Link>
          </Tooltip>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 italic uppercase">
              Homework Detail
            </h1>
            <p className="text-slate-500 font-medium">
              Manage submissions and reminders for this assignment.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {homework.status === "DRAFT" ? (
            <Button
              variant="outline"
              className="rounded-2xl font-bold"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-5 w-5 text-red-500" />
              Delete Draft
            </Button>
          ) : (
            <Button
              variant="outline"
              className="rounded-2xl font-bold"
              onClick={() => setShowCancelDialog(true)}
              disabled={homework.status === "CANCELLED"}
            >
              <Trash2 className="mr-2 h-5 w-5 text-red-500" />
              Cancel Assignment
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SectionCard
            title={homework.title}
            headerAction={<StatusBadge status={homework.status || "DRAFT"} />}
          >
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Due Date
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {homework.dueAt
                      ? formatBsDateTime(homework.dueAt)
                      : "Due date not set"}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Subject
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {homework.subject?.name?.trim() || "Subject not set"}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Class
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {homework.class?.name?.trim() || "Class not set"}
                    {homework.section?.name?.trim()
                      ? ` - ${homework.section.name.trim()}`
                      : " - All sections"}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">
                  Instructions
                </h3>
                <div className="p-6 rounded-2xl bg-slate-50 text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {homework.instructions?.trim() || "Instructions not set"}
                </div>
              </div>

              {homework.attachments && homework.attachments.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[var(--color-mod-homework-text)]" />
                    Attachments
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {homework.attachments.map((attachment: any) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-white shadow-sm hover:border-[var(--color-mod-homework-border)] transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-[var(--color-mod-homework-bg)] flex items-center justify-center text-[var(--color-mod-homework-text)]">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900 truncate max-w-[150px]">
                              {attachment.fileAsset?.originalFilename?.trim() ||
                                "File name not set"}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {Math.round(
                                (attachment.fileAsset?.sizeBytes || 0) / 1024,
                              )}{" "}
                              KB
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 rounded-xl text-slate-500 hover:text-[var(--color-mod-homework-text)] hover:bg-[var(--color-mod-homework-bg)]"
                          onClick={async () => {
                            try {
                              await api.openHomeworkAttachmentPreview(
                                attachment.id,
                              );
                            } catch (err) {
                              setNotice({
                                title: "Could not open attachment",
                                description:
                                  "The file view link could not be created.",
                                tone: "danger",
                              });
                            }
                          }}
                        >
                          <Download className="h-4 w-4" />
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          <Tabs
            defaultValue={activeTab}
            onValueChange={(val) => router.push(`?tab=${val}`)}
          >
            <TabsList className="bg-slate-100 p-1.5 rounded-2xl inline-flex h-auto">
              {showRegister ? (
                <TabsTrigger
                  value="register"
                  className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 font-black uppercase tracking-widest text-[10px]"
                >
                  Register
                </TabsTrigger>
              ) : (
                <TabsTrigger
                  value="submissions"
                  className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 font-black uppercase tracking-widest text-[10px]"
                >
                  Submissions
                </TabsTrigger>
              )}
              <TabsTrigger
                value="reminders"
                className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 font-black uppercase tracking-widest text-[10px]"
              >
                Reminders
              </TabsTrigger>
            </TabsList>

            {showRegister ? (
              <TabsContent value="register" className="mt-6">
                {registerQuery.isLoading ? (
                  <LoadingState label="Loading completion register..." />
                ) : registerQuery.isError || !registerQuery.data ? (
                  <EmptyState
                    title="Could not load the completion register"
                    description="Try reloading this page."
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Mark everyone completed first, then adjust exceptions
                        (absent, incomplete, etc.) row by row.
                      </p>
                      <Button
                        className="rounded-xl bg-[var(--color-mod-homework-accent)] font-bold text-white shadow-sm hover:bg-[var(--color-mod-homework-text)] shrink-0"
                        onClick={() => setShowMarkAllDialog(true)}
                        disabled={bulkCompleteMutation.isPending}
                      >
                        <ClipboardCheck className="mr-2 h-5 w-5" />
                        {bulkCompleteMutation.isPending
                          ? "Marking..."
                          : "Mark All Completed"}
                      </Button>
                    </div>

                    {registerQuery.data.roster.length === 0 ? (
                      <EmptyState
                        title="No students on this register"
                        description="There are no roster entries for this assignment yet."
                      />
                    ) : (
                      <DataTable
                        columns={registerColumns}
                        data={registerQuery.data.roster}
                        getRowKey={(row) => row.submissionId}
                      />
                    )}
                  </div>
                )}
              </TabsContent>
            ) : (
              <TabsContent value="submissions" className="mt-6">
                {submissionsQuery.isLoading ? (
                  <LoadingState label="Loading submissions..." />
                ) : submissionsQuery.data?.length === 0 ? (
                  <EmptyState
                    title="No submissions yet"
                    description="Students haven't submitted any work for this assignment yet."
                  />
                ) : (
                  <DataTable
                    columns={submissionColumns}
                    data={submissionsQuery.data ?? []}
                  />
                )}
              </TabsContent>
            )}

            <TabsContent value="reminders" className="mt-6">
              <SectionCard
                title="Homework Reminders"
                description="Send nudge notifications to students who haven't submitted yet."
              >
                <div className="space-y-6">
                  <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-amber-900">
                        Important Note
                      </p>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Reminder sending is protected against duplicate daily
                        sends. You can only send one reminder per assignment per
                        day.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col items-center justify-center text-center">
                      <Clock className="h-8 w-8 text-[var(--color-mod-homework-text)] mb-2 opacity-30" />
                      <span className="text-2xl font-black text-slate-900">
                        {submissionsQuery.data?.filter(
                          (s) => s.status === "PENDING",
                        ).length ?? 0}
                      </span>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Awaiting
                      </span>
                    </div>
                    <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col items-center justify-center text-center">
                      <AlertCircle className="h-8 w-8 text-red-500 mb-2 opacity-20" />
                      <span className="text-2xl font-black text-slate-900">
                        {homework.dueAt && new Date(homework.dueAt) < new Date()
                          ? (submissionsQuery.data?.filter(
                              (s) => s.status === "PENDING",
                            ).length ?? 0)
                          : 0}
                      </span>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Overdue
                      </span>
                    </div>
                    <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-sm flex flex-col items-center justify-center text-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-20" />
                      <span className="text-2xl font-black text-slate-900">
                        {submissionsQuery.data?.filter(
                          (s) =>
                            s.status === "SUBMITTED" || s.status === "REVIEWED",
                        ).length ?? 0}
                      </span>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Submitted
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="lg"
                      className="rounded-xl bg-[var(--color-mod-homework-accent)] font-bold px-8 text-white shadow-sm hover:bg-[var(--color-mod-homework-text)]"
                      onClick={() => setShowReminderDialog(true)}
                      disabled={
                        sendReminderMutation.isPending ||
                        homework.status === "CLOSED"
                      }
                    >
                      <Bell className="mr-2 h-5 w-5" />
                      {sendReminderMutation.isPending
                        ? "Sending..."
                        : "Send Reminders Now"}
                    </Button>
                  </div>
                </div>
              </SectionCard>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <SectionCard title="Assignment Summary">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm font-medium text-slate-500">
                  Total Students
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {submissionsQuery.data?.length ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm font-medium text-slate-500">
                  Submission Rate
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {submissionsQuery.data?.length
                    ? Math.round(
                        (submissionsQuery.data.filter(
                          (s) => s.status !== "PENDING",
                        ).length /
                          submissionsQuery.data.length) *
                          100,
                      )
                    : 0}
                  %
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm font-medium text-slate-500">
                  Max Score
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {homework.maxScore}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-slate-500">
                  Assigned Date
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {homework.assignedDate
                    ? formatBsDate(homework.assignedDate)
                    : "—"}
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Activity & Audit">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Homework Published
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {homework.assignedDate
                      ? formatBsDateTime(homework.assignedDate)
                      : "—"}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic">
                Audit/activity log will be expanded in future updates.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="Cancel Homework"
        description="Are you sure you want to cancel this assignment? This action cannot be undone and students will no longer be able to submit."
        confirmLabel="Cancel Assignment"
        variant="destructive"
      />

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Draft"
        description="This draft was never published, so it will be permanently deleted with no record left behind. This cannot be undone."
        confirmLabel="Delete Draft"
        variant="destructive"
        isConfirming={deleteMutation.isPending}
      />

      <ConfirmDialog
        isOpen={showReminderDialog}
        onClose={() => setShowReminderDialog(false)}
        onConfirm={() => sendReminderMutation.mutate()}
        title="Send Reminders Now"
        description="This queues a reminder notification to every student who has not yet submitted this assignment."
        confirmLabel="Send Reminders"
        isConfirming={sendReminderMutation.isPending}
      />

      <ConfirmDialog
        isOpen={showMarkAllDialog}
        onClose={() => setShowMarkAllDialog(false)}
        onConfirm={() => bulkCompleteMutation.mutate()}
        title="Mark All Completed"
        description="This sets every student on this register to Completed. You can still adjust individual students afterward for any exceptions."
        confirmLabel="Mark All Completed"
        isConfirming={bulkCompleteMutation.isPending}
      />

      <HomeworkReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedSubmission(null);
        }}
        submission={selectedSubmission}
        homework={homework}
      />
    </div>
  );
}

// Read-only overview for student/parent sessions, plus the digital submission
// form for ONLINE_ATTACHMENT homework. Staff-only actions (cancel/delete,
// reminders, the completion register) never render for these roles.
function StudentHomeworkSubmissionView({
  homeworkId,
  homework,
}: {
  homeworkId: string;
  homework: any;
}) {
  const queryClient = useQueryClient();
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<
    string | null
  >(null);

  const submissionsQuery = useQuery({
    queryKey: ["homework-submissions", "mine"],
    queryFn: () => api.listHomeworkSubmissions(),
  });

  const mySubmission = submissionsQuery.data?.find(
    (s: HomeworkSubmissionSummary) => s.homeworkId === homeworkId,
  );

  async function openAttachment(attachmentId: string) {
    setAttachmentError(null);
    setOpeningAttachmentId(attachmentId);
    try {
      await api.openHomeworkAttachmentDownload(attachmentId);
    } catch (err: unknown) {
      setAttachmentError(
        err instanceof Error
          ? err.message
          : "Failed to open the homework attachment.",
      );
    } finally {
      setOpeningAttachmentId(null);
    }
  }

  const pendingStatuses = new Set([
    "NOT_SUBMITTED",
    "LATE",
    "NEEDS_CORRECTION",
  ]);
  const canSubmitOnline =
    homework?.submissionMethod === "ONLINE_ATTACHMENT" &&
    mySubmission &&
    pendingStatuses.has(mySubmission.status);

  return (
    <div className="space-y-8 p-6">
      <Link href="/dashboard/homework">
        <Button variant="outline" className="rounded-xl">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Homework
        </Button>
      </Link>

      <SectionCard title={homework?.title?.trim() || "Homework"}>
        <div className="space-y-4">
          <p className="whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
            {homework?.instructions?.trim() || "Instructions not set"}
          </p>
          {homework?.parentInstructions ? (
            <div className="rounded-2xl border border-[var(--color-mod-homework-border)] bg-[var(--color-mod-homework-bg)] p-4 text-sm text-[var(--color-mod-homework-text)]">
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest">
                Instruction for parents
              </p>
              {homework.parentInstructions}
            </div>
          ) : null}
          <div className="flex items-center gap-6 text-sm text-slate-700">
            <span>
              Due {formatBsDate(homework?.dueAt ?? homework?.dueDate)}
            </span>
            {mySubmission ? <StatusBadge status={mySubmission.status} /> : null}
          </div>
        </div>
      </SectionCard>

      {submissionsQuery.isLoading ? (
        <LoadingState label="Loading your submission..." />
      ) : canSubmitOnline ? (
        <SectionCard
          title="Your Work"
          description="Provide your answer and attach necessary files below."
        >
          <StudentSubmissionForm
            submissionId={mySubmission!.id}
            onSuccess={() =>
              queryClient.invalidateQueries({
                queryKey: ["homework-submissions", "mine"],
              })
            }
          />
        </SectionCard>
      ) : mySubmission ? (
        <SectionCard title="My Submission">
          <div className="space-y-4">
            <p className="whitespace-pre-wrap rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-700">
              {mySubmission.submissionContent || "No text content provided."}
            </p>
            {mySubmission.attachments && mySubmission.attachments.length > 0 ? (
              <div className="space-y-3">
                {attachmentError ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 p-3 text-[11px] font-bold text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    {attachmentError}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {mySubmission.attachments.map((a: any) => (
                    <button
                      key={a.id}
                      type="button"
                      data-testid="student-homework-attachment-download"
                      disabled={openingAttachmentId === a.id}
                      onClick={() => void openAttachment(a.id)}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {openingAttachmentId === a.id
                        ? "Opening..."
                        : a.fileAsset?.originalFilename?.trim() || "File"}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {mySubmission.feedback ? (
              <div className="rounded-2xl border border-[var(--color-mod-homework-border)] bg-[var(--color-mod-homework-bg)] p-4 text-sm text-[var(--color-mod-homework-text)]">
                <p className="mb-1 text-[10px] font-black uppercase tracking-widest">
                  Teacher feedback
                </p>
                &ldquo;{mySubmission.feedback}&rdquo;
                {mySubmission.score !== null ? (
                  <p className="mt-2 text-xs font-black uppercase tracking-widest">
                    Score: {mySubmission.score} / {homework?.maxScore}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

function StudentSubmissionForm({
  submissionId,
  onSuccess,
}: {
  submissionId: string;
  onSuccess: () => void;
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<
    { id: string; fileName: string }[]
  >([]);

  const mutation = useMutation({
    mutationFn: (data: {
      submissionId: string;
      content?: string;
      attachmentIds?: string[];
    }) => api.submitHomework(data),
    onSuccess,
    onError: (err: Error) =>
      setError(err.message || "Failed to submit homework"),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await api.uploadFile(file, "homework-submission");
      setAttachments((prev) => [
        ...prev,
        { id: result.id, fileName: result.fileName },
      ]);
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!content.trim()) {
      setError("Please enter your submission text");
      return;
    }
    mutation.mutate({
      submissionId,
      content: content.trim(),
      attachmentIds: attachments.map((a) => a.id),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormField label="Your Submission Text">
        <TextArea
          rows={6}
          placeholder="Type your response here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={mutation.isPending || isUploading}
        />
      </FormField>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">
            Attachments
          </p>
          <label className="cursor-pointer rounded-full border border-[var(--color-mod-homework-border)] bg-[var(--color-mod-homework-bg)] px-4 py-2 text-[9px] font-black uppercase tracking-widest text-[var(--color-mod-homework-text)]">
            Upload File
            <input
              type="file"
              className="hidden"
              onChange={handleFileChange}
              disabled={mutation.isPending || isUploading}
            />
          </label>
        </div>
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((a) => (
              <span
                key={a.id}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                {a.fileName}
                <Tooltip content={`Remove ${a.fileName}`}>
                  <button
                    type="button"
                    aria-label={`Remove ${a.fileName}`}
                    onClick={() => removeAttachment(a.id)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    ×
                  </button>
                </Tooltip>
              </span>
            ))}
          </div>
        ) : null}
        {isUploading ? (
          <p className="text-xs text-slate-500">Uploading...</p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={mutation.isPending || isUploading}
        className="rounded-xl bg-[var(--color-mod-homework-accent)] font-bold text-white"
      >
        {mutation.isPending ? "Submitting..." : "Submit Assignment"}
      </Button>
    </form>
  );
}
