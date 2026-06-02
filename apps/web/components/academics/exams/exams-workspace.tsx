'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ExamList } from './exam-list';
import { ExamForm } from './exam-form';
import { AssessmentComponentsDialog } from './assessment-components-dialog';
import { ExamTermSummary } from '@schoolos/core';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { StatCard } from '@/components/ui/stat-card';
import { ClipboardList, CheckCircle2, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toast, ToastTone } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type ExamNotice = {
  title: string;
  description?: string;
  tone: ToastTone;
};

export function ExamsWorkspace() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isComponentsOpen, setIsComponentsOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamTermSummary | null>(null);
  const [selectedExam, setSelectedExam] = useState<ExamTermSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExamTermSummary | null>(null);
  const [notice, setNotice] = useState<ExamNotice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });

  const examsQuery = useQuery({
    queryKey: ['exam-terms'],
    queryFn: api.listExamTerms,
  });

  const createMutation = useMutation({
    mutationFn: api.createExamTerm,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exam-terms'] });
      setIsFormOpen(false);
      setNotice({ title: 'Exam term created', tone: 'success' });
    },
    onError: (error: any) => {
      setNotice({
        title: 'Could not create exam term',
        description: error.message || 'Failed to create exam term',
        tone: 'danger',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateExamTerm(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exam-terms'] });
      setIsFormOpen(false);
      setEditingExam(null);
      setNotice({ title: 'Exam term updated', tone: 'success' });
    },
    onError: (error: any) => {
      setNotice({
        title: 'Could not update exam term',
        description: error.message || 'Failed to update exam term',
        tone: 'danger',
      });
    },
  });

  const handleCreate = (data: any) => {
    createMutation.mutate({
      ...data,
      startsOn: new Date(data.startsOn).toISOString(),
      endsOn: new Date(data.endsOn).toISOString(),
    });
  };

  const handleUpdate = (data: any) => {
    if (!editingExam) return;
    updateMutation.mutate({
      id: editingExam.id,
      data: {
        ...data,
        startsOn: new Date(data.startsOn).toISOString(),
        endsOn: new Date(data.endsOn).toISOString(),
      },
    });
  };

  const handleEdit = (exam: ExamTermSummary) => {
    setEditingExam(exam);
    setIsFormOpen(true);
  };

  const handleDelete = async (exam: ExamTermSummary) => {
    setDeleteTarget(exam);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteExamTerm(deleteTarget.id);
      void queryClient.invalidateQueries({ queryKey: ['exam-terms'] });
      setNotice({ title: 'Exam term deleted', tone: 'success' });
      setDeleteTarget(null);
    } catch (error: any) {
      setNotice({
        title: 'Could not delete exam term',
        description: error.message || 'Failed to delete exam term',
        tone: 'danger',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const activeExams = examsQuery.data?.filter(e => e.status === 'ACTIVE').length ?? 0;
  const totalExams = examsQuery.data?.length ?? 0;
  const lockedExams = examsQuery.data?.filter(e => e.isLocked).length ?? 0;

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

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Exam Terms"
          value={totalExams}
          icon={<ClipboardList size={20} />}
          trend={{ value: activeExams, label: 'Active now', isUp: true }}
        />
        <StatCard
          title="Active Exams"
          value={activeExams}
          icon={<CheckCircle2 size={20} />}
          className="bg-emerald-50/50 border-emerald-100"
        />
        <StatCard
          title="Locked Terms"
          value={lockedExams}
          icon={<AlertCircle size={20} />}
          className="bg-amber-50/50 border-amber-100"
        />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black uppercase italic tracking-tight text-slate-900">
          Exam <span className="text-primary-600">Terms</span>
        </h2>
        <Button onClick={() => { setEditingExam(null); setIsFormOpen(true); }} className="rounded-2xl shadow-lg shadow-primary-600/20">
          <Plus size={18} className="mr-2" />
          Create Exam Term
        </Button>
      </div>

      <ExamList
        exams={examsQuery.data ?? []}
        isLoading={examsQuery.isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onManageComponents={(exam) => {
          setSelectedExam(exam);
          setIsComponentsOpen(true);
        }}
      />

      {/* Exam Term Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tight">
              {editingExam ? 'Edit' : 'Create'} <span className="text-primary-600">Exam Term</span>
            </DialogTitle>
          </DialogHeader>
          <ExamForm
            initialData={editingExam ?? undefined}
            academicYears={academicYearsQuery.data ?? []}
            onSubmit={editingExam ? handleUpdate : handleCreate}
            isLoading={createMutation.isPending || updateMutation.isPending}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Assessment Components Dialog */}
      <Dialog open={isComponentsOpen} onOpenChange={setIsComponentsOpen}>
        <DialogContent className="max-w-3xl rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tight">
              Manage <span className="text-primary-600">Components</span>
            </DialogTitle>
            <DialogDescription className="text-sm font-bold uppercase tracking-widest text-slate-400">
              {selectedExam?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedExam && (
            <AssessmentComponentsDialog
              exam={selectedExam}
              onClose={() => setIsComponentsOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Exam Term"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name}? This cannot be undone.`
            : 'Delete this exam term?'
        }
        confirmLabel="Delete Exam Term"
        destructive
        isConfirming={isDeleting}
        onConfirm={() => {
          void confirmDelete();
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
