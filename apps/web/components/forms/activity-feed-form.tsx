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
import { cn } from '../../lib/utils';
import { 
  StatCard 
} from '../ui/stat-card';
import { 
  Tabs, 
  TabsList, 
  TabsTrigger, 
  TabsContent 
} from '../ui/tabs';
import { Badge } from '../ui/badge';
import { EmptyState } from '../ui/empty-state';
import { LoadingState } from '../ui/loading-state';
import { 
  FormField, 
  Input, 
  Select, 
  TextArea 
} from '../ui/form-field';
import { 
  Heart, 
  Sparkles, 
  Star, 
  Camera, 
  History, 
  Target, 
  Truck, 
  Smile 
} from 'lucide-react';

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
    icon: any;
  }
> = {
  'Create Post': {
    title: 'Activity Feed',
    description: 'Capture classroom moments, tag students, and notify guardians with private media.',
    icon: Camera,
  },
  'Feed Preview': {
    title: 'Feed Preview',
    description: 'Review recently published classroom posts, attachments, tags, and reactions.',
    icon: History,
  },
  'Mood Logs': {
    title: 'Mood Logs',
    description: 'Record daily emotional context for whole classes, sections, or individual children.',
    icon: Smile,
  },
  Milestones: {
    title: 'Montessori / ECE Milestones',
    description: 'Track Montessori and ECE observations with clear child-level progress evidence.',
    icon: Target,
  },
  'Delivery Records': {
    title: 'Delivery Records',
    description: 'Audit guardian notification delivery records generated from activity posts.',
    icon: Truck,
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
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: () => api.listStudents() });
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
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-slate-900 p-8 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-[100px]" />
        <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-blue-500/10 blur-[100px]" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/20">
                <activeMeta.icon className="h-6 w-6 text-emerald-400" />
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl uppercase italic">
                {activeMeta.title}
              </h1>
            </div>
            <p className="mt-4 text-lg font-medium leading-relaxed text-slate-300">
              {activeMeta.description}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:w-[600px]">
            <StatCard
              title="Posts"
              value={posts.length}
              className="bg-white/5 border-white/10"
            />
            <StatCard
              title="Mood Logs"
              value={moodLogs.length}
              className="bg-white/5 border-white/10"
            />
            <StatCard
              title="Milestones"
              value={milestones.length}
              className="bg-white/5 border-white/10"
            />
          </div>
        </div>
      </section>

      <Tabs 
        value={activeSection} 
        onValueChange={(val) => setActiveSection(val as ActivitySection)} 
        className="space-y-8"
      >
        <TabsList className="bg-slate-100 p-1.5 rounded-[1.5rem] inline-flex h-auto">
          {activitySections.map((section) => (
            <TabsTrigger 
              key={section} 
              value={section}
              className="rounded-[1.2rem] px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 font-black uppercase tracking-widest text-[10px]"
            >
              {section}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="Create Post">
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
        </TabsContent>

        <TabsContent value="Feed Preview">
          <FeedPreviewSection
            posts={posts}
            isLoading={postsQuery.isLoading}
            students={students}
            reactionMutation={reactionMutation}
          />
        </TabsContent>

        <TabsContent value="Mood Logs">
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
        </TabsContent>

        <TabsContent value="Milestones">
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
        </TabsContent>

        <TabsContent value="Delivery Records">
          <DeliveryRecordsSection
            deliveries={activityDeliveries}
            isLoading={deliveriesQuery.isLoading}
          />
        </TabsContent>
      </Tabs>
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
  const audienceLabel = post.studentIds.length
    ? `${post.studentIds.length} specific student${post.studentIds.length === 1 ? '' : 's'}`
    : post.sectionId
      ? 'Selected section'
      : 'Whole class';

  return (
    <div className="grid gap-8 xl:grid-cols-3">
      <div className="xl:col-span-2 space-y-6">
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Create classroom moment</h2>
              <p className="mt-1 text-sm text-slate-500">
                Guardians will be notified through SchoolOS notifications after publish.
              </p>
            </div>
            <Badge variant="outline" className="font-black uppercase tracking-widest text-[10px]">
              AI captions later
            </Badge>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Class">
              <Select
                value={post.classId}
                onChange={(event) =>
                  setPost((current) => ({
                    ...current,
                    classId: event.target.value,
                    sectionId: '',
                    studentIds: [],
                  }))
                }
              >
                <option value="">Select class</option>
                {classes.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Section">
              <Select
                value={post.sectionId}
                onChange={(event) =>
                  setPost((current) => ({
                    ...current,
                    sectionId: event.target.value,
                    studentIds: [],
                  }))
                }
              >
                <option value="">Whole class</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-900 uppercase tracking-widest text-[11px]">Tagged Students</p>
                <p className="mt-1 text-xs text-slate-500">
                  Choose specific children to notify their guardians exclusively.
                </p>
              </div>
              <Badge variant="secondary" className="font-black uppercase tracking-widest text-[10px]">
                {post.studentIds.length} Selected
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              {students.length > 0 ? (
                students.map((student) => {
                  const selected = post.studentIds.includes(student.id);

                  return (
                    <button
                      key={student.id}
                      type="button"
                      className={cn(
                        "h-9 px-4 rounded-full text-[11px] font-black uppercase tracking-widest transition-all",
                        selected
                          ? "bg-slate-900 text-white shadow-md shadow-slate-200"
                          : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
                      )}
                      onClick={() => toggleStudent(student.id)}
                    >
                      {studentDisplayName(student)}
                    </button>
                  );
                })
              ) : (
                <EmptyState 
                  title="No students" 
                  description="No students found for this class/section." 
                  className="bg-white"
                />
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <FormField label="Category">
              <Select
                value={post.category}
                onChange={(event) =>
                  setPost((current) => ({
                    ...current,
                    category: event.target.value as ActivityCategory,
                  }))
                }
              >
                {activityCategories.map((category) => (
                  <option key={category} value={category}>
                    {formatEnumLabel(category)}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Title" className="md:col-span-2">
              <Input
                value={post.title}
                onChange={(event) =>
                  setPost((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Post title"
              />
            </FormField>
          </div>

          <FormField label="Caption">
            <TextArea
              rows={4}
              value={post.caption}
              onChange={(event) =>
                setPost((current) => ({ ...current, caption: event.target.value }))
              }
              placeholder="What happened in class today?"
            />
          </FormField>

          <FormField label="Photos">
            <div className="space-y-4">
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => updateFiles(event.target.files)}
                className="file:bg-slate-100 file:border-0 file:rounded-full file:px-4 file:text-[10px] file:font-black file:uppercase file:tracking-widest"
              />
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Attach 1 to 5 images. Private media stay encrypted.
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
                  Secure previews use signed access; permanent public URLs are not shown.
                </p>
              </div>
              
              {selectedFiles.length > 0 && (
                <div className="grid gap-2">
                  {selectedFiles.map((file) => (
                    <div
                      key={`${file.name}-${file.size}`}
                      className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50"
                    >
                      <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{file.name}</span>
                      <Badge variant="outline" className="text-[10px] font-black uppercase">
                        {formatFileSize(file.size)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FormField>

          <div className="space-y-4 pt-4">
            {fileWarning && <InlineMessage tone="error" message={fileWarning} />}
            {mutationError && <InlineMessage tone="error" message={mutationError} />}
            {postSuccess && <InlineMessage tone="success" message={postSuccess} />}

            <button
              type="button"
              className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-slate-200 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0"
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
              {isPending ? 'Publishing...' : 'Publish Activity Post'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <ReviewPanel
          audienceLabel={audienceLabel}
          selectedClassName={classes.find((item) => item.id === post.classId)?.name ?? 'Not selected'}
          selectedSectionName={sections.find((item) => item.id === post.sectionId)?.name ?? 'Whole class'}
          selectedStudents={selectedStudents}
          photoCount={selectedFiles.length}
          category={post.category}
        />
      </div>
    </div>
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
    <div className="bg-slate-900 p-8 rounded-[2rem] text-white space-y-6 sticky top-28 shadow-2xl">
      <div>
        <h3 className="text-lg font-black uppercase italic tracking-widest text-emerald-400">Review Summary</h3>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-[0.1em] font-bold">Verify before publishing</p>
      </div>

      <div className="space-y-4">
        <Fact label="Audience" value={audienceLabel} />
        <Fact label="Class / Section" value={`${selectedClassName} / ${selectedSectionName}`} />
        <Fact label="Category" value={formatEnumLabel(category)} />
        <Fact label="Photos" value={`${photoCount} image${photoCount === 1 ? '' : 's'}`} />
      </div>

      <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Tagged Students</p>
        <p className="text-xs leading-relaxed font-medium">
          {selectedStudents.length > 0
            ? selectedStudents.map(studentDisplayName).join(', ')
            : 'No specific students tagged; audience follows class/section selection.'}
        </p>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
        <Smile className="h-5 w-5 text-emerald-400 shrink-0" />
        <p className="text-[11px] font-black uppercase tracking-widest leading-tight text-emerald-200">
          Guardians will receive real-time notifications.
        </p>
      </div>
    </div>
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
  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Recent classroom moments</h2>
        <Badge variant="secondary" className="font-black uppercase tracking-widest text-[10px]">
          {posts.length} Posts
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {posts.length > 0 ? (
          posts.slice(0, 12).map((post) => (
            <PostCard
              key={post.id}
              post={post}
              students={students}
              reactionMutation={reactionMutation}
            />
          ))
        ) : (
          <div className="lg:col-span-2 xl:col-span-3">
            <EmptyState
              title="No activity posts yet"
              description="No activity posts yet. Create the first classroom moment."
            />
          </div>
        )}
      </div>
    </div>
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
  const [loadingAttachmentId, setLoadingAttachmentId] = useState<string | null>(null);
  const [errorAttachmentId, setErrorAttachmentId] = useState<string | null>(null);

  const handlePreview = async (attachmentId: string) => {
    try {
      setLoadingAttachmentId(attachmentId);
      setErrorAttachmentId(null);
      await api.previewActivityAttachment(attachmentId);
    } catch (error) {
      setErrorAttachmentId(attachmentId);
    } finally {
      setLoadingAttachmentId(null);
    }
  };

  const handleDownload = async (attachmentId: string, fileName: string) => {
    try {
      setLoadingAttachmentId(attachmentId);
      setErrorAttachmentId(null);
      await api.downloadActivityAttachment(attachmentId, fileName);
    } catch (error) {
      setErrorAttachmentId(attachmentId);
    } finally {
      setLoadingAttachmentId(null);
    }
  };

  const taggedStudentIds = post.studentTags.map((tag) => tag.studentId);
  const actor = findReactionActor(students, taggedStudentIds);

  return (
    <article className="group bg-white rounded-[2rem] border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-black text-slate-900 uppercase tracking-tight leading-tight">{post.title}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {post.publishedAt ? formatDateTime(post.publishedAt) : 'Draft'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest">
              {formatEnumLabel(post.category)}
            </Badge>
          </div>
        </div>

        <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
          {post.caption ?? post.body ?? 'No caption'}
        </p>

        <div className="grid gap-3">
          {post.attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 group/media"
            >
              {attachment.previewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.fileName}
                    className="h-full w-full object-cover transition duration-500 group-hover/media:scale-110"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/media:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                    <button
                      onClick={() => handlePreview(attachment.id)}
                      disabled={loadingAttachmentId === attachment.id}
                      className="h-9 px-4 rounded-full bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleDownload(attachment.id, attachment.fileName)}
                      disabled={loadingAttachmentId === attachment.id}
                      className="h-9 px-4 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
                    >
                      Save
                    </button>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                  <Camera className="h-6 w-6 text-slate-300 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Private Media</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {post.studentTags.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tagged</p>
            <div className="flex flex-wrap gap-1.5">
              {post.studentTags.map((tag) => (
                <span 
                  key={tag.studentId}
                  className="px-2 py-1 rounded-md bg-slate-50 text-slate-600 text-[9px] font-black uppercase tracking-widest border border-slate-100"
                >
                  {tag.student ? `${tag.student.firstNameEn} ${tag.student.lastNameEn}` : 'Student'}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 flex items-center gap-2">
          {(['HEART', 'CLAP', 'STAR'] as const).map((reaction) => {
            const count = post.reactions?.filter((entry) => entry.reaction === reaction).length ?? 0;
            const Icon = reaction === 'HEART' ? Heart : reaction === 'CLAP' ? Sparkles : Star;

            return (
              <button
                key={reaction}
                type="button"
                className="flex items-center gap-1.5 h-9 px-4 rounded-full border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors"
                disabled={!actor.guardianId && !actor.studentId}
                onClick={() =>
                  reactionMutation.mutate({
                    postId: post.id,
                    reaction,
                    guardianId: actor.guardianId,
                    studentId: actor.studentId,
                  })
                }
              >
                <Icon className={cn("h-3.5 w-3.5", count > 0 ? "text-emerald-500 fill-emerald-500" : "text-slate-400")} />
                <span className="text-[11px] font-black text-slate-900">{count}</span>
              </button>
            );
          })}
        </div>
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
    <div className="grid gap-8 xl:grid-cols-2">
      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-8">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Daily Mood Log</h2>
          <p className="mt-1 text-sm text-slate-500">
            Record emotional context for whole-class or child-specific observations.
          </p>
        </div>

        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Class">
              <Select
                value={moodLog.classId}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
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
              </Select>
            </FormField>

            <FormField label="Section">
              <Select
                value={moodLog.sectionId}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                  setMoodLog((current) => ({ ...current, sectionId: event.target.value, studentId: '' }))
                }
              >
                <option value="">Whole class</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Student (Optional)">
            <Select
              value={moodLog.studentId}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setMoodLog((current) => ({ ...current, studentId: event.target.value }))}
            >
              <option value="">Whole-class mood</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {studentDisplayName(student)}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Mood">
              <Select
                value={moodLog.mood}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setMoodLog((current) => ({ ...current, mood: event.target.value }))}
              >
                <option value="CALM">Calm</option>
                <option value="ENGAGED">Engaged</option>
                <option value="EXCITED">Excited</option>
                <option value="UNSETTLED">Unsettled</option>
                <option value="TIRED">Tired</option>
              </Select>
            </FormField>
            <FormField label="Date">
              <Input
                type="date"
                value={moodLog.logDate}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setMoodLog((current) => ({ ...current, logDate: event.target.value }))}
              />
            </FormField>
          </div>

          <FormField label="Observation Note">
            <TextArea
              rows={4}
              value={moodLog.note}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setMoodLog((current) => ({ ...current, logNote: event.target.value }))}
              placeholder="Optional teacher observation..."
            />
          </FormField>

          <div className="space-y-4">
            {mutationError && <InlineMessage tone="error" message={mutationError} />}
            <button
              type="button"
              className="w-full h-14 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-emerald-100 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0"
              disabled={!moodLog.classId || isPending}
              onClick={saveMoodLog}
            >
              {isPending ? 'Saving...' : 'Save Mood Log'}
            </button>
          </div>
        </div>
      </div>

      <HistoryCard title="Mood History" isLoading={logsLoading}>
        {logs.length > 0 ? (
          <div className="grid gap-4">
            {logs.slice(0, 8).map((item) => (
              <div key={item.id} className="p-5 rounded-[1.5rem] bg-white border border-slate-100 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-black text-slate-900 uppercase tracking-tight leading-tight">
                    {formatEnumLabel(item.mood)}
                    <span className="ml-2 text-slate-400 font-bold">/</span>
                    <span className="ml-2 text-slate-600">
                      {item.student
                        ? `${item.student.firstNameEn} ${item.student.lastNameEn}`
                        : 'Whole Class'}
                    </span>
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {formatDate(item.logDate)}
                    {item.note && ` · ${item.note}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No mood logs" description="Mood history will appear here once recorded." />
        )}
      </HistoryCard>
    </div>
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
    <div className="grid gap-8 xl:grid-cols-2">
      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-8">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">ECE Milestones</h2>
          <p className="mt-1 text-sm text-slate-500">
            Track developmental observations without exposing public photo URLs.
          </p>
        </div>

        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Class">
              <Select
                value={milestone.classId}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
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
              </Select>
            </FormField>

            <FormField label="Section">
              <Select
                value={milestone.sectionId}
                onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
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
              </Select>
            </FormField>
          </div>

          <FormField label="Student">
            <Select
              value={milestone.studentId}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setMilestone((current) => ({ ...current, studentId: event.target.value }))
              }
            >
              <option value="">Select child</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {studentDisplayName(student)}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Domain">
              <Input
                value={milestone.domain}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setMilestone((current) => ({ ...current, domain: event.target.value }))
                }
                placeholder="e.g. Cognitive"
              />
            </FormField>
            <FormField label="Status">
              <Select
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
              </Select>
            </FormField>
          </div>

          <FormField label="Milestone Description">
            <Input
              value={milestone.milestone}
              onChange={(event) =>
                setMilestone((current) => ({ ...current, milestone: event.target.value }))
              }
              placeholder="e.g. Recognizing primary colors"
            />
          </FormField>

          <FormField label="Observation Note">
            <TextArea
              rows={3}
              value={milestone.observationNote}
              onChange={(event) =>
                setMilestone((current) => ({ ...current, observationNote: event.target.value }))
              }
              placeholder="Detail your observation..."
            />
          </FormField>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Photo Reference (Optional)">
              <Input
                value={milestone.photoObjectKey}
                onChange={(event) =>
                  setMilestone((current) => ({ ...current, photoObjectKey: event.target.value }))
                }
                placeholder="Private object key"
              />
            </FormField>
            <FormField label="Observed At">
              <Input
                type="date"
                value={milestone.observedAt}
                onChange={(event) =>
                  setMilestone((current) => ({ ...current, observedAt: event.target.value }))
                }
              />
            </FormField>
          </div>

          <div className="space-y-4">
            {mutationError && <InlineMessage tone="error" message={mutationError} />}
            <button
              type="button"
              className="w-full h-14 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-100 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0"
              disabled={!milestone.classId || !milestone.studentId || isPending}
              onClick={saveMilestone}
            >
              {isPending ? 'Saving...' : 'Save Milestone'}
            </button>
          </div>
        </div>
      </div>

      <HistoryCard title="Milestone Archive" isLoading={milestonesLoading}>
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Select
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
          </Select>
          <Input
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

        {milestones.length > 0 ? (
          <div className="grid gap-4">
            {milestones.slice(0, 8).map((item) => (
              <div key={item.id} className="p-5 rounded-[1.5rem] bg-white border border-slate-100 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 uppercase tracking-tight">{item.milestone}</h4>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest">
                    {formatEnumLabel(item.status)}
                  </Badge>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {item.domain} · {formatDate(item.observedAt)}
                </p>
                {item.observationNote && (
                  <p className="text-xs text-slate-600 leading-relaxed italic border-l-2 border-slate-100 pl-4 py-1">
                    {item.observationNote}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No milestones" description="No developmental observations found for these filters." />
        )}
      </HistoryCard>
    </div>
  );
}

function DeliveryRecordsSection({
  deliveries,
  isLoading,
}: {
  deliveries: NotificationDelivery[];
  isLoading: boolean;
}) {
  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Activity Delivery Records</h2>
        <p className="mt-1 text-sm text-slate-500">Audit trail for guardian notification delivery status.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {deliveries.length > 0 ? (
          deliveries.slice(0, 20).map((delivery) => (
            <div key={delivery.id} className="p-5 rounded-[1.5rem] bg-white border border-slate-200 shadow-sm flex items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="font-black text-slate-900 uppercase tracking-tight leading-tight">{delivery.title}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {delivery.channel} · {delivery.destination || 'Direct'} · {formatDateTime(delivery.createdAt)}
                </p>
              </div>
              <StatusBadge status={delivery.status} />
            </div>
          ))
        ) : (
          <div className="md:col-span-2">
            <EmptyState
              title="No delivery records"
              description="Notification history will appear here once activities are published."
            />
          </div>
        )}
      </div>
    </div>
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
    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 shadow-inner">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">{title}</h3>
        {isLoading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />}
      </div>
      {children}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <span className="text-[11px] font-bold text-slate-200">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isSent = status === 'SENT';
  const isFailed = status === 'FAILED';
  const isSkipped = status === 'SKIPPED';

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
      isSent ? "bg-emerald-100 text-emerald-700" :
      isFailed ? "bg-red-100 text-red-700" :
      isSkipped ? "bg-slate-100 text-slate-600" :
      "bg-amber-100 text-amber-700"
    )}>
      {status}
    </span>
  );
}

function InlineMessage({ tone, message }: { tone: 'success' | 'error'; message: string }) {
  return (
    <p
      className={cn(
        "rounded-2xl border px-5 py-4 text-[11px] font-black uppercase tracking-widest leading-relaxed",
        tone === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100'
          : 'border-red-200 bg-red-50 text-red-700 shadow-sm shadow-red-100'
      )}
    >
      {message}
    </p>
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

