'use client';

import {
  tenantRegistrationSchema,
  type TenantRegistrationInput,
} from '@schoolos/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '../../lib/api';

export function TenantRegistrationForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TenantRegistrationInput>({
    resolver: zodResolver(tenantRegistrationSchema),
    defaultValues: {
      plan: 'standard',
    },
  });

  const mutation = useMutation({
    mutationFn: api.registerTenant,
  });

  const fields: Array<{
    name: keyof TenantRegistrationInput;
    label: string;
    type: 'text' | 'email' | 'password';
    placeholder?: string;
    helperText?: string;
    autoComplete?: string;
  }> = [
    {
      name: 'name',
      label: 'School Name',
      type: 'text',
      placeholder: 'e.g. Green Valley School',
      autoComplete: 'organization',
    },
    {
      name: 'slug',
      label: 'School Code',
      type: 'text',
      placeholder: 'e.g. green-valley-school',
      helperText:
        'This code is used by your school staff to access the SchoolOS workspace.',
      autoComplete: 'off',
    },
    {
      name: 'plan',
      label: 'Plan',
      type: 'text',
      placeholder: 'standard',
      autoComplete: 'off',
    },
    {
      name: 'adminEmail',
      label: 'Admin Email',
      type: 'email',
      placeholder: 'admin@school.edu.np',
      autoComplete: 'email',
    },
    {
      name: 'adminPassword',
      label: 'Admin Password',
      type: 'password',
      placeholder: 'Create a secure password',
      autoComplete: 'new-password',
    },
  ];

  return (
    <form
      className="grid gap-5"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      {fields.map((field) => (
        <div key={field.name}>
          <label className="label mb-2 block">{field.label}</label>

          <input
            type={field.type}
            placeholder={field.placeholder}
            autoComplete={field.autoComplete}
            {...register(field.name)}
          />

          {field.helperText ? (
            <p className="mt-2 text-sm text-slate-500">{field.helperText}</p>
          ) : null}

          {errors[field.name] ? (
            <p className="mt-2 text-sm text-[var(--danger)]">
              {String(errors[field.name]?.message ?? '')}
            </p>
          ) : null}
        </div>
      ))}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-2xl bg-[var(--primary)] px-5 py-3 font-semibold text-white shadow-md shadow-[var(--primary-soft)] transition-all hover:bg-[var(--primary-dark)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {mutation.isPending
          ? 'Creating school workspace...'
          : 'Create school workspace'}
      </button>

      {mutation.isSuccess ? (
        <p className="text-sm text-[var(--success)]">
          School workspace created. Default roles, accounts, fee heads, and
          academic year are created on the API side.
        </p>
      ) : null}

      {mutation.isError ? (
        <p className="text-sm text-[var(--danger)]">
          {mutation.error.message}
        </p>
      ) : null}
    </form>
  );
}