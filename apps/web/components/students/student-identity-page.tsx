'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, QrCode } from 'lucide-react';
import { api } from '@/lib/api';
import { useBreadcrumbLabel } from '@/components/schoolos/navigation/breadcrumb-label-context';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionCard } from '@/components/ui/section-card';
import { StudentQrCard } from './profile/student-qr-card';

export function StudentIdentityPage({ studentId }: { studentId: string }) {
  const profileQuery = useQuery({
    queryKey: ['student-profile', studentId],
    queryFn: () => api.getStudentProfile(studentId),
    enabled: Boolean(studentId),
  });

  const profile = profileQuery.data;
  const studentName = profile
    ? profile.student.fullNameEn ||
      `${profile.student.firstNameEn ?? ''} ${profile.student.lastNameEn ?? ''}`.trim() ||
      'Student'
    : null;

  useBreadcrumbLabel(studentName ? `${studentName} identity` : null);

  if (profileQuery.isLoading) {
    return <LoadingState variant="page" label="Loading student identity..." />;
  }

  if (profileQuery.isError || !profile) {
    return (
      <EmptyState
        title="Student identity unavailable"
        description="The student record does not exist or you do not have permission to manage its identity."
      />
    );
  }

  const currentEnrollment =
    profile.enrollments.find(
      (enrollment) => enrollment.status.toUpperCase() === 'ACTIVE',
    ) ??
    profile.enrollments[0] ??
    null;

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <Link
        href={`/dashboard/students/${encodeURIComponent(studentId)}`}
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-slate-950"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Back to student profile
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-mod-admissions-bg)] text-[var(--color-mod-admissions-accent)]">
              <QrCode size={22} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">
                Identity & QR
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage the school identity card, credential access and audit
                history for {studentName}.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <StudentQrCard
          studentId={profile.student.id}
          studentSystemId={profile.student.studentSystemId}
          qrCredential={profile.student.qrCredential ?? null}
        />

        <SectionCard
          title="Student record"
          description="Identity context for this credential."
        >
          <div className="space-y-3">
            <IdentityRow label="Student" value={studentName ?? 'Student'} />
            <IdentityRow
              label="Student ID"
              value={profile.student.studentSystemId}
            />
            <IdentityRow
              label="Class"
              value={
                currentEnrollment?.className ??
                profile.student.className ??
                profile.student.class?.name ??
                'Not assigned'
              }
            />
            <IdentityRow
              label="Section"
              value={
                currentEnrollment?.sectionName ??
                profile.student.sectionName ??
                profile.student.section ??
                'Not assigned'
              }
            />
            <IdentityRow
              label="Roll"
              value={
                (
                  currentEnrollment?.rollNumber ?? profile.student.rollNumber
                )?.toString() ?? 'Not assigned'
              }
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function IdentityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}
