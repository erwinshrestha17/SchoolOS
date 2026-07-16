"use client";

import { formatBsDateTime, type PermissionKey } from "@schoolos/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Paperclip,
  Pencil,
  Send,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { ProtectedFileButton } from "@/components/ui/protected-file";
import {
  communicationsApi,
  type NoticeDetail,
} from "@/lib/api/communications";

type ReviewAction = "publish" | "schedule" | "approval";

export function NoticeReviewWorkspace({ noticeId }: { noticeId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const permissions = new Set<PermissionKey>(session?.user.permissions ?? []);
  const canPreview = permissions.has("notices:create");
  const canPublish = permissions.has("notices:publish");
  const canSchedule = permissions.has("notices:schedule");
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null);
  const [scheduledFor, setScheduledFor] = useState("");
  const [approvalReason, setApprovalReason] = useState("");

  const detailQuery = useQuery({
    queryKey: ["notice-detail", noticeId],
    queryFn: () => communicationsApi.getNoticeDetail(noticeId),
    enabled: Boolean(noticeId),
  });

  useEffect(() => {
    if (!detailQuery.data?.scheduledFor) return;
    const scheduled = new Date(detailQuery.data.scheduledFor);
    const local = new Date(
      scheduled.getTime() - scheduled.getTimezoneOffset() * 60_000,
    );
    setScheduledFor(local.toISOString().slice(0, 16));
  }, [detailQuery.data?.scheduledFor]);

  const notice = detailQuery.data;
  const validationError = notice ? validateNoticeForReview(notice) : null;
  const isReviewable = Boolean(
    notice &&
      ["DRAFT", "APPROVED", "SCHEDULED"].includes(notice.lifecycleStatus),
  );

  const previewQuery = useQuery({
    queryKey: ["notice-recipient-preview", noticeId, notice?.updatedAt],
    queryFn: () =>
      communicationsApi.previewNoticeRecipients({
        title: notice!.title,
        body: notice!.body,
        priority: notice!.priority,
        audienceType: notice!.audienceType,
        classId: notice!.classId,
        sectionId: notice!.sectionId,
      }),
    enabled: Boolean(notice && isReviewable && canPreview && !validationError),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: ReviewAction) => {
      if (action === "publish") {
        return communicationsApi.publishNotice(noticeId);
      }
      if (action === "schedule") {
        return communicationsApi.scheduleNotice(
          noticeId,
          toScheduledIso(scheduledFor),
        );
      }
      return communicationsApi.requestNoticeApproval(noticeId, {
        reason: approvalReason.trim(),
        ...(scheduledFor
          ? { scheduledFor: toScheduledIso(scheduledFor) }
          : {}),
      });
    },
    onSuccess: async () => {
      setPendingAction(null);
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: ["notice-detail", noticeId],
          exact: true,
        }),
        queryClient.invalidateQueries({ queryKey: ["notices"] }),
        queryClient.invalidateQueries({
          queryKey: ["communications-summary"],
        }),
      ]);
      router.replace(`/dashboard/notices/${noticeId}`);
    },
  });

  if (detailQuery.isLoading) {
    return <LoadingState label="Loading saved notice for review..." />;
  }
  if (detailQuery.isError || !notice) {
    return (
      <ErrorState
        title="Notice review unavailable"
        message="The saved notice could not be loaded. Return to all notices and try again."
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }
  if (!canPreview) {
    return (
      <PermissionDenied
        showNavigation={false}
        title="Notice review is restricted"
        description="Your role cannot resolve the notice audience for final review."
      />
    );
  }
  if (!isReviewable) {
    return (
      <ErrorState
        title="This notice is no longer awaiting publication"
        message="Open the notice detail to review its current backend lifecycle."
      />
    );
  }

  const requiresApproval =
    notice.priority !== "NORMAL" && notice.lifecycleStatus === "DRAFT";
  const previewReady =
    previewQuery.isSuccess &&
    previewQuery.data.allowedRecipientCount > 0 &&
    previewQuery.data.channels.length > 0;
  const scheduleError = scheduledFor
    ? validateScheduledFor(scheduledFor)
    : null;
  const actionBlocked =
    Boolean(validationError) || !previewReady || actionMutation.isPending;
  const attachmentFileId =
    notice.attachmentFileId ?? getProtectedFileId(notice.attachmentUrl);

  return (
    <div className="space-y-6" data-testid="notice-review-workspace">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">
          M15 Notices and Announcements
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Review notice</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Confirm the saved content, backend-resolved audience, channels,
              schedule, and approval requirement before publication.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/notices/${noticeId}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
            >
              <ArrowLeft size={16} /> Back to notice
            </Link>
            {notice.lifecycleStatus === "DRAFT" ? (
              <Link
                href={`/dashboard/notices/${noticeId}/edit`}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
              >
                <Pencil size={16} /> Back to edit
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <ReviewSection title="Notice content" icon={<CheckCircle2 size={18} />}>
            <ReviewFact label="Title" value={notice.title} />
            <ReviewFact label="Message" value={notice.body} multiline />
            <ReviewFact label="Priority" value={formatEnum(notice.priority)} />
            <ReviewFact
              label="Attachment"
              value={attachmentFileId ? "Protected attachment" : "None"}
              action={
                attachmentFileId ? (
                  <ProtectedFileButton
                    fileAssetId={attachmentFileId}
                    ariaLabel="Open protected notice attachment"
                    errorLabel="Attachment preview is unavailable right now."
                  >
                    <Paperclip size={16} /> Open attachment
                  </ProtectedFileButton>
                ) : null
              }
            />
          </ReviewSection>

          <ReviewSection title="Audience" icon={<UsersRound size={18} />}>
            <ReviewFact
              label="Audience"
              value={
                notice.audienceType === "ALL"
                  ? "Whole school"
                  : formatEnum(notice.audienceType)
              }
            />
            {notice.audienceType !== "ALL" ? (
              <ReviewFact
                label="Class"
                value={notice.className ?? "Class unavailable"}
              />
            ) : null}
            {notice.audienceType === "SECTION" ? (
              <ReviewFact
                label="Section"
                value={notice.sectionName ?? "Section unavailable"}
              />
            ) : null}
          </ReviewSection>

          <ReviewSection title="Publication" icon={<CalendarClock size={18} />}>
            <ReviewFact
              label="Approval requirement"
              value={
                requiresApproval
                  ? "Approval required before publication"
                  : notice.lifecycleStatus === "APPROVED"
                    ? "Approved"
                    : "No approval required"
              }
            />
            <ReviewFact
              label="Schedule"
              value={
                scheduledFor && !scheduleError
                  ? formatBsDateTime(toScheduledIso(scheduledFor))
                  : "Publish immediately"
              }
            />
            {(canSchedule || requiresApproval) ? (
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Optional Nepal-local schedule
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(event) => setScheduledFor(event.target.value)}
                  className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 font-normal"
                />
                {scheduleError ? (
                  <span className="text-xs text-danger-700">
                    {scheduleError}
                  </span>
                ) : null}
              </label>
            ) : null}
          </ReviewSection>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-rose-700" />
              <h2 className="font-bold text-slate-950">
                Backend recipient preview
              </h2>
            </div>
            {previewQuery.isLoading ? (
              <div className="mt-4">
                <LoadingState label="Resolving current recipients..." />
              </div>
            ) : previewQuery.isError ? (
              <div className="mt-4">
                <ErrorState
                  title="Recipient preview unavailable"
                  message="Publication stays blocked until the audience can be resolved."
                  onRetry={() => void previewQuery.refetch()}
                />
              </div>
            ) : previewQuery.data ? (
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <CountFact
                  label="Resolved"
                  value={previewQuery.data.recipientCount}
                />
                <CountFact
                  label="Eligible"
                  value={previewQuery.data.allowedRecipientCount}
                />
                <CountFact
                  label="Excluded"
                  value={previewQuery.data.skippedRecipientCount}
                />
                <CountFact
                  label="Delivery rows"
                  value={previewQuery.data.estimatedDeliveryRows}
                />
                <div className="col-span-2 rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-bold uppercase text-slate-500">
                    Selected delivery channels
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">
                    {previewQuery.data.channels.map(formatEnum).join(", ") ||
                      "No channels available"}
                  </dd>
                </div>
              </dl>
            ) : null}
          </section>

          {validationError ? (
            <p className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
              {validationError}
            </p>
          ) : null}
          {previewQuery.isSuccess && !previewReady ? (
            <p className="rounded-xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-900">
              No eligible recipients or delivery channels are available.
              Publication remains blocked.
            </p>
          ) : null}
          {actionMutation.isError ? (
            <p className="rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
              The notice action could not be completed. The saved draft remains
              unchanged; refresh the recipient preview and try again.
            </p>
          ) : null}

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {requiresApproval ? (
              <button
                type="button"
                onClick={() => setPendingAction("approval")}
                disabled={actionBlocked || Boolean(scheduleError)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                <ShieldCheck size={17} /> Submit for approval
              </button>
            ) : (
              <>
                {canPublish ? (
                  <button
                    type="button"
                    onClick={() => setPendingAction("publish")}
                    disabled={actionBlocked}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <Send size={17} /> Publish now
                  </button>
                ) : null}
                {canSchedule ? (
                  <button
                    type="button"
                    onClick={() => setPendingAction("schedule")}
                    disabled={
                      actionBlocked || !scheduledFor || Boolean(scheduleError)
                    }
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
                  >
                    <CalendarClock size={17} /> Schedule
                  </button>
                ) : null}
              </>
            )}
            {!previewReady ? (
              <p className="text-xs leading-5 text-slate-500">
                Final actions unlock only after required validation and the
                current backend recipient preview complete.
              </p>
            ) : null}
          </section>
        </aside>
      </div>

      <ConfirmDialog
        isOpen={pendingAction !== null}
        title={reviewActionTitle(pendingAction)}
        description={reviewActionDescription(pendingAction)}
        confirmLabel={reviewActionLabel(pendingAction)}
        isConfirming={actionMutation.isPending}
        confirmDisabled={
          actionBlocked ||
          (pendingAction === "schedule" &&
            (!scheduledFor || Boolean(scheduleError))) ||
          (pendingAction === "approval" && approvalReason.trim().length < 3)
        }
        onClose={() => {
          if (!actionMutation.isPending) setPendingAction(null);
        }}
        onConfirm={() => {
          if (pendingAction && !actionMutation.isPending) {
            actionMutation.mutate(pendingAction);
          }
        }}
      >
        {pendingAction === "approval" ? (
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Approval reason
            <textarea
              value={approvalReason}
              onChange={(event) => setApprovalReason(event.target.value)}
              rows={3}
              maxLength={500}
              className="rounded-xl border border-slate-200 px-3 py-2 font-normal"
              placeholder="Explain why this high-impact notice should be published"
            />
          </label>
        ) : (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            {previewQuery.data?.allowedRecipientCount ?? 0} eligible recipients
            across{" "}
            {previewQuery.data?.channels.map(formatEnum).join(", ") ||
              "no available channels"}
            .
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

function ReviewSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-slate-950">
        {icon}
        <h2 className="font-bold">{title}</h2>
      </div>
      <dl className="mt-4 space-y-4">{children}</dl>
    </section>
  );
}

function ReviewFact({
  label,
  value,
  multiline = false,
  action,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
      <dt className="text-sm font-semibold text-slate-500">{label}</dt>
      <dd
        className={
          multiline
            ? "whitespace-pre-wrap text-sm leading-7 text-slate-800"
            : "text-sm font-semibold text-slate-900"
        }
      >
        {value}
        {action ? <div className="mt-2">{action}</div> : null}
      </dd>
    </div>
  );
}

function CountFact({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-bold text-slate-950">{value}</dd>
    </div>
  );
}

function validateNoticeForReview(notice: NoticeDetail) {
  if (!notice.title.trim()) return "The saved notice title is required.";
  if (!notice.body.trim()) return "The saved notice message is required.";
  if (notice.audienceType !== "ALL" && !notice.classId) {
    return "The saved audience requires a class.";
  }
  if (notice.audienceType === "SECTION" && !notice.sectionId) {
    return "The saved audience requires a section.";
  }
  return null;
}

function validateScheduledFor(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date <= new Date()) {
    return "Choose a future schedule time.";
  }
  return null;
}

function toScheduledIso(value: string) {
  return new Date(value).toISOString();
}

function reviewActionTitle(action: ReviewAction | null) {
  if (action === "approval") return "Submit notice for approval?";
  if (action === "schedule") return "Schedule this notice?";
  return "Publish this notice now?";
}

function reviewActionDescription(action: ReviewAction | null) {
  if (action === "approval") {
    return "The saved notice and current backend recipient counts will be attached to the approval request.";
  }
  if (action === "schedule") {
    return "The notice will remain scheduled until the backend-controlled publication time.";
  }
  return "M15 will publish the notice, then M12 will resolve delivery from the persisted publication event.";
}

function reviewActionLabel(action: ReviewAction | null) {
  if (action === "approval") return "Submit for approval";
  if (action === "schedule") return "Schedule";
  return "Publish now";
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getProtectedFileId(url: string | null) {
  if (!url) return null;
  try {
    const pathname = new URL(url, "http://schoolos.local").pathname;
    const match = pathname.match(/\/files\/([^/]+)\/preview\/?$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}
