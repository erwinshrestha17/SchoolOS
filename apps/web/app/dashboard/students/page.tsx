'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { StudentDirectory } from '../../../components/forms/student-directory';
import { PageHeader } from '../../../components/ui/page-header';
import { Users } from 'lucide-react';
import { useState } from 'react';

export default function StudentsPage() {
  const [pdfError, setPdfError] = useState('');

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
    queryFn: () => api.listStudents(filters) 
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Directory"
        description="Search student records, manage placement, and open profile details."
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
        onFilterChange={setFilters}
      />
    </div>
  );
}
