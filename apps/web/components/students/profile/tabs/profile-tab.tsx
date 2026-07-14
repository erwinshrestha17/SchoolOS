'use client';

import { formatBsDate, type StudentProfileDetail } from '@schoolos/core';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/ui/section-card';
import {
  CalendarCheck,
  GraduationCap,
  Hash,
  Languages,
  UserRound,
} from 'lucide-react';

export function ProfileTab({ profile }: { profile: StudentProfileDetail }) {
  const { student } = profile;
  const studentName =
    student.fullNameEn ||
    `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim() ||
    'Student';
  const currentEnrollment =
    profile.enrollments.find(
      (enrollment) => enrollment.status.toUpperCase() === 'ACTIVE',
    ) ?? null;
  const className = currentEnrollment?.className ?? null;
  const sectionName = currentEnrollment?.sectionName ?? null;
  const rollNumber = currentEnrollment?.rollNumber ?? null;
  const admissionDate =
    currentEnrollment?.admissionDate ?? student.admissionDate ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
      <SectionCard
        title="Student profile"
        description="Official identity and enrollment details for this student."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ProfileField
            icon={<UserRound size={18} />}
            label="English name"
            value={studentName}
          />
          {student.fullNameNp ? (
            <ProfileField
              icon={<Languages size={18} />}
              label="Nepali name"
              value={student.fullNameNp}
            />
          ) : null}
          <ProfileField
            icon={<Hash size={18} />}
            label="Student system ID"
            value={student.studentSystemId}
          />
          {student.admissionNumber ? (
            <ProfileField
              icon={<Hash size={18} />}
              label="Admission number"
              value={student.admissionNumber}
            />
          ) : null}
          {admissionDate ? (
            <ProfileField
              icon={<CalendarCheck size={18} />}
              label="Admission date"
              value={formatDate(admissionDate)}
            />
          ) : null}
          {student.dateOfBirth ? (
            <ProfileField
              icon={<CalendarCheck size={18} />}
              label="Date of birth"
              value={formatDate(student.dateOfBirth)}
            />
          ) : null}
          {student.gender ? (
            <ProfileField
              icon={<UserRound size={18} />}
              label="Gender"
              value={student.gender}
            />
          ) : null}
          {student.motherTongue ? (
            <ProfileField
              icon={<Languages size={18} />}
              label="Mother tongue"
              value={student.motherTongue}
            />
          ) : null}
          <ProfileField
            icon={<GraduationCap size={18} />}
            label="Lifecycle status"
            value={formatStatus(student.lifecycleStatus ?? 'ACTIVE')}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Current enrollment"
        description="The student’s current academic year, class, and section placement."
      >
        {currentEnrollment ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-bg)] p-5">
              <p className="text-[0.68rem] font-black uppercase tracking-widest text-[var(--color-mod-admissions-text)]">
                Placement
              </p>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {formatClassLabel(className)}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {sectionName
                  ? `Section ${sectionName}`
                  : 'Section not assigned'}
                {rollNumber ? ` • Roll ${rollNumber}` : ''}
              </p>
            </div>

            <div className="space-y-3">
              <EnrollmentRow
                label="Academic year"
                value={currentEnrollment.academicYear}
              />
              {currentEnrollment.status ? (
                <EnrollmentRow
                  label="Enrollment status"
                  value={formatStatus(currentEnrollment.status)}
                />
              ) : null}
              <EnrollmentRow
                label="Class Teacher"
                value={
                  currentEnrollment.classTeacher?.fullName ||
                  student.classTeacher?.fullName ||
                  'Not assigned'
                }
              />
              <EnrollmentRow
                label="Admission date"
                value={formatDate(currentEnrollment.admissionDate)}
              />
              {currentEnrollment.rollNumber ? (
                <EnrollmentRow
                  label="Roll number"
                  value={currentEnrollment.rollNumber.toString()}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
            No active enrollment is available for this student.
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function ProfileField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-400">{icon}</div>
        <div className="min-w-0">
          <p className="text-[0.68rem] font-black uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <p className="mt-1 break-words text-sm font-bold text-slate-900">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function EnrollmentRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400">
        {label}
      </span>
      {label === 'Enrollment status' ? (
        <Badge className="border-[var(--color-mod-admissions-border)] bg-white text-[var(--color-mod-admissions-text)]">
          {value}
        </Badge>
      ) : (
        <span className="text-right text-sm font-bold text-slate-800">
          {value}
        </span>
      )}
    </div>
  );
}

function formatDate(value: string | Date) {
  try {
    return formatBsDate(value);
  } catch {
    return 'Date not recorded';
  }
}

function formatStatus(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatClassLabel(value?: string | null) {
  if (!value) return 'Class not assigned';
  const normalized = value.trim().replace(/^class\s+class\s+/i, 'Class ');
  return normalized.toLowerCase().startsWith('class ')
    ? normalized
    : `Class ${normalized}`;
}
