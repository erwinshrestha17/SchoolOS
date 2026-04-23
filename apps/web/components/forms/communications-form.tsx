'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';

export function CommunicationsForm() {
  const [noticeTitle, setNoticeTitle] = useState('Emergency holiday notice');
  const noticeMutation = useMutation({
    mutationFn: api.createNotice,
  });

  const eventMutation = useMutation({
    mutationFn: api.createEvent,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Notice Composer</p>
        <div className="grid gap-3">
          <input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} />
          <textarea
            rows={5}
            defaultValue="School will remain closed tomorrow due to weather conditions."
          />
          <button
            className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white"
            onClick={() =>
              noticeMutation.mutate({
                title: noticeTitle,
                body: 'School will remain closed tomorrow due to weather conditions.',
                priority: 'EMERGENCY',
              })
            }
          >
            {noticeMutation.isPending ? 'Publishing...' : 'Publish notice'}
          </button>
        </div>
      </div>

      <div className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Event Publisher</p>
        <button
          className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white"
          onClick={() =>
            eventMutation.mutate({
              title: 'Parent-teacher meeting',
              eventType: 'MEETING',
              startsAt: new Date().toISOString(),
              location: 'Main hall',
            })
          }
        >
          {eventMutation.isPending ? 'Creating...' : 'Create event'}
        </button>
      </div>
    </div>
  );
}
