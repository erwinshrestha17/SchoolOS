'use client';

import { StudentProfileDetail } from '@schoolos/core';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { SectionCard } from '@/components/ui/section-card';
import { CalendarCheck, FolderOpen, QrCode, Wallet, Edit3, FileText, ChevronLeft, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProfileHeaderProps = {
  profile: StudentProfileDetail;
  onEdit: () => void;
  onOpenIdCard: () => void;
  pdfError?: string;
};

export function ProfileHeader({ profile, onEdit, onOpenIdCard, pdfError }: ProfileHeaderProps) {
  const { student } = profile;
  const studentName = student.fullNameEn || `${student.firstNameEn} ${student.lastNameEn}`;
  
  return (
    <SectionCard className="border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-bg)] shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--color-mod-admissions-accent)] shadow-sm ring-1 ring-[var(--color-mod-admissions-border)]">
              <UserRound size={26} aria-hidden="true" />
            </div>
            <Avatar
              initials={initials(studentName)}
              size="xl"
              className="ring-4 ring-white shadow-sm"
            />
          </div>

          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="phase2" className="border-[var(--color-mod-admissions-border)] bg-white text-[var(--color-mod-admissions-text)]">Student Profile</Badge>
              <span className="rounded-full border border-[var(--color-mod-admissions-border)] bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                {student.studentSystemId}
              </span>
            </div>
            <h1 className="truncate text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {studentName}
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-600">
              {student.className ?? student.class?.name ?? 'No class'} • {student.sectionName ?? student.section ?? 'No section'}
              {student.rollNumber ? ` • Roll ${student.rollNumber}` : ''}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className="border-success-200 bg-success-50 text-success-700">{student.lifecycleStatus ?? 'ACTIVE'}</Badge>
              <Badge className="border-[var(--color-mod-admissions-border)] bg-white text-[var(--color-mod-admissions-text)]">
                {student.gender ?? 'Gender not recorded'}
              </Badge>
              {student.disabilityFlag ? (
                <Badge className="border-warning-200 bg-warning-50 text-warning-700">{student.disabilityFlag}</Badge>
              ) : (
                <Badge className="border-slate-200 bg-white text-slate-500">No known disability</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/students"
            className={secondaryActionClass}
          >
            <ChevronLeft size={18} />
            Directory
          </Link>
          <Link
            href={`/dashboard/finance?studentId=${encodeURIComponent(student.id)}`}
            className={secondaryActionClass}
          >
            <Wallet size={18} />
            Collect Fees
          </Link>
          <Link
            href={`/dashboard/students/${encodeURIComponent(student.id)}?tab=Attendance`}
            className={secondaryActionClass}
          >
            <CalendarCheck size={18} />
            Attendance
          </Link>
          <Link
            href={`/dashboard/students/${encodeURIComponent(student.id)}?tab=Documents`}
            className={secondaryActionClass}
          >
            <FolderOpen size={18} />
            Documents
          </Link>
          <Link
            href={`/dashboard/students/${encodeURIComponent(student.id)}?tab=Overview`}
            className={secondaryActionClass}
          >
            <QrCode size={18} />
            QR
          </Link>
          <button
            type="button"
            onClick={onEdit}
            className={secondaryActionClass}
          >
            <Edit3 size={18} />
            Edit
          </button>
          <button
            type="button"
            onClick={onOpenIdCard}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-admissions-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)] focus:ring-offset-2"
          >
            <FileText size={18} />
            ID Card
          </button>
        </div>
      </div>

      {pdfError && (
        <div className="mt-6 animate-in rounded-xl border border-danger-200 bg-danger-50 p-4 text-sm font-bold text-danger-700 fade-in slide-in-from-top-2">
          {pdfError}
        </div>
      )}
    </SectionCard>
  );
}

const secondaryActionClass = cn(
  'flex min-h-11 items-center gap-2 rounded-xl border border-[var(--color-mod-admissions-border)] bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition',
  'hover:-translate-y-0.5 hover:border-[var(--color-mod-admissions-accent)] hover:text-[var(--color-mod-admissions-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)] focus:ring-offset-2'
);

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
