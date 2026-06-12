'use client';

import {
  FormEvent,
  PropsWithChildren,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  BookOpenCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  LogIn,
  MonitorPlay,
  Save,
  Send,
  Users,
} from 'lucide-react';
import type { PermissionKey } from '@schoolos/core';
import { learningApi } from '../../lib/api/learning';
import type {
  LearningAnswer,
  LearningAttempt,
  LearningQuestion,
  LearningSession,
} from '../../lib/api/learning';
import { useEntitlements } from '../entitlements-provider';
import { useSession } from '../session-provider';
import { EmptyState } from '../ui/empty-state';
import { LoadingState } from '../ui/loading-state';
import { PermissionDenied } from '../ui/permission-denied';
import { StatusBadge } from '../ui/status-badge';

function LearningRouteGuard({
  children,
  permissions,
  title,
}: PropsWithChildren<{ permissions: PermissionKey[]; title: string }>) {
  const router = useRouter();
  const { session, status } = useSession();
  const { hasModule, loading: entitlementsLoading } = useEntitlements();

  if (status === 'loading' || entitlementsLoading) {
    return <LoadingState variant="page" label="Checking learning access" />;
  }

  if (!session) {
    router.replace('/login');
    return <LoadingState variant="page" label="Redirecting to sign in" />;
  }

  if (!hasModule('learning')) {
    return (
      <RuntimeShell title={title}>
        <PermissionDenied
          title="Learning module unavailable"
          description="This school has not enabled the Learning module."
          resource="Learning"
          action="module.learning"
        />
      </RuntimeShell>
    );
  }

  const granted = new Set(session.user.permissions);
  const canAccess = permissions.some((permission) => granted.has(permission));
  if (!canAccess) {
    return (
      <RuntimeShell title={title}>
        <PermissionDenied
          title="Learning access restricted"
          description="Your current role cannot open this learning view."
          resource="Learning"
          action={permissions.join(' or ')}
        />
      </RuntimeShell>
    );
  }

  return <>{children}</>;
}

function RuntimeShell({
  children,
  title,
  description,
}: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-2 border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </main>
  );
}

export function SmartBoardSessionView({ sessionId }: { sessionId: string }) {
  const sessionQuery = useQuery({
    queryKey: ['learning-board-session', sessionId],
    queryFn: () => learningApi.getSession(sessionId),
  });

  return (
    <LearningRouteGuard
      title="Smart Board Session"
      permissions={['learning:read', 'learning:launch']}
    >
      <RuntimeShell
        title="Smart Board Session"
        description="Show safe activity prompts for a live classroom session."
      >
        {sessionQuery.isLoading && <LoadingState variant="page" label="Loading board session" />}
        {sessionQuery.error && <RuntimeError error={sessionQuery.error} />}
        {sessionQuery.data && <BoardSession session={sessionQuery.data} />}
      </RuntimeShell>
    </LearningRouteGuard>
  );
}

function BoardSession({ session }: { session: LearningSession }) {
  const questions = session.activity?.questions ?? [];
  const [questionIndex, setQuestionIndex] = useState(0);
  const { mutate: sendHeartbeat, isPending: heartbeatPending } = useMutation({
    mutationFn: () => learningApi.heartbeatSession(session.id),
  });
  const currentQuestion = questions[questionIndex] ?? null;

  useEffect(() => {
    if (session.status !== 'LIVE') return;
    sendHeartbeat();
    const interval = window.setInterval(() => {
      sendHeartbeat();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [sendHeartbeat, session.id, session.status]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">
              {session.sessionCode ? `Code ${session.sessionCode}` : 'Learning session'}
            </p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">
              {session.activity.title}
            </h2>
            {session.activity.description && (
              <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">
                {session.activity.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={session.status} />
            <StatusBadge
              status={session.activity.difficulty}
              label={labelize(session.activity.difficulty)}
              tone="info"
            />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-sm font-bold text-slate-600">
            Expires {formatDateTime(session.expiresAt)} · Heartbeat{' '}
            {heartbeatPending ? 'sending' : 'active'}
          </p>
          <p className="text-sm font-black text-slate-950">
            {questions.length === 0
              ? 'No questions'
              : `${questionIndex + 1} of ${questions.length}`}
          </p>
        </div>
      </div>
      {currentQuestion ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
              Question {questionIndex + 1} · {labelize(currentQuestion.type)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))}
                disabled={questionIndex === 0}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setQuestionIndex((current) =>
                    Math.min(questions.length - 1, current + 1),
                  )
                }
                disabled={questionIndex >= questions.length - 1}
                className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
          <p className="mt-5 text-4xl font-black leading-tight text-slate-950 md:text-5xl">
            {currentQuestion.prompt}
          </p>
          <QuestionOptions question={currentQuestion} readOnly />
        </div>
      ) : (
        <EmptyState
          icon={<BookOpenCheck size={28} />}
          title="No questions in this activity"
          description="Add questions in the activity builder before using board mode."
        />
      )}
    </div>
  );
}

export function StudentLearningJoinView() {
  const router = useRouter();
  const [sessionCode, setSessionCode] = useState('');
  const [qrToken, setQrToken] = useState('');
  const joinMutation = useMutation({
    mutationFn: learningApi.joinSession,
    onSuccess: (result) => {
      router.push(`/student/learning/session/${result.session.id}`);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    joinMutation.mutate({
      sessionCode: sessionCode.trim() || undefined,
      qrToken: qrToken.trim() || undefined,
    });
  }

  return (
    <LearningRouteGuard title="Join Learning Session" permissions={['learning:attempt']}>
      <RuntimeShell
        title="Join Learning Session"
        description="Enter the school session code or QR token from your teacher."
      >
        <form
          onSubmit={submit}
          className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
              Session code
            </span>
            <input
              value={sessionCode}
              onChange={(event) => setSessionCode(event.target.value.toUpperCase())}
              className="mt-2 h-14 w-full rounded-xl border border-slate-200 px-4 text-center text-2xl font-black tracking-widest text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              maxLength={24}
            />
          </label>
          <label className="mt-5 block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">
              QR token
            </span>
            <input
              value={qrToken}
              onChange={(event) => setQrToken(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <button
            type="submit"
            disabled={joinMutation.isPending || (!sessionCode.trim() && !qrToken.trim())}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogIn size={18} />
            Join session
          </button>
          {joinMutation.error && <RuntimeError error={joinMutation.error} />}
        </form>
      </RuntimeShell>
    </LearningRouteGuard>
  );
}

export function StudentLearningSessionView({ sessionId }: { sessionId: string }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const queryClient = useQueryClient();
  const startedAt = useMemo(() => Date.now(), []);

  const sessionQuery = useQuery({
    queryKey: ['student-learning-session', sessionId],
    queryFn: () => learningApi.getSession(sessionId),
  });
  const attemptMutation = useMutation({
    mutationFn: () => learningApi.startAttempt(sessionId),
    onSuccess: (attempt) => {
      setAnswers(answersFromAttempt(attempt));
      setNotice(
        attempt.answers?.length ? 'Attempt resumed.' : 'Attempt started.',
      );
    },
  });
  const autosaveMutation = useMutation({
    mutationFn: (attempt: LearningAttempt) =>
      learningApi.autosaveAttempt(attempt.id, {
        answers: toAnswerPayload(answers),
        timeSpentSeconds: elapsedSeconds(startedAt),
      }),
    onSuccess: (attempt) => {
      setLastSavedAt(new Date().toISOString());
      setNotice('Attempt autosaved.');
      void queryClient.setQueryData(['student-learning-attempt', attempt.id], attempt);
    },
  });
  const submitMutation = useMutation({
    mutationFn: (attempt: LearningAttempt) =>
      learningApi.submitAttempt(attempt.id, {
        answers: toAnswerPayload(answers),
        timeSpentSeconds: elapsedSeconds(startedAt),
      }),
    onSuccess: (attempt) => {
      setConfirmSubmit(false);
      setNotice('Attempt submitted.');
      void queryClient.setQueryData(['student-learning-attempt', attempt.id], attempt);
    },
  });

  const activeAttempt = submitMutation.data ?? autosaveMutation.data ?? attemptMutation.data;
  const questions = sessionQuery.data?.activity.questions ?? [];
  const unansweredCount = questions.filter(
    (question) => question.id && !hasAnswer(answers[question.id]),
  ).length;

  function setAnswer(questionId: string, answer: unknown) {
    setAnswers((current) => ({ ...current, [questionId]: answer }));
    setConfirmSubmit(false);
  }

  function requestSubmit() {
    setConfirmSubmit(true);
    setNotice(
      unansweredCount > 0
        ? `${unansweredCount} question${unansweredCount === 1 ? '' : 's'} still need an answer.`
        : 'Review once before final submission.',
    );
  }

  return (
    <LearningRouteGuard title="Learning Session" permissions={['learning:attempt']}>
      <RuntimeShell
        title="Learning Session"
        description="Work through the activity. Autosave keeps your current answers on the server."
      >
        {notice && (
          <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            {notice}
          </div>
        )}
        {sessionQuery.isLoading && <LoadingState variant="page" label="Loading session" />}
        {sessionQuery.error && <RuntimeError error={sessionQuery.error} />}
        {sessionQuery.data && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">
                    {sessionQuery.data.activity.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {sessionQuery.data.activity.estimatedMinutes ?? 0} minutes · {labelize(sessionQuery.data.activity.difficulty)}
                  </p>
                </div>
                <StatusBadge status={activeAttempt?.status ?? sessionQuery.data.status} />
              </div>
            </div>
            {!activeAttempt ? (
              <button
                type="button"
                onClick={() => attemptMutation.mutate()}
                disabled={attemptMutation.isPending}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <BookOpenCheck size={18} />
                Start or resume attempt
              </button>
            ) : (
              <>
                <div className="grid gap-4">
                  {questions.map((question, index) => (
                    <div
                      key={question.id ?? index}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                        Question {index + 1} · {labelize(question.type)}
                      </p>
                      <p className="mt-2 text-lg font-black text-slate-950">
                        {question.prompt}
                      </p>
                      <QuestionAnswerInput
                        question={question}
                        value={answers[question.id ?? '']}
                        onChange={(answer) => question.id && setAnswer(question.id, answer)}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => autosaveMutation.mutate(activeAttempt)}
                    disabled={autosaveMutation.isPending || activeAttempt.status === 'SUBMITTED'}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Save size={17} />
                    Autosave
                  </button>
                  <button
                    type="button"
                    onClick={requestSubmit}
                    disabled={submitMutation.isPending || activeAttempt.status === 'SUBMITTED'}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send size={17} />
                    Submit
                  </button>
                  {lastSavedAt && (
                    <span className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-500">
                      Saved {formatDateTime(lastSavedAt)}
                    </span>
                  )}
                </div>
                {confirmSubmit && activeAttempt.status !== 'SUBMITTED' && (
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                    <p className="text-sm font-bold text-amber-950">
                      Submit this attempt now? Final submission cannot be edited.
                    </p>
                    <button
                      type="button"
                      onClick={() => submitMutation.mutate(activeAttempt)}
                      disabled={submitMutation.isPending}
                      className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-amber-700 px-4 text-sm font-black text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Send size={16} />
                      Confirm submit
                    </button>
                  </div>
                )}
                {activeAttempt.status === 'SUBMITTED' && (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="text-emerald-700" size={22} />
                      <p className="text-sm font-black text-emerald-950">
                        Submitted · Score {Math.round(activeAttempt.score ?? 0)} · Accuracy {Math.round(activeAttempt.accuracy ?? 0)}%
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
            {(attemptMutation.error || autosaveMutation.error || submitMutation.error) && (
              <RuntimeError
                error={
                  attemptMutation.error ?? autosaveMutation.error ?? submitMutation.error
                }
              />
            )}
          </div>
        )}
      </RuntimeShell>
    </LearningRouteGuard>
  );
}

export function ParentLearningSummaryView() {
  const [selectedChildId, setSelectedChildId] = useState('');
  const summaryQuery = useQuery({
    queryKey: ['parent-learning-summary'],
    queryFn: () => learningApi.getParentSummary(),
  });
  const items = summaryQuery.data?.items ?? [];
  const selectedItem =
    items.find((item) => item.child.id === selectedChildId) ?? items[0] ?? null;

  return (
    <LearningRouteGuard
      title="Parent Learning Summary"
      permissions={['learning:progress']}
    >
      <RuntimeShell
        title="Parent Learning Summary"
        description="Child-scoped learning progress with supportive activity summaries."
      >
        {summaryQuery.isLoading && <LoadingState variant="page" label="Loading child summaries" />}
        {summaryQuery.error && <RuntimeError error={summaryQuery.error} />}
        {summaryQuery.data?.items.length === 0 && (
          <EmptyState
            icon={<Users size={28} />}
            title="No linked learning summary"
            description="Linked children will appear here after submitted school learning activities."
          />
        )}
        {items.length > 1 && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Child
              </span>
              <select
                value={selectedItem?.child.id ?? ''}
                onChange={(event) => setSelectedChildId(event.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 md:max-w-sm"
              >
                {items.map((item) => (
                  <option key={item.child.id} value={item.child.id}>
                    {item.child.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="grid gap-5">
          {selectedItem && (
            <div
              key={selectedItem.child.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    {selectedItem.child.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedItem.child.class?.name ?? 'Class'} {selectedItem.child.section?.name ? `· ${selectedItem.child.section.name}` : ''}
                  </p>
                </div>
                <StatusBadge
                  status={selectedItem.supportiveLabel.label}
                  label={selectedItem.supportiveLabel.text}
                  tone="info"
                />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <SummaryTile
                  icon={<GraduationCap size={18} />}
                  label="Activities completed"
                  value={String(selectedItem.activityCount)}
                />
                <SummaryTile
                  icon={<CheckCircle2 size={18} />}
                  label="Strong areas"
                  value={String(selectedItem.strongTopics.length)}
                />
                <SummaryTile
                  icon={<Clock size={18} />}
                  label="Needs practice"
                  value={String(selectedItem.needsPracticeTopics.length)}
                />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <TopicList title="Recent completed activities" items={selectedItem.recentCompletedActivities.map((activity) => `${activity.title} · ${Math.round(activity.accuracy ?? 0)}%`)} />
                <TopicList title="Practice focus" items={selectedItem.needsPracticeTopics.map((topic) => `${topic.activity?.title ?? topic.subject?.name ?? 'Topic'} · ${topic.labelText}`)} />
              </div>
            </div>
          )}
        </div>
      </RuntimeShell>
    </LearningRouteGuard>
  );
}

function QuestionOptions({
  question,
  readOnly,
}: {
  question: LearningQuestion;
  readOnly?: boolean;
}) {
  if (question.type !== 'MULTIPLE_CHOICE' || !Array.isArray(question.options)) {
    if (question.type === 'MATCHING') {
      const pairs = matchingPairs(question.options);
      return (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <OptionList title="Left" items={pairs.map((pair) => pair.leftText)} />
          <OptionList title="Right" items={pairs.map((pair) => pair.rightText).sort()} />
        </div>
      );
    }
    if (question.type === 'ORDERING') {
      return (
        <OptionList
          title="Items"
          items={orderingItems(question.options)
            .map((item) => item.text)
            .sort()}
        />
      );
    }
    return null;
  }
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {question.options.map((option, index) => (
        <div
          key={`${question.id ?? 'question'}-${index}`}
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700"
        >
          {readOnly ? `${index + 1}. ` : null}
          {String(option)}
        </div>
      ))}
    </div>
  );
}

function QuestionAnswerInput({
  question,
  value,
  onChange,
}: {
  question: LearningQuestion;
  value: unknown;
  onChange: (answer: unknown) => void;
}) {
  if (question.type === 'TRUE_FALSE') {
    return (
      <div className="mt-4 flex flex-wrap gap-3">
        {['true', 'false'].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option === 'true')}
            className={`rounded-xl border px-4 py-2 text-sm font-black ${
              value === (option === 'true')
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            {labelize(option)}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === 'MULTIPLE_CHOICE' && Array.isArray(question.options)) {
    return (
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {question.options.map((option, index) => (
          <button
            key={`${question.id ?? 'question'}-${index}`}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-xl border px-4 py-3 text-left text-sm font-bold ${
              value === option
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {String(option)}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === 'MATCHING') {
    const pairs = matchingPairs(question.options);
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="mt-4 grid gap-3">
        {pairs.map((pair) => (
          <label key={pair.leftId} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <span className="text-sm font-black text-slate-900">{pair.leftText}</span>
            <select
              value={matchingAnswerFor(selected, pair.leftId)}
              onChange={(event) =>
                onChange(upsertMatchingAnswer(selected, pair.leftId, event.target.value))
              }
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Select match</option>
              {pairs.map((option) => (
                <option key={option.rightId} value={option.rightId}>
                  {option.rightText}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    );
  }

  if (question.type === 'ORDERING') {
    const items = orderingItems(question.options);
    const order = Array.isArray(value) && value.length
      ? value.map(String)
      : items.map((item) => item.id);
    const orderedItems = order
      .map((id) => items.find((item) => item.id === id))
      .filter(Boolean) as Array<{ id: string; text: string }>;
    return (
      <div className="mt-4 space-y-2">
        {orderedItems.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <span className="text-sm font-bold text-slate-900">
              {index + 1}. {item.text}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onChange(moveOrderItem(order, index, -1))}
                disabled={index === 0}
                className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-black text-slate-700 disabled:opacity-40"
              >
                Up
              </button>
              <button
                type="button"
                onClick={() => onChange(moveOrderItem(order, index, 1))}
                disabled={index === orderedItems.length - 1}
                className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-black text-slate-700 disabled:opacity-40"
              >
                Down
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <textarea
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.target.value)}
      rows={4}
      className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
    />
  );
}

function SummaryTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <p className="text-xs font-black uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function TopicList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-100 p-4">
      <p className="text-sm font-black text-slate-950">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No submitted activity yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.slice(0, 5).map((item) => (
            <li key={item} className="text-sm font-semibold text-slate-600">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OptionList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="mt-3 grid gap-2">
        {items.map((item, index) => (
          <div
            key={`${title}-${item}-${index}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-800"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function answersFromAttempt(attempt: LearningAttempt) {
  return Object.fromEntries(
    (attempt.answers ?? []).map((answer) => [answer.questionId, answer.answer]),
  );
}

function hasAnswer(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function matchingPairs(options: unknown) {
  if (!isRecord(options) || !Array.isArray(options.pairs)) return [];
  return options.pairs
    .filter(isRecord)
    .map((pair) => ({
      leftId: String(pair.leftId ?? ''),
      leftText: String(pair.leftText ?? ''),
      rightId: String(pair.rightId ?? ''),
      rightText: String(pair.rightText ?? ''),
    }))
    .filter((pair) => pair.leftId && pair.rightId);
}

function orderingItems(options: unknown) {
  if (!isRecord(options) || !Array.isArray(options.items)) return [];
  return options.items
    .filter(isRecord)
    .map((item) => ({
      id: String(item.id ?? ''),
      text: String(item.text ?? ''),
    }))
    .filter((item) => item.id);
}

function matchingAnswerFor(value: unknown[], leftId: string) {
  const match = value.find(
    (entry) => isRecord(entry) && String(entry.leftId ?? '') === leftId,
  );
  return isRecord(match) ? String(match.rightId ?? '') : '';
}

function upsertMatchingAnswer(value: unknown[], leftId: string, rightId: string) {
  const next = value
    .filter(
      (entry) => !isRecord(entry) || String(entry.leftId ?? '') !== leftId,
    )
    .filter(isRecord)
    .map((entry) => ({
      leftId: String(entry.leftId ?? ''),
      rightId: String(entry.rightId ?? ''),
    }));
  if (rightId) {
    next.push({ leftId, rightId });
  }
  return next;
}

function moveOrderItem(order: string[], index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= order.length) return order;
  const next = [...order];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function RuntimeError({ error }: { error: unknown }) {
  return (
    <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
      {error instanceof Error ? error.message : 'Learning request failed.'}
    </div>
  );
}

function toAnswerPayload(answers: Record<string, unknown>): LearningAnswer[] {
  return Object.entries(answers).map(([questionId, answer]) => ({
    questionId,
    answer,
  }));
}

function elapsedSeconds(startedAt: number) {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function formatDateTime(value?: string | null) {
  if (!value) return 'not set';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function labelize(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
