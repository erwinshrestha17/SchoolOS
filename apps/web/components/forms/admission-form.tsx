'use client';

import { admissionFormSchema, type AdmissionFormInput } from '@schoolos/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { api } from '../../lib/api';

export function AdmissionForm() {
  const form = useForm<AdmissionFormInput>({
    resolver: zodResolver(admissionFormSchema),
    defaultValues: {
      mediumOfInstruction: 'English',
      guardians: [{ fullName: '', relation: 'mother', primaryPhone: '', isPrimary: true }],
    },
  });

  const guardians = useFieldArray({
    control: form.control,
    name: 'guardians',
  });

  const mutation = useMutation({
    mutationFn: api.createAdmission,
  });

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={form.handleSubmit((values) =>
        mutation.mutate({
          ...values,
          gender: 'FEMALE',
          admissionDate: new Date().toISOString(),
        }),
      )}
    >
      {[
        ['firstNameEn', 'First name (EN)'],
        ['lastNameEn', 'Last name (EN)'],
        ['firstNameNp', 'First name (NP)'],
        ['lastNameNp', 'Last name (NP)'],
        ['dateOfBirth', 'Date of birth'],
        ['academicYearId', 'Academic year ID'],
        ['classId', 'Class ID'],
        ['sectionId', 'Section ID'],
        ['mediumOfInstruction', 'Medium'],
      ].map(([name, label]) => (
        <div key={name}>
          <label className="label mb-2 block">{label}</label>
          <input {...form.register(name as keyof AdmissionFormInput)} />
        </div>
      ))}

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

      <button className="rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white md:col-span-2">
        {mutation.isPending ? 'Creating admission...' : 'Create admission'}
      </button>
      {mutation.isSuccess ? (
        <p className="md:col-span-2 text-sm text-[var(--teal)]">
          Admission created. The backend will link guardians, create enrollment, and auto-generate the initial invoice when fee plans exist.
        </p>
      ) : null}
    </form>
  );
}
