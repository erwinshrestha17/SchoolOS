'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DataTable } from '@/components/ui/data-table';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SubjectWeeklyRequirementSummary } from '@schoolos/core';

type RequirementFormState = {
  academicYearId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  requiredPeriodsPerWeek: string;
};

const emptyForm: RequirementFormState = {
  academicYearId: '',
  classId: '',
  sectionId: '',
  subjectId: '',
  requiredPeriodsPerWeek: '',
};

export function WeeklyRequirementsList({ filters }: { filters: any }) {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<RequirementFormState>(emptyForm);
  const [editingRequirement, setEditingRequirement] = useState<SubjectWeeklyRequirementSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubjectWeeklyRequirementSummary | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const requirementsQuery = useQuery({
    queryKey: ['timetable-requirements', filters.academicYearId, filters.classId],
    queryFn: () => api.listSubjectWeeklyRequirements({ 
      academicYearId: filters.academicYearId || undefined,
      classId: filters.classId || undefined 
    }),
    enabled: Boolean(filters.academicYearId),
  });

  const timetableQuery = useQuery({
    queryKey: ['timetable', filters.classId],
    queryFn: () => api.listTimetable({ classId: filters.classId || undefined }),
    enabled: Boolean(filters.classId),
  });

  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
  });

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });

  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: api.listSections,
  });

  const subjectsQuery = useQuery({
    queryKey: ['subjects', formState.classId],
    queryFn: () => api.listSubjects({ classId: formState.classId || undefined }),
    enabled: Boolean(formState.classId),
  });

  const invalidateRequirements = () => {
    queryClient.invalidateQueries({ queryKey: ['timetable-requirements'] });
    queryClient.invalidateQueries({ queryKey: ['timetable-validation-summary'] });
  };

  const createMutation = useMutation({
    mutationFn: (body: {
      academicYearId: string;
      classId: string;
      sectionId?: string;
      subjectId: string;
      requiredPeriodsPerWeek: number;
    }) => api.createSubjectWeeklyRequirement(body),
    onSuccess: () => {
      invalidateRequirements();
      closeForm();
    },
    onError: (error: Error) => setFormError(error.message || 'Requirement could not be created.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, requiredPeriodsPerWeek }: { id: string; requiredPeriodsPerWeek: number }) =>
      api.updateSubjectWeeklyRequirement(id, { requiredPeriodsPerWeek }),
    onSuccess: () => {
      invalidateRequirements();
      closeForm();
    },
    onError: (error: Error) => setFormError(error.message || 'Requirement could not be updated.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteSubjectWeeklyRequirement(id),
    onSuccess: () => {
      invalidateRequirements();
      setDeleteTarget(null);
    },
  });

  const closeForm = () => {
    setEditingRequirement(null);
    setFormState(emptyForm);
    setFormError(null);
  };

  const openCreateForm = () => {
    setEditingRequirement(null);
    setFormState({
      ...emptyForm,
      academicYearId: filters.academicYearId || '',
      classId: filters.classId || '',
      sectionId: filters.sectionId || '',
    });
    setFormError(null);
  };

  const openEditForm = (requirement: SubjectWeeklyRequirementSummary) => {
    setEditingRequirement(requirement);
    setFormState({
      academicYearId: requirement.academicYearId,
      classId: requirement.classId,
      sectionId: requirement.sectionId ?? '',
      subjectId: requirement.subjectId,
      requiredPeriodsPerWeek: String(requirement.requiredPeriodsPerWeek),
    });
    setFormError(null);
  };

  const handleSubmit = () => {
    setFormError(null);
    const requiredPeriodsPerWeek = Number.parseInt(formState.requiredPeriodsPerWeek, 10);

    if (!formState.academicYearId || !formState.classId || !formState.subjectId) {
      setFormError('Academic year, class, and subject are required.');
      return;
    }

    if (!Number.isInteger(requiredPeriodsPerWeek) || requiredPeriodsPerWeek < 1) {
      setFormError('Required periods must be at least 1.');
      return;
    }

    if (editingRequirement) {
      updateMutation.mutate({ id: editingRequirement.id, requiredPeriodsPerWeek });
      return;
    }

    createMutation.mutate({
      academicYearId: formState.academicYearId,
      classId: formState.classId,
      sectionId: formState.sectionId || undefined,
      subjectId: formState.subjectId,
      requiredPeriodsPerWeek,
    });
  };

  if (!filters.academicYearId) {
    return <EmptyState title="Select academic year" description="Please select an academic year to view requirements." />;
  }

  if (requirementsQuery.isLoading) return <LoadingState />;

  const getAssignedCount = (subjectId: string, sectionId: string | null) => {
    return timetableQuery.data?.filter(slot => 
      slot.subjectId === subjectId && 
      (!sectionId || slot.sectionId === sectionId)
    ).length ?? 0;
  };

  const filteredSections = (sectionsQuery.data ?? []).filter((section) => section.classId === formState.classId);
  const formOpen = Boolean(formState.academicYearId || editingRequirement);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const columns = [
    {
      header: 'Subject',
      accessorKey: 'subject.name',
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{row.subject?.name?.trim() || 'Subject not set'}</span>
          <span className="text-xs text-slate-500">{row.subject?.code?.trim() || 'Subject code not set'}</span>
        </div>
      ),
    },
    {
      header: 'Class / Section',
      accessorKey: 'class.name',
      cell: (row: any) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-700">{row.class?.name?.trim() || 'Class not set'}</span>
          <span className="text-xs text-slate-500">{row.section?.name?.trim() || 'All sections'}</span>
        </div>
      ),
    },
    {
      header: 'Required Periods',
      accessorKey: 'requiredPeriodsPerWeek',
      cell: (row: any) => (
        <Badge variant="outline" className="font-bold">{row.requiredPeriodsPerWeek} / week</Badge>
      ),
    },
    {
      header: 'Assigned',
      id: 'assigned',
      cell: (row: any) => {
        const assigned = getAssignedCount(row.subjectId, row.sectionId);
        const required = row.requiredPeriodsPerWeek;
        const diff = assigned - required;
        
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{assigned}</span>
            {diff < 0 ? (
              <Badge variant="destructive" className="text-[10px]">-{Math.abs(diff)} missing</Badge>
            ) : diff > 0 ? (
              <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700">+{diff} excess</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700">Completed</Badge>
            )}
          </div>
        );
      },
    },
    {
      header: 'Actions',
      id: 'actions',
      className: 'text-right',
      cell: (row: SubjectWeeklyRequirementSummary) => (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-xl"
            onClick={() => openEditForm(row)}
            aria-label="Edit weekly requirement"
          >
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-xl border-rose-100 text-rose-600 hover:border-rose-200 hover:bg-rose-50"
            onClick={() => setDeleteTarget(row)}
            aria-label="Delete weekly requirement"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex flex-col">
          <h2 className="text-lg font-black uppercase italic tracking-tight text-slate-900">Subject Weekly Requirements</h2>
          <p className="text-sm text-slate-500 font-medium">Ensure every subject has the required number of periods scheduled.</p>
        </div>
        <Button
          className="rounded-xl bg-[var(--color-mod-homework-accent)] font-bold text-white hover:bg-[var(--color-mod-homework-text)]"
          onClick={openCreateForm}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Requirement
        </Button>
      </div>

      {requirementsQuery.data?.length === 0 ? (
        <EmptyState 
          title="No requirements set" 
          description="Define how many periods each subject needs per week."
          action={<Button variant="outline" className="rounded-xl" onClick={openCreateForm}>Add First Requirement</Button>}
        />
      ) : (
        <DataTable columns={columns} data={requirementsQuery.data || []} getRowKey={(row) => row.id} />
      )}

      <Dialog open={formOpen} onOpenChange={closeForm}>
        <DialogContent className="max-w-xl rounded-2xl border border-slate-200 shadow-sm">
          <DialogHeader>
            <DialogTitle>
              {editingRequirement ? 'Update Weekly Requirement' : 'Add Weekly Requirement'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 p-6">
            {formError && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                {formError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Academic year">
                <Select
                  value={formState.academicYearId}
                  onChange={(event) => setFormState((current) => ({ ...current, academicYearId: event.target.value }))}
                  disabled={Boolean(editingRequirement)}
                >
                  <option value="">Select academic year</option>
                  {academicYearsQuery.data?.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Class">
                <Select
                  value={formState.classId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      classId: event.target.value,
                      sectionId: '',
                      subjectId: '',
                    }))
                  }
                  disabled={Boolean(editingRequirement)}
                >
                  <option value="">Select class</option>
                  {classesQuery.data?.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {schoolClass.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Section">
                <Select
                  value={formState.sectionId}
                  onChange={(event) => setFormState((current) => ({ ...current, sectionId: event.target.value }))}
                  disabled={Boolean(editingRequirement) || !formState.classId}
                >
                  <option value="">All sections</option>
                  {filteredSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Subject">
                <Select
                  value={formState.subjectId}
                  onChange={(event) => setFormState((current) => ({ ...current, subjectId: event.target.value }))}
                  disabled={Boolean(editingRequirement) || !formState.classId || subjectsQuery.isLoading}
                >
                  <option value="">Select subject</option>
                  {subjectsQuery.data?.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField label="Required periods per week">
              <Input
                type="number"
                min={1}
                step={1}
                value={formState.requiredPeriodsPerWeek}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    requiredPeriodsPerWeek: event.target.value,
                  }))
                }
                placeholder="Enter weekly period count"
                className="rounded-xl"
              />
            </FormField>
          </div>

          <DialogFooter className="gap-3">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-[var(--color-mod-homework-accent)] text-white hover:bg-[var(--color-mod-homework-text)]"
              onClick={handleSubmit}
              isLoading={isSaving}
            >
              {editingRequirement ? 'Save Requirement' : 'Create Requirement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-md rounded-2xl border border-slate-200 shadow-sm">
          <DialogHeader>
            <DialogTitle>Delete Weekly Requirement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 p-6">
            <p className="text-sm leading-6 text-slate-600">
              Remove the requirement for{' '}
              <span className="font-bold text-slate-900">
                {deleteTarget?.subject?.name?.trim() || 'Subject not set'}
              </span>
              . Validation will no longer check this weekly period target.
            </p>
            {deleteMutation.error && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                {deleteMutation.error.message || 'Requirement could not be deleted.'}
              </div>
            )}
          </div>
          <DialogFooter className="gap-3">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              isLoading={deleteMutation.isPending}
            >
              Delete Requirement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
