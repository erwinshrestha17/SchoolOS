'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatBsDateTime, type ActivityPost } from '@schoolos/core';
import { api } from '../../../../lib/api';
import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { PageHeader } from '../../../../components/ui/page-header';
import { FilterBar } from '../../../../components/ui/filter-bar';
import { DataTable } from '../../../../components/ui/data-table';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { Select } from '../../../../components/ui/form-field';
import { Drawer } from '../../../../components/ui/drawer';
import { LifecyclePanel } from '../../../../components/activity/lifecycle-panel';

const queueStatuses = [
  'PENDING_APPROVAL',
  'APPROVED',
  'NEEDS_CORRECTION',
  'REJECTED',
  'ARCHIVED',
] as const;

const activityCategories = [
  'CLASSROOM_LEARNING',
  'ART_AND_CRAFT',
  'MUSIC_AND_DANCE',
  'SPORTS',
  'SCIENCE_AND_PRACTICAL',
  'PROJECT_WORK',
  'EDUCATIONAL_TOUR',
  'HEALTH_AND_HYGIENE',
  'COMPETITION',
  'ASSEMBLY',
  'CLUB_ACTIVITY',
  'COMMUNITY_SERVICE',
  'FESTIVAL_AND_CULTURE',
  'NATIONAL_PROGRAMME',
  'ACHIEVEMENT',
  'OTHER',
] as const;

export default function ActivityModerationPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    status: 'PENDING_APPROVAL' as (typeof queueStatuses)[number],
    classId: '',
    category: '',
    month: '',
  });
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const postsQuery = useQuery({
    queryKey: ['activity-moderation-queue', filters],
    queryFn: () =>
      api.listActivityPosts({
        status: filters.status,
        classId: filters.classId || null,
        category: filters.category || null,
        month: filters.month || null,
        limit: 50,
      }),
  });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });

  const posts = useMemo(() => postsQuery.data ?? [], [postsQuery.data]);
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const post of posts) {
      const key = post.status ?? 'DRAFT';
      byStatus[key] = (byStatus[key] ?? 0) + 1;
    }
    return byStatus;
  }, [posts]);

  return (
    <DashboardPageShell>
      <PageHeader
        title="Activity moderation"
        description="Review pending activity posts. Approve, reject, archive, hide, or restore with an audited reason where required."
      />

      <FilterBar label="Queue filters" description="Server-filtered moderation queue.">
        <Select
          value={filters.status}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              status: event.target.value as (typeof queueStatuses)[number],
            }))
          }
        >
          {queueStatuses.map((status) => (
            <option key={status} value={status}>
              {formatEnumLabel(status)} ({counts[status] ?? 0})
            </option>
          ))}
        </Select>
        <Select
          value={filters.classId}
          onChange={(event) =>
            setFilters((current) => ({ ...current, classId: event.target.value }))
          }
        >
          <option value="">All classes</option>
          {(classesQuery.data ?? []).map((classroom) => (
            <option key={classroom.id} value={classroom.id}>
              {classroom.name}
            </option>
          ))}
        </Select>
        <Select
          value={filters.category}
          onChange={(event) =>
            setFilters((current) => ({ ...current, category: event.target.value }))
          }
        >
          <option value="">All categories</option>
          {activityCategories.map((category) => (
            <option key={category} value={category}>
              {formatEnumLabel(category)}
            </option>
          ))}
        </Select>
        <input
          type="month"
          value={filters.month}
          onChange={(event) =>
            setFilters((current) => ({ ...current, month: event.target.value }))
          }
          className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
        />
      </FilterBar>

      <DataTable
        columns={[
          { header: 'Title', accessorKey: 'title' },
          {
            header: 'Category',
            cell: (post) => formatEnumLabel(post.category),
          },
          {
            header: 'Status',
            cell: (post) => <StatusBadge status={post.status ?? 'DRAFT'} />,
          },
          {
            header: 'Published',
            cell: (post) =>
              post.publishedAt ? formatBsDateTime(post.publishedAt) : 'Not yet',
          },
          {
            header: 'Tagged students',
            cell: (post) => post.studentTags.length,
          },
        ]}
        data={posts}
        isLoading={postsQuery.isLoading}
        error={postsQuery.isError ? postsQuery.error : null}
        emptyTitle="Nothing in this queue"
        emptyMessage="No activity posts match the selected status and filters."
        onRowClick={(post) => setSelectedPostId(post.id)}
        getRowKey={(post) => post.id}
      />

      {selectedPost ? (
        <ModerationDrawer
          post={selectedPost}
          onClose={() => setSelectedPostId(null)}
          onMutated={() =>
            void queryClient.invalidateQueries({ queryKey: ['activity-moderation-queue'] })
          }
        />
      ) : null}
    </DashboardPageShell>
  );
}

function ModerationDrawer({
  post,
  onClose,
  onMutated,
}: {
  post: ActivityPost;
  onClose: () => void;
  onMutated: () => void;
}) {
  const [editTitle, setEditTitle] = useState(post.title);
  const [editCaption, setEditCaption] = useState(post.caption ?? post.body ?? '');
  const [moderationReason, setModerationReason] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    setEditTitle(post.title);
    setEditCaption(post.caption ?? post.body ?? '');
    setModerationReason('');
    setDeleteReason('');
    setActionMessage(null);
  }, [post.id, post.title, post.caption, post.body]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateActivityPost(post.id, {
        title: editTitle.trim() || undefined,
        caption: editCaption.trim() || undefined,
      }),
    onSuccess: () => {
      setActionMessage('Draft updated.');
      onMutated();
    },
  });
  const moderateMutation = useMutation({
    mutationFn: (status: NonNullable<ActivityPost['status']>) =>
      api.moderateActivityPost(post.id, {
        status,
        reason: moderationReason.trim() || undefined,
      }),
    onSuccess: () => {
      setActionMessage('Moderation status updated.');
      setModerationReason('');
      onMutated();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteActivityPost(post.id, { reason: deleteReason.trim() }),
    onSuccess: () => {
      setActionMessage('Post hidden from the feed.');
      onMutated();
    },
  });
  const restoreMutation = useMutation({
    mutationFn: () => api.restoreActivityPost(post.id),
    onSuccess: () => {
      setActionMessage('Post restored to the moderation queue.');
      onMutated();
    },
  });

  return (
    <Drawer isOpen title={post.title} description="Moderation and content review" onClose={onClose} width="lg">
      <LifecyclePanel
        post={post}
        editTitle={editTitle}
        editCaption={editCaption}
        moderationReason={moderationReason}
        deleteReason={deleteReason}
        actionMessage={actionMessage}
        mutationError={
          updateMutation.error?.message ??
          moderateMutation.error?.message ??
          deleteMutation.error?.message ??
          restoreMutation.error?.message ??
          null
        }
        isSaving={updateMutation.isPending}
        isModerating={moderateMutation.isPending}
        isDeleting={deleteMutation.isPending}
        isRestoring={restoreMutation.isPending}
        setEditTitle={setEditTitle}
        setEditCaption={setEditCaption}
        setModerationReason={setModerationReason}
        setDeleteReason={setDeleteReason}
        onSave={() => updateMutation.mutate()}
        onModerate={(status) => moderateMutation.mutate(status)}
        onDelete={() => deleteMutation.mutate()}
        onRestore={() => restoreMutation.mutate()}
      />
    </Drawer>
  );
}

function formatEnumLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
