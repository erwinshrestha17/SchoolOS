'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatBsDateTime, type StudentProfile } from '@schoolos/core';
import { Camera, Download, Eye } from 'lucide-react';
import { api } from '../../../../lib/api';
import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { PageHeader } from '../../../../components/ui/page-header';
import { FilterBar } from '../../../../components/ui/filter-bar';
import { EmptyState } from '../../../../components/ui/empty-state';
import { LoadingState } from '../../../../components/ui/loading-state';
import { ErrorState } from '../../../../components/ui/error-state';
import { Select } from '../../../../components/ui/form-field';
import { Badge } from '../../../../components/ui/badge';

const activityCategories = [
  'LEARNING',
  'OUTDOOR_PLAY',
  'ART_AND_CRAFT',
  'CELEBRATION',
  'SPORTS',
  'GENERAL',
] as const;

type SectionSummaryForUi = { id: string; name: string; classId?: string | null; class?: { id: string } | null };

export default function ActivityGalleryPage() {
  const [filters, setFilters] = useState({
    classId: '',
    sectionId: '',
    studentId: '',
    category: '',
  });
  const [loadingAttachmentId, setLoadingAttachmentId] = useState<string | null>(null);
  const [errorAttachmentId, setErrorAttachmentId] = useState<string | null>(null);

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const studentsQuery = useQuery({
    queryKey: ['students-for-activity-gallery'],
    queryFn: () => api.listStudents({ limit: 1000 }),
  });
  const galleryQuery = useQuery({
    queryKey: ['activity-gallery', filters],
    queryFn: () =>
      api.listActivityGallery({
        classId: filters.classId || null,
        sectionId: filters.sectionId || null,
        studentId: filters.studentId || null,
        category: filters.category || null,
        limit: 60,
        offset: 0,
      }),
  });

  const classes = classesQuery.data ?? [];
  const sections = useMemo(
    () => (sectionsQuery.data ?? []) as SectionSummaryForUi[],
    [sectionsQuery.data],
  );
  const students: StudentProfile[] = studentsQuery.data?.items ?? [];
  const filteredSections = useMemo(
    () =>
      sections.filter((section) => {
        const sectionClassId = section.classId ?? section.class?.id;
        return !filters.classId || sectionClassId === filters.classId;
      }),
    [sections, filters.classId],
  );
  const items = galleryQuery.data ?? [];
  const hasActiveFilters = Boolean(
    filters.classId || filters.sectionId || filters.studentId || filters.category,
  );

  async function handlePreview(attachmentId: string) {
    try {
      setLoadingAttachmentId(attachmentId);
      setErrorAttachmentId(null);
      await api.previewActivityAttachment(attachmentId);
    } catch {
      setErrorAttachmentId(attachmentId);
    } finally {
      setLoadingAttachmentId(null);
    }
  }

  async function handleDownload(attachmentId: string, fileName: string) {
    try {
      setLoadingAttachmentId(attachmentId);
      setErrorAttachmentId(null);
      await api.downloadActivityAttachment(attachmentId, fileName);
    } catch {
      setErrorAttachmentId(attachmentId);
    } finally {
      setLoadingAttachmentId(null);
    }
  }

  return (
    <DashboardPageShell>
      <PageHeader
        title="Activity gallery"
        description="Browse protected activity media by class, section, student, and category. Consent-blocked media stays hidden."
      />

      <FilterBar
        label="Gallery filters"
        description={`${items.length} media item${items.length === 1 ? '' : 's'} on this view`}
        actions={
          hasActiveFilters ? (
            <button
              type="button"
              onClick={() =>
                setFilters({ classId: '', sectionId: '', studentId: '', category: '' })
              }
              className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
            >
              Clear filters
            </button>
          ) : undefined
        }
      >
        <Select
          value={filters.classId}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              classId: event.target.value,
              sectionId: '',
              studentId: '',
            }))
          }
        >
          <option value="">All classes</option>
          {classes.map((classroom) => (
            <option key={classroom.id} value={classroom.id}>
              {classroom.name}
            </option>
          ))}
        </Select>
        <Select
          value={filters.sectionId}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              sectionId: event.target.value,
              studentId: '',
            }))
          }
        >
          <option value="">All sections</option>
          {filteredSections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </Select>
        <Select
          value={filters.studentId}
          onChange={(event) =>
            setFilters((current) => ({ ...current, studentId: event.target.value }))
          }
        >
          <option value="">All students</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {studentDisplayName(student)}
            </option>
          ))}
        </Select>
        <Select
          value={filters.category}
          onChange={(event) =>
            setFilters((current) => ({ ...current, category: event.target.value }))
          }
        >
          <option value="">All categories</option>
          {activityCategories.map((category) => (
            <option key={category} value={category}>
              {formatEnumLabel(category)}
            </option>
          ))}
        </Select>
      </FilterBar>

      {galleryQuery.isLoading ? (
        <LoadingState />
      ) : galleryQuery.isError ? (
        <ErrorState
          title="Could not load the gallery"
          message={galleryQuery.error.message}
          onRetry={() => void galleryQuery.refetch()}
        />
      ) : items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            const isBusy = loadingAttachmentId === item.id;
            const hasError = errorAttachmentId === item.id;

            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              >
                <div className="relative aspect-[4/3] bg-slate-100">
                  {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.previewUrl}
                      alt={item.fileName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                      <Camera className="mb-2 h-6 w-6 text-slate-300" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {item.accessBlockedReason ? 'Media hidden' : 'Private media'}
                      </p>
                      {item.accessBlockedReason ? (
                        <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">
                          Photo consent is not available for this media.
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <Link
                      href={`/dashboard/activity/${item.postId}`}
                      className="line-clamp-2 text-sm font-black uppercase leading-snug tracking-tight text-slate-900 hover:text-emerald-700"
                    >
                      {item.postTitle}
                    </Link>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {formatBsDateTime(item.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
                    <span className="min-w-0 truncate text-[11px] font-bold text-slate-600">
                      {item.fileName}
                    </span>
                    <Badge variant="outline" className="shrink-0 text-[10px] font-black uppercase">
                      {formatFileSize(item.sizeBytes)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!item.previewUrl || isBusy}
                      onClick={() => void handlePreview(item.id)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </button>
                    <button
                      type="button"
                      disabled={!item.previewUrl || isBusy}
                      onClick={() => void handleDownload(item.id, item.fileName)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--color-mod-activity-accent)] px-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-[var(--color-mod-activity-text)] disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Save
                    </button>
                  </div>

                  {hasError ? (
                    <p className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-700">
                      Could not open private media.
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={hasActiveFilters ? 'No results' : 'No media yet'}
          description={
            hasActiveFilters
              ? 'No activity media matches the selected filters.'
              : 'Activity media will appear here once posts are published with photos.'
          }
        />
      )}
    </DashboardPageShell>
  );
}

function studentDisplayName(student: StudentProfile) {
  return (
    student.fullNameEn ??
    `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim() ??
    student.studentSystemId
  );
}

function formatEnumLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024)).toLocaleString()} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
