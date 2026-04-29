'use client';

import type {
  ActivityPost,
  GeneratedStudentDocumentMeta,
  GuardianProfile,
  StudentDocument,
  StudentFeeClearance,
  StudentFeeLedger,
  StudentArchivePayload,
  StudentDeletePayload,
  StudentProfileAttendanceRecord,
  StudentProfileDetail,
  StudentProfileInvoice,
  StudentTransferPayload,
  UpdateStudentGuardianPayload,
  UpdateStudentProfilePayload,
} from '@schoolos/core';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '../../lib/api';
import { fileToBase64Payload } from '../../lib/files';

type StudentDetailPageProps = {
  studentId: string;
};

const detailTabs = [
  'Overview',
  'Guardians',
  'Documents',
  'Fees',
  'Attendance',
  'Activity',
  'History',
] as const;

type DetailTab = (typeof detailTabs)[number];

const generatedDocumentActions = [
  ['id-card', 'ID card'],
  ['transfer-certificate', 'Transfer certificate'],
  ['leaving-certificate', 'Leaving certificate'],
  ['character-certificate', 'Character certificate'],
] as const;

const uploadedDocumentKinds = [
  ['BIRTH_CERTIFICATE', 'Birth certificate'],
  ['TRANSFER_CERTIFICATE', 'Transfer certificate'],
  ['PHOTO', 'Photo'],
  ['ID_CARD', 'ID card'],
  ['ENROLLMENT_CONFIRMATION', 'Enrollment confirmation'],
  ['OTHER', 'Other'],
] as const;

type LifecycleAction = 'transfer' | 'archive' | 'alumni' | 'delete';
type LifecycleRequest =
  | { action: 'transfer'; body: StudentTransferPayload }
  | { action: 'archive'; body: StudentArchivePayload }
  | { action: 'alumni'; body: StudentArchivePayload }
  | { action: 'delete'; body: StudentDeletePayload };

export function StudentDetailPage({ studentId }: StudentDetailPageProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('Overview');
  const [pdfError, setPdfError] = useState('');
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [lifecycleAction, setLifecycleAction] =
    useState<LifecycleAction | null>(null);
  const [lifecycleMessage, setLifecycleMessage] = useState('');
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ['student-profile', studentId],
    queryFn: () => api.getStudentProfile(studentId),
    enabled: Boolean(studentId),
  });
  const feeClearanceQuery = useQuery({
    queryKey: ['student-fee-clearance', studentId],
    queryFn: () => api.getStudentFeeClearance(studentId),
    enabled: Boolean(studentId),
  });
  const studentUpdateMutation = useMutation({
    mutationFn: (body: UpdateStudentProfilePayload) =>
      api.updateStudent(studentId, body),
    onSuccess: (profile) => {
      queryClient.setQueryData(['student-profile', studentId], profile);
      setIsEditingStudent(false);
    },
  });
  const guardianUpdateMutation = useMutation({
    mutationFn: ({
      guardianId,
      body,
    }: {
      guardianId: string;
      body: UpdateStudentGuardianPayload;
    }) => api.updateStudentGuardian(studentId, guardianId, body),
    onSuccess: (profile) => {
      queryClient.setQueryData(['student-profile', studentId], profile);
      setEditingGuardianId(null);
    },
  });
  const lifecycleMutation = useMutation({
    mutationFn: ({ action, body }: LifecycleRequest) => {
      if (action === 'transfer') {
        return api.transferStudent(studentId, body);
      }

      if (action === 'archive') {
        return api.archiveStudent(studentId, body);
      }

      if (action === 'alumni') {
        return api.archiveStudentAsAlumni(studentId, body);
      }

      return api.softDeleteStudent(studentId, body);
    },
    onSuccess: async (result) => {
      setLifecycleAction(null);
      setLifecycleMessage(
        `Student status updated to ${result.lifecycleStatus}.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] }),
        queryClient.invalidateQueries({
          queryKey: ['student-fee-clearance', studentId],
        }),
      ]);
    },
  });

  async function openStudentPdf(kind: string) {
    if (!profileQuery.data?.student.id) {
      return;
    }

    setPdfError('');

    try {
      await api.openStudentDocumentPdf(profileQuery.data.student.id, kind);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Could not open PDF.');
    }
  }

  if (!studentId) {
    return (
      <StudentDetailShell title="Student profile unavailable">
        <ErrorCard message="No student ID was provided in the route." />
      </StudentDetailShell>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <StudentDetailShell title="Loading student profile">
        <ProfileSkeleton />
      </StudentDetailShell>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <StudentDetailShell title="Student profile unavailable">
        <ErrorCard
          message={
            (profileQuery.error as Error | null)?.message ||
            'Student profile could not be loaded.'
          }
        />
      </StudentDetailShell>
    );
  }

  const profile = profileQuery.data;
  const studentName = getStudentName(profile);

  return (
    <StudentDetailShell title={studentName}>
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-primary-50 text-xl font-bold text-primary-700">
              {initials(studentName)}
            </div>
            <div>
              <p className="label mb-2">Student Profile</p>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                {studentName}
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                {profile.student.studentSystemId} /{' '}
                {profile.student.className ?? profile.student.class?.name ?? 'No class'} /{' '}
                {profile.student.sectionName ?? profile.student.section ?? 'No section'}
                {profile.student.rollNumber ? ` / Roll ${profile.student.rollNumber}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge>{profile.student.lifecycleStatus ?? 'ACTIVE'}</Badge>
                <Badge>{profile.student.gender ?? 'Gender not set'}</Badge>
                {profile.student.disabilityFlag ? (
                  <Badge>{profile.student.disabilityFlag}</Badge>
                ) : (
                  <Badge>No known disability</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/admissions"
              className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
            >
              Back to Directory
            </Link>
            <Link
              href={`/dashboard/finance?studentId=${encodeURIComponent(profile.student.id)}`}
              className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
            >
              Collect Fee
            </Link>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
              onClick={() => setIsEditingStudent(true)}
            >
              Edit Student
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white"
              onClick={() => void openStudentPdf('id-card')}
            >
              Open ID Card
            </button>
          </div>
        </div>

        {pdfError ? (
          <p className="mt-4 rounded-2xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-600">
            {pdfError}
          </p>
        ) : null}
      </section>

      {isEditingStudent ? (
        <StudentEditCard
          profile={profile}
          isSaving={studentUpdateMutation.isPending}
          error={studentUpdateMutation.error}
          onCancel={() => {
            studentUpdateMutation.reset();
            setIsEditingStudent(false);
          }}
          onSave={(body) => studentUpdateMutation.mutate(body)}
        />
      ) : null}

      <LifecycleActionsPanel
        action={lifecycleAction}
        clearance={feeClearanceQuery.data ?? null}
        clearanceError={feeClearanceQuery.error}
        isCheckingClearance={feeClearanceQuery.isFetching}
        isSaving={lifecycleMutation.isPending}
        message={lifecycleMessage}
        mutationError={lifecycleMutation.error}
        profile={profile}
        onCancelAction={() => {
          lifecycleMutation.reset();
          setLifecycleAction(null);
        }}
        onCheckClearance={() => void feeClearanceQuery.refetch()}
        onOpenCertificate={(kind) => void openStudentPdf(kind)}
        onSelectAction={(action) => {
          setLifecycleMessage('');
          lifecycleMutation.reset();
          setLifecycleAction(action);
        }}
        onSubmitAction={(action, body) =>
          lifecycleMutation.mutate({ action, body } as LifecycleRequest)
        }
      />

      <section className="rounded-3xl border border-gray-200 bg-white p-2 shadow-sm">
        <div
          aria-label="Student profile sections"
          className="grid gap-2 md:grid-cols-4 xl:grid-cols-7"
        >
          {detailTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`min-h-11 rounded-2xl px-3 text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {activeTab === 'Overview' ? <OverviewTab profile={profile} /> : null}
      {activeTab === 'Guardians' ? (
        <GuardiansTab
          guardians={profile.guardians}
          editingGuardianId={editingGuardianId}
          isSaving={guardianUpdateMutation.isPending}
          error={guardianUpdateMutation.error}
          onCancelEdit={() => {
            guardianUpdateMutation.reset();
            setEditingGuardianId(null);
          }}
          onEditGuardian={(guardianId) => {
            guardianUpdateMutation.reset();
            setEditingGuardianId(guardianId);
          }}
          onSaveGuardian={(guardianId, body) =>
            guardianUpdateMutation.mutate({ guardianId, body })
          }
        />
      ) : null}
      {activeTab === 'Documents' ? (
        <DocumentsTab
          studentId={profile.student.id}
          documents={profile.documents}
          generatedDocuments={profile.generatedDocuments}
          onOpenPdf={openStudentPdf}
        />
      ) : null}
      {activeTab === 'Fees' ? (
        <FeesTab studentId={profile.student.id} invoices={profile.invoices} />
      ) : null}
      {activeTab === 'Attendance' ? (
        <AttendanceTab records={profile.attendanceRecords} />
      ) : null}
      {activeTab === 'Activity' ? (
        <ActivityTab posts={profile.activityPosts} />
      ) : null}
      {activeTab === 'History' ? <HistoryTab profile={profile} /> : null}
    </StudentDetailShell>
  );
}

function StudentEditCard({
  error,
  isSaving,
  onCancel,
  onSave,
  profile,
}: {
  error: unknown;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (body: UpdateStudentProfilePayload) => void;
  profile: StudentProfileDetail;
}) {
  const student = profile.student;
  const [firstNameEn, setFirstNameEn] = useState(student.firstNameEn ?? '');
  const [lastNameEn, setLastNameEn] = useState(student.lastNameEn ?? '');
  const [firstNameNp, setFirstNameNp] = useState(
    splitNepaliName(student.fullNameNp).firstNameNp,
  );
  const [lastNameNp, setLastNameNp] = useState(
    splitNepaliName(student.fullNameNp).lastNameNp,
  );
  const [dateOfBirth, setDateOfBirth] = useState(
    student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '',
  );
  const [gender, setGender] = useState(student.gender ?? 'FEMALE');
  const [nationalStudentId, setNationalStudentId] = useState(
    student.nationalStudentId ?? '',
  );
  const [motherTongue, setMotherTongue] = useState(student.motherTongue ?? '');
  const [disabilityStatus, setDisabilityStatus] = useState(
    student.disabilityFlag ? 'yes' : 'no',
  );
  const [disabilityFlag, setDisabilityFlag] = useState(
    student.disabilityFlag ?? '',
  );
  const [validationError, setValidationError] = useState('');

  function submit() {
    setValidationError('');

    if (!firstNameEn.trim() || !lastNameEn.trim()) {
      setValidationError('First name and last name are required.');
      return;
    }

    if (!dateOfBirth) {
      setValidationError('Date of birth is required.');
      return;
    }

    if (disabilityStatus === 'yes' && !disabilityFlag.trim()) {
      setValidationError(
        'Enter disability or special support details, or choose no known disability.',
      );
      return;
    }

    onSave({
      firstNameEn: firstNameEn.trim(),
      lastNameEn: lastNameEn.trim(),
      firstNameNp: firstNameNp.trim() || null,
      lastNameNp: lastNameNp.trim() || null,
      dateOfBirth,
      gender,
      motherTongue: motherTongue.trim() || null,
      nationalStudentId: nationalStudentId.trim() || null,
      disabilityFlag:
        disabilityStatus === 'yes' ? disabilityFlag.trim() : null,
      confirmNoDisability: disabilityStatus === 'no',
    });
  }

  return (
    <SectionCard title="Edit Student">
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Student ID <strong>{student.studentSystemId}</strong> is immutable.
        Placement changes stay backend-validated for class, section, and roll
        conflicts.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="First name (EN)">
          <input
            className="input"
            value={firstNameEn}
            onChange={(event) => setFirstNameEn(event.target.value)}
          />
        </Field>
        <Field label="Last name (EN)">
          <input
            className="input"
            value={lastNameEn}
            onChange={(event) => setLastNameEn(event.target.value)}
          />
        </Field>
        <Field label="First name (NP)">
          <input
            className="input"
            value={firstNameNp}
            onChange={(event) => setFirstNameNp(event.target.value)}
          />
        </Field>
        <Field label="Last name (NP)">
          <input
            className="input"
            value={lastNameNp}
            onChange={(event) => setLastNameNp(event.target.value)}
          />
        </Field>
        <Field label="Date of birth">
          <input
            className="input"
            type="date"
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
          />
        </Field>
        <Field label="Gender">
          <select
            className="input"
            value={gender}
            onChange={(event) => setGender(event.target.value)}
          >
            <option value="FEMALE">Female</option>
            <option value="MALE">Male</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="National student ID">
          <input
            className="input"
            value={nationalStudentId}
            onChange={(event) => setNationalStudentId(event.target.value)}
          />
        </Field>
        <Field label="Mother tongue">
          <input
            className="input"
            value={motherTongue}
            onChange={(event) => setMotherTongue(event.target.value)}
          />
        </Field>
      </div>

      <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p className="label mb-3">Disability status / iEMIS requirement</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700">
            <input
              type="radio"
              name="student-disability-status"
              checked={disabilityStatus === 'no'}
              onChange={() => setDisabilityStatus('no')}
            />
            No known disability
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700">
            <input
              type="radio"
              name="student-disability-status"
              checked={disabilityStatus === 'yes'}
              onChange={() => setDisabilityStatus('yes')}
            />
            Disability / special support need present
          </label>
        </div>
        {disabilityStatus === 'yes' ? (
          <Field label="Disability or support details">
            <input
              className="input"
              value={disabilityFlag}
              onChange={(event) => setDisabilityFlag(event.target.value)}
            />
          </Field>
        ) : null}
      </div>

      {validationError ? <InlineError message={validationError} /> : null}
      {error ? <InlineError message={errorMessage(error)} /> : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={isSaving}
          onClick={submit}
        >
          {isSaving ? 'Saving...' : 'Save Student'}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </SectionCard>
  );
}

function LifecycleActionsPanel({
  action,
  clearance,
  clearanceError,
  isCheckingClearance,
  isSaving,
  message,
  mutationError,
  onCancelAction,
  onCheckClearance,
  onOpenCertificate,
  onSelectAction,
  onSubmitAction,
  profile,
}: {
  action: LifecycleAction | null;
  clearance: StudentFeeClearance | null;
  clearanceError: unknown;
  isCheckingClearance: boolean;
  isSaving: boolean;
  message: string;
  mutationError: unknown;
  onCancelAction: () => void;
  onCheckClearance: () => void;
  onOpenCertificate: (kind: string) => void;
  onSelectAction: (action: LifecycleAction) => void;
  onSubmitAction: (action: LifecycleAction, body: Record<string, unknown>) => void;
  profile: StudentProfileDetail;
}) {
  const status = profile.student.lifecycleStatus ?? 'ACTIVE';
  const active = status === 'ACTIVE';
  const exited = status === 'EXITED' || status === 'TRANSFERRED';
  const outstanding = clearance?.outstandingAmount ?? 0;
  const hasOutstanding = clearance ? !clearance.cleared : false;

  return (
    <SectionCard title="Lifecycle / Actions">
      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="label mb-2">Current status</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{status}</Badge>
            {clearance ? (
              <Badge>
                {clearance.cleared
                  ? 'Fee cleared'
                  : `Outstanding Rs. ${formatMoney(outstanding)}`}
              </Badge>
            ) : (
              <Badge>Fee clearance not checked</Badge>
            )}
          </div>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            Lifecycle changes are tenant-scoped, RBAC-protected, audited, and
            never hard-delete financial, attendance, or document history.
          </p>
          {clearanceError ? (
            <InlineError message={errorMessage(clearanceError)} />
          ) : null}
          {message ? (
            <p className="mt-4 rounded-2xl border border-success-200 bg-success-50 p-3 text-sm text-success-700">
              {message}
            </p>
          ) : null}
          {hasOutstanding ? (
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Outstanding fees must be cleared before transfer, archive, or
              soft-delete actions. Use Fee Collection before continuing.
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 disabled:opacity-60"
              disabled={isCheckingClearance}
              onClick={onCheckClearance}
            >
              {isCheckingClearance ? 'Checking...' : 'Check Fee Clearance'}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
              onClick={() => onOpenCertificate('transfer-certificate')}
            >
              Open Transfer Certificate
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
              onClick={() => onOpenCertificate('leaving-certificate')}
            >
              Open Leaving Certificate
            </button>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <LifecycleButton
              disabled={!active}
              label="Transfer Student"
              onClick={() => onSelectAction('transfer')}
            />
            <LifecycleButton
              disabled={!active}
              label="Archive / Inactive"
              onClick={() => onSelectAction('archive')}
            />
            <LifecycleButton
              disabled={!exited}
              label="Archive as Alumni"
              onClick={() => onSelectAction('alumni')}
            />
            <LifecycleButton
              danger
              disabled={!active}
              label="Request Soft Delete"
              onClick={() => onSelectAction('delete')}
            />
          </div>

          {action ? (
            <LifecycleActionForm
              action={action}
              clearance={clearance}
              isSaving={isSaving}
              mutationError={mutationError}
              onCancel={onCancelAction}
              onSubmit={(body) => onSubmitAction(action, body)}
            />
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}

function LifecycleButton({
  danger,
  disabled,
  label,
  onClick,
}: {
  danger?: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? 'border border-danger-200 bg-danger-50 text-danger-700'
          : 'border border-gray-200 bg-gray-50 text-gray-700'
      }`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function LifecycleActionForm({
  action,
  clearance,
  isSaving,
  mutationError,
  onCancel,
  onSubmit,
}: {
  action: LifecycleAction;
  clearance: StudentFeeClearance | null;
  isSaving: boolean;
  mutationError: unknown;
  onCancel: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [reason, setReason] = useState('');
  const [actionDate, setActionDate] = useState(today);
  const [destinationSchool, setDestinationSchool] = useState('');
  const [conductRemark, setConductRemark] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [validationError, setValidationError] = useState('');
  const needsClearance =
    action === 'transfer' || action === 'archive' || action === 'delete';
  const outstanding = clearance?.outstandingAmount ?? 0;
  const blockedByFees = needsClearance && clearance ? !clearance.cleared : false;

  function submit() {
    setValidationError('');

    if (!reason.trim()) {
      setValidationError('Reason is required for lifecycle changes.');
      return;
    }

    if (!actionDate) {
      setValidationError('Transfer/leaving date is required.');
      return;
    }

    if (blockedByFees) {
      setValidationError(
        `Outstanding fees of Rs. ${formatMoney(outstanding)} must be cleared first.`,
      );
      return;
    }

    if (action === 'delete' && confirmation !== 'SOFT DELETE') {
      setValidationError('Type SOFT DELETE to confirm this audited action.');
      return;
    }

    if (action === 'transfer') {
      onSubmit({
        reason: reason.trim(),
        exitedAt: actionDate,
        destinationSchool: destinationSchool.trim() || null,
        conductRemark: conductRemark.trim() || null,
      });
      return;
    }

    if (action === 'delete') {
      onSubmit({
        reason: reason.trim(),
        deletedAt: actionDate,
      });
      return;
    }

    onSubmit({
      reason: reason.trim(),
      exitedAt: actionDate,
    });
  }

  return (
    <div className="mt-4 rounded-2xl border border-primary-100 bg-primary-50/40 p-4">
      <p className="label mb-3">{lifecycleActionTitle(action)}</p>
      {blockedByFees ? (
        <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          This action is blocked until fee clearance is complete.
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Reason">
          <input
            className="input"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <Field label="Transfer / leaving date">
          <input
            className="input"
            type="date"
            value={actionDate}
            onChange={(event) => setActionDate(event.target.value)}
          />
        </Field>
        {action === 'transfer' ? (
          <>
            <Field label="Destination school">
              <input
                className="input"
                value={destinationSchool}
                onChange={(event) => setDestinationSchool(event.target.value)}
              />
            </Field>
            <Field label="Conduct remark">
              <input
                className="input"
                value={conductRemark}
                onChange={(event) => setConductRemark(event.target.value)}
              />
            </Field>
          </>
        ) : null}
        {action === 'delete' ? (
          <Field label='Confirmation text: type "SOFT DELETE"'>
            <input
              className="input"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </Field>
        ) : null}
      </div>

      {validationError ? <InlineError message={validationError} /> : null}
      {mutationError ? <InlineError message={errorMessage(mutationError)} /> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={isSaving}
          onClick={submit}
        >
          {isSaving ? 'Saving...' : lifecycleActionSubmitLabel(action)}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function StudentDetailShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-primary-700">Students</p>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {title}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Full Phase 1 student profile across admissions, guardians, documents,
          fees, attendance, activity, and history.
        </p>
      </div>
      {children}
    </div>
  );
}

function OverviewTab({ profile }: { profile: StudentProfileDetail }) {
  const primaryGuardian = profile.guardians.find((guardian) => guardian.isPrimary) ?? profile.guardians[0];
  const outstanding = profile.invoices.reduce(
    (sum, invoice) => sum + invoice.outstandingAmount,
    0,
  );
  const presentCount = profile.attendanceRecords.filter(
    (record) => record.status === 'PRESENT',
  ).length;

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <SectionCard title="Student Overview">
        <dl className="grid gap-4 md:grid-cols-2">
          <DetailItem label="Student ID" value={profile.student.studentSystemId} />
          <DetailItem label="Lifecycle status" value={profile.student.lifecycleStatus ?? 'ACTIVE'} />
          <DetailItem
            label="Date of birth"
            value={
              profile.student.dateOfBirth
                ? formatDate(profile.student.dateOfBirth)
                : 'Not recorded'
            }
          />
          <DetailItem label="Gender" value={profile.student.gender ?? 'Not set'} />
          <DetailItem label="Class" value={profile.student.className ?? profile.student.class?.name ?? 'Not assigned'} />
          <DetailItem label="Section" value={profile.student.sectionName ?? profile.student.section ?? 'No section'} />
          <DetailItem label="Roll number" value={profile.student.rollNumber ?? 'Not assigned'} />
          <DetailItem label="National student ID" value={profile.student.nationalStudentId ?? 'Not recorded'} />
        </dl>
      </SectionCard>

      <SectionCard title="Pilot Snapshot">
        <div className="grid gap-3">
          <Metric label="Guardians" value={profile.guardians.length} />
          <Metric label="Open invoices" value={profile.invoices.length} />
          <Metric label="Outstanding fees" value={`Rs. ${formatMoney(outstanding)}`} />
          <Metric label="Recent present records" value={presentCount} />
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Primary guardian:{' '}
          <span className="font-semibold text-gray-900">
            {primaryGuardian?.fullName ?? 'Not available'}
          </span>
          {primaryGuardian?.primaryPhone ? ` / ${primaryGuardian.primaryPhone}` : ''}
        </p>
      </SectionCard>
    </div>
  );
}

function GuardiansTab({
  editingGuardianId,
  error,
  guardians,
  isSaving,
  onCancelEdit,
  onEditGuardian,
  onSaveGuardian,
}: {
  editingGuardianId: string | null;
  error: unknown;
  guardians: GuardianProfile[];
  isSaving: boolean;
  onCancelEdit: () => void;
  onEditGuardian: (guardianId: string) => void;
  onSaveGuardian: (
    guardianId: string,
    body: UpdateStudentGuardianPayload,
  ) => void;
}) {
  return (
    <SectionCard title="Guardians">
      {guardians.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {guardians.map((guardian) => (
            <article
              key={guardian.id}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{guardian.fullName}</p>
                  <p className="mt-1 text-sm text-gray-500">{guardian.relation}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {guardian.isPrimary ? <Badge>Primary</Badge> : null}
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700"
                    onClick={() => onEditGuardian(guardian.id)}
                  >
                    Edit Guardian
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                Phone: {guardian.primaryPhone || 'Not available'}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Email: {guardian.email || 'Not available'}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Ward: {guardian.wardNumber || 'Not recorded'}
              </p>
              {editingGuardianId === guardian.id ? (
                <GuardianEditCard
                  error={error}
                  guardian={guardian}
                  isSaving={isSaving}
                  onCancel={onCancelEdit}
                  onSave={(body) => onSaveGuardian(guardian.id, body)}
                />
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState message="No guardians linked to this student yet." />
      )}
    </SectionCard>
  );
}

function GuardianEditCard({
  error,
  guardian,
  isSaving,
  onCancel,
  onSave,
}: {
  error: unknown;
  guardian: GuardianProfile;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (body: UpdateStudentGuardianPayload) => void;
}) {
  const [fullName, setFullName] = useState(guardian.fullName);
  const [relation, setRelation] = useState(guardian.relation);
  const [primaryPhone, setPrimaryPhone] = useState(guardian.primaryPhone ?? '');
  const [secondaryPhone, setSecondaryPhone] = useState(
    guardian.secondaryPhone ?? '',
  );
  const [email, setEmail] = useState(guardian.email ?? '');
  const [occupation, setOccupation] = useState(guardian.occupation ?? '');
  const [wardNumber, setWardNumber] = useState(guardian.wardNumber ?? '');
  const [isPrimary, setIsPrimary] = useState(guardian.isPrimary);
  const [validationError, setValidationError] = useState('');

  function submit() {
    setValidationError('');

    if (!fullName.trim() || !relation.trim()) {
      setValidationError('Guardian name and relation are required.');
      return;
    }

    if (primaryPhone.trim().length < 7) {
      setValidationError('Guardian primary phone must be valid.');
      return;
    }

    onSave({
      fullName: fullName.trim(),
      relation: relation.trim(),
      primaryPhone: primaryPhone.trim(),
      secondaryPhone: secondaryPhone.trim() || null,
      email: email.trim() || null,
      occupation: occupation.trim() || null,
      wardNumber: wardNumber.trim() || null,
      isPrimary,
    });
  }

  return (
    <div className="mt-4 rounded-2xl border border-primary-100 bg-white p-4">
      <p className="label mb-3">Edit Guardian</p>
      <div className="grid gap-3">
        <Field label="Full name">
          <input
            className="input"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </Field>
        <Field label="Relation">
          <input
            className="input"
            value={relation}
            onChange={(event) => setRelation(event.target.value)}
          />
        </Field>
        <Field label="Primary phone">
          <input
            className="input"
            value={primaryPhone}
            onChange={(event) => setPrimaryPhone(event.target.value)}
          />
        </Field>
        <Field label="Secondary phone">
          <input
            className="input"
            value={secondaryPhone}
            onChange={(event) => setSecondaryPhone(event.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Occupation">
          <input
            className="input"
            value={occupation}
            onChange={(event) => setOccupation(event.target.value)}
          />
        </Field>
        <Field label="Ward number">
          <input
            className="input"
            value={wardNumber}
            onChange={(event) => setWardNumber(event.target.value)}
          />
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-gray-700">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(event) => setIsPrimary(event.target.checked)}
          />
          Mark as primary guardian
        </label>
      </div>

      {validationError ? <InlineError message={validationError} /> : null}
      {error ? <InlineError message={errorMessage(error)} /> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={isSaving}
          onClick={submit}
        >
          {isSaving ? 'Saving...' : 'Save Guardian'}
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function DocumentsTab({
  documents,
  generatedDocuments,
  onOpenPdf,
  studentId,
}: {
  documents: StudentDocument[];
  generatedDocuments: GeneratedStudentDocumentMeta[];
  onOpenPdf: (kind: string) => Promise<void>;
  studentId: string;
}) {
  const queryClient = useQueryClient();
  const [uploadKind, setUploadKind] = useState<(typeof uploadedDocumentKinds)[number][0]>(
    'BIRTH_CERTIFICATE',
  );
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [revokeDocumentId, setRevokeDocumentId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeMessage, setRevokeMessage] = useState('');
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) {
        throw new Error('Choose a document file before uploading.');
      }

      const encoded = await fileToBase64Payload(uploadFile);

      return api.uploadStudentDocument({
        studentId,
        kind: uploadKind,
        title: uploadTitle.trim() || null,
        ...encoded,
      });
    },
    onSuccess: async () => {
      setUploadFile(null);
      setUploadTitle('');
      setUploadMessage('Document uploaded and stored privately.');
      await queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
    },
  });
  const revokeMutation = useMutation({
    mutationFn: ({
      documentId,
      reason,
    }: {
      documentId: string;
      reason: string;
    }) =>
      api.revokeGeneratedStudentDocument(studentId, documentId, {
        reason,
      }),
    onSuccess: async () => {
      setRevokeDocumentId(null);
      setRevokeReason('');
      setRevokeMessage('Generated document revoked.');
      await queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
    },
  });

  function uploadDocument() {
    setUploadError('');
    setUploadMessage('');

    if (!uploadFile) {
      setUploadError('Choose a document file before uploading.');
      return;
    }

    uploadMutation.mutate();
  }

  function revokeDocument(documentId: string) {
    setRevokeMessage('');

    if (!revokeReason.trim()) {
      return;
    }

    revokeMutation.mutate({
      documentId,
      reason: revokeReason.trim(),
    });
  }

  return (
    <div className="grid gap-5">
      <SectionCard title="Certificate Actions">
        <p className="mb-4 text-sm text-gray-500">
          Certificates open through the validated PDF helper. If fee clearance
          or lifecycle rules block issuance, the server message is shown instead
          of opening an invalid document.
        </p>
        <div className="flex flex-wrap gap-2">
          {generatedDocumentActions.map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
              onClick={() => void onOpenPdf(kind)}
            >
              Open {label}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Upload Student Document">
        <div className="grid gap-4 md:grid-cols-[0.8fr_1fr_1fr_auto] md:items-end">
          <Field label="Document type">
            <select
              className="input"
              value={uploadKind}
              onChange={(event) =>
                setUploadKind(
                  event.target.value as (typeof uploadedDocumentKinds)[number][0],
                )
              }
            >
              {uploadedDocumentKinds.map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input
              className="input"
              placeholder="Optional document title"
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
            />
          </Field>
          <Field label="Private file">
            <input
              className="input"
              type="file"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={uploadMutation.isPending}
            onClick={uploadDocument}
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Files are stored privately. Storage object keys and permanent public
          URLs are intentionally hidden from this screen.
        </p>
        {uploadFile ? (
          <p className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            Selected: {uploadFile.name} / {formatFileSize(uploadFile.size)}
          </p>
        ) : null}
        {uploadError ? <InlineError message={uploadError} /> : null}
        {uploadMutation.error ? (
          <InlineError message={errorMessage(uploadMutation.error)} />
        ) : null}
        {uploadMessage ? (
          <p className="mt-4 rounded-2xl border border-success-200 bg-success-50 p-3 text-sm text-success-700">
            {uploadMessage}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Uploaded Documents">
        {documents.length > 0 ? (
          <div className="grid gap-3">
            {documents.map((document) => (
              <article
                key={document.id}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {document.title || document.fileName}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {document.kind} / {document.fileName}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Uploaded {formatDate(document.uploadedAt)} /{' '}
                      {formatFileSize(document.sizeBytes)}
                    </p>
                  </div>
                  <Badge>Stored privately</Badge>
                </div>
                <p className="mt-3 text-sm text-gray-500">
                  Preview/download will appear here when a signed document URL
                  endpoint is available.
                </p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="No uploaded documents yet." />
        )}
      </SectionCard>

      <SectionCard title="Generated Documents">
        {generatedDocuments.length > 0 ? (
          <div className="grid gap-3">
            {generatedDocuments.map((document) => (
              <article
                key={document.id}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {document.title || document.kind}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {document.fileName} / version {document.version}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Generated{' '}
                      {formatNullableDate(document.generatedAt ?? document.signedAt)}
                      {document.generatedById
                        ? ` / by ${document.generatedById}`
                        : ''}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Retention until{' '}
                      {formatNullableDate(document.retentionUntil)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <Badge>{document.revokedAt ? 'Revoked' : 'Current'}</Badge>
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700"
                      onClick={() => void onOpenPdf(document.kind)}
                    >
                      Open PDF
                    </button>
                    {!document.revokedAt ? (
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center rounded-xl border border-danger-200 bg-danger-50 px-3 text-xs font-semibold text-danger-700"
                        onClick={() => {
                          setRevokeDocumentId(document.id);
                          setRevokeReason('');
                          revokeMutation.reset();
                        }}
                      >
                        Revoke
                      </button>
                    ) : null}
                  </div>
                </div>
                {revokeDocumentId === document.id ? (
                  <div className="mt-4 rounded-2xl border border-danger-100 bg-white p-4">
                    <p className="text-sm font-semibold text-gray-900">
                      Revoke generated document
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      This is audited and does not delete the historical record.
                      Retention rules may block revocation.
                    </p>
                    <Field label="Revocation reason">
                      <input
                        className="input"
                        value={revokeReason}
                        onChange={(event) => setRevokeReason(event.target.value)}
                      />
                    </Field>
                    {revokeMutation.error ? (
                      <InlineError message={errorMessage(revokeMutation.error)} />
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center rounded-xl bg-danger-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
                        disabled={revokeMutation.isPending || !revokeReason.trim()}
                        onClick={() => revokeDocument(document.id)}
                      >
                        {revokeMutation.isPending ? 'Revoking...' : 'Confirm Revoke'}
                      </button>
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
                        onClick={() => setRevokeDocumentId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="No generated document history yet." />
        )}
        {revokeMessage ? (
          <p className="mt-4 rounded-2xl border border-success-200 bg-success-50 p-3 text-sm text-success-700">
            {revokeMessage}
          </p>
        ) : null}
      </SectionCard>
    </div>
  );
}

function FeesTab({
  invoices,
  studentId,
}: {
  invoices: StudentProfileInvoice[];
  studentId: string;
}) {
  const ledgerQuery = useQuery({
    queryKey: ['student-fee-ledger', studentId],
    queryFn: () => api.getStudentFeeLedger(studentId),
    enabled: Boolean(studentId),
  });

  return (
    <div className="grid gap-5">
      <SectionCard title="Student Fee Ledger">
        <StudentFeeLedgerView query={ledgerQuery} />
      </SectionCard>

      <SectionCard title="Invoices">
        {invoices.length > 0 ? (
          <div className="grid gap-3">
            {invoices.map((invoice) => (
              <article
                key={invoice.id}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{invoice.invoiceNumber}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      Due {formatDate(invoice.dueDate)} / issued {formatDate(invoice.issuedAt)}
                    </p>
                  </div>
                  <Badge>{invoice.status}</Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Metric label="Total" value={`Rs. ${formatMoney(invoice.totalAmount)}`} />
                  <Metric label="Paid" value={`Rs. ${formatMoney(invoice.paidAmount)}`} />
                  <Metric label="Outstanding" value={`Rs. ${formatMoney(invoice.outstandingAmount)}`} />
                </div>
                {invoice.lines.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="py-2 pr-3">Fee Head</th>
                          <th className="py-2 pr-3">Description</th>
                          <th className="py-2 pr-3">VAT</th>
                          <th className="py-2 pr-3">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {invoice.lines.map((line) => (
                          <tr key={line.id}>
                            <td className="py-2 pr-3 font-medium text-gray-900">
                              {line.feeHeadName}
                            </td>
                            <td className="py-2 pr-3 text-gray-600">{line.description}</td>
                            <td className="py-2 pr-3 text-gray-600">
                              Rs. {formatMoney(line.vatAmount)}
                            </td>
                            <td className="py-2 pr-3 text-gray-600">
                              Rs. {formatMoney(line.totalAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="No invoices found for this student." />
        )}
      </SectionCard>
    </div>
  );
}

function StudentFeeLedgerView({
  query,
}: {
  query: UseQueryResult<StudentFeeLedger, Error>;
}) {
  if (query.isLoading) {
    return (
      <div className="grid gap-3">
        <div className="h-16 animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-16 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (query.isError) {
    return <InlineError message={errorMessage(query.error)} />;
  }

  const ledger = query.data;

  if (!ledger) {
    return <EmptyState message="No student fee ledger is available yet." />;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Total invoiced" value={`Rs. ${formatMoney(ledger.totalInvoiced)}`} />
        <Metric label="Total paid" value={`Rs. ${formatMoney(ledger.totalPaid)}`} />
        <Metric label="Waivers tracked" value={`Rs. ${formatMoney(ledger.totalWaived)}`} />
        <Metric label="Outstanding" value={`Rs. ${formatMoney(ledger.outstandingBalance)}`} />
      </div>
      <p className="text-sm text-gray-500">
        Running balance is backend-calculated from official invoices, payments, and refunds.
        Waiver rows are shown for audit visibility and marked when already reflected in invoice totals.
      </p>
      {ledger.rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Reference</th>
                <th className="py-2 pr-3">Description</th>
                <th className="py-2 pr-3">Debit</th>
                <th className="py-2 pr-3">Credit</th>
                <th className="py-2 pr-3">Running Balance</th>
                <th className="py-2 pr-3">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ledger.rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-3 text-gray-600">{formatDate(row.date)}</td>
                  <td className="py-3 pr-3">
                    <Badge>{row.type}</Badge>
                  </td>
                  <td className="py-3 pr-3 font-medium text-gray-900">{row.reference}</td>
                  <td className="py-3 pr-3 text-gray-600">
                    {row.description}
                    {!row.affectsBalance ? (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                        informational
                      </span>
                    ) : null}
                  </td>
                  <td className="py-3 pr-3">Rs. {formatMoney(row.debit)}</td>
                  <td className="py-3 pr-3">Rs. {formatMoney(row.credit)}</td>
                  <td className="py-3 pr-3 font-semibold">
                    Rs. {formatMoney(row.runningBalance)}
                  </td>
                  <td className="py-3 pr-3">
                    {row.receiptNumber ? (
                      <button
                        type="button"
                        className="rounded-full border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"
                        onClick={() => void api.openReceiptPdf(row.receiptNumber as string)}
                      >
                        Open {row.receiptNumber}
                      </button>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No invoice, payment, refund, or waiver rows yet." />
      )}
    </div>
  );
}

function AttendanceTab({ records }: { records: StudentProfileAttendanceRecord[] }) {
  return (
    <SectionCard title="Attendance">
      {records.length > 0 ? (
        <div className="grid gap-2">
          {records.map((record) => (
            <div
              key={record.id}
              className="grid gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="font-semibold text-gray-900">
                  {formatDate(record.attendanceDate)}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Submitted {record.submittedAt ? formatDate(record.submittedAt) : 'not recorded'}
                  {record.lateAt ? ` / late at ${formatDate(record.lateAt)}` : ''}
                </p>
                {record.remark ? (
                  <p className="mt-1 text-sm text-gray-600">{record.remark}</p>
                ) : null}
              </div>
              <Badge>{record.status}</Badge>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="No attendance records found for this student." />
      )}
    </SectionCard>
  );
}

function ActivityTab({ posts }: { posts: ActivityPost[] }) {
  return (
    <SectionCard title="Activity">
      {posts.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {posts.map((post) => (
            <article
              key={post.id}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{post.title}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {post.category} / {post.audienceType}
                  </p>
                </div>
                <Badge>{post.attachments.length} files</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                {post.caption || post.body || 'No caption recorded.'}
              </p>
              {post.studentTags.length > 0 ? (
                <p className="mt-3 text-xs font-semibold text-gray-500">
                  Tagged students: {post.studentTags.length}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState message="No activity posts found for this student." />
      )}
    </SectionCard>
  );
}

function HistoryTab({ profile }: { profile: StudentProfileDetail }) {
  return (
    <SectionCard title="History">
      <div className="grid gap-3">
        {profile.enrollments.map((enrollment) => (
          <TimelineRow
            key={enrollment.id}
            title={`Enrollment ${enrollment.academicYear}`}
            meta={`${enrollment.className} / ${enrollment.sectionName ?? 'No section'} / ${enrollment.status}`}
            date={enrollment.admissionDate}
          />
        ))}
        {profile.generatedDocuments.map((document) => (
          <TimelineRow
            key={document.id}
            title={`Generated ${document.kind}`}
            meta={`Version ${document.version}${document.revokedAt ? ' / revoked' : ''}`}
            date={document.signedAt ?? document.retentionUntil}
          />
        ))}
        {profile.attendanceRecords.slice(0, 8).map((record) => (
          <TimelineRow
            key={record.id}
            title={`Attendance ${record.status}`}
            meta={record.remark ?? 'No remark'}
            date={record.attendanceDate}
          />
        ))}
        {profile.enrollments.length === 0 &&
        profile.generatedDocuments.length === 0 &&
        profile.attendanceRecords.length === 0 ? (
          <EmptyState message="No profile history is available yet." />
        ) : null}
      </div>
    </SectionCard>
  );
}

function SectionCard({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-gray-700">
      {label}
      {children}
    </label>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <p className="mt-4 rounded-2xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-600">
      {message}
    </p>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <dt className="label mb-2">{label}</dt>
      <dd className="text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
      {children}
    </span>
  );
}

function DocumentRow({
  meta,
  status,
  title,
}: {
  meta: string;
  status: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-4 md:flex-row md:items-start md:justify-between">
      <div>
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="mt-1 text-sm text-gray-500">{meta}</p>
      </div>
      <Badge>{status}</Badge>
    </div>
  );
}

function TimelineRow({
  date,
  meta,
  title,
}: {
  date: string | null;
  meta: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{meta}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
        {date ? formatDate(date) : 'Date not recorded'}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
      {message}
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <section className="rounded-3xl border border-danger-200 bg-danger-50 p-5 text-sm text-danger-600">
      {message}
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="rounded-3xl border border-gray-200 bg-white p-5">
        <div className="h-16 w-16 animate-pulse rounded-3xl bg-gray-100" />
        <div className="mt-5 h-5 w-56 animate-pulse rounded-full bg-gray-100" />
        <div className="mt-3 h-4 w-80 animate-pulse rounded-full bg-gray-100" />
      </div>
      <div className="h-20 animate-pulse rounded-3xl bg-gray-100" />
      <div className="h-64 animate-pulse rounded-3xl bg-gray-100" />
    </div>
  );
}

function getStudentName(profile: StudentProfileDetail) {
  return (
    profile.student.fullNameEn ||
    [profile.student.firstNameEn, profile.student.lastNameEn]
      .filter(Boolean)
      .join(' ') ||
    'Unnamed student'
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNullableDate(value?: string | null) {
  return value ? formatDate(value) : 'Not recorded';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The record could not be saved.';
}

function splitNepaliName(fullNameNp?: string | null) {
  const [firstNameNp = '', ...rest] = (fullNameNp ?? '').split(' ');

  return {
    firstNameNp,
    lastNameNp: rest.join(' '),
  };
}

function lifecycleActionTitle(action: LifecycleAction) {
  if (action === 'transfer') {
    return 'Transfer student';
  }

  if (action === 'archive') {
    return 'Archive / inactive student';
  }

  if (action === 'alumni') {
    return 'Archive as alumni';
  }

  return 'Request soft delete';
}

function lifecycleActionSubmitLabel(action: LifecycleAction) {
  if (action === 'transfer') {
    return 'Confirm Transfer';
  }

  if (action === 'archive') {
    return 'Confirm Archive';
  }

  if (action === 'alumni') {
    return 'Confirm Alumni Archive';
  }

  return 'Confirm Soft Delete';
}
