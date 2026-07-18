'use client';

import { formatNepalTime, loginSchema, type LoginInput } from '@schoolos/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, isAuthSession } from '../../lib/api';
import { useSession } from '../session-provider';

const PLATFORM_ROLES = [
  'platform_super_admin',
  'platform_support',
  'platform_billing_admin',
];

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
    onSuccess: async (result) => {
      if (isAuthSession(result)) {
        const isPlatformUser = result.user.roles.some((role) =>
          PLATFORM_ROLES.includes(role),
        );
        const defaultRedirect = result.user.mustChangePassword
          ? isPlatformUser
            ? '/platform/account-security'
            : '/dashboard/settings/personal/security'
          : isPlatformUser
            ? '/platform/dashboard'
            : '/dashboard';
        const requestedRedirect = searchParams.get('next');
        const safeRedirect = result.user.mustChangePassword
          ? defaultRedirect
          : resolvePostLoginRedirect(
              requestedRedirect,
              defaultRedirect,
              isPlatformUser,
            );

        setChallengeMessage(null);
        await setAuthenticatedSession(result);
        router.push(safeRedirect);
        return;
      }

      setChallengeMessage(
        `MFA challenge issued via ${result.delivery}. Expires at ${formatNepalTime(
          result.challengeExpiresAt,
        )}.`,
      );
    },
  });

  return (
    <form
      className="grid gap-4"
      method="post"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <div>
        <label htmlFor="tenantSlug" className="label mb-2 block">
          School Code
        </label>
        <input
          {...register('tenantSlug')}
          id="tenantSlug"
          placeholder="e.g. green-valley-school"
          autoComplete="organization"
        />
        <p className="mt-2 text-xs text-slate-500">
          Enter the school code provided by your school administrator.
        </p>
        {errors.tenantSlug ? (
          <p className="mt-2 text-sm text-[var(--danger)]">
            {errors.tenantSlug.message}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="email" className="label mb-2 block">
          Email
        </label>
        <input
          {...register('email')}
          id="email"
          type="email"
          placeholder="admin@school.edu.np"
          autoComplete="email"
        />
        {errors.email ? (
          <p className="mt-2 text-sm text-[var(--danger)]">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="password" className="label mb-2 block">
          Password
        </label>
        <input
          id="password"
          type="password"
          {...register('password')}
          placeholder="Enter your password"
          autoComplete="current-password"
        />
        {errors.password ? (
          <p className="mt-2 text-sm text-[var(--danger)]">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-2xl bg-[var(--primary)] px-5 py-3 font-semibold text-white shadow-md shadow-[var(--primary-soft)] transition-all hover:bg-[var(--primary-dark)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {mutation.isPending ? 'Signing in...' : 'Sign in'}
      </button>

      {mutation.isError ? (
        <p className="text-sm text-[var(--danger)]">{mutation.error.message}</p>
      ) : null}

      <div className="text-right">
        <a
          href="/forgot-password"
          className="text-sm font-bold text-[var(--primary)] hover:text-[var(--primary-dark)]"
        >
          Forgot password?
        </a>
      </div>

      {challengeMessage ? (
        <p className="text-sm text-[var(--primary)]">{challengeMessage}</p>
      ) : null}

      {mutation.isSuccess && !challengeMessage ? (
        <p className="text-sm text-[var(--success)]">
          Login request completed.
        </p>
      ) : null}
    </form>
  );
}

function resolvePostLoginRedirect(
  requestedRedirect: string | null,
  defaultRedirect: string,
  isPlatformUser: boolean,
) {
  if (!requestedRedirect?.startsWith('/')) {
    return defaultRedirect;
  }

  if (isPlatformUser) {
    return requestedRedirect.startsWith('/platform')
      ? requestedRedirect
      : defaultRedirect;
  }

  return requestedRedirect.startsWith('/dashboard')
    ? requestedRedirect
    : defaultRedirect;
}
