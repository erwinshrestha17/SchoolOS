'use client';

import type { ActivityPost } from '@schoolos/core';

type ActivityPostStatus = NonNullable<ActivityPost['status']>;

export function LifecyclePanel({
  post,
  editTitle,
  editCaption,
  moderationReason,
  deleteReason,
  actionMessage,
  mutationError,
  isSaving,
  isModerating,
  isDeleting,
  isRestoring,
  setEditTitle,
  setEditCaption,
  setModerationReason,
  setDeleteReason,
  onSave,
  onModerate,
  onDelete,
  onRestore,
}: {
  post: ActivityPost;
  editTitle: string;
  editCaption: string;
  moderationReason: string;
  deleteReason: string;
  actionMessage: string | null;
  mutationError: string | null;
  isSaving: boolean;
  isModerating: boolean;
  isDeleting: boolean;
  isRestoring: boolean;
  setEditTitle: (value: string) => void;
  setEditCaption: (value: string) => void;
  setModerationReason: (value: string) => void;
  setDeleteReason: (value: string) => void;
  onSave: () => void;
  onModerate: (status: ActivityPostStatus) => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const canEdit =
    !post.status ||
    post.status === 'DRAFT' ||
    post.status === 'PENDING_APPROVAL' ||
    post.status === 'REJECTED' ||
    post.status === 'NEEDS_CORRECTION';
  const needsRejectReason = moderationReason.trim().length >= 5;
  const canDelete = deleteReason.trim().length >= 5;
  const canRestore = Boolean(post.softDeletedAt) || post.status === 'REJECTED';

  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-black text-slate-900">Draft edit</h2>
        <p className="mt-1 text-sm text-slate-500">
          Approved or archived posts are locked by the backend and require a
          moderation decision instead of silent edits.
        </p>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Title
            </span>
            <input
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              disabled={!canEdit || isSaving}
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Caption
            </span>
            <textarea
              value={editCaption}
              onChange={(event) => setEditCaption(event.target.value)}
              disabled={!canEdit || isSaving}
              className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </label>
          <button
            type="button"
            onClick={onSave}
            disabled={!canEdit || isSaving || editTitle.trim().length < 2}
            className="inline-flex h-10 items-center rounded-xl bg-[var(--color-mod-activity-accent)] px-4 text-xs font-black uppercase tracking-widest text-white hover:bg-[var(--color-mod-activity-text)] disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save draft edit'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-black text-slate-900">
          Moderation and removal
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Backend permissions and audit logging enforce who can approve,
          reject, archive, hide, or restore activity posts.
        </p>
        <label className="mt-5 block">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Moderation reason
          </span>
          <textarea
            value={moderationReason}
            onChange={(event) => setModerationReason(event.target.value)}
            className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
            placeholder="Required when rejecting; useful for audit context."
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onModerate('APPROVED')}
            disabled={isModerating}
            className="h-10 rounded-xl bg-emerald-600 px-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => onModerate('NEEDS_CORRECTION')}
            disabled={isModerating || !needsRejectReason}
            className="h-10 rounded-xl bg-amber-600 px-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            Request correction
          </button>
          <button
            type="button"
            onClick={() => onModerate('REJECTED')}
            disabled={isModerating || !needsRejectReason}
            className="h-10 rounded-xl bg-rose-600 px-4 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => onModerate('ARCHIVED')}
            disabled={isModerating}
            className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-black uppercase tracking-widest text-slate-700 disabled:opacity-50"
          >
            Archive
          </button>
          {canRestore ? (
            <button
              type="button"
              onClick={onRestore}
              disabled={isRestoring}
              className="h-10 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-black uppercase tracking-widest text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              {isRestoring ? 'Restoring...' : 'Restore'}
            </button>
          ) : null}
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Hide reason
          </span>
          <input
            value={deleteReason}
            onChange={(event) => setDeleteReason(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
            placeholder="Required audit reason"
          />
        </label>
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete || isDeleting}
          className="mt-3 h-10 rounded-xl bg-[var(--color-mod-activity-accent)] px-4 text-xs font-black uppercase tracking-widest text-white hover:bg-[var(--color-mod-activity-text)] disabled:opacity-50"
        >
          {isDeleting ? 'Hiding...' : 'Hide post'}
        </button>

        {post.moderationReason ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Last moderation reason: {post.moderationReason}
          </p>
        ) : null}
        {actionMessage ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {actionMessage}
          </p>
        ) : null}
        {mutationError ? (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {mutationError}
          </p>
        ) : null}
      </div>
    </section>
  );
}
