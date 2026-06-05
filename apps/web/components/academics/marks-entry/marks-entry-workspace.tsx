'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FilterBar } from '@/components/ui/filter-bar';
import { Select, Input } from '@/components/ui/form-field';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Save, Lock, History, Search } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Toast, ToastTone } from '@/components/ui/toast';

type MarksNotice = {
  title: string;
  description?: string;
  tone: ToastTone;
};

export function MarksEntryWorkspace() {
  const queryClient = useQueryClient();
  const [examTermId, setExamTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [componentId, setComponentId] = useState('');
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [notice, setNotice] = useState<MarksNotice | null>(null);

  const examsQuery = useQuery({ queryKey: ['exam-terms'], queryFn: api.listExamTerms });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const subjectsQuery = useQuery({
    queryKey: ['subjects', classId],
    queryFn: () => api.listSubjects({ classId: classId || undefined }),
    enabled: !!classId,
  });
  const componentsQuery = useQuery({
    queryKey: ['components', examTermId, subjectId],
    queryFn: () => api.listComponentsByExamTerm(examTermId, { subjectId: subjectId || undefined }),
    enabled: !!examTermId && !!subjectId,
  });
  const studentsQuery = useQuery({
    queryKey: ['students', classId, sectionId],
    queryFn: () => api.listStudents({ 
      classId: classId || undefined, 
      sectionId: sectionId || undefined,
      limit: 1000 
    }),
    enabled: !!classId,
  });
  const existingMarksQuery = useQuery({
    queryKey: ['marks-grid', examTermId, componentId, classId, sectionId],
    queryFn: () => api.listMarks({
      examTermId,
      assessmentComponentId: componentId,
      classId,
      sectionId: sectionId || undefined,
      subjectId: subjectId || undefined,
    }),
    enabled: !!examTermId && !!componentId && !!classId,
  });

  const selectedComponent = componentsQuery.data?.find(c => c.id === componentId);
  const maxMarks = selectedComponent ? Number(selectedComponent.maxMarks) : 100;
  const isExamLocked = examsQuery.data?.find(e => e.id === examTermId)?.isLocked;

  useEffect(() => {
    if (existingMarksQuery.data) {
      const m: Record<string, string> = {};
      const r: Record<string, string> = {};
      const s: Record<string, string> = {};
      existingMarksQuery.data.forEach(mark => {
        m[mark.studentId] = String(Number(mark.marksObtained));
        if (mark.remarks) r[mark.studentId] = mark.remarks;
        s[mark.studentId] = mark.status;
      });
      setMarks(m);
      setRemarks(r);
      setStatuses(s);
    }
  }, [existingMarksQuery.data]);

  const batchMutation = useMutation({
    mutationFn: api.batchEnterMarks,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['marks-grid'] });
      setNotice({ title: 'Marks saved', tone: 'success' });
    },
    onError: (error: any) => {
      setNotice({
        title: 'Could not save marks',
        description: error.message || 'Failed to save marks',
        tone: 'danger',
      });
    },
  });

  const lockRequestMutation = useMutation({
    mutationFn: api.createMarkLockRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exam-terms'] });
      setShowLockDialog(false);
      setNotice({
        title: 'Lock request submitted',
        description: 'An administrator can now review the request.',
        tone: 'success',
      });
    },
    onError: (error: any) => {
      setNotice({
        title: 'Could not submit lock request',
        description: error.message || 'Failed to submit lock request',
        tone: 'danger',
      });
    },
  });

  const handleLockRequest = () => {
    if (!examTermId) return;
    setShowLockDialog(true);
  };

  const handleSave = () => {
    const entries = Object.entries(marks).map(([studentId, marksObtained]) => ({
      studentId,
      marksObtained: Number(marksObtained),
      isAbsent: statuses[studentId] === 'ABSENT' || statuses[studentId] === 'EXCUSED',
      isWithheld: statuses[studentId] === 'WITHHELD',
      remarks: remarks[studentId],
    })).filter(e => !isNaN(e.marksObtained));

    if (entries.length === 0) return;

    batchMutation.mutate({
      examTermId,
      assessmentComponentId: componentId,
      classId,
      sectionId: sectionId || undefined,
      subjectId,
      entries,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>, row: number, col: number) => {
    const { key, shiftKey } = e;
    
    let nextRow = row;
    let nextCol = col;

    if (key === 'ArrowDown' || (key === 'Enter' && !shiftKey)) {
      nextRow++;
      e.preventDefault();
    } else if (key === 'ArrowUp' || (key === 'Enter' && shiftKey)) {
      nextRow--;
      e.preventDefault();
    } else if (key === 'ArrowRight' && (e.currentTarget as any).selectionEnd === (e.currentTarget as any).value.length) {
      nextCol++;
    } else if (key === 'ArrowLeft' && (e.currentTarget as any).selectionStart === 0) {
      nextCol--;
    } else if (key === 'Escape') {
      (e.currentTarget as HTMLElement).blur();
      return;
    } else {
      return;
    }

    const nextTarget = document.querySelector(
      `[data-row="${nextRow}"][data-col="${nextCol}"]`
    ) as HTMLElement;

    if (nextTarget) {
      nextTarget.focus();
      if (nextTarget instanceof HTMLInputElement) {
        nextTarget.select();
      }
    }
  };

  const columns = [
    {
      header: 'Roll',
      accessorKey: 'rollNumber',
      className: 'w-16',
    },
    {
      header: 'Student',
      cell: (student: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{student.firstNameEn} {student.lastNameEn}</span>
          <span className="text-[10px] text-slate-400">{student.studentSystemId}</span>
        </div>
      ),
    },
    {
      header: 'Marks',
      className: 'w-32',
      cell: (student: any, rowIndex: number) => (
        <Input
          type="number"
          value={marks[student.id] || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMarks(prev => ({ ...prev, [student.id]: e.target.value }))}
          onKeyDown={(e) => handleKeyDown(e, rowIndex, 0)}
          data-row={rowIndex}
          data-col={0}
          disabled={isExamLocked || statuses[student.id] === 'ABSENT' || statuses[student.id] === 'EXCUSED'}
          max={maxMarks}
          min={0}
          className="h-10 rounded-xl text-center font-bold transition-all focus:border-[var(--color-mod-academics-accent)] focus:ring-4 focus:ring-[var(--color-mod-academics-accent)]/10"
        />
      ),
    },
    {
      header: 'Status',
      className: 'w-32',
      cell: (student: any, rowIndex: number) => (
        <Select
          value={statuses[student.id] || 'PRESENT'}
          onChange={(e) => {
            const val = e.target.value;
            setStatuses(prev => ({ ...prev, [student.id]: val }));
            if (val === 'ABSENT' || val === 'EXCUSED') {
              setMarks(prev => ({ ...prev, [student.id]: '0' }));
            }
          }}
          onKeyDown={(e) => handleKeyDown(e, rowIndex, 1)}
          data-row={rowIndex}
          data-col={1}
          disabled={isExamLocked}
          className="h-10 rounded-xl text-xs font-bold"
        >
          <option value="PRESENT">Present</option>
          <option value="ABSENT">Absent</option>
          <option value="EXCUSED">Excused</option>
          <option value="WITHHELD">Withheld</option>
        </Select>
      ),
    },
    {
      header: `Max: ${maxMarks}`,
      className: 'w-24',
      cell: (student: any) => {
        const val = Number(marks[student.id]);
        if (isNaN(val)) return null;
        const pct = (val / maxMarks) * 100;
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div 
                className={`h-full transition-all ${pct >= 40 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                style={{ width: `${Math.min(100, pct)}%` }} 
              />
            </div>
          </div>
        );
      },
    },
    {
      header: 'Remarks',
      cell: (student: any, rowIndex: number) => (
        <Input
          value={remarks[student.id] || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRemarks(prev => ({ ...prev, [student.id]: e.target.value }))}
          onKeyDown={(e) => handleKeyDown(e, rowIndex, 2)}
          data-row={rowIndex}
          data-col={2}
          disabled={isExamLocked}
          placeholder="Note..."
          className="h-10 rounded-xl"
        />
      ),
    },
  ];

  const ready = !!examTermId && !!classId && !!subjectId && !!componentId;

  return (
    <div className="space-y-8">
      {notice ? (
        <Toast
          title={notice.title}
          description={notice.description}
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      <FilterBar
        label="Context"
        description="Select exam and roster to begin"
        actions={
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              disabled={!ready || isExamLocked || lockRequestMutation.isPending}
              onClick={handleLockRequest}
            >
              <Lock size={16} className="mr-2" />
              Request Lock
            </Button>
            <Button variant="outline" size="sm" disabled={!ready}>
              <History size={16} className="mr-2" />
              History
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!ready || isExamLocked || batchMutation.isPending}
              className="bg-[var(--color-mod-academics-accent)] shadow-sm hover:bg-[var(--color-mod-academics-text)]"
            >
              <Save size={16} className="mr-2" />
              {batchMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <Select 
          value={examTermId} 
          onChange={(e) => setExamTermId(e.target.value)} 
          className="lg:w-48"
          data-testid="filter-exam-term"
        >
          <option value="">Exam Term</option>
          {examsQuery.data?.map(e => (
            <option key={e.id} value={e.id}>{e.name}{e.isLocked ? ' 🔒' : ''}</option>
          ))}
        </Select>

        <Select 
          value={classId} 
          onChange={(e) => setClassId(e.target.value)} 
          className="lg:w-32"
          data-testid="filter-class"
        >
          <option value="">Class</option>
          {classesQuery.data?.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>

        <Select 
          value={sectionId} 
          onChange={(e) => setSectionId(e.target.value)} 
          disabled={!classId} 
          className="lg:w-32"
          data-testid="filter-section"
        >
          <option value="">Section</option>
          {sectionsQuery.data?.filter(s => s.classId === classId).map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>

        <Select 
          value={subjectId} 
          onChange={(e) => setSubjectId(e.target.value)} 
          disabled={!classId} 
          className="lg:w-48"
          data-testid="filter-subject"
        >
          <option value="">Subject</option>
          {subjectsQuery.data?.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>

        <Select 
          value={componentId} 
          onChange={(e) => setComponentId(e.target.value)} 
          disabled={!subjectId} 
          className="lg:w-48"
          data-testid="filter-component"
        >
          <option value="">Component</option>
          {componentsQuery.data?.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({Number(c.maxMarks)})</option>
          ))}
        </Select>
      </FilterBar>

      {ready ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <SectionCard 
            title="Student Roster" 
            description={`Recording marks for ${selectedComponent?.subject?.name} - ${selectedComponent?.name}`}
          >
            {isExamLocked && (
              <div className="mb-6 flex items-center gap-3 rounded-2xl bg-amber-50 border border-amber-100 p-6 text-amber-800">
                <Lock size={20} className="shrink-0" />
                <div>
                  <p className="font-black uppercase italic tracking-tight">Exam Term Locked</p>
                  <p className="text-sm font-medium opacity-80">This exam term has been finalized. To make changes, please contact the administrator for an unlock request.</p>
                </div>
              </div>
            )}
            
            <DataTable
              columns={columns}
              data={studentsQuery.data?.items ?? []}
              isLoading={studentsQuery.isLoading || existingMarksQuery.isLoading}
              getRowKey={(s) => s.id}
            />
          </SectionCard>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
          <div className="h-16 w-16 rounded-2xl border border-[var(--color-mod-academics-border)] bg-[var(--color-mod-academics-surface)] flex items-center justify-center text-[var(--color-mod-academics-accent)] mb-6">
            <Search size={32} />
          </div>
          <p className="text-xl font-black italic uppercase tracking-tight text-slate-400">Select context to begin</p>
          <p className="mt-2 text-sm font-medium text-slate-400">Choose an exam, class, subject and component from the filters above.</p>
        </div>
      )}

      <ConfirmDialog
        isOpen={showLockDialog}
        title="Request Mark Lock"
        description="Once approved, marks for this exam term will no longer be editable without an administrator unlocking the term."
        confirmLabel="Submit Request"
        isConfirming={lockRequestMutation.isPending}
        onConfirm={() => {
          lockRequestMutation.mutate({ examTermId, reason: 'Marks entry completed' });
        }}
        onClose={() => setShowLockDialog(false)}
      />
    </div>
  );
}
