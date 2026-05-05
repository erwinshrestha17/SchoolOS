'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { api } from '../../../lib/api';
import type { PromotionReadiness } from '@schoolos/core';

type Props = {
  academicYears: any[];
  classes: any[];
  allSections: any[];
};

export function PromotionTab({ academicYears, classes, allSections }: Props) {
  const queryClient = useQueryClient();
  const currentYear =
    academicYears.find((y: any) => y.isCurrent) ?? academicYears[0];
  const nextYear =
    academicYears.find(
      (y: any) =>
        y.id !== currentYear?.id &&
        new Date(y.startsAt) > new Date(currentYear?.startsAt),
    ) ?? academicYears[1];

  const [promo, setPromo] = useState({
    academicYearId: currentYear?.id ?? '',
    targetAcademicYearId: nextYear?.id ?? '',
    fromClassId: '',
    toClassId: '',
    toSectionId: '',
    remarks: 'Promoted to next class',
  });

  const [filters, setFilters] = useState({
    sectionId: '',
    status: '',
    search: '',
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const readinessQuery = useQuery({
    queryKey: [
      'promotion-readiness',
      promo.academicYearId,
      promo.fromClassId,
      filters.sectionId,
      filters.status,
    ],
    queryFn: () =>
      api.listPromotionReadiness({
        academicYearId: promo.academicYearId,
        classId: promo.fromClassId,
        sectionId: filters.sectionId || undefined,
        status: (filters.status as any) || undefined,
      }),
    enabled: Boolean(promo.academicYearId && promo.fromClassId),
  });

  const allStudents = readinessQuery.data ?? [];
  const students = useMemo(() => {
    if (!filters.search) return allStudents;
    const s = filters.search.toLowerCase();
    return allStudents.filter(
      (st) =>
        st.studentName.toLowerCase().includes(s) ||
        st.studentSystemId.toLowerCase().includes(s),
    );
  }, [allStudents, filters.search]);

  const fromSections = allSections.filter(
    (s: any) => s.classId === promo.fromClassId,
  );
  const toSectionsForClass = allSections.filter(
    (s: any) => s.classId === promo.toClassId,
  );

  const batchPromoteMut = useMutation({
    mutationFn: api.batchPromote,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['promotion-readiness'] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      alert(
        `Batch promotion completed: ${data.summary.promoted} promoted, ${data.summary.skipped} skipped.`,
      );
      setSelectedIds(new Set());
    },
  });

  const promoteSingleMut = useMutation({
    mutationFn: api.promoteStudent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['promotion-readiness'] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      alert('Student promoted successfully!');
    },
  });

  const handleBatchPromote = () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one student to promote.');
      return;
    }

    const selectedStudents = students.filter((s) => selectedIds.has(s.studentId));
    const readyToPromote = selectedStudents.filter((s) => s.status === 'READY');

    if (readyToPromote.length === 0) {
      alert('None of the selected students are in READY status.');
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to promote ${readyToPromote.length} students? ${selectedStudents.length - readyToPromote.length} students with BLOCKED/REVIEW status will be skipped automatically.`,
      )
    ) {
      return;
    }

    batchPromoteMut.mutate({
      academicYearId: promo.academicYearId,
      targetAcademicYearId: promo.targetAcademicYearId,
      remarks: promo.remarks,
      classMappings: [
        {
          fromClassId: promo.fromClassId,
          toClassId: promo.toClassId,
          toSectionId: promo.toSectionId || undefined,
          studentIds: Array.from(selectedIds),
        },
      ],
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.studentId)));
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
      {/* Promotion Config */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Workflow
            </p>
            <h2 className="mt-1 text-lg font-bold text-gray-950">
              Promotion Management
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Review readiness and promote students to the next grade level.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() =>
                void queryClient.invalidateQueries({
                  queryKey: ['promotion-readiness'],
                })
              }
            >
              Refresh Data
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-4 rounded-2xl bg-gray-50 p-4 border border-gray-100">
            <h3 className="text-xs font-bold uppercase text-gray-400">
              Source (Current)
            </h3>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={promo.academicYearId}
                  onChange={(e) =>
                    setPromo((c) => ({ ...c, academicYearId: e.target.value }))
                  }
                  className="bg-white"
                >
                  {academicYears.map((y: any) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
                <select
                  value={promo.fromClassId}
                  onChange={(e) =>
                    setPromo((c) => ({
                      ...c,
                      fromClassId: e.target.value,
                      toClassId: '',
                    }))
                  }
                  className="bg-white"
                >
                  <option value="">Select Class</option>
                  {classes.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={filters.sectionId}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, sectionId: e.target.value }))
                  }
                  className="bg-white"
                >
                  <option value="">All Sections</option>
                  {fromSections.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, status: e.target.value }))
                  }
                  className="bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="READY">Ready</option>
                  <option value="REVIEW">Review Required</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4 rounded-2xl bg-indigo-50/50 p-4 border border-indigo-100">
            <h3 className="text-xs font-bold uppercase text-indigo-400">
              Destination (Target)
            </h3>
            <div className="grid gap-3">
              <div className="grid grid-cols-3 gap-3">
                <select
                  value={promo.targetAcademicYearId}
                  onChange={(e) =>
                    setPromo((c) => ({
                      ...c,
                      targetAcademicYearId: e.target.value,
                    }))
                  }
                  className="bg-white"
                >
                  {academicYears.map((y: any) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
                <select
                  value={promo.toClassId}
                  onChange={(e) =>
                    setPromo((c) => ({
                      ...c,
                      toClassId: e.target.value,
                      toSectionId: '',
                    }))
                  }
                  className="bg-white"
                >
                  <option value="">Target Class</option>
                  {classes.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={promo.toSectionId}
                  onChange={(e) =>
                    setPromo((c) => ({ ...c, toSectionId: e.target.value }))
                  }
                  className="bg-white"
                >
                  <option value="">Section (Opt)</option>
                  {toSectionsForClass.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <input
                className="w-full bg-white"
                value={promo.remarks}
                onChange={(e) =>
                  setPromo((c) => ({ ...c, remarks: e.target.value }))
                }
                placeholder="Promotion remarks..."
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <div className="text-sm text-gray-500">
            {selectedIds.size > 0 ? (
              <span className="font-medium text-indigo-600">
                {selectedIds.size} students selected
              </span>
            ) : (
              'Select students from the list below to promote'
            )}
          </div>
          <button
            type="button"
            className="rounded-2xl bg-indigo-950 px-8 py-3 font-semibold text-white transition hover:bg-indigo-900 disabled:opacity-50"
            disabled={
              !promo.academicYearId ||
              !promo.targetAcademicYearId ||
              !promo.fromClassId ||
              !promo.toClassId ||
              batchPromoteMut.isPending ||
              selectedIds.size === 0
            }
            onClick={handleBatchPromote}
          >
            {batchPromoteMut.isPending
              ? 'Processing...'
              : `Promote Selected Students`}
          </button>
        </div>
      </section>

      {/* Readiness List */}
      {promo.fromClassId && (
        <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">
              Promotion Readiness · {students.length} students
            </h3>
            <div className="w-64">
              <input
                type="text"
                placeholder="Search student..."
                className="w-full text-xs"
                value={filters.search}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, search: e.target.value }))
                }
              />
            </div>
          </div>

          {readinessQuery.isLoading ? (
            <div className="py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            </div>
          ) : students.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-3xl">
              <p className="text-sm text-gray-400">
                No students match the current filters.
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
                          selectedIds.size === students.length &&
                          students.length > 0
                        }
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="py-3 text-left font-semibold text-gray-500">
                      Student
                    </th>
                    <th className="py-3 text-left font-semibold text-gray-500">
                      Performance
                    </th>
                    <th className="py-3 text-left font-semibold text-gray-500">
                      Financials
                    </th>
                    <th className="py-3 text-left font-semibold text-gray-500">
                      Status
                    </th>
                    <th className="py-3 text-right font-semibold text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr
                      key={s.studentId}
                      className={`border-b border-[var(--line)] transition hover:bg-indigo-50/20 ${selectedIds.has(s.studentId) ? 'bg-indigo-50/40' : ''}`}
                    >
                      <td className="py-3 pr-4">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedIds.has(s.studentId)}
                          onChange={() => toggleSelect(s.studentId)}
                        />
                      </td>
                      <td className="py-3">
                        <div className="font-bold text-gray-950">
                          {s.studentName}
                        </div>
                        <div className="text-[10px] font-mono text-gray-400">
                          {s.studentSystemId}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">
                            {s.grade}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${Number(s.percentage) >= 35 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                          >
                            {Number(s.percentage).toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500">
                          GPA: {s.gpa.toFixed(2)}
                        </div>
                      </td>
                      <td className="py-3">
                        {s.outstandingBalance > 0 ? (
                          <div className="text-xs font-semibold text-red-600">
                            Rs {s.outstandingBalance.toLocaleString()} Due
                          </div>
                        ) : (
                          <div className="text-xs font-semibold text-emerald-600">
                            Clear
                          </div>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              s.status === 'READY'
                                ? 'bg-emerald-100 text-emerald-700'
                                : s.status === 'REVIEW'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {s.status}
                          </span>
                          <div className="max-w-[200px] text-[10px] leading-tight text-gray-400">
                            {s.reasons.length > 0 ? (
                              <ul className="list-inside list-disc">
                                {s.reasons.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                            ) : (
                              'Ready for promotion'
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          disabled={
                            s.status === 'BLOCKED' ||
                            !promo.toClassId ||
                            promoteSingleMut.isPending
                          }
                          className="rounded-lg bg-gray-100 px-3 py-1.5 text-[11px] font-bold text-gray-700 transition hover:bg-gray-200 disabled:opacity-30"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Promote ${s.studentName} to ${promo.toClassId}?`,
                              )
                            ) {
                              promoteSingleMut.mutate({
                                studentId: s.studentId,
                                academicYearId: promo.academicYearId,
                                targetAcademicYearId:
                                  promo.targetAcademicYearId,
                                toClassId: promo.toClassId,
                                toSectionId: promo.toSectionId || undefined,
                                remarks: promo.remarks,
                              });
                            }
                          }}
                        >
                          Promote
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
