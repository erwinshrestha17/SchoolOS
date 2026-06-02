'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { 
  BookOpen, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  Send,
  MessageSquare,
  Trophy,
  Paperclip,
  X,
  FileText,
  User,
  GraduationCap
} from 'lucide-react';
import type { HomeworkSubmissionSummary } from '@schoolos/core';
import { SectionCard } from '../../ui/section-card';
import { StatCard } from '../../ui/stat-card';
import { Badge } from '../../ui/badge';
import { EmptyState } from '../../ui/empty-state';
import { LoadingState } from '../../ui/loading-state';
import { 
  FormField, 
  Input, 
  TextArea 
} from '../../ui/form-field';
import { cn } from '../../../lib/utils';

type HomeworkAttachment = {
  id: string;
  fileAsset?: {
    id?: string;
    originalFilename?: string | null;
    mimeType?: string;
    sizeBytes?: string | number;
  } | null;
};

export function StudentHomeworkTab() {
  const queryClient = useQueryClient();
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const { data: submissions, isLoading } = useQuery({
    queryKey: ['my-homework'],
    queryFn: () => api.listHomeworkSubmissions(),
  });

  const selectedSubmission = submissions?.find((s: HomeworkSubmissionSummary) => s.id === selectedSubmissionId);

  async function openAttachment(attachmentId: string) {
    setAttachmentError(null);
    setOpeningAttachmentId(attachmentId);

    try {
      const access = await api.getHomeworkAttachmentDownloadUrl(attachmentId);
      window.open(access.url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      setAttachmentError(
        err instanceof Error
          ? err.message
          : 'Failed to open the homework attachment.',
      );
    } finally {
      setOpeningAttachmentId(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
      {/* Submissions List */}
      <div className="lg:col-span-4 space-y-6">
        <SectionCard 
          title="My Assignments" 
          headerAction={
            <Badge variant="secondary" className="font-black uppercase tracking-widest text-[10px]">
              {submissions?.length ?? 0} Tasks
            </Badge>
          }
        >
          {isLoading ? (
            <LoadingState />
          ) : !submissions || submissions.length === 0 ? (
            <EmptyState 
              title="All caught up!" 
              description="No homework assignments found for your account." 
              className="bg-slate-50/50"
              icon={<GraduationCap className="h-8 w-8 text-slate-300" />}
            />
          ) : (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {submissions.map((submission: HomeworkSubmissionSummary) => (
                <button
                  key={submission.id}
                  onClick={() => setSelectedSubmissionId(submission.id)}
                  className={cn(
                    "w-full text-left p-5 rounded-[1.5rem] border transition-all duration-300 group",
                    selectedSubmissionId === submission.id
                      ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200"
                      : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-md"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className={cn("text-[9px] font-black uppercase tracking-widest", selectedSubmissionId === submission.id ? "text-indigo-400" : "text-indigo-600")}>
                        {submission.homework?.subject?.name}
                      </p>
                      <h4 className="font-black uppercase tracking-tight text-base italic leading-tight">{submission.homework?.title}</h4>
                    </div>
                    <StatusBadge status={submission.status} isSelected={selectedSubmissionId === submission.id} />
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/10">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <Clock size={12} className="shrink-0" />
                      {new Date(submission.homework?.dueAt || '').toLocaleDateString()}
                    </div>
                    {submission.score !== null && (
                      <div className={cn("flex items-center gap-1 text-[10px] font-black uppercase tracking-widest", selectedSubmissionId === submission.id ? "text-emerald-400" : "text-emerald-600")}>
                        <Trophy size={12} />
                        {submission.score}/{submission.homework?.maxScore}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Detail & Submission View */}
      <div className="lg:col-span-8 space-y-8">
        {selectedSubmission ? (
          <>
            <SectionCard title="Assignment Overview">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <Badge variant="outline" className="font-black uppercase tracking-widest text-[9px] py-0.5 border-indigo-200 text-indigo-600">
                      {selectedSubmission.homework?.subject?.name}
                    </Badge>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      By {selectedSubmission.homework?.assignedByStaff?.firstName} {selectedSubmission.homework?.assignedByStaff?.lastName}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tight leading-none mb-4">{selectedSubmission.homework?.title}</h2>
                  <div className="rounded-[2rem] bg-slate-50 p-6 text-sm leading-relaxed text-slate-600 italic border border-slate-100 whitespace-pre-wrap">
                    {selectedSubmission.homework?.instructions}
                  </div>
                </div>

                <div className="flex items-center gap-6 pt-2">
                   <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Due Date</p>
                      <p className="text-sm font-bold text-slate-900 uppercase">
                        {new Date(selectedSubmission.homework?.dueAt || '').toLocaleString()}
                      </p>
                   </div>
                   <div className="h-8 w-px bg-slate-100" />
                   <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Max Points</p>
                      <p className="text-sm font-bold text-slate-900 uppercase">
                        {selectedSubmission.homework?.maxScore} Points
                      </p>
                   </div>
                </div>
              </div>
            </SectionCard>

            {selectedSubmission.status === 'ASSIGNED' || selectedSubmission.status === 'LATE' ? (
              <SectionCard 
                title="Your Work" 
                description="Provide your answer and attach necessary files below."
              >
                <SubmissionForm 
                  submissionId={selectedSubmission.id} 
                  onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['my-homework'] });
                  }}
                />
              </SectionCard>
            ) : (
              <div className="space-y-8">
                <SectionCard 
                  title="My Submission"
                  headerAction={
                    <Badge variant="success" className="font-black uppercase tracking-widest text-[9px]">
                       Submitted
                    </Badge>
                  }
                >
                  <div className="space-y-6">
                    <div className="rounded-[2rem] border border-slate-100 bg-white p-6 text-sm text-slate-700 leading-relaxed shadow-sm whitespace-pre-wrap">
                      {selectedSubmission.submissionContent || 'No text content provided.'}
                    </div>

                    {selectedSubmission.attachments && selectedSubmission.attachments.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Attachments</h4>
                        {attachmentError ? (
                          <div className="flex items-center gap-2 rounded-2xl border border-red-100 bg-red-50 p-3 text-[11px] font-bold text-red-700">
                            <AlertCircle size={14} />
                            {attachmentError}
                          </div>
                        ) : null}
                        <div className="grid gap-3 sm:grid-cols-2">
                          {selectedSubmission.attachments.map((a: HomeworkAttachment) => (
                            <button
                              key={a.id}
                              type="button"
                              data-testid="student-homework-attachment-download"
                              disabled={openingAttachmentId === a.id}
                              onClick={() => void openAttachment(a.id)}
                              className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-[11px] font-black uppercase tracking-widest transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                            >
                              <FileText size={16} className="text-indigo-500" />
                              <span className="truncate flex-1">
                                {openingAttachmentId === a.id
                                  ? 'Opening signed file...'
                                  : a.fileAsset?.originalFilename ?? 'Attachment'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-50 pt-4">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      Finalized on {new Date(selectedSubmission.submittedAt || '').toLocaleString()}
                    </div>
                  </div>
                </SectionCard>

                {selectedSubmission.feedback && (
                  <SectionCard 
                    title="Teacher Feedback" 
                    className="bg-indigo-900 text-white border-indigo-800 shadow-indigo-100"
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 ring-1 ring-white/20">
                         <MessageSquare className="h-5 w-5 text-indigo-300" />
                      </div>
                      <div>
                        <p className="text-sm italic leading-relaxed text-indigo-100">&ldquo;{selectedSubmission.feedback}&rdquo;</p>
                        {selectedSubmission.score !== null && (
                          <div className="mt-4 flex items-center gap-2">
                             <Trophy size={14} className="text-amber-400" />
                             <span className="text-xs font-black uppercase tracking-[0.2em]">Score: {selectedSubmission.score} / {selectedSubmission.homework?.maxScore}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </SectionCard>
                )}
              </div>
            )}
          </>
        ) : (
          <SectionCard className="h-full flex flex-col items-center justify-center py-24 bg-slate-50/50 border-dashed border-2">
            <div className="h-20 w-20 rounded-full bg-white flex items-center justify-center shadow-sm mb-8 ring-8 ring-slate-100/50">
              <BookOpen className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Assignment Portal</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-xs text-center font-medium">
              Select an active assignment from the sidebar to view details, instructions, and submit your work.
            </p>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, isSelected }: { status: string; isSelected: boolean }) {
  const isAssigned = status === 'ASSIGNED';
  const isSubmitted = status === 'SUBMITTED';
  const isReviewed = status === 'REVIEWED';
  const isLate = status === 'LATE';

  return (
    <span className={cn(
      "inline-flex items-center px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
      isSelected 
        ? "bg-white/10 text-white ring-1 ring-white/20" 
        : isReviewed ? "bg-emerald-100 text-emerald-700" :
          isSubmitted ? "bg-indigo-100 text-indigo-700" :
          isLate ? "bg-amber-100 text-amber-700" :
          "bg-slate-100 text-slate-500"
    )}>
      {isAssigned ? 'Pending' : status}
    </span>
  );
}

function SubmissionForm({ submissionId, onSuccess }: { submissionId: string, onSuccess: () => void }) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [attachments, setAttachments] = useState<{ id: string; fileName: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const mutation = useMutation({
    mutationFn: (data: { submissionId: string; content: string; attachmentIds?: string[] }) => api.submitHomework(data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to submit homework');
    }
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await api.uploadFile(file, 'homework-submission');
      setAttachments([...attachments, { id: result.id, fileName: result.fileName }]);
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter((a) => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!content.trim()) {
      setError('Please enter your submission text');
      return;
    }
    mutation.mutate({ 
      submissionId, 
      content, 
      attachmentIds: attachments.map(a => a.id) 
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <FormField label="Your Submission Text">
        <TextArea
          rows={6}
          placeholder="Type your response or assignment details here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={mutation.isPending || isUploading}
        />
      </FormField>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Supportive Files</h4>
          <label className="cursor-pointer h-9 px-4 rounded-full bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors flex items-center gap-2">
            <Paperclip size={12} />
            Upload File
            <input 
              type="file" 
              className="hidden" 
              onChange={handleFileChange} 
              disabled={mutation.isPending || isUploading}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm group">
              <FileText size={16} className="text-slate-400" />
              <span className="truncate flex-1 text-[11px] font-bold text-slate-700 uppercase tracking-tight">{a.fileName}</span>
              <button 
                type="button" 
                onClick={() => removeAttachment(a.id)}
                className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {isUploading && (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30 p-4 animate-pulse">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <span className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest italic">Uploading...</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-[1.5rem] bg-red-50 border border-red-100 text-red-700">
          <AlertCircle size={18} className="shrink-0" />
          <p className="text-xs font-bold uppercase tracking-widest">{error}</p>
        </div>
      )}

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          className="h-14 px-12 rounded-[1.5rem] bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-slate-200 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center gap-3"
          disabled={mutation.isPending || isUploading}
        >
          {mutation.isPending ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Sending...
            </>
          ) : (
            <>
              <Send size={16} />
              Submit Assignment
            </>
          )}
        </button>
      </div>
    </form>
  );
}
