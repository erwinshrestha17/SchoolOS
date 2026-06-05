'use client';

import { ExamTermSummary } from '@schoolos/core';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Calendar, Lock, Unlock, MoreVertical, Edit2, Trash2, ListChecks } from 'lucide-react';
import { ActionMenu } from '@/components/ui/action-menu';

interface ExamListProps {
  exams: ExamTermSummary[];
  isLoading: boolean;
  onEdit: (exam: ExamTermSummary) => void;
  onDelete: (exam: ExamTermSummary) => void;
  onManageComponents: (exam: ExamTermSummary) => void;
}

export function ExamList({
  exams,
  isLoading,
  onEdit,
  onDelete,
  onManageComponents,
}: ExamListProps) {
  const columns = [
    {
      header: 'Exam Term',
      accessorKey: 'name',
      cell: (exam: ExamTermSummary) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{exam.name}</span>
          <span className="text-xs text-slate-500">{(exam as any).academicYear?.name}</span>
        </div>
      ),
    },
    {
      header: 'Duration',
      cell: (exam: ExamTermSummary) => (
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Calendar size={12} />
          <span>
            {new Date(exam.startsOn).toLocaleDateString()} -{' '}
            {new Date(exam.endsOn).toLocaleDateString()}
          </span>
        </div>
      ),
    },
    {
      header: 'Weighting',
      cell: (exam: ExamTermSummary) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-[var(--color-mod-academics-accent)]"
              style={{ width: `${exam.weightPercent}%` }}
            />
          </div>
          <span className="text-xs font-bold text-slate-700">
            {Number(exam.weightPercent)}%
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (exam: ExamTermSummary) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={exam.status} />
          {exam.isLocked && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Lock size={12} />
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Components',
      cell: (exam: ExamTermSummary) => (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
          {(exam.components?.length ?? 0)} Components
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      className: 'w-16',
      cell: (exam: ExamTermSummary) => (
        <ActionMenu
          trigger={
            <button 
              className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-slate-100"
              aria-label="Open actions menu"
            >
              <MoreVertical size={16} className="text-slate-500" />
            </button>
          }
          items={[
            {
              label: 'Manage Components',
              icon: <ListChecks size={16} />,
              onClick: () => onManageComponents(exam),
            },
            {
              label: 'Edit',
              icon: <Edit2 size={16} />,
              onClick: () => onEdit(exam),
            },
            {
              label: 'Delete',
              icon: <Trash2 size={16} />,
              variant: 'danger',
              onClick: () => onDelete(exam),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={exams}
      isLoading={isLoading}
      emptyTitle="No exams found"
      emptyMessage="Start by creating your first exam term for this academic year."
    />
  );
}
