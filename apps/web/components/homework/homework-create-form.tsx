'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { BookOpen, Calendar, Users, FileText, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/section-card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import { FileUploader } from '@/components/ui/file-uploader';

type HomeworkCreateResult = {
  id?: string;
  recurrenceSeriesId?: string | null;
  items?: Array<{ id: string }>;
};

export function HomeworkCreateForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    academicYearId: '',
    classId: '',
    sectionId: '',
    subjectId: '',
    title: '',
    instructions: '',
    dueAt: '',
    maxScore: 10,
    submissionRequired: true,
    attachmentFileIds: [] as string[],
    saveAsTemplate: false,
    templateName: '',
    recurrenceEnabled: false,
    recurrenceFrequency: 'WEEKLY' as 'DAILY' | 'WEEKLY',
    recurrenceInterval: 1,
    recurrenceOccurrenceCount: 4,
    recurrenceRepeatUntil: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });

  const sectionsQuery = useQuery({
    queryKey: ['sections', formData.classId],
    queryFn: api.listSections,
    enabled: Boolean(formData.classId),
  });

  const subjectsQuery = useQuery({
    queryKey: ['subjects', formData.classId],
    queryFn: () => api.listSubjects({ classId: formData.classId || undefined }),
    enabled: Boolean(formData.classId),
  });

  const createMutation = useMutation({
    mutationFn: async ({ publish }: { publish: boolean }) => {
      const dueDate = new Date(formData.dueAt).toISOString();
      const created = (await api.createHomework({
        academicYearId: formData.academicYearId,
        classId: formData.classId,
        sectionId: formData.sectionId || undefined,
        subjectId: formData.subjectId,
        title: formData.title.trim(),
        instructions: formData.instructions.trim(),
        dueDate,
        dueAt: dueDate,
        maxScore: formData.maxScore,
        submissionRequired: formData.submissionRequired,
        attachmentFileIds: formData.attachmentFileIds,
        saveAsTemplate: formData.saveAsTemplate,
        templateName: formData.saveAsTemplate
          ? formData.templateName.trim() || formData.title.trim()
          : undefined,
        recurrence: formData.recurrenceEnabled
          ? {
              frequency: formData.recurrenceFrequency,
              interval: formData.recurrenceInterval,
              occurrenceCount: formData.recurrenceRepeatUntil
                ? undefined
                : formData.recurrenceOccurrenceCount,
              repeatUntil: formData.recurrenceRepeatUntil
                ? new Date(formData.recurrenceRepeatUntil).toISOString()
                : undefined,
            }
          : undefined,
      })) as HomeworkCreateResult;

      if (publish && created.id) {
        return api.assignHomework(created.id);
      }

      if (publish && created.items?.length) {
        await Promise.all(created.items.map((item) => api.assignHomework(item.id)));
      }

      return created;
    },
    onSuccess: (result: HomeworkCreateResult) => {
      void queryClient.invalidateQueries({ queryKey: ['homework'] });
      const targetId = result.id ?? result.items?.[0]?.id;
      if (targetId) {
        router.push(`/dashboard/homework/${targetId}`);
        return;
      }
      router.push('/dashboard/homework');
    },
    onError: (error: any) => {
      setErrors({ submit: error.message || 'Failed to create homework' });
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.academicYearId) newErrors.academicYearId = 'Academic year is required';
    if (!formData.classId) newErrors.classId = 'Class is required';
    if (!formData.subjectId) newErrors.subjectId = 'Subject is required';
    if (!formData.title) newErrors.title = 'Title is required';
    if (!formData.dueAt) newErrors.dueAt = 'Due date is required';
    if (formData.dueAt && new Date(formData.dueAt) < new Date()) {
      newErrors.dueAt = 'Due date cannot be in the past';
    }
    if (formData.recurrenceEnabled) {
      if (formData.recurrenceInterval < 1 || formData.recurrenceInterval > 12) {
        newErrors.recurrenceInterval = 'Repeat interval must be between 1 and 12';
      }
      if (!formData.recurrenceRepeatUntil) {
        if (
          formData.recurrenceOccurrenceCount < 2 ||
          formData.recurrenceOccurrenceCount > 60
        ) {
          newErrors.recurrenceOccurrenceCount = 'Occurrences must be between 2 and 60';
        }
      }
      if (
        formData.recurrenceRepeatUntil &&
        new Date(formData.recurrenceRepeatUntil) <= new Date(formData.dueAt)
      ) {
        newErrors.recurrenceRepeatUntil = 'Repeat until must be after the first due date';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (publish = false) => {
    if (!validate()) return;

    createMutation.mutate({ publish });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        <SectionCard
          title="Homework Details"
          description="Basic information about the assignment."
        >
          <div className="space-y-4">
            <FormField label="Assignment Title" error={errors.title}>
              <Input
                placeholder="e.g. Weekly Math Quiz Review"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="text-lg font-bold"
              />
            </FormField>
            
            {errors.submit && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold">
                {errors.submit}
              </div>
            )}

            <FormField label="Instructions">
              <Textarea
                placeholder="Provide detailed instructions for the students..."
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                rows={6}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Due Date & Time" error={errors.dueAt}>
                <Input
                  type="datetime-local"
                  value={formData.dueAt}
                  onChange={(e) => setFormData({ ...formData, dueAt: e.target.value })}
                />
              </FormField>
              <FormField label="Maximum Score">
                <Input
                  type="number"
                  value={formData.maxScore}
                  onChange={(e) => setFormData({ ...formData, maxScore: Number(e.target.value) })}
                />
              </FormField>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          description="Upload resources or worksheets for students."
        >
          <FileUploader
            module="homework"
            onUploadComplete={(id) => {
              setFormData(prev => ({
                ...prev,
                attachmentFileIds: [...prev.attachmentFileIds, id]
              }));
            }}
            onRemove={(id) => {
              setFormData(prev => ({
                ...prev,
                attachmentFileIds: prev.attachmentFileIds.filter(fid => fid !== id)
              }));
            }}
          />
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard
          title="Assignment Scope"
          description="Define which students receive this homework."
        >
          <div className="space-y-4">
            <FormField label="Academic Year" error={errors.academicYearId}>
              <Select
                value={formData.academicYearId}
                onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
              >
                <option value="">Select Year</option>
                {academicYearsQuery.data?.map(y => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Class" error={errors.classId}>
              <Select
                value={formData.classId}
                onChange={(e) => setFormData({ ...formData, classId: e.target.value, sectionId: '', subjectId: '' })}
              >
                <option value="">Select Class</option>
                {classesQuery.data?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Section (Optional)">
              <Select
                value={formData.sectionId}
                onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                disabled={!formData.classId}
              >
                <option value="">All Sections</option>
                {sectionsQuery.data?.filter(s => s.classId === formData.classId).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Subject" error={errors.subjectId}>
              <Select
                value={formData.subjectId}
                onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                disabled={!formData.classId}
              >
                <option value="">Select Subject</option>
                {subjectsQuery.data?.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </FormField>
          </div>
        </SectionCard>

        <SectionCard
          title="Submission Settings"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900">Require Submission</span>
                <span className="text-xs text-slate-500">Should students upload work?</span>
              </div>
              <input
                type="checkbox"
                checked={formData.submissionRequired}
                onChange={(e) => setFormData({ ...formData, submissionRequired: e.target.checked })}
                className="h-5 w-5 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary-soft)]"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900">Save as Template</span>
                <span className="text-xs text-slate-500">Make this assignment reusable in the template library.</span>
              </div>
              <input
                type="checkbox"
                checked={formData.saveAsTemplate}
                onChange={(e) => setFormData({ ...formData, saveAsTemplate: e.target.checked })}
                className="h-5 w-5 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary-soft)]"
              />
            </div>

            {formData.saveAsTemplate ? (
              <FormField label="Template Name">
                <Input
                  value={formData.templateName}
                  onChange={(e) => setFormData({ ...formData, templateName: e.target.value })}
                  placeholder="Defaults to assignment title"
                />
              </FormField>
            ) : null}

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-900">Repeat Assignment</span>
                <span className="text-xs text-slate-500">Create a bounded recurring series through the backend recurrence contract.</span>
              </div>
              <input
                type="checkbox"
                checked={formData.recurrenceEnabled}
                onChange={(e) => setFormData({ ...formData, recurrenceEnabled: e.target.checked })}
                className="h-5 w-5 rounded border-slate-300 text-[var(--primary)] focus:ring-[var(--primary-soft)]"
              />
            </div>

            {formData.recurrenceEnabled ? (
              <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Frequency">
                    <Select
                      value={formData.recurrenceFrequency}
                      onChange={(e) => setFormData({
                        ...formData,
                        recurrenceFrequency: e.target.value as 'DAILY' | 'WEEKLY',
                      })}
                    >
                      <option value="WEEKLY">Weekly</option>
                      <option value="DAILY">Daily</option>
                    </Select>
                  </FormField>
                  <FormField label="Repeat Every" error={errors.recurrenceInterval}>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={formData.recurrenceInterval}
                      onChange={(e) => setFormData({
                        ...formData,
                        recurrenceInterval: Number(e.target.value),
                      })}
                    />
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Occurrences" error={errors.recurrenceOccurrenceCount}>
                    <Input
                      type="number"
                      min={2}
                      max={60}
                      value={formData.recurrenceOccurrenceCount}
                      onChange={(e) => setFormData({
                        ...formData,
                        recurrenceOccurrenceCount: Number(e.target.value),
                      })}
                      disabled={Boolean(formData.recurrenceRepeatUntil)}
                    />
                  </FormField>
                  <FormField label="Or Repeat Until" error={errors.recurrenceRepeatUntil}>
                    <Input
                      type="date"
                      value={formData.recurrenceRepeatUntil}
                      onChange={(e) => setFormData({
                        ...formData,
                        recurrenceRepeatUntil: e.target.value,
                      })}
                    />
                  </FormField>
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full rounded-2xl font-bold py-6 text-lg"
            onClick={() => handleSubmit(true)}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Publishing...' : 'Publish Assignment'}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full rounded-2xl font-bold py-6"
            onClick={() => handleSubmit(false)}
            disabled={createMutation.isPending}
          >
            Save as Draft
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="w-full rounded-2xl font-bold"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
