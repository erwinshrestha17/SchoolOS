'use client';

import { tenantRegistrationSchema, type TenantRegistrationInput } from '@schoolos/core';
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

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      {[
        ['name', 'School name'],
        ['slug', 'Tenant slug'],
        ['plan', 'Plan'],
        ['adminEmail', 'Admin email'],
        ['adminPassword', 'Admin password'],
      ].map(([name, label]) => (
        <div key={name} className={name === 'adminPassword' ? 'md:col-span-2' : ''}>
          <label className="label mb-2 block">{label}</label>
          <input
            type={name === 'adminPassword' ? 'password' : 'text'}
            {...register(name as keyof TenantRegistrationInput)}
          />
          {errors[name as keyof TenantRegistrationInput] ? (
            <p className="mt-2 text-sm text-[var(--accent-dark)]">
              {String(errors[name as keyof TenantRegistrationInput]?.message ?? '')}
            </p>
          ) : null}
        </div>
      ))}
      <button className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white md:col-span-2">
        {mutation.isPending ? 'Creating tenant...' : 'Create tenant'}
      </button>
      {mutation.isSuccess ? (
        <p className="md:col-span-2 text-sm text-[var(--teal)]">
          Tenant provisioned. Default roles, accounts, fee heads, and academic year are created on the API side.
        </p>
      ) : null}
    </form>
  );
}
