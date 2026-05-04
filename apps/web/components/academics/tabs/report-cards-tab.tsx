'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../../lib/api';

type Props = {
  academicYears: any[];
  classes: any[];
  allSections: any[];
  students: any[];
  exams: any[];
  reports: any[];
};

export function ReportCardsTab({ academicYears, students, exams, reports }: Props) {
  const queryClient = useQueryClient();
  const currentYear = academicYears.find((y: any) => y.isCurrent) ?? academicYears[0];

  const [report, setReport] = useState({
    academicYearId: currentYear?.id ?? '',
    examTermId: '',
    studentId: '',
    remarks: '',
    lock: true,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['report-cards'] });
    void queryClient.invalidateQueries({ queryKey: ['promotion-readiness'] });
  };

  const generateMut = useMutation({ mutationFn: api.generateReportCard, onSuccess: invalidate });

  const openPdf = async (reportCardId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1'}/academics/report-cards/${encodeURIComponent(reportCardId)}.pdf`,
        { credentials: 'include' },
      );
      if (!response.ok) throw new Error('Failed to load PDF');
      const blob = await response.blob();
      window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      alert(err.message ?? 'Could not load report card PDF');
    }
  };

  return (
    <div className="space-y-6">
      {/* Generate report card */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Generate</p>
          <h2 className="mt-1 text-lg font-bold text-gray-950">Generate Report Card</h2>
          <p className="mt-1 text-sm text-gray-500">Report cards are generated from marks and CAS records using Nepal MoEST grading.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select value={report.academicYearId} onChange={(e) => setReport((c) => ({ ...c, academicYearId: e.target.value }))}>
            <option value="">Academic year</option>
            {academicYears.map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <select value={report.examTermId} onChange={(e) => setReport((c) => ({ ...c, examTermId: e.target.value }))}>
            <option value="">Exam term</option>
            {exams.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={report.studentId} onChange={(e) => setReport((c) => ({ ...c, studentId: e.target.value }))}>
            <option value="">Student</option>
            {students.map((s: any) => <option key={s.id} value={s.id}>{s.studentSystemId} — {s.firstNameEn} {s.lastNameEn}</option>)}
          </select>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={report.lock} onChange={(e) => setReport((c) => ({ ...c, lock: e.target.checked }))} className="rounded" />
              Lock marks
            </label>
          </div>
        </div>
        <textarea rows={2} className="mt-3 w-full" value={report.remarks} onChange={(e) => setReport((c) => ({ ...c, remarks: e.target.value }))} placeholder="Remarks (optional)" />
        <button type="button" className="mt-3 rounded-2xl bg-indigo-950 px-6 py-3 font-semibold text-white transition hover:bg-indigo-900 disabled:opacity-50" disabled={!report.academicYearId || !report.examTermId || !report.studentId || generateMut.isPending} onClick={() => generateMut.mutate(report)}>
          {generateMut.isPending ? 'Generating…' : 'Generate Report Card'}
        </button>
        {generateMut.isError && <p className="mt-2 text-sm text-red-600">{generateMut.error.message}</p>}
        {generateMut.isSuccess && <p className="mt-2 text-sm text-emerald-600">Report card generated successfully.</p>}
      </section>

      {/* Report cards list */}
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Generated Report Cards</p>
        {reports.length === 0 ? (
          <p className="text-sm text-gray-400">No report cards generated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="py-3 text-left font-semibold text-gray-500">Student</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Exam</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Class</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Percentage</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Grade</th>
                  <th className="py-3 text-left font-semibold text-gray-500">GPA</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Status</th>
                  <th className="py-3 text-left font-semibold text-gray-500">PDF</th>
                </tr>
              </thead>
              <tbody>
                {reports.slice(0, 50).map((r: any) => (
                  <tr key={r.id} className="border-b border-[var(--line)] hover:bg-indigo-50/30 transition">
                    <td className="py-2 font-medium text-gray-950">
                      {r.student?.firstNameEn ?? ''} {r.student?.lastNameEn ?? ''}
                    </td>
                    <td className="py-2 text-gray-600">{r.examTerm?.name ?? '—'}</td>
                    <td className="py-2 text-gray-600">{r.class?.name ?? '—'} {r.section?.name ? `/ ${r.section.name}` : ''}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${Number(r.percentage) >= 35 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {Number(r.percentage).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 font-semibold text-gray-950">{r.grade}</td>
                    <td className="py-2 text-gray-600">{Number(r.gpa).toFixed(2)}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === 'LOCKED' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2">
                      <button type="button" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition" onClick={() => openPdf(r.id)}>
                        View PDF
                      </button>
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
