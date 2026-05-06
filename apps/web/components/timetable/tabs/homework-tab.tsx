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
import { SectionCard } from '../../ui/section-card';
import { StatCard } from '../../ui/stat-card';
import { Badge } from '../../ui/badge';
import { EmptyState } from '../../ui/empty-state';
import { LoadingState } from '../../ui/loading-state';
import { 
  FormField, 
  Input, 
  Select, 
  TextArea 
} from '../../ui/form-field';
import { 
  Plus, 
  CheckCircle2, 
  Clock, 
  BookOpen, 
  GraduationCap, 
  ClipboardCheck, 
  AlertCircle,
  X,
  FileText,
  Users,
  Send,
  Lock,
  Archive
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
      {/* Filters & Actions */}
      <SectionCard className="bg-white/90 backdrop-blur-md">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-1 flex-col gap-6 md:flex-row md:items-end">
            <FormField label="Target Class" className="flex-1 max-w-md">
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
          </div>

          <button
            onClick={() => setIsCreating(true)}
            className="h-12 px-6 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest text-[11px] shadow-xl shadow-slate-200 hover:-translate-y-1 transition-all flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Assign Homework
          </button>
        </div>
      </SectionCard>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Assignments List */}
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
          ) : homeworkQuery.data?.length === 0 ? (
            <EmptyState 
              title="No homework found" 
              description="Assign new homework to see them listed here." 
              className="bg-slate-50/50"
            />
          ) : (
            <div className="space-y-4">
              {homeworkQuery.data?.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSelectedAssignmentId(h.id)}
                  className={cn(
                    "w-full text-left p-6 rounded-[2rem] border transition-all duration-300 group",
                    selectedAssignmentId === h.id
                      ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200"
                      : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-md"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className={cn("text-[10px] font-black uppercase tracking-widest", selectedAssignmentId === h.id ? "text-indigo-400" : "text-indigo-600")}>
                        {h.subject?.name} · {h.class?.name}
                      </p>
                      <h3 className="font-black uppercase tracking-tight text-lg italic">{h.title}</h3>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-[9px] font-black uppercase tracking-widest", selectedAssignmentId === h.id ? "text-slate-400" : "text-slate-400")}>Due Date</p>
                      <p className={cn("text-xs font-bold", selectedAssignmentId === h.id ? "text-slate-200" : "text-slate-700")}>
                        {new Date(h.dueDate ?? h.dueAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                       <Users className={cn("h-3.5 w-3.5", selectedAssignmentId === h.id ? "text-slate-400" : "text-slate-300")} />
                       <span className={cn("text-[10px] font-bold uppercase tracking-widest", selectedAssignmentId === h.id ? "text-slate-400" : "text-slate-500")}>
                         {h.submissions?.length ?? 0} Students
                       </span>
                    </div>
                    <Badge variant={selectedAssignmentId === h.id ? "secondary" : "outline"} className="text-[9px] font-black uppercase tracking-widest">
                      {h.submissions?.filter((s) => s.status === 'SUBMITTED' || s.status === 'REVIEWED').length ?? 0} Submitted
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Submissions / Details */}
        <div className="space-y-8">
          {selectedAssignment ? (
            <>
              <SectionCard title="Assignment Details">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tight">{selectedAssignment.title}</h2>
                    <p className="mt-3 text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      {selectedAssignment.instructions}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      className="h-9 px-4 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors flex items-center gap-2"
                      onClick={() => assignMutation.mutate(selectedAssignment.id)}
                      disabled={selectedAssignment.status !== 'DRAFT' || assignMutation.isPending}
                    >
                      <Send className="h-3 w-3" />
                      Assign
                    </button>
                    <button
                      type="button"
                      className="h-9 px-4 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-colors flex items-center gap-2"
                      onClick={() => reminderMutation.mutate(selectedAssignment.id)}
                      disabled={selectedAssignment.status !== 'ASSIGNED' || reminderMutation.isPending}
                    >
                      <AlertCircle className="h-3 w-3" />
                      Send Reminder
                    </button>
                    <button
                      type="button"
                      className="h-9 px-4 rounded-full bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors flex items-center gap-2"
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
                ) : assignmentSubmissions.length === 0 ? (
                  <EmptyState 
                    title="No submissions" 
                    description="No students have submitted work for this assignment yet." 
                    className="bg-slate-50/50"
                  />
                ) : (
                  <div className="space-y-4">
                    {assignmentSubmissions.map((s) => (
                      <div key={s.id} className="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm space-y-6 group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 font-black text-slate-500 uppercase text-xs">
                              {studentInitials(s)}
                            </div>
                            <div>
                              <p className="font-black text-slate-900 uppercase tracking-tight">{studentName(s)}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {s.submittedAt ? `Submitted · ${new Date(s.submittedAt).toLocaleString()}` : 'Not submitted'}
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
                          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 italic leading-relaxed border border-slate-100">
                            {s.submissionContent}
                          </div>
                        )}

                        {s.attachments && s.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {s.attachments.map((a) => (
                              <a
                                key={a.id}
                                href={a.fileAsset?.publicUrl || '#'}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest transition hover:bg-slate-50"
                              >
                                <FileText className="h-3 w-3 text-slate-400" />
                                <span className="truncate max-w-[150px]">{a.fileAsset?.originalFilename}</span>
                              </a>
                            ))}
                          </div>
                        )}

                        {s.status === 'SUBMITTED' && (
                          <div className="mt-4 border-t border-slate-100 pt-6">
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
              </SectionCard>
            </>
          ) : (
            <SectionCard className="h-full flex flex-col items-center justify-center py-20 bg-slate-50/50 border-dashed border-2">
              <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center shadow-sm mb-6">
                <BookOpen className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">No Assignment Selected</h3>
              <p className="mt-2 text-sm text-slate-500 max-w-xs text-center">
                Select an assignment from the list to view instructions and grade student work.
              </p>
            </SectionCard>
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
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isDraft = status === 'DRAFT';
  const isAssigned = status === 'ASSIGNED';
  const isSubmitted = status === 'SUBMITTED';
  const isReviewed = status === 'REVIEWED';
  const isClosed = status === 'CLOSED';
  const isLate = status === 'LATE';

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
      isReviewed ? "bg-emerald-100 text-emerald-700" :
      isSubmitted ? "bg-indigo-100 text-indigo-700" :
      isAssigned ? "bg-blue-100 text-blue-700" :
      isLate ? "bg-amber-100 text-amber-700" :
      isClosed ? "bg-slate-100 text-slate-700" :
      "bg-slate-100 text-slate-500"
    )}>
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
    <div className="space-y-6">
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
          onClick={() => onReview({ submissionId, status: 'REVIEWED', score: Number(score), feedback })}
          disabled={isPending || !score}
          className="h-10 px-6 rounded-2xl bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-100 hover:-translate-y-0.5 transition-all disabled:opacity-50"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2.5rem] bg-white shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="bg-slate-900 p-8 text-white relative">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center ring-1 ring-white/20">
               <Plus className="h-5 w-5 text-indigo-400" />
             </div>
             <div>
               <h2 className="text-xl font-black uppercase italic tracking-tight">New Homework</h2>
               <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Academics / Assignments</p>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="absolute top-8 right-8 h-10 w-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
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

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="h-12 px-6 rounded-2xl text-slate-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            disabled={isPending || !formData.classId || !formData.subjectId || !formData.title || !formData.dueDate}
            className="h-12 px-8 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-slate-200 hover:-translate-y-1 transition-all disabled:opacity-50"
          >
            {isPending ? 'Publishing...' : 'Assign Homework'}
          </button>
        </div>
      </div>
    </div>
  );
}
