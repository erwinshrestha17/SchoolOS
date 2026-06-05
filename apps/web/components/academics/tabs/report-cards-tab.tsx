'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { api } from '../../../lib/api';
import { 
  FileText, 
  Printer, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Layers, 
  Search, 
  Download,
  Eye,
  Settings,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Toast, ToastTone } from '@/components/ui/toast';

type ReportCardNotice = {
  title: string;
  description?: string;
  tone: ToastTone;
};

type Props = {
  academicYears: any[];
  classes: any[];
  allSections: any[];
  students: any[];
  exams: any[];
  reports: any[];
};

export function ReportCardsTab({ academicYears, classes, allSections, students, exams, reports }: Props) {
  const queryClient = useQueryClient();
  const currentYear = academicYears.find((y: any) => y.isCurrent) ?? academicYears[0];

  const [report, setReport] = useState({
    academicYearId: currentYear?.id ?? '',
    examTermId: '',
    classId: '',
    sectionId: '',
    studentId: '',
    remarks: '',
    lock: true,
  });
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<ReportCardNotice | null>(null);

  const sectionsForClass = useMemo(() => allSections.filter((s: any) => s.classId === report.classId), [allSections, report.classId]);
  const studentsForClass = useMemo(() => students.filter(
    (s: any) => s.class?.id === report.classId && (!report.sectionId || s.section?.id === report.sectionId),
  ), [students, report.classId, report.sectionId]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['report-cards'] });
    void queryClient.invalidateQueries({ queryKey: ['promotion-readiness'] });
  };

  const batchGenerateMut = useMutation({ 
    mutationFn: api.batchGenerateReportCards, 
    onSuccess: (data) => {
      invalidate();
      setBatchConfirmOpen(false);
      setNotice({
        title: 'Report cards queued',
        description: `${data.length} report cards were queued for generation.`,
        tone: 'success',
      });
    },
    onError: (error: any) => {
      setNotice({
        title: 'Could not queue report cards',
        description: error.message || 'Batch generation failed.',
        tone: 'danger',
      });
    },
  });
  
  const generateMut = useMutation({ 
    mutationFn: api.generateReportCard, 
    onSuccess: () => {
      invalidate();
    } 
  });

  const handleBatchGenerate = () => {
    if (!report.academicYearId || !report.examTermId || studentsForClass.length === 0) return;
    setBatchConfirmOpen(true);
  };

  const confirmBatchGenerate = () => {
    batchGenerateMut.mutate({
      academicYearId: report.academicYearId,
      examTermId: report.examTermId,
      studentIds: studentsForClass.map((s: any) => s.id),
      remarks: report.remarks,
      lock: report.lock,
    });
  };

  const openPdf = async (reportCardId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1'}/academics/report-cards/${encodeURIComponent(reportCardId)}.pdf`,
        { credentials: 'include' },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to generate PDF. Marks may be incomplete.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setNotice({
        title: 'Could not load report card PDF',
        description: err.message ?? 'The generated PDF could not be opened.',
        tone: 'danger',
      });
    }
  };

  return (
    <div className="space-y-10 animate-fade-in">
      {notice ? (
        <Toast
          title={notice.title}
          description={notice.description}
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      {/* Configuration & Generation */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between mb-8">
           <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 italic">Document Generation</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Official Report Card Processing (MoEST Standards)</p>
           </div>
           <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="h-12 px-6 rounded-2xl border border-slate-200 bg-white flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-30"
                disabled={!report.academicYearId || !report.examTermId || studentsForClass.length === 0 || batchGenerateMut.isPending}
                onClick={handleBatchGenerate}
              >
                {batchGenerateMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                Batch Generate ({studentsForClass.length})
              </button>
              <button
                type="button"
                className="h-12 px-6 rounded-2xl bg-[var(--color-mod-academics-accent)] text-white flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] shadow-sm hover:bg-[var(--color-mod-academics-text)] transition-all disabled:opacity-30"
                disabled={!report.academicYearId || !report.examTermId || !report.studentId || generateMut.isPending}
                onClick={() => generateMut.mutate(report)}
              >
                {generateMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
                Process Single
              </button>
           </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Academic Year</label>
              <select value={report.academicYearId} onChange={(e) => setReport(c => ({ ...c, academicYearId: e.target.value }))} className="premium-input bg-white">
                {academicYears.map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Exam Term</label>
              <select value={report.examTermId} onChange={(e) => setReport(c => ({ ...c, examTermId: e.target.value }))} className="premium-input bg-white">
                <option value="">Select Term</option>
                {exams.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Class</label>
              <select value={report.classId} onChange={(e) => setReport(c => ({ ...c, classId: e.target.value, sectionId: '', studentId: '' }))} className="premium-input bg-white">
                <option value="">Select Class</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Student (Single)</label>
              <select value={report.studentId} onChange={(e) => setReport(c => ({ ...c, studentId: e.target.value }))} className="premium-input bg-white">
                <option value="">Full Roster (Batch)</option>
                {studentsForClass.map((s: any) => <option key={s.id} value={s.id}>{s.studentSystemId} — {s.firstNameEn} {s.lastNameEn}</option>)}
              </select>
           </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end">
           <div className="flex-1 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Internal Remarks</label>
              <textarea 
                rows={1}
                value={report.remarks} 
                onChange={(e) => setReport(c => ({ ...c, remarks: e.target.value }))} 
                placeholder="Optional remarks for the report card..."
                className="premium-input bg-white py-4 text-xs font-medium min-h-[56px]"
              />
           </div>
           <div className="flex h-14 items-center gap-4 px-6 rounded-2xl bg-[var(--color-mod-academics-surface)] border border-[var(--color-mod-academics-border)]">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={report.lock} 
                  onChange={(e) => setReport(c => ({ ...c, lock: e.target.checked }))} 
                  className="h-5 w-5 rounded-lg border-slate-200 text-[var(--color-mod-academics-accent)] focus:ring-[var(--color-mod-academics-accent)] transition-all"
                />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-900 transition-colors">Lock marks after generation</span>
              </label>
           </div>
        </div>

        {(generateMut.isError || batchGenerateMut.isError) && (
          <div className="mt-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-3 text-rose-600 animate-in slide-in-from-top-2">
             <AlertCircle size={18} />
             <p className="text-xs font-bold">{generateMut.error?.message || batchGenerateMut.error?.message}</p>
          </div>
        )}
      </section>

      {/* Generated List */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
         <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
               <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 italic text-[18px]">Operational History</h3>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">Recently generated documents</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
               <FileText size={14} />
               {reports.length} Total Cards
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="py-4 px-8 font-black uppercase tracking-widest text-[10px] text-slate-400">Student Identity</th>
                  <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400">Term / Class</th>
                  <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 text-center">Performance</th>
                  <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 text-center">Outcome</th>
                  <th className="py-4 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 text-center">Lifecycle</th>
                  <th className="py-4 px-8 font-black uppercase tracking-widest text-[10px] text-slate-400 text-right">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-slate-300">
                       <FileText className="h-12 w-12 mx-auto mb-4 opacity-10" />
                       <p className="text-[10px] font-black uppercase tracking-widest">No report cards generated yet</p>
                    </td>
                  </tr>
                ) : (
                  reports.slice(0, 50).map((r: any) => {
                    const isPass = Number(r.percentage) >= 35;
                    return (
                      <tr key={r.id} className="group hover:bg-slate-50/50 transition-all">
                        <td className="py-4 px-8">
                           <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-900 uppercase tracking-tight italic">{r.student?.firstNameEn} {r.student?.lastNameEn}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{r.student?.studentSystemId}</span>
                           </div>
                        </td>
                        <td className="py-4 px-6">
                           <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{r.examTerm?.name}</span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{r.class?.name} {r.section?.name ? `/ ${r.section.name}` : ''}</span>
                           </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                           <div className="inline-flex flex-col items-center">
                              <span className={cn(
                                "text-sm font-black tracking-tighter",
                                isPass ? "text-emerald-600" : "text-rose-600"
                              )}>
                                 {Number(r.percentage).toFixed(1)}%
                              </span>
                              <div className="w-12 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                 <div className={cn("h-full", isPass ? "bg-emerald-500" : "bg-rose-500")} style={{ width: `${Number(r.percentage)}%` }} />
                              </div>
                           </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                           <div className="inline-flex flex-col items-center gap-1">
                              <span className="text-sm font-black text-slate-900 italic tracking-tight">{r.grade}</span>
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">GPA {Number(r.gpa).toFixed(2)}</span>
                           </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                           <div className={cn(
                             "inline-flex px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                             r.status === 'LOCKED' ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-amber-50 text-amber-600 border-amber-100"
                           )}>
                              {r.status}
                           </div>
                        </td>
                        <td className="py-4 px-8 text-right">
                           <button 
                            onClick={() => openPdf(r.id)}
                            className="h-10 px-4 rounded-xl bg-[var(--color-mod-academics-accent)] text-white flex items-center justify-center gap-2 font-black uppercase tracking-widest text-[10px] shadow-sm hover:bg-[var(--color-mod-academics-text)] transition-all active:scale-95"
                           >
                              <Eye size={14} />
                              Open
                           </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
         </div>
         
         {reports.length > 0 && (
           <div className="border-t border-[var(--color-mod-academics-border)] bg-[var(--color-mod-academics-surface)] p-6 flex flex-col gap-4 text-[var(--color-mod-academics-text)] md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-6">
                 <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[var(--color-mod-academics-accent)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-mod-academics-accent)]">MoEST Compliance: Active</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Digital Signatures: Enabled</span>
                 </div>
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                 System Generated Documents
              </div>
           </div>
         )}
      </section>

      <ConfirmDialog
        isOpen={batchConfirmOpen}
        title="Batch Generate Report Cards"
        description={`Generate report cards for ${studentsForClass.length} students in the selected roster? Existing drafts may be overwritten by the backend workflow.`}
        confirmLabel="Generate Batch"
        isConfirming={batchGenerateMut.isPending}
        onConfirm={confirmBatchGenerate}
        onClose={() => setBatchConfirmOpen(false)}
      />
    </div>
  );
}
