'use client';

import { loginSchema, type LoginInput } from '@schoolos/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, isAuthSession } from '../../lib/api';
import { useSession } from '../session-provider';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuthenticatedSession } = useSession();
  const [challengeMessage, setChallengeMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      tenantSlug: '',
      email: '',
      password: '',
    },
  });

  const mutation = useMutation({
    mutationFn: api.login,
    onSuccess: (result) => {
      if (isAuthSession(result)) {
        setChallengeMessage(null);
        setAuthenticatedSession(result);
        router.push(searchParams.get('next') ?? '/dashboard');
        return;
      }

      setChallengeMessage(
        `MFA challenge issued via ${result.delivery}. Expires at ${new Date(
          result.challengeExpiresAt,
        ).toLocaleTimeString()}.`,
      );
    },
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <div>
        <label className="label mb-2 block">School Code</label>
        <input
          {...register('tenantSlug')}
          placeholder="e.g. green-valley-school"
          autoComplete="organization"
        />
        <p className="mt-2 text-xs text-slate-500">
          Enter the school code provided by your school administrator.
        </p>
        {errors.tenantSlug ? (
          <p className="mt-2 text-sm text-[var(--accent-dark)]">
            {errors.tenantSlug.message}
          </p>
        ) : null}
      </div>

      <div>
        <label className="label mb-2 block">Email</label>
        <input
          {...register('email')}
          type="email"
          placeholder="admin@school.edu.np"
          autoComplete="email"
        />
        {errors.email ? (
          <p className="mt-2 text-sm text-[var(--accent-dark)]">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div>
        <label className="label mb-2 block">Password</label>
        <input
          type="password"
          {...register('password')}
          placeholder="Enter your password"
          autoComplete="current-password"
        />
        {errors.password ? (
          <p className="mt-2 text-sm text-[var(--accent-dark)]">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-3 font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:from-indigo-600 hover:to-violet-700 hover:shadow-lg hover:shadow-indigo-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {mutation.isPending ? 'Signing in...' : 'Sign in'}
      </button>

      {mutation.isError ? (
        <p className="text-sm text-[var(--accent-dark)]">
          {mutation.error.message}
        </p>
      ) : null}

      {challengeMessage ? (
        <p className="text-sm text-[var(--accent)]">{challengeMessage}</p>
      ) : null}

      {mutation.isSuccess && !challengeMessage ? (
        <p className="text-sm text-[var(--teal)]">
          Login request completed. Secure cookie flow is active and only
          non-sensitive dashboard session metadata is stored in the browser.
        </p>
      ) : null}
    </form>
  );
}