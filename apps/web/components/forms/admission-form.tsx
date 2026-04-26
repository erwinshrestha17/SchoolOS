'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { admissionFormSchema, type AdmissionFormInput } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { api } from '../../lib/api';
import { fileToBase64Payload } from '../../lib/files';

const today = new Date().toISOString().slice(0, 10);

export function AdmissionForm() {
  const queryClient = useQueryClient();
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentKind, setDocumentKind] = useState('BIRTH_CERTIFICATE');

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
    },
  });

  async function submitAdmission(values: AdmissionFormInput) {
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
      documents: documentPayload ? [documentPayload] : [],
    });
  }

  const latestAdmission = mutation.data;

  return (
    <div className="grid gap-6">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(submitAdmission)}>
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
          <option value="">Select academic year</option>
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
          <option value="">Select class</option>
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
          <option value="">No section yet</option>
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
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Creating admission...' : 'Create admission'}
      </button>
      {mutation.isError ? (
        <p className="md:col-span-2 text-sm text-[var(--accent-dark)]">
          {mutation.error.message}
        </p>
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
        </section>
      ) : null}

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
