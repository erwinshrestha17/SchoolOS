'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Info } from 'lucide-react';
import { formatBsDate } from '@schoolos/core';
import { api } from '@/lib/api';
import type { HomeworkPublishNotifyChoice } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/section-card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FileUploader } from '@/components/ui/file-uploader';

type HomeworkCreateResult = {
  id?: string;
  recurrenceSeriesId?: string | null;
  items?: Array<{ id: string }>;
};

const SUBMISSION_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'PHYSICAL_NOTEBOOK', label: 'Physical notebook' },
  { value: 'CLASSWORK_COPY', label: 'Classwork copy' },
  { value: 'PROJECT_FILE', label: 'Project/file' },
  { value: 'ORAL_PREPARATION', label: 'Oral preparation' },
  { value: 'MEMORIZATION', label: 'Memorization' },
  { value: 'ONLINE_ATTACHMENT', label: 'Online attachment' },
  { value: 'NO_SUBMISSION_REQUIRED', label: 'No submission required' },
];

const NOTIFY_OPTIONS: { value: HomeworkPublishNotifyChoice; label: string; description: string }[] = [
  { value: 'NOTIFY_NOW', label: 'Notify parents now', description: 'Send through the usual parent channels (SMS/app/push).' },
  { value: 'IN_APP_ONLY', label: 'In-app notification only', description: 'Skip SMS/push, show only inside the parent app.' },
  { value: 'DO_NOT_SEND', label: 'Do not send a notification', description: 'Publish without notifying parents.' },
];

function todayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

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
    assignedDate: todayDateInputValue(),
    dueDate: '',
    chapter: '',
    description: '',
    parentInstructions: '',
    submissionMethod: 'PHYSICAL_NOTEBOOK',
    maxScore: 10,
    attachmentFileIds: [] as string[],
    notify: 'NOTIFY_NOW' as HomeworkPublishNotifyChoice,
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

  // Default to the current academic year once the list loads, so most
  // teachers never have to touch this field.
  useEffect(() => {
    if (!formData.academicYearId && academicYearsQuery.data?.length) {
      const current = academicYearsQuery.data.find((y) => y.isCurrent) ?? academicYearsQuery.data[0];
      if (current) {
        setFormData((prev) => (prev.academicYearId ? prev : { ...prev, academicYearId: current.id }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYearsQuery.data]);

  const workloadQuery = useQuery({
    queryKey: ['homework-workload', formData.classId, formData.sectionId, formData.dueDate],
    queryFn: () =>
      api.getHomeworkWorkload({
        classId: formData.classId,
        sectionId: formData.sectionId || undefined,
        date: new Date(formData.dueDate).toISOString(),
      }),
    enabled: Boolean(formData.classId && formData.dueDate),
  });

  const selectedClassName = classesQuery.data?.find((c) => c.id === formData.classId)?.name;
  const selectedSectionName = sectionsQuery.data?.find((s) => s.id === formData.sectionId)?.name;
  const workloadScopeLabel = [selectedClassName, selectedSectionName].filter(Boolean).join(' - ') || 'This class';
  const workloadDateLabel = formData.dueDate ? formatBsDate(formData.dueDate) : '';

  const createMutation = useMutation({
    mutationFn: async ({ publish }: { publish: boolean }) => {
      const dueDateIso = new Date(formData.dueDate).toISOString();
      const assignedDateIso = formData.assignedDate
        ? new Date(formData.assignedDate).toISOString()
        : undefined;

      const created = (await api.createHomework({
        academicYearId: formData.academicYearId,
        classId: formData.classId,
        sectionId: formData.sectionId || undefined,
        subjectId: formData.subjectId,
        title: formData.title.trim(),
        instructions: formData.instructions.trim(),
        description: formData.description.trim() || undefined,
        parentInstructions: formData.parentInstructions.trim() || undefined,
        submissionMethod: formData.submissionMethod,
        submissionRequired: formData.submissionMethod !== 'NO_SUBMISSION_REQUIRED',
        assignedDate: assignedDateIso,
        dueDate: dueDateIso,
        dueAt: dueDateIso,
        maxScore: formData.maxScore,
        attachmentFileIds: formData.attachmentFileIds,
        // No dedicated backend field for chapter/lesson yet - carried in the
        // same generic JSON metadata bag already used for template bookkeeping.
        attachmentMetadata: formData.chapter.trim() ? { chapter: formData.chapter.trim() } : undefined,
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
        return api.assignHomework(created.id, formData.notify);
      }

      if (publish && created.items?.length) {
        await Promise.all(created.items.map((item) => api.assignHomework(item.id, formData.notify)));
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
    if (!formData.academicYearId) newErrors.academicYearId = 'Select an academic year';
    if (!formData.classId) newErrors.classId = 'Select a class';
    if (!formData.subjectId) newErrors.subjectId = 'Select a subject';
    if (!formData.title.trim()) newErrors.title = 'Enter a homework title';
    if (!formData.instructions.trim()) newErrors.instructions = 'Homework instructions are required';
    if (!formData.dueDate) newErrors.dueDate = 'Select a due date';
    if (formData.dueDate) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      if (new Date(formData.dueDate) < startOfToday) {
        newErrors.dueDate = 'Due date cannot be in the past';
      }
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
        formData.dueDate &&
        new Date(formData.recurrenceRepeatUntil) <= new Date(formData.dueDate)
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
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionCard
        title="Give homework"
        description="Fill in the required details below - everything else is optional."
      >
        <div className="space-y-4">
          {errors.submit && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold">
              {errors.submit}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Academic Year" error={errors.academicYearId}>
              <Select
                value={formData.academicYearId}
                onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
              >
                <option value="">Select Year</option>
                {academicYearsQuery.data?.map((y) => (
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
                {classesQuery.data?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Section">
              <Select
                value={formData.sectionId}
                onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                disabled={!formData.classId}
              >
                <option value="">All Sections</option>
                {sectionsQuery.data?.filter((s) => s.classId === formData.classId).map((s) => (
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
                {subjectsQuery.data?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField label="Homework Title" error={errors.title}>
            <Input
              placeholder="e.g. Weekly Math Quiz Review"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="text-base font-bold"
              maxLength={160}
            />
          </FormField>

          <FormField label="Instructions" error={errors.instructions}>
            <Textarea
              placeholder="What should students do? (English, Nepali, or mixed script - type naturally)"
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              rows={4}
              maxLength={5000}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Assigned Date">
              <Input
                type="date"
                value={formData.assignedDate}
                onChange={(e) => setFormData({ ...formData, assignedDate: e.target.value })}
              />
            </FormField>
            <FormField label="Due Date" error={errors.dueDate}>
              <Input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </FormField>
          </div>

          {workloadQuery.data && workloadQuery.data.level === 'HEAVY' && (
            <div className="flex items-start gap-3 rounded-2xl border border-warning-100 bg-warning-50 p-4 text-sm font-medium text-warning-800">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              <div>
                <p className="font-bold">Homework load may be heavy</p>
                <p className="mt-0.5 opacity-90">
                  {workloadScopeLabel} already has {workloadQuery.data.count} homework assignment
                  {workloadQuery.data.count === 1 ? '' : 's'} due {workloadDateLabel || 'that date'}. You can still assign this one.
                </p>
              </div>
            </div>
          )}
          {workloadQuery.data && workloadQuery.data.level === 'NORMAL' && (
            <div className="flex items-start gap-3 rounded-2xl border border-info-100 bg-info-50 p-4 text-sm font-medium text-info-800">
              <Info className="mt-0.5 shrink-0" size={18} />
              <p className="opacity-90">
                {workloadScopeLabel} already has {workloadQuery.data.count} other homework assignment
                {workloadQuery.data.count === 1 ? '' : 's'} due {workloadDateLabel || 'that date'}.
              </p>
            </div>
          )}
        </div>
      </SectionCard>

      <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-950">
          More options
          <span className="ml-2 text-xs font-semibold text-slate-500">Chapter, attachment, teacher note, submission method, parent instructions</span>
        </summary>
        <div className="space-y-4 border-t border-slate-100 p-5">
          <FormField label="Chapter / Lesson" description="Short reference, e.g. 'Chapter 4: Fractions'">
            <Input
              placeholder="e.g. Chapter 4: Fractions"
              value={formData.chapter}
              onChange={(e) => setFormData({ ...formData, chapter: e.target.value })}
              maxLength={160}
            />
          </FormField>

          <FormField label="Teacher Note" description="Private note for your own reference - not shown as the main instructions.">
            <Textarea
              placeholder="Optional note to yourself or other staff..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              maxLength={1000}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Submission Method">
              <Select
                value={formData.submissionMethod}
                onChange={(e) => setFormData({ ...formData, submissionMethod: e.target.value })}
              >
                {SUBMISSION_METHOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Maximum Score">
              <Input
                type="number"
                min={0}
                value={formData.maxScore}
                onChange={(e) => setFormData({ ...formData, maxScore: Number(e.target.value) })}
              />
            </FormField>
          </div>

          <FormField label="Instruction for Parents" description='e.g. "Please help the child revise multiplication tables from 2 to 10."'>
            <Textarea
              placeholder="Optional message shown to parents alongside the homework..."
              value={formData.parentInstructions}
              onChange={(e) => setFormData({ ...formData, parentInstructions: e.target.value })}
              rows={3}
              maxLength={1000}
            />
          </FormField>

          <FormField label="Attachment" description="Upload a worksheet, image, or reference file if needed.">
            <FileUploader
              module="homework"
              onUploadComplete={(id) => {
                setFormData((prev) => ({
                  ...prev,
                  attachmentFileIds: [...prev.attachmentFileIds, id],
                }));
              }}
              onRemove={(id) => {
                setFormData((prev) => ({
                  ...prev,
                  attachmentFileIds: prev.attachmentFileIds.filter((fid) => fid !== id),
                }));
              }}
            />
          </FormField>
        </div>
      </details>

      <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-950">
          Advanced: repeat &amp; save as template
        </summary>
        <div className="space-y-4 border-t border-slate-100 p-5">
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
      </details>

      <SectionCard title="Notify parents" description="Applies when you publish immediately below.">
        <div className="grid gap-3 sm:grid-cols-3">
          {NOTIFY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer flex-col gap-1 rounded-2xl border p-4 transition-colors ${
                formData.notify === opt.value
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <input
                  type="radio"
                  name="notify"
                  value={opt.value}
                  checked={formData.notify === opt.value}
                  onChange={() => setFormData({ ...formData, notify: opt.value })}
                  className="h-4 w-4 text-[var(--primary)] focus:ring-[var(--primary-soft)]"
                />
                {opt.label}
              </span>
              <span className="text-xs text-slate-500">{opt.description}</span>
            </label>
          ))}
        </div>
      </SectionCard>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          className="w-full rounded-2xl font-bold py-6 text-lg sm:flex-1"
          onClick={() => handleSubmit(true)}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Publishing...' : 'Publish Assignment'}
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full rounded-2xl font-bold py-6 sm:flex-1"
          onClick={() => handleSubmit(false)}
          disabled={createMutation.isPending}
        >
          Save as Draft
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="w-full rounded-2xl font-bold sm:w-auto"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
