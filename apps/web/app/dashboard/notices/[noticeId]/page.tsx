'use client';

import type { ApiResponse } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CalendarClock, Megaphone, Paperclip, Send } from 'lucide-react';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

type NoticeDetail = {
  id: string;
  title: string;
  body: string;
  priority: string;
  audienceType: string;
  classId: string | null;
  className: string | null;
  sectionId: string | null;
  sectionName: string | null;
  createdBy: {
    id: string;
    email: string | null;
  } | null;
  attachmentUrl: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deliverySummary: {
    total: number;
    queued: number;
    sent: number;
    failed: number;
    skipped: number;
  };
};

export default function NoticeDetailPage() {
  const params = useParams<{ noticeId: string }>();
  const noticeId = params.noticeId;

  const noticeQuery = useQuery({
    queryKey: ['notice-detail', noticeId],
    queryFn: () => fetchNoticeDetail(noticeId),
    enabled: Boolean(noticeId),
  });

  if (noticeQuery.isLoading) {
    return (
      <NoticePageShell>
        <div className="grid gap-4">
          <div className="h-40 animate-pulse rounded-[32px] bg-gray-100" />
          <div className="h-80 animate-pulse rounded-[32px] bg-gray-100" />
        </div>
      </NoticePageShell>
    );
  }

  if (noticeQuery.isError) {
    return (
      <NoticePageShell>
        <div className="rounded-[32px] border border-danger-200 bg-danger-50 p-8 text-danger-700">
          <p className="text-sm font-semibold uppercase tracking-[0.18em]">
            Could not load notice
          </p>
          <h1 className="mt-2 text-2xl font-bold">Notice unavailable</h1>
          <p className="mt-2 text-sm leading-6">{noticeQuery.error.message}</p>
          <BackLink />
        </div>
      </NoticePageShell>
    );
  }

  const notice = noticeQuery.data;

  if (!notice) {
    return (
      <NoticePageShell>
        <div className="rounded-[32px] border border-[var(--line)] bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-950">Notice not found</h1>
          <p className="mt-2 text-sm text-gray-500">
            The notice may have been removed or is not available for this school.
          </p>
          <BackLink />
        </div>
      </NoticePageShell>
    );
  }

  return (
    <NoticePageShell>
      <section className="relative overflow-hidden rounded-[32px] border border-[var(--line)] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative">
          <BackLink light />
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <PriorityBadge priority={notice.priority} />
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
              {formatEnumLabel(notice.audienceType)} audience
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
              {resolveNoticeState(notice)}
            </span>
          </div>
          <h1 className="mt-5 max-w-4xl text-3xl font-bold tracking-tight sm:text-4xl">
            {notice.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
            {getAudienceSummary(notice)}
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-[32px] border border-[var(--line)] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
              <Megaphone size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-950">Notice body</p>
              <p className="text-xs text-gray-500">Published communication content</p>
            </div>
          </div>

          <div className="prose prose-slate mt-6 max-w-none whitespace-pre-wrap text-sm leading-7 text-gray-700">
            {notice.body}
          </div>

          {notice.attachmentUrl ? (
            <a
              href={notice.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <Paperclip size={16} />
              Open attachment
            </a>
          ) : null}
        </article>

        <aside className="space-y-4">
          <InfoCard
            icon={<CalendarClock size={18} />}
            title="Timeline"
            items={[
              ['Created', formatDateTime(notice.createdAt)],
              ['Published', notice.publishedAt ? formatDateTime(notice.publishedAt) : 'Not published'],
              ['Scheduled', notice.scheduledFor ? formatDateTime(notice.scheduledFor) : 'Not scheduled'],
              ['Updated', formatDateTime(notice.updatedAt)],
            ]}
          />

          <InfoCard
            icon={<Send size={18} />}
            title="Delivery summary"
            items={[
              ['Total', String(notice.deliverySummary.total)],
              ['Queued', String(notice.deliverySummary.queued)],
              ['Sent', String(notice.deliverySummary.sent)],
              ['Failed', String(notice.deliverySummary.failed)],
              ['Skipped', String(notice.deliverySummary.skipped)],
            ]}
          />

          <InfoCard
            icon={<Megaphone size={18} />}
            title="Audience"
            items={[
              ['Scope', formatEnumLabel(notice.audienceType)],
              ['Class', notice.className ?? 'All classes'],
              ['Section', notice.sectionName ?? 'All sections'],
              ['Created by', notice.createdBy?.email ?? 'System/user unavailable'],
            ]}
          />
        </aside>
      </section>
    </NoticePageShell>
  );
}

function NoticePageShell({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}

function BackLink({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/dashboard/notices"
      className={`inline-flex min-h-10 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition ${
        light
          ? 'bg-white/10 text-white hover:bg-white/15'
          : 'mt-6 bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <ArrowLeft size={16} />
      Back to notices
    </Link>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === 'EMERGENCY'
      ? 'bg-danger-500 text-white'
      : priority === 'URGENT'
        ? 'bg-warning-100 text-warning-700'
        : 'bg-success-100 text-success-700';

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${tone}`}>
      {formatEnumLabel(priority)}
    </span>
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
    <div className="rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-gray-700">
          {icon}
        </div>
        <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
      </div>
      <dl className="mt-4 grid gap-3">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 text-sm">
            <dt className="text-gray-500">{label}</dt>
            <dd className="text-right font-medium text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

async function fetchNoticeDetail(noticeId: string) {
  const response = await fetch(
    `${API_BASE_URL}/notices/${encodeURIComponent(noticeId)}`,
    {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseApiErrorMessage(text) || `Request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiResponse<NoticeDetail>;
  return payload.data;
}

function parseApiErrorMessage(text: string) {
  if (!text) {
    return '';
  }

  try {
    const payload = JSON.parse(text) as { message?: string | string[]; error?: string };
    return Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message || payload.error || text;
  } catch {
    return text;
  }
}

function resolveNoticeState(notice: NoticeDetail) {
  if (notice.publishedAt) {
    return 'Published';
  }

  if (notice.scheduledFor) {
    return 'Scheduled';
  }

  return 'Draft';
}

function getAudienceSummary(notice: NoticeDetail) {
  if (notice.audienceType === 'ALL') {
    return 'This notice is targeted to the whole school.';
  }

  if (notice.audienceType === 'SECTION') {
    return `This notice is targeted to ${notice.className ?? 'selected class'}${
      notice.sectionName ? ` - Section ${notice.sectionName}` : ''
    }.`;
  }

  return `This notice is targeted to ${notice.className ?? 'selected class'}.`;
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}
