'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { api } from '../../../lib/api';
import type { ResultPublishingReadiness } from '@schoolos/core';

type Props = {
  academicYears: any[];
  classes: any[];
  allSections: any[];
  exams: any[];
};

export function ResultPublishingTab({
  academicYears,
  classes,
  allSections,
  exams,
}: Props) {
  const queryClient = useQueryClient();
  const currentYear =
    academicYears.find((y: any) => y.isCurrent) ?? academicYears[0];

  const [selection, setSelection] = useState({
    academicYearId: currentYear?.id ?? '',
    examTermId: '',
    classId: '',
    sectionId: '',
    status: '',
    search: '',
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const publishingQuery = useQuery({
    queryKey: [
      'result-publishing-readiness',
      selection.academicYearId,
      selection.examTermId,
      selection.classId,
      selection.sectionId,
      selection.status,
    ],
    queryFn: () =>
      api.listResultPublishingReadiness({
        academicYearId: selection.academicYearId,
        examTermId: selection.examTermId,
        classId: selection.classId || undefined,
        sectionId: selection.sectionId || undefined,
        status: selection.status || undefined,
      }),
    enabled: Boolean(selection.academicYearId && selection.examTermId),
  });

  const allRecords = publishingQuery.data ?? [];
  const records = useMemo(() => {
    if (!selection.search) return allRecords;
    const s = selection.search.toLowerCase();
    return allRecords.filter(
      (r) =>
        r.studentName.toLowerCase().includes(s) ||
        r.studentSystemId.toLowerCase().includes(s),
    );
  }, [allRecords, selection.search]);

  const sectionsForClass = allSections.filter(
    (s: any) => s.classId === selection.classId,
  );

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ['result-publishing-readiness'],
    });
    void queryClient.invalidateQueries({ queryKey: ['report-cards'] });
  };

  const publishMut = useMutation({
    mutationFn: api.publishResults,
    onSuccess: (data) => {
      invalidate();
      alert(`Successfully published ${data.published} results.`);
      setSelectedIds(new Set());
    },
  });

  const unpublishMut = useMutation({
    mutationFn: api.unpublishResults,
    onSuccess: () => {
      invalidate();
      alert('Results unpublished successfully.');
      setSelectedIds(new Set());
    },
  });

  const notifyMut = useMutation({
    mutationFn: api.notifyResults,
    onSuccess: () => {
      alert('Notifications queued successfully.');
    },
  });

  const handleBatchPublish = () => {
    if (selectedIds.size === 0) return;
    const selectedRecords = records.filter((r) =>
      selectedIds.has(r.reportCardId),
    );
    const publishable = selectedRecords.filter(
      (r) => r.reportStatus === 'LOCKED' && r.publishStatus !== 'PUBLISHED',
    );

    if (publishable.length === 0) {
      alert('No publishable report cards selected (must be LOCKED and not already PUBLISHED).');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to publish ${publishable.length} report cards? This will make them visible to guardians and students.`,
      )
    )
      return;

    publishMut.mutate({
      reportCardIds: publishable.map((r) => r.reportCardId),
    });
  };

  const handleBatchUnpublish = () => {
    if (selectedIds.size === 0) return;
    const selectedRecords = records.filter((r) =>
      selectedIds.has(r.reportCardId),
    );
    const publishable = selectedRecords.filter(
      (r) => r.publishStatus === 'PUBLISHED',
    );

    if (publishable.length === 0) {
      alert('No published report cards selected.');
      return;
    }

    const reason = prompt(
      'Please enter the reason for unpublishing (mandatory):',
    );
    if (!reason) return;

    if (
      !confirm(
        `Are you sure you want to unpublish ${publishable.length} report cards?`,
      )
    )
      return;

    unpublishMut.mutate({
      reportCardIds: publishable.map((r) => r.reportCardId),
      reason,
    });
  };

  const handleBatchNotify = () => {
    if (selectedIds.size === 0) return;
    const selectedRecords = records.filter((r) =>
      selectedIds.has(r.reportCardId),
    );
    const notified = selectedRecords.filter(
      (r) => r.publishStatus === 'PUBLISHED' && r.notificationEligibility,
    );

    if (notified.length === 0) {
      alert('Only PUBLISHED results for ACTIVE students can be notified.');
      return;
    }

    if (
      !confirm(
        `Send publishing notifications for ${notified.length} students?`,
      )
    )
      return;

    notifyMut.mutate({
      reportCardIds: notified.map((r) => r.reportCardId),
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.reportCardId)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Publishing
            </p>
            <h2 className="mt-1 text-lg font-bold text-gray-950">
              Result Publishing Dashboard
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Control the release of report cards to guardians and students.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={invalidate}
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select
            value={selection.academicYearId}
            onChange={(e) =>
              setSelection((c) => ({ ...c, academicYearId: e.target.value }))
            }
          >
            {academicYears.map((y: any) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
          <select
            value={selection.examTermId}
            onChange={(e) =>
              setSelection((c) => ({ ...c, examTermId: e.target.value }))
            }
          >
            <option value="">Exam term</option>
            {exams.map((e: any) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            value={selection.classId}
            onChange={(e) =>
              setSelection((c) => ({ ...c, classId: e.target.value, sectionId: '' }))
            }
          >
            <option value="">All Classes</option>
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={selection.sectionId}
            onChange={(e) =>
              setSelection((c) => ({ ...c, sectionId: e.target.value }))
            }
          >
            <option value="">All Sections</option>
            {sectionsForClass.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={selection.status}
            onChange={(e) =>
              setSelection((c) => ({ ...c, status: e.target.value }))
            }
          >
            <option value="">All Publish Status</option>
            <option value="UNPUBLISHED">Unpublished</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="text-sm text-gray-500">
            {selectedIds.size > 0 ? (
              <span className="font-medium text-emerald-600">
                {selectedIds.size} records selected
              </span>
            ) : (
              'Select records to take action'
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-30"
              disabled={selectedIds.size === 0 || unpublishMut.isPending}
              onClick={handleBatchUnpublish}
            >
              Unpublish
            </button>
            <button
              type="button"
              className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-30"
              disabled={selectedIds.size === 0 || notifyMut.isPending}
              onClick={handleBatchNotify}
            >
              Notify Guardians
            </button>
            <button
              type="button"
              className="rounded-xl bg-emerald-600 px-6 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-30"
              disabled={selectedIds.size === 0 || publishMut.isPending}
              onClick={handleBatchPublish}
            >
              {publishMut.isPending ? 'Publishing…' : 'Publish Selected'}
            </button>
          </div>
        </div>
      </section>

      {/* List */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
            Report Cards · {records.length} results
          </h3>
          <div className="w-64">
            <input
              type="text"
              placeholder="Search student..."
              className="w-full text-xs"
              value={selection.search}
              onChange={(e) =>
                setSelection((c) => ({ ...c, search: e.target.value }))
              }
            />
          </div>
        </div>

        {publishingQuery.isLoading ? (
          <div className="py-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
          </div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-3xl">
            <p className="text-sm text-gray-400">
              No results found for current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="py-3 pr-4 text-left">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={
                        selectedIds.size === records.length &&
                        records.length > 0
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="py-3 text-left font-semibold text-gray-500">
                    Student
                  </th>
                  <th className="py-3 text-left font-semibold text-gray-500">
                    Academic
                  </th>
                  <th className="py-3 text-left font-semibold text-gray-500">
                    Result
                  </th>
                  <th className="py-3 text-left font-semibold text-gray-500">
                    Report Status
                  </th>
                  <th className="py-3 text-left font-semibold text-gray-500">
                    Publish Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr
                    key={r.reportCardId}
                    className={`border-b border-[var(--line)] transition hover:bg-emerald-50/10 ${
                      selectedIds.has(r.reportCardId) ? 'bg-emerald-50/20' : ''
                    }`}
                  >
                    <td className="py-3 pr-4">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={selectedIds.has(r.reportCardId)}
                        onChange={() => toggleSelect(r.reportCardId)}
                      />
                    </td>
                    <td className="py-3">
                      <div className="font-bold text-gray-950">
                        {r.studentName}
                      </div>
                      <div className="text-[10px] font-mono text-gray-400">
                        {r.studentSystemId}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="text-xs font-medium text-gray-700">
                        {r.className} {r.sectionName ? `/ ${r.sectionName}` : ''}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {r.examTermName}
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">
                          {r.grade}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          ({r.percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          r.reportStatus === 'LOCKED'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {r.reportStatus}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            r.publishStatus === 'PUBLISHED'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {r.publishStatus}
                        </span>
                        {r.publishedAt && (
                          <div className="text-[10px] text-gray-400">
                            {new Date(r.publishedAt).toLocaleDateString()} by{' '}
                            {r.publishedBy}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
