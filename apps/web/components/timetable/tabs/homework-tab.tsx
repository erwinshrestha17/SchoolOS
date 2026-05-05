'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api';
import type {
  AcademicYearSummary,
  ClassSummary,
  HomeworkAssignmentSummary,
  HomeworkSubmissionSummary,
  SectionSummary,
  StaffSummary,
  SubjectSummary,
} from '@schoolos/core';

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="rounded-xl border-[var(--line)] bg-white/50 text-sm font-medium backdrop-blur-sm"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border-[var(--line)] bg-white/50 text-sm font-medium backdrop-blur-sm"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Assign Homework
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Assignments List */}
        <section className="shell-card rounded-[28px] p-6">
          <h2 className="mb-4 text-lg font-bold text-gray-950">Active Assignments</h2>
          {homeworkQuery.isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : homeworkQuery.data?.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-gray-500">
              <p>No homework assignments found.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {homeworkQuery.data?.map((h) => (
                <div
                  key={h.id}
                  onClick={() => setSelectedAssignmentId(h.id)}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                    selectedAssignmentId === h.id
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                      : 'border-[var(--line)] hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                        {h.subject?.name} • {h.class?.name}
                      </p>
                      <h3 className="mt-1 font-bold text-gray-950">{h.title}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Due Date</p>
                      <p className="text-sm font-semibold text-gray-700">
                        {new Date(h.dueDate ?? h.dueAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>{h.submissions?.length ?? 0} Students</span>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700">
                      {h.submissions?.filter((submission) => submission.status === 'SUBMITTED' || submission.status === 'REVIEWED').length ?? 0} / {h.submissions?.length ?? 0} Submitted
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Submissions / Details */}
        <section className="shell-card rounded-[28px] p-6">
          {selectedAssignment ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-950">{selectedAssignment.title}</h2>
                <p className="mt-2 text-sm text-gray-600">{selectedAssignment.instructions}</p>
              </div>

              <div className="border-t border-[var(--line)] pt-6">
                <h3 className="mb-4 font-bold text-gray-950">Student Submissions</h3>
                <div className="mb-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700"
                    onClick={() => assignMutation.mutate(selectedAssignment.id)}
                    disabled={selectedAssignment.status !== 'DRAFT' || assignMutation.isPending}
                  >
                    Assign
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700"
                    onClick={() => reminderMutation.mutate(selectedAssignment.id)}
                    disabled={selectedAssignment.status !== 'ASSIGNED' || reminderMutation.isPending}
                  >
                    Send Reminder
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700"
                    onClick={() => closeMutation.mutate(selectedAssignment.id)}
                    disabled={selectedAssignment.status === 'CLOSED' || closeMutation.isPending}
                  >
                    Close
                  </button>
                </div>
                {assignmentSubmissions.length === 0 ? (
                  <p className="text-sm text-gray-500">No submissions yet.</p>
                ) : (
                  <div className="space-y-3">
                    {assignmentSubmissions.map((s) => (
                      <div key={s.id} className="rounded-2xl border border-[var(--line)] p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-600 uppercase">
                              {studentInitials(s)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-950">
                                {studentName(s)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {s.submittedAt ? `Submitted on ${new Date(s.submittedAt).toLocaleString()}` : 'Not submitted'}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                             <StatusBadge status={s.status} />
                             {s.score !== null && (
                               <span className="text-sm font-bold text-emerald-600">
                                 {s.score} / {selectedAssignment.maxScore}
                               </span>
                             )}
                          </div>
                        </div>

                        {s.submissionContent && (
                          <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                            {s.submissionContent}
                          </div>
                        )}

                        {s.attachments && s.attachments.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {s.attachments.map((a) => (
                              <a
                                key={a.id}
                                href={a.fileAsset?.publicUrl || '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium transition hover:bg-gray-50"
                              >
                                <span className="truncate max-w-[150px]">{a.fileAsset?.originalFilename}</span>
                              </a>
                            ))}
                          </div>
                        )}

                        {s.status === 'SUBMITTED' && (
                          <div className="mt-4 border-t border-[var(--line)] pt-4">
                            <GradingForm
                              submissionId={s.id}
                              maxScore={selectedAssignment.maxScore}
                              onReview={(data) => reviewSubmissionMutation.mutate(data)}
                              isPending={reviewSubmissionMutation.isPending}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-gray-500">
              <p>Select an assignment to view details and review submissions.</p>
            </div>
          )}
        </section>
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
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ASSIGNED: 'bg-gray-100 text-gray-600',
    SUBMITTED: 'bg-indigo-100 text-indigo-700',
    REVIEWED: 'bg-emerald-100 text-emerald-700',
    LATE: 'bg-amber-100 text-amber-700',
    NOT_SUBMITTED: 'bg-gray-100 text-gray-600',
    NEEDS_CORRECTION: 'bg-red-100 text-red-700',
    EXCUSED: 'bg-sky-100 text-sky-700',
    DRAFT: 'bg-gray-100 text-gray-600',
    CLOSED: 'bg-slate-100 text-slate-700',
    CANCELLED: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colors[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
}

function studentName(submission: HomeworkSubmissionSummary) {
  const student = submission.student;
  if (!student) return 'Student';
  const firstName = student.firstNameEn ?? '';
  const lastName = student.lastNameEn ?? '';
  return `${firstName} ${lastName}`.trim() || student.studentSystemId || 'Student';
}

function studentInitials(submission: HomeworkSubmissionSummary) {
  return studentName(submission)
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function GradingForm({
  submissionId,
  maxScore,
  onReview,
  isPending,
}: {
  submissionId: string;
  maxScore: number | null;
  onReview: (data: GradingPayload) => void;
  isPending: boolean;
}) {
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-gray-600">
            Score (max {maxScore ?? '—'})
          </label>
          <input
            type="number"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-full"
            placeholder="0.00"
          />
        </div>
        <div className="flex-[2]">
          <label className="mb-1 block text-xs font-semibold text-gray-600">Correction Remarks</label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="w-full min-h-[80px] resize-none"
            placeholder="Provide detailed feedback..."
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={() => onReview({ submissionId, status: 'REVIEWED', score: Number(score), feedback })}
          disabled={isPending || !score}
          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Mark as Reviewed'}
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
}: {
  academicYears: AcademicYearSummary[];
  classes: ClassSummary[];
  allSections: SectionSummary[];
  subjects: SubjectSummary[];
  staff: StaffSummary[];
  onClose: () => void;
  onSave: (data: HomeworkPayload) => void;
  isPending: boolean;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
        <div className="border-b border-[var(--line)] bg-indigo-50/50 p-6">
          <h2 className="text-xl font-bold text-gray-950">Assign New Homework</h2>
          <p className="text-sm text-gray-600">Create a homework task for a class or specific section.</p>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="grid gap-4 sm:grid-cols-2">
             <div className="space-y-1">
               <label className="text-xs font-semibold text-gray-600">Academic Year</label>
               <select
                 value={formData.academicYearId}
                 onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
               >
                 <option value="">Select Year</option>
                 {academicYears.map((y) => (
                   <option key={y.id} value={y.id}>{y.name}</option>
                 ))}
               </select>
             </div>

             <div className="space-y-1">
               <label className="text-xs font-semibold text-gray-600">Class</label>
               <select
                 value={formData.classId}
                 onChange={(e) => setFormData({ ...formData, classId: e.target.value, sectionId: '', subjectId: '' })}
               >
                 <option value="">Select Class</option>
                 {classes.map((c) => (
                   <option key={c.id} value={c.id}>{c.name}</option>
                 ))}
               </select>
             </div>

             <div className="space-y-1">
               <label className="text-xs font-semibold text-gray-600">Section (Optional)</label>
               <select
                 value={formData.sectionId}
                 onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                 disabled={!formData.classId}
               >
                 <option value="">Whole Class</option>
                 {sectionsForClass.map((s) => (
                   <option key={s.id} value={s.id}>{s.name}</option>
                 ))}
               </select>
             </div>

             <div className="space-y-1">
               <label className="text-xs font-semibold text-gray-600">Subject</label>
               <select
                 value={formData.subjectId}
                 onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                 disabled={!formData.classId}
               >
                 <option value="">Select Subject</option>
                 {subjectsForClass.map((s) => (
                   <option key={s.id} value={s.id}>{s.name}</option>
                 ))}
               </select>
             </div>

             <div className="space-y-1 sm:col-span-2">
               <label className="text-xs font-semibold text-gray-600">Title</label>
               <input
                 type="text"
                 value={formData.title}
                 onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                 placeholder="e.g. Algebra Chapter 3 Problems"
               />
             </div>

             <div className="space-y-1 sm:col-span-2">
               <label className="text-xs font-semibold text-gray-600">Instructions</label>
               <textarea
                 value={formData.instructions}
                 onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                 className="min-h-[100px]"
                 placeholder="Enter detailed instructions for students..."
               />
             </div>

             <div className="space-y-1">
               <label className="text-xs font-semibold text-gray-600">Due Date</label>
               <input
                 type="datetime-local"
                 value={formData.dueDate}
                 onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
               />
             </div>

             <div className="space-y-1">
               <label className="text-xs font-semibold text-gray-600">Max Score</label>
               <input
                 type="number"
                 value={formData.maxScore}
                 onChange={(e) => setFormData({ ...formData, maxScore: Number(e.target.value) })}
               />
             </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[var(--line)] bg-gray-50/50 p-6">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            disabled={isPending || !formData.classId || !formData.subjectId || !formData.title || !formData.dueDate}
            className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? 'Assigning...' : 'Assign Homework'}
          </button>
        </div>
      </div>
    </div>
  );
}
