'use client';

import { StudentFeeClearance, StudentProfileDetail } from '@schoolos/core';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { SectionCard } from '@/components/ui/section-card';
import { ActionMenu } from '@/components/ui/action-menu';
import {
  Archive,
  CalendarCheck,
  ChevronLeft,
  FileText,
  FolderOpen,
  MoreHorizontal,
  PencilLine,
  QrCode,
  UserRound,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type StudentProfileTabShortcut = 'Overview' | 'Attendance' | 'Fees' | 'Documents' | 'Guardians';

type ProfileHeaderProps = {
  profile: StudentProfileDetail;
  onEdit: () => void;
  onOpenIdCard: () => void;
  onSelectTab: (tab: StudentProfileTabShortcut) => void;
  onManageLifecycle: () => void;
  feeClearance: StudentFeeClearance | null;
  isFeeClearanceLoading?: boolean;
  isFeeClearanceError?: boolean;
  pdfError?: string;
};

export function ProfileHeader({
  profile,
  onEdit,
  onOpenIdCard,
  onSelectTab,
  onManageLifecycle,
  feeClearance,
  isFeeClearanceLoading,
  isFeeClearanceError,
  pdfError,
}: ProfileHeaderProps) {
  const router = useRouter();
  const { student } = profile;
  const studentName = student.fullNameEn || `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim() || 'Student';
  const primaryGuardian = profile.guardians.find((guardian) => guardian.isPrimary) ?? profile.guardians[0];
  const className = formatClassLabel(student.className ?? student.class?.name);
  const sectionName = student.sectionName ?? student.section ?? 'Section not assigned';
  const [photoObjectUrl, setPhotoObjectUrl] = useState<string | null>(null);
  const supportNoteExists = Boolean(
    student.medicalConditions || student.severeAllergies || student.medications || student.specialNeeds,
  );
  const hasOutstandingFees = Boolean(
    feeClearance && !feeClearance.cleared && feeClearance.outstandingAmount > 0,
  );
  const collectFeeAction = hasOutstandingFees
    ? {
        label: 'Collect fees',
        icon: <Wallet size={16} />,
        onClick: () =>
          router.push(
            `/dashboard/finance?studentId=${encodeURIComponent(student.id)}&source=student-profile`,
          ),
      }
    : isFeeClearanceLoading
      ? {
          label: 'Checking fee balance...',
          icon: <Wallet size={16} />,
          disabled: true,
          onClick: () => undefined,
        }
      : isFeeClearanceError
        ? {
            label: 'View fee history',
            icon: <Wallet size={16} />,
            onClick: () => onSelectTab('Fees'),
          }
        : {
            label: 'View fee history',
            icon: <Wallet size={16} />,
            onClick: () => onSelectTab('Fees'),
          };

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    if (!student.photoUrl) {
      setPhotoObjectUrl(null);
      return undefined;
    }

    void api
      .getStudentPhotoBlob(student.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPhotoObjectUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setPhotoObjectUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [student.id, student.photoUrl]);

  return (
    <SectionCard className="overflow-hidden border-[var(--color-mod-admissions-border)] bg-white shadow-sm">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
        <Link
          href="/dashboard/students"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
        >
          <ChevronLeft size={17} aria-hidden="true" />
          Students / Directory / {studentName}
        </Link>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
          <span>Student profile</span>
          <span aria-hidden="true">•</span>
          <span>{student.studentSystemId}</span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.9fr)_auto] xl:items-start">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar
            src={photoObjectUrl}
            alt={`${studentName} profile photo`}
            initials={initials(studentName)}
            size="xl"
            className="h-24 w-24 border-4 border-white text-2xl shadow-md ring-1 ring-slate-200"
          />

          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="phase2" className="border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-bg)] text-[var(--color-mod-admissions-text)]">
                Student profile
              </Badge>
              <Badge className="border-success-200 bg-success-50 text-success-700">
                {formatLifecycleStatus(student.lifecycleStatus ?? 'ACTIVE')}
              </Badge>
              {supportNoteExists ? (
                <Badge className="border-warning-200 bg-warning-50 text-warning-700">Support note on file</Badge>
              ) : null}
            </div>
            <h1 className="truncate text-3xl font-black tracking-tight text-slate-950">{studentName}</h1>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {className} <span aria-hidden="true">•</span> {sectionName}
              {student.rollNumber ? <><span aria-hidden="true"> • </span>Roll {student.rollNumber}</> : null}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded-lg bg-slate-50 px-3 py-2">ID: {student.studentSystemId}</span>
              {student.admissionNumber ? <span className="rounded-lg bg-slate-50 px-3 py-2">Admission: {student.admissionNumber}</span> : null}
              {student.gender ? <span className="rounded-lg bg-slate-50 px-3 py-2">{student.gender}</span> : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
          <div className="mb-4 flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-wider text-slate-500">
            <UserRound size={15} aria-hidden="true" />
            Primary guardian
          </div>
          {primaryGuardian ? (
            <div className="space-y-3">
              <div>
                <p className="font-bold text-slate-950">{primaryGuardian.fullName}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {formatGuardianRelation(primaryGuardian.relation)}
                </p>
              </div>
              <p className="text-sm font-medium text-slate-600">{primaryGuardian.primaryPhone || 'Phone not recorded'}</p>
              {primaryGuardian.email ? <p className="truncate text-sm text-slate-500">{primaryGuardian.email}</p> : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No guardian is linked to this student yet.</p>
          )}
          <button
            type="button"
            onClick={() => onSelectTab('Guardians')}
            className="mt-5 text-sm font-bold text-[var(--color-mod-admissions-text)] hover:underline"
          >
            {profile.guardians.length > 0 ? `View guardians (${profile.guardians.length})` : 'Manage guardians'}
          </button>
        </div>

        <div className="flex min-w-[12.5rem] flex-col gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-admissions-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)] focus:ring-offset-2"
          >
            <PencilLine size={18} aria-hidden="true" />
            Edit profile
          </button>
          <ActionMenu
            align="right"
            label="Student profile actions"
            trigger={
              <button type="button" className={secondaryActionClass}>
                <MoreHorizontal size={18} aria-hidden="true" />
                More actions
              </button>
            }
            items={[
              collectFeeAction,
              {
                label: 'View attendance',
                icon: <CalendarCheck size={16} />,
                onClick: () => onSelectTab('Attendance'),
              },
              {
                label: 'Manage documents',
                icon: <FolderOpen size={16} />,
                onClick: () => onSelectTab('Documents'),
              },
              {
                label: 'View QR identity',
                icon: <QrCode size={16} />,
                onClick: () => onSelectTab('Overview'),
              },
              {
                label: 'Generate / print ID card',
                icon: <FileText size={16} />,
                onClick: onOpenIdCard,
              },
              {
                label: 'Manage lifecycle',
                icon: <Archive size={16} />,
                onClick: onManageLifecycle,
              },
            ]}
          />
        </div>
      </div>

      {pdfError ? (
        <div className="mt-6 animate-in rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm font-bold text-danger-700 fade-in slide-in-from-top-2">
          {pdfError}
        </div>
      ) : null}
    </SectionCard>
  );
}

const secondaryActionClass = cn(
  'flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition',
  'hover:border-[var(--color-mod-admissions-accent)] hover:bg-[var(--color-mod-admissions-bg)] hover:text-[var(--color-mod-admissions-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)] focus:ring-offset-2',
);

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatLifecycleStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatClassLabel(value?: string | null) {
  if (!value) return 'Class not assigned';
  return value.trim().toLowerCase().startsWith('class ')
    ? value.trim()
    : `Class ${value.trim()}`;
}

function formatGuardianRelation(value?: string | null) {
  if (!value) return 'Relation not recorded';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
