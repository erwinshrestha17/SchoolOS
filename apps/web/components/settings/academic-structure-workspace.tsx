'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  CircleAlert,
  GraduationCap,
  Plus,
  School,
  UserRound,
} from 'lucide-react';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { ErrorState } from '../ui/error-state';
import { RemoteStaffSelector } from '../staff/remote-staff-selector';
import { api } from '../../lib/api';
import { useSettingsCapabilities } from '../../lib/permissions-ui';
import {
  SchoolSettingsPageHeader,
  SettingsPermissionNotice,
} from './settings-page-header';

// Streams (Science, Management, ...) apply to Higher Secondary classes only.
// Matches the backend's HIGHER_SECONDARY_MIN_LEVEL in classes.service.ts.
const HIGHER_SECONDARY_MIN_LEVEL = 11;

type ClassDraft = { name: string; level: string };
type SectionDraft = { classId: string; name: string; capacity: string };
type StreamDraft = { name: string; code: string };

export function AcademicStructureWorkspace() {
  const client = useQueryClient();
  const settingsCaps = useSettingsCapabilities();
  const canCreateClass = settingsCaps.canCreateClass;
  const canCreateSection = settingsCaps.canCreateSection;
  const canCreateStream = settingsCaps.canCreateStream;
  const canReadStreams = settingsCaps.canReadStreams;
  const canAssignClassTeacher = settingsCaps.canAssignClassTeacher;
  const canManageAny = canCreateClass || canCreateSection;
  const [classDraft, setClassDraft] = useState<ClassDraft>({
    name: '',
    level: '',
  });
  const [sectionDraft, setSectionDraft] = useState<SectionDraft>({
    classId: '',
    name: '',
    capacity: '',
  });
  const [streamDraft, setStreamDraft] = useState<StreamDraft>({
    name: '',
    code: '',
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [staffDraftBySection, setStaffDraftBySection] = useState<
    Record<string, string>
  >({});
  const [removeConfirmSectionId, setRemoveConfirmSectionId] = useState<
    string | null
  >(null);

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });
  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: api.listSections,
  });
  const streamsQuery = useQuery({
    queryKey: ['streams'],
    queryFn: api.listStreams,
    enabled: canReadStreams,
  });
  const academicYearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
    enabled: canAssignClassTeacher,
  });

  useEffect(() => {
    const firstClass = classesQuery.data?.[0];
    if (firstClass && !sectionDraft.classId)
      setSectionDraft((current) => ({ ...current, classId: firstClass.id }));
  }, [classesQuery.data, sectionDraft.classId]);

  const createClassMutation = useMutation({
    mutationFn: api.createClass,
    onSuccess: async () => {
      setClassDraft({ name: '', level: '' });
      setNotice('Class created. You can now add its sections.');
      await client.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: () =>
      setFormError(
        'Could not create the class. Check the name and level, then try again.',
      ),
  });
  const createSectionMutation = useMutation({
    mutationFn: api.createSection,
    onSuccess: async () => {
      setSectionDraft((current) => ({ ...current, name: '', capacity: '' }));
      setNotice('Section created.');
      await client.invalidateQueries({ queryKey: ['sections'] });
      await client.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: () =>
      setFormError(
        'Could not create the section. Check the selected class and try again.',
      ),
  });
  const createStreamMutation = useMutation({
    mutationFn: api.createStream,
    onSuccess: async () => {
      setStreamDraft({ name: '', code: '' });
      setNotice('Stream created. Assign it to Higher Secondary classes below.');
      await client.invalidateQueries({ queryKey: ['streams'] });
    },
    onError: () =>
      setFormError(
        'Could not create the stream. Check the name and code, then try again.',
      ),
  });
  const assignStreamMutation = useMutation({
    mutationFn: ({
      classId,
      streamId,
    }: {
      classId: string;
      streamId: string | null;
    }) => api.assignClassStream(classId, streamId),
    onSuccess: async () => {
      setNotice('Class stream updated.');
      await client.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: () =>
      setFormError('Could not update the class stream. Try again.'),
  });
  const assignClassTeacherMutation = useMutation({
    mutationFn: ({
      sectionId,
      staffId,
      academicYearId,
    }: {
      sectionId: string;
      staffId: string;
      academicYearId?: string;
    }) =>
      api.assignSectionClassTeacher(sectionId, { staffId, academicYearId }),
    onSuccess: async () => {
      setNotice('Class teacher assigned.');
      setFormError(null);
      await client.invalidateQueries({ queryKey: ['sections'] });
    },
    onError: () =>
      setFormError(
        'Could not assign the class teacher. Check the selected staff member and try again.',
      ),
  });
  const removeClassTeacherMutation = useMutation({
    mutationFn: ({
      sectionId,
      academicYearId,
    }: {
      sectionId: string;
      academicYearId?: string;
    }) => api.removeSectionClassTeacher(sectionId, academicYearId),
    onSuccess: async () => {
      setNotice('Class teacher removed.');
      setFormError(null);
      setRemoveConfirmSectionId(null);
      await client.invalidateQueries({ queryKey: ['sections'] });
    },
    onError: () =>
      setFormError('Could not remove the class teacher. Try again.'),
  });

  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const sections = useMemo(
    () => sectionsQuery.data ?? [],
    [sectionsQuery.data],
  );
  const streams = useMemo(() => streamsQuery.data ?? [], [streamsQuery.data]);
  const currentAcademicYear = useMemo(
    () => academicYearsQuery.data?.find((year) => year.isCurrent) ?? null,
    [academicYearsQuery.data],
  );
  const sectionsByClass = useMemo(
    () =>
      new Map(
        classes.map((item) => [
          item.id,
          sections.filter((section) => section.classId === item.id),
        ]),
      ),
    [classes, sections],
  );
  const sortedSections = useMemo(
    () =>
      [...sections].sort((left, right) => {
        const leftClass = left.class?.name ?? '';
        const rightClass = right.class?.name ?? '';
        if (leftClass !== rightClass) return leftClass.localeCompare(rightClass);
        return left.name.localeCompare(right.name);
      }),
    [sections],
  );

  if (classesQuery.isLoading || sectionsQuery.isLoading)
    return (
      <div className="space-y-5 p-6">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  if (
    classesQuery.isError ||
    sectionsQuery.isError ||
    (canAssignClassTeacher && academicYearsQuery.isError)
  )
    return (
      <div className="p-6">
        <ErrorState
          title="Could not load academic structure"
          message="Please retry to load this school’s classes and sections."
          error={
            classesQuery.error ??
            sectionsQuery.error ??
            academicYearsQuery.error
          }
          onRetry={() => {
            void classesQuery.refetch();
            void sectionsQuery.refetch();
            if (canAssignClassTeacher) {
              void academicYearsQuery.refetch();
            }
          }}
        />
      </div>
    );

  const createClass = () => {
    setFormError(null);
    const level = Number(classDraft.level);
    if (!classDraft.name.trim() || !Number.isInteger(level) || level < 0) {
      setFormError('Enter a class name and a valid numeric level.');
      return;
    }
    createClassMutation.mutate({ name: classDraft.name.trim(), level });
  };
  const createSection = () => {
    setFormError(null);
    if (!sectionDraft.classId || !sectionDraft.name.trim()) {
      setFormError('Choose a class and enter a section name.');
      return;
    }
    const capacity = sectionDraft.capacity.trim()
      ? Number(sectionDraft.capacity)
      : undefined;
    if (
      capacity !== undefined &&
      (!Number.isInteger(capacity) || capacity < 0)
    ) {
      setFormError('Capacity must be a non-negative whole number.');
      return;
    }
    createSectionMutation.mutate({
      classId: sectionDraft.classId,
      name: sectionDraft.name.trim(),
      capacity,
    });
  };
  const createStream = () => {
    setFormError(null);
    if (!streamDraft.name.trim() || !streamDraft.code.trim()) {
      setFormError('Enter a stream name and code.');
      return;
    }
    createStreamMutation.mutate({
      name: streamDraft.name.trim(),
      code: streamDraft.code.trim(),
    });
  };
  const assignClassTeacher = (sectionId: string) => {
    setFormError(null);
    const staffId = staffDraftBySection[sectionId]?.trim();
    if (!staffId) {
      setFormError('Choose a staff member before assigning a class teacher.');
      return;
    }
    if (!currentAcademicYear) {
      setFormError(
        'No current academic year is configured. Set one up in Calendar, Academic Year & Holidays first.',
      );
      return;
    }
    assignClassTeacherMutation.mutate({
      sectionId,
      staffId,
      academicYearId: currentAcademicYear.id,
    });
  };

  return (
    <div className="space-y-6 p-6 pb-24">
      <SchoolSettingsPageHeader
        title="Classes & sections"
        description="Create the classes and sections used by student admissions, attendance, fees, timetable, and academics."
        access={canManageAny ? 'can-manage' : 'view-only'}
      />
      {!canManageAny ? <SettingsPermissionNotice access="view-only" /> : null}
      <section className="rounded-2xl border border-sky-100 bg-sky-50 p-5 text-sm text-sky-900">
        <div className="flex gap-3">
          <School className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Create the academic year first</p>
            <p className="mt-1 leading-6">
              Academic years and Nepal school-day rules are managed in Calendar,
              Academic Year & Holidays. This workspace only manages school
              classes and sections.
            </p>
          </div>
        </div>
      </section>
      {notice ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          {notice}
        </div>
      ) : null}
      {formError ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          <CircleAlert className="h-4 w-4" />
          {formError}
        </div>
      ) : null}

      {canManageAny ? (
        <section className="grid gap-5 xl:grid-cols-2">
          {canCreateClass ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-bold text-slate-950">Add class</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Use the school’s preferred class label such as Grade 1,
                    Class 8, or Class 12.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_140px]">
                <Field
                  label="Class name"
                  value={classDraft.name}
                  onChange={(value) =>
                    setClassDraft((current) => ({ ...current, name: value }))
                  }
                  placeholder="Grade 1"
                />
                <Field
                  label="Level"
                  type="number"
                  value={classDraft.level}
                  onChange={(value) =>
                    setClassDraft((current) => ({ ...current, level: value }))
                  }
                  placeholder="1"
                />
              </div>
              <div className="mt-5 flex justify-end">
                <Button
                  type="button"
                  onClick={createClass}
                  disabled={createClassMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                  {createClassMutation.isPending ? 'Creating…' : 'Create class'}
                </Button>
              </div>
            </div>
          ) : null}
          {canCreateSection ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <Plus className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-bold text-slate-950">Add section</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Sections remain connected to one school class and are reused
                    by daily workflows.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="text-sm font-bold text-slate-900">
                    Class
                  </span>
                  <select
                    value={sectionDraft.classId}
                    onChange={(event) =>
                      setSectionDraft((current) => ({
                        ...current,
                        classId: event.target.value,
                      }))
                    }
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="">Select class</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Section name"
                  value={sectionDraft.name}
                  onChange={(value) =>
                    setSectionDraft((current) => ({ ...current, name: value }))
                  }
                  placeholder="A"
                />
                <Field
                  label="Capacity (optional)"
                  type="number"
                  value={sectionDraft.capacity}
                  onChange={(value) =>
                    setSectionDraft((current) => ({
                      ...current,
                      capacity: value,
                    }))
                  }
                  placeholder="30"
                />
              </div>
              <div className="mt-5 flex justify-end">
                <Button
                  type="button"
                  onClick={createSection}
                  disabled={createSectionMutation.isPending || !classes.length}
                >
                  <Plus className="h-4 w-4" />
                  {createSectionMutation.isPending
                    ? 'Creating…'
                    : 'Create section'}
                </Button>
              </div>
            </div>
          ) : null}
          {canCreateStream ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-bold text-slate-950">
                    Add Higher Secondary stream
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    Streams (e.g. Science, Management) apply to Grade{' '}
                    {HIGHER_SECONDARY_MIN_LEVEL}+ classes. Name them however
                    this school labels them.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_140px]">
                <Field
                  label="Stream name"
                  value={streamDraft.name}
                  onChange={(value) =>
                    setStreamDraft((current) => ({ ...current, name: value }))
                  }
                  placeholder="Science"
                />
                <Field
                  label="Code"
                  value={streamDraft.code}
                  onChange={(value) =>
                    setStreamDraft((current) => ({ ...current, code: value }))
                  }
                  placeholder="SCI"
                />
              </div>
              <div className="mt-5 flex justify-end">
                <Button
                  type="button"
                  onClick={createStream}
                  disabled={createStreamMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                  {createStreamMutation.isPending
                    ? 'Creating…'
                    : 'Create stream'}
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold text-slate-950">Class teachers</h2>
              <p className="mt-1 text-sm text-slate-600">
                Assign the homeroom teacher for each section. Class teachers can
                mark daily attendance for their assigned section
                {currentAcademicYear
                  ? ` in ${currentAcademicYear.name}.`
                  : '.'}
              </p>
            </div>
          </div>
        </div>
        {!canAssignClassTeacher ? (
          <div className="p-5">
            <SettingsPermissionNotice access="view-only" />
          </div>
        ) : sections.length === 0 ? (
          <div className="p-10 text-center">
            <UserRound className="mx-auto h-7 w-7 text-slate-400" />
            <p className="mt-3 font-semibold text-slate-900">
              Create sections first
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Class teacher assignment becomes available once this school has at
              least one section.
            </p>
          </div>
        ) : !currentAcademicYear ? (
          <div className="p-10 text-center">
            <CircleAlert className="mx-auto h-7 w-7 text-amber-500" />
            <p className="mt-3 font-semibold text-slate-900">
              No current academic year
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Configure the current academic year in Calendar, Academic Year &
              Holidays before assigning class teachers.
            </p>
          </div>
        ) : academicYearsQuery.isLoading ? (
          <div className="p-5">
            <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Class</th>
                  <th className="px-5 py-3">Section</th>
                  <th className="px-5 py-3">Students</th>
                  <th className="px-5 py-3">Current class teacher</th>
                  <th className="px-5 py-3">Assign</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedSections.map((section) => {
                  const currentTeacher = section.classTeacher;
                  const draftStaffId =
                    staffDraftBySection[section.id] ?? currentTeacher?.id ?? '';
                  return (
                    <tr key={section.id}>
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {section.class?.name ?? '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-700">{section.name}</td>
                      <td className="px-5 py-4 text-slate-600">
                        {section.studentCount ?? 0}
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {currentTeacher
                          ? `${currentTeacher.firstName} ${currentTeacher.lastName} (${currentTeacher.employeeId})`
                          : 'Not assigned'}
                      </td>
                      <td className="px-5 py-4">
                        <RemoteStaffSelector
                          value={draftStaffId}
                          onChange={(staffId) =>
                            setStaffDraftBySection((current) => ({
                              ...current,
                              [section.id]: staffId,
                            }))
                          }
                          selectedLabel={
                            currentTeacher && draftStaffId === currentTeacher.id
                              ? `${currentTeacher.firstName} ${currentTeacher.lastName} (${currentTeacher.employeeId})`
                              : undefined
                          }
                          label={`Class teacher for ${section.class?.name ?? 'class'} ${section.name}`}
                          placeholder="Search staff member"
                          hideLabel
                          className="min-w-[220px]"
                        />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => assignClassTeacher(section.id)}
                            disabled={
                              assignClassTeacherMutation.isPending ||
                              !draftStaffId ||
                              draftStaffId === currentTeacher?.id
                            }
                          >
                            {currentTeacher ? 'Change' : 'Assign'}
                          </Button>
                          {currentTeacher ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setRemoveConfirmSectionId(section.id)
                              }
                              disabled={removeClassTeacherMutation.isPending}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={removeConfirmSectionId !== null}
        title="Remove class teacher?"
        description="This revokes the homeroom assignment for the current academic year. Daily attendance marking for this section will stop until a new class teacher is assigned."
        confirmLabel="Remove class teacher"
        destructive
        isConfirming={removeClassTeacherMutation.isPending}
        onClose={() => setRemoveConfirmSectionId(null)}
        onConfirm={() => {
          if (!removeConfirmSectionId || !currentAcademicYear) return;
          removeClassTeacherMutation.mutate({
            sectionId: removeConfirmSectionId,
            academicYearId: currentAcademicYear.id,
          });
        }}
      />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-bold text-slate-950">Classes & sections</h2>
          <p className="mt-1 text-sm text-slate-600">
            {classes.length} classes and {sections.length} sections configured
            for this school.
          </p>
        </div>
        {classes.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 className="mx-auto h-7 w-7 text-slate-400" />
            <p className="mt-3 font-semibold text-slate-900">
              No classes have been created
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Create the first class to begin setting up the school’s academic
              structure.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {classes.map((item) => {
              const classSections = sectionsByClass.get(item.id) ?? [];
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">{item.name}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Level {item.level}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {classSections.length} sections
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {classSections.length ? (
                      classSections.map((section) => (
                        <span
                          key={section.id}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                        >
                          {section.name}
                          {section.capacity ? ` · ${section.capacity}` : ''}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">
                        No sections yet
                      </span>
                    )}
                  </div>
                  {(item.level ?? 0) >= HIGHER_SECONDARY_MIN_LEVEL &&
                  canCreateStream ? (
                    <label className="mt-4 block border-t border-slate-100 pt-4">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Stream
                      </span>
                      <select
                        value={item.streamId ?? ''}
                        onChange={(event) =>
                          assignStreamMutation.mutate({
                            classId: item.id,
                            streamId: event.target.value || null,
                          })
                        }
                        disabled={assignStreamMutation.isPending}
                        className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                      >
                        <option value="">No stream</option>
                        {streams.map((stream) => (
                          <option key={stream.id} value={stream.id}>
                            {stream.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (item.level ?? 0) >= HIGHER_SECONDARY_MIN_LEVEL &&
                    item.streamName ? (
                    <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
                      Stream:{' '}
                      <span className="font-bold text-slate-900">
                        {item.streamName}
                      </span>
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
}) {
  return (
    <label>
      <span className="text-sm font-bold text-slate-900">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-900/5"
      />
    </label>
  );
}
