'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { admissionFormSchema, type AdmissionFormInput } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { api } from '../../lib/api';
import { fileToBase64Payload } from '../../lib/files';
import { SectionCard } from '../ui/section-card';
import { StatCard } from '../ui/stat-card';
import { Badge } from '../ui/badge';
import { EmptyState } from '../ui/empty-state';
import { cn } from '../../lib/utils';
import { 
  UserPlus, 
  Users, 
  Wallet, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Upload,
  FileText,
  Calendar
} from 'lucide-react';

const today = new Date().toISOString().slice(0, 10);

const enrollmentSteps = [
  'Personal Info',
  'Academic Placement',
  'Guardian Contacts',
  'Documents & Review',
  'Success / Next Actions',
] as const;

const documentKinds = [
  ['BIRTH_CERTIFICATE', 'Birth certificate'],
  ['TRANSFER_CERTIFICATE', 'Transfer certificate'],
  ['PHOTO', 'Photo'],
  ['ID_CARD', 'Guardian ID'],
  ['OTHER', 'Other'],
] as const;

const workspaceTabs = [
  ['enrollment', 'New Enrollment'],
  ['bulk', 'Bulk Import'],
  ['recent', 'Recent Admissions'],
] as const;

export function AdmissionForm() {
  const queryClient = useQueryClient();
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<typeof workspaceTabs[number][0]>('enrollment');
  const [activeStep, setActiveStep] = useState(0);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentKind, setDocumentKind] = useState('BIRTH_CERTIFICATE');
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<Awaited<ReturnType<typeof api.checkAdmissionDuplicates>> | null>(null);
  const [disabilityMode, setDisabilityMode] = useState<'' | 'NO_KNOWN_DISABILITY' | 'DISABILITY_PRESENT'>('');
  const [pdfError, setPdfError] = useState('');

  const admissionsQuery = useQuery({ queryKey: ['admissions'], queryFn: api.listAdmissions });
  const academicYearsQuery = useQuery({ queryKey: ['academic-years'], queryFn: api.listAcademicYears });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const studentsQuery = useQuery({ queryKey: ['students'], queryFn: () => api.listStudents() });

  const form = useForm<AdmissionFormInput>({
    resolver: zodResolver(admissionFormSchema),
    mode: 'onBlur',
    defaultValues: {
      dateOfBirth: '',
      disabilityFlag: '',
      confirmNoDisability: false,
      admissionDate: today,
      gender: 'FEMALE',
      mediumOfInstruction: 'English',
      guardians: [{ fullName: '', relation: 'mother', primaryPhone: '', isPrimary: true }],
    },
  });

  const selectedAcademicYearId = form.watch('academicYearId');
  const selectedClassId = form.watch('classId');
  const selectedSectionId = form.watch('sectionId');
  const watchedDateOfBirth = form.watch('dateOfBirth');
  const watchedDisabilityFlag = form.watch('disabilityFlag');
  const watchedConfirmNoDisability = form.watch('confirmNoDisability');
  const watchedGuardians = form.watch('guardians') ?? [];
  const watchedFirstNameEn = form.watch('firstNameEn');
  const watchedLastNameEn = form.watch('lastNameEn');

  const guardians = useFieldArray({ control: form.control, name: 'guardians' });

  useEffect(() => {
    const currentAcademicYear = academicYearsQuery.data?.find(y => y.isCurrent) ?? academicYearsQuery.data?.[0];
    if (currentAcademicYear && !form.getValues('academicYearId')) {
      form.setValue('academicYearId', currentAcademicYear.id);
    }
  }, [academicYearsQuery.data, form]);

  useEffect(() => {
    const firstClass = classesQuery.data?.[0];
    if (firstClass && !form.getValues('classId')) {
      form.setValue('classId', firstClass.id);
    }
  }, [classesQuery.data, form]);

  const availableSections = (sectionsQuery.data ?? []).filter(s => {
    const sectionClassId = s.classId ?? s.class?.id;
    return !selectedClassId || sectionClassId === selectedClassId;
  });

  const hasAcademicYears = (academicYearsQuery.data ?? []).length > 0;
  const hasClasses = (classesQuery.data ?? []).length > 0;
  const setupIsLoading = academicYearsQuery.isLoading || classesQuery.isLoading;
  const setupIsMissing = !hasAcademicYears || !hasClasses;

  const mutation = useMutation({
    mutationFn: api.createAdmission,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admissions'] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setDocumentFile(null);
      setDuplicateWarning(null);
      setPdfError('');
      setActiveStep(4);
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (file: File) =>
      api.bulkImportAdmissions({
        file: await fileToBase64Payload(file),
        mode: 'validate-and-create',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admissions'] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  async function submitAdmission(values: AdmissionFormInput, confirmDuplicate = false) {
    if (!confirmDuplicate) {
      const duplicates = await api.checkAdmissionDuplicates({
        firstNameEn: values.firstNameEn,
        lastNameEn: values.lastNameEn,
        dateOfBirth: new Date(values.dateOfBirth).toISOString(),
      });
      if (duplicates.hasWarnings) {
        setDuplicateWarning(duplicates);
        setActiveStep(3);
        return;
      }
    }
    const documentPayload = documentFile ? { ...(await fileToBase64Payload(documentFile)), kind: documentKind, title: documentFile.name } : null;
    mutation.mutate({
      ...values,
      sectionId: values.sectionId || null,
      disabilityFlag: values.disabilityFlag?.trim() || undefined,
      confirmNoDisability: Boolean(values.confirmNoDisability),
      admissionDate: new Date(values.admissionDate).toISOString(),
      dateOfBirth: new Date(values.dateOfBirth).toISOString(),
      confirmDuplicate,
      documents: documentPayload ? [documentPayload] : [],
    });
  }

  async function goToNextStep() {
    const fields: any[] = [];
    if (activeStep === 0) fields.push('firstNameEn', 'lastNameEn', 'dateOfBirth', 'gender', 'confirmNoDisability');
    if (activeStep === 1) fields.push('academicYearId', 'classId', 'admissionDate');
    if (activeStep === 2) fields.push('guardians');
    
    const valid = await form.trigger(fields as any);
    if (valid) setActiveStep(s => Math.min(s + 1, 3));
  }

  const latestAdmission = mutation.data;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Admissions" value={admissionsQuery.data?.length ?? 0} icon={<UserPlus size={20} />} />
        <StatCard title="Active Students" value={studentsQuery.data?.length ?? 0} icon={<Users size={20} />} />
        <Link href="/dashboard/students" className="group relative overflow-hidden rounded-[2rem] bg-slate-900 p-6 text-white shadow-xl transition hover:-translate-y-1">
          <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-primary-500/20 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Manage Records</p>
              <h3 className="mt-1 text-xl font-bold">Student Directory</h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm transition group-hover:bg-primary-500">
              <ChevronRight size={24} />
            </div>
          </div>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 rounded-[2rem] border border-slate-200 bg-white/50 p-2 backdrop-blur-sm">
        {workspaceTabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={cn(
              "flex-1 min-h-[3rem] rounded-[1.5rem] px-6 text-sm font-bold transition-all",
              activeWorkspaceTab === value ? "bg-slate-900 text-white shadow-lg" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            )}
            onClick={() => setActiveWorkspaceTab(value as any)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeWorkspaceTab === 'enrollment' && (
        <form className="space-y-6" onSubmit={form.handleSubmit((v) => submitAdmission(v))}>
          {setupIsMissing && !setupIsLoading && (
            <SectionCard title="Setup required before enrollment" className="border-warning-200 bg-warning-50">
              <p className="text-sm font-medium text-warning-800">
                Create an academic year and at least one class before admitting students.
              </p>
            </SectionCard>
          )}
           <div className="flex items-center justify-between px-4">
            {enrollmentSteps.map((step, idx) => (
              <div key={step} className="flex items-center gap-3">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all",
                  activeStep === idx ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30 scale-110" : 
                  activeStep > idx || latestAdmission ? "bg-success-500 text-white" : "bg-slate-100 text-slate-400"
                )}>
                  {activeStep > idx || (idx === 4 && latestAdmission) ? <CheckCircle2 size={16} /> : idx + 1}
                </div>
                <span className={cn(
                  "hidden text-xs font-bold uppercase tracking-wider lg:block",
                  activeStep === idx ? "text-slate-900" : "text-slate-400"
                )}>
                  {step}
                </span>
                {idx < enrollmentSteps.length - 1 && <div className="h-px w-8 bg-slate-200" />}
              </div>
            ))}
          </div>

          <div className="grid gap-6">
            {activeStep === 0 && (
              <SectionCard title="Personal Information" description="Identity and personal details for school records.">
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField label="First Name (EN)" error={form.formState.errors.firstNameEn?.message}>
                    <input className="premium-input" {...form.register('firstNameEn')} />
                  </FormField>
                  <FormField label="Last Name (EN)" error={form.formState.errors.lastNameEn?.message}>
                    <input className="premium-input" {...form.register('lastNameEn')} />
                  </FormField>
                  <FormField label="Date of Birth" error={form.formState.errors.dateOfBirth?.message}>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input type="date" className="premium-input pl-10" {...form.register('dateOfBirth')} />
                    </div>
                  </FormField>
                  <FormField label="Gender" error={form.formState.errors.gender?.message}>
                    <select className="premium-input" {...form.register('gender')}>
                      <option value="FEMALE">Female</option>
                      <option value="MALE">Male</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </FormField>
                </div>
                <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/50 p-6">
                   <p className="text-sm font-bold text-slate-900">iEMIS Disability Confirmation</p>
                   <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className={cn(
                        "flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all",
                        disabilityMode === 'NO_KNOWN_DISABILITY' ? "border-primary-500 bg-primary-50" : "border-slate-200 bg-white hover:border-slate-300"
                      )}>
                        <input type="radio" className="mt-1" checked={disabilityMode === 'NO_KNOWN_DISABILITY'} onChange={() => {
                          setDisabilityMode('NO_KNOWN_DISABILITY');
                          form.setValue('confirmNoDisability', true);
                          form.setValue('disabilityFlag', '');
                        }} />
                        <div>
                          <p className="font-bold text-slate-900">No known disability</p>
                          <p className="text-xs text-slate-500 mt-1">Confirmed for standard iEMIS reporting.</p>
                        </div>
                      </label>
                      <label className={cn(
                        "flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all",
                        disabilityMode === 'DISABILITY_PRESENT' ? "border-primary-500 bg-primary-50" : "border-slate-200 bg-white hover:border-slate-300"
                      )}>
                        <input type="radio" className="mt-1" checked={disabilityMode === 'DISABILITY_PRESENT'} onChange={() => {
                          setDisabilityMode('DISABILITY_PRESENT');
                          form.setValue('confirmNoDisability', false);
                        }} />
                        <div>
                          <p className="font-bold text-slate-900">Special Support Needed</p>
                          <p className="text-xs text-slate-500 mt-1">Specify disability for inclusive tracking.</p>
                        </div>
                      </label>
                   </div>
                   {disabilityMode === 'DISABILITY_PRESENT' && (
                     <div className="mt-4">
                       <input className="premium-input" placeholder="Specify disability details..." {...form.register('disabilityFlag')} />
                     </div>
                   )}
                </div>
              </SectionCard>
            )}

            {activeStep === 1 && (
              <SectionCard title="Academic Placement" description="Assign student to a class and academic cycle.">
                <div className="grid gap-6 md:grid-cols-2">
                   <FormField label="Academic Year" error={form.formState.errors.academicYearId?.message}>
                     <select className="premium-input" {...form.register('academicYearId')}>
                        {academicYearsQuery.data?.map(y => <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? '(Current)' : ''}</option>)}
                     </select>
                   </FormField>
                   <FormField label="Class" error={form.formState.errors.classId?.message}>
                     <select className="premium-input" {...form.register('classId')}>
                        {classesQuery.data?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                     </select>
                   </FormField>
                   <FormField label="Section (Optional)" error={form.formState.errors.sectionId?.message}>
                     <select className="premium-input" {...form.register('sectionId')}>
                        <option value="">No Section</option>
                        {availableSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                     </select>
                   </FormField>
                   <FormField label="Admission Date" error={form.formState.errors.admissionDate?.message}>
                     <input type="date" className="premium-input" {...form.register('admissionDate')} />
                   </FormField>
                </div>
              </SectionCard>
            )}

            {activeStep === 2 && (
              <SectionCard 
                title="Guardian Contacts" 
                description="Manage family members and emergency contacts."
                headerAction={
                  <button type="button" className="text-sm font-bold text-primary-600" onClick={() => guardians.append({ fullName: '', relation: 'guardian', primaryPhone: '', isPrimary: false })}>
                    + Add Guardian
                  </button>
                }
              >
                <div className="space-y-4">
                  {guardians.fields.map((field, idx) => (
                    <div key={field.id} className="rounded-2xl border border-slate-200 p-6 space-y-4">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <Badge variant="phase2">Guardian #{idx + 1}</Badge>
                           <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                             <input type="radio" checked={watchedGuardians[idx]?.isPrimary} onChange={() => {
                               watchedGuardians.forEach((_, i) => form.setValue(`guardians.${i}.isPrimary`, i === idx));
                             }} />
                             Primary
                           </label>
                         </div>
                         {idx > 0 && <button type="button" className="text-xs font-bold text-danger-500" onClick={() => guardians.remove(idx)}>Remove</button>}
                       </div>
                       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          <FormField label="Full Name">
                            <input className="premium-input" {...form.register(`guardians.${idx}.fullName`)} />
                          </FormField>
                          <FormField label="Relation">
                            <input className="premium-input" {...form.register(`guardians.${idx}.relation`)} />
                          </FormField>
                          <FormField label="Phone Number">
                            <input className="premium-input" {...form.register(`guardians.${idx}.primaryPhone`)} />
                          </FormField>
                       </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {activeStep === 3 && (
              <SectionCard title="Review & Documents" description="Finalize enrollment and attach supporting files.">
                <div className="grid gap-8 lg:grid-cols-2">
                  <div className="space-y-6">
                     <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center transition hover:border-primary-400 hover:bg-slate-50">
                        <Upload className="mx-auto mb-4 text-slate-400" size={32} />
                        <p className="text-sm font-bold text-slate-900">Upload Birth Certificate or ID</p>
                        <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG up to 5MB</p>
                        <input type="file" className="mt-4 text-xs" onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)} />
                     </div>
                     
                     {duplicateWarning?.hasWarnings && (
                       <div className="rounded-2xl border border-warning-200 bg-warning-50 p-6">
                         <div className="flex gap-4">
                           <AlertTriangle className="text-warning-500" size={24} />
                           <div>
                             <p className="font-bold text-warning-900">Possible duplicate found</p>
                             <p className="mt-1 text-sm text-warning-700">A student with the same name and DOB already exists.</p>
                             <button type="button" className="mt-4 rounded-xl bg-warning-500 px-4 py-2 text-xs font-bold text-white shadow-sm" onClick={() => submitAdmission(form.getValues(), true)}>
                               Create anyway
                             </button>
                           </div>
                         </div>
                       </div>
                     )}
                  </div>

                  <div className="rounded-2xl bg-slate-900 p-6 text-white">
                    <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">Enrollment Summary</h4>
                    <div className="mt-6 space-y-4">
                       <SummaryItem label="Student" value={`${watchedFirstNameEn} ${watchedLastNameEn}`} />
                       <SummaryItem label="Class" value={classesQuery.data?.find(c => c.id === selectedClassId)?.name ?? 'N/A'} />
                       <SummaryItem label="Section" value={availableSections.find(s => s.id === selectedSectionId)?.name ?? 'N/A'} />
                       <SummaryItem label="Primary Guardian" value={watchedGuardians.find(g => g.isPrimary)?.fullName ?? 'N/A'} />
                       <SummaryItem label="Documents" value={documentFile ? '1 Attached' : 'None'} />
                    </div>
                  </div>
                </div>
              </SectionCard>
            )}

            {activeStep === 4 && (
              <EmptyState 
                title="Enrollment Successful!" 
                description={`Student ${watchedFirstNameEn} ${watchedLastNameEn} has been successfully added to the system.`}
                icon={<CheckCircle2 className="text-success-500" size={48} />}
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <button type="button" className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-lg" onClick={() => window.location.reload()}>
                      Add Another Student
                    </button>
                    <Link href="/dashboard/students" className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm">
                      Go to Directory
                    </Link>
                    <Link href="/dashboard/finance" className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm">
                      Collect First Fee
                    </Link>
                    <button type="button" className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm">
                      Download ID Card
                    </button>
                  </div>
                }
              />
            )}
          </div>

          {activeStep < 4 && (
            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
              <button
                type="button"
                className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-slate-500 transition hover:text-slate-900 disabled:opacity-30"
                disabled={activeStep === 0}
                onClick={() => setActiveStep(s => s - 1)}
              >
                <ChevronLeft size={20} />
                Back
              </button>
              
              {activeStep === 3 ? (
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="flex items-center gap-2 rounded-2xl bg-primary-500 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-primary-500/30 transition hover:bg-primary-600 active:scale-95 disabled:opacity-50"
                >
                  {mutation.isPending ? 'Enrolling...' : 'Complete Enrollment'}
                  <CheckCircle2 size={20} />
                </button>
              ) : (
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-2xl bg-slate-900 px-8 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 active:scale-95"
                  onClick={goToNextStep}
                >
                  Next Step
                  <ChevronRight size={20} />
                </button>
              )}
            </div>
          )}
        </form>
      )}

      {activeWorkspaceTab === 'bulk' && (
        <SectionCard title="Bulk Import" description="Upload a school-reviewed CSV for admission import. The backend validates each row before creating records.">
          <div className="space-y-5">
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <Upload className="mx-auto mb-4 text-slate-400" size={32} />
              <p className="text-sm font-bold text-slate-900">Upload admission CSV</p>
              <p className="mt-1 text-xs text-slate-500">
                Use real school data only. Disability/iEMIS confirmation columns are required.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                className="mt-4 text-xs"
                onChange={(event) => setBulkFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!bulkFile || bulkImportMutation.isPending}
                onClick={() => bulkFile && bulkImportMutation.mutate(bulkFile)}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {bulkImportMutation.isPending ? 'Importing...' : 'Validate & Import'}
              </button>
              {bulkImportMutation.data ? (
                <Badge variant={bulkImportMutation.data.failed > 0 ? 'warning' : 'success'}>
                  {bulkImportMutation.data.created} created, {bulkImportMutation.data.failed} failed
                </Badge>
              ) : null}
            </div>
            {bulkImportMutation.data?.errorReportCsv ? (
              <div className="rounded-2xl border border-warning-200 bg-warning-50 p-4">
                <p className="text-sm font-bold text-warning-900">Error report CSV available</p>
                <p className="mt-1 text-xs text-warning-700">
                  Review the backend validation errors, correct the CSV, and retry.
                </p>
              </div>
            ) : null}
            {bulkImportMutation.error ? (
              <p className="text-sm font-bold text-danger-600">
                {bulkImportMutation.error instanceof Error ? bulkImportMutation.error.message : 'Bulk import failed.'}
              </p>
            ) : null}
          </div>
        </SectionCard>
      )}

      {activeWorkspaceTab === 'recent' && (
        <SectionCard title="Recent Admissions" description="Latest admission records from the backend.">
          {(admissionsQuery.data ?? []).length === 0 ? (
            <EmptyState title="No recent admissions" description="New student admissions will appear here after enrollment." />
          ) : (
            <div className="divide-y divide-slate-100">
              {(admissionsQuery.data ?? []).slice(0, 10).map((admission) => (
                <div key={admission.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-bold text-slate-900">
                      {admission.fullNameEn}
                    </p>
                    <p className="text-xs text-slate-500">
                      {admission.studentSystemId} / {admission.className ?? 'Class pending'}
                    </p>
                  </div>
                  <Link href={`/dashboard/students/${encodeURIComponent(admission.id)}`} className="text-sm font-bold text-primary-600">
                    View Profile
                  </Link>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}

function FormField({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 ml-1">{label}</label>
      {children}
      {error && <p className="text-[0.7rem] font-bold text-danger-500 ml-1">{error}</p>}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <span className="text-xs font-bold text-white">{value}</span>
    </div>
  );
}
