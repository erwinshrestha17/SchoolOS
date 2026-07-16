'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileWarning,
  Images,
  MessageSquare,
  Plus,
  RotateCcw,
  ShieldAlert,
  Smile,
  Target,
  Truck,
} from 'lucide-react';
import { activityCategoryValues, formatBsDateTime } from '@schoolos/core';
import { api } from '../../../lib/api';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleHeader } from '../../../components/ui/module-header';
import { WorkspaceTabs } from '../../../components/ui/module-tabs';
import { FilterBar } from '../../../components/ui/filter-bar';
import { DataTable } from '../../../components/ui/data-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Select } from '../../../components/ui/form-field';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { ErrorState } from '../../../components/ui/error-state';
import { LoadingState } from '../../../components/ui/loading-state';
import { OperationalSummaryGrid } from '../../../components/ui/operational-summary-grid';
import { OffsetPagination } from '../../../components/ui/table-pagination';
import { WorkSurface } from '../../../components/ui/work-surface';
import { NoResultsState } from '../../../components/ui/workspace-states';

const activityCategories = activityCategoryValues;
const pageSize = 20;

const activityStatuses = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'NEEDS_CORRECTION',
  'REJECTED',
  'ARCHIVED',
] as const;

export default function ActivityPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    classId: '',
    sectionId: '',
    category: '',
    status: '',
    month: '',
  });

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const postsQuery = useQuery({
    queryKey: ['activity-posts', filters, page],
    queryFn: () =>
      api.listActivityPosts({
        classId: filters.classId || null,
        sectionId: filters.sectionId || null,
        category: filters.category || null,
        status: filters.status || null,
        month: filters.month || null,
        limit: pageSize + 1,
        offset: (page - 1) * pageSize,
      }),
  });

  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data]);
  const filteredSections = useMemo(
    () =>
      sections.filter((section) => {
        const sectionClassId =
          (section as { classId?: string; class?: { id: string } }).classId ??
          (section as { class?: { id: string } }).class?.id;
        return !filters.classId || sectionClassId === filters.classId;
      }),
    [sections, filters.classId],
  );

  const classNameById = useMemo(
    () => new Map(classes.map((item) => [item.id, item.name])),
    [classes],
  );
  const sectionNameById = useMemo(
    () => new Map(sections.map((item) => [item.id, item.name])),
    [sections],
  );

  const hasActiveFilters = Object.values(filters).some(Boolean);
  const posts = (postsQuery.data ?? []).slice(0, pageSize);
  const hasNextPage = (postsQuery.data?.length ?? 0) > pageSize;

  function updateFilter(key: keyof typeof filters, value: string) {
    setPage(1);
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'classId' ? { sectionId: '' } : {}),
    }));
  }

  function resetFilters() {
    setPage(1);
    setFilters({ classId: '', sectionId: '', category: '', status: '', month: '' });
  }

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="Daily Operations"
        title="Activity Feed & Milestones"
        description="Publish consent-aware classroom activities, moderate content, and track milestones and deliveries."
        primaryAction={
          <Link
            href="/dashboard/activity/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[var(--primary-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Create Activity
          </Link>
        }
        moreActionItems={[
          {
            label: 'Review moderation queue',
            icon: <ShieldAlert size={16} />,
            onClick: () => router.push('/dashboard/activity/moderation'),
          },
          {
            label: 'Open protected gallery',
            icon: <Images size={16} />,
            onClick: () => router.push('/dashboard/activity/gallery'),
          },
          {
            label: 'Review milestones',
            icon: <Target size={16} />,
            onClick: () => router.push('/dashboard/activity/milestones'),
          },
        ]}
      >
        <OperationalSummaryGrid
          module="activity"
          moduleName="Activity Feed"
          cards={[
            {
              key: 'pendingReview',
              label: 'Pending review',
              description: 'Activity posts waiting in the moderation queue.',
              href: '/dashboard/activity/moderation',
              icon: <ShieldAlert />,
              tone: 'warning',
            },
            {
              key: 'consentIssues',
              label: 'Consent attention',
              description: 'Photo-consent records needing staff attention.',
              href: '/dashboard/activity',
              icon: <AlertTriangle />,
              tone: 'warning',
            },
            {
              key: 'failedUploads',
              label: 'Media processing failed',
              description: 'Protected activity media that did not finish processing.',
              href: '/dashboard/activity/gallery',
              icon: <FileWarning />,
              tone: 'danger',
            },
            {
              key: 'myPostsAwaitingModeration',
              label: 'My posts awaiting review',
              description: 'Your activity posts waiting for moderation.',
              href: '/dashboard/activity/moderation',
              icon: <ShieldAlert />,
              tone: 'warning',
            },
            {
              key: 'myPublishedPostsToday',
              label: 'My posts published today',
              description: 'Your posts published during the current school day.',
              href: '/dashboard/activity',
              icon: <CheckCircle2 />,
              tone: 'success',
            },
            {
              key: 'myDraftPosts',
              label: 'My draft posts',
              description: 'Your activity posts that are not yet published.',
              href: '/dashboard/activity',
              icon: <MessageSquare />,
              tone: 'module',
            },
          ]}
        />
      </ModuleHeader>

      <WorkspaceTabs
        items={[
          { href: '/dashboard/activity', label: 'Feed', icon: MessageSquare },
          { href: '/dashboard/activity/moderation', label: 'Moderation', icon: CheckCircle2 },
          { href: '/dashboard/activity/gallery', label: 'Gallery', icon: Images },
          { href: '/dashboard/activity/observations', label: 'Observations', icon: Smile },
          { href: '/dashboard/activity/milestones', label: 'Milestones', icon: Target },
          { href: '/dashboard/activity/deliveries', label: 'Deliveries', icon: Truck },
          { href: '/dashboard/activity/reports', label: 'Reports', icon: BarChart3 },
        ]}
      />

      <FilterBar
        label="Feed filters"
        description="Server-filtered activity list, most recent first."
        actionSlot={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!hasActiveFilters}
            onClick={resetFilters}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        }
      >
        <Select
          value={filters.classId}
          onChange={(event) => updateFilter('classId', event.target.value)}
        >
          <option value="">All classes</option>
          {classes.map((classroom) => (
            <option key={classroom.id} value={classroom.id}>
              {classroom.name}
            </option>
          ))}
        </Select>
        <Select
          value={filters.sectionId}
          onChange={(event) => updateFilter('sectionId', event.target.value)}
        >
          <option value="">All sections</option>
          {filteredSections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </Select>
        <Select
          value={filters.category}
          onChange={(event) => updateFilter('category', event.target.value)}
        >
          <option value="">All categories</option>
          {activityCategories.map((category) => (
            <option key={category} value={category}>
              {formatEnumLabel(category)}
            </option>
          ))}
        </Select>
        <Select
          value={filters.status}
          onChange={(event) => updateFilter('status', event.target.value)}
        >
          <option value="">All statuses</option>
          {activityStatuses.map((status) => (
            <option key={status} value={status}>
              {formatEnumLabel(status)}
            </option>
          ))}
        </Select>
        <input
          type="month"
          value={filters.month}
          onChange={(event) => updateFilter('month', event.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
        />
      </FilterBar>

      <WorkSurface
        title="Activity monitoring"
        description="Consent-aware activity records returned by the server, most recent first."
        variant="table"
        flush
        footer={
          posts.length > 0 ? (
            <OffsetPagination
              page={page}
              hasNextPage={hasNextPage}
              itemLabel="activity posts"
              onPageChange={setPage}
            />
          ) : undefined
        }
      >
        {postsQuery.isLoading ? (
          <LoadingState label="Loading activity posts..." className="min-h-64" />
        ) : postsQuery.isError ? (
          <ErrorState
            title="Activity feed unavailable"
            message="The activity list could not be loaded. No post or media state was changed."
            onRetry={() => void postsQuery.refetch()}
          />
        ) : posts.length === 0 && hasActiveFilters ? (
          <NoResultsState
            description="No activity posts match the selected server filters."
            onReset={resetFilters}
          />
        ) : posts.length === 0 ? (
          <EmptyState
            title="No activity posts yet"
            description="Create the first classroom activity with consent-aware media to begin the feed."
          />
        ) : (
          <DataTable
            className="rounded-none border-0"
            columns={[
              {
                header: 'Title',
                cell: (post) => (
                  <Link
                    href={`/dashboard/activity/${post.id}`}
                    className="font-bold text-slate-900 hover:text-[var(--primary)]"
                  >
                    {post.title}
                  </Link>
                ),
              },
              {
                header: 'Class / Section',
                cell: (post) =>
                  `${classNameById.get(post.classId ?? '') ?? 'Class not recorded'}${
                    post.sectionId
                      ? ` / ${sectionNameById.get(post.sectionId) ?? 'Section'}`
                      : ''
                  }`,
              },
              {
                header: 'Category',
                cell: (post) => formatEnumLabel(post.category),
              },
              {
                header: 'Status',
                cell: (post) => <StatusBadge status={post.status ?? 'DRAFT'} />,
              },
              {
                header: 'Visibility',
                cell: (post) =>
                  post.parentVisible === false ? (
                    <StatusBadge
                      status="STAFF_ONLY"
                      label="Staff only"
                      tone="inactive"
                    />
                  ) : (
                    <StatusBadge status="PARENTS" label="Parents" tone="active" />
                  ),
              },
              {
                header: 'Published',
                cell: (post) =>
                  post.publishedAt ? formatBsDateTime(post.publishedAt) : 'Draft',
              },
            ]}
            data={posts}
            getRowKey={(post) => post.id}
          />
        )}
      </WorkSurface>
    </DashboardPageShell>
  );
}

function formatEnumLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
