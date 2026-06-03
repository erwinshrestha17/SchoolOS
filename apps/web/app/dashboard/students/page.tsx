'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { StudentDirectory } from '../../../components/forms/student-directory';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '../../../components/session-provider';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleHero } from '../../../components/dashboard/module-hero';

export default function StudentsPage() {
  const [pdfError, setPdfError] = useState('');
  const [isExportingIemis, setIsExportingIemis] = useState(false);
  const { hasPermissions } = useSession();
  const canManageStudentLifecycle = hasPermissions(['students:manage_lifecycle']);

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
      const { academicYearId, ...studentFilters } = filters;
      return api.listStudents(studentFilters);
    } 
  });
  const duplicateCandidatesQuery = useQuery({
    queryKey: ['student-duplicate-candidates'],
    queryFn: () => api.listDuplicateStudentCandidates({ limit: 5 }),
    enabled: canManageStudentLifecycle,
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
      <ModuleHero
        title="Student Directory"
        subtitle="Search student records, manage placement, and open profile details."
        badge="Students"
        category="Student Management"
        icon={<Users size={32} className="text-blue-400" />}
        accentColor="blue"
        variant="dark"
      />

      <StudentDirectory
        academicYears={academicYearsQuery.data ?? []}
        admissions={admissionsQuery.data?.items ?? []}
        classes={classesQuery.data ?? []}
        isError={
          academicYearsQuery.isError ||
          classesQuery.isError ||
          sectionsQuery.isError ||
          studentsQuery.isError ||
          admissionsQuery.isError
        }
        isLoading={
          academicYearsQuery.isLoading ||
          classesQuery.isLoading ||
          sectionsQuery.isLoading ||
          studentsQuery.isLoading ||
          admissionsQuery.isLoading
        }
        pdfError={pdfError}
        sections={sectionsQuery.data ?? []}
        studentsResponse={studentsQuery.data}
        onOpenPdf={(studentId, kind) => void openStudentPdf(studentId, kind)}
        onExportRoster={(format, filters) =>
          void handleExportRoster(format, filters)
        }
        onExportIemis={() => void handleExportIemis()}
        canExportIemis={hasPermissions(['students:read'])}
        isExportingIemis={isExportingIemis}
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
