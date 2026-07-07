'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import {
  BookOpen,
  UserPlus,
  Plus,
  CheckCircle2,
  AlertCircle,
  Users,
  Filter,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormField, Input, Select } from '@/components/ui/form-field';
import { Button } from '@/components/ui/button';

import {
  AcademicYearSummary,
  ClassSummary,
  SectionSummary,
  StaffSummary,
  SubjectSummary,
  TeacherAssignmentSummary,
} from '@schoolos/core';

type Props = {
  academicYears: AcademicYearSummary[];
  classes: ClassSummary[];
  allSections: SectionSummary[];
  staff: StaffSummary[];
  subjects: SubjectSummary[];
  assignments: TeacherAssignmentSummary[];
};

export function SubjectsTab({ academicYears, classes, allSections, staff, subjects }: Props) {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState({ classId: '', code: '', name: '', type: 'CORE', theoryMarks: 100, passMarks: 35 });
  const [assign, setAssign] = useState({ academicYearId: '', classId: '', subjectId: '', staffId: '', sectionId: '' });
  const [rosterClassId, setRosterClassId] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['subjects'] });
    void queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const subjectMut = useMutation({
    mutationFn: api.createSubject,
    onSuccess: () => {
      invalidate();
      setSubject({ classId: '', code: '', name: '', type: 'CORE', theoryMarks: 100, passMarks: 35 });
      showSuccess('Subject created successfully.');
    },
  });

  const assignMut = useMutation({
    mutationFn: api.createTeacherAssignment,
    onSuccess: () => {
      invalidate();
      showSuccess('Teacher assigned successfully.');
      setAssign((c) => ({ ...c, staffId: '' }));
    },
  });

  const sectionsForClass = useMemo(
    () => allSections.filter((s: SectionSummary) => s.classId === assign.classId),
    [allSections, assign.classId],
  );
  const subjectsForAssignClass = useMemo(
    () => subjects.filter((s) => s.classId === assign.classId),
    [subjects, assign.classId],
  );
  const selectedSubject = subjects.find((s) => s.id === assign.subjectId);
  const currentYear = academicYears.find((y: AcademicYearSummary) => y.isCurrent) ?? academicYears[0];
  const rosterSubjects = rosterClassId ? subjects.filter((s) => s.classId === rosterClassId) : subjects;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight text-slate-900">Academic Catalog</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Subjects and instructional assignments.</p>
        </div>
        {successMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
            <CheckCircle2 size={16} />
            {successMessage}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* New Subject */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-mod-academics-bg)] text-[var(--color-mod-academics-accent)]">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">New Subject</h3>
              <p className="text-sm text-slate-500">Add a subject to a grade&apos;s curriculum.</p>
            </div>
          </div>

          <div className="space-y-4">
            <FormField label="Grade Level">
              <Select value={subject.classId} onChange={(e) => setSubject((c) => ({ ...c, classId: e.target.value }))}>
                <option value="">Select a class first</option>
                {classes.map((c: ClassSummary) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Subject Code">
                <Input
                  value={subject.code}
                  onChange={(e) => setSubject((c) => ({ ...c, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. ENG-101"
                />
              </FormField>
              <FormField label="Subject Name">
                <Input
                  value={subject.name}
                  onChange={(e) => setSubject((c) => ({ ...c, name: e.target.value }))}
                  placeholder="e.g. English"
                />
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Type">
                <Select value={subject.type} onChange={(e) => setSubject((c) => ({ ...c, type: e.target.value }))}>
                  <option value="CORE">Core</option>
                  <option value="ELECTIVE">Elective</option>
                  <option value="OPTIONAL">Optional</option>
                </Select>
              </FormField>
              <FormField label="Theory Marks">
                <Input
                  type="number"
                  value={subject.theoryMarks}
                  onChange={(e) => setSubject((c) => ({ ...c, theoryMarks: Number(e.target.value) }))}
                />
              </FormField>
              <FormField label="Pass Marks">
                <Input
                  type="number"
                  value={subject.passMarks}
                  onChange={(e) => setSubject((c) => ({ ...c, passMarks: Number(e.target.value) }))}
                />
              </FormField>
            </div>

            <Button
              className="w-full"
              onClick={() => subjectMut.mutate(subject)}
              disabled={!subject.classId || !subject.code || !subject.name || subjectMut.isPending}
              isLoading={subjectMut.isPending}
            >
              <Plus size={18} className="mr-1.5" />
              Register Subject
            </Button>
            {subjectMut.isError && (
              <p className="flex items-center gap-1 text-xs font-bold text-red-600">
                <AlertCircle size={12} /> {(subjectMut.error as Error).message}
              </p>
            )}
          </div>
        </section>

        {/* Faculty Assignment */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-mod-academics-bg)] text-[var(--color-mod-academics-accent)]">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Faculty Assignment</h3>
              <p className="text-sm text-slate-500">Assign a teacher to a class&apos;s subject.</p>
            </div>
          </div>

          <div className="space-y-4">
            <FormField label="Academic Year">
              <Select
                value={assign.academicYearId || currentYear?.id || ''}
                onChange={(e) => setAssign((c) => ({ ...c, academicYearId: e.target.value }))}
              >
                {academicYears.map((y: AcademicYearSummary) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Class">
              <Select
                value={assign.classId}
                onChange={(e) => setAssign((c) => ({ ...c, classId: e.target.value, subjectId: '', sectionId: '' }))}
              >
                <option value="">Select a class first</option>
                {classes.map((c: ClassSummary) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField
              label="Subject"
              description={!assign.classId ? 'Choose a class above to see its subjects.' : undefined}
            >
              <Select
                value={assign.subjectId}
                disabled={!assign.classId}
                onChange={(e) => setAssign((c) => ({ ...c, subjectId: e.target.value }))}
              >
                <option value="">{assign.classId ? 'Select subject' : 'Select a class first'}</option>
                {subjectsForAssignClass.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                ))}
              </Select>
            </FormField>

            {selectedSubject && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Currently assigned</p>
                {(selectedSubject.teacherAssignments?.length ?? 0) > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {selectedSubject.teacherAssignments!.map((a: TeacherAssignmentSummary) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700"
                      >
                        <Users size={12} className="text-slate-400" />
                        {a.staff?.firstName} {a.staff?.lastName}
                        {!a.sectionId && ' · entire grade'}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-slate-400">No teacher assigned yet.</p>
                )}
              </div>
            )}

            <FormField label="Section" description="Leave unset to assign across the entire grade level.">
              <Select
                value={assign.sectionId}
                disabled={!assign.classId}
                onChange={(e) => setAssign((c) => ({ ...c, sectionId: e.target.value }))}
              >
                <option value="">Entire grade level</option>
                {sectionsForClass.map((s: SectionSummary) => (
                  <option key={s.id} value={s.id}>Section {s.name}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Faculty">
              <Select value={assign.staffId} onChange={(e) => setAssign((c) => ({ ...c, staffId: e.target.value }))}>
                <option value="">Select faculty</option>
                {staff.map((s: StaffSummary) => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                ))}
              </Select>
            </FormField>

            <Button
              className="w-full"
              onClick={() => assignMut.mutate({ ...assign, academicYearId: assign.academicYearId || currentYear?.id, sectionId: assign.sectionId || null })}
              disabled={!assign.subjectId || !assign.staffId || assignMut.isPending}
              isLoading={assignMut.isPending}
            >
              <Zap size={18} className="mr-1.5" />
              Activate Assignment
            </Button>
            {assignMut.isError && (
              <p className="flex items-center gap-1 text-xs font-bold text-red-600">
                <AlertCircle size={12} /> {(assignMut.error as Error).message}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Curriculum Roster */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Curriculum Roster</h3>
            <p className="text-sm text-slate-500">{rosterSubjects.length} of {subjects.length} subjects</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <Select value={rosterClassId} onChange={(e) => setRosterClassId(e.target.value)} className="h-10 w-48">
              <option value="">All classes</option>
              {classes.map((c: ClassSummary) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {rosterSubjects.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400">
              <BookOpen className="mx-auto mb-3 h-10 w-10 opacity-20" />
              <p className="text-sm font-bold">
                {rosterClassId ? 'No subjects for this class yet.' : 'No subjects in the catalog yet.'}
              </p>
            </div>
          ) : (
            rosterSubjects.map((s: SubjectSummary) => (
              <div
                key={s.id}
                className="rounded-xl border border-slate-100 p-5 transition hover:border-[var(--color-mod-academics-border)] hover:shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{s.class?.name ?? 'General'}</p>
                    <h4 className="text-sm font-bold text-slate-900">{s.code} — {s.name}</h4>
                  </div>
                  <span className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-600">{s.theoryMarks}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                      s.type === 'CORE'
                        ? 'border-[var(--color-mod-academics-border)] bg-[var(--color-mod-academics-bg)] text-[var(--color-mod-academics-text)]'
                        : 'border-slate-200 bg-slate-50 text-slate-500',
                    )}
                  >
                    {s.type}
                  </span>
                  {s.passMarks && (
                    <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                      Pass {s.passMarks}
                    </span>
                  )}
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Faculty</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(s.teacherAssignments?.length ?? 0) > 0 ? (
                      s.teacherAssignments!.map((a: TeacherAssignmentSummary) => (
                        <span
                          key={a.id}
                          className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600"
                        >
                          {a.staff?.firstName} {a.staff?.lastName}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs font-medium italic text-slate-300">No faculty assigned</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
