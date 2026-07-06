'use client';

import type {
  AcademicYearSummary,
  AdmissionSummary,
  ClassSummary,
  SectionSummary,
  StudentProfile,
  StudentDuplicateCandidate,
  StudentIemisReadinessSummary,
  StudentModuleSummary,
  PaginatedResponse,
} from '@schoolos/core';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { SectionCard } from '../ui/section-card';
import { Badge } from '../ui/badge';
import { Avatar } from '../ui/avatar';
import { Drawer } from '../ui/drawer';
import { LoadingState } from '../ui/loading-state';
import { EmptyState } from '../ui/empty-state';
import { ErrorState } from '../ui/error-state';
import { FilterBar } from '../ui/filter-bar';
import { KpiCard, KpiGrid } from '../ui/kpi-card';
import { ActionMenu } from '../ui/action-menu';
import {
  BookOpenText,
  ContactRound,
  Download,
  FileText,
  FolderOpen,
  MoreHorizontal,
  RotateCcw,
  Search,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  QrCode,
} from 'lucide-react';
import { StatusChip } from '../dashboard/status-chip';
import { StatusBadge } from '../ui/status-badge';

type StudentDirectoryProps = {
  academicYears: AcademicYearSummary[];
  admissions: AdmissionSummary[];
  summary?: StudentModuleSummary;
  classes: ClassSummary[];
  isError: boolean;
  isLoading: boolean;
  onRetry?: () => void;
  onOpenPdf: (studentId: string, kind: string) => void;
  pdfError: string;
  sections: SectionSummary[];
  studentsResponse?: PaginatedResponse<StudentProfile>;
  onExportRoster: (
    format: 'csv' | 'json',
    filters: {
      academicYearId?: string;
      classId?: string;
      sectionId?: string;
    },
  ) => void;
  onExportIemis: () => void;
  canExportIemis: boolean;
  isExportingIemis: boolean;
  iemisReadiness: StudentIemisReadinessSummary[];
  isLoadingIemisReadiness: boolean;
  iemisReadinessError: string;
  canManageDuplicates: boolean;
  duplicateCandidates: StudentDuplicateCandidate[];
  isLoadingDuplicateCandidates: boolean;
  duplicateCandidatesError: string;
  onFilterChange: (filters: {
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    status?: string;
    search?: string;
    page?: number;
  }) => void;
};

export function StudentDirectory({
  academicYears,
  admissions,
  summary,
  classes,
  isError,
  isLoading,
  onRetry,
  onOpenPdf,
  pdfError,
  sections,
  studentsResponse,
  onExportRoster,
  onExportIemis,
  canExportIemis,
  isExportingIemis,
  iemisReadiness,
  isLoadingIemisReadiness,
  iemisReadinessError,
  canManageDuplicates,
  duplicateCandidates,
  isLoadingDuplicateCandidates,
  duplicateCandidatesError,
  onFilterChange,
}: StudentDirectoryProps) {
  const students = studentsResponse?.items ?? [];
  const totalStudents = studentsResponse?.total ?? 0;
  const currentPage = studentsResponse?.page ?? 1;
  const pageSize = studentsResponse?.limit ?? 25;
  const hasNextPage = studentsResponse?.hasNextPage ?? false;
  const totalPages = Math.max(1, Math.ceil(totalStudents / pageSize));
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedStudentId = searchParams.get('student');
  // Read the filter UI's initial values from the URL (once, on mount) so the
  // dropdowns/search box reflect a restored link/refresh instead of always
  // starting blank while the underlying query results are already filtered.
  const [academicYearId, setAcademicYearId] = useState(
    () => searchParams.get('academicYearId') ?? '',
  );
  const [classId, setClassId] = useState(() => searchParams.get('classId') ?? '');
  const [sectionId, setSectionId] = useState(
    () => searchParams.get('sectionId') ?? '',
  );
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '');
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const deferredSearch = useDeferredValue(search);

  const currentAcademicYear = academicYears.find((year) => year.isCurrent);
  const selectedAcademicYear =
    academicYears.find((year) => year.id === academicYearId) ?? currentAcademicYear;
  const availableSections = sections.filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !classId || sectionClassId === classId;
  });
  const selectedSection = availableSections.find((section) => section.id === sectionId);
  const iemisReadyCount = iemisReadiness.filter((item) => item.eligible).length;
  const iemisIssueRows = iemisReadiness.filter((item) => !item.eligible);
  const iemisAverageScore =
    iemisReadiness.length > 0
      ? Math.round(
          iemisReadiness.reduce((sum, item) => sum + item.score, 0) /
            iemisReadiness.length,
        )
      : 0;
  const topIemisIssues = iemisIssueRows.slice(0, 5);

  useEffect(() => {
    if (!academicYearId && currentAcademicYear) {
      setAcademicYearId(currentAcademicYear.id);
    }
  }, [academicYearId, currentAcademicYear]);

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

  useEffect(() => {
    onFilterChange({
      academicYearId: academicYearId || undefined,
      classId: classId || undefined,
      sectionId: sectionId || undefined,
      status: status || undefined,
      search: deferredSearch || undefined,
      page: 1,
    });
  }, [academicYearId, classId, sectionId, status, deferredSearch, onFilterChange]);

  const filteredStudents = students;
  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? null;

  function updateSelectedStudent(studentId?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (studentId) params.set('student', studentId);
    else params.delete('student');
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
  }

  if (isLoading) return <LoadingState label="Loading student directory..." />;

  if (isError) {
    return (
      <ErrorState
        title="Student directory could not load"
        message="Please check your connection and try again. Student records were not changed."
        onRetry={onRetry}
        showReload={!onRetry}
      />
    );
  }

  if (classes.length === 0) {
    return (
      <EmptyState
        title="No classes configured"
        description="You need to set up academic years and classes before you can manage students."
        action={
          <Link href="/dashboard/settings" className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-admissions-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)] focus:ring-offset-2">
            Configure School Settings
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <KpiGrid className="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard
            title="Active Students"
            value={summary?.activeStudents ?? 0}
            icon={<Users size={20} />}
            tone="info"
            description="Server total for active records."
          />
          <KpiCard
            title="Pending Applications"
            value={summary?.pendingApplications ?? 0}
            icon={<ClipboardCheck size={20} />}
            tone="warning"
            description="Server total awaiting review."
          />
          <KpiCard
            title="Missing Documents"
            value={summary?.missingDocuments ?? 0}
            icon={<FolderOpen size={20} />}
            tone={(summary?.missingDocuments ?? 0) > 0 ? 'warning' : 'success'}
            description="Students with no active document."
          />
          <KpiCard
            title="Duplicate Candidates"
            value={summary?.duplicateCandidates ?? 0}
            icon={<UserCheck size={20} />}
            tone={(summary?.duplicateCandidates ?? 0) > 0 ? 'warning' : 'success'}
            description="Server-scored high-confidence pairs."
          />
          <KpiCard
            title="iEMIS Issues"
            value={summary?.iemisIssues ?? 0}
            icon={<AlertTriangle size={20} />}
            tone={(summary?.iemisIssues ?? 0) > 0 ? 'warning' : 'success'}
            description="From backend readiness validation."
          />
          <KpiCard
            title="QR Active"
            value={summary?.qrActive ?? 0}
            icon={<ContactRound size={20} />}
            tone="info"
            description={`${summary?.qrMissing ?? 0} students still need QR setup.`}
          />
        </KpiGrid>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ActionMenu
            label="Open student directory actions"
            items={[
              {
                label: 'Export roster CSV',
                icon: <Download size={16} />,
                onClick: () =>
                  onExportRoster('csv', { academicYearId, classId, sectionId }),
              },
              {
                label: isExportingIemis
                  ? 'Preparing iEMIS export'
                  : 'Export iEMIS',
                icon: <Download size={16} />,
                disabled: !canExportIemis || isExportingIemis,
                onClick: onExportIemis,
              },
            ]}
            trigger={
              <button
                type="button"
                className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)] focus:ring-offset-2"
              >
                <MoreHorizontal size={18} />
                More Actions
              </button>
            }
          />
        </div>
      </div>

      <FilterBar
        label="Directory Filters"
        description="Search and filter student records using server-backed directory filters."
        actions={
          (academicYearId || classId || sectionId || status || search) && (
            <button 
              onClick={() => {
                setAcademicYearId(currentAcademicYear?.id ?? '');
                setClassId('');
                setSectionId('');
                setStatus('');
                setSearch('');
              }}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-[var(--color-mod-admissions-text)] transition hover:bg-[var(--color-mod-admissions-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)]"
            >
              <RotateCcw size={12} />
              Reset All
            </button>
          )
        }
      >
        <div className="grid w-full gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <label className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 ml-1">Academic Year</label>
            <select
              className="premium-input text-sm focus:border-[var(--color-mod-admissions-accent)] focus:ring-[var(--color-mod-admissions-border)]"
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
              className="premium-input text-sm focus:border-[var(--color-mod-admissions-accent)] focus:ring-[var(--color-mod-admissions-border)]"
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
              className="premium-input text-sm focus:border-[var(--color-mod-admissions-accent)] focus:ring-[var(--color-mod-admissions-border)]"
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
              className="premium-input text-sm focus:border-[var(--color-mod-admissions-accent)] focus:ring-[var(--color-mod-admissions-border)]"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="TRANSFERRED">Transferred</option>
              <option value="EXITED">Exited</option>
              <option value="ALUMNI">Alumni</option>
              <option value="ARCHIVED">Archived</option>
              <option value="MERGED">Merged</option>
              <option value="DELETED">Deleted</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 ml-1">Quick Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                className="premium-input pl-9 text-sm focus:border-[var(--color-mod-admissions-accent)] focus:ring-[var(--color-mod-admissions-border)]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name or SCH-ID, guardian, or phone"
                aria-label="Search students by name, student code, guardian name, or phone"
              />
            </div>
          </div>
        </div>
      </FilterBar>

      <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-mod-admissions-border)]">
          Readiness & duplicate attention panels
          <span className="ml-2 text-xs font-semibold text-slate-500">{iemisIssueRows.length} iEMIS issues · {duplicateCandidates.length} duplicate candidates</span>
        </summary>
        <div className="space-y-5 border-t border-slate-100 p-4">
      <SectionCard
        title="Class iEMIS Readiness"
        description={
          classId
            ? `Reviewing ${classes.find((c) => c.id === classId)?.name ?? 'selected class'}${selectedSection ? ` / ${selectedSection.name}` : ''}`
            : 'Reviewing all currently filtered student records for government export completeness'
        }
      >
        {isLoadingIemisReadiness ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-20 animate-pulse rounded-2xl bg-slate-50" />
            <div className="h-20 animate-pulse rounded-2xl bg-slate-50" />
            <div className="h-20 animate-pulse rounded-2xl bg-slate-50" />
          </div>
        ) : iemisReadinessError ? (
          <div className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm font-semibold text-danger-700">
            {iemisReadinessError}
          </div>
        ) : iemisReadiness.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-500">
                  <ClipboardCheck size={16} />
                  <span className="text-[0.65rem] font-black uppercase tracking-wider">Average Score</span>
                </div>
                <p className="mt-2 text-2xl font-black text-slate-900">{iemisAverageScore}%</p>
              </div>
              <div className="rounded-2xl border border-success-100 bg-success-50 p-4">
                <div className="flex items-center gap-2 text-success-700">
                  <CheckCircle2 size={16} />
                  <span className="text-[0.65rem] font-black uppercase tracking-wider">Ready Records</span>
                </div>
                <p className="mt-2 text-2xl font-black text-success-700">{iemisReadyCount}</p>
              </div>
              <div className="rounded-2xl border border-warning-100 bg-warning-50 p-4">
                <div className="flex items-center gap-2 text-warning-700">
                  <AlertTriangle size={16} />
                  <span className="text-[0.65rem] font-black uppercase tracking-wider">Need Review</span>
                </div>
                <p className="mt-2 text-2xl font-black text-warning-700">{iemisIssueRows.length}</p>
              </div>
            </div>

            {topIemisIssues.length > 0 ? (
              <div className="space-y-2">
                {topIemisIssues.map((item) => (
                  <div
                    key={item.studentId}
                    className="flex flex-col gap-3 rounded-xl border border-warning-100 bg-white p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-900">{item.fullNameEn}</p>
                        <Badge variant="warning" className="text-[0.65rem] font-extrabold uppercase">
                          {item.score}% ready
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {item.studentSystemId} / {item.className}
                        {item.sectionName ? ` / ${item.sectionName}` : ''}
                      </p>
                      <p className="mt-2 text-xs font-medium text-slate-600">
                        {item.issues.slice(0, 2).map((issue) => issue.message).join('; ')}
                        {item.issuesCount > 2 ? `; ${item.issuesCount - 2} more` : ''}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/students/${encodeURIComponent(item.studentId)}`}
                      className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-admissions-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)] focus:ring-offset-2"
                    >
                      Fix Profile
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-success-100 bg-success-50 p-5 text-sm font-semibold text-success-700">
                All records in this review set are ready for iEMIS export.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
            No student records match the current iEMIS readiness filters.
          </div>
        )}
      </SectionCard>

      {canManageDuplicates ? (
        <SectionCard
          title="Duplicate Review"
          description="Admin-only candidate review based on name, guardian phone, DOB, admission number, and previous school."
        >
          {isLoadingDuplicateCandidates ? (
            <div className="grid gap-3">
              <div className="h-16 animate-pulse rounded-2xl bg-slate-50" />
              <div className="h-16 animate-pulse rounded-2xl bg-slate-50" />
            </div>
          ) : duplicateCandidatesError ? (
            <div className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm font-semibold text-danger-700">
              {duplicateCandidatesError}
            </div>
          ) : duplicateCandidates.length > 0 ? (
            <div className="grid gap-3">
              {duplicateCandidates.map((candidate) => (
                <div
                  key={`${candidate.sourceStudent.id}-${candidate.candidateStudent.id}`}
                  className="rounded-xl border border-warning-100 bg-warning-50/40 p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-warning-600">
                        <AlertTriangle size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          {candidate.sourceStudent.fullNameEn} may match {candidate.candidateStudent.fullNameEn}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-600">
                          {candidate.reasons.join(', ')}
                        </p>
                        {candidate.blockedReason ? (
                          <p className="mt-2 text-xs font-bold text-warning-700">
                            {candidate.blockedReason}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="phase2"
                        className="border-warning-200 bg-white text-warning-700"
                      >
                        {candidate.confidence} / {candidate.score}
                      </Badge>
                      <Link
                        href={`/dashboard/students/${encodeURIComponent(candidate.sourceStudent.id)}`}
                        className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)]"
                      >
                        Review
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm font-semibold text-slate-600">
              No duplicate candidates found in the current review window.
            </div>
          )}
        </SectionCard>
      ) : null}
        </div>
      </details>

      <SectionCard
        title="Student Roster"
        description={classId ? `Showing students for ${classes.find(c => c.id === classId)?.name}` : 'Showing all student records'}
        noPadding
      >
        {filteredStudents.length > 0 ? (
          <div className="divide-y divide-slate-100" data-testid="student-directory-results">
            {filteredStudents.map((student) => {
              const admission = admissionBySystemId.get(student.studentSystemId);
              const studentName = getStudentName(student, admission);
              const className = student.className ?? student.class?.name ?? admission?.className ?? 'Not assigned';
              const sectionName = student.sectionName ?? student.section ?? admission?.sectionName ?? 'No section';
              const rollNumber = student.rollNumber ?? admission?.rollNumber ?? null;
              const primaryGuardian = (student.guardians ?? admission?.guardians ?? []).find(g => g.isPrimary) ?? (student.guardians ?? admission?.guardians ?? [])[0];

              return (
                <div
                  key={student.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Inspect ${studentName}`}
                  onClick={() => updateSelectedStudent(student.id)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') updateSelectedStudent(student.id); }}
                  className={`group flex flex-col gap-4 p-5 transition hover:bg-slate-50/50 lg:flex-row lg:items-center lg:justify-between ${selectedStudentId === student.id ? 'bg-[var(--color-mod-admissions-soft)] ring-1 ring-inset ring-[var(--color-mod-admissions-border)]' : ''}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <Avatar 
                      src={student.photoUrl ?? undefined} 
                      initials={initials(studentName)} 
                      size="lg" 
                      className="ring-2 ring-white shadow-sm transition group-hover:ring-[var(--color-mod-admissions-border)]"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          onClick={(event) => event.stopPropagation()}
                          href={`/dashboard/students/${encodeURIComponent(student.id)}`}
                          className="font-bold text-slate-900 truncate hover:text-[var(--color-mod-admissions-text)] transition"
                        >
                          {studentName}
                        </Link>
                        <StatusChip status={student.lifecycleStatus || 'ACTIVE'} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
                        <span className="text-[var(--color-mod-admissions-text)] font-bold tracking-tight">{student.studentSystemId}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span className="text-slate-700">{className} {sectionName !== 'No section' ? `• ${sectionName}` : ''}</span>
                        {rollNumber && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span>Roll: {rollNumber}</span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 text-[0.7rem] text-slate-500">
                         Guardian: <span className="text-slate-700 font-bold">{primaryGuardian?.fullName || 'Not recorded'}</span> • {primaryGuardian?.primaryPhone || 'No phone'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      onClick={(event) => event.stopPropagation()}
                      href={`/dashboard/students/${encodeURIComponent(student.id)}`}
                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 text-[0.7rem] font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-admissions-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)] focus:ring-offset-2"
                    >
                      View Profile
                      <ChevronRight size={14} />
                    </Link>
                    <Link
                      onClick={(event) => event.stopPropagation()}
                      href={`/dashboard/finance?studentId=${encodeURIComponent(student.id)}`}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[0.7rem] font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      <Wallet size={14} />
                      Fees Ledger
                    </Link>
                    <ActionMenu
                      label={`Open actions for ${studentName}`}
                      items={[
                        {
                          label: 'Edit Student',
                          icon: <UserPlus size={14} />,
                          onClick: () =>
                            router.push(
                              `/dashboard/students/${encodeURIComponent(student.id)}?edit=true`,
                            ),
                        },
                        {
                          label: 'Edit Guardian',
                          icon: <ContactRound size={14} />,
                          onClick: () =>
                            router.push(
                              `/dashboard/students/${encodeURIComponent(student.id)}?tab=Guardians`,
                            ),
                        },
                        {
                          label: 'ID Card',
                          icon: <FileText size={14} />,
                          onClick: () => onOpenPdf(student.id, 'id-card'),
                        },
                        {
                          label: 'Documents',
                          icon: <FolderOpen size={14} />,
                          onClick: () =>
                            router.push(
                              `/dashboard/students/${encodeURIComponent(student.id)}?tab=Documents`,
                            ),
                        },
                        {
                          label: 'Attendance',
                          icon: <BookOpenText size={14} />,
                          onClick: () =>
                            router.push(
                              `/dashboard/students/${encodeURIComponent(student.id)}?tab=Attendance`,
                            ),
                        },
                      ]}
                      trigger={
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      }
                    />
                  </div>
                </div>
              );
            })}
            {totalStudents > students.length && (
              <div className="flex items-center justify-between border-t border-slate-100 p-4">
                <p className="text-xs font-bold text-slate-500">
                  Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalStudents)} of {totalStudents} records
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => onFilterChange({ 
                      academicYearId, classId, sectionId, status, search: deferredSearch, 
                      page: currentPage - 1 
                    })}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-30"
                  >
                    Previous
                  </button>
                  <span className="min-w-20 text-center text-xs font-bold text-slate-900">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    disabled={!hasNextPage}
                    onClick={() => onFilterChange({ 
                      academicYearId, classId, sectionId, status, search: deferredSearch, 
                      page: currentPage + 1 
                    })}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            title={search || status || classId || sectionId ? "No students found" : "No students in directory"}
            description={search || status || classId || sectionId ? "Add a student or adjust filters to find the student record." : "Enroll your first student to get started with the SchoolOS directory."}
            action={!(search || status || classId) && (
               <Link
                href="/dashboard/admissions"
                className="flex items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-admissions-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)] focus:ring-offset-2"
              >
                <UserPlus size={18} />
                Enroll First Student
              </Link>
            )}
          />
        )}
      </SectionCard>

      {pdfError && (
        <div className="animate-in fade-in slide-in-from-top-2 rounded-xl border border-danger-100 bg-danger-50 p-4 text-sm font-medium text-danger-600">
          {pdfError}
        </div>
      )}

      <Drawer
        isOpen={Boolean(selectedStudent)}
        onClose={() => updateSelectedStudent()}
        title="Student Inspector"
        width="sm"
      >
        {selectedStudent ? (
          <StudentInspector
            student={selectedStudent}
            admission={admissionBySystemId.get(selectedStudent.studentSystemId)}
            onOpenPdf={onOpenPdf}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

function StudentInspector({ student, admission, onOpenPdf }: { student: StudentProfile; admission?: AdmissionSummary; onOpenPdf: (studentId: string, kind: string) => void }) {
  const name = getStudentName(student, admission);
  const guardians = student.guardians ?? admission?.guardians ?? [];
  const primaryGuardian = guardians.find((guardian) => guardian.isPrimary) ?? guardians[0];
  const guardianEmail =
    primaryGuardian &&
    'email' in primaryGuardian &&
    typeof primaryGuardian.email === 'string'
      ? primaryGuardian.email
      : 'Email not included in directory data';
  return (
    <div className="space-y-5 pt-5">
      <div className="text-center"><Avatar src={student.photoUrl} initials={initials(name)} size="xl" className="mx-auto" /><div className="mt-3 flex items-center justify-center gap-2"><h3 className="text-lg font-black text-slate-950">{name}</h3><StatusChip status={student.lifecycleStatus ?? 'ACTIVE'} /></div><p className="mt-1 text-xs font-bold text-[var(--color-mod-admissions-text)]">{student.studentSystemId}</p><p className="mt-2 text-xs text-slate-500">{student.className ?? student.class?.name ?? admission?.className ?? 'No class'} / {student.sectionName ?? student.section ?? admission?.sectionName ?? 'No section'} · Roll {student.rollNumber ?? admission?.rollNumber ?? '—'}</p></div>
      <Link href={`/dashboard/students/${encodeURIComponent(student.id)}`} className="flex min-h-10 w-full items-center justify-center rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 text-sm font-bold text-white shadow-sm hover:bg-[var(--color-mod-admissions-text)]">View Full Profile</Link>
      <section className="border-t border-slate-100 pt-4"><h4 className="text-xs font-black uppercase tracking-wide text-slate-500">Guardian</h4>{primaryGuardian ? <div className="mt-3 space-y-1 text-sm"><p className="font-bold text-slate-900">{primaryGuardian.fullName} <span className="font-medium text-slate-500">({primaryGuardian.relation})</span></p><p className="text-xs text-slate-600">{primaryGuardian.primaryPhone}</p><p className="text-xs text-slate-600">{guardianEmail}</p></div> : <p className="mt-3 text-sm text-slate-500">No guardian linked.</p>}</section>
      <section className="border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><h4 className="text-xs font-black uppercase tracking-wide text-slate-500">Document Checklist</h4><span className="text-xs font-bold text-slate-400">Open profile</span></div><p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Document counts are not included in the paginated directory contract. Open the protected document workspace for the authoritative checklist.</p><Link href={`/dashboard/admissions/documents?student=${encodeURIComponent(student.id)}`} className="mt-3 inline-flex text-xs font-bold text-[var(--color-mod-admissions-text)]">Review documents</Link></section>
      <section className="border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><h4 className="text-xs font-black uppercase tracking-wide text-slate-500">QR / ID Card</h4><StatusBadge status={student.qrCredential?.status ?? 'NOT_GENERATED'} tone={student.qrCredential?.status === 'ACTIVE' ? 'active' : 'inactive'} /></div><div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><QrCode className="h-12 w-12 text-slate-400" /><div><p className="text-xs font-bold text-slate-800">Secure QR credential</p><p className="mt-1 text-[0.68rem] text-slate-500">Raw QR values are never shown from directory data.</p></div></div><button type="button" onClick={() => onOpenPdf(student.id, 'id-card')} className="mt-3 flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50">View / Print ID Card</button></section>
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
