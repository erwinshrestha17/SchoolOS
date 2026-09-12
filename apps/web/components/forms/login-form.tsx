'use client';

import { formatNepalTime, loginSchema, type LoginInput } from '@schoolos/core';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { FormField, Input } from '../ui/form-field';
import { Button } from '../ui/button';
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
  const [showPassword, setShowPassword] = useState(false);
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
      noValidate
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
    >
      <FormField
        label="School Code"
        description="Enter the school code provided by your school administrator."
        error={errors.tenantSlug?.message}
      >
        <Input {...register('tenantSlug')} id="tenantSlug" aria-required="true"
          placeholder="e.g. green-valley-school" autoComplete="organization"
          autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </FormField>
      <FormField label="Email" error={errors.email?.message}>
        <Input {...register('email')} id="email" type="email" aria-required="true"
          placeholder="admin@school.edu.np" autoComplete="email"
          autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </FormField>
      <FormField label="Password" error={errors.password?.message}>
        <div className="relative">
          <Input {...register('password')} id="password" aria-required="true"
            type={showPassword ? 'text' : 'password'} className="pr-12"
            placeholder="Enter your password" autoComplete="current-password" />
          <button type="button" className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-[var(--muted)] hover:text-[var(--ink)]"
            aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}>
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
      </FormField>
      <Button type="submit" size="lg" isLoading={mutation.isPending}>
        {mutation.isPending ? 'Signing in...' : 'Sign in'}
      </Button>
      {mutation.isError ? <p role="alert" className="text-sm text-[var(--danger-text)]">{mutation.error.message}</p> : null}

      <div className="text-right">
        <a
          href="/forgot-password"
          className="text-sm font-bold text-[var(--primary)] hover:text-[var(--primary-dark)]"
        >
          Forgot password?
        </a>
      </div>

      {challengeMessage ? (
        <p role="status" className="text-sm text-[var(--primary)]">{challengeMessage}</p>
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
