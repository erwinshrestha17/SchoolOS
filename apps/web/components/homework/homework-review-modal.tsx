'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  X, 
  FileText, 
  Download, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface HomeworkReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: any;
  homework: any;
}

export function HomeworkReviewModal({
  isOpen,
  onClose,
  submission,
  homework,
}: HomeworkReviewModalProps) {
  const queryClient = useQueryClient();
  const [score, setScore] = useState<number | string>(submission?.score ?? '');
  const [feedback, setFeedback] = useState(submission?.feedback ?? '');
  const [isCorrectionRequested, setIsCorrectionRequested] = useState(false);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const reviewMutation = useMutation({
    mutationFn: (data: any) => api.reviewHomeworkSubmissionById(submission.id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['homework-submissions', homework.id] });
      onClose();
    },
  });

  const requestCorrectionMutation = useMutation({
    mutationFn: (data: any) => api.requestHomeworkCorrection(submission.id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['homework-submissions', homework.id] });
      onClose();
    },
  });

  const handleReview = () => {
    setActionNotice(null);
    reviewMutation.mutate({
      score: score === '' ? null : Number(score),
      feedback: feedback.trim() || null,
      status: 'REVIEWED',
    });
  };

  const handleRequestCorrection = () => {
    const trimmedFeedback = feedback.trim();
    if (!trimmedFeedback) {
      setActionNotice('Teacher feedback is required before requesting a correction.');
      return;
    }
    setActionNotice(null);
    requestCorrectionMutation.mutate({
      feedback: trimmedFeedback,
    });
  };

  if (!submission) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl rounded-2xl p-0 overflow-hidden border border-slate-200 shadow-sm">
        <DialogHeader className="border-b border-[var(--color-mod-homework-border)] bg-[var(--color-mod-homework-bg)] p-8 text-[var(--color-mod-homework-text)]">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <DialogTitle className="text-2xl font-black tracking-tight italic uppercase">
                Review Submission
              </DialogTitle>
              <p className="text-sm font-medium mt-1 text-[var(--color-mod-homework-text)]">
                Student: {submission.student?.fullNameEn?.trim() || 'Student name not set'} ({submission.student?.studentSystemId || 'ID not set'})
              </p>
            </div>
            <StatusBadge status={submission.status} />
          </div>
        </DialogHeader>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto bg-white">
          {/* Submission Content */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase tracking-widest">
              <MessageSquare className="h-4 w-4 text-[var(--color-mod-homework-text)]" />
              Student Content
            </div>
            <div className="p-6 rounded-2xl bg-slate-50 text-slate-700 border border-slate-100 min-h-[100px] whitespace-pre-wrap leading-relaxed">
              {submission.content?.trim() || <span className="italic opacity-50">No text content provided.</span>}
            </div>
          </div>

          {/* Attachments */}
          {submission.attachments && submission.attachments.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase tracking-widest">
                <FileText className="h-4 w-4 text-[var(--color-mod-homework-text)]" />
                Submitted Files
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {submission.attachments.map((attachment: any) => (
                  <div 
                    key={attachment.id}
                    className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-white shadow-sm hover:border-[var(--color-mod-homework-border)] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-[var(--color-mod-homework-bg)] flex items-center justify-center text-[var(--color-mod-homework-text)]">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 truncate max-w-[150px]">
                          {attachment.fileAsset?.originalFilename?.trim() || 'File name not set'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {Math.round((attachment.fileAsset?.sizeBytes || 0) / 1024)} KB
                        </span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 rounded-xl text-slate-400 hover:text-[var(--color-mod-homework-text)] hover:bg-[var(--color-mod-homework-bg)]"
                      onClick={async () => {
                        try {
                          await api.openHomeworkAttachmentPreview(attachment.id);
                        } catch (err) {
                          setFileNotice('The file view link could not be created.');
                        }
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fileNotice ? (
            <Toast
              title="Could not open attachment"
              description={fileNotice}
              tone="danger"
              onDismiss={() => setFileNotice(null)}
            />
          ) : null}
          {actionNotice ? (
            <Toast
              title="Review action needs feedback"
              description={actionNotice}
              tone="warning"
              onDismiss={() => setActionNotice(null)}
            />
          ) : null}

          {/* Feedback & Score */}
          <div className="pt-6 border-t border-slate-100 space-y-6">
            <div className="grid gap-6 sm:grid-cols-3">
              <FormField label="Score" className="sm:col-span-1">
                <div className="relative">
                  <Input 
                    type="number"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    max={homework.maxScore}
                    className="pr-16 font-bold text-lg rounded-xl"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase">
                    / {homework.maxScore}
                  </div>
                </div>
              </FormField>
              
              <div className="sm:col-span-2 space-y-2">
                <label className="text-[0.65rem] font-black uppercase tracking-widest text-slate-500 ml-1">
                  Workflow Action
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className={cn(
                      "rounded-xl font-bold h-12",
                      !isCorrectionRequested ? "border-[var(--color-mod-homework-border)] bg-[var(--color-mod-homework-bg)] text-[var(--color-mod-homework-text)]" : "bg-white"
                    )}
                    onClick={() => setIsCorrectionRequested(false)}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve / Grade
                  </Button>
                  <Button
                    variant="outline"
                    className={cn(
                      "rounded-xl font-bold h-12",
                      isCorrectionRequested ? "border-amber-500 bg-amber-50 text-amber-700" : "bg-white"
                    )}
                    onClick={() => setIsCorrectionRequested(true)}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Correction Req.
                  </Button>
                </div>
              </div>
            </div>

            <FormField label="Teacher Feedback">
              <Textarea 
                placeholder="Excellent work! Please pay more attention to..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
                className="rounded-2xl p-4"
              />
            </FormField>
          </div>
        </div>

        <DialogFooter className="p-8 bg-slate-50 border-t border-slate-100 sm:justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            <ShieldCheck className="h-4 w-4" />
            Audit logged review
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">
              Cancel
            </Button>
            {isCorrectionRequested ? (
              <Button 
                onClick={handleRequestCorrection} 
                className="bg-amber-600 hover:bg-amber-700 rounded-xl font-bold px-8 shadow-lg shadow-amber-200"
                disabled={requestCorrectionMutation.isPending}
              >
                Request Correction
              </Button>
            ) : (
              <Button 
                onClick={handleReview} 
                className="bg-[var(--color-mod-homework-accent)] hover:bg-[var(--color-mod-homework-text)] rounded-xl font-bold px-8 shadow-sm"
                disabled={reviewMutation.isPending}
              >
                Submit Review
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
