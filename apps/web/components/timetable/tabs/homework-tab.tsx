'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api';
import type {
  AcademicYearSummary,
  ClassSummary,
  HomeworkSubmissionSummary,
  SectionSummary,
  StaffSummary,
  SubjectSummary,
} from '@schoolos/core';
import { SectionCard } from '../../ui/section-card';
import { Badge } from '../../ui/badge';
import { EmptyState } from '../../ui/empty-state';
import { LoadingState } from '../../ui/loading-state';
import { FilterBar } from '../../ui/filter-bar';
import { PageState } from '../../ui/page-state';
import { AuditInfo } from '../../ui/audit-info';
import {
  FormField,
  Input,
  Select,
  TextArea
} from '../../ui/form-field';
import {
  Plus,
  BookOpen,
  AlertCircle,
  X,
  FileText,
  Users,
  Send,
  Lock,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

type Props = {
  academicYears: AcademicYearSummary[];
  classes: ClassSummary[];
  allSections: SectionSummary[];
  subjects: SubjectSummary[];
  staff: StaffSummary[];
  classId: string;
  setClassId: (id: string) => void;
};

type GradingPayload = {
  submissionId: string;
  status: string;
  score: number;
  feedback: string;
};

type HomeworkPayload = {
  academicYearId: string;
  classId: string;
  sectionId?: string;
  subjectId: string;
  title: string;
  instructions: string;
  dueDate: string;
  maxScore: number;
};

function formatHomeworkDate(value: string | null | undefined, fallback = 'Date not set') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString();
}

function formatHomeworkDateTime(value: string | null | undefined, fallback = 'Date not set') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleString();
}

export function HomeworkTab({
  academicYears,
  classes,
  allSections,
  subjects,
  staff,
  classId,
  setClassId,
}: Props) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const homeworkQuery = useQuery({
    queryKey: ['homework', classId, statusFilter],
    queryFn: () => api.listHomework({ classId, status: statusFilter || undefined }),
  });

  const submissionsQuery = useQuery({
    queryKey: ['homework-submissions'],
    queryFn: api.listHomeworkSubmissions,
  });

  const createHomeworkMutation = useMutation({
    mutationFn: api.createHomework,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      setIsCreating(false);
    },
  });

  const reviewSubmissionMutation = useMutation({
    mutationFn: api.reviewHomeworkSubmission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['homework'] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: api.assignHomework,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['homework'] }),
  });

  const closeMutation = useMutation({
    mutationFn: api.closeHomework,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['homework'] }),
  });

  const reminderMutation = useMutation({
    mutationFn: api.sendHomeworkReminders,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['homework'] }),
  });

  const selectedAssignment = homeworkQuery.data?.find((homework) => homework.id === selectedAssignmentId);
  const assignmentSubmissions = submissionsQuery.data?.filter((submission) => submission.homeworkId === selectedAssignmentId) ?? [];

  return (
    <div className="space-y-8">
      <FilterBar
        label="Homework Filters"
        description="Filter assignments by class and status. Actions use live Homework APIs."
        className="bg-white/90"
        actions={
          <button
            onClick={() => setIsCreating(true)}
            className="flex h-12 items-center gap-2 rounded-2xl bg-[var(--color-mod-homework-accent)] px-6 text-[11px] font-black uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-[var(--color-mod-homework-text)]"
          >
            <Plus className="h-4 w-4" />
            Assign Homework
          </button>
        }
      >
        <FormField label="Target Class" className="min-w-[240px] flex-1 max-w-md">
          <Select value={classId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setClassId(e.target.value)}>
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </FormField>

        <FormField label="Status" className="w-full md:w-48">
          <Select value={statusFilter} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </FormField>
      </FilterBar>

      <div className="grid gap-8 lg:grid-cols-2">
        <SectionCard
          title="Active Assignments"
          headerAction={
            <Badge variant="secondary" className="font-black uppercase tracking-widest text-[10px]">
              {homeworkQuery.data?.length ?? 0} Total
            </Badge>
          }
        >
          {homeworkQuery.isLoading ? (
            <LoadingState />
          ) : homeworkQuery.isError ? (
            <PageState
              tone="danger"
              title="Unable to load homework"
              description={homeworkQuery.error?.message ?? 'Homework assignments could not be loaded.'}
            />
          ) : homeworkQuery.data?.length === 0 ? (
            <EmptyState
              title="No homework found"
              description="Assign new homework to see it listed here."
              className="bg-slate-50/50"
            />
          ) : (
            <div className="space-y-4">
              {homeworkQuery.data?.map((h) => {
                const isSelected = selectedAssignmentId === h.id;
                const subjectName = h.subject?.name?.trim() || 'Subject not set';
                const className = h.class?.name?.trim() || 'Class not set';
                const title = h.title?.trim() || 'Assignment title not set';

                return (
                  <button
                    key={h.id}
                    onClick={() => setSelectedAssignmentId(h.id)}
                    className={cn(
                      'group w-full rounded-2xl border p-6 text-left transition-colors',
                      isSelected
                        ? 'border-[var(--color-mod-homework-border)] bg-[var(--color-mod-homework-bg)] shadow-sm'
                        : 'border-slate-100 bg-white hover:border-[var(--color-mod-homework-border)] hover:bg-[var(--color-mod-homework-bg)]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-mod-homework-text)]">
                          {subjectName} · {className}
                        </p>
                        <h3 className="text-lg font-black uppercase italic tracking-tight text-slate-900">{title}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Due Date</p>
                        <p className="text-xs font-bold text-slate-700">
                          {formatHomeworkDate(h.dueDate ?? h.dueAt, 'Due date not set')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-slate-300" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                          {h.submissions?.length ?? 0} Students
                        </span>
                      </div>
                      <Badge variant={isSelected ? 'secondary' : 'outline'} className="text-[9px] font-black uppercase tracking-widest">
                        {h.submissions?.filter((s) => s.status === 'SUBMITTED' || s.status === 'REVIEWED').length ?? 0} Submitted
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <div className="space-y-8">
          {selectedAssignment ? (
            <>
              <SectionCard title="Assignment Details">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tight text-slate-900">
                      {selectedAssignment.title?.trim() || 'Assignment title not set'}
                    </h2>
                    <p className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                      {selectedAssignment.instructions?.trim() || 'Instructions not set'}
                    </p>
                  </div>

                  {(assignMutation.isError || closeMutation.isError || reminderMutation.isError) && (
                    <PageState
                      tone="danger"
                      title="Homework action failed"
                      description={
                        assignMutation.error?.message ||
                        closeMutation.error?.message ||
                        reminderMutation.error?.message ||
                        'The requested homework action could not be completed.'
                      }
                      className="min-h-0 py-5"
                    />
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      className="flex h-9 items-center gap-2 rounded-full border border-[var(--color-mod-homework-border)] bg-[var(--color-mod-homework-bg)] px-4 text-[10px] font-black uppercase tracking-widest text-[var(--color-mod-homework-text)] transition-colors hover:bg-white"
                      onClick={() => assignMutation.mutate(selectedAssignment.id)}
                      disabled={selectedAssignment.status !== 'DRAFT' || assignMutation.isPending}
                    >
                      <Send className="h-3 w-3" />
                      Assign
                    </button>
                    <button
                      type="button"
                      className="flex h-9 items-center gap-2 rounded-full bg-amber-50 px-4 text-[10px] font-black uppercase tracking-widest text-amber-700 transition-colors hover:bg-amber-100"
                      onClick={() => reminderMutation.mutate(selectedAssignment.id)}
                      disabled={selectedAssignment.status !== 'ASSIGNED' || reminderMutation.isPending}
                    >
                      <AlertCircle className="h-3 w-3" />
                      Send Reminder
                    </button>
                    <button
                      type="button"
                      className="flex h-9 items-center gap-2 rounded-full bg-slate-100 px-4 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-200"
                      onClick={() => closeMutation.mutate(selectedAssignment.id)}
                      disabled={selectedAssignment.status === 'CLOSED' || closeMutation.isPending}
                    >
                      <Lock className="h-3 w-3" />
                      Close
                    </button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Student Submissions">
                {submissionsQuery.isLoading ? (
                  <LoadingState />
                ) : submissionsQuery.isError ? (
                  <PageState
                    tone="danger"
                    title="Unable to load submissions"
                    description={submissionsQuery.error?.message ?? 'Homework submissions could not be loaded.'}
                  />
                ) : assignmentSubmissions.length === 0 ? (
                  <EmptyState
                    title="No submissions"
                    description="No students have submitted work for this assignment yet."
                    className="bg-slate-50/50"
                  />
                ) : (
                  <div className="space-y-4">
                    {assignmentSubmissions.map((s) => (
                      <div key={s.id} className="group space-y-6 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xs font-black uppercase text-slate-500">
                              {studentInitials(s)}
                            </div>
                            <div>
                              <p className="font-black uppercase tracking-tight text-slate-900">{studentName(s)}</p>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {s.submittedAt ? `Submitted · ${formatHomeworkDateTime(s.submittedAt)}` : 'Not submitted'}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <StatusBadge status={s.status} />
                            {s.score !== null && (
                              <Badge variant="success" className="text-[10px] font-black uppercase tracking-widest">
                                {s.score} / {selectedAssignment.maxScore}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {s.submissionContent && (
                          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm italic leading-relaxed text-slate-600">
                            {s.submissionContent}
                          </div>
                        )}

                        {s.attachments && s.attachments.length > 0 && (
                          <div className="space-y-3">
                            <AuditInfo>
                              Attachments are shown from backend file metadata. Use signed preview/download endpoints when available; permanent public URLs are intentionally not exposed here.
                            </AuditInfo>
                            <div className="flex flex-wrap gap-2">
                              {s.attachments.map((a) => (
                                <div
                                  key={a.id}
                                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600"
                                >
                                  <FileText className="h-3 w-3 text-slate-400" />
                                  <span className="max-w-[150px] truncate">{a.fileAsset?.originalFilename?.trim() || 'File name not set'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {s.status === 'SUBMITTED' && (
                          <div className="mt-4 border-t border-slate-100 pt-6">
                            <GradingForm
                              submissionId={s.id}
                              maxScore={selectedAssignment.maxScore}
                              onReview={(data) => reviewSubmissionMutation.mutate(data)}
                              isPending={reviewSubmissionMutation.isPending}
                              error={reviewSubmissionMutation.error?.message}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </>
          ) : (
            <PageState
              tone="info"
              title="No assignment selected"
              description="Select an assignment from the list to view instructions, submission status, reminders, and teacher review actions."
              className="h-full border-dashed bg-slate-50/50 py-20"
            />
          )}
        </div>
      </div>

      {isCreating && (
        <CreateHomeworkModal
          academicYears={academicYears}
          classes={classes}
          allSections={allSections}
          subjects={subjects}
          staff={staff}
          onClose={() => setIsCreating(false)}
          onSave={(data) => createHomeworkMutation.mutate(data)}
          isPending={createHomeworkMutation.isPending}
          error={createHomeworkMutation.error?.message}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isAssigned = status === 'ASSIGNED';
  const isSubmitted = status === 'SUBMITTED';
  const isReviewed = status === 'REVIEWED';
  const isClosed = status === 'CLOSED';
  const isLate = status === 'LATE';

  return (
    <span className={cn(
      'rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest',
      isReviewed ? 'bg-emerald-100 text-emerald-700' :
      isSubmitted ? 'bg-[var(--color-mod-homework-bg)] text-[var(--color-mod-homework-text)]' :
      isAssigned ? 'bg-[var(--color-mod-homework-bg)] text-[var(--color-mod-homework-text)]' :
      isLate ? 'bg-amber-100 text-amber-700' :
      isClosed ? 'bg-slate-100 text-slate-700' :
      'bg-slate-100 text-slate-500'
    )}>
      {status}
    </span>
  );
}

function studentName(submission: HomeworkSubmissionSummary) {
  const student = submission.student;
  if (!student) return 'Student name not set';
  const firstName = student.firstNameEn ?? '';
  const lastName = student.lastNameEn ?? '';
  return `${firstName} ${lastName}`.trim() || student.studentSystemId || 'Student name not set';
}

function studentInitials(submission: HomeworkSubmissionSummary) {
  return studentName(submission)
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '-';
}

function GradingForm({
  submissionId,
  maxScore,
  onReview,
  isPending,
  error,
}: {
  submissionId: string;
  maxScore: number | null;
  onReview: (data: GradingPayload) => void;
  isPending: boolean;
  error?: string;
}) {
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');

  return (
    <div className="space-y-6">
      {error && (
        <PageState
          tone="danger"
          title="Review failed"
          description={error}
          className="min-h-0 py-4"
        />
      )}
      <div className="grid gap-6 md:grid-cols-3">
        <FormField label={`Score (Max ${maxScore ?? '—'})`}>
          <Input
            type="number"
            value={score}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScore(e.target.value)}
            placeholder="0.00"
          />
        </FormField>
        <FormField label="Feedback / Corrections" className="md:col-span-2">
          <TextArea
            value={feedback}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFeedback(e.target.value)}
            rows={2}
            placeholder="Provide constructive feedback..."
          />
        </FormField>
      </div>
      <div className="flex justify-end pt-2">
        <button
          onClick={() => onReview({ submissionId, status: 'REVIEWED', score: Number(score), feedback: feedback.trim() })}
          disabled={isPending || !score}
          className="h-10 rounded-2xl bg-emerald-600 px-6 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Finalize Grade'}
        </button>
      </div>
    </div>
  );
}

function CreateHomeworkModal({
  academicYears,
  classes,
  allSections,
  subjects,
  staff,
  onClose,
  onSave,
  isPending,
  error,
}: {
  academicYears: AcademicYearSummary[];
  classes: ClassSummary[];
  allSections: SectionSummary[];
  subjects: SubjectSummary[];
  staff: StaffSummary[];
  onClose: () => void;
  onSave: (data: HomeworkPayload) => void;
  isPending: boolean;
  error?: string;
}) {
  const [formData, setFormData] = useState({
    academicYearId: academicYears.find((y) => y.isCurrent)?.id ?? '',
    classId: '',
    sectionId: '',
    subjectId: '',
    title: '',
    instructions: '',
    dueDate: '',
    maxScore: 100,
  });

  const sectionsForClass = allSections.filter((s) => s.classId === formData.classId);
  const subjectsForClass = subjects.filter((s) => s.classId === formData.classId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-lg animate-in fade-in zoom-in duration-300">
        <div className="relative border-b border-slate-100 bg-white p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-mod-homework-border)] bg-[var(--color-mod-homework-bg)] text-[var(--color-mod-homework-text)]">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-slate-950">New Homework</h2>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">Academics / Assignments</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close homework form"
            className="absolute right-8 top-8 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-8">
          {error && (
            <PageState
              tone="danger"
              title="Homework could not be created"
              description={error}
              className="min-h-0 py-4"
            />
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Academic Year">
              <Select
                value={formData.academicYearId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, academicYearId: e.target.value })}
              >
                <option value="">Select Year</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Target Class">
              <Select
                value={formData.classId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, classId: e.target.value, sectionId: '', subjectId: '' })}
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Section (Optional)">
              <Select
                value={formData.sectionId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, sectionId: e.target.value })}
                disabled={!formData.classId}
              >
                <option value="">Whole Class</option>
                {sectionsForClass.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Subject">
              <Select
                value={formData.subjectId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, subjectId: e.target.value })}
                disabled={!formData.classId}
              >
                <option value="">Select Subject</option>
                {subjectsForClass.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Assignment Title">
            <Input
              type="text"
              value={formData.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Algebra Chapter 3 Problems"
            />
          </FormField>

          <FormField label="Detailed Instructions">
            <TextArea
              value={formData.instructions}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, instructions: e.target.value })}
              rows={4}
              placeholder="Explain exactly what students need to do..."
            />
          </FormField>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Due Date">
              <Input
                type="datetime-local"
                value={formData.dueDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </FormField>

            <FormField label="Max Points">
              <Input
                type="number"
                value={formData.maxScore}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, maxScore: Number(e.target.value) })}
              />
            </FormField>
          </div>
        </div>

        <div className="flex justify-end gap-4 border-t border-slate-100 bg-slate-50 p-8">
          <button
            onClick={onClose}
            className="h-12 rounded-2xl px-6 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({
              ...formData,
              title: formData.title.trim(),
              instructions: formData.instructions.trim(),
            })}
            disabled={isPending || !formData.classId || !formData.subjectId || !formData.title.trim() || !formData.dueDate}
            className="h-12 rounded-2xl bg-[var(--color-mod-homework-accent)] px-8 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition hover:bg-[var(--color-mod-homework-text)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Publishing...' : 'Assign Homework'}
          </button>
        </div>
      </div>
    </div>
  );
}
