'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AssessmentComponentSummary, ExamTermSummary } from '@schoolos/core';
import { FormField, Input, Select } from '@/components/ui/form-field';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Trash2, Plus } from 'lucide-react';
import { useState } from 'react';

const componentSchema = z.object({
  subjectId: z.string().min(1, 'Subject is required'),
  name: z.string().min(1, 'Component name is required').max(50),
  type: z.enum(['TERMINAL', 'CAS', 'PRACTICAL', 'VIVA', 'PROJECT']),
  maxMarks: z.number().min(0),
  passMarks: z.number().min(0),
  weightPercent: z.number().min(0).max(100),
});

type ComponentFormValues = z.infer<typeof componentSchema>;

interface AssessmentComponentsDialogProps {
  exam: ExamTermSummary;
  onClose: () => void;
}

export function AssessmentComponentsDialog({
  exam,
  onClose,
}: AssessmentComponentsDialogProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.listSubjects(),
  });

  const componentsQuery = useQuery({
    queryKey: ['components', exam.id],
    queryFn: () => api.listComponentsByExamTerm(exam.id),
  });

  const createMutation = useMutation({
    mutationFn: (data: ComponentFormValues) => api.createAssessmentComponent({ ...data, examTermId: exam.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components', exam.id] });
      queryClient.invalidateQueries({ queryKey: ['exam-terms'] });
      reset();
      alert('Component added');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteAssessmentComponent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['components', exam.id] });
      queryClient.invalidateQueries({ queryKey: ['exam-terms'] });
      alert('Component removed');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ComponentFormValues>({
    resolver: zodResolver(componentSchema),
    defaultValues: {
      name: 'Theory',
      type: 'TERMINAL',
      maxMarks: 100,
      passMarks: 40,
      weightPercent: 100,
    },
  });

  const onSubmit = (data: ComponentFormValues) => {
    createMutation.mutate(data);
  };

  const totalWeight = componentsQuery.data?.reduce((acc, c) => acc + Number(c.weightPercent), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-slate-50 p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Weighting</p>
          <p className={`text-xl font-black ${totalWeight > 100 ? 'text-rose-600' : 'text-slate-900'}`}>
            {totalWeight}% / 100%
          </p>
        </div>
        {totalWeight > 100 && (
          <p className="text-xs font-bold text-rose-500">Weighting exceeds 100%!</p>
        )}
      </div>

      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
        {componentsQuery.data?.map((comp) => (
          <div key={comp.id} className="group relative flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 transition-all hover:border-primary-100 hover:shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-tight text-slate-900">{comp.subject?.name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{comp.type}</span>
              </div>
              <p className="text-sm font-bold text-slate-700">{comp.name}</p>
              <div className="mt-1 flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Max: {Number(comp.maxMarks)}</span>
                <span>Pass: {Number(comp.passMarks)}</span>
                <span>Weight: {Number(comp.weightPercent)}%</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm(`Are you sure you want to remove the component "${comp.name}"?`)) {
                  deleteMutation.mutate(comp.id);
                }
              }}
              className="h-8 w-8 p-0 border-none hover:bg-rose-50 hover:text-rose-600 opacity-0 group-hover:opacity-100"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
        {componentsQuery.data?.length === 0 && (
          <p className="py-8 text-center text-sm font-medium text-slate-400">No components added yet.</p>
        )}
      </div>

      <div className="border-t border-slate-100 pt-6">
        <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-900">Add New Component</h4>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
          <FormField label="Subject" error={errors.subjectId?.message}>
            <Select {...register('subjectId')}>
              <option value="">Select Subject</option>
              {subjectsQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Component Name" error={errors.name?.message}>
            <Input {...register('name')} placeholder="e.g. Theory, Practical" />
          </FormField>

          <FormField label="Type" error={errors.type?.message}>
            <Select {...register('type')}>
              <option value="TERMINAL">Terminal</option>
              <option value="CAS">CAS (Internal)</option>
              <option value="PRACTICAL">Practical</option>
              <option value="VIVA">Viva/Oral</option>
              <option value="PROJECT">Project</option>
            </Select>
          </FormField>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Max Marks" error={errors.maxMarks?.message}>
              <Input type="number" {...register('maxMarks', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Pass Marks" error={errors.passMarks?.message}>
              <Input type="number" {...register('passMarks', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Weight %" error={errors.weightPercent?.message}>
              <Input type="number" {...register('weightPercent', { valueAsNumber: true })} />
            </FormField>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" isLoading={createMutation.isPending}>
              <Plus size={16} className="mr-2" />
              Add Component
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
