'use client';

import type { ActivityPost } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Download,
  Eye,
  Heart,
  Sparkles,
  Star,
  UsersRound,
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { Badge } from '../../../../components/ui/badge';
import { EmptyState } from '../../../../components/ui/empty-state';
import { LoadingState } from '../../../../components/ui/loading-state';
import { PageHeader } from '../../../../components/ui/page-header';

type ActivityPostStatus = NonNullable<ActivityPost['status']>;

export default function ActivityPostDetailRoute() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useParams<{ postId?: string | string[] }>();
  const postId = Array.isArray(params.postId)
    ? params.postId[0]
    : params.postId;

  const postQuery = useQuery({
    queryKey: ['activity-post-detail', postId],
    queryFn: () => api.getActivityPost(postId ?? ''),
    enabled: Boolean(postId),
  });
  const [editTitle, setEditTitle] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [moderationReason, setModerationReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refreshPost = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['activity-post-detail', postId],
      }),
      queryClient.invalidateQueries({ queryKey: ['activity-posts'] }),
    ]);
  };

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateActivityPost(postId ?? '', {
        title: editTitle.trim() || undefined,
        caption: editCaption.trim() || undefined,
      }),
    onSuccess: async () => {
      setActionMessage('Activity post draft updated.');
      await refreshPost();
    },
  });
  const moderateMutation = useMutation({
    mutationFn: (status: ActivityPostStatus) =>
      api.moderateActivityPost(postId ?? '', {
        status,
        reason: moderationReason.trim() || undefined,
      }),
    onSuccess: async () => {
      setActionMessage('Activity post moderation status updated.');
      setModerationReason('');
      await refreshPost();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () =>
      api.deleteActivityPost(postId ?? '', {
        reason: deleteReason.trim(),
      }),
    onSuccess: async () => {
      setActionMessage('Activity post removed from the feed.');
      await queryClient.invalidateQueries({ queryKey: ['activity-posts'] });
      router.push('/dashboard/activity');
    },
  });

  const post = postQuery.data;

  useEffect(() => {
    if (!post) return;
    setEditTitle(post.title);
    setEditCaption(post.caption ?? post.body ?? '');
  }, [post]);

  if (postQuery.isLoading) {
    return <LoadingState />;
  }

  if (postQuery.isError) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          title="Activity post unavailable"
          description={postQuery.error.message}
        />
      </div>
    );
  }

  if (!postQuery.data) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          title="Activity post not found"
          description="The post may have been removed or is outside your activity scope."
        />
      </div>
    );
  }

  return (
    <ActivityPostDetail
      post={postQuery.data}
      editTitle={editTitle}
      editCaption={editCaption}
      moderationReason={moderationReason}
      deleteReason={deleteReason}
      actionMessage={actionMessage}
      mutationError={
        updateMutation.error?.message ??
        moderateMutation.error?.message ??
        deleteMutation.error?.message ??
        null
      }
      isSaving={updateMutation.isPending}
      isModerating={moderateMutation.isPending}
      isDeleting={deleteMutation.isPending}
      setEditTitle={setEditTitle}
      setEditCaption={setEditCaption}
      setModerationReason={setModerationReason}
      setDeleteReason={setDeleteReason}
      onSave={() => updateMutation.mutate()}
      onModerate={(status) => moderateMutation.mutate(status)}
      onDelete={() => deleteMutation.mutate()}
    />
  );
}

function ActivityPostDetail({
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
  setEditTitle,
  setEditCaption,
  setModerationReason,
  setDeleteReason,
  onSave,
  onModerate,
  onDelete,
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
  setEditTitle: (value: string) => void;
  setEditCaption: (value: string) => void;
  setModerationReason: (value: string) => void;
  setDeleteReason: (value: string) => void;
  onSave: () => void;
  onModerate: (status: ActivityPostStatus) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader
        title={post.title}
        description="Classroom activity post detail with private media, student tags, and guardian reaction context."
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{formatEnumLabel(post.category)}</Badge>
            {post.status ? (
              <Badge variant="outline">{formatEnumLabel(post.status)}</Badge>
            ) : null}
            <Badge variant="outline">
              {post.publishedAt ? formatDateTime(post.publishedAt) : 'Draft'}
            </Badge>
          </div>
          <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {post.caption ?? post.body ?? 'No caption was added.'}
          </div>
        </article>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <UsersRound size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">
                Tagged students
              </p>
              <p className="text-xs text-slate-500">
                {post.studentTags.length} linked to this post
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {post.studentTags.length > 0 ? (
              post.studentTags.map((tag) => (
                <span
                  key={tag.studentId}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700"
                >
                  {tag.student
                    ? `${tag.student.firstNameEn} ${tag.student.lastNameEn}`
                    : 'Student'}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-500">No student tags.</p>
            )}
          </div>
        </aside>
      </section>

      <LifecyclePanel
        post={post}
        editTitle={editTitle}
        editCaption={editCaption}
        moderationReason={moderationReason}
        deleteReason={deleteReason}
        actionMessage={actionMessage}
        mutationError={mutationError}
        isSaving={isSaving}
        isModerating={isModerating}
        isDeleting={isDeleting}
        setEditTitle={setEditTitle}
        setEditCaption={setEditCaption}
        setModerationReason={setModerationReason}
        setDeleteReason={setDeleteReason}
        onSave={onSave}
        onModerate={onModerate}
        onDelete={onDelete}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {post.attachments.length > 0 ? (
          post.attachments.map((attachment) => (
            <article
              key={attachment.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="aspect-[16/10] bg-slate-100">
                {attachment.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.fileName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-slate-400">
                    <Camera size={28} />
                    <p className="mt-2 text-xs font-bold uppercase tracking-widest">
                      {attachment.accessBlockedReason
                        ? 'Media hidden'
                        : 'Private media'}
                    </p>
                    {attachment.accessBlockedReason ? (
                      <p className="mt-2 max-w-[15rem] text-center text-xs font-semibold leading-relaxed text-slate-500">
                        Some media is hidden because of student photo consent settings.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="space-y-4 p-4">
                <div>
                  <p className="truncate text-sm font-black text-slate-900">
                    {attachment.fileName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatBytes(attachment.sizeBytes)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void api.previewActivityAttachment(attachment.id)
                    }
                    disabled={Boolean(attachment.accessBlockedReason)}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Eye size={14} />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void api.downloadActivityAttachment(
                        attachment.id,
                        attachment.fileName,
                      )
                    }
                    disabled={Boolean(attachment.accessBlockedReason)}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-mod-activity-accent)] text-xs font-bold text-white hover:bg-[var(--color-mod-activity-text)]"
                  >
                    <Download size={14} />
                    Save
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState
              title="No media attached"
              description="This activity post does not include private media."
            />
          </div>
        )}
      </section>

      <ReactionSummary post={post} />
    </div>
  );
}

function LifecyclePanel({
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
  setEditTitle,
  setEditCaption,
  setModerationReason,
  setDeleteReason,
  onSave,
  onModerate,
  onDelete,
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
  setEditTitle: (value: string) => void;
  setEditCaption: (value: string) => void;
  setModerationReason: (value: string) => void;
  setDeleteReason: (value: string) => void;
  onSave: () => void;
  onModerate: (status: ActivityPostStatus) => void;
  onDelete: () => void;
}) {
  const canEdit =
    !post.status ||
    post.status === 'DRAFT' ||
    post.status === 'PENDING_APPROVAL' ||
    post.status === 'REJECTED';
  const needsRejectReason = moderationReason.trim().length >= 5;
  const canDelete = deleteReason.trim().length >= 5;

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
          Backend permissions and audit logging enforce who can approve, reject,
          archive, or remove activity posts.
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
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Delete reason
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
          {isDeleting ? 'Removing...' : 'Remove post'}
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

function BackLink() {
  return (
    <Link
      href="/dashboard/activity"
      className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950"
    >
      <ArrowLeft size={16} />
      Back to activity feed
    </Link>
  );
}

function ReactionSummary({ post }: { post: ActivityPost }) {
  const reactions = post.reactions ?? [];
  const items = [
    { key: 'HEART', icon: Heart },
    { key: 'CLAP', icon: Sparkles },
    { key: 'STAR', icon: Star },
  ] as const;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-black text-slate-900">Reactions</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {items.map(({ key, icon: Icon }) => {
          const count = reactions.filter(
            (reaction) => reaction.reaction === key,
          ).length;
          return (
            <div
              key={key}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700"
            >
              <Icon size={16} />
              {formatEnumLabel(key)}: {count}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-NP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const amount = value / 1024 ** exponent;
  return `${amount.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
