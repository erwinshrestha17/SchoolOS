'use client';

import { loginSchema, type LoginInput } from '@schoolos/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '../../lib/api';

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      tenantSlug: 'default-school',
      email: 'admin@schoolos.com',
      password: 'admin12345',
    },
  });

  const mutation = useMutation({
    mutationFn: api.login,
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <div>
        <label className="label mb-2 block">Tenant Slug</label>
        <input {...register('tenantSlug')} />
        {errors.tenantSlug ? (
          <p className="mt-2 text-sm text-[var(--accent-dark)]">{errors.tenantSlug.message}</p>
        ) : null}
      </div>
      <div>
        <label className="label mb-2 block">Email</label>
        <input {...register('email')} />
        {errors.email ? (
          <p className="mt-2 text-sm text-[var(--accent-dark)]">{errors.email.message}</p>
        ) : null}
      </div>
      <div>
        <label className="label mb-2 block">Password</label>
        <input type="password" {...register('password')} />
        {errors.password ? (
          <p className="mt-2 text-sm text-[var(--accent-dark)]">{errors.password.message}</p>
        ) : null}
      </div>
      <button className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white">
        {mutation.isPending ? 'Signing in...' : 'Sign in'}
      </button>
      {mutation.isError ? (
        <p className="text-sm text-[var(--accent-dark)]">{mutation.error.message}</p>
      ) : null}
      {mutation.isSuccess ? (
        <p className="text-sm text-[var(--teal)]">Login request completed. Refresh cookie flow is active on the API.</p>
      ) : null}
    </form>
  );
}
