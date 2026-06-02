'use client';

import type {
  ParentTeacherMessageSummary,
  ParentTeacherThreadSummary,
} from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCheck,
  Clock,
  Flag,
  Lock,
  MessageSquare,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/session-provider';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { LoadingState } from '@/components/ui/loading-state';
import { PageHeader } from '@/components/ui/page-header';
import { SectionCard } from '@/components/ui/section-card';

type Props = {
  threadId?: string;
};

export function ParentTeacherMessagingWorkspace({ threadId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'IMPORTANT' | 'EMERGENCY'>('NORMAL');
  const [moderationReason, setModerationReason] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  const roles = session?.user.roles ?? [];
  const isModerator = roles.some((role) => ['super_admin', 'admin', 'principal'].includes(role));
  const isParentOnly =
    roles.includes('parent') &&
    !roles.some((role) =>
      ['super_admin', 'admin', 'principal', 'teacher', 'subject_teacher'].includes(role),
    );

  const availabilityQuery = useQuery({
    queryKey: ['parent-teacher-availability-status'],
    queryFn: api.getChatAvailabilityStatus,
  });

  const threadsQuery = useQuery({
    queryKey: ['parent-teacher-threads', statusFilter, search],
    queryFn: () =>
      api.listParentTeacherThreads({
        status: statusFilter || undefined,
        search: search || undefined,
        limit: '50',
      }),
  });

  const activeThreadId = threadId ?? threadsQuery.data?.items[0]?.id;

  const threadQuery = useQuery({
    queryKey: ['parent-teacher-thread', activeThreadId],
    queryFn: () => api.getParentTeacherThread(activeThreadId as string),
    enabled: Boolean(activeThreadId),
  });

  const messagesQuery = useQuery({
    queryKey: ['parent-teacher-messages', activeThreadId],
    queryFn: () =>
      api.listParentTeacherMessages(activeThreadId as string, { limit: '100' }),
    enabled: Boolean(activeThreadId),
  });

  useEffect(() => {
    if (activeThreadId) {
      void api.markParentTeacherThreadRead(activeThreadId);
    }
  }, [activeThreadId]);

  const createThreadMutation = useMutation({
    mutationFn: () => api.createParentTeacherThread({ studentId }),
    onSuccess: (result) => {
      setStudentId('');
      void queryClient.invalidateQueries({ queryKey: ['parent-teacher-threads'] });
      router.push(`/dashboard/messages/${result.thread.id}`);
    },
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      api.sendParentTeacherMessage(activeThreadId as string, {
        message,
        priority,
      }),
    onSuccess: (result) => {
      setMessage('');
      setPriority('NORMAL');
      setSuccessNotice(result.queuedNotice ?? 'Message sent.');
      void queryClient.invalidateQueries({ queryKey: ['parent-teacher-messages', activeThreadId] });
      void queryClient.invalidateQueries({ queryKey: ['parent-teacher-threads'] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      api.closeParentTeacherThread(activeThreadId as string, {
        reason: moderationReason,
      }),
    onSuccess: () => {
      setModerationReason('');
      setSuccessNotice('Thread closed with an audited moderation reason.');
      void queryClient.invalidateQueries({ queryKey: ['parent-teacher-thread', activeThreadId] });
      void queryClient.invalidateQueries({ queryKey: ['parent-teacher-threads'] });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: () =>
      api.escalateParentTeacherThread(activeThreadId as string, {
        reason: moderationReason || 'Needs principal/admin review',
      }),
    onSuccess: () => {
      setModerationReason('');
      setSuccessNotice('Thread escalated for school leadership review.');
      void queryClient.invalidateQueries({ queryKey: ['parent-teacher-thread', activeThreadId] });
      void queryClient.invalidateQueries({ queryKey: ['parent-teacher-threads'] });
    },
  });

  const reportMutation = useMutation({
    mutationFn: () =>
      api.createChatAbuseReport(activeThreadId as string, {
        reason: reportReason,
      }),
    onSuccess: () => {
      setReportReason('');
      setSuccessNotice('Report submitted for school review.');
    },
  });

  const threads = threadsQuery.data?.items ?? [];
  const activeThread = threadQuery.data;
  const messages = useMemo(
    () => messagesQuery.data?.items ?? [],
    [messagesQuery.data?.items],
  );
  const canSend = Boolean(
    activeThread &&
      activeThread.status !== 'CLOSED' &&
      message.trim().length > 0 &&
      message.trim().length <= 2000,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        description="Parent and class-teacher communication with school moderation and quiet-hours controls."
      />

      <AvailabilityBanner
        isLoading={availabilityQuery.isLoading}
        notice={availabilityQuery.data?.notice}
        sla={availabilityQuery.data?.sla}
        isAvailable={availabilityQuery.data?.isAvailable}
      />

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <SectionCard title="Inbox" description="Student-linked parent-teacher threads">
          <div className="space-y-4">
            <FilterBar label="Inbox Filters">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">All status</option>
                <option value="OPEN">Open</option>
                <option value="ESCALATED">Escalated</option>
                <option value="CLOSED">Closed</option>
              </select>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student or guardian"
                className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
            </FilterBar>

            {isParentOnly ? (
              <form
                className="rounded-2xl border border-slate-200 bg-white p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (studentId.trim()) createThreadMutation.mutate();
                }}
              >
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Open child thread
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    value={studentId}
                    onChange={(event) => setStudentId(event.target.value)}
                    placeholder="Student ID"
                    className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!studentId.trim() || createThreadMutation.isPending}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <MessageSquare size={16} />
                    Open
                  </button>
                </div>
              </form>
            ) : null}

            {threadsQuery.isLoading ? (
              <LoadingState label="Loading threads..." />
            ) : threadsQuery.isError ? (
              <EmptyState
                title="Messages unavailable"
                description={(threadsQuery.error as Error).message}
                icon={<Lock size={24} />}
              />
            ) : threads.length === 0 ? (
              <EmptyState
                title="No parent communication yet"
                description="Threads appear here only after a parent, assigned teacher, or school moderator opens one."
                icon={<MessageSquare size={24} />}
              />
            ) : (
              <div className="space-y-2">
                {threads.map((thread) => (
                  <ThreadListItem
                    key={thread.id}
                    thread={thread}
                    active={thread.id === activeThreadId}
                  />
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title={activeThread ? getThreadTitle(activeThread) : 'Thread'}
          description={activeThread ? getThreadSubtitle(activeThread) : 'Select a conversation'}
          headerAction={activeThread ? <StatusBadge value={activeThread.status} /> : null}
        >
          {!activeThreadId ? (
            <EmptyState
              title="Select a thread"
              description="Parent-teacher messages are intentionally tied to a student and assigned teacher."
              icon={<MessageSquare size={24} />}
            />
          ) : threadQuery.isLoading || messagesQuery.isLoading ? (
            <LoadingState label="Loading conversation..." />
          ) : threadQuery.isError || messagesQuery.isError ? (
            <EmptyState
              title="Thread unavailable"
              description={
                ((threadQuery.error || messagesQuery.error) as Error | null)?.message ??
                'Unable to load this conversation.'
              }
              icon={<Lock size={24} />}
            />
          ) : activeThread ? (
            <div className="space-y-5">
              <ThreadContext thread={activeThread} />
              <ModerationDecisionPanel
                thread={activeThread}
                messages={messages}
                isModerator={isModerator}
              />
              <MessageTimeline messages={messages} currentUserId={session?.user.id ?? ''} />

              {successNotice ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  {successNotice}
                </p>
              ) : null}

              {activeThread.status === 'CLOSED' ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  This thread is closed. Normal replies are disabled for audit safety.
                </div>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (canSend) sendMutation.mutate();
                  }}
                >
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Write a professional school message..."
                    className="min-h-28 w-full resize-y rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary-400"
                    maxLength={2000}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <select
                      value={priority}
                      onChange={(event) =>
                        setPriority(event.target.value as 'NORMAL' | 'IMPORTANT' | 'EMERGENCY')
                      }
                      className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="IMPORTANT">Important</option>
                      {!isParentOnly ? <option value="EMERGENCY">Emergency</option> : null}
                    </select>
                    <button
                      type="submit"
                      disabled={!canSend || sendMutation.isPending}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <Send size={16} />
                      Send
                    </button>
                  </div>
                  {sendMutation.isError ? (
                    <p className="text-sm text-danger-700">{sendMutation.error.message}</p>
                  ) : null}
                </form>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <ActionPanel
                  title="Report Concern"
                  description="Create a school-reviewable abuse or safety report for this thread."
                  icon={<Flag size={18} />}
                  value={reportReason}
                  onChange={setReportReason}
                  onSubmit={() => reportMutation.mutate()}
                  buttonLabel="Report"
                  reasonLabel="Concern reason"
                  placeholder="Describe the message or behavior that needs review."
                  disabled={reportReason.trim().length < 3 || reportMutation.isPending}
                />

                {isModerator ? (
                  <ActionPanel
                    title="Moderation"
                    description="Close resolved threads or escalate unresolved safety concerns."
                    icon={<ShieldCheck size={18} />}
                    value={moderationReason}
                    onChange={setModerationReason}
                    onSubmit={() => {
                      if (moderationReason.trim().length >= 3) closeMutation.mutate();
                    }}
                    secondaryAction={() => escalateMutation.mutate()}
                    buttonLabel="Close"
                    secondaryLabel="Escalate"
                    reasonLabel="Moderation reason"
                    placeholder="Record why this thread is being closed or escalated."
                    disabled={moderationReason.trim().length < 3 || closeMutation.isPending || escalateMutation.isPending}
                  />
                ) : (
                  <ActionPanel
                    title="Escalation"
                    description="Ask a school moderator to review this parent-teacher conversation."
                    icon={<AlertTriangle size={18} />}
                    value={moderationReason}
                    onChange={setModerationReason}
                    onSubmit={() => escalateMutation.mutate()}
                    buttonLabel="Escalate"
                    reasonLabel="Escalation reason"
                    placeholder="Explain why this needs school leadership review."
                    disabled={moderationReason.trim().length < 3 || escalateMutation.isPending}
                  />
                )}
              </div>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}

function AvailabilityBanner({
  isLoading,
  notice,
  sla,
  isAvailable,
}: {
  isLoading: boolean;
  notice?: string;
  sla?: string;
  isAvailable?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm',
        isAvailable
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-900',
      )}
    >
      <Clock size={18} />
      <span>{isLoading ? 'Checking school chat hours...' : notice}</span>
      {sla ? <span className="font-semibold">{sla}</span> : null}
    </div>
  );
}

function ThreadListItem({
  thread,
  active,
}: {
  thread: ParentTeacherThreadSummary;
  active: boolean;
}) {
  const latest = thread.latestMessages?.[0];

  return (
    <Link
      href={`/dashboard/messages/${thread.id}`}
      className={cn(
        'block rounded-2xl border bg-white p-4 transition',
        active ? 'border-primary-300 shadow-sm' : 'border-slate-200 hover:border-slate-300',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {getThreadTitle(thread)}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">{getThreadSubtitle(thread)}</p>
        </div>
        <StatusBadge value={thread.status} />
      </div>
      {latest ? (
        <p className="mt-3 line-clamp-2 text-sm text-slate-600">{latest.message}</p>
      ) : (
        <p className="mt-3 text-sm text-slate-400">No messages yet.</p>
      )}
    </Link>
  );
}

function ThreadContext({ thread }: { thread: ParentTeacherThreadSummary }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-3">
      <ContextItem label="Student" value={getStudentName(thread)} />
      <ContextItem label="Guardian" value={thread.guardian?.fullName ?? 'Guardian'} />
      <ContextItem label="Class Teacher" value={getTeacherName(thread)} />
    </div>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ModerationDecisionPanel({
  thread,
  messages,
  isModerator,
}: {
  thread: ParentTeacherThreadSummary;
  messages: ParentTeacherMessageSummary[];
  isModerator: boolean;
}) {
  const latest = messages[messages.length - 1];
  const importantCount = messages.filter((item) => item.priority !== 'NORMAL').length;
  const unreadCount = messages.filter((item) => item.status !== 'READ').length;
  const decision = getModerationDecision(thread, messages);

  return (
    <div
      className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4"
      data-testid="chat-moderation-decision-panel"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
            Safety & Escalation Queue
          </p>
          <h3 className="mt-1 text-sm font-bold text-amber-950">{decision.title}</h3>
          <p className="mt-1 text-sm leading-6 text-amber-900">{decision.body}</p>
        </div>
        <StatusBadge value={isModerator ? 'MODERATOR' : 'SCHOOL_REVIEW'} />
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <ModerationFact label="Thread status" value={thread.status} />
        <ModerationFact label="Latest priority" value={latest?.priority ?? 'No messages'} />
        <ModerationFact label="Priority messages" value={String(importantCount)} />
        <ModerationFact label="Unread messages" value={String(unreadCount)} />
      </div>
    </div>
  );
}

function ModerationFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function MessageTimeline({
  messages,
  currentUserId,
}: {
  messages: ParentTeacherMessageSummary[];
  currentUserId: string;
}) {
  if (messages.length === 0) {
    return (
      <EmptyState
        title="No messages yet"
        description="Start with a short, school-safe message tied to this child and class teacher."
        icon={<MessageSquare size={24} />}
        className="min-h-[220px]"
      />
    );
  }

  return (
    <div className="max-h-[520px] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
      {messages.map((item) => {
        const mine = item.senderUserId === currentUserId;

        return (
          <div key={item.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[78%] rounded-2xl px-4 py-3 text-sm',
                mine ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-800',
              )}
            >
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-75">
                <span>{item.senderRole}</span>
                {item.priority !== 'NORMAL' ? <span>{item.priority}</span> : null}
              </div>
              <p className="whitespace-pre-wrap leading-6">{item.message}</p>
              <div className="mt-2 flex items-center justify-end gap-1 text-xs opacity-75">
                <span>{formatDateTime(item.sentAt)}</span>
                <CheckCheck size={14} />
                <span>{item.status}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionPanel({
  title,
  description,
  icon,
  value,
  onChange,
  onSubmit,
  buttonLabel,
  disabled,
  reasonLabel = 'Reason',
  placeholder = 'Reason',
  secondaryAction,
  secondaryLabel,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  buttonLabel: string;
  disabled: boolean;
  reasonLabel?: string;
  placeholder?: string;
  secondaryAction?: () => void;
  secondaryLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        {title}
      </div>
      {description ? <p className="mb-3 text-sm leading-6 text-slate-500">{description}</p> : null}
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
        {reasonLabel}
      </label>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-20 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {buttonLabel}
        </button>
        {secondaryAction && secondaryLabel ? (
          <button
            type="button"
            onClick={secondaryAction}
            disabled={disabled}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function getModerationDecision(
  thread: ParentTeacherThreadSummary,
  messages: ParentTeacherMessageSummary[],
) {
  const hasEmergency = messages.some((item) => item.priority === 'EMERGENCY');
  const hasImportant = messages.some((item) => item.priority === 'IMPORTANT');

  if (thread.status === 'ESCALATED') {
    return {
      title: 'Escalated thread needs owner review',
      body: 'Review the message history, record the decision reason, then close or keep the escalation active for leadership follow-up.',
    };
  }

  if (thread.status === 'CLOSED') {
    return {
      title: 'Closed thread is audit-only',
      body: 'Replies are disabled. Reopen is intentionally not available from this surface; use a new thread if communication must continue.',
    };
  }

  if (hasEmergency) {
    return {
      title: 'Emergency message present',
      body: 'Emergency messages should be reviewed by school staff immediately and escalated if the class teacher cannot resolve it.',
    };
  }

  if (hasImportant) {
    return {
      title: 'Important message needs timely response',
      body: 'Monitor response progress and escalate if the conversation needs principal or administrator review.',
    };
  }

  return {
    title: 'Standard monitored conversation',
    body: 'Keep communication professional, student-linked, and within school chat-hour expectations.',
  };
}

function StatusBadge({ value }: { value: string }) {
  const tone =
    value === 'OPEN'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : value === 'ESCALATED' || value === 'EMERGENCY'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : value === 'READ'
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-slate-50 text-slate-600';

  return (
    <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold', tone)}>
      {value}
    </span>
  );
}

function getThreadTitle(thread: ParentTeacherThreadSummary) {
  return `${getStudentName(thread)} and ${getTeacherName(thread)}`;
}

function getThreadSubtitle(thread: ParentTeacherThreadSummary) {
  const className = thread.student?.class?.name ?? 'Class';
  const sectionName = thread.student?.sectionRef?.name
    ? ` ${thread.student.sectionRef.name}`
    : '';
  return `${className}${sectionName} | ${thread.guardian?.fullName ?? 'Guardian'} | ${thread.sla ?? 'Usually replies within 1 school day.'}`;
}

function getStudentName(thread: ParentTeacherThreadSummary) {
  const first = thread.student?.firstNameEn ?? 'Student';
  const last = thread.student?.lastNameEn ?? '';
  return `${first} ${last}`.trim();
}

function getTeacherName(thread: ParentTeacherThreadSummary) {
  const first = thread.classTeacher?.firstName ?? 'Class';
  const last = thread.classTeacher?.lastName ?? 'Teacher';
  return `${first} ${last}`.trim();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-NP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
