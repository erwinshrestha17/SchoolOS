'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, CheckCircle2, CircleAlert, Plus, School } from 'lucide-react';
import { Button } from '../ui/button';
import { ErrorState } from '../ui/error-state';
import { PageHeader } from '../ui/page-header';
import { api } from '../../lib/api';

type ClassDraft = { name: string; level: string };
type SectionDraft = { classId: string; name: string; capacity: string };

export function AcademicStructureWorkspace() {
  const client = useQueryClient();
  const [classDraft, setClassDraft] = useState<ClassDraft>({ name: '', level: '' });
  const [sectionDraft, setSectionDraft] = useState<SectionDraft>({ classId: '', name: '', capacity: '' });
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });

  useEffect(() => {
    const firstClass = classesQuery.data?.[0];
    if (firstClass && !sectionDraft.classId) setSectionDraft((current) => ({ ...current, classId: firstClass.id }));
  }, [classesQuery.data, sectionDraft.classId]);

  const createClassMutation = useMutation({
    mutationFn: api.createClass,
    onSuccess: async () => {
      setClassDraft({ name: '', level: '' });
      setNotice('Class created. You can now add its sections.');
      await client.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: () => setFormError('Could not create the class. Check the name and level, then try again.'),
  });
  const createSectionMutation = useMutation({
    mutationFn: api.createSection,
    onSuccess: async () => {
      setSectionDraft((current) => ({ ...current, name: '', capacity: '' }));
      setNotice('Section created.');
      await client.invalidateQueries({ queryKey: ['sections'] });
      await client.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: () => setFormError('Could not create the section. Check the selected class and try again.'),
  });

  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data]);
  const sectionsByClass = useMemo(() => new Map(classes.map((item) => [item.id, sections.filter((section) => section.classId === item.id)])), [classes, sections]);

  if (classesQuery.isLoading || sectionsQuery.isLoading) return <div className="space-y-5 p-6"><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /><div className="h-96 animate-pulse rounded-2xl bg-slate-100" /></div>;
  if (classesQuery.isError || sectionsQuery.isError) return <div className="p-6"><ErrorState title="Could not load academic structure" message="Please retry to load this school’s classes and sections." error={classesQuery.error ?? sectionsQuery.error} onRetry={() => { void classesQuery.refetch(); void sectionsQuery.refetch(); }} /></div>;

  const createClass = () => {
    setFormError(null);
    const level = Number(classDraft.level);
    if (!classDraft.name.trim() || !Number.isInteger(level) || level < 0) { setFormError('Enter a class name and a valid numeric level.'); return; }
    createClassMutation.mutate({ name: classDraft.name.trim(), level });
  };
  const createSection = () => {
    setFormError(null);
    if (!sectionDraft.classId || !sectionDraft.name.trim()) { setFormError('Choose a class and enter a section name.'); return; }
    const capacity = sectionDraft.capacity.trim() ? Number(sectionDraft.capacity) : undefined;
    if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 0)) { setFormError('Capacity must be a non-negative whole number.'); return; }
    createSectionMutation.mutate({ classId: sectionDraft.classId, name: sectionDraft.name.trim(), capacity });
  };

  return <div className="space-y-6 p-6 pb-24">
    <PageHeader title="Academic structure" description="Create the classes and sections used by student admissions, attendance, fees, timetable, academics, and learning." actions={<Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><ArrowLeft className="h-4 w-4" />All settings</Link>} />
    <section className="rounded-2xl border border-sky-100 bg-sky-50 p-5 text-sm text-sky-900"><div className="flex gap-3"><School className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-bold">Create the academic year first</p><p className="mt-1 leading-6">Academic years and Nepal school-day rules are managed in Calendar, Academic Year & Holidays. This workspace only manages school classes and sections.</p></div></div></section>
    {notice ? <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{notice}</div> : null}
    {formError ? <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"><CircleAlert className="h-4 w-4" />{formError}</div> : null}

    <section className="grid gap-5 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white"><Building2 className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-950">Add class</h2><p className="mt-1 text-sm leading-5 text-slate-600">Use the school’s preferred class label such as Nursery, Grade 1, or Class 10.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-[1fr_140px]"><Field label="Class name" value={classDraft.name} onChange={(value) => setClassDraft((current) => ({ ...current, name: value }))} placeholder="Grade 1" /><Field label="Level" type="number" value={classDraft.level} onChange={(value) => setClassDraft((current) => ({ ...current, level: value }))} placeholder="1" /></div><div className="mt-5 flex justify-end"><Button type="button" onClick={createClass} disabled={createClassMutation.isPending}><Plus className="h-4 w-4" />{createClassMutation.isPending ? 'Creating…' : 'Create class'}</Button></div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white"><Plus className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-950">Add section</h2><p className="mt-1 text-sm leading-5 text-slate-600">Sections remain connected to one school class and are reused by daily workflows.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label><span className="text-sm font-bold text-slate-900">Class</span><select value={sectionDraft.classId} onChange={(event) => setSectionDraft((current) => ({ ...current, classId: event.target.value }))} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Select class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Field label="Section name" value={sectionDraft.name} onChange={(value) => setSectionDraft((current) => ({ ...current, name: value }))} placeholder="A" /><Field label="Capacity (optional)" type="number" value={sectionDraft.capacity} onChange={(value) => setSectionDraft((current) => ({ ...current, capacity: value }))} placeholder="30" /></div><div className="mt-5 flex justify-end"><Button type="button" onClick={createSection} disabled={createSectionMutation.isPending || !classes.length}><Plus className="h-4 w-4" />{createSectionMutation.isPending ? 'Creating…' : 'Create section'}</Button></div></div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="font-bold text-slate-950">Classes & sections</h2><p className="mt-1 text-sm text-slate-600">{classes.length} classes and {sections.length} sections configured for this school.</p></div>{classes.length === 0 ? <div className="p-10 text-center"><Building2 className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 font-semibold text-slate-900">No classes have been created</p><p className="mt-1 text-sm text-slate-600">Create the first class to begin setting up the school’s academic structure.</p></div> : <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">{classes.map((item) => { const classSections = sectionsByClass.get(item.id) ?? []; return <div key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-950">{item.name}</p><p className="mt-1 text-sm text-slate-600">Level {item.level}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{classSections.length} sections</span></div><div className="mt-4 flex flex-wrap gap-2">{classSections.length ? classSections.map((section) => <span key={section.id} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{section.name}{section.capacity ? ` · ${section.capacity}` : ''}</span>) : <span className="text-sm text-slate-500">No sections yet</span>}</div></div>; })}</div>}</section>
  </div>;
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: 'text' | 'number' }) { return <label><span className="text-sm font-bold text-slate-900">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-900/5" /></label>; }
