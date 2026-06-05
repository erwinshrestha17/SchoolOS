'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ExternalLink, Megaphone } from 'lucide-react';
import { api } from '../../lib/api';

export function NoticeDetailLinksPanel() {
  const noticesQuery = useQuery({
    queryKey: ['notices'],
    queryFn: api.listNotices,
  });

  const notices = noticesQuery.data ?? [];

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-mod-notices-bg)] text-[var(--color-mod-notices-text)]">
          <Megaphone size={20} />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-950">Notice detail links</p>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Open notice detail pages using the real notice database ID. Do not manually use the notice title in the URL.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {noticesQuery.isLoading ? (
          <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
            Loading notices...
          </div>
        ) : noticesQuery.isError ? (
          <div className="rounded-2xl bg-danger-50 p-4 text-sm text-danger-700">
            Could not load notice links: {noticesQuery.error.message}
          </div>
        ) : notices.length === 0 ? (
          <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
            No notices are available yet. Publish a notice first.
          </div>
        ) : (
          notices.slice(0, 6).map((notice) => (
            <Link
              key={notice.id}
              href={`/dashboard/notices/${encodeURIComponent(notice.id)}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-4 text-sm transition hover:-translate-y-0.5 hover:border-[var(--color-mod-notices-border)] hover:bg-[var(--color-mod-notices-bg)] hover:shadow-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-950">{notice.title}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatEnumLabel(notice.audienceType)} / {formatEnumLabel(notice.priority)} / {notice.publishedAt ? 'Published' : notice.scheduledFor ? 'Scheduled' : 'Draft'}
                </p>
              </div>
              <ExternalLink size={16} className="shrink-0 text-gray-400" />
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
