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
  Trophy
} from 'lucide-react';
import type { HomeworkSubmissionSummary } from '@schoolos/core';

// Simple local format helper since date-fns is missing
function format(date: Date | string, pattern: string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (pattern === 'MMM d, h:mm a') {
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (pattern === 'PPP p') {
    return d.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  }
  return d.toLocaleDateString();
}

export function StudentHomeworkTab() {
  const queryClient = useQueryClient();
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

  const { data: submissions, isLoading } = useQuery({
    queryKey: ['my-homework'],
    queryFn: () => api.listHomeworkSubmissions(),
  });

  // Since the current listHomework might return all assignments if we're not careful,
  // we should ideally have an endpoint that returns ONLY the student's submissions.
  // But listHomework with studentId filter works if we can get the studentId.
  // For now, let's assume the backend handles the student scoping if we're logged in as a student.

  const selectedSubmission = submissions?.find((s: HomeworkSubmissionSummary) => s.id === selectedSubmissionId);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] bg-white/50 text-center">
        <BookOpen className="mb-2 h-10 w-10 text-[var(--muted)]" />
        <h3 className="text-lg font-semibold">No homework assigned</h3>
        <p className="text-sm text-[var(--muted)]">Great job! You're all caught up.</p>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Submissions List */}
      <div className="space-y-4 lg:col-span-5 overflow-y-auto pr-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)] px-1">Assignments</h3>
        {submissions.map((submission: HomeworkSubmissionSummary) => (
          <button
            key={submission.id}
            onClick={() => setSelectedSubmissionId(submission.id)}
            className={`w-full flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all hover:shadow-md ${
              selectedSubmissionId === submission.id
                ? 'border-primary-500 bg-primary-50/30 ring-1 ring-primary-500'
                : 'border-[var(--line)] bg-white/70 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <StatusBadge status={submission.status} />
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <Clock size={12} />
                {format(new Date(submission.homework?.dueAt || ''), 'MMM d, h:mm a')}
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 line-clamp-1">{submission.homework?.title}</h4>
              <p className="text-xs text-[var(--muted)]">{submission.homework?.subject?.name}</p>
            </div>

            {submission.score !== null && (
              <div className="mt-1 flex items-center gap-1 text-xs font-bold text-success-600">
                <Trophy size={12} />
                Score: {submission.score} / {submission.homework?.maxScore}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Detail & Submission View */}
      <div className="lg:col-span-7">
        {selectedSubmission ? (
          <div className="flex flex-col gap-6 rounded-3xl border border-[var(--line)] bg-white/80 p-6 shadow-sm min-h-full">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-primary-600">
                <span>{selectedSubmission.homework?.subject?.name}</span>
                <span className="text-gray-300">•</span>
                <span>Assigned by {selectedSubmission.homework?.assignedByStaff?.firstName} {selectedSubmission.homework?.assignedByStaff?.lastName}</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{selectedSubmission.homework?.title}</h2>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)]">Instructions</h4>
              <div className="rounded-2xl bg-gray-50/50 p-4 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
                {selectedSubmission.homework?.instructions}
              </div>
            </div>

            {selectedSubmission.status === 'ASSIGNED' || selectedSubmission.status === 'LATE' ? (
              <SubmissionForm 
                submissionId={selectedSubmission.id} 
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['my-homework'] });
                }}
              />
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)]">Your Submission</h4>
                  <div className="rounded-2xl border border-[var(--line)] bg-white p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedSubmission.submissionContent || 'No text content provided.'}
                    <div className="mt-4 flex items-center gap-2 text-xs text-[var(--muted)] border-t border-[var(--line)] pt-3">
                      <CheckCircle2 size={14} className="text-success-600" />
                      Submitted on {format(new Date(selectedSubmission.submittedAt || ''), 'PPP p')}
                    </div>
                  </div>
                </div>

                {selectedSubmission.feedback && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)]">Teacher Feedback</h4>
                    <div className="rounded-2xl bg-primary-50/50 p-4 text-sm border border-primary-100 shadow-inner">
                      <div className="flex items-start gap-3">
                        <MessageSquare className="mt-1 h-4 w-4 shrink-0 text-primary-600" />
                        <p className="text-gray-800 italic">"{selectedSubmission.feedback}"</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--line)] bg-white/50 p-12 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-[var(--muted)] opacity-20" />
            <h3 className="text-xl font-bold text-gray-900">Select an assignment</h3>
            <p className="text-sm text-[var(--muted)] max-w-xs mx-auto mt-1">
              Click on an assignment from the list to view instructions and submit your work.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'ASSIGNED':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 border border-gray-200">
          Pending
        </span>
      );
    case 'SUBMITTED':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-700 border border-primary-100">
          Submitted
        </span>
      );
    case 'REVIEWED':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success-700 border border-success-100">
          Reviewed
        </span>
      );
    case 'LATE':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger-700 border border-danger-100">
          Late
        </span>
      );
    default:
      return null;
  }
}

function SubmissionForm({ submissionId, onSuccess }: { submissionId: string, onSuccess: () => void }) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const mutation = useMutation({
    mutationFn: (data: { submissionId: string; content: string }) => api.submitHomework(data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to submit homework');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!content.trim()) {
      setError('Please enter your submission text');
      return;
    }
    mutation.mutate({ submissionId, content });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-auto border-t border-[var(--line)] pt-6">
      <div className="space-y-2">
        <label className="text-sm font-bold uppercase tracking-wider text-[var(--muted)]">Your Answer</label>
        <textarea
          className="w-full rounded-2xl border border-[var(--line)] bg-white p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 min-h-[160px] resize-none"
          placeholder="Type your response here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={mutation.isPending}
        />
      </div>
      {error && (
        <div className="flex items-center gap-2 text-xs font-medium text-danger-600 bg-danger-50 p-3 rounded-xl border border-danger-100">
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
