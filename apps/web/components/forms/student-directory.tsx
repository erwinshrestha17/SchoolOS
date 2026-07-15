'use client';

import type {
  AcademicYearSummary,
  AdmissionSummary,
  ClassSummary,
  SectionSummary,
  StudentProfile,
  StudentModuleSummary,
  PaginatedResponse,
} from '@schoolos/core';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { Badge } from '../ui/badge';
import { StudentAvatar } from '../students/student-avatar';
import { Drawer } from '../ui/drawer';
import { LoadingState } from '../ui/loading-state';
import { ErrorState } from '../ui/error-state';
import { TablePagination } from '../ui/table-pagination';
import { ActionMenu } from '../ui/action-menu';
import { SummaryCard, SummaryGrid } from '../ui/summary-card';
import { WorkspaceTabs } from '../ui/module-tabs';
import {
  BookOpenText,
  ContactRound,
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
  QrCode,
} from 'lucide-react';
import { StatusChip } from '../dashboard/status-chip';
import { StatusBadge } from '../ui/status-badge';
import { Button } from '../ui/primitives/button';
import { WorkSurface } from '../ui/work-surface';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../ui/primitives/empty';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '../ui/primitives/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../ui/primitives/select';

type StudentDirectoryProps = {
  academicYears: AcademicYearSummary[];
  admissions: AdmissionSummary[];
  summary?: StudentModuleSummary;
  summaryLoading: boolean;
  summaryUnavailable: boolean;
  canCreateAdmission: boolean;
  classes: ClassSummary[];
  isError: boolean;
  isLoading: boolean;
  onRetry?: () => void;
  onOpenPdf: (studentId: string, kind: string) => void;
  pdfError: string;
  sections: SectionSummary[];
  studentsResponse?: PaginatedResponse<StudentProfile>;
  filters: {
    academicYearId: string;
    classId: string;
    sectionId: string;
    status: string;
    search: string;
    page: number;
  };
  onFilterChange: (filters: {
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    status?: string;
    search?: string;
    page?: number;
  }, options?: { history?: 'push' | 'replace' }) => void;
};

export function StudentDirectory({
  academicYears,
  admissions,
  summary,
  summaryLoading,
  summaryUnavailable,
  canCreateAdmission,
  classes,
  isError,
  isLoading,
  onRetry,
  onOpenPdf,
  pdfError,
  sections,
  studentsResponse,
  filters,
  onFilterChange,
}: StudentDirectoryProps) {
  const students = studentsResponse?.items ?? [];
  const totalStudents = studentsResponse?.total ?? 0;
  const currentPage = studentsResponse?.page ?? 1;
  const pageSize = studentsResponse?.limit ?? 25;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedStudentId = searchParams.get('student');
  const { academicYearId, classId, sectionId, status, search } = filters;

  const currentAcademicYear = academicYears.find((year) => year.isCurrent);
  const availableSections = sections.filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !classId || sectionClassId === classId;
  });
  const hasActiveFilters = Boolean(
    classId ||
      sectionId ||
      status ||
      search ||
      (academicYearId && academicYearId !== currentAcademicYear?.id),
  );

  useEffect(() => {
    if (!academicYearId && currentAcademicYear) {
      onFilterChange({ academicYearId: currentAcademicYear.id });
    }
  }, [academicYearId, currentAcademicYear, onFilterChange]);

  const admissionBySystemId = useMemo(() => {
    const map = new Map<string, AdmissionSummary>();
    for (const admission of admissions) {
      map.set(admission.studentSystemId, admission);
    }
    return map;
  }, [admissions]);

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
      <Empty className="border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpenText aria-hidden />
          </EmptyMedia>
          <EmptyTitle>No classes configured</EmptyTitle>
          <EmptyDescription>
            Set up academic years and classes before managing students.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/dashboard/settings">Configure School Settings</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <SummaryGrid>
          <SummaryCard
            label="Active Students"
            value={summaryUnavailable ? 'Unavailable' : (summary?.activeStudents ?? 'Unavailable')}
            icon={<Users aria-hidden />}
            loading={summaryLoading}
            href="/dashboard/students?status=ACTIVE"
            description="Currently active student records."
          />
          <SummaryCard
            label="Document Issues"
            value={summaryUnavailable ? 'Unavailable' : (summary?.missingDocuments ?? 'Unavailable')}
            icon={<FolderOpen aria-hidden />}
            loading={summaryLoading}
            href="/dashboard/admissions/documents"
            description="Records with missing documents."
          />
          <SummaryCard
            label="Duplicate Candidates"
            value={summaryUnavailable ? 'Unavailable' : (summary?.duplicateCandidates ?? 'Unavailable')}
            icon={<UserCheck aria-hidden />}
            loading={summaryLoading}
            href="/dashboard/admissions/duplicates"
            description="Possible matching student records."
          />
          <SummaryCard
            label="iEMIS Issues"
            value={summaryUnavailable ? 'Unavailable' : (summary?.iemisIssues ?? 'Unavailable')}
            icon={<AlertTriangle aria-hidden />}
            loading={summaryLoading}
            href="/dashboard/admissions/iemis"
            description="Student records with iEMIS issues."
          />
      </SummaryGrid>

      <WorkspaceTabs
        activeValue={status || 'ALL'}
        onValueChange={(value) =>
          onFilterChange(
            { status: value === 'ALL' ? '' : value, page: 1 },
            { history: 'push' },
          )
        }
        label="Student lifecycle views"
        items={[
          { value: 'ALL', label: 'All Students' },
          { value: 'ACTIVE', label: 'Active' },
          { value: 'TRANSFERRED', label: 'Transferred' },
          { value: 'EXITED', label: 'Withdrawn' },
          { value: 'ALUMNI', label: 'Alumni' },
        ]}
      />

      <WorkSurface
        title="Student Roster"
        description={
          hasActiveFilters
            ? `${totalStudents} students matching the selected filters`
            : `${totalStudents} students`
        }
        variant="table"
        flush
        data-testid="student-roster-workspace"
      >
          <div
            className="grid gap-3 border-b border-border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(9rem,1fr)_minmax(8rem,0.8fr)_minmax(8rem,0.8fr)_minmax(8rem,0.8fr)_minmax(15rem,1.7fr)_auto]"
            aria-label="Directory filters"
            role="group"
          >
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="student-academic-year"
                className="text-xs font-medium text-muted-foreground"
              >
                Academic Year
              </label>
              <Select
                value={academicYearId || 'ALL'}
                onValueChange={(value) =>
                  onFilterChange({
                    academicYearId: value === 'ALL' ? '' : value,
                    page: 1,
                  })
                }
              >
                <SelectTrigger id="student-academic-year">
                  <SelectValue placeholder="All years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Academic years</SelectLabel>
                    <SelectItem value="ALL">All Years</SelectItem>
                    {academicYears.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.name}{year.isCurrent ? ' (Current)' : ''}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="student-class"
                className="text-xs font-medium text-muted-foreground"
              >
                Class
              </label>
              <Select
                value={classId || 'ALL'}
                onValueChange={(value) =>
                  onFilterChange({
                    classId: value === 'ALL' ? '' : value,
                    sectionId: '',
                    page: 1,
                  })
                }
              >
                <SelectTrigger id="student-class">
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Classes</SelectLabel>
                    <SelectItem value="ALL">All Classes</SelectItem>
                    {classes.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="student-section"
                className="text-xs font-medium text-muted-foreground"
              >
                Section
              </label>
              <Select
                value={sectionId || 'ALL'}
                onValueChange={(value) =>
                  onFilterChange({
                    sectionId: value === 'ALL' ? '' : value,
                    page: 1,
                  })
                }
                disabled={!classId}
              >
                <SelectTrigger id="student-section">
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Sections</SelectLabel>
                    <SelectItem value="ALL">All Sections</SelectItem>
                    {availableSections.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="student-status"
                className="text-xs font-medium text-muted-foreground"
              >
                Status
              </label>
              <Select
                value={status || 'ALL'}
                onValueChange={(value) =>
                  onFilterChange({
                    status: value === 'ALL' ? '' : value,
                    page: 1,
                  })
                }
              >
                <SelectTrigger id="student-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Student status</SelectLabel>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="TRANSFERRED">Transferred</SelectItem>
                    <SelectItem value="EXITED">Exited</SelectItem>
                    <SelectItem value="ALUMNI">Alumni</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                    <SelectItem value="MERGED">Merged</SelectItem>
                    <SelectItem value="DELETED">Deleted</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-2 xl:col-span-1">
              <label
                htmlFor="student-search"
                className="text-xs font-medium text-muted-foreground"
              >
                Quick Search
              </label>
              <InputGroup>
                <InputGroupAddon>
                  <Search aria-hidden />
                </InputGroupAddon>
                <InputGroupInput
                  id="student-search"
                  value={search}
                  onChange={(event) =>
                    onFilterChange({ search: event.target.value, page: 1 })
                  }
                  placeholder="Name, student ID, guardian, or phone"
                  aria-label="Search students by name, student code, guardian name, or phone"
                />
              </InputGroup>
            </div>

            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-end"
                onClick={() =>
                  onFilterChange({
                    academicYearId: currentAcademicYear?.id ?? '',
                    classId: '',
                    sectionId: '',
                    status: '',
                    search: '',
                    page: 1,
                  })
                }
              >
                <RotateCcw data-icon="inline-start" />
                Reset
              </Button>
            ) : null}
          </div>

          {filteredStudents.length > 0 ? (
          <div className="divide-y divide-border" data-testid="student-directory-results">
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
                  className={`group flex flex-col gap-3 p-4 transition hover:bg-muted/30 lg:flex-row lg:items-center lg:justify-between ${selectedStudentId === student.id ? 'bg-accent/50 ring-1 ring-inset ring-border' : ''}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <StudentAvatar
                      studentId={student.id}
                      photoVersion={student.photoVersion}
                      initials={initials(studentName)}
                      alt={studentName}
                      size="lg"
                      className="ring-2 ring-background shadow-sm transition group-hover:ring-border"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/students/${encodeURIComponent(student.id)}`}
                          className="truncate font-semibold text-foreground transition hover:text-primary"
                        >
                          {studentName}
                        </Link>
                        <StatusChip status={student.lifecycleStatus || 'ACTIVE'} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium text-primary">{student.studentSystemId}</span>
                        <span className="size-1 rounded-full bg-border" />
                        <span className="text-foreground">{className} {sectionName !== 'No section' ? `• ${sectionName}` : ''}</span>
                        {rollNumber && (
                          <>
                            <span className="size-1 rounded-full bg-border" />
                            <span>Roll: {rollNumber}</span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                         Guardian: <span className="font-medium text-foreground">{primaryGuardian?.fullName || 'Not recorded'}</span> • {primaryGuardian?.primaryPhone || 'No phone'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => updateSelectedStudent(student.id)}
                    >
                      Quick view
                    </Button>
                    <Button asChild size="sm">
                      <Link href={`/dashboard/students/${encodeURIComponent(student.id)}`}>
                        View Profile
                        <ChevronRight data-icon="inline-end" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/fees/collect?studentId=${encodeURIComponent(student.id)}`}>
                        <Wallet data-icon="inline-start" />
                        Fees Ledger
                      </Link>
                    </Button>
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
                        <Button type="button" variant="outline" size="icon-sm">
                          <MoreHorizontal />
                        </Button>
                      }
                    />
                  </div>
                </div>
              );
            })}
            {totalStudents > students.length && (
              <TablePagination
                page={currentPage}
                pageSize={pageSize}
                total={totalStudents}
                onPageChange={(page) =>
                  onFilterChange({
                    academicYearId,
                    classId,
                    sectionId,
                    status,
                    search,
                    page,
                  })
                }
              />
            )}
          </div>
        ) : (
          <Empty className="gap-4 rounded-none border-0 p-8 md:p-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Users aria-hidden />
              </EmptyMedia>
              <EmptyTitle>
                {hasActiveFilters
                  ? 'No students match these filters'
                  : 'No students in directory'}
              </EmptyTitle>
              <EmptyDescription>
                {hasActiveFilters
                  ? 'Adjust the filters or search to find a student record.'
                  : 'Start a new admission to add the first enrolled student.'}
              </EmptyDescription>
            </EmptyHeader>
            {!hasActiveFilters && canCreateAdmission ? (
              <EmptyContent>
                <Button asChild>
                  <Link href="/dashboard/admissions/new">
                    <UserPlus data-icon="inline-start" />
                    New admission
                  </Link>
                </Button>
              </EmptyContent>
            ) : null}
          </Empty>
        )}
      </WorkSurface>

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
      <div className="text-center"><StudentAvatar studentId={student.id} photoVersion={student.photoVersion} initials={initials(name)} alt={name} size="xl" className="mx-auto" /><div className="mt-3 flex items-center justify-center gap-2"><h3 className="text-lg font-black text-slate-950">{name}</h3><StatusChip status={student.lifecycleStatus ?? 'ACTIVE'} /></div><p className="mt-1 text-xs font-bold text-[var(--color-mod-admissions-text)]">{student.studentSystemId}</p><p className="mt-2 text-xs text-slate-500">{student.className ?? student.class?.name ?? admission?.className ?? 'No class'} / {student.sectionName ?? student.section ?? admission?.sectionName ?? 'No section'} · Roll {student.rollNumber ?? admission?.rollNumber ?? '—'}</p></div>
      <Link href={`/dashboard/students/${encodeURIComponent(student.id)}`} className="flex min-h-10 w-full items-center justify-center rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 text-sm font-bold text-white shadow-sm hover:bg-[var(--color-mod-admissions-text)]">View Full Profile</Link>
      <section className="border-t border-slate-100 pt-4"><h4 className="text-xs font-black uppercase tracking-wide text-slate-500">Guardian</h4>{primaryGuardian ? <div className="mt-3 space-y-1 text-sm"><p className="font-bold text-slate-900">{primaryGuardian.fullName} <span className="font-medium text-slate-500">({primaryGuardian.relation})</span></p><p className="text-xs text-slate-600">{primaryGuardian.primaryPhone}</p><p className="text-xs text-slate-600">{guardianEmail}</p></div> : <p className="mt-3 text-sm text-slate-500">No guardian linked.</p>}</section>
      <section className="border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><h4 className="text-xs font-black uppercase tracking-wide text-slate-500">Document Checklist</h4><span className="text-xs font-bold text-slate-400">Open profile</span></div><p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Open the protected document workspace for the current checklist.</p><Link href={`/dashboard/admissions/documents?student=${encodeURIComponent(student.id)}`} className="mt-3 inline-flex text-xs font-bold text-[var(--color-mod-admissions-text)]">Review documents</Link></section>
      <section className="border-t border-slate-100 pt-4"><div className="flex items-center justify-between"><h4 className="text-xs font-black uppercase tracking-wide text-slate-500">QR / ID Card</h4><StatusBadge status={student.qrCredential?.status ?? 'NOT_GENERATED'} tone={student.qrCredential?.status === 'ACTIVE' ? 'active' : 'inactive'} /></div><div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><QrCode className="h-12 w-12 text-slate-400" /><div><p className="text-xs font-bold text-slate-800">Secure QR credential</p><p className="mt-1 text-[0.68rem] text-slate-500">QR security details stay protected.</p></div></div><button type="button" onClick={() => onOpenPdf(student.id, 'id-card')} className="mt-3 flex min-h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50">View / Print ID Card</button></section>
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
