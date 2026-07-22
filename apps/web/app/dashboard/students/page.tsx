'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { StudentDirectory } from '../../../components/forms/student-directory';
import {
  Download,
  FileCheck2,
  FolderOpen,
  QrCode,
  ScanSearch,
  UserPlus,
} from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useSession } from '../../../components/session-provider';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { M1PageHeader } from '../../../components/m1/m1-page-header';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUrlFilters } from '../../../lib/hooks/use-url-filters';
import { schoolFacingErrorMessage } from '../../../lib/school-facing-error';
import { Button } from '../../../components/ui/primitives/button';

const STUDENT_ROSTER_PAGE_SIZE = 25;

export default function StudentsPage() {
  const router = useRouter();
  const [pdfError, setPdfError] = useState('');
  const [isExportingIemis, setIsExportingIemis] = useState(false);
  const { hasPermissions } = useSession();
  const canManageStudentLifecycle = hasPermissions(['students:manage_lifecycle']);
  const canReadStudents = hasPermissions(['students:read']);
  const canCreateAdmission = hasPermissions([
    'enrollments:create',
    'students:create',
    'guardians:create',
  ]);

  // URL-backed so refreshing, using browser back/forward, or sharing a link
  // to a filtered roster (e.g. "Grade 6, Section A, page 2") preserves it.
  const [filters, setFilters] = useUrlFilters({
    academicYearId: '',
    classId: '',
    sectionId: '',
    status: '',
    search: '',
    page: 1,
  });
  const deferredSearch = useDeferredValue(filters.search);
  const serverFilters = { ...filters, search: deferredSearch };
  const summaryFilters = {
    academicYearId: filters.academicYearId,
    classId: filters.classId,
    sectionId: filters.sectionId,
    status: filters.status,
    search: deferredSearch,
  };

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
    queryKey: ['students', serverFilters],
    queryFn: () => {
      return api.listStudents({
        ...serverFilters,
        limit: STUDENT_ROSTER_PAGE_SIZE,
      });
    }
  });
  const studentSummaryQuery = useQuery({
    queryKey: ['students', 'module-summary', summaryFilters],
    queryFn: () => api.getStudentModuleSummary(summaryFilters),
  });
  async function openStudentPdf(studentId: string, kind: string) {
    setPdfError('');
    try {
      await api.openStudentDocumentPdf(studentId, kind);
    } catch (error) {
      setPdfError(
        schoolFacingErrorMessage(error, {
          fallback:
            'The protected student PDF could not be opened. No student record was changed.',
          forbidden:
            'You do not have permission to open this student document.',
          notFound:
            'This student document is not available. Generate it again if permitted.',
        }),
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
      setPdfError(
        schoolFacingErrorMessage(error, {
          fallback:
            'The roster export could not be prepared. Student records were not changed.',
          invalid:
            'The selected roster filters were not accepted. Refresh the directory and try again.',
          forbidden:
            'You do not have permission to export this student roster.',
        }),
      );
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
        schoolFacingErrorMessage(error, {
          fallback:
            'The iEMIS export could not be prepared. Student records were not changed.',
          invalid:
            'Some export filters or student readiness rules were not accepted. Refresh and try again.',
          forbidden:
            'You do not have permission to export iEMIS student records.',
          conflict:
            'Student records changed while the export was prepared. Refresh and try again.',
        }),
      );
    } finally {
      setIsExportingIemis(false);
    }
  }

  return (
    <DashboardPageShell className="gap-5">
      <M1PageHeader
        title="Students"
        description="Manage enrolled students, guardians, documents, identity records, and enrollment history."
        primaryAction={
          canCreateAdmission ? (
            <Button asChild>
              <Link href="/dashboard/admissions/new">
                <UserPlus data-icon="inline-start" />
                New admission
              </Link>
            </Button>
          ) : undefined
        }
        moreActionItems={[
          {
            label: 'Document issues',
            icon: <FolderOpen size={16} />,
            onClick: () => router.push('/dashboard/admissions/documents'),
          },
          ...(canManageStudentLifecycle
            ? [
                {
                  label: 'Duplicate review',
                  icon: <ScanSearch size={16} />,
                  onClick: () => router.push('/dashboard/admissions/duplicates'),
                },
              ]
            : []),
          {
            label: 'iEMIS readiness',
            icon: <FileCheck2 size={16} />,
            onClick: () => router.push('/dashboard/admissions/iemis'),
          },
          {
            label: 'QR / ID cards',
            icon: <QrCode size={16} />,
            onClick: () => router.push('/dashboard/admissions/qr'),
          },
          {
            label: 'Export directory',
            icon: <Download size={16} />,
            onClick: () =>
              void handleExportRoster('csv', {
                academicYearId: filters.academicYearId,
                classId: filters.classId,
                sectionId: filters.sectionId,
              }),
          },
          {
            label: isExportingIemis ? 'Preparing iEMIS export' : 'Export iEMIS',
            icon: <Download size={16} />,
            disabled: !canReadStudents || isExportingIemis,
            onClick: () => void handleExportIemis(),
          },
        ]}
      />

      <StudentDirectory
        academicYears={academicYearsQuery.data ?? []}
        admissions={admissionsQuery.data?.items ?? []}
        summary={studentSummaryQuery.data}
        summaryLoading={studentSummaryQuery.isLoading}
        summaryUnavailable={studentSummaryQuery.isError}
        canCreateAdmission={canCreateAdmission}
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
        onRetry={() => {
          void academicYearsQuery.refetch();
          void classesQuery.refetch();
          void sectionsQuery.refetch();
          void studentsQuery.refetch();
          void admissionsQuery.refetch();
          void studentSummaryQuery.refetch();
        }}
        sections={sectionsQuery.data ?? []}
        studentsResponse={studentsQuery.data}
        onOpenPdf={(studentId, kind) => void openStudentPdf(studentId, kind)}
        filters={filters}
        onFilterChange={setFilters}
      />
    </DashboardPageShell>
  );
}
