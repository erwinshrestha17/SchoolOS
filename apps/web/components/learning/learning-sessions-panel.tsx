'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Archive,
  Clock,
  MonitorPlay,
  Pause,
  Play,
  RotateCcw,
  Users,
} from 'lucide-react';
import { learningApi } from '../../lib/api/learning';
import type {
  LearningActivity,
  LearningSession,
  LearningSessionStatus,
} from '../../lib/api/learning';
import { api } from '../../lib/api';
import { EmptyState } from '../ui/empty-state';
import { LoadingState } from '../ui/loading-state';
import { StatusBadge } from '../ui/status-badge';

const sessionStatuses: Array<'' | LearningSessionStatus> = [
  '',
  'LIVE',
  'PAUSED',
  'ENDED',
  'EXPIRED',
];

export function LearningSessionsPanel({
  activities,
}: {
  activities: LearningActivity[];
}) {
  const [filters, setFilters] = useState({
    classId: '',
    subjectId: '',
    status: '',
    activityId: '',
  });
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [launchActivityId, setLaunchActivityId] = useState('');
  const [expiresInMinutes, setExpiresInMinutes] = useState(45);
  const [launchedSession, setLaunchedSession] =
    useState<(LearningSession & { qrToken?: string }) | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const subjectsQuery = useQuery({
    queryKey: ['subjects', filters.classId],
    queryFn: () => api.listSubjects({ classId: filters.classId || undefined }),
  });
  const sessionsQuery = useQuery({
    queryKey: ['learning-sessions', filters],
    queryFn: () =>
      learningApi.listSessions({
        classId: filters.classId || undefined,
        subjectId: filters.subjectId || undefined,
        activityId: filters.activityId || undefined,
        status: (filters.status || undefined) as LearningSessionStatus,
        limit: 50,
      }),
  });
  const selectedSessionQuery = useQuery({
    queryKey: ['learning-session-detail', selectedSessionId],
    queryFn: () => learningApi.getSession(selectedSessionId),
    enabled: Boolean(selectedSessionId),
  });
  const participantsQuery = useQuery({
    queryKey: ['learning-session-participants', selectedSessionId],
    queryFn: () => learningApi.listParticipants(selectedSessionId),
    enabled: Boolean(selectedSessionId),
  });

  const launchMutation = useMutation({
    mutationFn: () =>
      learningApi.launchSession(launchActivityId, {
        expiresInMinutes,
        schoolOnly: true,
      }),
    onSuccess: (session) => {
      setLaunchedSession(session);
      setSelectedSessionId(session.id);
      setNotice('Learning session launched.');
      void queryClient.invalidateQueries({ queryKey: ['learning-sessions'] });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: learningApi.pauseSession,
    onSuccess: (session) => afterSessionChange(session, 'Session paused.'),
  });
  const resumeMutation = useMutation({
    mutationFn: learningApi.resumeSession,
    onSuccess: (session) => afterSessionChange(session, 'Session resumed.'),
  });
  const endMutation = useMutation({
    mutationFn: learningApi.endSession,
    onSuccess: (session) => afterSessionChange(session, 'Session ended.'),
  });
  const heartbeatMutation = useMutation({
    mutationFn: learningApi.heartbeatSession,
    onSuccess: (session) => afterSessionChange(session, 'Heartbeat recorded.'),
  });

  const selectedSession = launchedSession ?? selectedSessionQuery.data ?? null;
  const selectedQrToken =
    selectedSession &&
    'qrToken' in selectedSession &&
    typeof selectedSession.qrToken === 'string'
      ? selectedSession.qrToken
      : undefined;

  function afterSessionChange(session: LearningSession, message: string) {
    setLaunchedSession(session);
    setSelectedSessionId(session.id);
    setNotice(message);
    void queryClient.invalidateQueries({ queryKey: ['learning-sessions'] });
    void queryClient.invalidateQueries({
      queryKey: ['learning-session-detail', session.id],
    });
    void queryClient.invalidateQueries({
      queryKey: ['learning-session-participants', session.id],
    });
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-5">
        {notice && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            {notice}
          </div>
        )}
        <div className="shell-card grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_120px_auto]">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
              Launch activity
            </span>
            <select
              value={launchActivityId}
              onChange={(event) => setLaunchActivityId(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Select activity</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
              Minutes
            </span>
            <input
              type="number"
              min={5}
              max={480}
              value={expiresInMinutes}
              onChange={(event) => setExpiresInMinutes(Number(event.target.value || 45))}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="button"
            disabled={!launchActivityId || launchMutation.isPending}
            onClick={() => launchMutation.mutate()}
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 md:mt-6"
          >
            <Play size={17} />
            Launch
          </button>
        </div>

        <div className="shell-card p-5">
          <div className="grid gap-3 md:grid-cols-4">
            <Select
              label="Class"
              value={filters.classId}
              onChange={(classId) =>
                setFilters((current) => ({ ...current, classId, subjectId: '' }))
              }
              options={(classesQuery.data ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
            <Select
              label="Subject"
              value={filters.subjectId}
              onChange={(subjectId) =>
                setFilters((current) => ({ ...current, subjectId }))
              }
              options={(subjectsQuery.data ?? []).map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
            <Select
              label="Status"
              value={filters.status}
              onChange={(status) =>
                setFilters((current) => ({ ...current, status }))
              }
              options={sessionStatuses
                .filter(Boolean)
                .map((status) => ({ value: status, label: labelize(status) }))}
            />
            <Select
              label="Activity"
              value={filters.activityId}
              onChange={(activityId) =>
                setFilters((current) => ({ ...current, activityId }))
              }
              options={activities.map((activity) => ({
                value: activity.id,
                label: activity.title,
              }))}
            />
          </div>
        </div>

        {sessionsQuery.isLoading ? (
          <LoadingState variant="skeleton" label="Loading learning sessions" />
        ) : sessionsQuery.data?.items.length === 0 ? (
          <EmptyState
            icon={<MonitorPlay size={28} />}
            title="No learning sessions"
            description="Launch a school-only session from a ready activity to begin monitoring participants."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {sessionsQuery.data?.items.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => {
                  setLaunchedSession(null);
                  setSelectedSessionId(session.id);
                }}
                className="grid w-full grid-cols-12 items-center gap-3 border-b border-slate-100 px-4 py-4 text-left last:border-0 hover:bg-slate-50"
              >
                <div className="col-span-5 min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">
                    {session.activity?.title ?? 'Learning session'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {session.sessionCode} · {formatDateTime(session.startedAt)}
                  </p>
                </div>
                <div className="col-span-2">
                  <StatusBadge status={session.status} />
                </div>
                <div className="col-span-3 text-sm text-slate-600">
                  {session.participantCount ?? 0} joined · {session.submittedCount ?? 0} submitted
                </div>
                <div className="col-span-2 text-right text-xs font-bold text-slate-500">
                  {formatRelative(session.expiresAt)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <aside className="shell-card h-fit p-5">
        {!selectedSession ? (
          <EmptyState
            icon={<Users size={28} />}
            title="Select a session"
            description="Open a session to monitor participants, heartbeat, and status controls."
          />
        ) : (
          <div className="space-y-5">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    {selectedSession.sessionCode}
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">
                    {selectedSession.activity?.title ?? 'Learning session'}
                  </h3>
                </div>
                <StatusBadge status={selectedSession.status} />
              </div>
              {selectedQrToken && (
                <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-800">
                    QR token shown once
                  </p>
                  <code className="mt-1 block break-all text-xs font-bold text-amber-950">
                    {selectedQrToken}
                  </code>
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Metric label="Joined" value={selectedSession.participantCount ?? 0} />
                <Metric label="Attempts" value={selectedSession.attemptCount ?? 0} />
                <Metric label="Submitted" value={selectedSession.submittedCount ?? 0} />
                <Metric
                  label="Heartbeat"
                  value={selectedSession.teacherHeartbeatAt ? formatRelative(selectedSession.teacherHeartbeatAt) : 'none'}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => pauseMutation.mutate(selectedSession.id)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <Pause size={15} />
                Pause
              </button>
              <button
                type="button"
                onClick={() => resumeMutation.mutate(selectedSession.id)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
              >
                <Play size={15} />
                Resume
              </button>
              <button
                type="button"
                onClick={() => heartbeatMutation.mutate(selectedSession.id)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <Clock size={15} />
                Heartbeat
              </button>
              <button
                type="button"
                onClick={() => endMutation.mutate(selectedSession.id)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 text-sm font-bold text-rose-700 hover:bg-rose-100"
              >
                <Archive size={15} />
                End
              </button>
              <Link
                href={`/classroom/board/session/${selectedSession.id}`}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-bold text-white hover:bg-slate-800"
              >
                <MonitorPlay size={15} />
                Board
              </Link>
            </div>
            <div className="border-t border-slate-100 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Participants
                </p>
                <button
                  type="button"
                  onClick={() =>
                    void queryClient.invalidateQueries({
                      queryKey: ['learning-session-participants', selectedSession.id],
                    })
                  }
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600"
                >
                  <RotateCcw size={13} />
                  Refresh
                </button>
              </div>
              {participantsQuery.isLoading ? (
                <LoadingState label="Loading participants" />
              ) : participantsQuery.data?.items.length === 0 ? (
                <p className="text-sm text-slate-500">No students have joined yet.</p>
              ) : (
                <div className="space-y-2">
                  {participantsQuery.data?.items.map((item) => (
                    <div
                      key={item.participant.id}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-slate-950">
                          {item.student.name}
                        </p>
                        <StatusBadge
                          status={item.attempt?.status ?? item.participant.status}
                          tone={item.attempt?.status === 'SUBMITTED' ? 'approved' : 'pending'}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Joined {formatDateTime(item.participant.joinedAt)}
                        {item.attempt?.submittedAt
                          ? ` · Submitted ${formatDateTime(item.attempt.submittedAt)}`
                          : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </section>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return 'not set';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatRelative(value?: string | null) {
  if (!value) return 'not set';
  const diffMs = new Date(value).getTime() - Date.now();
  const minutes = Math.round(Math.abs(diffMs) / 60_000);
  if (diffMs < 0) return `${minutes}m ago`;
  return `in ${minutes}m`;
}

function labelize(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
