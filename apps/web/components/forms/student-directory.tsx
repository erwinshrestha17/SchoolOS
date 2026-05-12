'use client';

import type {
  AcademicYearSummary,
  AdmissionSummary,
  ClassSummary,
  SectionSummary,
  StudentProfile,
} from '@schoolos/core';
import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { SectionCard } from '../ui/section-card';
import { StatCard } from '../ui/stat-card';
import { Badge } from '../ui/badge';
import { Avatar } from '../ui/avatar';
import { LoadingState } from '../ui/loading-state';
import { EmptyState } from '../ui/empty-state';
import { cn } from '../../lib/utils';
import { Search, Filter, Download, UserPlus, Wallet, FileText, ChevronRight, MoreHorizontal, UserCheck, UserX, GraduationCap, ArrowRightLeft, XCircle, RotateCcw } from 'lucide-react';
import { StatusBadge } from '../ui/status-badge';

type StudentDirectoryProps = {
  academicYears: AcademicYearSummary[];
  admissions: AdmissionSummary[];
  classes: ClassSummary[];
  isError: boolean;
  isLoading: boolean;
  onOpenPdf: (studentId: string, kind: string) => void;
  pdfError: string;
  sections: SectionSummary[];
  students: StudentProfile[];
  onExportRoster: (
    format: 'csv' | 'json',
    filters: {
      academicYearId?: string;
      classId?: string;
      sectionId?: string;
    },
  ) => void;
};

export function StudentDirectory({
  academicYears,
  admissions,
  classes,
  isError,
  isLoading,
  onOpenPdf,
  pdfError,
  sections,
  students,
  onExportRoster,
}: StudentDirectoryProps) {
  const [academicYearId, setAcademicYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const currentAcademicYear = academicYears.find((year) => year.isCurrent);
  const selectedAcademicYear =
    academicYears.find((year) => year.id === academicYearId) ?? currentAcademicYear;
  const availableSections = sections.filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !classId || sectionClassId === classId;
  });
  const selectedSection = availableSections.find((section) => section.id === sectionId);

  useEffect(() => {
    if (!academicYearId && currentAcademicYear) {
      setAcademicYearId(currentAcademicYear.id);
    }
  }, [academicYearId, currentAcademicYear]);

  useEffect(() => {
    if (!classId && classes[0]) {
      setClassId(classes[0].id);
    }
  }, [classId, classes]);

  useEffect(() => {
    if (!sectionId) return;
    const existingSection = sections.find((section) => section.id === sectionId);
    const existingSectionClassId = existingSection?.classId ?? existingSection?.class?.id;
    if (existingSection && existingSectionClassId !== classId) {
      setSectionId('');
    }
  }, [classId, sectionId, sections]);

  const admissionBySystemId = useMemo(() => {
    const map = new Map<string, AdmissionSummary>();
    for (const admission of admissions) {
      map.set(admission.studentSystemId, admission);
    }
    return map;
  }, [admissions]);

  const filteredStudents = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    return students
      .filter((student) => {
        const admission = admissionBySystemId.get(student.studentSystemId);
        const studentClassId = student.class?.id;
        const studentClassName = student.className ?? student.class?.name ?? admission?.className ?? '';
        const studentSectionName = student.sectionName ?? student.section ?? admission?.sectionName ?? '';
        const academicYearMatches =
          !selectedAcademicYear ||
          !admission?.latestEnrollment ||
          admission.latestEnrollment.academicYear === selectedAcademicYear.name;
        const classMatches =
          !classId ||
          studentClassId === classId ||
          studentClassName === classes.find(c => c.id === classId)?.name;
        const sectionMatches =
          !selectedSection || studentSectionName === selectedSection.name;
        const searchable = [
          getStudentName(student, admission),
          student.studentSystemId,
          studentClassName,
          studentSectionName,
          ...(student.guardians ?? []).map((guardian) => guardian.primaryPhone),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const statusMatches = !status || student.lifecycleStatus === status;

        return (
          academicYearMatches &&
          classMatches &&
          sectionMatches &&
          statusMatches &&
          (!normalizedSearch || searchable.includes(normalizedSearch))
        );
      })
      .sort((first, second) => {
        const firstAdmission = admissionBySystemId.get(first.studentSystemId);
        const secondAdmission = admissionBySystemId.get(second.studentSystemId);
        const firstRoll = first.rollNumber ?? firstAdmission?.rollNumber ?? 99999;
        const secondRoll = second.rollNumber ?? secondAdmission?.rollNumber ?? 99999;
        return firstRoll - secondRoll || getStudentName(first, firstAdmission).localeCompare(getStudentName(second, secondAdmission));
      });
  }, [admissionBySystemId, deferredSearch, selectedAcademicYear, classId, classes, selectedSection, students]);

  if (isLoading) return <LoadingState label="Loading student directory..." />;

  if (isError) {
    return (
      <SectionCard title="Error" className="border-danger-100 bg-danger-50/30">
        <p className="text-sm text-danger-600">Student Directory could not load. Please check your connection.</p>
      </SectionCard>
    );
  }

  if (classes.length === 0) {
    return (
      <EmptyState
        title="No classes configured"
        description="You need to set up academic years and classes before you can manage students."
        action={
          <Link href="/dashboard/settings" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800">
            Configure School Settings
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Records" value={students.length} icon={<Users size={20} />} />
        <StatCard title="Active Enrollment" value={students.filter(s => s.lifecycleStatus === 'ACTIVE').length} icon={<UserCheck size={20} />} className="border-success-100 bg-success-50/20" />
        <StatCard title="Filtered Results" value={filteredStudents.length} icon={<Filter size={20} />} className="border-primary-100 bg-primary-50/20" />
        <div className="flex items-center justify-end px-2 gap-2">
           <button
            type="button"
            className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            onClick={() => onExportRoster('csv', { academicYearId, classId, sectionId })}
          >
            <Download size={18} />
            Export CSV
          </button>
           <Link
            href="/dashboard/admissions"
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800"
          >
            <UserPlus size={18} />
            Enroll Student
          </Link>
        </div>
      </div>

      <SectionCard 
        title="Directory Filters"
        headerAction={
          (academicYearId || classId || sectionId || status || search) && (
            <button 
              onClick={() => {
                setAcademicYearId(currentAcademicYear?.id ?? '');
                setClassId('');
                setSectionId('');
                setStatus('');
                setSearch('');
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-primary-600 transition hover:text-primary-700"
            >
              <RotateCcw size={12} />
              Reset All
            </button>
          )
        }
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <label className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 ml-1">Academic Year</label>
            <select
              className="premium-input text-sm"
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
            >
              <option value="">All Years</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>{year.name} {year.isCurrent ? '(Current)' : ''}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 ml-1">Class</label>
            <select
              className="premium-input text-sm"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSectionId('');
              }}
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 ml-1">Section</label>
            <select
              className="premium-input text-sm"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              disabled={!classId}
            >
              <option value="">All Sections</option>
              {availableSections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 ml-1">Status</label>
            <select
              className="premium-input text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="TRANSFERRED">Transferred</option>
              <option value="ALUMNI">Alumni</option>
              <option value="WITHDRAWN">Withdrawn</option>
              <option value="DEACTIVATED">Deactivated</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 ml-1">Quick Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                className="premium-input pl-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or SCH-ID"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Student Roster"
        description={classId ? `Showing students for ${classes.find(c => c.id === classId)?.name}` : 'Showing all student records'}
        noPadding
      >
        {filteredStudents.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredStudents.map((student) => {
              const admission = admissionBySystemId.get(student.studentSystemId);
              const studentName = getStudentName(student, admission);
              const className = student.className ?? student.class?.name ?? admission?.className ?? 'Not assigned';
              const sectionName = student.sectionName ?? student.section ?? admission?.sectionName ?? 'No section';
              const rollNumber = student.rollNumber ?? admission?.rollNumber ?? null;
              const primaryGuardian = (student.guardians ?? admission?.guardians ?? []).find(g => g.isPrimary) ?? (student.guardians ?? admission?.guardians ?? [])[0];

              return (
                <div key={student.id} className="group flex flex-col gap-4 p-5 transition hover:bg-slate-50/50 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <Avatar 
                      src={student.photoUrl ?? undefined} 
                      initials={initials(studentName)} 
                      size="lg" 
                      className="ring-2 ring-white shadow-sm transition group-hover:ring-primary-100" 
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/dashboard/students/${encodeURIComponent(student.id)}`}
                          className="font-bold text-slate-900 truncate hover:text-primary-600 transition"
                        >
                          {studentName}
                        </Link>
                        <StatusBadge status={student.lifecycleStatus || 'ACTIVE'} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
                        <span className="text-primary-600 font-bold tracking-tight">{student.studentSystemId}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span className="text-slate-700">{className} {sectionName !== 'No section' ? `• ${sectionName}` : ''}</span>
                        {rollNumber && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span>Roll: {rollNumber}</span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 text-[0.7rem] text-slate-400">
                         Guardian: <span className="text-slate-600 font-bold">{primaryGuardian?.fullName || 'N/A'}</span> • {primaryGuardian?.primaryPhone || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/students/${encodeURIComponent(student.id)}`}
                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-900 px-4 text-[0.7rem] font-bold text-white transition hover:bg-slate-800"
                    >
                      View Profile
                      <ChevronRight size={14} />
                    </Link>
                    <Link
                      href={`/dashboard/finance?studentId=${encodeURIComponent(student.id)}`}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[0.7rem] font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      <Wallet size={14} />
                      Fees Ledger
                    </Link>
                    <div className="relative group/actions">
                      <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900">
                        <MoreHorizontal size={16} />
                      </button>
                      <div className="absolute right-0 top-full z-10 mt-2 hidden w-48 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-xl group-hover/actions:block animate-in fade-in zoom-in-95">
                         <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                          onClick={() => onOpenPdf(student.id, 'id-card')}
                        >
                          <FileText size={14} className="text-slate-400" />
                          Generate ID Card
                        </button>
                        <Link
                          href={`/dashboard/students/${encodeURIComponent(student.id)}?edit=true`}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <UserPlus size={14} className="text-slate-400" />
                          Edit Student
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={search || status || classId ? "No students match your filters" : "No students in directory"}
            description={search || status || classId ? "Try adjusting your filters or search query to find the student record." : "Enroll your first student to get started with the SchoolOS directory."}
            action={!(search || status || classId) && (
               <Link
                href="/dashboard/admissions"
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800"
              >
                <UserPlus size={18} />
                Enroll First Student
              </Link>
            )}
          />
        )}
      </SectionCard>

      {pdfError && (
        <div className="rounded-xl border border-danger-100 bg-danger-50 p-4 text-sm font-medium text-danger-600 animate-in fade-in slide-in-from-top-2">
          {pdfError}
        </div>
      )}
    </div>
  );
}

function getStudentName(student: StudentProfile, admission: AdmissionSummary | undefined | null) {
  return (
    student.fullNameEn ||
    [student.firstNameEn, student.lastNameEn].filter(Boolean).join(' ') ||
    admission?.fullNameEn ||
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

function School({ size }: { size: number }) {
  return <SchoolIcon size={size} />;
}

import { School as SchoolIcon, Users } from 'lucide-react';
