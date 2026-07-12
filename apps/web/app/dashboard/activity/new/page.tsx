'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Camera, HelpCircle, Lock, ShieldAlert, X } from 'lucide-react';
import { api } from '../../../../lib/api';
import { filesToBase64Payloads } from '../../../../lib/files';
import { cn } from '../../../../lib/utils';
import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { PageHeader } from '../../../../components/ui/page-header';
import { Badge } from '../../../../components/ui/badge';
import { EmptyState } from '../../../../components/ui/empty-state';
import { LoadingState } from '../../../../components/ui/loading-state';
import { FormField, Input, Select, TextArea } from '../../../../components/ui/form-field';
import type { ActivityAudiencePreview } from '../../../../lib/api/activity';

const activityCategories = [
  'CLASSROOM_LEARNING',
  'ART_AND_CRAFT',
  'MUSIC_AND_DANCE',
  'SPORTS',
  'SCIENCE_AND_PRACTICAL',
  'PROJECT_WORK',
  'EDUCATIONAL_TOUR',
  'HEALTH_AND_HYGIENE',
  'COMPETITION',
  'ASSEMBLY',
  'CLUB_ACTIVITY',
  'COMMUNITY_SERVICE',
  'FESTIVAL_AND_CULTURE',
  'NATIONAL_PROGRAMME',
  'ACHIEVEMENT',
  'PRESCHOOL_ACTIVITY',
  'OTHER',
] as const;

const audienceModes = ['whole', 'students'] as const;
type AudienceMode = (typeof audienceModes)[number];

const categoriesRequiringApproval = new Set(['COMPETITION', 'ACHIEVEMENT']);

const steps = ['Audience & consent', 'Content & media', 'Review & submit'] as const;
type Step = 0 | 1 | 2;
const maxImageBytes = 10 * 1024 * 1024;

const languageOptions = ['ENGLISH', 'NEPALI', 'BOTH'] as const;
const languageLabels: Record<(typeof languageOptions)[number], string> = {
  ENGLISH: 'English',
  NEPALI: 'Nepali',
  BOTH: 'English and Nepali',
};

type ComposerState = {
  classId: string;
  sectionId: string;
  title: string;
  caption: string;
  askAtHome: string;
  activityDate: string;
  parentVisible: boolean;
  language: (typeof languageOptions)[number];
  category: (typeof activityCategories)[number];
  audienceMode: AudienceMode;
  studentIds: string[];
};

type SectionSummaryForUi = { id: string; name: string; classId?: string | null; class?: { id: string } | null };

function newClientSubmissionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `csid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayIsoDate() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export default function ActivityComposerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(0);
  const [post, setPost] = useState<ComposerState>({
    classId: '',
    sectionId: '',
    title: '',
    caption: '',
    askAtHome: '',
    activityDate: todayIsoDate(),
    parentVisible: true,
    language: 'ENGLISH',
    category: 'CLASSROOM_LEARNING',
    audienceMode: 'whole',
    studentIds: [],
  });
  const [files, setFiles] = useState<File[]>([]);
  const [fileWarning, setFileWarning] = useState<string | null>(null);
  const [clientSubmissionId] = useState(newClientSubmissionId);

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const audiencePreviewQuery = useQuery({
    queryKey: ['activity-audience-preview', post.classId, post.sectionId],
    queryFn: () =>
      api.previewActivityAudience({
        classId: post.classId,
        sectionId: post.sectionId || null,
      }),
    enabled: Boolean(post.classId),
  });

  const postMutation = useMutation({
    mutationFn: api.createActivityPost,
    onSuccess: async (created) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['activity-posts'] }),
        queryClient.invalidateQueries({ queryKey: ['activity-gallery'] }),
        queryClient.invalidateQueries({ queryKey: ['activity-moderation-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['parent-activity-posts'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-activity-posts'] }),
      ]);
      router.push(`/dashboard/activity/${created.id}`);
    },
  });

  const classes = classesQuery.data ?? [];
  const sections = (sectionsQuery.data ?? []) as SectionSummaryForUi[];
  const postSections = sections.filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !post.classId || sectionClassId === post.classId;
  });
  const audienceStudents: ActivityAudiencePreview['students'] =
    audiencePreviewQuery.data?.students ?? [];
  const audienceMediaConsent = audiencePreviewQuery.data?.mediaConsent ?? null;
  const selectedStudents = audienceStudents.filter((student) =>
    post.studentIds.includes(student.id),
  );
  const consentBlockedSelected = selectedStudents.filter(
    (student) => !student.mediaConsentGranted,
  );

  function toggleStudent(studentId: string) {
    setPost((current) => ({
      ...current,
      studentIds: current.studentIds.includes(studentId)
        ? current.studentIds.filter((id) => id !== studentId)
        : [...current.studentIds, studentId],
    }));
  }

  function addFiles(fileList: FileList | null) {
    const incoming = Array.from(fileList ?? []);
    const combined = [...files, ...incoming].slice(0, 5);
    setFiles(combined);

    const firstNonImage = combined.find((file) => !file.type.startsWith('image/'));
    const firstLargeImage = combined.find((file) => file.size > maxImageBytes);
    if (combined.length > 5) {
      setFileWarning('Please attach 1 to 5 images only.');
    } else if (firstNonImage) {
      setFileWarning('Activity attachments must be image files.');
    } else if (firstLargeImage) {
      setFileWarning('Each image should be 10MB or smaller.');
    } else {
      setFileWarning(null);
    }
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  function moveFile(index: number, direction: -1 | 1) {
    setFiles((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const audienceValid =
    post.audienceMode === 'whole'
      ? Boolean(post.classId)
      : Boolean(post.classId) &&
        post.studentIds.length > 0 &&
        consentBlockedSelected.length === 0;
  const willRequireApproval =
    post.audienceMode === 'students' ||
    categoriesRequiringApproval.has(post.category);
  const contentValid =
    post.title.trim().length >= 2 &&
    post.caption.trim().length >= 2 &&
    files.length > 0 &&
    files.length <= 5 &&
    !fileWarning;

  async function submit() {
    if (!audienceValid || !contentValid) return;

    const attachments = await filesToBase64Payloads(files);
    postMutation.mutate({
      clientSubmissionId,
      classId: post.classId,
      sectionId: post.sectionId || null,
      title: post.title.trim(),
      caption: post.caption.trim(),
      askAtHome: post.askAtHome.trim() || null,
      activityDate: post.activityDate || undefined,
      parentVisible: post.parentVisible,
      language: post.language,
      category: post.category,
      studentIds: post.audienceMode === 'students' ? post.studentIds : [],
      attachments,
    });
  }

  return (
    <DashboardPageShell>
      <PageHeader
        title="Create activity"
        description="Whole-class and section updates publish immediately. Individually-tagged, achievement, and competition posts go to moderation first."
        actions={
          <button
            type="button"
            onClick={() => router.push('/dashboard/activity')}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to feed
          </button>
        }
      />

      <ol className="flex flex-wrap gap-2">
        {steps.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(index as Step)}
              disabled={index === 1 && !audienceValid}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-black uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                step === index
                  ? 'border-[var(--color-mod-activity-accent)] bg-[var(--color-mod-activity-accent)] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <AudienceStep
          post={post}
          setPost={setPost}
          classes={classes}
          sections={postSections}
          students={audienceStudents}
          mediaConsent={audienceMediaConsent}
          isLoading={audiencePreviewQuery.isLoading}
          toggleStudent={toggleStudent}
          consentBlockedSelected={consentBlockedSelected}
        />
      ) : null}

      {step === 1 ? (
        <ContentStep
          post={post}
          setPost={setPost}
          files={files}
          fileWarning={fileWarning}
          addFiles={addFiles}
          removeFile={removeFile}
          moveFile={moveFile}
        />
      ) : null}

      {step === 2 ? (
        <ReviewStep
          post={post}
          selectedStudents={selectedStudents}
          consentBlockedSelected={consentBlockedSelected}
          className={classes.find((item) => item.id === post.classId)?.name ?? 'Not selected'}
          sectionName={
            postSections.find((item) => item.id === post.sectionId)?.name ?? 'Whole class'
          }
          fileCount={files.length}
          willRequireApproval={willRequireApproval}
          isPending={postMutation.isPending}
          mutationError={postMutation.isError ? postMutation.error.message : null}
          canSubmit={audienceValid && contentValid && !postMutation.isPending}
          onSubmit={() => void submit()}
        />
      ) : null}

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((current) => Math.max(0, current - 1) as Step)}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        {step < 2 ? (
          <button
            type="button"
            disabled={step === 0 ? !audienceValid : !contentValid}
            onClick={() => setStep((current) => Math.min(2, current + 1) as Step)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-activity-accent)] px-5 text-sm font-bold text-white hover:bg-[var(--color-mod-activity-text)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ArrowRight size={16} />
          </button>
        ) : null}
      </div>
    </DashboardPageShell>
  );
}

function AudienceStep({
  post,
  setPost,
  classes,
  sections,
  students,
  mediaConsent,
  isLoading,
  toggleStudent,
  consentBlockedSelected,
}: {
  post: ComposerState;
  setPost: (updater: (current: ComposerState) => ComposerState) => void;
  classes: Array<{ id: string; name: string }>;
  sections: SectionSummaryForUi[];
  students: ActivityAudiencePreview['students'];
  mediaConsent: ActivityAudiencePreview['mediaConsent'] | null;
  isLoading: boolean;
  toggleStudent: (studentId: string) => void;
  consentBlockedSelected: ActivityAudiencePreview['students'];
}) {
  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <h2 className="text-lg font-black text-slate-950">Audience and consent</h2>
        <p className="mt-1 text-sm text-slate-500">
          Most updates go to the whole class or section. Tag individual students only for
          achievements, competitions, or student-specific notes.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {audienceModes.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setPost((current) => ({ ...current, audienceMode: mode }))}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-black uppercase tracking-widest transition-colors',
              post.audienceMode === mode
                ? 'border-[var(--color-mod-activity-accent)] bg-[var(--color-mod-activity-accent)] text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {mode === 'whole' ? 'Whole class / section' : 'Selected students'}
          </button>
        ))}
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

      {post.audienceMode === 'whole' ? (
        <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-6">
          <p className="text-sm font-bold text-slate-900">
            {Boolean(post.classId) ? 'Posting to the whole class/section' : 'Select a class to continue'}
          </p>
          {isLoading ? (
            <LoadingState />
          ) : mediaConsent && mediaConsent.allowedCount + mediaConsent.notAllowedCount + mediaConsent.restrictedCount + mediaConsent.notRecordedCount > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-600">
                {mediaConsent.allowedCount} of{' '}
                {mediaConsent.allowedCount +
                  mediaConsent.notAllowedCount +
                  mediaConsent.restrictedCount +
                  mediaConsent.notRecordedCount}{' '}
                students have active, unrestricted photo consent.
              </p>
              {mediaConsent.notAllowedCount || mediaConsent.restrictedCount || mediaConsent.notRecordedCount ? (
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {mediaConsent.notAllowedCount > 0
                    ? `${mediaConsent.notAllowedCount} not allowed · `
                    : ''}
                  {mediaConsent.restrictedCount > 0
                    ? `${mediaConsent.restrictedCount} restricted · `
                    : ''}
                  {mediaConsent.notRecordedCount > 0
                    ? `${mediaConsent.notRecordedCount} not recorded`
                    : ''}
                  {' '}— none of these students will see media in this post; switch to
                  &quot;Selected students&quot; to tag individuals directly.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">Tagged students</p>
            <Badge variant="secondary" className="text-xs font-bold">
              {post.studentIds.length} selected
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {isLoading ? (
              <LoadingState />
            ) : students.length > 0 ? (
              students.map((student) => {
                const selected = post.studentIds.includes(student.id);
                const consentMeta = consentStatusMeta(student.mediaConsentStatus);
                const ConsentIcon = consentMeta?.icon;
                return (
                  <button
                    key={student.id}
                    type="button"
                    disabled={!student.mediaConsentGranted}
                    title={consentMeta?.label}
                    onClick={() => toggleStudent(student.id)}
                    className={cn(
                      'inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50',
                      selected
                        ? 'bg-[var(--color-mod-activity-accent)] text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                    )}
                  >
                    {ConsentIcon ? (
                      <ConsentIcon className={cn('h-3.5 w-3.5', !selected && consentMeta?.className)} />
                    ) : null}
                    {student.fullName}
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
          {consentBlockedSelected.length > 0 ? (
            <p className="rounded-lg border border-danger-100 bg-danger-50 px-4 py-3 text-xs font-bold text-danger-700">
              {consentBlockedSelected.length} tagged student
              {consentBlockedSelected.length === 1 ? '' : 's'} lack active photo consent and must be
              removed before publishing.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ContentStep({
  post,
  setPost,
  files,
  fileWarning,
  addFiles,
  removeFile,
  moveFile,
}: {
  post: ComposerState;
  setPost: (updater: (current: ComposerState) => ComposerState) => void;
  files: File[];
  fileWarning: string | null;
  addFiles: (fileList: FileList | null) => void;
  removeFile: (index: number) => void;
  moveFile: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <h2 className="text-lg font-black text-slate-950">Content and protected media</h2>
        <p className="mt-1 text-sm text-slate-500">
          Media uploads go through the File Registry — no permanent public URLs are exposed.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <FormField label="Category">
          <Select
            value={post.category}
            onChange={(event) =>
              setPost((current) => ({
                ...current,
                category: event.target.value as ComposerState['category'],
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
            onChange={(event) => setPost((current) => ({ ...current, title: event.target.value }))}
            placeholder="Post title"
          />
        </FormField>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <FormField label="Date">
          <Input
            type="date"
            value={post.activityDate}
            onChange={(event) =>
              setPost((current) => ({ ...current, activityDate: event.target.value }))
            }
          />
        </FormField>
        <FormField label="Language">
          <Select
            value={post.language}
            onChange={(event) =>
              setPost((current) => ({
                ...current,
                language: event.target.value as ComposerState['language'],
              }))
            }
          >
            {languageOptions.map((option) => (
              <option key={option} value={option}>
                {languageLabels[option]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Parent visibility">
          <label className="flex h-10 items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={post.parentVisible}
              onChange={(event) =>
                setPost((current) => ({ ...current, parentVisible: event.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            {post.parentVisible ? 'Visible to parents' : 'Staff-only'}
          </label>
        </FormField>
      </div>

      <FormField label="Caption">
        <TextArea
          rows={4}
          value={post.caption}
          onChange={(event) => setPost((current) => ({ ...current, caption: event.target.value }))}
          placeholder={
            post.language === 'BOTH'
              ? 'Today our students participated in ________.\nआज विद्यार्थीहरूले ________ गतिविधिमा सहभागिता जनाए।'
              : post.language === 'NEPALI'
                ? 'आज कक्षामा के भयो?'
                : 'What happened in class today?'
          }
        />
      </FormField>

      <FormField label="Ask your child about... (optional)">
        <TextArea
          rows={2}
          value={post.askAtHome}
          onChange={(event) =>
            setPost((current) => ({ ...current, askAtHome: event.target.value }))
          }
          placeholder="e.g. Ask your child to name one object of each colour they found today."
          maxLength={280}
        />
        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Shown to parents as a simple way to talk about school at home.
        </p>
      </FormField>

      <FormField label="Photos">
        <div className="space-y-4">
          <Input
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = '';
            }}
            className="file:mr-4 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:text-[10px] file:font-black file:uppercase file:tracking-widest"
          />
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Attach 1 to 5 images, 10MB or smaller each. Previews use signed access only.
          </p>

          {files.length > 0 ? (
            <ul className="space-y-2">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Camera className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate text-xs font-black uppercase tracking-tight text-slate-900">
                      {file.name}
                    </span>
                    <Badge variant="outline" className="shrink-0 text-[10px] font-black uppercase">
                      {formatFileSize(file.size)}
                    </Badge>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveFile(index, -1)}
                      disabled={index === 0}
                      className="h-8 w-8 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-30"
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveFile(index, 1)}
                      disabled={index === files.length - 1}
                      className="h-8 w-8 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-30"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-danger-100 text-danger-600 hover:bg-danger-50"
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {fileWarning ? (
            <p className="rounded-lg border border-danger-100 bg-danger-50 px-4 py-3 text-xs font-bold text-danger-700">
              {fileWarning}
            </p>
          ) : null}
        </div>
      </FormField>
    </section>
  );
}

function ReviewStep({
  post,
  selectedStudents,
  consentBlockedSelected,
  className,
  sectionName,
  fileCount,
  willRequireApproval,
  isPending,
  mutationError,
  canSubmit,
  onSubmit,
}: {
  post: ComposerState;
  selectedStudents: ActivityAudiencePreview['students'];
  consentBlockedSelected: ActivityAudiencePreview['students'];
  className: string;
  sectionName: string;
  fileCount: number;
  willRequireApproval: boolean;
  isPending: boolean;
  mutationError: string | null;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <h2 className="text-lg font-black text-slate-950">Review and submit</h2>
        <p className="mt-1 text-sm text-slate-500">
          {willRequireApproval
            ? 'This post tags individual students or is an achievement/competition update, so it goes to moderation before guardians see it.'
            : 'This publishes immediately to guardians in the selected class/section — no moderation queue.'}
        </p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2">
        <ReviewFact label="Class / Section" value={`${className} / ${sectionName}`} />
        <ReviewFact label="Category" value={formatEnumLabel(post.category)} />
        <ReviewFact label="Title" value={post.title || 'Not set'} />
        <ReviewFact label="Date" value={post.activityDate || 'Not set'} />
        <ReviewFact label="Photos" value={`${fileCount} image${fileCount === 1 ? '' : 's'}`} />
        <ReviewFact
          label="Parent visibility"
          value={post.parentVisible ? 'Visible to parents' : 'Staff only'}
        />
        <ReviewFact label="Language" value={languageLabels[post.language]} />
      </dl>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="mb-2 text-xs font-bold text-slate-500">Audience</p>
        <p className="text-xs font-medium leading-relaxed text-slate-700">
          {post.audienceMode === 'whole'
            ? `Whole ${sectionName === 'Whole class' ? 'class' : 'section'} (${className} / ${sectionName})`
            : selectedStudents.length > 0
              ? selectedStudents.map((student) => student.fullName).join(', ')
              : 'No students tagged yet.'}
        </p>
      </div>

      {post.askAtHome.trim() ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="mb-2 text-xs font-bold text-slate-500">Ask your child about...</p>
          <p className="text-xs font-medium leading-relaxed text-slate-700">{post.askAtHome}</p>
        </div>
      ) : null}

      {consentBlockedSelected.length > 0 ? (
        <p className="rounded-lg border border-danger-100 bg-danger-50 px-4 py-3 text-xs font-bold text-danger-700">
          Publish is blocked: {consentBlockedSelected.map((s) => s.fullName).join(', ')} lack
          active photo consent.
        </p>
      ) : null}

      {mutationError ? (
        <p className="rounded-lg border border-danger-100 bg-danger-50 px-4 py-3 text-xs font-bold text-danger-700">
          {mutationError}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className="h-14 w-full rounded-xl bg-[var(--color-mod-activity-accent)] text-xs font-bold uppercase tracking-widest text-white shadow-sm transition-all hover:bg-[var(--color-mod-activity-text)] disabled:opacity-50"
      >
        {isPending ? 'Submitting...' : willRequireApproval ? 'Submit for approval' : 'Publish'}
      </button>
    </section>
  );
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1 last:border-0">
      <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</dt>
      <dd className="text-right text-[11px] font-bold text-slate-800">{value}</dd>
    </div>
  );
}

function formatEnumLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function consentStatusMeta(status: ActivityAudiencePreview['students'][number]['mediaConsentStatus']) {
  switch (status) {
    case 'NOT_ALLOWED':
      return { label: 'Not allowed', icon: Lock, className: 'text-danger-600' };
    case 'RESTRICTED':
      return { label: 'Restricted', icon: ShieldAlert, className: 'text-warning-600' };
    case 'NOT_RECORDED':
      return { label: 'Not recorded', icon: HelpCircle, className: 'text-slate-400' };
    default:
      return null;
  }
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024)).toLocaleString()} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
