'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { StudentDirectory } from '../../../components/forms/student-directory';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '../../../components/session-provider';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleHeader } from '../../../components/ui/module-header';
import Link from 'next/link';
import { M1ModuleNav } from '../../../components/m1/m1-module-nav';

const STUDENT_ROSTER_PAGE_SIZE = 25;

export default function StudentsPage() {
  const [pdfError, setPdfError] = useState('');
  const [isExportingIemis, setIsExportingIemis] = useState(false);
  const { hasPermissions } = useSession();
  const canManageStudentLifecycle = hasPermissions(['students:manage_lifecycle']);
  const canReadStudents = hasPermissions(['students:read']);

  const [filters, setFilters] = useState<{
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    status?: string;
    search?: string;
    page?: number;
  }>({ page: 1 });

  const admissionsQuery = useQuery({
    queryKey: ['admissions'],
    queryFn: () => api.listAdmissions({ limit: 100 }),
  });
  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });
  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: api.listSections,
  });
  const studentsQuery = useQuery({ 
    queryKey: ['students', filters], 
    queryFn: () => {
      return api.listStudents({
        ...filters,
        limit: STUDENT_ROSTER_PAGE_SIZE,
      });
    } 
  });
  const studentSummaryQuery = useQuery({
    queryKey: ['students', 'module-summary', filters],
    queryFn: () => api.getStudentModuleSummary(filters),
  });
  const duplicateCandidatesQuery = useQuery({
    queryKey: ['student-duplicate-candidates'],
    queryFn: () => api.listDuplicateStudentCandidates({ limit: 5 }),
    enabled: canManageStudentLifecycle,
  });
  const iemisReadinessQuery = useQuery({
    queryKey: [
      'student-iemis-readiness-list',
      filters.classId,
      filters.sectionId,
    ],
    queryFn: () =>
      api.listIemisReadiness({
        classId: filters.classId,
        sectionId: filters.sectionId,
      }),
    enabled: canReadStudents,
  });

  async function openStudentPdf(studentId: string, kind: string) {
    setPdfError('');
    try {
      await api.openStudentDocumentPdf(studentId, kind);
    } catch (error) {
      setPdfError(
        error instanceof Error ? error.message : 'Unable to open generated PDF',
      );
    }
  }

  async function handleExportRoster(
    format: 'csv' | 'json',
    filters: {
      academicYearId?: string;
      classId?: string;
      sectionId?: string;
    },
  ) {
    setPdfError('');
    try {
      await api.exportReport('class-roster', {
        format,
        filters,
      });
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Export failed');
    }
  }

  async function handleExportIemis() {
    setPdfError('');
    setIsExportingIemis(true);
    try {
      const result = await api.exportIemisStudents();
      setPdfError(
        `iEMIS export prepared: ${result.validRecords}/${result.totalRecords} valid records (${result.fileName}).`,
      );
    } catch (error) {
      setPdfError(
        error instanceof Error ? error.message : 'iEMIS export failed',
      );
    } finally {
      setIsExportingIemis(false);
    }
  }

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Admissions & Student Profiles"
        description="Manage admissions, student records, guardians, documents, QR, and iEMIS readiness."
        primaryAction={
          <Link
            href="/dashboard/admissions/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-admissions-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-border)] focus:ring-offset-2"
          >
            <UserPlus size={18} />
            New Admission
          </Link>
        }
      >
        <M1ModuleNav />
      </ModuleHeader>

      <StudentDirectory
        academicYears={academicYearsQuery.data ?? []}
        admissions={admissionsQuery.data?.items ?? []}
        summary={studentSummaryQuery.data}
        classes={classesQuery.data ?? []}
        isError={
          academicYearsQuery.isError ||
          classesQuery.isError ||
          sectionsQuery.isError ||
          studentsQuery.isError ||
          admissionsQuery.isError ||
          studentSummaryQuery.isError
        }
        isLoading={
          academicYearsQuery.isLoading ||
          classesQuery.isLoading ||
          sectionsQuery.isLoading ||
          studentsQuery.isLoading ||
          admissionsQuery.isLoading ||
          studentSummaryQuery.isLoading
        }
        pdfError={pdfError}
        onRetry={() => {
          void academicYearsQuery.refetch();
          void classesQuery.refetch();
          void sectionsQuery.refetch();
          void studentsQuery.refetch();
          void admissionsQuery.refetch();
          void studentSummaryQuery.refetch();
          void duplicateCandidatesQuery.refetch();
          void iemisReadinessQuery.refetch();
        }}
        sections={sectionsQuery.data ?? []}
        studentsResponse={studentsQuery.data}
        onOpenPdf={(studentId, kind) => void openStudentPdf(studentId, kind)}
        onExportRoster={(format, filters) =>
          void handleExportRoster(format, filters)
        }
        onExportIemis={() => void handleExportIemis()}
        canExportIemis={canReadStudents}
        isExportingIemis={isExportingIemis}
        iemisReadiness={iemisReadinessQuery.data ?? []}
        isLoadingIemisReadiness={iemisReadinessQuery.isLoading}
        iemisReadinessError={
          iemisReadinessQuery.error instanceof Error
            ? iemisReadinessQuery.error.message
            : ''
        }
        canManageDuplicates={canManageStudentLifecycle}
        duplicateCandidates={duplicateCandidatesQuery.data?.candidates ?? []}
        isLoadingDuplicateCandidates={duplicateCandidatesQuery.isLoading}
        duplicateCandidatesError={
          duplicateCandidatesQuery.error instanceof Error
            ? duplicateCandidatesQuery.error.message
            : ''
        }
        onFilterChange={setFilters}
      />
    </DashboardPageShell>
  );
}
