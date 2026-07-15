"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatBsDateTime, type PermissionKey } from "@schoolos/core";
import {
  api,
  type NoticeDetail,
  type NoticeUnreadRecipientsResult,
} from "@/lib/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useRecentlyViewed } from "@/lib/hooks/use-recently-viewed";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProtectedFileButton } from "@/components/ui/protected-file";
import { useSession } from "@/components/session-provider";
import { NoticeAcknowledgementPanel } from "@/components/notices/notice-acknowledgement-panel";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  ArrowLeft,
  Archive,
  CalendarClock,
  Megaphone,
  Paperclip,
  RotateCcw,
  Send,
  UsersRound,
  XCircle,
  Pencil,
} from "lucide-react";

type NoticeLifecycleAction =
  | "publish"
  | "schedule"
  | "cancel"
  | "archive"
  | "restore";

export default function NoticeDetailPage() {
  const params = useParams<{ noticeId: string }>();
  const noticeId = params.noticeId;
  const queryClient = useQueryClient();
  const { session } = useSession();
  const [pendingAction, setPendingAction] =
    useState<NoticeLifecycleAction | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [unreadPage, setUnreadPage] = useState(1);

  const noticeQuery = useQuery({
    queryKey: ["notice-detail", noticeId],
    queryFn: () => api.getNoticeDetail(noticeId),
    enabled: Boolean(noticeId),
  });

  const unreadRecipientsQuery = useQuery({
    queryKey: ["notice-unread-recipients", noticeId, unreadPage],
    queryFn: () =>
      api.listNoticeUnreadRecipients(noticeId, { page: unreadPage, limit: 25 }),
    enabled: Boolean(
      noticeId && session?.user.permissions.includes("notices:read_reports"),
    ),
  });

  const previewQuery = useQuery({
    queryKey: [
      "notice-recipient-preview",
      noticeId,
      noticeQuery.data?.updatedAt,
    ],
    queryFn: () =>
      api.previewNoticeRecipients({
        title: noticeQuery.data!.title,
        body: noticeQuery.data!.body,
        priority: noticeQuery.data!.priority,
        audienceType: noticeQuery.data!.audienceType,
        classId: noticeQuery.data!.classId,
        sectionId: noticeQuery.data!.sectionId,
      }),
    enabled: Boolean(
      noticeQuery.data &&
      ["DRAFT", "APPROVED", "SCHEDULED"].includes(
        noticeQuery.data.lifecycleStatus,
      ) &&
      (session?.user.permissions.includes("notices:publish") ||
        session?.user.permissions.includes("notices:schedule")),
    ),
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({
      action,
      reason,
    }: {
      action: NoticeLifecycleAction;
      reason: string;
    }) => {
      if (action === "publish")
        return api.publishNotice(noticeId).then((result) => result.notice);
      if (action === "schedule") {
        return api.scheduleNotice(
          noticeId,
          new Date(scheduledFor).toISOString(),
        );
      }
      if (action === "cancel") return api.cancelNotice(noticeId, reason);
      if (action === "archive") return api.archiveNotice(noticeId, reason);
      return api.restoreNotice(noticeId, reason);
    },
    onSuccess: async () => {
      setPendingAction(null);
      setActionReason("");
      setScheduledFor("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["notice-detail", noticeId],
        }),
        queryClient.invalidateQueries({ queryKey: ["notices"] }),
        queryClient.invalidateQueries({
          queryKey: ["communications-summary"],
        }),
      ]);
    },
  });

  const { record: recordRecentlyViewed } = useRecentlyViewed();

  useEffect(() => {
    if (!noticeQuery.data) return;
    recordRecentlyViewed({
      kind: "notice",
      id: noticeId,
      label: noticeQuery.data.title,
      href: `/dashboard/notices/${noticeId}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noticeId, noticeQuery.data?.title]);

  if (noticeQuery.isLoading) {
    return (
      <NoticePageShell>
        <div className="grid gap-4">
          <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-80 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      </NoticePageShell>
    );
  }

  if (noticeQuery.isError) {
    return (
      <NoticePageShell>
        <div className="rounded-2xl border border-danger-200 bg-danger-50 p-8 text-danger-700">
          <p className="text-sm font-semibold uppercase tracking-[0.18em]">
            Could not load notice
          </p>
          <h1 className="mt-2 text-2xl font-bold">Notice unavailable</h1>
          <p className="mt-2 text-sm leading-6">
            This notice could not be loaded. Check your permission and try
            again.
          </p>
          <BackLink />
        </div>
      </NoticePageShell>
    );
  }

  const notice = noticeQuery.data;

  if (!notice) {
    return (
      <NoticePageShell>
        <div className="rounded-2xl border border-[var(--line)] bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-950">Notice not found</h1>
          <p className="mt-2 text-sm text-gray-500">
            The notice may have been removed or is not available for this
            school.
          </p>
          <BackLink />
        </div>
      </NoticePageShell>
    );
  }

  const attachmentFileId =
    notice.attachmentFileId ?? getProtectedFileId(notice.attachmentUrl);
  const granted = new Set<PermissionKey>(session?.user.permissions ?? []);
  const canCancel =
    granted.has("notices:cancel") &&
    ["DRAFT", "APPROVAL_PENDING", "APPROVED", "SCHEDULED"].includes(
      notice.lifecycleStatus,
    );
  const canArchive =
    granted.has("notices:archive") && notice.lifecycleStatus !== "ARCHIVED";
  const canRestore =
    granted.has("notices:archive") && notice.lifecycleStatus === "ARCHIVED";
  const canEdit =
    granted.has("notices:edit") && notice.lifecycleStatus === "DRAFT";
  const canPublish =
    granted.has("notices:publish") &&
    ["DRAFT", "APPROVED", "SCHEDULED"].includes(notice.lifecycleStatus);
  const canSchedule =
    granted.has("notices:schedule") &&
    ["DRAFT", "APPROVED", "SCHEDULED"].includes(notice.lifecycleStatus);

  return (
    <NoticePageShell>
      <PageHeader
        title={notice.title}
        description={getAudienceSummary(notice)}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BackLink className="mt-0" />
            {canEdit ? (
              <Link
                href={`/dashboard/notices/${noticeId}/edit`}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Pencil size={16} /> Edit draft
              </Link>
            ) : null}
            {canPublish ? (
              <button
                type="button"
                disabled={lifecycleMutation.isPending}
                onClick={() => setPendingAction("publish")}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Send size={16} /> Publish
              </button>
            ) : null}
            {canSchedule ? (
              <button
                type="button"
                disabled={lifecycleMutation.isPending}
                onClick={() => setPendingAction("schedule")}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <CalendarClock size={16} /> Schedule
              </button>
            ) : null}
            {canCancel ? (
              <button
                type="button"
                onClick={() => setPendingAction("cancel")}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-danger-200 px-3 py-2 text-sm font-semibold text-danger-700 hover:bg-danger-50"
              >
                <XCircle size={16} /> Cancel
              </button>
            ) : null}
            {canArchive ? (
              <button
                type="button"
                onClick={() => setPendingAction("archive")}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Archive size={16} /> Archive
              </button>
            ) : null}
            {canRestore ? (
              <button
                type="button"
                onClick={() => setPendingAction("restore")}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <RotateCcw size={16} /> Restore
              </button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={notice.priority} />
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600">
          {formatEnumLabel(notice.audienceType)} audience
        </span>
        <span className="rounded-full border border-info-100 bg-info-50 px-3 py-1 text-xs font-semibold text-info-700">
          {resolveNoticeState(notice)}
        </span>
      </div>

      {lifecycleMutation.isError ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          The notice action could not be completed. Refresh the notice and try
          again.
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-mod-notices-bg)] text-[var(--color-mod-notices-text)]">
              <Megaphone size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-950">Notice body</p>
              <p className="text-xs text-gray-500">
                Published communication content
              </p>
            </div>
          </div>

          <div className="prose prose-slate mt-6 max-w-none whitespace-pre-wrap text-sm leading-7 text-gray-700">
            {notice.body}
          </div>

          {attachmentFileId ? (
            <ProtectedFileButton
              fileAssetId={attachmentFileId}
              ariaLabel="Open protected notice attachment"
              className="mt-6"
              errorLabel="Attachment preview is unavailable right now."
            >
              <Paperclip size={16} />
              Open attachment
            </ProtectedFileButton>
          ) : notice.attachmentUrl ? (
            <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Attachment preview is unavailable right now.
            </p>
          ) : null}
        </article>

        <aside className="space-y-4">
          <InfoCard
            icon={<CalendarClock size={18} />}
            title="Timeline"
            items={[
              ["Created", formatDateTime(notice.createdAt)],
              [
                "Published",
                notice.publishedAt
                  ? formatDateTime(notice.publishedAt)
                  : "Not published",
              ],
              [
                "Scheduled",
                notice.scheduledFor
                  ? formatDateTime(notice.scheduledFor)
                  : "Not scheduled",
              ],
              ["Updated", formatDateTime(notice.updatedAt)],
            ]}
          />

          <InfoCard
            icon={<Send size={18} />}
            title="Delivery summary"
            items={[
              ["Total", String(notice.deliverySummary.total)],
              ["Queued", String(notice.deliverySummary.queued)],
              ["Sent", String(notice.deliverySummary.sent)],
              ["Failed", String(notice.deliverySummary.failed)],
              ["Skipped", String(notice.deliverySummary.skipped)],
            ]}
          />

          <InfoCard
            icon={<Megaphone size={18} />}
            title="Audience"
            items={[
              ["Scope", formatEnumLabel(notice.audienceType)],
              ["Class", notice.className ?? "All classes"],
              ["Section", notice.sectionName ?? "All sections"],
              [
                "Created by",
                notice.createdBy?.email ?? "System/user unavailable",
              ],
            ]}
          />
        </aside>
      </section>

      <UnreadRecipientsPanel
        result={unreadRecipientsQuery.data}
        isLoading={unreadRecipientsQuery.isLoading}
        error={
          unreadRecipientsQuery.isError
            ? "Unread recipient details could not be loaded right now."
            : null
        }
        onPageChange={setUnreadPage}
      />

      <NoticeAcknowledgementPanel
        noticeId={noticeId}
        lifecycleStatus={notice.lifecycleStatus}
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <HistoryCard
          title="Approval history"
          empty="No approval decisions are recorded for this notice."
          items={notice.approvalHistory.map((item) => ({
            id: `${item.decision}-${item.createdAt}`,
            label: formatEnumLabel(item.decision),
            detail: item.reason ?? "No reason recorded",
            actor: item.actorEmail,
            createdAt: item.createdAt,
          }))}
        />
        <HistoryCard
          title="Audit history"
          empty="No lifecycle audit entries are available."
          items={notice.auditHistory.map((item) => ({
            id: item.id,
            label: formatEnumLabel(item.action),
            detail: "Tenant-scoped lifecycle audit entry",
            actor: item.actorEmail,
            createdAt: item.createdAt,
          }))}
        />
      </section>

      <ConfirmDialog
        isOpen={pendingAction !== null}
        title={`${pendingAction ? formatEnumLabel(pendingAction) : "Update"} notice?`}
        description={noticeActionDescription(pendingAction)}
        confirmLabel={
          pendingAction ? formatEnumLabel(pendingAction) : "Confirm"
        }
        destructive={pendingAction === "cancel"}
        isConfirming={lifecycleMutation.isPending}
        confirmDisabled={
          pendingAction === "schedule"
            ? !scheduledFor
            : pendingAction === "publish"
              ? previewQuery.isLoading ||
                previewQuery.isError ||
                (previewQuery.data?.allowedRecipientCount ?? 0) < 1 ||
                (notice.priority !== "NORMAL" &&
                  notice.lifecycleStatus !== "APPROVED")
              : pendingAction === "cancel" ||
                  pendingAction === "archive" ||
                  pendingAction === "restore"
                ? !actionReason.trim()
                : false
        }
        onClose={() => {
          if (!lifecycleMutation.isPending) {
            setPendingAction(null);
            setActionReason("");
            setScheduledFor("");
          }
        }}
        onConfirm={() => {
          const needsReason =
            pendingAction === "cancel" ||
            pendingAction === "archive" ||
            pendingAction === "restore";
          if (pendingAction && (!needsReason || actionReason.trim())) {
            lifecycleMutation.mutate({
              action: pendingAction,
              reason: actionReason.trim(),
            });
          }
        }}
      >
        {pendingAction === "schedule" ? (
          <label className="grid gap-2 text-sm font-semibold text-gray-700">
            Nepal-local scheduled time
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
              className="min-h-11 rounded-xl border border-gray-200 px-3 py-2 font-normal"
            />
            <span className="text-xs font-normal text-gray-500">
              Times are shown in Asia/Kathmandu for school operations.
            </span>
          </label>
        ) : pendingAction === "publish" ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {previewQuery.isLoading
              ? "Checking the current recipient preview…"
              : previewQuery.isError
                ? "Recipient preview is unavailable. Close this dialog and retry before publishing."
                : `${previewQuery.data?.allowedRecipientCount ?? 0} eligible recipients across ${(previewQuery.data?.channels ?? []).map(formatEnumLabel).join(", ") || "no available channels"}.`}
            {notice.priority !== "NORMAL" &&
            notice.lifecycleStatus !== "APPROVED" ? (
              <p className="mt-2 font-semibold text-amber-800">
                Urgent and emergency notices require backend approval before
                publication.
              </p>
            ) : null}
          </div>
        ) : (
          <label className="grid gap-2 text-sm font-semibold text-gray-700">
            Reason
            <textarea
              value={actionReason}
              onChange={(event) => setActionReason(event.target.value)}
              maxLength={500}
              rows={3}
              className="rounded-xl border border-gray-200 px-3 py-2 font-normal"
              placeholder="Record why this notice is being changed"
            />
          </label>
        )}
      </ConfirmDialog>
    </NoticePageShell>
  );
}

function noticeActionDescription(action: NoticeLifecycleAction | null) {
  if (action === "publish") {
    return "Review the current backend-resolved audience before queueing delivery. Duplicate submission is disabled while this action runs.";
  }
  if (action === "schedule") {
    return "Choose a future Nepal-local time. The scheduled processor will use the persisted lifecycle state rather than assuming delivery from the clock.";
  }
  if (action === "cancel") {
    return "This stops a draft or scheduled notice from being published. A reason is required for the audit trail.";
  }
  if (action === "archive") {
    return "This removes the notice from active work while preserving its record and delivery evidence.";
  }
  return "This restores the notice to its previous lifecycle state without sending it again.";
}

function NoticePageShell({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}

function BackLink({
  light = false,
  className = "",
}: {
  light?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/dashboard/notices"
      className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
        light
          ? "bg-white/10 text-white hover:bg-white/15"
          : "mt-6 bg-gray-100 text-gray-700 hover:bg-gray-200"
      } ${className}`}
    >
      <ArrowLeft size={16} />
      Back to notices
    </Link>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === "EMERGENCY"
      ? "bg-danger-500 text-white"
      : priority === "URGENT"
        ? "bg-warning-100 text-warning-700"
        : "bg-success-100 text-success-700";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${tone}`}
    >
      {formatEnumLabel(priority)}
    </span>
  );
}

function UnreadRecipientsPanel({
  result,
  isLoading,
  error,
  onPageChange,
}: {
  result: NoticeUnreadRecipientsResult | undefined;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const recipients = useMemo(
    () => result?.recipients ?? [],
    [result?.recipients],
  );
  const channels = Array.from(
    new Set(recipients.map((recipient) => recipient.channel)),
  ).sort();
  const classes = Array.from(
    new Set(
      recipients
        .map((recipient) => recipient.student?.className)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort();
  const filteredRecipients = useMemo(() => {
    const term = search.trim().toLowerCase();

    return recipients.filter((recipient) => {
      const matchesSearch =
        !term ||
        [
          recipient.guardian?.fullName,
          recipient.guardian?.primaryPhone,
          recipient.guardian?.email,
          recipient.recipientEmail,
          recipient.destination,
          recipient.student?.fullName,
          recipient.student?.studentSystemId,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesChannel =
        !channelFilter || recipient.channel === channelFilter;
      const matchesClass =
        !classFilter || recipient.student?.className === classFilter;

      return matchesSearch && matchesChannel && matchesClass;
    });
  }, [channelFilter, classFilter, recipients, search]);
  const failedVisible = filteredRecipients.filter(
    (recipient) => recipient.status === "FAILED",
  ).length;
  const missingContactVisible = filteredRecipients.filter(
    (recipient) =>
      !recipient.guardian?.primaryPhone &&
      !recipient.guardian?.email &&
      !recipient.recipientEmail &&
      !recipient.destination,
  ).length;

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-mod-notices-bg)] text-[var(--color-mod-notices-text)]">
            <UsersRound size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-950">
              Unread recipients
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
              Recipients below have a delivery record for this notice but no
              read receipt yet.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/notices"
          className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          Back to Delivery Records
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <UnreadMetric
          label="Total deliveries"
          value={String(result?.totalDeliveries ?? 0)}
        />
        <UnreadMetric
          label="Read"
          value={String(result?.readCount ?? 0)}
          tone="success"
        />
        <UnreadMetric
          label="Unread"
          value={String(result?.unreadCount ?? 0)}
          tone="warning"
        />
      </div>

      {recipients.length > 0 ? (
        <div
          className="mt-5 space-y-3"
          data-testid="notice-unread-recipient-controls"
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search guardian, student, phone, or email"
              aria-label="Search unread notice recipients"
              className="min-h-11"
            />
            <select
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
              aria-label="Filter unread recipients by channel"
              className="min-h-11"
            >
              <option value="">All channels</option>
              {channels.map((channel) => (
                <option key={channel} value={channel}>
                  {formatEnumLabel(channel)}
                </option>
              ))}
            </select>
            <select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              aria-label="Filter unread recipients by class"
              className="min-h-11"
            >
              <option value="">All classes</option>
              {classes.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setChannelFilter("");
                setClassFilter("");
              }}
              className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 hover:text-gray-950"
            >
              Clear
            </button>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Follow-up queue: {filteredRecipients.length} visible unread
            recipients.
            {failedVisible > 0
              ? ` ${failedVisible} visible delivery records failed.`
              : ""}
            {missingContactVisible > 0
              ? ` ${missingContactVisible} visible recipients need contact cleanup.`
              : ""}
          </div>
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
        {isLoading ? (
          <div className="p-6 text-sm text-gray-500">
            Loading unread recipients...
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-danger-700">{error}</div>
        ) : !result || result.recipients.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-gray-950">
              No unread recipients
            </p>
            <p className="mt-1 text-sm text-gray-500">
              All available recipients have read this notice, or no delivery
              records exist yet.
            </p>
          </div>
        ) : filteredRecipients.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-gray-950">
              No unread recipients match these filters
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Clear the search, channel, or class filter to return to the full
              unread list.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredRecipients.map((recipient) => (
              <article
                key={recipient.deliveryId}
                className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[0.68rem] font-bold uppercase text-amber-700">
                      Unread
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[0.68rem] font-semibold uppercase text-gray-500">
                      {recipient.channel}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[0.68rem] font-semibold uppercase text-gray-500">
                      {recipient.status}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-gray-950">
                    {recipient.guardian?.fullName ??
                      recipient.recipientEmail ??
                      "Recipient unavailable"}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {recipient.student
                      ? `${recipient.student.fullName} (${recipient.student.studentSystemId})`
                      : (recipient.destination ?? "No destination")}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Contact:{" "}
                    {recipient.guardian?.primaryPhone ??
                      recipient.guardian?.email ??
                      recipient.recipientEmail ??
                      recipient.destination ??
                      "Not available"}
                  </p>
                  {recipient.errorMessage ? (
                    <p className="mt-1 text-xs text-danger-700">
                      {recipient.errorMessage}
                    </p>
                  ) : null}
                </div>
                <div className="text-left text-xs text-gray-500 lg:text-right">
                  <p>{recipient.student?.className ?? "Class unavailable"}</p>
                  <p>
                    {recipient.student?.sectionName
                      ? `Section ${recipient.student.sectionName}`
                      : "All/No section"}
                  </p>
                  <p className="mt-1">
                    Queued {formatDateTime(recipient.createdAt)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      {result ? (
        <TablePagination
          page={result.page}
          pageSize={result.limit}
          total={result.total}
          onPageChange={onPageChange}
        />
      ) : null}
    </section>
  );
}

function UnreadMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning";
}) {
  const toneClass = {
    neutral: "bg-gray-50 text-gray-700",
    success: "bg-success-50 text-success-700",
    warning: "bg-amber-50 text-amber-700",
  }[tone];

  return (
    <div className={`rounded-2xl p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: Array<[string, string]>;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-mod-notices-bg)] text-[var(--color-mod-notices-text)]">
          {icon}
        </div>
        <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
      </div>
      <dl className="mt-4 grid gap-3">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="flex items-start justify-between gap-4 text-sm"
          >
            <dt className="text-gray-500">{label}</dt>
            <dd className="text-right font-medium text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function HistoryCard({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{
    id: string;
    label: string;
    detail: string;
    actor: string | null;
    createdAt: string;
  }>;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-gray-950">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">{empty}</p>
      ) : (
        <ol className="mt-4 space-y-4 border-l border-gray-200 pl-5">
          {items.map((item) => (
            <li key={item.id} className="relative">
              <span className="absolute -left-[1.53rem] top-1.5 h-2 w-2 rounded-full bg-rose-600" />
              <p className="text-sm font-semibold text-gray-950">
                {item.label}
              </p>
              <p className="mt-1 text-sm text-gray-600">{item.detail}</p>
              <p className="mt-1 text-xs text-gray-500">
                {item.actor ?? "Actor unavailable"} ·{" "}
                {formatDateTime(item.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function resolveNoticeState(notice: NoticeDetail) {
  if (notice.lifecycleStatus) {
    return formatEnumLabel(notice.lifecycleStatus);
  }

  // Compatibility fallback for an API instance that has not yet applied the
  // lifecycle migration during a rolling deployment.
  if (notice.publishedAt) return "Published";
  if (notice.scheduledFor) {
    return "Scheduled";
  }

  return "Draft";
}

function getAudienceSummary(notice: NoticeDetail) {
  if (notice.audienceType === "ALL") {
    return "This notice is targeted to the whole school.";
  }

  if (notice.audienceType === "SECTION") {
    return `This notice is targeted to ${notice.className ?? "selected class"}${
      notice.sectionName ? ` - Section ${notice.sectionName}` : ""
    }.`;
  }

  return `This notice is targeted to ${notice.className ?? "selected class"}.`;
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: string) {
  return formatBsDateTime(value);
}

function getProtectedFileId(url: string | null) {
  if (!url) {
    return null;
  }

  try {
    const pathname = new URL(url, "http://schoolos.local").pathname;
    const match = pathname.match(/\/files\/([^/]+)\/preview\/?$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}
