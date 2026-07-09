"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, KeyRound } from "lucide-react";
import { api, ApiRequestError } from "../../lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordShell />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  return (
    <ResetPasswordShell
      initialTenantSlug={searchParams.get("tenantSlug") ?? ""}
      initialEmail={searchParams.get("email") ?? ""}
    />
  );
}

function ResetPasswordShell({
  initialTenantSlug = "",
  initialEmail = "",
}: {
  initialTenantSlug?: string;
  initialEmail?: string;
}) {
  const [tenantSlug, setTenantSlug] = useState(initialTenantSlug);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.resetPassword({
        tenantSlug: tenantSlug.trim(),
        email: email.trim(),
        code: code.trim(),
        newPassword,
        confirmNewPassword,
      }),
    onSuccess: () => setSuccess(true),
  });

  function submit() {
    setSuccess(false);
    mutation.mutate();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Account recovery
            </p>
            <h1 className="text-2xl font-black text-slate-950">
              Reset password
            </h1>
          </div>
        </div>
        <form
          className="mt-6 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <TextField
            label="School code"
            value={tenantSlug}
            onChange={setTenantSlug}
          />
          <TextField
            label="Email"
            value={email}
            onChange={setEmail}
            type="email"
          />
          <TextField label="Reset code" value={code} onChange={setCode} />
          <TextField
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            type="password"
          />
          <TextField
            label="Confirm new password"
            value={confirmNewPassword}
            onChange={setConfirmNewPassword}
            type="password"
          />
          <button
            type="submit"
            disabled={
              mutation.isPending ||
              !tenantSlug.trim() ||
              !email.trim() ||
              !code.trim() ||
              !newPassword ||
              !confirmNewPassword
            }
            className="h-11 rounded-2xl bg-[var(--primary)] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending ? "Resetting password..." : "Set new password"}
          </button>
        </form>
        {success ? (
          <p className="mt-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Password changed successfully. You can sign in now.</span>
          </p>
        ) : null}
        {mutation.isError ? (
          <p className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            <CircleAlert className="h-4 w-4 shrink-0" />
            <span>{friendlyResetError(mutation.error)}</span>
          </p>
        ) : null}
        <div className="mt-6 flex justify-between text-sm font-bold">
          <Link
            href="/forgot-password"
            className="text-slate-600 hover:text-slate-950"
          >
            Request code
          </Link>
          <Link
            href="/login"
            className="text-[var(--primary)] hover:text-[var(--primary-dark)]"
          >
            Back to login
          </Link>
        </div>
      </section>
    </main>
  );
}

function TextField({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  type?: "text" | "email" | "password";
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm font-bold text-slate-900">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-900/5"
      />
    </label>
  );
}

function friendlyResetError(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.statusCode === 401) {
      return "Your reset link is invalid or expired.";
    }
    return error.message || "Could not reset password.";
  }

  return "Network error. Please retry when your connection is stable.";
}
