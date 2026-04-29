'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { admissionFormSchema, type AdmissionFormInput } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { api } from '../../lib/api';
import { fileToBase64Payload } from '../../lib/files';

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

export function AdmissionForm() {
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentKind, setDocumentKind] = useState('BIRTH_CERTIFICATE');
  const [duplicateWarning, setDuplicateWarning] =
    useState<Awaited<ReturnType<typeof api.checkAdmissionDuplicates>> | null>(null);
  const [bulkCsv, setBulkCsv] = useState('');
  const [bulkConfirmDuplicates, setBulkConfirmDuplicates] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const admissionsQuery = useQuery({
    queryKey: ['admissions'],
    queryFn: api.listAdmissions,
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
  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: api.listStudents,
  });

  const form = useForm<AdmissionFormInput>({
    resolver: zodResolver(admissionFormSchema),
    mode: 'onBlur',
    defaultValues: {
      dateOfBirth: '',
      admissionDate: today,
      gender: 'FEMALE',
      mediumOfInstruction: 'English',
      guardians: [
        {
          fullName: '',
          relation: 'mother',
          primaryPhone: '',
          isPrimary: true,
        },
      ],
    },
  });

  const selectedAcademicYearId = form.watch('academicYearId');
  const selectedClassId = form.watch('classId');
  const selectedSectionId = form.watch('sectionId');
  const watchedDateOfBirth = form.watch('dateOfBirth');
  const watchedGuardians = form.watch('guardians') ?? [];
  const watchedFirstNameEn = form.watch('firstNameEn');
  const watchedLastNameEn = form.watch('lastNameEn');

  const guardians = useFieldArray({
    control: form.control,
    name: 'guardians',
  });

  useEffect(() => {
    const currentAcademicYear = academicYearsQuery.data?.find(
      (year) => year.isCurrent,
    );
    const firstAcademicYear = currentAcademicYear ?? academicYearsQuery.data?.[0];

    if (firstAcademicYear && !form.getValues('academicYearId')) {
      form.setValue('academicYearId', firstAcademicYear.id);
    }
  }, [academicYearsQuery.data, form]);

  useEffect(() => {
    const firstClass = classesQuery.data?.[0];

    if (firstClass && !form.getValues('classId')) {
      form.setValue('classId', firstClass.id);
    }
  }, [classesQuery.data, form]);

  useEffect(() => {
    if (!selectedClassId) {
      return;
    }

    const selectedSection = sectionsQuery.data?.find(
      (section) => section.id === form.getValues('sectionId'),
    );
    const selectedSectionClassId = selectedSection?.classId ?? selectedSection?.class?.id;

    if (selectedSection && selectedSectionClassId !== selectedClassId) {
      form.setValue('sectionId', '');
    }
  }, [form, sectionsQuery.data, selectedClassId]);

  const availableSections = (sectionsQuery.data ?? []).filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !selectedClassId || sectionClassId === selectedClassId;
  });
  const hasAcademicYears = (academicYearsQuery.data ?? []).length > 0;
  const hasClasses = (classesQuery.data ?? []).length > 0;
  const setupIsLoading = academicYearsQuery.isLoading || classesQuery.isLoading;
  const setupIsMissing = !hasAcademicYears || !hasClasses;
  const selectedAcademicYear = academicYearsQuery.data?.find(
    (year) => year.id === selectedAcademicYearId,
  );
  const selectedClass = classesQuery.data?.find(
    (classroom) => classroom.id === selectedClassId,
  );
  const selectedSection = availableSections.find(
    (section) => section.id === selectedSectionId,
  );

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

  const bulkMutation = useMutation({
    mutationFn: api.bulkImportAdmissions,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admissions'] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  async function submitAdmission(
    values: AdmissionFormInput,
    confirmDuplicate = false,
  ) {
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

    const documentPayload = documentFile
      ? {
          ...(await fileToBase64Payload(documentFile)),
          kind: documentKind,
          title: documentFile.name,
        }
      : null;

    mutation.mutate({
      ...values,
      sectionId: values.sectionId || null,
      admissionDate: new Date(values.admissionDate).toISOString(),
      dateOfBirth: new Date(values.dateOfBirth).toISOString(),
      confirmDuplicate,
      documents: documentPayload ? [documentPayload] : [],
    });
  }

  async function goToNextStep() {
    const valid = await form.trigger(fieldsForStep(activeStep));

    if (valid) {
      setActiveStep((step) => Math.min(step + 1, 3));
    }
  }

  function addAnotherStudent() {
    form.reset({
      ...form.getValues(),
      firstNameEn: '',
      lastNameEn: '',
      firstNameNp: '',
      lastNameNp: '',
      dateOfBirth: '',
      admissionDate: today,
      admissionNumber: '',
      rollNumber: null,
      guardians: [
        {
          fullName: '',
          relation: 'mother',
          primaryPhone: '',
          isPrimary: true,
        },
      ],
    });
    setDocumentFile(null);
    setDuplicateWarning(null);
    setPdfError('');
    setActiveStep(0);
    mutation.reset();
  }

  function markPrimaryGuardian(index: number) {
    watchedGuardians.forEach((_, guardianIndex) => {
      form.setValue(`guardians.${guardianIndex}.isPrimary`, guardianIndex === index, {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
  }

  const latestAdmission = mutation.data;
  const sampleBulkCsv =
    'firstNameEn,lastNameEn,dateOfBirth,gender,admissionDate,academicYearId,classId,sectionId,guardianFullName,guardianRelation,guardianPhone,rollNumber';

  async function openStudentPdf(studentId: string, kind: string) {
    setPdfError('');

    try {
      await api.openStudentDocumentPdf(studentId, kind);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : 'Unable to open generated PDF');
    }
  }

  return (
    <div className="grid gap-6">
      <form
        className="grid gap-5"
        onSubmit={form.handleSubmit((values) => submitAdmission(values))}
      >
        <Stepper activeStep={activeStep} completed={Boolean(latestAdmission)} />

        {setupIsLoading ? <SetupSkeleton /> : null}
        {!setupIsLoading && setupIsMissing ? (
          <SetupRequiredCard
            hasAcademicYears={hasAcademicYears}
            hasClasses={hasClasses}
          />
        ) : null}

        {activeStep === 0 ? (
          <StepCard
            eyebrow="Step 1"
            title="Personal Info"
            description="Capture the student's core identity exactly as it should appear on school records."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="First name (EN)" error={fieldError(form.formState.errors.firstNameEn)}>
                <input {...form.register('firstNameEn')} autoComplete="given-name" />
              </Field>
              <Field label="Last name (EN)" error={fieldError(form.formState.errors.lastNameEn)}>
                <input {...form.register('lastNameEn')} autoComplete="family-name" />
              </Field>
              <Field label="First name (NP)" error={fieldError(form.formState.errors.firstNameNp)}>
                <input {...form.register('firstNameNp')} />
              </Field>
              <Field label="Last name (NP)" error={fieldError(form.formState.errors.lastNameNp)}>
                <input {...form.register('lastNameNp')} />
              </Field>
              <Field label="Date of birth" error={fieldError(form.formState.errors.dateOfBirth)}>
                <input type="date" {...form.register('dateOfBirth')} />
                <p className="mt-2 text-xs text-gray-500">
                  {watchedDateOfBirth
                    ? `Age preview: ${formatAge(watchedDateOfBirth)}`
                    : 'Age preview appears after selecting DOB.'}
                </p>
              </Field>
              <Field label="Gender" error={fieldError(form.formState.errors.gender)}>
                <select {...form.register('gender')}>
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
            </div>
          </StepCard>
        ) : null}

        {activeStep === 1 ? (
          <StepCard
            eyebrow="Step 2"
            title="Academic Placement"
            description="Place the student into the correct academic year, class, section, and roll number."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Academic year"
                error={fieldError(form.formState.errors.academicYearId)}
              >
                <select {...form.register('academicYearId')}>
                  <option value="">
                    {hasAcademicYears
                      ? 'Select academic year'
                      : 'Create academic year in Settings'}
                  </option>
                  {(academicYearsQuery.data ?? []).map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                      {year.isCurrent ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Class" error={fieldError(form.formState.errors.classId)}>
                <select {...form.register('classId')}>
                  <option value="">
                    {hasClasses ? 'Select class' : 'Create class in Settings'}
                  </option>
                  {(classesQuery.data ?? []).map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Section" error={fieldError(form.formState.errors.sectionId)}>
                <select {...form.register('sectionId')}>
                  <option value="">
                    {availableSections.length > 0
                      ? 'No section selected'
                      : 'No section yet'}
                  </option>
                  {availableSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.class?.name ? `${section.class.name} / ` : ''}
                      {section.name}
                    </option>
                  ))}
                </select>
                {hasClasses && availableSections.length === 0 ? (
                  <p className="mt-2 text-xs text-gray-500">
                    Section is optional. You can create sections later in Settings.
                  </p>
                ) : null}
              </Field>
              <Field label="Roll number" error={fieldError(form.formState.errors.rollNumber)}>
                <input
                  type="number"
                  min={1}
                  placeholder="Optional roll number"
                  {...form.register('rollNumber')}
                />
              </Field>
              <Field
                label="Admission date"
                error={fieldError(form.formState.errors.admissionDate)}
              >
                <input type="date" {...form.register('admissionDate')} />
              </Field>
              <Field
                label="Admission number"
                error={fieldError(form.formState.errors.admissionNumber)}
              >
                <input
                  placeholder="Optional school admission number"
                  {...form.register('admissionNumber')}
                />
              </Field>
              <Field
                label="Medium of instruction"
                error={fieldError(form.formState.errors.mediumOfInstruction)}
              >
                <input {...form.register('mediumOfInstruction')} />
              </Field>
            </div>
          </StepCard>
        ) : null}

        {activeStep === 2 ? (
          <StepCard
            eyebrow="Step 3"
            title="Guardian Contacts"
            description="At least one guardian with a valid phone number is required for emergency contact and future app invites."
            action={
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={guardians.fields.length >= 3}
                onClick={() =>
                  guardians.append({
                    fullName: '',
                    relation: 'guardian',
                    primaryPhone: '',
                    isPrimary: false,
                  })
                }
              >
                Add guardian
              </button>
            }
          >
            <div className="grid gap-4">
              {guardians.fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Guardian {index + 1}
                      </p>
                      <p className="text-xs text-gray-500">
                        App invite will use the primary phone when provider setup is enabled.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="primaryGuardian"
                          checked={Boolean(watchedGuardians[index]?.isPrimary)}
                          onChange={() => markPrimaryGuardian(index)}
                        />
                        Primary
                      </label>
                      {guardians.fields.length > 1 ? (
                        <button
                          type="button"
                          className="min-h-11 rounded-xl border border-danger-200 bg-white px-3 text-sm font-semibold text-danger-600"
                          onClick={() => guardians.remove(index)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field
                      label="Full name"
                      error={fieldError(form.formState.errors.guardians?.[index]?.fullName)}
                    >
                      <input
                        placeholder="Guardian full name"
                        {...form.register(`guardians.${index}.fullName`)}
                      />
                    </Field>
                    <Field
                      label="Relation"
                      error={fieldError(form.formState.errors.guardians?.[index]?.relation)}
                    >
                      <input
                        placeholder="mother, father, guardian"
                        {...form.register(`guardians.${index}.relation`)}
                      />
                    </Field>
                    <Field
                      label="Primary phone"
                      error={fieldError(form.formState.errors.guardians?.[index]?.primaryPhone)}
                    >
                      <input
                        placeholder="Required phone number"
                        {...form.register(`guardians.${index}.primaryPhone`)}
                      />
                    </Field>
                    <Field
                      label="Email"
                      error={fieldError(form.formState.errors.guardians?.[index]?.email)}
                    >
                      <input
                        type="email"
                        placeholder="Optional email"
                        {...form.register(`guardians.${index}.email`)}
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </StepCard>
        ) : null}

        {activeStep === 3 ? (
          <StepCard
            eyebrow="Step 4"
            title="Documents & Review"
            description="Attach an admission document, review the placement, and submit the enrollment."
          >
            <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="label mb-4">Admission Document</p>
                <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                  <select
                    value={documentKind}
                    onChange={(event) => setDocumentKind(event.target.value)}
                  >
                    {documentKinds.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="file"
                    onChange={(event) =>
                      setDocumentFile(event.target.files?.[0] ?? null)
                    }
                  />
                </div>
                <p className="mt-3 text-sm text-gray-500">
                  {documentFile
                    ? `${documentFile.name} · ${formatFileSize(documentFile.size)}`
                    : 'No file selected. You can still create the admission and add documents later.'}
                </p>
              </div>

              <ReviewCard
                academicYear={selectedAcademicYear?.name ?? 'Not selected'}
                className={selectedClass?.name ?? 'Not selected'}
                documentCount={documentFile ? 1 : 0}
                guardianNames={watchedGuardians
                  .map((guardian) => guardian.fullName)
                  .filter(Boolean)}
                sectionName={selectedSection?.name ?? 'No section'}
                studentName={`${watchedFirstNameEn ?? ''} ${watchedLastNameEn ?? ''}`.trim()}
              />
            </div>

            {duplicateWarning?.hasWarnings ? (
              <DuplicateWarning
                duplicateWarning={duplicateWarning}
                onCreateAnyway={form.handleSubmit((values) =>
                  submitAdmission(values, true),
                )}
              />
            ) : null}

            {mutation.isError ? (
              <p className="rounded-2xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-600">
                {mutation.error.message}
              </p>
            ) : null}
          </StepCard>
        ) : null}

        {activeStep === 4 && latestAdmission ? (
          <SuccessPanel
            latestAdmission={latestAdmission}
            pdfError={pdfError}
            onAddAnother={addAnotherStudent}
            onOpenPdf={(kind) => void openStudentPdf(latestAdmission.student.id, kind)}
          />
        ) : null}

        {activeStep < 4 ? (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={activeStep === 0}
              onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
            >
              Back
            </button>
            {activeStep < 3 ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white"
                onClick={() => void goToNextStep()}
              >
                Continue
              </button>
            ) : (
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary-600 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={mutation.isPending || setupIsMissing}
              >
                {mutation.isPending ? 'Creating admission...' : 'Create admission'}
              </button>
            )}
          </div>
        ) : null}
      </form>

      <BulkImportPanel
        bulkConfirmDuplicates={bulkConfirmDuplicates}
        bulkCsv={bulkCsv}
        bulkMutation={bulkMutation}
        sampleBulkCsv={sampleBulkCsv}
        setBulkConfirmDuplicates={setBulkConfirmDuplicates}
        setBulkCsv={setBulkCsv}
      />

      <RecentAdmissions
        admissions={admissionsQuery.data ?? []}
        isError={admissionsQuery.isError}
        isLoading={admissionsQuery.isLoading}
        pdfError={pdfError}
        students={studentsQuery.data ?? []}
        onOpenPdf={(studentId, kind) => void openStudentPdf(studentId, kind)}
      />
    </div>
  );
}

function Stepper({
  activeStep,
  completed,
}: {
  activeStep: number;
  completed: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-5" aria-label="Admission steps">
      {enrollmentSteps.map((label, index) => {
        const isActive = index === activeStep;
        const isDone = completed || index < activeStep;

        return (
          <div
            key={label}
            className={`rounded-2xl border p-3 text-sm ${
              isActive
                ? 'border-primary-200 bg-primary-50 text-primary-700'
                : isDone
                  ? 'border-success-200 bg-success-50 text-success-600'
                  : 'border-gray-200 bg-white text-gray-500'
            }`}
          >
            <span className="block text-xs font-semibold uppercase tracking-[0.14em]">
              Step {index + 1}
            </span>
            <span className="mt-1 block font-semibold">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function StepCard({
  action,
  children,
  description,
  eyebrow,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="label mb-2">{eyebrow}</p>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            {description}
          </p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  children,
  error,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="block">
      <span className="label mb-2 block">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-xs text-danger-600">{error}</span> : null}
    </label>
  );
}

function SetupRequiredCard({
  hasAcademicYears,
  hasClasses,
}: {
  hasAcademicYears: boolean;
  hasClasses: boolean;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="font-semibold">Setup required before enrollment</p>
      <p className="mt-2 leading-6">
        {!hasAcademicYears ? 'Create at least one academic year. ' : ''}
        {!hasClasses ? 'Create at least one class. ' : ''}
        Sections are optional and can be added from Settings.
      </p>
      <Link
        href="/dashboard/settings"
        className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white"
      >
        Open setup
      </Link>
    </div>
  );
}

function SetupSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="h-4 w-40 animate-pulse rounded-full bg-gray-100" />
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
      </div>
    </div>
  );
}

function ReviewCard({
  academicYear,
  className,
  documentCount,
  guardianNames,
  sectionName,
  studentName,
}: {
  academicYear: string;
  className: string;
  documentCount: number;
  guardianNames: string[];
  sectionName: string;
  studentName: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="label mb-4">Review</p>
      <dl className="grid gap-3 text-sm">
        <ReviewItem label="Student" value={studentName || 'Not entered'} />
        <ReviewItem label="Academic year" value={academicYear} />
        <ReviewItem label="Class / section" value={`${className} / ${sectionName}`} />
        <ReviewItem
          label="Guardians"
          value={guardianNames.length > 0 ? guardianNames.join(', ') : 'Not entered'}
        />
        <ReviewItem label="Documents" value={String(documentCount)} />
      </dl>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

function DuplicateWarning({
  duplicateWarning,
  onCreateAnyway,
}: {
  duplicateWarning: Awaited<ReturnType<typeof api.checkAdmissionDuplicates>>;
  onCreateAnyway: () => void;
}) {
  return (
    <div className="rounded-2xl border border-warning-200 bg-warning-50 p-4">
      <p className="font-semibold text-warning-600">Possible duplicate found</p>
      <div className="mt-3 grid gap-2 text-sm text-warning-600">
        {duplicateWarning.matches.map((match) => (
          <span key={match.studentId}>
            {match.fullNameEn} / {match.studentSystemId} / DOB{' '}
            {new Date(match.dateOfBirth).toLocaleDateString()}
            {match.className ? ` / ${match.className}` : ''}
          </span>
        ))}
      </div>
      <button
        type="button"
        className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-warning-600 px-4 text-sm font-semibold text-white"
        onClick={onCreateAnyway}
      >
        Create anyway
      </button>
    </div>
  );
}

function SuccessPanel({
  latestAdmission,
  onAddAnother,
  onOpenPdf,
  pdfError,
}: {
  latestAdmission: NonNullable<Awaited<ReturnType<typeof api.createAdmission>>>;
  onAddAnother: () => void;
  onOpenPdf: (kind: string) => void;
  pdfError: string;
}) {
  return (
    <section className="rounded-2xl border border-success-200 bg-success-50 p-5">
      <p className="label mb-3 text-success-600">Success / Next Actions</p>
      <h2 className="text-xl font-bold text-gray-900">
        {latestAdmission.student.fullNameEn} enrolled as{' '}
        {latestAdmission.student.studentSystemId}
      </h2>
      <div className="mt-4 grid gap-3 text-sm text-gray-700 md:grid-cols-3">
        <span>
          Guardians:{' '}
          {latestAdmission.guardians.map((item) => item.fullName).join(', ')}
        </span>
        <span>
          Invoice:{' '}
          {latestAdmission.invoice
            ? `${latestAdmission.invoice.invoiceNumber} / Rs ${latestAdmission.invoice.totalAmount}`
            : 'No fee plan assigned yet'}
        </span>
        <span>Enrollment: {latestAdmission.enrollment.id}</span>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/dashboard/finance"
          className="inline-flex min-h-11 items-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white"
        >
          Collect First Fee
        </Link>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl border border-success-200 bg-white px-4 text-sm font-semibold text-success-600"
          onClick={() => onOpenPdf('id-card')}
        >
          Download ID Card
        </button>
        <GeneratedPdfActions
          studentId={latestAdmission.student.id}
          onOpen={onOpenPdf}
        />
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
          onClick={onAddAnother}
        >
          Add Another Student
        </button>
      </div>
      {pdfError ? <p className="mt-3 text-sm text-danger-600">{pdfError}</p> : null}
    </section>
  );
}

function BulkImportPanel({
  bulkConfirmDuplicates,
  bulkCsv,
  bulkMutation,
  sampleBulkCsv,
  setBulkConfirmDuplicates,
  setBulkCsv,
}: {
  bulkConfirmDuplicates: boolean;
  bulkCsv: string;
  bulkMutation: ReturnType<typeof useMutation<Awaited<ReturnType<typeof api.bulkImportAdmissions>>, Error, Record<string, unknown>>>;
  sampleBulkCsv: string;
  setBulkConfirmDuplicates: (value: boolean) => void;
  setBulkCsv: (value: string) => void;
}) {
  return (
    <details className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer text-base font-bold text-gray-900">
        Bulk Import
      </summary>
      <p className="mt-3 text-sm leading-6 text-gray-500">
        Paste CSV rows for admin-side bulk admissions. The API validates each row,
        creates the valid rows, and returns row-level errors for the rest.
      </p>
      <textarea
        rows={5}
        value={bulkCsv}
        onChange={(event) => setBulkCsv(event.target.value)}
        placeholder={`${sampleBulkCsv}\nAsha,Lama,2019-05-12,FEMALE,${today},...`}
        className="mt-4"
      />
      <label className="mt-3 flex items-center gap-2 text-sm text-gray-500">
        <input
          type="checkbox"
          checked={bulkConfirmDuplicates}
          onChange={(event) => setBulkConfirmDuplicates(event.target.checked)}
        />
        Confirm possible duplicate rows
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700"
          onClick={() => setBulkCsv(sampleBulkCsv)}
        >
          Insert headers
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
          disabled={!bulkCsv.trim() || bulkMutation.isPending}
          onClick={() =>
            bulkMutation.mutate({
              csvContent: bulkCsv,
              confirmDuplicates: bulkConfirmDuplicates,
            })
          }
        >
          {bulkMutation.isPending ? 'Importing...' : 'Import CSV'}
        </button>
      </div>
      {bulkMutation.data ? (
        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
          <p className="font-semibold text-gray-900">
            Rows {bulkMutation.data.totalRows}, created {bulkMutation.data.created},
            failed {bulkMutation.data.failed}
          </p>
          <div className="mt-3 grid gap-2">
            {bulkMutation.data.results.slice(0, 6).map((result) => (
              <span key={result.rowNumber}>
                Row {result.rowNumber}: {result.status}
                {result.studentSystemId ? ` / ${result.studentSystemId}` : ''}
                {result.errors?.length ? ` / ${result.errors.join(', ')}` : ''}
              </span>
            ))}
          </div>
          {bulkMutation.data.errorReportCsv ? (
            <details className="mt-3">
              <summary className="cursor-pointer font-semibold text-gray-900">
                Error report CSV
              </summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs">
                {bulkMutation.data.errorReportCsv}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}
      {bulkMutation.isError ? (
        <p className="mt-3 text-sm text-danger-600">
          {bulkMutation.error.message}
        </p>
      ) : null}
    </details>
  );
}

function RecentAdmissions({
  admissions,
  isError,
  isLoading,
  onOpenPdf,
  pdfError,
  students,
}: {
  admissions: Awaited<ReturnType<typeof api.listAdmissions>>;
  isError: boolean;
  isLoading: boolean;
  onOpenPdf: (studentId: string, kind: string) => void;
  pdfError: string;
  students: Awaited<ReturnType<typeof api.listStudents>>;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="label mb-4">Recent Admissions</p>
      {isLoading ? (
        <div className="grid gap-3">
          <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      ) : null}
      {isError ? (
        <p className="rounded-2xl border border-danger-200 bg-danger-50 p-4 text-sm text-danger-600">
          Recent admissions could not load.
        </p>
      ) : null}
      {!isLoading && !isError ? (
        <div className="grid gap-3">
          {admissions.slice(0, 6).map((admission) => {
            const studentId = students.find(
              (student) => student.studentSystemId === admission.studentSystemId,
            )?.id;

            return (
              <div
                key={admission.id}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {admission.fullNameEn} / {admission.studentSystemId}
                    </p>
                    <p className="text-sm text-gray-500">
                      {admission.className}
                      {admission.sectionName ? ` / ${admission.sectionName}` : ''}
                      {admission.rollNumber ? ` / Roll ${admission.rollNumber}` : ''}
                    </p>
                  </div>
                  <p className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500">
                    {admission.documentCount} documents
                  </p>
                </div>
                <p className="mt-3 text-sm text-gray-500">
                  Guardians:{' '}
                  {admission.guardians.length > 0
                    ? admission.guardians.map((guardian) => guardian.fullName).join(', ')
                    : 'none'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Invoice:{' '}
                  {admission.latestInvoice
                    ? `${admission.latestInvoice.invoiceNumber} / ${admission.latestInvoice.status} / Rs ${admission.latestInvoice.totalAmount}`
                    : 'not generated'}
                </p>
                {studentId ? (
                  <GeneratedPdfActions
                    studentId={studentId}
                    onOpen={(kind) => onOpenPdf(studentId, kind)}
                  />
                ) : null}
              </div>
            );
          })}
          {admissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center">
              <p className="font-semibold text-gray-900">No admissions yet.</p>
              <p className="mt-2 text-sm text-gray-500">
                Completed enrollments will appear here with guardian, invoice, and
                document actions.
              </p>
            </div>
          ) : null}
          {pdfError ? <p className="text-sm text-danger-600">{pdfError}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function GeneratedPdfActions({
  studentId,
  onOpen,
}: {
  studentId: string;
  onOpen: (kind: string) => void;
}) {
  const documents = [
    ['id-card', 'ID card'],
    ['transfer-certificate', 'Transfer certificate'],
    ['leaving-certificate', 'Leaving certificate'],
    ['character-certificate', 'Character certificate'],
  ];

  return (
    <div className="mt-4 flex flex-wrap gap-2" data-student-id={studentId}>
      {documents.map(([kind, label]) => (
        <button
          key={kind}
          type="button"
          className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700"
          onClick={() => onOpen(kind)}
        >
          Open {label}
        </button>
      ))}
    </div>
  );
}

function fieldsForStep(step: number): Array<keyof AdmissionFormInput> {
  if (step === 0) {
    return ['firstNameEn', 'lastNameEn', 'dateOfBirth', 'gender'];
  }

  if (step === 1) {
    return [
      'academicYearId',
      'classId',
      'sectionId',
      'rollNumber',
      'admissionDate',
      'admissionNumber',
      'mediumOfInstruction',
    ];
  }

  if (step === 2) {
    return ['guardians'];
  }

  return [];
}

function fieldError(error: { message?: string } | undefined) {
  return error?.message;
}

function formatAge(dateOfBirth: string) {
  const birthDate = new Date(dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) {
    return 'Invalid date';
  }

  const todayDate = new Date();
  let years = todayDate.getFullYear() - birthDate.getFullYear();
  let months = todayDate.getMonth() - birthDate.getMonth();

  if (todayDate.getDate() < birthDate.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return `${Math.max(years, 0)}y ${Math.max(months, 0)}m`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
