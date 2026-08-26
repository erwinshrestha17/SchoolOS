'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import type { MarkEntrySummary } from '@schoolos/core';
import { api } from '../../../lib/api';
import { OfflineMutationError } from '../../../lib/offline-policy';
import { useSession } from '../../../components/session-provider';
import {
  deleteOfflineModuleDraft,
  listOfflineModuleDrafts,
  upsertOfflineModuleDraft,
} from '../../../lib/offline-module-drafts';
import { schoolFacingErrorMessage } from '../../../lib/school-facing-error';
import {
  authorityFenceFields,
  readSchoolAuthorityFence,
} from '../../../lib/school-authority-discovery';
import { 
  Trophy, 
  Search, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Info, 
  ChevronRight,
  ArrowDown,
  ArrowUp,
  User,
  MoreVertical,
  XCircle,
  FileText,
  Lock,
  Zap,
  Users
  ,RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeacherAssignmentScope } from '@/lib/hooks/use-teacher-assignment-scope';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { EmptyState } from '../../ui/empty-state';
import { ErrorState } from '../../ui/error-state';
import { LoadingState } from '../../ui/loading-state';
import { AssessmentRetakeRequestDialog } from '../assessment-retake-request-dialog';

function StatusSegmentButton({
  label,
  shortLabel,
  active,
  activeClassName,
  disabled,
  onClick,
}: {
  label: string;
  shortLabel: string;
  active: boolean;
  activeClassName: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-8 w-8 rounded-lg p-0 text-[10px] font-black',
        active ? activeClassName : 'bg-slate-100 text-slate-300 hover:bg-slate-200',
        disabled && 'pointer-events-none opacity-60',
      )}
      aria-pressed={active}
      aria-label={label}
      title={label}
    >
      {shortLabel}
    </Button>
  );
}

type Props = {
  academicYears: any[];
  classes: any[];
  allSections: any[];
  exams: any[];
};

export function MarksEntryTab({ academicYears, classes, allSections, exams }: Props) {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const [queuedMarksMessage, setQueuedMarksMessage] = useState<string | null>(null);
  // Class/section/subject options come from the shared assignment-scope
  // resolver so a teacher never sees -- or can select -- a class, section or
  // subject they are not assigned to (P0.4). The backend re-validates each id
  // on save; this only stops the picker from offering them.
  const assignmentScope = useTeacherAssignmentScope();
  const [filters, setFilters] = useState({ examTermId: '', classId: '', sectionId: '', subjectId: '', assessmentComponentId: '' });
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState<number | null>(null);
  const [retakeMark, setRetakeMark] = useState<MarkEntrySummary | null>(null);
  const [retakeSuccess, setRetakeSuccess] = useState(false);
  const [pendingFilterChange, setPendingFilterChange] = useState<(() => void) | null>(null);

  const subjectsQuery = useQuery({ 
    queryKey: ['subjects', filters.classId], 
    queryFn: () => api.listSubjects(),
    enabled: true
  });

  const componentsQuery = useQuery({
    queryKey: ['assessment-components', filters.examTermId, filters.subjectId],
    queryFn: () => api.listComponentsByExamTerm(filters.examTermId, { subjectId: filters.subjectId }),
    enabled: Boolean(filters.examTermId && filters.subjectId),
  });

  const existingMarksQuery = useQuery({
    queryKey: ['marks', filters],
    queryFn: () => api.listMarks(filters),
    enabled: Boolean(filters.examTermId && filters.classId && filters.assessmentComponentId),
  });

  const rosterQuery = useQuery({
    queryKey: ['students', 'roster', filters.classId, filters.sectionId],
    queryFn: () => api.listStudents({ classId: filters.classId, sectionId: filters.sectionId || undefined, limit: 1000 }),
    enabled: Boolean(filters.classId),
  });

  const batchMut = useMutation({
    mutationFn: (payload: any) =>
      api.batchEnterMarks({
        ...payload,
        ...authorityFenceFields(readSchoolAuthorityFence()),
      }),
    onSuccess: (data) => {
      setSaveSuccess(data.updated);
      setQueuedMarksMessage(null);
      void queryClient.invalidateQueries({ queryKey: ['marks', filters] });
      setMarks({});
      setStatuses({});
      setRemarks({});
      setTimeout(() => setSaveSuccess(null), 5000);
    },
    onError: async (error, payload) => {
      if (!(error instanceof OfflineMutationError) || !session?.tenant.id || !session.user.id) {
        return;
      }
      const operationId = crypto.randomUUID();
      await upsertOfflineModuleDraft({
        module: 'marks',
        operationId,
        tenantId: session.tenant.id,
        userId: session.user.id,
        status: 'queued',
        savedAt: new Date().toISOString(),
        payload,
      });
      setQueuedMarksMessage(
        'Marks capture queued on this browser. It is not published. Reconnect to sync against the locked session version.',
      );
    },
  });

  useEffect(() => {
    const drain = async () => {
      if (
        typeof navigator === 'undefined' ||
        navigator.onLine === false ||
        !session?.tenant.id ||
        !session.user.id
      ) {
        return;
      }
      const drafts = await listOfflineModuleDrafts('marks', {
        tenantId: session.tenant.id,
        userId: session.user.id,
      });
      for (const draft of drafts) {
        if (draft.status !== 'queued') continue;
        try {
          await api.batchEnterMarks(draft.payload);
          await deleteOfflineModuleDraft('marks', draft.operationId);
        } catch {
          // Quarantine by leaving the queued record; never last-write-wins.
        }
      }
    };
    const handleOnline = () => {
      void drain();
    };
    window.addEventListener('online', handleOnline);
    void drain();
    return () => window.removeEventListener('online', handleOnline);
  }, [session?.tenant.id, session?.user.id]);

  const saveErrorMessage =
    batchMut.isError && !(batchMut.error instanceof OfflineMutationError)
    ? schoolFacingErrorMessage(batchMut.error, {
        fallback:
          'These marks could not be saved. No entries were changed.',
        invalid:
          'Review the marks, status, and remarks before saving — a value is out of range or otherwise invalid.',
        forbidden: 'You do not have permission to enter marks for this class or subject.',
        notFound: 'This exam term, component, class, or section is no longer available.',
        conflict: 'These marks changed on the server. Refresh and try again.',
      })
    : '';

  // A teacher only ever picks from their own assignments; an administrator
  // keeps the full school lists. `classes`/`allSections` remain the props the
  // administrative workspace passes in.
  const availableClasses = assignmentScope.isScoped
    ? assignmentScope.classes
    : classes;
  const availableSections = useMemo(
    () =>
      filters.classId
        ? assignmentScope.isScoped
          ? assignmentScope.sectionsForClass(filters.classId)
          : allSections.filter(
              (section: any) =>
                (section.classId ?? section.class?.id) === filters.classId,
            )
        : [],
    [allSections, assignmentScope, filters.classId],
  );
  const availableSubjects = useMemo(() => {
    const all = subjectsQuery.data ?? [];
    const forClass = filters.classId
      ? all.filter(
          (subject: any) =>
            !subject.classId || subject.classId === filters.classId,
        )
      : all;
    if (!assignmentScope.isScoped || assignmentScope.assignedSubjectIds.size === 0) {
      return forClass;
    }
    return forClass.filter((subject: any) =>
      assignmentScope.assignedSubjectIds.has(subject.id),
    );
  }, [assignmentScope, filters.classId, subjectsQuery.data]);

  const selectedExam = exams.find((e) => e.id === filters.examTermId);
  const isLocked = selectedExam?.isLocked;
  const selectedComponent = componentsQuery.data?.find((c: any) => c.id === filters.assessmentComponentId);
  const maxMarks = selectedComponent ? Number(selectedComponent.maxMarks) : 100;
  const passMarks = selectedComponent ? Number(selectedComponent.passMarks) : null;

  const studentsForClass = rosterQuery.data?.items ?? [];

  const changedEntries = useMemo(() => {
    const studentIds = new Set([...Object.keys(marks), ...Object.keys(statuses), ...Object.keys(remarks)]);
    return Array.from(studentIds).map(studentId => ({
      studentId,
      marksObtained: marks[studentId] ? Number(marks[studentId]) : undefined,
      isAbsent: statuses[studentId] === 'ABSENT' || statuses[studentId] === 'EXCUSED',
      isWithheld: statuses[studentId] === 'WITHHELD',
      remarks: remarks[studentId] || undefined,
    }));
  }, [marks, statuses, remarks]);

  const canSave = changedEntries.length > 0 && !batchMut.isPending && !isLocked;
  const hasUnsavedChanges = changedEntries.length > 0;

  // Reads the real per-mark lock state the backend computes (a mark can stay
  // individually locked even after the exam term itself reopens), not just
  // the coarser exam-term-level lock.
  const lockedStudentIds = useMemo(
    () =>
      new Set(
        (existingMarksQuery.data ?? [])
          .filter((mark: any) => mark.isLocked)
          .map((mark: any) => mark.studentId),
      ),
    [existingMarksQuery.data],
  );

  const requestFilterChange = (apply: () => void) => {
    if (hasUnsavedChanges) {
      setPendingFilterChange(() => apply);
    } else {
      apply();
    }
  };

  const handleSave = () => {
    if (!canSave) return;
    batchMut.mutate({
      examTermId: filters.examTermId,
      assessmentComponentId: filters.assessmentComponentId,
      classId: filters.classId,
      sectionId: filters.sectionId || undefined,
      subjectId: filters.subjectId,
      entries: changedEntries.map((entry) => {
        const existing = getExistingMark(existingMarksQuery.data, entry.studentId);
        return {
          ...entry,
          ...(existing?.updatedAt
            ? { expectedVersion: String(existing.updatedAt) }
            : {}),
        };
      }),
    });
  };

  const getExistingMark = (existing: any[] | undefined, studentId: string) => {
    return existing?.find((m: any) => m.studentId === studentId);
  };

  const statusOptions = [
    { value: 'PRESENT', label: 'P', color: 'text-emerald-600 bg-emerald-50' },
    { value: 'ABSENT', label: 'A', color: 'text-rose-600 bg-rose-50' },
    { value: 'WITHHELD', label: 'W', color: 'text-amber-600 bg-amber-50' },
    { value: 'EXCUSED', label: 'E', color: 'text-blue-600 bg-blue-50' },
  ];

  // "No active assignment means no data access" (Teacher Persona spec 3.1):
  // an empty picker is a dead end, so say why instead.
  if (assignmentScope.hasNoAssignments) {
    return (
      <div
        role="status"
        className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-8 text-center"
      >
        <h3 className="text-lg font-black tracking-tight text-slate-900">
          No assessments assigned to you
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-slate-500">
          Marks entry opens once you have an active Class Teacher or Subject
          Teacher assignment for the current academic year. Ask the academic
          coordinator if you expected one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Quick Filter Bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Exam Term</label>
            <select 
              data-testid="filter-exam-term"
              value={filters.examTermId}
              onChange={(e) => {
                const value = e.target.value;
                requestFilterChange(() => setFilters(c => ({ ...c, examTermId: value, assessmentComponentId: '' })));
              }}
              className="premium-input bg-white"
            >
              <option value="">Select Exam</option>
              {exams.map((e: any) => <option key={e.id} value={e.id}>{e.name}{e.isLocked ? ' (Locked)' : ''}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Class</label>
            <select 
              data-testid="filter-class"
              value={filters.classId}
              onChange={(e) => {
                const value = e.target.value;
                requestFilterChange(() => setFilters(c => ({ ...c, classId: value, sectionId: '' })));
              }}
              className="premium-input bg-white"
            >
              <option value="">Select Class</option>
              {availableClasses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Section</label>
            <select
              data-testid="filter-section"
              value={filters.sectionId}
              disabled={!filters.classId}
              onChange={(e) => {
                const value = e.target.value;
                requestFilterChange(() => setFilters(c => ({ ...c, sectionId: value })));
              }}
              className="premium-input bg-white"
            >
              <option value="">{assignmentScope.isScoped ? 'All my sections' : 'All sections'}</option>
              {availableSections.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Subject</label>
            <select
              data-testid="filter-subject"
              value={filters.subjectId}
              onChange={(e) => {
                const value = e.target.value;
                requestFilterChange(() => setFilters(c => ({ ...c, subjectId: value, assessmentComponentId: '' })));
              }}
              className="premium-input bg-white"
            >
              <option value="">Select Subject</option>
              {availableSubjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Component</label>
            <select 
              data-testid="filter-component"
              value={filters.assessmentComponentId}
              onChange={(e) => {
                const value = e.target.value;
                requestFilterChange(() => setFilters(c => ({ ...c, assessmentComponentId: value })));
              }}
              className="premium-input bg-white"
            >
              <option value="">Select Component</option>
              {componentsQuery.data?.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.maxMarks})</option>)}
            </select>
          </div>
          <div className="flex gap-2">
             <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-xl"
              aria-label="Refresh roster"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['marks', filters] })}
             >
                <Search size={20} />
             </Button>
             <Button
              type="button"
              disabled={!canSave}
              className="h-12 flex-1 rounded-2xl font-black uppercase tracking-widest text-xs"
              onClick={handleSave}
             >
                {batchMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {batchMut.isPending ? 'Saving' : `Save ${changedEntries.length > 0 ? changedEntries.length : ''}`}
             </Button>
          </div>
        </div>
      </section>

      {saveSuccess !== null && (
        <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between shadow-lg shadow-emerald-500/5 animate-in slide-in-from-top-4 duration-500">
           <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                 <CheckCircle2 size={24} />
              </div>
              <div>
                 <p className="text-sm font-black text-emerald-900 tracking-tight">Sync Complete</p>
                 <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Successfully saved {saveSuccess} entries.</p>
              </div>
           </div>
           <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSaveSuccess(null)}
           >
              Dismiss
           </Button>
        </div>
      )}

      {queuedMarksMessage ? (
        <div
          role="status"
          className="p-6 bg-amber-50 border border-amber-100 rounded-2xl text-sm font-semibold text-amber-950"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">
            Queued · not published
          </p>
          <p className="mt-1">{queuedMarksMessage}</p>
        </div>
      ) : null}

      {saveErrorMessage ? (
        <div
          role="alert"
          className="p-6 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between shadow-lg shadow-rose-500/5 animate-in slide-in-from-top-4 duration-500"
        >
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20">
              <XCircle size={24} />
            </div>
            <div>
              <p className="text-sm font-black text-rose-900 tracking-tight">Save failed</p>
              <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mt-0.5">{saveErrorMessage}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => batchMut.reset()}
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {retakeSuccess ? (
        <div
          className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
          role="status"
        >
          <span>Retest or make-up request sent for review.</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRetakeSuccess(false)}
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {isLocked && (
        <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-4 text-amber-800 animate-in fade-in duration-500">
          <Lock size={24} className="text-amber-500" />
          <div>
            <p className="text-sm font-black tracking-tight uppercase">Operational Lock Active</p>
            <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-0.5">Contact the academic coordinator to request an unlock for this exam term.</p>
          </div>
        </div>
      )}

      {!isLocked && lockedStudentIds.size > 0 && (
        <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-4 text-amber-800 animate-in fade-in duration-500">
          <Lock size={24} className="text-amber-500" />
          <div>
            <p className="text-sm font-black tracking-tight uppercase">
              {lockedStudentIds.size} student{lockedStudentIds.size === 1 ? '' : 's'} still locked
            </p>
            <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-0.5">
              Marked students were finalized while the term was locked and need an approved correction request before they can be edited again.
            </p>
          </div>
        </div>
      )}

      {filters.assessmentComponentId ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="py-6 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 w-16">#</th>
                  <th className="py-6 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400">Student Info</th>
                  <th className="py-6 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 w-24 text-center">Roll</th>
                  <th className="py-6 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 w-32 text-center">Status</th>
                  <th className="py-6 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 w-32 text-center">Existing</th>
                  <th className="py-6 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 w-48">Score Entry</th>
                  <th className="py-6 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400">Observations</th>
                  <th className="py-6 px-6 font-black uppercase tracking-widest text-[10px] text-slate-400 w-20 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {existingMarksQuery.isError || rosterQuery.isError ? (
                  <tr>
                    <td colSpan={8} className="py-8">
                      <ErrorState
                        title="Could not load mark entry roster"
                        message="Refresh the roster or adjust your filters and try again."
                        onRetry={() => {
                          void queryClient.invalidateQueries({ queryKey: ['marks', filters] });
                          void queryClient.invalidateQueries({
                            queryKey: ['students', 'roster', filters.classId, filters.sectionId],
                          });
                        }}
                        className="min-h-0 border-0 bg-transparent p-4"
                      />
                    </td>
                  </tr>
                ) : existingMarksQuery.isLoading || rosterQuery.isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12">
                      <LoadingState label="Fetching student roster..." />
                    </td>
                  </tr>
                ) : studentsForClass.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12">
                      <EmptyState
                        title="No students found"
                        description="Choose a class and section with enrolled students to begin mark entry."
                        icon={<Users size={32} />}
                      />
                    </td>
                  </tr>
                ) : (
                  studentsForClass.map((student, index) => {
                    const existing = getExistingMark(existingMarksQuery.data, student.id);
                    const currentValue = marks[student.id] ?? '';
                    const currentStatus = statuses[student.id] || existing?.status || 'SUBMITTED';
                    const numericValue = currentValue.trim() === '' ? null : Number(currentValue);
                    const isInvalid = numericValue !== null && (numericValue < 0 || numericValue > maxMarks);
                    const passed = passMarks === null || (existing && Number(existing.marksObtained) >= passMarks);
                    const isStudentLocked = lockedStudentIds.has(student.id);

                    return (
                      <tr key={student.id} className={cn(
                        "group transition-all hover:bg-slate-50/50",
                        (isLocked || isStudentLocked) && "opacity-60"
                      )}>
                        <td className="py-4 px-6 text-[10px] font-black text-slate-300">{index + 1}</td>
                        <td className="py-4 px-6">
                           <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all">
                                 <User size={18} />
                              </div>
                              <div className="flex flex-col">
                                 <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                                   {student.fullNameEn}
                                   {isStudentLocked && <Lock size={12} className="shrink-0 text-amber-500" />}
                                 </span>
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{student.studentSystemId}</span>
                              </div>
                           </div>
                        </td>
                        <td className="py-4 px-6 text-center text-xs font-black text-slate-700 tracking-tighter">{student.rollNumber ?? '—'}</td>
                        <td className="py-4 px-6">
                           <div className="flex items-center justify-center gap-1">
                              {statusOptions.map(opt => (
                                <StatusSegmentButton
                                  key={opt.value}
                                  label={opt.value}
                                  shortLabel={opt.label}
                                  active={currentStatus === opt.value}
                                  activeClassName={opt.color}
                                  disabled={isLocked || isStudentLocked}
                                  onClick={() => setStatuses(c => ({ ...c, [student.id]: opt.value }))}
                                />
                              ))}
                           </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                           {existing ? (
                             <div className="flex flex-col items-center">
                                <span className={cn(
                                  "text-sm font-black tracking-tighter",
                                  passed ? "text-emerald-600" : "text-rose-600"
                                )}>
                                   {Number(existing.marksObtained)}
                                </span>
                                <span className="text-[8px] font-black uppercase text-slate-300 tracking-widest">Saved Score</span>
                             </div>
                           ) : (
                             <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">Pending</span>
                           )}
                        </td>
                        <td className="py-4 px-6">
                           <div className="relative">
                              <input
                                id={`mark-input-${index}`}
                                type="number"
                                min={0}
                                max={maxMarks}
                                value={currentValue}
                                disabled={isLocked || isStudentLocked || currentStatus === 'ABSENT'}
                                placeholder={existing ? String(Number(existing.marksObtained)) : '0.0'}
                                className={cn(
                                  "w-full rounded-2xl border px-4 py-3 text-sm font-black transition-all focus:ring-4 text-center tracking-tighter",
                                  isInvalid
                                    ? "border-rose-300 bg-rose-50 text-rose-600 focus:ring-rose-100"
                                    : "border-slate-100 bg-slate-50 focus:bg-white focus:border-[var(--color-mod-academics-accent)] focus:ring-[var(--color-mod-academics-border)]",
                                  (currentStatus === 'ABSENT' || isStudentLocked) && "bg-slate-100 border-transparent text-slate-300 cursor-not-allowed"
                                )}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMarks(c => ({ ...c, [student.id]: val }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    document.getElementById(`mark-input-${index + 1}`)?.focus();
                                  }
                                  if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    document.getElementById(`mark-input-${index - 1}`)?.focus();
                                  }
                                }}
                              />
                              {isInvalid && (
                                <AlertCircle size={14} className="absolute -right-6 top-1/2 -translate-y-1/2 text-rose-500" />
                              )}
                           </div>
                        </td>
                        <td className="py-4 px-6">
                           <input
                            type="text"
                            value={remarks[student.id] ?? existing?.remarks ?? ''}
                            disabled={isLocked || isStudentLocked}
                            placeholder="Add observation..."
                            className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-medium focus:bg-white focus:border-[var(--color-mod-academics-accent)] transition-all"
                            onChange={(e) => setRemarks(c => ({ ...c, [student.id]: e.target.value }))}
                           />
                        </td>
                        <td className="py-4 px-6 text-right">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 rounded-lg p-0"
                            title="Request retest or make-up"
                            aria-label="Request retest or make-up"
                            disabled={
                              !existing ||
                              existing.status === 'DRAFT' ||
                              existing.status === 'RETEST'
                            }
                            onClick={() =>
                              setRetakeMark(existing as MarkEntrySummary)
                            }
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 p-4">
             <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-[var(--color-mod-academics-accent)]" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Roster: {studentsForClass.length}</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full bg-emerald-500" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Draft Entries: {changedEntries.length}</span>
                </div>
             </div>
             
             <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-[var(--color-mod-academics-border)] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--color-mod-academics-text)]">
                   <Zap size={14} className="text-[var(--color-mod-academics-accent)]" />
                   Keyboard Mode Active
                </div>
             </div>
          </div>
        </div>
      ) : (
        <section className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-300">
             <Trophy size={40} />
          </div>
          <h3 className="text-2xl font-black tracking-tight text-slate-900">Roster Ready</h3>
          <p className="mt-2 text-sm font-bold text-slate-400 max-w-sm mx-auto leading-relaxed">
            Select context to begin. Choose an exam term, class, and assessment component above to load the mark entry grid.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
             <div className="px-4 py-2 rounded-2xl bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">Fast Entry</div>
             <div className="px-4 py-2 rounded-2xl bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">Auto-Sync</div>
             <div className="px-4 py-2 rounded-2xl bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">Operational Logs</div>
          </div>
        </section>
      )}

      <AssessmentRetakeRequestDialog
        mark={retakeMark}
        open={Boolean(retakeMark)}
        onOpenChange={(open) => {
          if (!open) setRetakeMark(null);
        }}
        onRequested={() => setRetakeSuccess(true)}
      />

      <ConfirmDialog
        isOpen={pendingFilterChange !== null}
        title="Discard unsaved marks?"
        description="You have marks changes that have not been saved yet. Switching the exam, class, subject, or component now will discard them."
        confirmLabel="Discard changes"
        variant="destructive"
        onConfirm={() => {
          pendingFilterChange?.();
          setMarks({});
          setStatuses({});
          setRemarks({});
          setPendingFilterChange(null);
        }}
        onClose={() => setPendingFilterChange(null)}
      />
    </div>
  );
}
