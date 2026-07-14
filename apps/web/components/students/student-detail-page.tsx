'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { MoreHorizontal, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useRecentlyViewed } from '@/lib/hooks/use-recently-viewed';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { ActionMenu } from '@/components/ui/action-menu';
import { useBreadcrumbLabel } from '@/components/schoolos/navigation/breadcrumb-label-context';
import { ProfileHeader } from './profile/profile-header';
import { LifecyclePanel } from './profile/lifecycle-panel';
import { StudentEditCard } from './profile/student-edit-card';
import * as ProfileTabs from './profile/tabs';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  UpdateStudentProfilePayload,
  UpdateStudentGuardianPayload,
  CreateStudentGuardianPayload,
  StudentTransferPayload,
  StudentArchivePayload,
  StudentDeletePayload,
} from '@schoolos/core';

type LifecycleAction = 'transfer' | 'archive' | 'alumni' | 'delete';
type LifecycleRequest =
  | { action: 'transfer'; body: StudentTransferPayload }
  | { action: 'archive'; body: StudentArchivePayload }
  | { action: 'alumni'; body: StudentArchivePayload }
  | { action: 'delete'; body: StudentDeletePayload };

const detailTabs = [
  'Overview',
  'Profile',
  'Attendance',
  'Fees',
  'Health',
  'Documents',
  'Activity',
  'Academics',
  'Guardians',
  'History',
] as const;

type DetailTab = (typeof detailTabs)[number];

const primaryTabs: Array<{ value: DetailTab; label: string }> = [
  { value: 'Overview', label: 'Overview' },
  { value: 'Profile', label: 'Profile' },
  { value: 'Academics', label: 'Academic' },
  { value: 'Attendance', label: 'Attendance' },
  { value: 'Fees', label: 'Fees' },
  { value: 'Documents', label: 'Documents' },
  { value: 'Guardians', label: 'Guardians' },
  { value: 'History', label: 'Timeline' },
];

const overflowTabs: Array<{ value: DetailTab; label: string }> = [
  { value: 'Activity', label: 'Activity' },
  { value: 'Health', label: 'Support & safety' },
];

const requestedTabAliases: Record<string, DetailTab> = {
  Profile: 'Profile',
  Academic: 'Academics',
  Timeline: 'History',
  'Support & Safety': 'Health',
  'Support & safety': 'Health',
};

export function StudentDetailPage({ studentId }: { studentId: string }) {
  const [pdfError, setPdfError] = useState('');
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [isAddingGuardian, setIsAddingGuardian] = useState(false);
  const [isLifecycleOpen, setIsLifecycleOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction | null>(null);
  const [lifecycleMessage, setLifecycleMessage] = useState('');
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('Overview');

  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { record: recordRecentlyViewed } = useRecentlyViewed();

  useEffect(() => {
    if (searchParams.get('edit') === 'true') {
      setIsEditingStudent(true);
    }

    const requestedTab = searchParams.get('tab');
    if (!requestedTab) return;

    const normalizedTab = requestedTabAliases[requestedTab] ?? requestedTab;
    if (detailTabs.includes(normalizedTab as DetailTab)) {
      setActiveDetailTab(normalizedTab as DetailTab);
    }
  }, [searchParams]);

  const profileQuery = useQuery({
    queryKey: ['student-profile', studentId],
    queryFn: () => api.getStudentProfile(studentId),
    enabled: Boolean(studentId),
  });

  const loadedStudent = profileQuery.data?.student;
  const loadedStudentLabel = loadedStudent
    ? loadedStudent.fullNameEn ||
      `${loadedStudent.firstNameEn ?? ''} ${loadedStudent.lastNameEn ?? ''}`.trim() ||
      'Student'
    : null;

  useBreadcrumbLabel(loadedStudentLabel);

  useEffect(() => {
    if (!loadedStudent || !loadedStudentLabel) return;
    recordRecentlyViewed({
      kind: 'student',
      id: studentId,
      label: loadedStudentLabel,
      href: `/dashboard/students/${studentId}`,
    });
    // Only record when the loaded student identity changes, not on every
    // background refetch/re-render of the same profile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, profileQuery.data?.student.fullNameEn]);

  const feeClearanceQuery = useQuery({
    queryKey: ['student-fee-clearance', studentId],
    queryFn: () => api.getStudentFeeClearance(studentId),
    enabled: Boolean(studentId),
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

  const guardianCreateMutation = useMutation({
    mutationFn: (body: CreateStudentGuardianPayload) => api.addStudentGuardian(studentId, body),
    onSuccess: (profile) => {
      queryClient.setQueryData(['student-profile', studentId], profile);
      setIsAddingGuardian(false);
    },
  });

  const guardianRemoveMutation = useMutation({
    mutationFn: ({
      guardianId,
      reason,
      confirmFileAccessReview,
      newPrimaryGuardianId,
    }: {
      guardianId: string;
      reason: string;
      confirmFileAccessReview: true;
      newPrimaryGuardianId?: string | null;
    }) =>
      api.removeStudentGuardianAccess(studentId, guardianId, {
        reason,
        confirmFileAccessReview,
        newPrimaryGuardianId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
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

  const photoUploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadStudentPhoto(studentId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const photoRemoveMutation = useMutation({
    mutationFn: () => api.removeStudentPhoto(studentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  async function openStudentPdf(kind: string) {
    setPdfError('');
    try {
      await api.openStudentDocumentPdf(studentId, kind);
    } catch (err: unknown) {
      setPdfError(err instanceof Error ? err.message : 'Failed to generate document');
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
  const activeOverflowTab = overflowTabs.find((tab) => tab.value === activeDetailTab);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <ProfileHeader
        profile={profile}
        onEdit={() => setIsEditingStudent(true)}
        onOpenIdCard={() => void openStudentPdf('id-card')}
        onSelectTab={(tab) => setActiveDetailTab(tab)}
        onManageLifecycle={() => {
          setLifecycleMessage('');
          setLifecycleAction(null);
          setIsLifecycleOpen(true);
        }}
        feeClearance={feeClearanceQuery.data ?? null}
        isFeeClearanceLoading={feeClearanceQuery.isLoading || feeClearanceQuery.isFetching}
        isFeeClearanceError={feeClearanceQuery.isError}
        pdfError={pdfError}
      />

      {isEditingStudent ? (
        <StudentEditCard
          profile={profile}
          isSaving={studentUpdateMutation.isPending}
          error={studentUpdateMutation.error}
          isUploadingPhoto={photoUploadMutation.isPending}
          photoError={photoUploadMutation.error ?? photoRemoveMutation.error}
          onUploadPhoto={(file) => photoUploadMutation.mutate(file)}
          onRemovePhoto={() => photoRemoveMutation.mutate()}
          isRemovingPhoto={photoRemoveMutation.isPending}
          onCancel={() => setIsEditingStudent(false)}
          onSave={(body) => studentUpdateMutation.mutate(body)}
        />
      ) : null}

      {isLifecycleOpen ? (
        <LifecyclePanel
          profile={profile}
          clearance={feeClearanceQuery.data ?? null}
          isCheckingClearance={feeClearanceQuery.isFetching}
          onCheckClearance={() => void feeClearanceQuery.refetch()}
          onSelectAction={setLifecycleAction}
          action={lifecycleAction}
          onCancelAction={() => setLifecycleAction(null)}
          onClose={() => {
            setLifecycleAction(null);
            setIsLifecycleOpen(false);
          }}
          onSubmit={(request) => lifecycleMutation.mutate(request)}
          isSaving={lifecycleMutation.isPending}
          error={lifecycleMutation.error}
          message={lifecycleMessage}
        />
      ) : null}

      <Tabs value={activeDetailTab} onValueChange={(value) => setActiveDetailTab(value as DetailTab)} className="space-y-6">
        <div className="border-b border-slate-200">
          <TabsList className="flex h-auto w-full items-center gap-1 overflow-x-auto rounded-none border-0 bg-transparent p-0 shadow-none">
            {primaryTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="min-h-11 flex-none rounded-t-lg rounded-b-none border-b-2 border-transparent bg-transparent px-4 text-sm font-bold text-slate-500 shadow-none transition hover:bg-slate-50 hover:text-slate-900 data-[state=active]:border-[var(--color-mod-admissions-accent)] data-[state=active]:bg-transparent data-[state=active]:text-[var(--color-mod-admissions-text)] data-[state=active]:shadow-none"
              >
                {tab.label}
              </TabsTrigger>
            ))}
            <ActionMenu
              align="right"
              label="More student profile sections"
              trigger={
                <button
                  type="button"
                  className={`flex min-h-11 flex-none items-center gap-1 rounded-t-lg border-b-2 px-4 text-sm font-bold transition ${
                    activeOverflowTab
                      ? 'border-[var(--color-mod-admissions-accent)] text-[var(--color-mod-admissions-text)]'
                      : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <MoreHorizontal size={17} aria-hidden="true" />
                  {activeOverflowTab?.label ?? 'More'}
                </button>
              }
              items={overflowTabs.map((tab) => ({
                label: tab.label,
                icon: tab.value === 'Health' ? <ShieldCheck size={16} /> : undefined,
                onClick: () => setActiveDetailTab(tab.value),
              }))}
            />
          </TabsList>
        </div>

        <div className="min-h-[400px]">
          <TabsContent value="Overview" className="mt-0">
            <ProfileTabs.OverviewTab profile={profile} onOpenPdf={openStudentPdf} onSelectTab={(tab) => setActiveDetailTab(tab)} />
          </TabsContent>
          <TabsContent value="Profile" className="mt-0">
            <ProfileTabs.ProfileTab profile={profile} />
          </TabsContent>
          <TabsContent value="Guardians" className="mt-0">
            <ProfileTabs.GuardiansTab
              guardians={profile.guardians}
              editingGuardianId={editingGuardianId}
              isAddingGuardian={isAddingGuardian}
              isSaving={guardianUpdateMutation.isPending || guardianCreateMutation.isPending || guardianRemoveMutation.isPending}
              error={guardianUpdateMutation.error ?? guardianCreateMutation.error ?? guardianRemoveMutation.error}
              onCancelEdit={() => setEditingGuardianId(null)}
              onEditGuardian={setEditingGuardianId}
              onSaveGuardian={(id, body) => guardianUpdateMutation.mutate({ guardianId: id, body })}
              onAddGuardian={() => setIsAddingGuardian(true)}
              onCancelAdd={() => setIsAddingGuardian(false)}
              onCreateGuardian={(body) => guardianCreateMutation.mutate(body)}
              onRemoveGuardian={(guardianId, reason, confirmFileAccessReview, newPrimaryGuardianId) =>
                guardianRemoveMutation.mutate({ guardianId, reason, confirmFileAccessReview, newPrimaryGuardianId })
              }
            />
          </TabsContent>
          <TabsContent value="Academics" className="mt-0">
            <ProfileTabs.AcademicsTab profile={profile} onOpenPdf={openStudentPdf} />
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
          <TabsContent value="Health" className="mt-0">
            <ProfileTabs.HealthTab profile={profile} />
          </TabsContent>
          <TabsContent value="Attendance" className="mt-0">
            <ProfileTabs.AttendanceTab
              profile={profile}
              onBackToProfile={() => setActiveDetailTab('Overview')}
            />
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
