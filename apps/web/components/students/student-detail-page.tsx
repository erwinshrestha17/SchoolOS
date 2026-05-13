'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ProfileHeader } from './profile/profile-header';
import { LifecyclePanel } from './profile/lifecycle-panel';
import { StudentEditCard } from './profile/student-edit-card';
import * as ProfileTabs from './profile/tabs';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  UpdateStudentProfilePayload, 
  UpdateStudentGuardianPayload, 
  StudentTransferPayload, 
  StudentArchivePayload, 
  StudentDeletePayload 
} from '@schoolos/core';
import { cn } from '@/lib/utils';

type LifecycleAction = 'transfer' | 'archive' | 'alumni' | 'delete';
type LifecycleRequest =
  | { action: 'transfer'; body: StudentTransferPayload }
  | { action: 'archive'; body: StudentArchivePayload }
  | { action: 'alumni'; body: StudentArchivePayload }
  | { action: 'delete'; body: StudentDeletePayload };

const detailTabs = [
  'Overview',
  'Guardians',
  'Health',
  'Documents',
  'Fees',
  'Attendance',
  'Activity',
  'History',
] as const;

type DetailTab = (typeof detailTabs)[number];

export function StudentDetailPage({ studentId }: { studentId: string }) {
  const [pdfError, setPdfError] = useState('');
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction | null>(null);
  const [lifecycleMessage, setLifecycleMessage] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('Overview');

  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('edit') === 'true') {
      setIsEditingStudent(true);
    }

    const requestedTab = searchParams.get('tab');
    if (requestedTab && detailTabs.includes(requestedTab as DetailTab)) {
      setActiveDetailTab(requestedTab as DetailTab);
    }
  }, [searchParams]);

  const profileQuery = useQuery({
    queryKey: ['student-profile', studentId],
    queryFn: () => api.getStudentProfile(studentId),
    enabled: Boolean(studentId),
  });

  const feeClearanceQuery = useQuery({
    queryKey: ['student-fee-clearance', studentId],
    queryFn: () => api.getStudentFeeClearance(studentId),
    enabled: false,
  });

  const studentUpdateMutation = useMutation({
    mutationFn: (body: UpdateStudentProfilePayload) => api.updateStudent(studentId, body),
    onSuccess: (profile) => {
      queryClient.setQueryData(['student-profile', studentId], profile);
      setIsEditingStudent(false);
    },
  });

  const guardianUpdateMutation = useMutation({
    mutationFn: ({ guardianId, body }: { guardianId: string; body: UpdateStudentGuardianPayload }) =>
      api.updateStudentGuardian(studentId, guardianId, body),
    onSuccess: (profile) => {
      queryClient.setQueryData(['student-profile', studentId], profile);
      setEditingGuardianId(null);
    },
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({ action, body }: LifecycleRequest) => {
      if (action === 'transfer') return api.transferStudent(studentId, body);
      if (action === 'archive') return api.archiveStudent(studentId, body);
      if (action === 'alumni') return api.archiveStudentAsAlumni(studentId, body);
      return api.softDeleteStudent(studentId, body);
    },
    onSuccess: (result) => {
      setLifecycleAction(null);
      setLifecycleMessage(`Student status updated to ${result.lifecycleStatus}.`);
      void queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
      void queryClient.invalidateQueries({ queryKey: ['student-fee-clearance', studentId] });
    },
  });

  async function openStudentPdf(kind: string) {
    setPdfError('');
    try {
      await api.openStudentDocumentPdf(studentId, kind);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Could not open PDF.');
    }
  }

  if (profileQuery.isLoading) return <LoadingState variant="page" label="Gathering student profile..." />;
  if (profileQuery.isError || !profileQuery.data) {
    return (
      <EmptyState 
        title="Student Profile Not Found" 
        description="The student record you are looking for does not exist or you do not have permission to view it."
      />
    );
  }

  const profile = profileQuery.data;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <ProfileHeader 
        profile={profile} 
        onEdit={() => setIsEditingStudent(true)} 
        onOpenIdCard={() => void openStudentPdf('id-card')}
        pdfError={pdfError}
      />

      {isEditingStudent && (
        <StudentEditCard 
          profile={profile}
          isSaving={studentUpdateMutation.isPending}
          error={studentUpdateMutation.error}
          onCancel={() => setIsEditingStudent(false)}
          onSave={(body) => studentUpdateMutation.mutate(body)}
        />
      )}

      <LifecyclePanel 
        profile={profile}
        clearance={feeClearanceQuery.data ?? null}
        isCheckingClearance={feeClearanceQuery.isFetching}
        onCheckClearance={() => void feeClearanceQuery.refetch()}
        onSelectAction={setLifecycleAction}
        action={lifecycleAction}
        onCancelAction={() => setLifecycleAction(null)}
        isSaving={lifecycleMutation.isPending}
        message={lifecycleMessage}
      />

      <Tabs value={activeDetailTab} onValueChange={(value) => setActiveDetailTab(value as DetailTab)} className="space-y-8">
        <TabsList className="flex h-auto flex-wrap gap-2 rounded-[2rem] border border-slate-200 bg-white/50 p-2 backdrop-blur-sm w-full justify-start">
          {detailTabs.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="flex-1 min-h-[3rem] rounded-[1.5rem] px-6 text-sm font-bold transition-all data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 bg-transparent shadow-none"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-h-[400px]">
          <TabsContent value="Overview" className="mt-0">
            <ProfileTabs.OverviewTab profile={profile} />
          </TabsContent>
          <TabsContent value="Guardians" className="mt-0">
            <ProfileTabs.GuardiansTab 
              guardians={profile.guardians}
              editingGuardianId={editingGuardianId}
              isSaving={guardianUpdateMutation.isPending}
              error={guardianUpdateMutation.error}
              onCancelEdit={() => setEditingGuardianId(null)}
              onEditGuardian={setEditingGuardianId}
              onSaveGuardian={(id, body) => guardianUpdateMutation.mutate({ guardianId: id, body })}
            />
          </TabsContent>
          <TabsContent value="Health" className="mt-0">
            <ProfileTabs.HealthTab profile={profile} />
          </TabsContent>
          <TabsContent value="Documents" className="mt-0">
            <ProfileTabs.DocumentsTab 
              studentId={studentId}
              documents={profile.documents}
              generatedDocuments={profile.generatedDocuments}
              onOpenPdf={openStudentPdf}
            />
          </TabsContent>
          <TabsContent value="Fees" className="mt-0">
            <ProfileTabs.FeesTab studentId={studentId} invoices={profile.invoices} />
          </TabsContent>
          <TabsContent value="Attendance" className="mt-0">
            <ProfileTabs.AttendanceTab studentId={studentId} />
          </TabsContent>
          <TabsContent value="Activity" className="mt-0">
            <ProfileTabs.ActivityTab posts={profile.activityPosts} />
          </TabsContent>
          <TabsContent value="History" className="mt-0">
            <ProfileTabs.HistoryTab profile={profile} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
