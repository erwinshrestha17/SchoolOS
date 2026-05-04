'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api';

type Props = {
  academicYears: any[];
  classes: any[];
  allSections: any[];
  subjects: any[];
  staff: any[];
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
  dueAt: string;
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

  const homeworkQuery = useQuery({
    queryKey: ['homework', classId],
    queryFn: () => api.listHomework({ classId }),
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

  const selectedAssignment = homeworkQuery.data?.find((h: any) => h.id === selectedAssignmentId);
  const assignmentSubmissions = submissionsQuery.data?.filter((s: any) => s.homeworkId === selectedAssignmentId) ?? [];

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
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
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
              {homeworkQuery.data?.map((h: any) => (
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
                        {new Date(h.dueAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>{h.submissions?.length ?? 0} Students</span>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700">
                      {h.submissions?.filter((s: any) => s.status === 'SUBMITTED' || s.status === 'REVIEWED').length ?? 0} / {h.submissions?.length ?? 0} Submitted
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
                {assignmentSubmissions.length === 0 ? (
                  <p className="text-sm text-gray-500">No submissions yet.</p>
                ) : (
                  <div className="space-y-3">
                    {assignmentSubmissions.map((s: any) => (
                      <div key={s.id} className="rounded-2xl border border-[var(--line)] p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-600 uppercase">
                              {s.student?.firstName[0]}{s.student?.lastName[0]}
                            </div>
                            <div>
                              <p className="font-bold text-gray-950">
                                {s.student?.firstName} {s.student?.lastName}
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
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colors[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
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
          <label className="mb-1 block text-xs font-semibold text-gray-600">Feedback</label>
          <input
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="w-full"
            placeholder="Good work!"
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
  academicYears: any[];
  classes: any[];
  allSections: any[];
  subjects: any[];
  staff: any[];
  onClose: () => void;
  onSave: (data: HomeworkPayload) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    academicYearId: academicYears.find((y: any) => y.isCurrent)?.id ?? '',
    classId: '',
    sectionId: '',
    subjectId: '',
    title: '',
    instructions: '',
    dueAt: '',
    maxScore: 100,
  });

  const sectionsForClass = allSections.filter((s: any) => s.classId === formData.classId);
  const subjectsForClass = subjects.filter((s: any) => s.classId === formData.classId);

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
                 {academicYears.map((y: any) => (
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
                 {classes.map((c: any) => (
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
                 {sectionsForClass.map((s: any) => (
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
                 {subjectsForClass.map((s: any) => (
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
                 value={formData.dueAt}
                 onChange={(e) => setFormData({ ...formData, dueAt: e.target.value })}
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
            disabled={isPending || !formData.classId || !formData.subjectId || !formData.title || !formData.dueAt}
            className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? 'Assigning...' : 'Assign Homework'}
          </button>
        </div>
      </div>
    </div>
  );
}
