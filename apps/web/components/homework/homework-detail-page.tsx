'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  BookOpen, 
  Calendar, 
  Users, 
  Clock, 
  Bell, 
  FileCheck2, 
  AlertCircle, 
  ChevronLeft,
  MoreVertical,
  Trash2,
  CheckCircle2,
  MessageSquare,
  FileText,
  Download
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { api } from '@/lib/api';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/data-table';
import { ActionMenu } from '@/components/ui/action-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { HomeworkReviewModal } from '@/components/homework/homework-review-modal';

export function HomeworkDetailPage({ homeworkId }: { homeworkId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const activeTab = searchParams.get('tab') || 'submissions';
  
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  const homeworkQuery = useQuery({
    queryKey: ['homework-detail', homeworkId],
    queryFn: () => api.getHomework(homeworkId),
    enabled: Boolean(homeworkId),
  });

  const submissionsQuery = useQuery({
    queryKey: ['homework-submissions', homeworkId],
    queryFn: () => api.listHomeworkAssignmentSubmissions(homeworkId),
    enabled: Boolean(homeworkId),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelHomework(homeworkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework-detail', homeworkId] });
      setShowCancelDialog(false);
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to cancel homework');
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: () => api.sendHomeworkReminders(homeworkId),
    onSuccess: () => {
      alert('Reminders sent to students');
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to send reminders');
    },
  });

  if (homeworkQuery.isLoading) return <LoadingState variant="page" label="Loading homework details..." />;
  if (homeworkQuery.isError || !homeworkQuery.data) {
    return (
      <EmptyState 
        title="Homework Not Found" 
        description="The homework assignment you are looking for does not exist or has been removed."
        action={
          <Link href="/dashboard/homework">
            <Button variant="outline" className="rounded-xl">Back to Homework</Button>
          </Link>
        }
      />
    );
  }

  const homework = homeworkQuery.data as any;

  const submissionColumns = [
    {
      header: 'Student',
      accessorKey: 'student.fullNameEn',
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{row.student?.fullNameEn}</span>
          <span className="text-xs text-slate-500">{row.student?.studentSystemId}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row: any) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Submitted At',
      accessorKey: 'submittedAt',
      cell: (row: any) => row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—',
    },
    {
      header: 'Score',
      accessorKey: 'score',
      cell: (row: any) => (
        <span className="font-medium">
          {row.score !== null ? `${row.score} / ${homework.maxScore}` : '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: (row: any) => (
        <ActionMenu
          items={[
            {
              label: 'Review',
              icon: <FileCheck2 className="h-4 w-4" />,
              onClick: () => { 
                setSelectedSubmission(row);
                setIsReviewModalOpen(true);
              },
            },
            {
              label: 'Message Student',
              icon: <MessageSquare className="h-4 w-4" />,
              onClick: () => router.push(`/dashboard/messages/new?studentId=${row.studentId}`),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/homework">
            <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex flex-col">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 italic uppercase">
              Homework Detail
            </h1>
            <p className="text-slate-500 font-medium">Manage submissions and reminders for this assignment.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="rounded-2xl font-bold"
            onClick={() => setShowCancelDialog(true)}
            disabled={homework.status === 'CANCELLED'}
          >
            <Trash2 className="mr-2 h-5 w-5 text-red-500" />
            Cancel Assignment
          </Button>
          <Button 
            className="rounded-2xl font-bold shadow-lg shadow-primary-500/20"
            disabled={homework.status === 'CLOSED'}
          >
            Edit Assignment
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SectionCard
            title={homework.title}
            headerAction={<StatusBadge status={homework.status || 'DRAFT'} />}
          >
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Due Date</span>
                  <span className="text-sm font-bold text-slate-900">
                    {homework.dueAt ? new Date(homework.dueAt).toLocaleString() : 'No date'}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Subject</span>
                  <span className="text-sm font-bold text-slate-900">{homework.subject?.name}</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Class</span>
                  <span className="text-sm font-bold text-slate-900">
                    {homework.class?.name} {homework.section?.name ? `- ${homework.section.name}` : ''}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2">Instructions</h3>
                <div className="p-6 rounded-[2rem] bg-slate-50 text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {homework.instructions}
                </div>
              </div>

              {homework.attachments && homework.attachments.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary-500" />
                    Attachments
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {homework.attachments.map((attachment: any) => (
                      <div 
                        key={attachment.id}
                        className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-white shadow-sm hover:border-primary-200 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-primary-500">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900 truncate max-w-[150px]">
                              {attachment.fileAsset?.originalFilename}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {Math.round((attachment.fileAsset?.sizeBytes || 0) / 1024)} KB
                            </span>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-xl text-slate-400 hover:text-primary-600 hover:bg-primary-50"
                          onClick={async () => {
                            try {
                              const view = await api.getFileView(attachment.fileAssetId);
                              window.open(view.url, '_blank');
                            } catch (err) {
                              alert('Failed to open file');
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
            </div>
          </SectionCard>

          <Tabs defaultValue={activeTab} onValueChange={(val) => router.push(`?tab=${val}`)}>
            <TabsList className="bg-slate-100 p-1.5 rounded-[1.5rem] inline-flex h-auto">
              <TabsTrigger 
                value="submissions" 
                className="rounded-[1.2rem] px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 font-black uppercase tracking-widest text-[10px]"
              >
                Submissions
              </TabsTrigger>
              <TabsTrigger 
                value="reminders" 
                className="rounded-[1.2rem] px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 font-black uppercase tracking-widest text-[10px]"
              >
                Reminders
              </TabsTrigger>
            </TabsList>

            <TabsContent value="submissions" className="mt-6">
              {submissionsQuery.isLoading ? (
                <LoadingState label="Loading submissions..." />
              ) : submissionsQuery.data?.length === 0 ? (
                <EmptyState 
                  title="No submissions yet" 
                  description="Students haven't submitted any work for this assignment yet."
                />
              ) : (
                <DataTable columns={submissionColumns} data={submissionsQuery.data ?? []} />
              )}
            </TabsContent>

            <TabsContent value="reminders" className="mt-6">
              <SectionCard
                title="Homework Reminders"
                description="Send nudge notifications to students who haven't submitted yet."
              >
                <div className="space-y-6">
                  <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-amber-900">Important Note</p>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Reminder sending is protected against duplicate daily sends. You can only send one reminder per assignment per day.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm flex flex-col items-center justify-center text-center">
                      <Clock className="h-8 w-8 text-indigo-500 mb-2 opacity-20" />
                      <span className="text-2xl font-black text-slate-900">
                        {submissionsQuery.data?.filter(s => s.status === 'PENDING').length ?? 0}
                      </span>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Awaiting</span>
                    </div>
                    <div className="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm flex flex-col items-center justify-center text-center">
                      <AlertCircle className="h-8 w-8 text-red-500 mb-2 opacity-20" />
                      <span className="text-2xl font-black text-slate-900">
                        {homework.dueAt && new Date(homework.dueAt) < new Date() ? submissionsQuery.data?.filter(s => s.status === 'PENDING').length ?? 0 : 0}
                      </span>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overdue</span>
                    </div>
                    <div className="p-6 rounded-[2rem] border border-slate-100 bg-white shadow-sm flex flex-col items-center justify-center text-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-20" />
                      <span className="text-2xl font-black text-slate-900">
                        {submissionsQuery.data?.filter(s => s.status === 'SUBMITTED' || s.status === 'REVIEWED').length ?? 0}
                      </span>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Submitted</span>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button 
                      size="lg" 
                      className="rounded-2xl font-bold px-8 shadow-lg shadow-primary-500/20"
                      onClick={() => sendReminderMutation.mutate()}
                      disabled={sendReminderMutation.isPending || homework.status === 'CLOSED'}
                    >
                      <Bell className="mr-2 h-5 w-5" />
                      {sendReminderMutation.isPending ? 'Sending...' : 'Send Reminders Now'}
                    </Button>
                  </div>
                </div>
              </SectionCard>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Assignment Summary"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm font-medium text-slate-500">Total Students</span>
                <span className="text-sm font-bold text-slate-900">{submissionsQuery.data?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm font-medium text-slate-500">Submission Rate</span>
                <span className="text-sm font-bold text-slate-900">
                  {submissionsQuery.data?.length 
                    ? Math.round((submissionsQuery.data.filter(s => s.status !== 'PENDING').length / submissionsQuery.data.length) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm font-medium text-slate-500">Max Score</span>
                <span className="text-sm font-bold text-slate-900">{homework.maxScore}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-slate-500">Assigned Date</span>
                <span className="text-sm font-bold text-slate-900">
                  {homework.assignedDate ? new Date(homework.assignedDate).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Activity & Audit"
          >
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Homework Published</p>
                  <p className="text-[10px] text-slate-500">{homework.assignedDate ? new Date(homework.assignedDate).toLocaleString() : '—'}</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic">Audit/activity log will be expanded in future updates.</p>
            </div>
          </SectionCard>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={() => cancelMutation.mutate()}
        title="Cancel Homework"
        description="Are you sure you want to cancel this assignment? This action cannot be undone and students will no longer be able to submit."
        confirmLabel="Cancel Assignment"
        variant="destructive"
      />

      <HomeworkReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setSelectedSubmission(null);
        }}
        submission={selectedSubmission}
        homework={homework}
      />
    </div>
  );
}
