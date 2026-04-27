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

export function AdmissionForm() {
  const queryClient = useQueryClient();
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

  const selectedClassId = form.watch('classId');
  const guardians = useFieldArray({
    control: form.control,
    name: 'guardians',
  });

  useEffect(() => {
    const currentAcademicYear = academicYearsQuery.data?.find((year) => year.isCurrent);
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

  const availableSections = (sectionsQuery.data ?? []).filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !selectedClassId || sectionClassId === selectedClassId;
  });
  const hasAcademicYears = (academicYearsQuery.data ?? []).length > 0;
  const hasClasses = (classesQuery.data ?? []).length > 0;

  const mutation = useMutation({
    mutationFn: api.createAdmission,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admissions'] });
      void queryClient.invalidateQueries({ queryKey: ['students'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
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

  async function submitAdmission(values: AdmissionFormInput, confirmDuplicate = false) {
    if (!confirmDuplicate) {
      const duplicates = await api.checkAdmissionDuplicates({
        firstNameEn: values.firstNameEn,
        lastNameEn: values.lastNameEn,
        dateOfBirth: new Date(values.dateOfBirth).toISOString(),
      });

      if (duplicates.hasWarnings) {
        setDuplicateWarning(duplicates);
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
      <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit((values) => submitAdmission(values))}>
      {!hasAcademicYears || !hasClasses ? (
        <div className="md:col-span-2 rounded-[24px] border border-[var(--line)] bg-white/70 p-5">
          <p className="label mb-2">Setup Required</p>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Create at least one academic year and class before admitting a
            student. Sections are optional, but they can also be created from
            Settings.
          </p>
          <Link
            href="/dashboard/settings"
            className="mt-4 inline-flex rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white"
          >
            Open setup
          </Link>
        </div>
      ) : null}

      <div>
        <label className="label mb-2 block">First name (EN)</label>
        <input {...form.register('firstNameEn')} />
      </div>
      <div>
        <label className="label mb-2 block">Last name (EN)</label>
        <input {...form.register('lastNameEn')} />
      </div>
      <div>
        <label className="label mb-2 block">First name (NP)</label>
        <input {...form.register('firstNameNp')} />
      </div>
      <div>
        <label className="label mb-2 block">Last name (NP)</label>
        <input {...form.register('lastNameNp')} />
      </div>
      <div>
        <label className="label mb-2 block">Date of birth</label>
        <input type="date" {...form.register('dateOfBirth')} />
      </div>
      <div>
        <label className="label mb-2 block">Gender</label>
        <select {...form.register('gender')}>
          <option value="FEMALE">Female</option>
          <option value="MALE">Male</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div>
        <label className="label mb-2 block">Admission date</label>
        <input type="date" {...form.register('admissionDate')} />
      </div>
      <div>
        <label className="label mb-2 block">Admission number</label>
        <input placeholder="Optional school admission number" {...form.register('admissionNumber')} />
      </div>
      <div>
        <label className="label mb-2 block">Roll number</label>
        <input type="number" min={1} placeholder="Optional roll number" {...form.register('rollNumber')} />
      </div>
      <div>
        <label className="label mb-2 block">Academic year</label>
        <select {...form.register('academicYearId')}>
          <option value="">
            {hasAcademicYears ? 'Select academic year' : 'Create academic year in Settings'}
          </option>
          {(academicYearsQuery.data ?? []).map((year) => (
            <option key={year.id} value={year.id}>
              {year.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label mb-2 block">Class</label>
        <select {...form.register('classId')}>
          <option value="">{hasClasses ? 'Select class' : 'Create class in Settings'}</option>
          {(classesQuery.data ?? []).map((classroom) => (
            <option key={classroom.id} value={classroom.id}>
              {classroom.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label mb-2 block">Section</label>
        <select {...form.register('sectionId')}>
          <option value="">
            {hasClasses ? 'No section yet' : 'Create a class before section'}
          </option>
          {availableSections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.class?.name ? `${section.class.name} / ` : ''}
              {section.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label mb-2 block">Medium</label>
        <input {...form.register('mediumOfInstruction')} />
      </div>

      <div className="md:col-span-2 rounded-[24px] border border-[var(--line)] bg-white/60 p-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="label">Guardian Contacts</p>
          <button
            type="button"
            className="rounded-full border border-[var(--line)] px-3 py-1 text-sm"
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
        </div>

        <div className="space-y-4">
          {guardians.fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 md:grid-cols-4">
              <input placeholder="Full name" {...form.register(`guardians.${index}.fullName`)} />
              <input placeholder="Relation" {...form.register(`guardians.${index}.relation`)} />
              <input
                placeholder="Primary phone"
                {...form.register(`guardians.${index}.primaryPhone`)}
              />
              <input placeholder="Email" {...form.register(`guardians.${index}.email`)} />
            </div>
          ))}
        </div>
      </div>

      <div className="md:col-span-2 rounded-[24px] border border-[var(--line)] bg-white/60 p-4">
        <p className="label mb-4">Admission document</p>
        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
          <select value={documentKind} onChange={(event) => setDocumentKind(event.target.value)}>
            <option value="BIRTH_CERTIFICATE">Birth certificate</option>
            <option value="TRANSFER_CERTIFICATE">Transfer certificate</option>
            <option value="PHOTO">Photo</option>
            <option value="ID_CARD">Guardian ID</option>
            <option value="OTHER">Other</option>
          </select>
          <input
            type="file"
            onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {Object.keys(form.formState.errors).length > 0 ? (
        <p className="md:col-span-2 text-sm text-[var(--accent-dark)]">
          Please complete the required student, class, and guardian details.
        </p>
      ) : null}

      <button
        className="rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white md:col-span-2"
        disabled={mutation.isPending || !hasAcademicYears || !hasClasses}
      >
        {mutation.isPending ? 'Creating admission...' : 'Create admission'}
      </button>
      {mutation.isError ? (
        <p className="md:col-span-2 text-sm text-[var(--accent-dark)]">
          {mutation.error.message}
        </p>
      ) : null}
      {duplicateWarning?.hasWarnings ? (
        <div className="md:col-span-2 rounded-[24px] border border-[var(--accent)] bg-white/80 p-4">
          <p className="label mb-2">Possible duplicate found</p>
          <div className="grid gap-2 text-sm text-[var(--muted)]">
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
            className="mt-4 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            onClick={form.handleSubmit((values) => submitAdmission(values, true))}
          >
            Create anyway
          </button>
        </div>
      ) : null}
      {mutation.isSuccess ? (
        <p className="md:col-span-2 text-sm text-[var(--teal)]">
          Admission created with guardian linkage, enrollment, optional document metadata, and fee side effects.
        </p>
      ) : null}
      </form>

      {latestAdmission ? (
        <section className="rounded-[24px] border border-[var(--line)] bg-white/60 p-5">
          <p className="label mb-3">Latest Admission Result</p>
          <div className="grid gap-3 text-sm text-[var(--muted)] md:grid-cols-3">
            <span>
              Student: {latestAdmission.student.fullNameEn} /{' '}
              {latestAdmission.student.studentSystemId}
            </span>
            <span>
              Guardians: {latestAdmission.guardians.map((item) => item.fullName).join(', ')}
            </span>
            <span>
              Invoice:{' '}
              {latestAdmission.invoice
                ? `${latestAdmission.invoice.invoiceNumber} / Rs ${latestAdmission.invoice.totalAmount}`
                : 'No fee plan assigned yet'}
            </span>
          </div>
          <GeneratedPdfActions
            studentId={latestAdmission.student.id}
            onOpen={(kind) => void openStudentPdf(latestAdmission.student.id, kind)}
          />
          {pdfError ? (
            <p className="mt-3 text-sm text-[var(--accent-dark)]">{pdfError}</p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-[24px] border border-[var(--line)] bg-white/60 p-5">
        <p className="label mb-3">Bulk CSV Admission Import</p>
        <p className="mb-4 text-sm leading-6 text-[var(--muted)]">
          Paste CSV rows for admin-side bulk admissions. The API validates each row,
          creates the valid rows, and returns row-level errors for the rest.
        </p>
        <textarea
          rows={5}
          value={bulkCsv}
          onChange={(event) => setBulkCsv(event.target.value)}
          placeholder={`${sampleBulkCsv}\nAsha,Lama,2019-05-12,FEMALE,2026-04-27,...`}
        />
        <label className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]">
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
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold"
            onClick={() => setBulkCsv(sampleBulkCsv)}
          >
            Insert headers
          </button>
          <button
            type="button"
            className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white/55 p-4 text-sm text-[var(--muted)]">
            <p className="font-semibold text-[var(--ink)]">
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
                <summary className="cursor-pointer font-semibold text-[var(--ink)]">
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
          <p className="mt-3 text-sm text-[var(--accent-dark)]">
            {bulkMutation.error.message}
          </p>
        ) : null}
      </section>

      <section className="rounded-[24px] border border-[var(--line)] bg-white/60 p-5">
        <p className="label mb-4">Recent Admissions</p>
        <div className="grid gap-3">
          {(admissionsQuery.data ?? []).slice(0, 6).map((admission) => (
            <div key={admission.id} className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold">
                    {admission.fullNameEn} / {admission.studentSystemId}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {admission.className}
                    {admission.sectionName ? ` / ${admission.sectionName}` : ''}
                    {admission.rollNumber ? ` / Roll ${admission.rollNumber}` : ''}
                  </p>
                </div>
                <p className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                  {admission.documentCount} documents
                </p>
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Guardians:{' '}
                {admission.guardians.length > 0
                  ? admission.guardians.map((guardian) => guardian.fullName).join(', ')
                  : 'none'}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Invoice:{' '}
                {admission.latestInvoice
                  ? `${admission.latestInvoice.invoiceNumber} / ${admission.latestInvoice.status} / Rs ${admission.latestInvoice.totalAmount}`
                  : 'not generated'}
              </p>
              {(() => {
                const studentId = studentsQuery.data?.find(
                  (student) => student.studentSystemId === admission.studentSystemId,
                )?.id;

                return studentId ? (
                  <GeneratedPdfActions
                    studentId={studentId}
                    onOpen={(kind) => void openStudentPdf(studentId, kind)}
                  />
                ) : null;
              })()}
            </div>
          ))}
          {admissionsQuery.data?.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No admissions yet.</p>
          ) : null}
        </div>
      </section>
    </div>
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
          className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-semibold"
          onClick={() => onOpen(kind)}
        >
          Open {label}
        </button>
      ))}
    </div>
  );
}
