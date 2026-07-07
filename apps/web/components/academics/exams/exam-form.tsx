'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AcademicYearSummary, ExamTermSummary } from '@schoolos/core';
import { FormField, Input, Select } from '@/components/ui/form-field';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

const examSchema = z.object({
  academicYearId: z.string().min(1, 'Academic year is required'),
  name: z.string().min(1, 'Exam name is required').max(50),
  startsOn: z.string().min(1, 'Start date is required'),
  endsOn: z.string().min(1, 'End date is required'),
  weightPercent: z.number().min(0).max(100),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']),
});

type ExamFormValues = z.infer<typeof examSchema>;

interface ExamFormProps {
  initialData?: Partial<ExamTermSummary>;
  academicYears: AcademicYearSummary[];
  onSubmit: (data: ExamFormValues) => void;
  isLoading?: boolean;
  onCancel: () => void;
}

export function ExamForm({
  initialData,
  academicYears,
  onSubmit,
  isLoading,
  onCancel,
}: ExamFormProps) {
  const currentYear = academicYears.find((y) => y.isCurrent);
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ExamFormValues>({
    resolver: zodResolver(examSchema),
    defaultValues: {
      academicYearId: initialData?.academicYearId || currentYear?.id || '',
      name: initialData?.name || '',
      startsOn: initialData?.startsOn ? new Date(initialData.startsOn).toISOString().split('T')[0] : '',
      endsOn: initialData?.endsOn ? new Date(initialData.endsOn).toISOString().split('T')[0] : '',
      weightPercent: initialData?.weightPercent ? Number(initialData.weightPercent) : 100,
      status: (initialData?.status as any) || 'ACTIVE',
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        academicYearId: initialData.academicYearId,
        name: initialData.name,
        startsOn: initialData.startsOn ? new Date(initialData.startsOn).toISOString().split('T')[0] : '',
        endsOn: initialData.endsOn ? new Date(initialData.endsOn).toISOString().split('T')[0] : '',
        weightPercent: Number(initialData.weightPercent),
        status: (initialData.status as any) || 'ACTIVE',
      });
    }
  }, [initialData, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <FormField label="Academic Year" error={errors.academicYearId?.message}>
          <Select {...register('academicYearId')}>
            <option value="">Select Year</option>
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Exam Name" error={errors.name?.message}>
          <Input {...register('name')} placeholder="e.g. First Terminal Examination" />
        </FormField>

        <FormField label="Start Date" error={errors.startsOn?.message}>
          <Input
            type="date"
            className="[color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-60"
            {...register('startsOn')}
          />
        </FormField>

        <FormField label="End Date" error={errors.endsOn?.message}>
          <Input
            type="date"
            className="[color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-60"
            {...register('endsOn')}
          />
        </FormField>

        <FormField label="Weighting (%)" error={errors.weightPercent?.message} description="Influence of this exam on final grade">
          <Input type="number" {...register('weightPercent', { valueAsNumber: true })} />
        </FormField>

        <FormField label="Status" error={errors.status?.message}>
          <Select {...register('status')}>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </FormField>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {initialData?.id ? 'Update Exam Term' : 'Create Exam Term'}
        </Button>
      </div>
    </form>
  );
}
