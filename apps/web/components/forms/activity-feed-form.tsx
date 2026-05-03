'use client';

import type {
  ActivityPost,
  ActivityReaction,
  DevelopmentalMilestone,
  MoodLog,
  NotificationDelivery,
  StudentProfile,
} from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { filesToBase64Payloads } from '../../lib/files';

const today = new Date().toISOString().slice(0, 10);
const maxImageBytes = 10 * 1024 * 1024;

const activitySections = [
  'Create Post',
  'Feed Preview',
  'Mood Logs',
  'Milestones',
  'Delivery Records',
] as const;

const activitySectionMeta: Record<
  ActivitySection,
  {
    title: string;
    description: string;
    badge: string;
  }
> = {
  'Create Post': {
    title: 'Activity Feed',
    description: 'Capture classroom moments, tag students, and notify guardians with private media.',
    badge: 'Composer',
  },
  'Feed Preview': {
    title: 'Feed Preview',
    description: 'Review recently published classroom posts, attachments, tags, and reactions.',
    badge: 'Guardian View',
  },
  'Mood Logs': {
    title: 'Mood Logs',
    description: 'Record daily emotional context for whole classes, sections, or individual children.',
    badge: 'Wellbeing',
  },
  Milestones: {
    title: 'Development Milestones',
    description: 'Track Montessori and ECE observations with clear child-level progress evidence.',
    badge: 'Progress',
  },
  'Delivery Records': {
    title: 'Delivery Records',
    description: 'Audit guardian notification delivery records generated from activity posts.',
    badge: 'Audit Trail',
  },
};

const activityCategories = [
  'LEARNING',
  'OUTDOOR_PLAY',
  'ART_AND_CRAFT',
  'CELEBRATION',
  'SPORTS',
  'GENERAL',
] as const;

const milestoneStatuses = ['EMERGING', 'PROGRESSING', 'ACHIEVED', 'NEEDS_SUPPORT'] as const;
const deliveryStatuses = ['QUEUED', 'SENT', 'FAILED', 'SKIPPED'] as const;

type ActivitySection = (typeof activitySections)[number];
type ActivityCategory = (typeof activityCategories)[number];
type MilestoneStatus = (typeof milestoneStatuses)[number];

type SectionSummaryForUi = {
  id: string;
  name: string;
  classId?: string | null;
  class?: { id: string } | null;
};

type CreatePostState = {
  classId: string;
  sectionId: string;
  title: string;
  caption: string;
  category: ActivityCategory;
  studentIds: string[];
};

type MoodLogState = {
  classId: string;
  sectionId: string;
  studentId: string;
  mood: string;
  note: string;
  logDate: string;
};

type MilestoneState = {
  classId: string;
  sectionId: string;
  studentId: string;
  domain: string;
  milestone: string;
  status: MilestoneStatus;
  observationNote: string;
  photoObjectKey: string;
  observedAt: string;
};

type ReactionMutation = ReturnType<
  typeof useMutation<
    ActivityReaction,
    Error,
    {
      postId: string;
      reaction: string;
      guardianId?: string;
      studentId?: string;
    }
  >
>;

export function ActivityFeedForm() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<ActivitySection>('Create Post');
  const [post, setPost] = useState<CreatePostState>({
    classId: '',
    sectionId: '',
    title: 'Learning moment',
    caption: 'Students explored a hands-on classroom activity today.',
    category: 'LEARNING',
    studentIds: [],
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileWarning, setFileWarning] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState<string | null>(null);
  const [moodLog, setMoodLog] = useState<MoodLogState>({
    classId: '',
    sectionId: '',
    studentId: '',
    mood: 'ENGAGED',
    note: '',
    logDate: today,
  });
  const [milestone, setMilestone] = useState<MilestoneState>({
    classId: '',
    sectionId: '',
    studentId: '',
    domain: 'Motor skills',
    milestone: 'Uses classroom materials independently',
    status: 'PROGRESSING',
    observationNote: '',
    photoObjectKey: '',
    observedAt: today,
  });
  const [milestoneFilters, setMilestoneFilters] = useState({
    studentId: '',
    month: today.slice(0, 7),
  });

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });
  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: api.listSections,
  });
  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: api.listStudents,
  });
  const postsQuery = useQuery({
    queryKey: ['activity-posts'],
    queryFn: api.listActivityPosts,
  });
  const moodLogsQuery = useQuery({
    queryKey: ['mood-logs'],
    queryFn: api.listMoodLogs,
  });
  const milestonesQuery = useQuery({
    queryKey: ['developmental-milestones', milestoneFilters],
    queryFn: () =>
      api.listDevelopmentalMilestones({
        studentId: milestoneFilters.studentId || null,
        month: milestoneFilters.month || null,
      }),
  });
  const deliveriesQuery = useQuery({
    queryKey: ['notification-deliveries'],
    queryFn: api.listNotificationDeliveries,
  });

  useEffect(() => {
    const firstClass = classesQuery.data?.[0];

    if (firstClass) {
      setPost((current) => (current.classId ? current : { ...current, classId: firstClass.id }));
      setMoodLog((current) => (current.classId ? current : { ...current, classId: firstClass.id }));
      setMilestone((current) => (current.classId ? current : { ...current, classId: firstClass.id }));
    }
  }, [classesQuery.data]);

  const classes = classesQuery.data ?? [];
  const sections = (sectionsQuery.data ?? []) as SectionSummaryForUi[];
  const students = studentsQuery.data ?? [];
  const postSections = filterSectionsForClass(sections, post.classId);
  const moodSections = filterSectionsForClass(sections, moodLog.classId);
  const milestoneSections = filterSectionsForClass(sections, milestone.classId);
  const classStudents = filterStudentsForClass(students, post.classId);
  const visiblePostStudents = filterStudentsForSectionWherePossible(classStudents, post.sectionId);
  const moodStudents = filterStudentsForSectionWherePossible(
    filterStudentsForClass(students, moodLog.classId),
    moodLog.sectionId,
  );
  const milestoneStudents = filterStudentsForSectionWherePossible(
    filterStudentsForClass(students, milestone.classId),
    milestone.sectionId,
  );
  const selectedPostStudents = visiblePostStudents.filter((student) =>
    post.studentIds.includes(student.id),
  );
  const activityDeliveries = (deliveriesQuery.data ?? []).filter(
    (delivery) => delivery.sourceType === 'activity_post',
  );

  const postMutation = useMutation({
    mutationFn: api.createActivityPost,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['activity-posts'] });
      void queryClient.invalidateQueries({ queryKey: ['notification-deliveries'] });
      setSelectedFiles([]);
      setFileWarning(null);
      setPostSuccess('Activity posted. Guardian notifications queued.');
      setPost((current) => ({ ...current, studentIds: [] }));
      setActiveSection('Feed Preview');
    },
  });
  const moodMutation = useMutation({
    mutationFn: api.createMoodLog,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['mood-logs'] }),
  });
  const reactionMutation = useMutation({
    mutationFn: ({
      postId,
      reaction,
      guardianId,
      studentId,
    }: {
      postId: string;
      reaction: string;
      guardianId?: string;
      studentId?: string;
    }) =>
      api.createActivityReaction(postId, {
        reaction,
        guardianId,
        studentId,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['activity-posts'] }),
  });
  const milestoneMutation = useMutation({
    mutationFn: api.createDevelopmentalMilestone,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['developmental-milestones'] }),
  });

  function updateFiles(files: FileList | null) {
    const nextFiles = Array.from(files ?? []);
    const firstNonImage = nextFiles.find((file) => !file.type.startsWith('image/'));
    const firstLargeImage = nextFiles.find((file) => file.size > maxImageBytes);

    setSelectedFiles(nextFiles);

    if (nextFiles.length > 5) {
      setFileWarning('Please attach 1 to 5 images only.');
      return;
    }

    if (firstNonImage) {
      setFileWarning('Activity attachments must be image files.');
      return;
    }

    if (firstLargeImage) {
      setFileWarning('Each image should be 10MB or smaller.');
      return;
    }

    setFileWarning(null);
  }

  async function createPost() {
    if (!post.classId) {
      setFileWarning('Select a class before publishing.');
      return;
    }

    if (post.caption.trim().length < 2) {
      setFileWarning('Caption is required before publishing.');
      return;
    }

    if (selectedFiles.length === 0 || selectedFiles.length > 5) {
      setFileWarning('Please attach 1 to 5 images only.');
      return;
    }

    if (selectedFiles.some((file) => !file.type.startsWith('image/'))) {
      setFileWarning('Activity attachments must be image files.');
      return;
    }

    if (selectedFiles.some((file) => file.size > maxImageBytes)) {
      setFileWarning('Each image should be 10MB or smaller.');
      return;
    }

    const attachments = await filesToBase64Payloads(selectedFiles);

    postMutation.mutate({
      ...post,
      title: post.title.trim(),
      caption: post.caption.trim(),
      sectionId: post.sectionId || null,
      audienceType: post.studentIds.length > 0 ? 'ALL' : post.sectionId ? 'SECTION' : 'CLASS',
      attachments,
    });
  }

  function toggleStudent(studentId: string) {
    setPost((current) => ({
      ...current,
      studentIds: current.studentIds.includes(studentId)
        ? current.studentIds.filter((id) => id !== studentId)
        : [...current.studentIds, studentId],
    }));
  }

  const posts = postsQuery.data ?? [];
  const moodLogs = moodLogsQuery.data ?? [];
  const milestones = milestonesQuery.data ?? [];
  const activeMeta = activitySectionMeta[activeSection];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-[var(--line)] bg-gradient-to-br from-gray-950 via-slate-900 to-emerald-950 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-36 w-36 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 ring-1 ring-white/15">
              {activeMeta.badge}
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              {activeMeta.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              {activeMeta.description}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[560px]">
            <ActivityMetricCard
              label="Published Posts"
              value={String(posts.length)}
              tone="success"
            />
            <ActivityMetricCard
              label="Mood Logs"
              value={String(moodLogs.length)}
              tone="info"
            />
            <ActivityMetricCard
              label="Milestones"
              value={String(milestones.length)}
              tone="warning"
            />
          </div>
        </div>
      </section>

      <section className="sticky top-4 z-20 rounded-[30px] border border-[var(--line)] bg-white/85 p-3 shadow-sm backdrop-blur-xl">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Activity feed sections">
          {activitySections.map((section) => {
            const isActive = activeSection === section;

            return (
              <button
                key={section}
                type="button"
                className={`group min-h-12 whitespace-nowrap rounded-2xl border px-4 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'border-gray-950 bg-gray-950 text-white shadow-md shadow-gray-900/20'
                    : 'border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-950'
                }`}
                onClick={() => setActiveSection(section)}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isActive ? 'bg-emerald-400' : 'bg-gray-300 group-hover:bg-gray-500'
                    }`}
                  />
                  {section}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {activeSection === 'Create Post' ? (
        <CreatePostSection
          classes={classes}
          classesLoading={classesQuery.isLoading}
          post={post}
          setPost={setPost}
          sections={postSections}
          students={visiblePostStudents}
          selectedStudents={selectedPostStudents}
          selectedFiles={selectedFiles}
          fileWarning={fileWarning}
          postSuccess={postSuccess}
          mutationError={postMutation.isError ? postMutation.error.message : null}
          isPending={postMutation.isPending}
          updateFiles={updateFiles}
          toggleStudent={toggleStudent}
          createPost={createPost}
        />
      ) : null}

      {activeSection === 'Feed Preview' ? (
        <FeedPreviewSection
          posts={posts}
          isLoading={postsQuery.isLoading}
          students={students}
          reactionMutation={reactionMutation}
        />
      ) : null}

      {activeSection === 'Mood Logs' ? (
        <MoodLogsSection
          classes={classes}
          moodLog={moodLog}
          setMoodLog={setMoodLog}
          sections={moodSections}
          students={moodStudents}
          logs={moodLogs}
          logsLoading={moodLogsQuery.isLoading}
          mutationError={moodMutation.isError ? moodMutation.error.message : null}
          isPending={moodMutation.isPending}
          saveMoodLog={() =>
            moodMutation.mutate({
              ...moodLog,
              sectionId: moodLog.sectionId || null,
              studentId: moodLog.studentId || null,
              logDate: new Date(moodLog.logDate).toISOString(),
            })
          }
        />
      ) : null}

      {activeSection === 'Milestones' ? (
        <MilestonesSection
          classes={classes}
          milestone={milestone}
          setMilestone={setMilestone}
          sections={milestoneSections}
          students={milestoneStudents}
          allStudents={students}
          filters={milestoneFilters}
          setFilters={setMilestoneFilters}
          milestones={milestones}
          milestonesLoading={milestonesQuery.isLoading}
          mutationError={milestoneMutation.isError ? milestoneMutation.error.message : null}
          isPending={milestoneMutation.isPending}
          saveMilestone={() =>
            milestoneMutation.mutate({
              ...milestone,
              sectionId: milestone.sectionId || null,
              observationNote: milestone.observationNote || null,
              photoObjectKey: milestone.photoObjectKey || null,
              observedAt: new Date(milestone.observedAt).toISOString(),
            })
          }
        />
      ) : null}

      {activeSection === 'Delivery Records' ? (
        <DeliveryRecordsSection
          deliveries={activityDeliveries}
          isLoading={deliveriesQuery.isLoading}
        />
      ) : null}
    </div>
  );
}

function CreatePostSection({
  classes,
  classesLoading,
  post,
  setPost,
  sections,
  students,
  selectedStudents,
  selectedFiles,
  fileWarning,
  postSuccess,
  mutationError,
  isPending,
  updateFiles,
  toggleStudent,
  createPost,
}: {
  classes: Array<{ id: string; name: string }>;
  classesLoading: boolean;
  post: CreatePostState;
  setPost: Dispatch<SetStateAction<CreatePostState>>;
  sections: SectionSummaryForUi[];
  students: StudentProfile[];
  selectedStudents: StudentProfile[];
  selectedFiles: File[];
  fileWarning: string | null;
  postSuccess: string | null;
  mutationError: string | null;
  isPending: boolean;
  updateFiles: (files: FileList | null) => void;
  toggleStudent: (studentId: string) => void;
  createPost: () => void;
}) {
  const setupMissing = !classesLoading && classes.length === 0;
  const audienceLabel = post.studentIds.length
    ? `${post.studentIds.length} specific student${post.studentIds.length === 1 ? '' : 's'}`
    : post.sectionId
      ? 'Selected section'
      : 'Whole class';

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
      <div className="shell-card rounded-[30px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="label">Activity Composer</p>
            <h2 className="mt-2 text-xl font-bold text-gray-950">Create classroom moment</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Guardians will be notified through SchoolOS notifications after publish.
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
            AI captions later
          </span>
        </div>

        {setupMissing ? (
          <EmptyState
            title="Setup required"
            body="Create at least one class before publishing activity posts."
          />
        ) : (
          <div className="mt-5 grid gap-5">
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="label mb-2 block">Class</span>
                <select
                  value={post.classId}
                  onChange={(event) =>
                    setPost((current) => ({
                      ...current,
                      classId: event.target.value,
                      sectionId: '',
                      studentIds: [],
                    }))
                  }
                  className="min-h-11"
                >
                  <option value="">Select class</option>
                  {classes.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label mb-2 block">Section</span>
                <select
                  value={post.sectionId}
                  onChange={(event) =>
                    setPost((current) => ({
                      ...current,
                      sectionId: event.target.value,
                      studentIds: [],
                    }))
                  }
                  className="min-h-11"
                >
                  <option value="">Whole class</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-3xl border border-[var(--line)] bg-white/80 p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="label">Audience</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Choose no students for whole class/section, or tag specific children.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {post.studentIds.length} selected
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {students.length > 0 ? (
                  students.map((student) => {
                    const selected = post.studentIds.includes(student.id);

                    return (
                      <button
                        key={student.id}
                        type="button"
                        className={`min-h-11 rounded-full border px-3 text-xs font-semibold transition-all hover:-translate-y-0.5 ${
                          selected
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                            : 'border-[var(--line)] bg-white text-gray-700 hover:border-emerald-400 hover:bg-emerald-50'
                        }`}
                        onClick={() => toggleStudent(student.id)}
                      >
                        {studentDisplayName(student)}
                      </button>
                    );
                  })
                ) : (
                  <p className="text-sm text-[var(--muted)]">No students found for this class.</p>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[220px_1fr]">
              <label>
                <span className="label mb-2 block">Category</span>
                <select
                  value={post.category}
                  onChange={(event) =>
                    setPost((current) => ({
                      ...current,
                      category: event.target.value as ActivityCategory,
                    }))
                  }
                  className="min-h-11"
                >
                  {activityCategories.map((category) => (
                    <option key={category} value={category}>
                      {formatEnumLabel(category)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label mb-2 block">Title</span>
                <input
                  value={post.title}
                  onChange={(event) =>
                    setPost((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Post title"
                  className="min-h-11"
                />
              </label>
            </div>

            <label>
              <span className="label mb-2 block">Caption</span>
              <textarea
                rows={4}
                value={post.caption}
                onChange={(event) =>
                  setPost((current) => ({ ...current, caption: event.target.value }))
                }
                placeholder="What happened in class today?"
              />
            </label>

            <div>
              <label>
                <span className="label mb-2 block">Photos</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => updateFiles(event.target.files)}
                  className="min-h-11"
                />
              </label>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Attach 1 to 5 images. Files stay private; permanent public URLs are not shown.
              </p>
              {selectedFiles.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {selectedFiles.map((file) => (
                    <div
                      key={`${file.name}-${file.size}`}
                      className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm shadow-sm"
                    >
                      <span className="font-semibold">{file.name}</span>
                      <span className="text-[var(--muted)]"> / {formatFileSize(file.size)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {fileWarning ? <InlineMessage tone="error" message={fileWarning} /> : null}
            {mutationError ? <InlineMessage tone="error" message={mutationError} /> : null}
            {postSuccess ? <InlineMessage tone="success" message={postSuccess} /> : null}

            <button
              type="button"
              className="min-h-12 rounded-2xl bg-gradient-to-r from-gray-950 to-gray-800 px-5 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                !post.classId ||
                post.caption.trim().length < 2 ||
                selectedFiles.length === 0 ||
                selectedFiles.length > 5 ||
                Boolean(fileWarning) ||
                isPending
              }
              onClick={() => void createPost()}
            >
              {isPending ? 'Publishing...' : 'Publish activity post'}
            </button>
          </div>
        )}
      </div>

      <ReviewPanel
        audienceLabel={audienceLabel}
        selectedClassName={classes.find((item) => item.id === post.classId)?.name ?? 'Not selected'}
        selectedSectionName={sections.find((item) => item.id === post.sectionId)?.name ?? 'Whole class'}
        selectedStudents={selectedStudents}
        photoCount={selectedFiles.length}
        category={post.category}
      />
    </section>
  );
}

function ReviewPanel({
  audienceLabel,
  selectedClassName,
  selectedSectionName,
  selectedStudents,
  photoCount,
  category,
}: {
  audienceLabel: string;
  selectedClassName: string;
  selectedSectionName: string;
  selectedStudents: StudentProfile[];
  photoCount: number;
  category: string;
}) {
  return (
    <section className="shell-card rounded-[30px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm xl:sticky xl:top-28 xl:self-start">
      <p className="label">Review Before Publish</p>
      <div className="mt-4 grid gap-3">
        <Fact label="Audience" value={audienceLabel} />
        <Fact label="Class / Section" value={`${selectedClassName} / ${selectedSectionName}`} />
        <Fact label="Category" value={formatEnumLabel(category)} />
        <Fact label="Photo Count" value={`${photoCount} image${photoCount === 1 ? '' : 's'}`} />
      </div>
      <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <p className="font-semibold text-gray-950">Tagged students</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {selectedStudents.length > 0
            ? selectedStudents.map(studentDisplayName).join(', ')
            : 'No specific students tagged; audience follows class/section selection.'}
        </p>
      </div>
      <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
        Guardians will be notified through SchoolOS notifications.
      </p>
    </section>
  );
}

function FeedPreviewSection({
  posts,
  isLoading,
  students,
  reactionMutation,
}: {
  posts: ActivityPost[];
  isLoading: boolean;
  students: StudentProfile[];
  reactionMutation: ReactionMutation;
}) {
  return (
    <section className="shell-card rounded-[30px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
      <p className="label">Feed Preview</p>
      <h2 className="mt-2 text-xl font-bold text-gray-950">Recent classroom moments</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {isLoading ? (
          <SkeletonList />
        ) : posts.length > 0 ? (
          posts.slice(0, 8).map((post) => (
            <PostCard
              key={post.id}
              post={post}
              students={students}
              reactionMutation={reactionMutation}
            />
          ))
        ) : (
          <EmptyState
            title="No activity posts yet"
            body="No activity posts yet. Create the first classroom moment."
          />
        )}
      </div>
    </section>
  );
}

function PostCard({
  post,
  students,
  reactionMutation,
}: {
  post: ActivityPost;
  students: StudentProfile[];
  reactionMutation: ReactionMutation;
}) {
  const taggedStudentIds = post.studentTags.map((tag) => tag.studentId);
  const actor = findReactionActor(students, taggedStudentIds);

  return (
    <article className="rounded-[26px] border border-[var(--line)] bg-white/75 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bold text-gray-950">{post.title}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {post.publishedAt ? formatDateTime(post.publishedAt) : 'Draft timestamp unavailable'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{formatEnumLabel(post.category)}</Badge>
          <Badge>{formatEnumLabel(post.audienceType)}</Badge>
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-700">{post.caption ?? post.body ?? 'No caption'}</p>

      <div className="mt-4 grid gap-3">
        {post.attachments.length > 0 ? (
          post.attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="group relative overflow-hidden rounded-2xl border border-[var(--line)] bg-gray-50 transition hover:shadow-md"
            >
              {attachment.previewUrl ? (
                <div className="aspect-[16/10] w-full overflow-hidden">
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.fileName}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-white">
                    <p className="text-xs font-medium truncate">{attachment.fileName}</p>
                    <p className="text-[10px] opacity-80">{formatFileSize(attachment.sizeBytes)}</p>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 text-sm">
                  <span className="font-semibold">Private media</span>
                  <span className="text-[var(--muted)]">
                    {' '}
                    / {attachment.fileName} / {formatFileSize(attachment.sizeBytes)}
                  </span>
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">No attachments.</p>
        )}
      </div>

      {post.studentTags.length > 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          Tagged:{' '}
          {post.studentTags
            .map((tag) =>
              tag.student
                ? `${tag.student.firstNameEn} ${tag.student.lastNameEn}`.trim()
                : tag.studentId,
            )
            .join(', ')}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(['HEART', 'CLAP', 'STAR'] as const).map((reaction) => {
          const count = post.reactions?.filter((entry) => entry.reaction === reaction).length ?? 0;

          return (
            <button
              key={reaction}
              type="button"
              className="min-h-10 rounded-full border border-[var(--line)] px-3 text-xs font-semibold disabled:opacity-50"
              disabled={!actor.guardianId && !actor.studentId}
              title={
                actor.guardianId || actor.studentId
                  ? 'Uses linked guardian/student context when available.'
                  : 'No linked guardian/student context available for reactions.'
              }
              onClick={() =>
                reactionMutation.mutate({
                  postId: post.id,
                  reaction,
                  guardianId: actor.guardianId,
                  studentId: actor.studentId,
                })
              }
            >
              {formatEnumLabel(reaction)} {count}
            </button>
          );
        })}
      </div>
    </article>
  );
}

function MoodLogsSection({
  classes,
  moodLog,
  setMoodLog,
  sections,
  students,
  logs,
  logsLoading,
  mutationError,
  isPending,
  saveMoodLog,
}: {
  classes: Array<{ id: string; name: string }>;
  moodLog: MoodLogState;
  setMoodLog: Dispatch<SetStateAction<MoodLogState>>;
  sections: SectionSummaryForUi[];
  students: StudentProfile[];
  logs: MoodLog[];
  logsLoading: boolean;
  mutationError: string | null;
  isPending: boolean;
  saveMoodLog: () => void;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="shell-card rounded-[30px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <p className="label">Daily Mood Log</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Record whole-class mood or a child-specific observation for parent context.
        </p>
        <div className="mt-5 grid gap-3">
          <select
            value={moodLog.classId}
            onChange={(event) =>
              setMoodLog((current) => ({
                ...current,
                classId: event.target.value,
                sectionId: '',
                studentId: '',
              }))
            }
          >
            <option value="">Select class</option>
            {classes.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.name}
              </option>
            ))}
          </select>
          <select
            value={moodLog.sectionId}
            onChange={(event) =>
              setMoodLog((current) => ({ ...current, sectionId: event.target.value, studentId: '' }))
            }
          >
            <option value="">Whole class</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
          <select
            value={moodLog.studentId}
            onChange={(event) => setMoodLog((current) => ({ ...current, studentId: event.target.value }))}
          >
            <option value="">Whole-class mood option</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {studentDisplayName(student)}
              </option>
            ))}
          </select>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={moodLog.mood}
              onChange={(event) => setMoodLog((current) => ({ ...current, mood: event.target.value }))}
            >
              <option value="CALM">Calm</option>
              <option value="ENGAGED">Engaged</option>
              <option value="EXCITED">Excited</option>
              <option value="UNSETTLED">Unsettled</option>
              <option value="TIRED">Tired</option>
            </select>
            <input
              type="date"
              value={moodLog.logDate}
              onChange={(event) => setMoodLog((current) => ({ ...current, logDate: event.target.value }))}
            />
          </div>
          <textarea
            rows={4}
            value={moodLog.note}
            onChange={(event) => setMoodLog((current) => ({ ...current, note: event.target.value }))}
            placeholder="Optional note"
          />
          {mutationError ? <InlineMessage tone="error" message={mutationError} /> : null}
          <button
            type="button"
            className="min-h-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!moodLog.classId || isPending}
            onClick={saveMoodLog}
          >
            {isPending ? 'Saving...' : 'Save mood log'}
          </button>
        </div>
      </div>

      <HistoryCard title="Mood History" isLoading={logsLoading}>
        {logs.length > 0 ? (
          logs.slice(0, 8).map((item) => (
            <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <p className="font-semibold">
                {formatEnumLabel(item.mood)}
                {item.student
                  ? ` / ${item.student.firstNameEn} ${item.student.lastNameEn}`
                  : ' / Class mood'}
              </p>
              <p className="text-sm text-[var(--muted)]">
                {formatDate(item.logDate)}
                {item.note ? ` / ${item.note}` : ''}
              </p>
            </div>
          ))
        ) : (
          <EmptyState title="No mood logs yet" body="Mood history will appear after teachers save logs." />
        )}
      </HistoryCard>
    </section>
  );
}

function MilestonesSection({
  classes,
  milestone,
  setMilestone,
  sections,
  students,
  allStudents,
  filters,
  setFilters,
  milestones,
  milestonesLoading,
  mutationError,
  isPending,
  saveMilestone,
}: {
  classes: Array<{ id: string; name: string }>;
  milestone: MilestoneState;
  setMilestone: Dispatch<SetStateAction<MilestoneState>>;
  sections: SectionSummaryForUi[];
  students: StudentProfile[];
  allStudents: StudentProfile[];
  filters: { studentId: string; month: string };
  setFilters: Dispatch<SetStateAction<{ studentId: string; month: string }>>;
  milestones: DevelopmentalMilestone[];
  milestonesLoading: boolean;
  mutationError: string | null;
  isPending: boolean;
  saveMilestone: () => void;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="shell-card rounded-[30px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <p className="label">Montessori / ECE Milestones</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Track developmental observations without public photo URLs.
        </p>
        <div className="mt-5 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={milestone.classId}
              onChange={(event) =>
                setMilestone((current) => ({
                  ...current,
                  classId: event.target.value,
                  sectionId: '',
                  studentId: '',
                }))
              }
            >
              <option value="">Select class</option>
              {classes.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
            <select
              value={milestone.sectionId}
              onChange={(event) =>
                setMilestone((current) => ({
                  ...current,
                  sectionId: event.target.value,
                  studentId: '',
                }))
              }
            >
              <option value="">Whole class</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>
          <select
            value={milestone.studentId}
            onChange={(event) =>
              setMilestone((current) => ({ ...current, studentId: event.target.value }))
            }
          >
            <option value="">Select child</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {studentDisplayName(student)}
              </option>
            ))}
          </select>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={milestone.domain}
              onChange={(event) =>
                setMilestone((current) => ({ ...current, domain: event.target.value }))
              }
              placeholder="Domain"
            />
            <select
              value={milestone.status}
              onChange={(event) =>
                setMilestone((current) => ({
                  ...current,
                  status: event.target.value as MilestoneStatus,
                }))
              }
            >
              {milestoneStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatEnumLabel(status)}
                </option>
              ))}
            </select>
          </div>
          <input
            value={milestone.milestone}
            onChange={(event) =>
              setMilestone((current) => ({ ...current, milestone: event.target.value }))
            }
            placeholder="Milestone"
          />
          <textarea
            rows={3}
            value={milestone.observationNote}
            onChange={(event) =>
              setMilestone((current) => ({ ...current, observationNote: event.target.value }))
            }
            placeholder="Observation note"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={milestone.photoObjectKey}
              onChange={(event) =>
                setMilestone((current) => ({ ...current, photoObjectKey: event.target.value }))
              }
              placeholder="Optional private photo object reference"
            />
            <input
              type="date"
              value={milestone.observedAt}
              onChange={(event) =>
                setMilestone((current) => ({ ...current, observedAt: event.target.value }))
              }
            />
          </div>
          {mutationError ? <InlineMessage tone="error" message={mutationError} /> : null}
          <button
            type="button"
            className="min-h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!milestone.classId || !milestone.studentId || isPending}
            onClick={saveMilestone}
          >
            {isPending ? 'Saving...' : 'Save milestone'}
          </button>
        </div>
      </div>

      <HistoryCard title="Milestone Archive" isLoading={milestonesLoading}>
        <div className="grid gap-3 md:grid-cols-2">
          <select
            value={filters.studentId}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                studentId: event.target.value,
              }))
            }
          >
            <option value="">All children</option>
            {allStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {studentDisplayName(student)}
              </option>
            ))}
          </select>
          <input
            type="month"
            value={filters.month}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                month: event.target.value,
              }))
            }
          />
        </div>
        <div className="mt-4 grid gap-3">
          {milestones.length > 0 ? (
            milestones.slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <p className="font-semibold">{item.milestone}</p>
                <p className="text-sm text-[var(--muted)]">
                  {item.domain} / {formatEnumLabel(item.status)} / {formatDate(item.observedAt)}
                </p>
                {item.observationNote ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">{item.observationNote}</p>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyState title="No milestones" body="No milestones for this filter yet." />
          )}
        </div>
      </HistoryCard>
    </section>
  );
}

function DeliveryRecordsSection({
  deliveries,
  isLoading,
}: {
  deliveries: NotificationDelivery[];
  isLoading: boolean;
}) {
  return (
    <section className="shell-card rounded-[30px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
      <p className="label">Activity Delivery Records</p>
      <h2 className="mt-2 text-xl font-bold text-gray-950">Guardian notification delivery</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {isLoading ? (
          <SkeletonList />
        ) : deliveries.length > 0 ? (
          deliveries.slice(0, 10).map((delivery) => (
            <div key={delivery.id} className="rounded-2xl border border-[var(--line)] bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{delivery.title}</p>
                <StatusBadge status={delivery.status} />
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {delivery.channel} / {delivery.destination ?? 'no destination'} /{' '}
                {formatDateTime(delivery.createdAt)}
              </p>
            </div>
          ))
        ) : (
          <EmptyState
            title="No activity delivery records"
            body="No activity delivery records yet."
          />
        )}
      </div>
    </section>
  );
}

function HistoryCard({
  title,
  isLoading,
  children,
}: {
  title: string;
  isLoading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="shell-card rounded-[30px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
      <p className="label mb-4">{title}</p>
      {isLoading ? <SkeletonList /> : children}
    </section>
  );
}

function ActivityMetricCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'warning' | 'info';
}) {
  const toneClass = {
    neutral: 'bg-white/10 text-white ring-white/15',
    success: 'bg-emerald-400/15 text-emerald-100 ring-emerald-300/20',
    warning: 'bg-amber-400/15 text-amber-100 ring-amber-300/20',
    info: 'bg-sky-400/15 text-sky-100 ring-sky-300/20',
  }[tone];

  return (
    <div className={`rounded-2xl p-4 ring-1 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="label">{label}</p>
      <p className="mt-1 font-semibold text-gray-950">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--line)] bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusTone = deliveryStatuses.includes(status as (typeof deliveryStatuses)[number])
    ? status
    : 'QUEUED';
  const className =
    statusTone === 'SENT'
      ? 'bg-emerald-50 text-emerald-700'
      : statusTone === 'FAILED'
        ? 'bg-red-50 text-red-700'
        : statusTone === 'SKIPPED'
          ? 'bg-gray-100 text-gray-700'
          : 'bg-amber-50 text-amber-700';

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {status}
    </span>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-gray-50/80 p-5 text-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg shadow-sm">
        ✦
      </div>
      <p className="font-semibold text-gray-950">{title}</p>
      <p className="mt-1 text-[var(--muted)]">{body}</p>
    </div>
  );
}

function InlineMessage({ tone, message }: { tone: 'success' | 'error'; message: string }) {
  return (
    <p
      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
        tone === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {message}
    </p>
  );
}

function SkeletonList() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-24 animate-pulse rounded-2xl bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
      ))}
    </div>
  );
}

function filterSectionsForClass(sections: SectionSummaryForUi[], classId: string) {
  return sections.filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !classId || sectionClassId === classId;
  });
}

function filterStudentsForClass(students: StudentProfile[], classId: string) {
  return students.filter((student) => !classId || student.class?.id === classId);
}

function filterStudentsForSectionWherePossible(students: StudentProfile[], sectionId: string) {
  if (!sectionId) {
    return students;
  }

  return students.filter((student) => {
    const candidate = student as unknown as {
      class?: { id: string };
      sectionId?: string | null;
      section?: string | { id?: string | null } | null;
    };
    const maybeStudentSectionId =
      candidate.sectionId ??
      (typeof candidate.section === 'object' && candidate.section !== null
        ? candidate.section.id
        : null);

    return maybeStudentSectionId ? maybeStudentSectionId === sectionId : true;
  });
}

function findReactionActor(students: StudentProfile[], taggedStudentIds: string[]) {
  const taggedStudent = students.find((student) => taggedStudentIds.includes(student.id));
  const fallbackStudent = taggedStudent ?? students[0];
  const guardianId = fallbackStudent?.guardians?.[0]?.id;

  return {
    guardianId,
    studentId: guardianId ? undefined : fallbackStudent?.id,
  };
}

function studentDisplayName(student: StudentProfile) {
  return (
    student.fullNameEn ??
    `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim() ??
    student.studentSystemId
  );
}

function formatEnumLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024)).toLocaleString()} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-NP', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-NP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
