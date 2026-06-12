'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Archive,
  BookOpenCheck,
  ClipboardCheck,
  Copy,
  GraduationCap,
  MonitorPlay,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Send,
  Users,
} from 'lucide-react';
import { learningApi } from '../../lib/api/learning';
import type {
  LearningActivity,
  LearningActivityPayload,
  LearningActivityStatus,
  LearningActivityType,
  LearningDifficulty,
  LearningLanguageMode,
  LearningMode,
  LearningQuestion,
  LearningQuestionType,
  LearningSession,
} from '../../lib/api/learning';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import { EmptyState } from '../ui/empty-state';
import { LoadingState } from '../ui/loading-state';
import { StatCard } from '../ui/stat-card';
import { StatusBadge, type StatusTone } from '../ui/status-badge';

type LearningTab =
  | 'overview'
  | 'activities'
  | 'builder'
  | 'sessions'
  | 'board'
  | 'lab'
  | 'progress';

type LearningWorkspaceProps = {
  initialTab?: LearningTab;
  activityId?: string;
};

const activityTypes: LearningActivityType[] = [
  'PRACTICE',
  'QUIZ',
  'EXPLANATION',
  'REVISION',
  'OBSERVATION',
];
const difficulties: LearningDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];
const modes: LearningMode[] = [
  'SMART_BOARD',
  'GROUP',
  'COMPUTER_LAB',
  'WORKSHEET',
  'HYBRID',
];
const languageModes: LearningLanguageMode[] = ['ENGLISH', 'NEPALI', 'MIXED'];
const statuses: LearningActivityStatus[] = ['DRAFT', 'READY'];
const questionTypes: LearningQuestionType[] = [
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'SHORT_ANSWER',
];

const emptyQuestion: LearningQuestion = {
  type: 'MULTIPLE_CHOICE',
  prompt: '',
  options: ['Option A', 'Option B'],
  correctAnswer: 'Option A',
  points: 1,
};

const emptyActivityForm: LearningActivityPayload = {
  title: '',
  description: '',
  classId: '',
  sectionId: '',
  subjectId: '',
  teacherId: '',
  activityType: 'PRACTICE',
  difficulty: 'EASY',
  mode: 'SMART_BOARD',
  accessType: 'SCHOOL_ONLY',
  languageMode: 'ENGLISH',
  estimatedMinutes: 20,
  status: 'DRAFT',
  questions: [{ ...emptyQuestion }],
};

export function LearningWorkspace({
  initialTab = 'overview',
  activityId,
}: LearningWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<LearningTab>(
    activityId ? 'builder' : initialTab,
  );
  const [filters, setFilters] = useState({
    classId: '',
    sectionId: '',
    subjectId: '',
    difficulty: '',
    mode: '',
    status: '',
  });
  const [form, setForm] = useState<LearningActivityPayload>({
    ...emptyActivityForm,
    questions: [{ ...emptyQuestion }],
  });
  const [editingActivityId, setEditingActivityId] = useState<string | null>(
    activityId ?? null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [sessionActivityId, setSessionActivityId] = useState<string>('');
  const [sessionLookupId, setSessionLookupId] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [launchedSession, setLaunchedSession] =
    useState<(LearningSession & { qrToken?: string }) | null>(null);
  const [expiresInMinutes, setExpiresInMinutes] = useState(45);
  const [progressClassId, setProgressClassId] = useState('');
  const [progressStudentId, setProgressStudentId] = useState('');

  const queryClient = useQueryClient();

  const activitiesQuery = useQuery({
    queryKey: ['learning-activities', filters],
    queryFn: () =>
      learningApi.listActivities({
        classId: filters.classId || undefined,
        sectionId: filters.sectionId || undefined,
        subjectId: filters.subjectId || undefined,
        difficulty: (filters.difficulty || undefined) as LearningDifficulty,
        mode: (filters.mode || undefined) as LearningMode,
        status: (filters.status || undefined) as LearningActivityStatus,
        limit: 50,
      }),
  });
  const activityDetailQuery = useQuery({
    queryKey: ['learning-activity', editingActivityId],
    queryFn: () => learningApi.getActivity(editingActivityId as string),
    enabled: Boolean(editingActivityId),
  });
  const sessionQuery = useQuery({
    queryKey: ['learning-session', selectedSessionId],
    queryFn: () => learningApi.getSession(selectedSessionId),
    enabled: Boolean(selectedSessionId),
  });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const subjectsQuery = useQuery({
    queryKey: ['subjects', form.classId],
    queryFn: () => api.listSubjects({ classId: form.classId || undefined }),
  });
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: api.listStaff });
  const studentsQuery = useQuery({
    queryKey: ['students-for-learning'],
    queryFn: () => api.listStudents({ limit: 1000 }),
  });
  const classProgressQuery = useQuery({
    queryKey: ['learning-class-progress', progressClassId],
    queryFn: () => learningApi.getClassProgress(progressClassId),
    enabled: activeTab === 'progress' && Boolean(progressClassId),
  });
  const studentProgressQuery = useQuery({
    queryKey: ['learning-student-progress', progressStudentId],
    queryFn: () => learningApi.getStudentProgress(progressStudentId),
    enabled: activeTab === 'progress' && Boolean(progressStudentId),
  });

  const activities = activitiesQuery.data?.items ?? [];
  const selectedSession = launchedSession ?? sessionQuery.data ?? null;
  const students = studentsQuery.data?.items ?? [];

  const readyCount = activities.filter(
    (activity) => activity.status === 'READY',
  ).length;
  const liveSessionCount = selectedSession?.status === 'LIVE' ? 1 : 0;
  const questionCount = activities.reduce(
    (sum, activity) => sum + (activity._count?.questions ?? activity.questions?.length ?? 0),
    0,
  );

  const createActivityMutation = useMutation({
    mutationFn: learningApi.createActivity,
    onSuccess: (activity) => {
      setNotice('Learning activity saved.');
      setEditingActivityId(activity.id);
      void queryClient.invalidateQueries({ queryKey: ['learning-activities'] });
      void queryClient.invalidateQueries({ queryKey: ['learning-activity', activity.id] });
    },
  });
  const updateActivityMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<LearningActivityPayload> }) =>
      learningApi.updateActivity(id, body),
    onSuccess: (activity) => {
      setNotice('Learning activity updated.');
      void queryClient.invalidateQueries({ queryKey: ['learning-activities'] });
      void queryClient.invalidateQueries({ queryKey: ['learning-activity', activity.id] });
    },
  });
  const archiveActivityMutation = useMutation({
    mutationFn: learningApi.archiveActivity,
    onSuccess: () => {
      setNotice('Learning activity archived.');
      void queryClient.invalidateQueries({ queryKey: ['learning-activities'] });
    },
  });
  const launchSessionMutation = useMutation({
    mutationFn: (input: { activityId: string; expiresInMinutes: number }) =>
      learningApi.launchSession(input.activityId, {
        expiresInMinutes: input.expiresInMinutes,
        schoolOnly: true,
      }),
    onSuccess: (session) => {
      setLaunchedSession(session);
      setSelectedSessionId(session.id);
      setNotice('Learning session launched.');
    },
  });
  const pauseSessionMutation = useMutation({
    mutationFn: learningApi.pauseSession,
    onSuccess: (session) => updateSelectedSession(session, 'Session paused.'),
  });
  const resumeSessionMutation = useMutation({
    mutationFn: learningApi.resumeSession,
    onSuccess: (session) => updateSelectedSession(session, 'Session resumed.'),
  });
  const endSessionMutation = useMutation({
    mutationFn: learningApi.endSession,
    onSuccess: (session) => updateSelectedSession(session, 'Session ended.'),
  });

  function updateSelectedSession(session: LearningSession, message: string) {
    setLaunchedSession(session);
    setSelectedSessionId(session.id);
    setNotice(message);
    void queryClient.invalidateQueries({ queryKey: ['learning-session', session.id] });
  }

  function selectActivity(activity: LearningActivity) {
    setEditingActivityId(activity.id);
    setForm(activityToForm(activity));
    setActiveTab('builder');
  }

  function resetBuilder() {
    setEditingActivityId(null);
    setForm({ ...emptyActivityForm, questions: [{ ...emptyQuestion }] });
    setActiveTab('builder');
  }

  function submitActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = normalizeActivityPayload(form);
    if (editingActivityId) {
      updateActivityMutation.mutate({ id: editingActivityId, body: payload });
      return;
    }
    createActivityMutation.mutate(payload);
  }

  function updateQuestion(index: number, patch: Partial<LearningQuestion>) {
    setForm((current) => ({
      ...current,
      questions: (current.questions ?? []).map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    }));
  }

  function removeQuestion(index: number) {
    setForm((current) => ({
      ...current,
      questions: (current.questions ?? []).filter((_, questionIndex) => questionIndex !== index),
    }));
  }

  function addQuestion() {
    setForm((current) => ({
      ...current,
      questions: [
        ...(current.questions ?? []),
        { ...emptyQuestion, sortOrder: current.questions?.length ?? 0 },
      ],
    }));
  }

  function copySessionText(value: string) {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(value);
    setNotice('Copied to clipboard.');
  }

  const currentActivity = activityDetailQuery.data;
  useEffect(() => {
    if (!currentActivity) return;
    setForm(activityToForm(currentActivity));
  }, [currentActivity]);
  const activityTabs = useMemo(
    () => [
      { key: 'overview' as const, label: 'Overview' },
      { key: 'activities' as const, label: 'Activities' },
      { key: 'builder' as const, label: editingActivityId ? 'Edit activity' : 'Builder' },
      { key: 'sessions' as const, label: 'Sessions' },
      { key: 'board' as const, label: 'Smart board' },
      { key: 'lab' as const, label: 'Computer lab' },
      { key: 'progress' as const, label: 'Progress' },
    ],
    [editingActivityId],
  );

  return (
    <div className="space-y-6">
      {notice && <Notice message={notice} onDismiss={() => setNotice(null)} />}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {activityTabs.map((tab) => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'shrink-0 rounded-xl border px-4 py-2 text-sm font-bold transition',
              activeTab === tab.key
                ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <section className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              title="Activities"
              value={activitiesQuery.data?.total ?? 0}
              icon={<BookOpenCheck size={20} />}
              loading={activitiesQuery.isLoading}
            />
            <StatCard
              title="Ready"
              value={readyCount}
              icon={<ClipboardCheck size={20} />}
              tone="success"
              loading={activitiesQuery.isLoading}
            />
            <StatCard
              title="Questions"
              value={questionCount}
              icon={<GraduationCap size={20} />}
              tone="info"
              loading={activitiesQuery.isLoading}
            />
            <StatCard
              title="Tracked live"
              value={liveSessionCount}
              icon={<MonitorPlay size={20} />}
              tone="warning"
            />
          </div>
          <ActivityList
            activities={activities.slice(0, 8)}
            isLoading={activitiesQuery.isLoading}
            onSelect={selectActivity}
            onArchive={(id) => archiveActivityMutation.mutate(id)}
            onLaunch={(id) => {
              setSessionActivityId(id);
              setActiveTab('sessions');
            }}
          />
        </section>
      )}

      {activeTab === 'activities' && (
        <section className="space-y-5">
          <div className="shell-card p-5">
            <div className="grid gap-3 md:grid-cols-6">
              <SelectField
                label="Class"
                value={filters.classId}
                onChange={(value) => setFilters((current) => ({ ...current, classId: value }))}
                options={(classesQuery.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
              <SelectField
                label="Section"
                value={filters.sectionId}
                onChange={(value) => setFilters((current) => ({ ...current, sectionId: value }))}
                options={(sectionsQuery.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
              <SelectField
                label="Subject"
                value={filters.subjectId}
                onChange={(value) => setFilters((current) => ({ ...current, subjectId: value }))}
                options={(subjectsQuery.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
              <SelectField
                label="Difficulty"
                value={filters.difficulty}
                onChange={(value) => setFilters((current) => ({ ...current, difficulty: value }))}
                options={difficulties.map((value) => ({ value, label: labelize(value) }))}
              />
              <SelectField
                label="Mode"
                value={filters.mode}
                onChange={(value) => setFilters((current) => ({ ...current, mode: value }))}
                options={modes.map((value) => ({ value, label: labelize(value) }))}
              />
              <SelectField
                label="Status"
                value={filters.status}
                onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
                options={['', ...statuses].filter(Boolean).map((value) => ({
                  value,
                  label: labelize(value),
                }))}
              />
            </div>
          </div>
          <ActivityList
            activities={activities}
            isLoading={activitiesQuery.isLoading}
            onSelect={selectActivity}
            onArchive={(id) => archiveActivityMutation.mutate(id)}
            onLaunch={(id) => {
              setSessionActivityId(id);
              setActiveTab('sessions');
            }}
          />
        </section>
      )}

      {activeTab === 'builder' && (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">
                {editingActivityId ? 'Edit Learning Activity' : 'Teacher Activity Builder'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Build school-only activities with Easy, Medium, or Hard difficulty.
              </p>
            </div>
            <button
              type="button"
              onClick={resetBuilder}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              <Plus size={16} />
              New activity
            </button>
          </div>
          {editingActivityId && activityDetailQuery.isLoading ? (
            <LoadingState variant="skeleton" label="Loading activity" />
          ) : (
            <form className="space-y-5" onSubmit={submitActivity}>
              <div className="shell-card grid gap-4 p-5 md:grid-cols-2">
                <InputField
                  label="Title"
                  value={form.title}
                  onChange={(value) => setForm((current) => ({ ...current, title: value }))}
                  required
                />
                <SelectField
                  label="Status"
                  value={form.status ?? 'DRAFT'}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      status: value as LearningActivityStatus,
                    }))
                  }
                  options={statuses.map((value) => ({ value, label: labelize(value) }))}
                />
                <TextAreaField
                  label="Description"
                  value={form.description ?? ''}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, description: value }))
                  }
                  className="md:col-span-2"
                />
                <SelectField
                  label="Class"
                  value={form.classId}
                  required
                  onChange={(value) =>
                    setForm((current) => ({ ...current, classId: value, subjectId: '' }))
                  }
                  options={(classesQuery.data ?? []).map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                />
                <SelectField
                  label="Section"
                  value={form.sectionId ?? ''}
                  onChange={(value) => setForm((current) => ({ ...current, sectionId: value }))}
                  options={(sectionsQuery.data ?? []).map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                />
                <SelectField
                  label="Subject"
                  value={form.subjectId}
                  required
                  onChange={(value) => setForm((current) => ({ ...current, subjectId: value }))}
                  options={(subjectsQuery.data ?? []).map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                />
                <SelectField
                  label="Teacher"
                  value={form.teacherId ?? ''}
                  onChange={(value) => setForm((current) => ({ ...current, teacherId: value }))}
                  options={(staffQuery.data ?? []).map((item) => ({
                    value: item.id,
                    label: [item.firstName, item.lastName].filter(Boolean).join(' ') || item.employeeId || item.id,
                  }))}
                />
                <SelectField
                  label="Activity type"
                  value={form.activityType}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      activityType: value as LearningActivityType,
                    }))
                  }
                  options={activityTypes.map((value) => ({ value, label: labelize(value) }))}
                />
                <SelectField
                  label="Difficulty"
                  value={form.difficulty}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      difficulty: value as LearningDifficulty,
                    }))
                  }
                  options={difficulties.map((value) => ({ value, label: labelize(value) }))}
                />
                <SelectField
                  label="Mode"
                  value={form.mode}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, mode: value as LearningMode }))
                  }
                  options={modes.map((value) => ({ value, label: labelize(value) }))}
                />
                <SelectField
                  label="Language"
                  value={form.languageMode ?? 'ENGLISH'}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      languageMode: value as LearningLanguageMode,
                    }))
                  }
                  options={languageModes.map((value) => ({ value, label: labelize(value) }))}
                />
                <InputField
                  label="Estimated minutes"
                  type="number"
                  value={String(form.estimatedMinutes ?? '')}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      estimatedMinutes: Number(value || 0),
                    }))
                  }
                />
              </div>

              <div className="shell-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">
                      Questions
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Multiple choice, true/false, and normalized short answer are supported.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
                  >
                    <Plus size={16} />
                    Add question
                  </button>
                </div>
                <div className="mt-5 space-y-4">
                  {(form.questions ?? []).map((question, index) => (
                    <QuestionEditor
                      key={index}
                      index={index}
                      question={question}
                      onChange={(patch) => updateQuestion(index, patch)}
                      onRemove={() => removeQuestion(index)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={
                    createActivityMutation.isPending || updateActivityMutation.isPending
                  }
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={17} />
                  {editingActivityId ? 'Update activity' : 'Create activity'}
                </button>
                {currentActivity && (
                  <button
                    type="button"
                    onClick={() => {
                      setSessionActivityId(currentActivity.id);
                      setActiveTab('sessions');
                    }}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-100 bg-white px-5 text-sm font-black text-emerald-800 hover:bg-emerald-50"
                  >
                    <MonitorPlay size={17} />
                    Launch session
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      )}

      {activeTab === 'sessions' && (
        <SessionPanel
          activities={activities}
          sessionActivityId={sessionActivityId}
          onSessionActivityChange={setSessionActivityId}
          expiresInMinutes={expiresInMinutes}
          onExpiresInMinutesChange={setExpiresInMinutes}
          selectedSession={selectedSession}
          sessionLookupId={sessionLookupId}
          onSessionLookupIdChange={setSessionLookupId}
          onLookup={() => {
            setLaunchedSession(null);
            setSelectedSessionId(sessionLookupId.trim());
          }}
          onLaunch={() =>
            sessionActivityId &&
            launchSessionMutation.mutate({
              activityId: sessionActivityId,
              expiresInMinutes,
            })
          }
          onPause={(id) => pauseSessionMutation.mutate(id)}
          onResume={(id) => resumeSessionMutation.mutate(id)}
          onEnd={(id) => endSessionMutation.mutate(id)}
          onCopy={copySessionText}
          isLoading={sessionQuery.isLoading || launchSessionMutation.isPending}
        />
      )}

      {activeTab === 'board' && (
        <BoardLaunchPanel selectedSession={selectedSession} />
      )}

      {activeTab === 'lab' && (
        <LabPanel selectedSession={selectedSession} />
      )}

      {activeTab === 'progress' && (
        <ProgressPanel
          classes={(classesQuery.data ?? []).map((item) => ({
            id: item.id,
            name: item.name,
          }))}
          students={students.map((student) => ({
            id: student.id,
            name:
              [student.firstNameEn, student.lastNameEn].filter(Boolean).join(' ') ||
              student.studentSystemId ||
              student.id,
          }))}
          classId={progressClassId}
          studentId={progressStudentId}
          onClassIdChange={setProgressClassId}
          onStudentIdChange={setProgressStudentId}
          classProgress={classProgressQuery.data}
          studentProgress={studentProgressQuery.data}
          isLoading={classProgressQuery.isLoading || studentProgressQuery.isLoading}
        />
      )}

      {(activitiesQuery.error ||
        createActivityMutation.error ||
        updateActivityMutation.error ||
        archiveActivityMutation.error ||
        launchSessionMutation.error ||
        sessionQuery.error ||
        classProgressQuery.error ||
        studentProgressQuery.error) && (
        <ErrorNotice
          error={
            activitiesQuery.error ??
            createActivityMutation.error ??
            updateActivityMutation.error ??
            archiveActivityMutation.error ??
            launchSessionMutation.error ??
            sessionQuery.error ??
            classProgressQuery.error ??
            studentProgressQuery.error
          }
        />
      )}
    </div>
  );
}

function ActivityList({
  activities,
  isLoading,
  onSelect,
  onArchive,
  onLaunch,
}: {
  activities: LearningActivity[];
  isLoading: boolean;
  onSelect: (activity: LearningActivity) => void;
  onArchive: (activityId: string) => void;
  onLaunch: (activityId: string) => void;
}) {
  if (isLoading) {
    return <LoadingState variant="skeleton" label="Loading learning activities" />;
  }

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={<BookOpenCheck size={28} />}
        title="No learning activities yet"
        description="Create a school-only activity before launching smart-board or computer-lab sessions."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-12 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
        <div className="col-span-4">Activity</div>
        <div className="col-span-2">Class</div>
        <div className="col-span-2">Mode</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2 text-right">Actions</div>
      </div>
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="grid grid-cols-12 items-center gap-3 border-b border-slate-100 px-4 py-4 last:border-0"
        >
          <button
            type="button"
            onClick={() => onSelect(activity)}
            className="col-span-4 min-w-0 text-left"
          >
            <p className="truncate text-sm font-black text-slate-950">{activity.title}</p>
            <p className="mt-1 text-xs text-slate-500">
              {labelize(activity.difficulty)} · {activity._count?.questions ?? activity.questions?.length ?? 0} questions
            </p>
          </button>
          <div className="col-span-2 text-sm text-slate-600">
            {activity.class?.name ?? activity.classId}
            {activity.section?.name ? ` / ${activity.section.name}` : ''}
          </div>
          <div className="col-span-2 text-sm font-semibold text-slate-600">
            {labelize(activity.mode)}
          </div>
          <div className="col-span-2">
            <StatusBadge status={activity.status} />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onLaunch(activity.id)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 px-3 text-xs font-black text-emerald-800 hover:bg-emerald-100"
            >
              <MonitorPlay size={15} />
            </button>
            <button
              type="button"
              onClick={() => onArchive(activity.id)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              <Archive size={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SessionPanel(props: {
  activities: LearningActivity[];
  sessionActivityId: string;
  onSessionActivityChange: (value: string) => void;
  expiresInMinutes: number;
  onExpiresInMinutesChange: (value: number) => void;
  selectedSession: (LearningSession & { qrToken?: string }) | null;
  sessionLookupId: string;
  onSessionLookupIdChange: (value: string) => void;
  onLookup: () => void;
  onLaunch: () => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onEnd: (id: string) => void;
  onCopy: (value: string) => void;
  isLoading: boolean;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="shell-card space-y-4 p-5">
        <h2 className="text-lg font-black text-slate-950">Launch Session</h2>
        <SelectField
          label="Activity"
          value={props.sessionActivityId}
          onChange={props.onSessionActivityChange}
          options={props.activities.map((activity) => ({
            value: activity.id,
            label: activity.title,
          }))}
        />
        <InputField
          label="Expires in minutes"
          type="number"
          value={String(props.expiresInMinutes)}
          onChange={(value) => props.onExpiresInMinutesChange(Number(value || 45))}
        />
        <button
          type="button"
          disabled={!props.sessionActivityId || props.isLoading}
          onClick={props.onLaunch}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Play size={17} />
          Launch school-only session
        </button>
        <div className="border-t border-slate-100 pt-4">
          <InputField
            label="Open session by ID"
            value={props.sessionLookupId}
            onChange={props.onSessionLookupIdChange}
          />
          <button
            type="button"
            onClick={props.onLookup}
            disabled={!props.sessionLookupId.trim()}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw size={16} />
            Load session
          </button>
        </div>
      </div>

      <div className="shell-card p-5">
        <h2 className="text-lg font-black text-slate-950">Session Controls</h2>
        {props.isLoading ? (
          <LoadingState label="Loading session" />
        ) : !props.selectedSession ? (
          <EmptyState
            icon={<MonitorPlay size={28} />}
            title="No active session selected"
            description="Launch a session or load one by ID to manage board and lab access."
            className="mt-4"
          />
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                    {props.selectedSession.activity?.title ?? 'Learning session'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge status={props.selectedSession.status} />
                    <StatusBadge
                      status={props.selectedSession.schoolOnly ? 'SCHOOL_ONLY' : 'RESTRICTED'}
                      label={props.selectedSession.schoolOnly ? 'School only' : 'Restricted'}
                      tone={props.selectedSession.schoolOnly ? 'approved' : 'conflict'}
                    />
                  </div>
                </div>
                <p className="text-sm font-bold text-slate-500">
                  Expires {formatDateTime(props.selectedSession.expiresAt)}
                </p>
              </div>
              {props.selectedSession.sessionCode && (
                <div className="mt-4 rounded-xl border border-white bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Session code
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-3xl font-black tracking-widest text-slate-950">
                      {props.selectedSession.sessionCode}
                    </p>
                    <button
                      type="button"
                      onClick={() => props.onCopy(props.selectedSession?.sessionCode ?? '')}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      <Copy size={17} />
                    </button>
                  </div>
                </div>
              )}
              {props.selectedSession.qrToken && (
                <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-800">
                    QR token shown once
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <code className="min-w-0 break-all text-xs font-bold text-amber-950">
                      {props.selectedSession.qrToken}
                    </code>
                    <button
                      type="button"
                      onClick={() => props.onCopy(props.selectedSession?.qrToken ?? '')}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-white text-amber-900 hover:bg-amber-100"
                    >
                      <Copy size={17} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => props.onPause(props.selectedSession!.id)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <Pause size={16} />
                Pause
              </button>
              <button
                type="button"
                onClick={() => props.onResume(props.selectedSession!.id)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
              >
                <Play size={16} />
                Resume
              </button>
              <button
                type="button"
                onClick={() => props.onEnd(props.selectedSession!.id)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 text-sm font-bold text-rose-700 hover:bg-rose-100"
              >
                <Archive size={16} />
                End
              </button>
              <Link
                href={`/classroom/board/session/${props.selectedSession.id}`}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800"
              >
                <MonitorPlay size={16} />
                Board view
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function BoardLaunchPanel({
  selectedSession,
}: {
  selectedSession: LearningSession | null;
}) {
  return (
    <div className="shell-card p-5">
      <h2 className="text-lg font-black text-slate-950">Smart Board Runtime</h2>
      <p className="mt-1 text-sm text-slate-500">
        Use a launched session to open the classroom board. The board route reads safe
        session data and never exposes answer keys to students.
      </p>
      {selectedSession ? (
        <Link
          href={`/classroom/board/session/${selectedSession.id}`}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-slate-800"
        >
          <MonitorPlay size={17} />
          Open smart board
        </Link>
      ) : (
        <EmptyState
          icon={<MonitorPlay size={28} />}
          title="Launch or load a session first"
          description="The smart-board route needs a real backend session ID."
          className="mt-5"
        />
      )}
    </div>
  );
}

function LabPanel({ selectedSession }: { selectedSession: LearningSession | null }) {
  return (
    <div className="shell-card p-5">
      <h2 className="text-lg font-black text-slate-950">Computer Lab Access</h2>
      <p className="mt-1 text-sm text-slate-500">
        Students join with the session code or QR token, then start an individual attempt.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/student/learning/join"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800"
        >
          <Users size={17} />
          Open student join
        </Link>
        {selectedSession && (
          <Link
            href={`/student/learning/session/${selectedSession.id}`}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-100 bg-white px-5 text-sm font-black text-emerald-800 hover:bg-emerald-50"
          >
            <Send size={17} />
            Open current session
          </Link>
        )}
      </div>
    </div>
  );
}

function ProgressPanel(props: {
  classes: Array<{ id: string; name: string }>;
  students: Array<{ id: string; name: string }>;
  classId: string;
  studentId: string;
  onClassIdChange: (value: string) => void;
  onStudentIdChange: (value: string) => void;
  classProgress?: Awaited<ReturnType<typeof learningApi.getClassProgress>>;
  studentProgress?: Awaited<ReturnType<typeof learningApi.getStudentProgress>>;
  isLoading: boolean;
}) {
  return (
    <section className="space-y-5">
      <div className="shell-card grid gap-4 p-5 md:grid-cols-2">
        <SelectField
          label="Class progress"
          value={props.classId}
          onChange={props.onClassIdChange}
          options={props.classes.map((item) => ({ value: item.id, label: item.name }))}
        />
        <SelectField
          label="Student progress"
          value={props.studentId}
          onChange={props.onStudentIdChange}
          options={props.students.map((item) => ({ value: item.id, label: item.name }))}
        />
      </div>
      {props.isLoading ? <LoadingState variant="skeleton" /> : null}
      {props.classProgress && (
        <div className="shell-card p-5">
          <h3 className="text-lg font-black text-slate-950">
            {props.classProgress.class.name} progress
          </h3>
          <div className="mt-4 space-y-3">
            {props.classProgress.items.map((item) => (
              <div
                key={item.student.id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <p className="text-sm font-black text-slate-900">{item.student.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.progress.length === 0 ? (
                    <span className="text-sm text-slate-500">No submitted activity yet.</span>
                  ) : (
                    item.progress.map((progress) => (
                      <StatusBadge
                        key={progress.id}
                        status={progress.label}
                        label={`${progress.subject?.name ?? 'Subject'} · ${progress.labelText}`}
                        tone={progressTone(progress.label)}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {props.studentProgress && (
        <div className="shell-card p-5">
          <h3 className="text-lg font-black text-slate-950">
            {props.studentProgress.student.name}
          </h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {props.studentProgress.items.map((progress) => (
              <div key={progress.id} className="rounded-xl border border-slate-100 p-4">
                <p className="text-sm font-black text-slate-950">
                  {progress.activity?.title ?? progress.subject?.name ?? 'Learning progress'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {progress.completedCount} completed · {Math.round(progress.averageAccuracy)}%
                </p>
                <div className="mt-3">
                  <StatusBadge
                    status={progress.label}
                    label={progress.labelText}
                    tone={progressTone(progress.label)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
}: {
  question: LearningQuestion;
  index: number;
  onChange: (patch: Partial<LearningQuestion>) => void;
  onRemove: () => void;
}) {
  const optionsText = Array.isArray(question.options)
    ? question.options.join('\n')
    : '';

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)_100px]">
        <SelectField
          label={`Question ${index + 1}`}
          value={question.type}
          onChange={(value) => onChange({ type: value as LearningQuestionType })}
          options={questionTypes.map((value) => ({ value, label: labelize(value) }))}
        />
        <InputField
          label="Prompt"
          value={question.prompt}
          onChange={(value) => onChange({ prompt: value })}
          required
        />
        <InputField
          label="Points"
          type="number"
          value={String(question.points ?? 1)}
          onChange={(value) => onChange({ points: Number(value || 1) })}
        />
      </div>
      {question.type === 'MULTIPLE_CHOICE' && (
        <TextAreaField
          label="Options, one per line"
          value={optionsText}
          onChange={(value) =>
            onChange({
              options: value
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean),
            })
          }
          className="mt-3"
        />
      )}
      <InputField
        label="Correct answer"
        value={String(question.correctAnswer ?? '')}
        onChange={(value) => onChange({ correctAnswer: value })}
        className="mt-3"
      />
      <InputField
        label="Explanation"
        value={question.explanation ?? ''}
        onChange={(value) => onChange({ explanation: value })}
        className="mt-3"
      />
      <button
        type="button"
        onClick={onRemove}
        className="mt-3 inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
      >
        Remove question
      </button>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Notice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
      <span>{message}</span>
      <button type="button" className="text-xs font-black uppercase" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

function ErrorNotice({ error }: { error: unknown }) {
  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
      {error instanceof Error ? error.message : 'Learning request failed.'}
    </div>
  );
}

function activityToForm(activity: LearningActivity): LearningActivityPayload {
  return {
    title: activity.title,
    description: activity.description ?? '',
    classId: activity.classId,
    sectionId: activity.sectionId ?? '',
    subjectId: activity.subjectId,
    teacherId: activity.teacherId,
    activityType: activity.activityType,
    difficulty: activity.difficulty,
    mode: activity.mode,
    accessType: activity.accessType,
    languageMode: activity.languageMode,
    estimatedMinutes: activity.estimatedMinutes ?? 20,
    status: activity.status === 'ARCHIVED' ? 'DRAFT' : activity.status,
    questions: activity.questions?.length
      ? activity.questions.map((question, index) => ({
          ...question,
          sortOrder: question.sortOrder ?? index,
        }))
      : [{ ...emptyQuestion }],
  };
}

function normalizeActivityPayload(
  payload: LearningActivityPayload,
): LearningActivityPayload {
  return {
    ...payload,
    sectionId: payload.sectionId || undefined,
    teacherId: payload.teacherId || undefined,
    description: payload.description || undefined,
    estimatedMinutes: payload.estimatedMinutes || undefined,
    accessType: 'SCHOOL_ONLY',
    questions: (payload.questions ?? [])
      .filter((question) => question.prompt.trim())
      .map((question, index) => ({
        ...question,
        prompt: question.prompt.trim(),
        points: question.points ?? 1,
        sortOrder: index,
      })),
  };
}

function labelize(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateTime(value?: string | null) {
  if (!value) return 'not set';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function progressTone(label: string) {
  if (label === 'STRONG') return 'approved';
  if (label === 'READY') return 'published';
  if (label === 'IMPROVING') return 'pending';
  return 'conflict';
}
