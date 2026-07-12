'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CheckCircle2,
  Images,
  MessageSquare,
  Plus,
  Smile,
  Target,
  Truck,
} from 'lucide-react';
import { formatBsDateTime } from '@schoolos/core';
import { api } from '../../../lib/api';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleHeader } from '../../../components/ui/module-header';
import { ModuleTabs } from '../../../components/ui/module-tabs';
import { ModuleOperationalSummary } from '../../../components/ui/module-operational-summary';
import { FilterBar } from '../../../components/ui/filter-bar';
import { DataTable } from '../../../components/ui/data-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Select } from '../../../components/ui/form-field';

const activityCategories = [
  'LEARNING',
  'OUTDOOR_PLAY',
  'ART_AND_CRAFT',
  'CELEBRATION',
  'SPORTS',
  'GENERAL',
] as const;

const activityStatuses = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'ARCHIVED',
] as const;

export default function ActivityPage() {
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
    queryKey: ['activity-posts', filters],
    queryFn: () =>
      api.listActivityPosts({
        classId: filters.classId || null,
        sectionId: filters.sectionId || null,
        category: filters.category || null,
        status: filters.status || null,
        month: filters.month || null,
        limit: 50,
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

  const posts = postsQuery.data ?? [];

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Activity Feed & Milestones"
        description="Publish consent-aware classroom activities, moderate content, and track milestones and deliveries."
        primaryAction={
          <Link
            href="/dashboard/activity/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-activity-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-activity-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-activity-border)] focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Create Activity
          </Link>
        }
      >
        <ModuleOperationalSummary module="activity" compact={false} />
      </ModuleHeader>

      <ModuleTabs
        items={[
          { href: '/dashboard/activity', label: 'Feed', icon: MessageSquare },
          { href: '/dashboard/activity/moderation', label: 'Moderation', icon: CheckCircle2 },
          { href: '/dashboard/activity/gallery', label: 'Gallery', icon: Images },
          { href: '/dashboard/activity/observations', label: 'Observations', icon: Smile },
          { href: '/dashboard/activity/milestones', label: 'Milestones', icon: Target },
          { href: '/dashboard/activity/deliveries', label: 'Deliveries', icon: Truck },
          { href: '/dashboard/activity/reports', label: 'Reports', icon: BarChart3 },
        ]}
        accentColor="rose"
        variant="light"
      />

      <FilterBar
        label="Feed filters"
        description="Server-filtered activity list, most recent first."
      >
        <Select
          value={filters.classId}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              classId: event.target.value,
              sectionId: '',
            }))
          }
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
          onChange={(event) =>
            setFilters((current) => ({ ...current, sectionId: event.target.value }))
          }
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
        <Select
          value={filters.status}
          onChange={(event) =>
            setFilters((current) => ({ ...current, status: event.target.value }))
          }
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
          onChange={(event) =>
            setFilters((current) => ({ ...current, month: event.target.value }))
          }
          className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
        />
      </FilterBar>

      <DataTable
        columns={[
          {
            header: 'Title',
            cell: (post) => (
              <Link
                href={`/dashboard/activity/${post.id}`}
                className="font-bold text-slate-900 hover:text-[var(--color-mod-activity-text)]"
              >
                {post.title}
              </Link>
            ),
          },
          {
            header: 'Class / Section',
            cell: (post) =>
              `${classNameById.get(post.classId ?? '') ?? 'Class not recorded'}${
                post.sectionId ? ` / ${sectionNameById.get(post.sectionId) ?? 'Section'}` : ''
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
            header: 'Published',
            cell: (post) =>
              post.publishedAt ? formatBsDateTime(post.publishedAt) : 'Draft',
          },
        ]}
        data={posts}
        isLoading={postsQuery.isLoading}
        error={postsQuery.isError ? postsQuery.error : null}
        emptyTitle={
          filters.classId || filters.sectionId || filters.category || filters.status || filters.month
            ? 'No results'
            : 'No activity posts yet'
        }
        emptyMessage={
          filters.classId || filters.sectionId || filters.category || filters.status || filters.month
            ? 'No activity posts match the selected filters.'
            : 'Create the first classroom activity to get started.'
        }
        getRowKey={(post) => post.id}
      />
    </DashboardPageShell>
  );
}

function formatEnumLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
