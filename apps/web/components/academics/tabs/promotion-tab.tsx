'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api';

type Props = {
  academicYears: any[];
  classes: any[];
  allSections: any[];
};

export function PromotionTab({ academicYears, classes, allSections }: Props) {
  const queryClient = useQueryClient();
  const currentYear = academicYears.find((y: any) => y.isCurrent) ?? academicYears[0];
  const nextYear = academicYears.find((y: any) => y.id !== currentYear?.id && new Date(y.startsAt) > new Date(currentYear?.startsAt)) ?? academicYears[1];

  const [promo, setPromo] = useState({
    academicYearId: currentYear?.id ?? '',
    targetAcademicYearId: nextYear?.id ?? '',
    fromClassId: '',
    toClassId: '',
    toSectionId: '',
    remarks: 'Promoted to next class',
  });

  const readinessQuery = useQuery({
    queryKey: ['promotion-readiness', promo.academicYearId, promo.fromClassId],
    queryFn: () => api.listPromotionReadiness({ academicYearId: promo.academicYearId, classId: promo.fromClassId }),
    enabled: Boolean(promo.academicYearId && promo.fromClassId),
  });

  const students = readinessQuery.data ?? [];
  const toSectionsForClass = allSections.filter((s: any) => s.classId === promo.toClassId);

  const batchPromoteMut = useMutation({
    mutationFn: api.batchPromote,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['promotion-readiness'] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      alert('Batch promotion successful!');
    },
  });

  const handlePromote = () => {
    if (!window.confirm(`Are you sure you want to promote ${students.length} students to the target class? This will update their class assignments for the new academic year.`)) {
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
        }
      ]
    });
  };

  return (
    <div className="space-y-6">
      {/* Promotion Config */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Workflow</p>
          <h2 className="mt-1 text-lg font-bold text-gray-950">Batch Promotion</h2>
          <p className="mt-1 text-sm text-gray-500">Promote a class to the next grade level for the upcoming academic year.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-2xl bg-gray-50 p-4 border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">From (Current)</h3>
            <div className="grid gap-3">
              <select value={promo.academicYearId} onChange={(e) => setPromo((c) => ({ ...c, academicYearId: e.target.value }))}>
                <option value="">Current Academic Year</option>
                {academicYears.map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
              <select value={promo.fromClassId} onChange={(e) => setPromo((c) => ({ ...c, fromClassId: e.target.value }))}>
                <option value="">Source Class</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl bg-indigo-50/50 p-4 border border-indigo-100">
            <h3 className="text-sm font-semibold text-indigo-900">To (Target)</h3>
            <div className="grid gap-3">
              <select value={promo.targetAcademicYearId} onChange={(e) => setPromo((c) => ({ ...c, targetAcademicYearId: e.target.value }))}>
                <option value="">Target Academic Year</option>
                {academicYears.map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <select value={promo.toClassId} onChange={(e) => setPromo((c) => ({ ...c, toClassId: e.target.value, toSectionId: '' }))}>
                  <option value="">Target Class</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={promo.toSectionId} onChange={(e) => setPromo((c) => ({ ...c, toSectionId: e.target.value }))}>
                  <option value="">Target Section (Opt)</option>
                  {toSectionsForClass.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <input
            className="w-full"
            value={promo.remarks}
            onChange={(e) => setPromo((c) => ({ ...c, remarks: e.target.value }))}
            placeholder="Promotion remarks (e.g., Promoted automatically at year end)"
          />
        </div>

        <button
          type="button"
          className="mt-4 rounded-2xl bg-indigo-950 px-6 py-3 font-semibold text-white transition hover:bg-indigo-900 disabled:opacity-50"
          disabled={!promo.academicYearId || !promo.targetAcademicYearId || !promo.fromClassId || !promo.toClassId || batchPromoteMut.isPending || students.length === 0}
          onClick={handlePromote}
        >
          {batchPromoteMut.isPending ? 'Promoting...' : `Promote ${students.length} Students`}
        </button>
        {batchPromoteMut.isError && <p className="mt-2 text-sm text-red-600">{batchPromoteMut.error.message}</p>}
      </section>

      {/* Readiness List */}
      {promo.fromClassId && (
        <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
            Readiness Check · {students.length} students
          </p>
          {readinessQuery.isLoading ? (
            <div className="py-8 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            </div>
          ) : students.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">No students found for the selected source class.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    <th className="py-3 text-left font-semibold text-gray-500">Student</th>
                    <th className="py-3 text-left font-semibold text-gray-500">Final Grade</th>
                    <th className="py-3 text-left font-semibold text-gray-500">Percentage</th>
                    <th className="py-3 text-left font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s: any) => {
                    const isPassed = Number(s.percentage) >= 35 || s.status === 'PROMOTED';
                    return (
                      <tr key={s.reportCardId} className="border-b border-[var(--line)] hover:bg-indigo-50/30 transition">
                        <td className="py-2 font-medium text-gray-950">{s.studentName}</td>
                        <td className="py-2 font-semibold text-gray-950">{s.grade}</td>
                        <td className="py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isPassed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {Number(s.percentage).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.status === 'PROMOTED' ? 'bg-indigo-50 text-indigo-700' : s.status === 'FAILED' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
