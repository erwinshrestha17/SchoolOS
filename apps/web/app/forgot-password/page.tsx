"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, KeyRound } from "lucide-react";
import { api } from "../../lib/api";

export default function ForgotPasswordPage() {
  const [tenantSlug, setTenantSlug] = useState("");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.forgotPassword({
        tenantSlug: tenantSlug.trim(),
        email: email.trim(),
      }),
    onSuccess: () => {
      setNotice(
        "If this account can reset its password, SchoolOS has sent a reset code to the registered email.",
      );
    },
  });

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
              Forgot password
            </h1>
          </div>
        </div>
        <form
          className="mt-6 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setNotice(null);
            mutation.mutate();
          }}
        >
          <label>
            <span className="text-sm font-bold text-slate-900">
              School code
            </span>
            <input
              value={tenantSlug}
              onChange={(event) => setTenantSlug(event.target.value)}
              autoComplete="organization"
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-900/5"
            />
          </label>
          <label>
            <span className="text-sm font-bold text-slate-900">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="mt-2 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-900/5"
            />
          </label>
          <button
            type="submit"
            disabled={mutation.isPending || !tenantSlug.trim() || !email.trim()}
            className="h-11 rounded-2xl bg-[var(--primary)] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending ? "Sending reset code..." : "Send reset code"}
          </button>
        </form>
        {notice ? (
          <p className="mt-4 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </p>
        ) : null}
        {mutation.isError ? (
          <p className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            <CircleAlert className="h-4 w-4 shrink-0" />
            <span>Could not request a reset code. Please retry.</span>
          </p>
        ) : null}
        <div className="mt-6 flex justify-between text-sm font-bold">
          <Link href="/login" className="text-slate-600 hover:text-slate-950">
            Back to login
          </Link>
          <Link
            href="/reset-password"
            className="text-[var(--primary)] hover:text-[var(--primary-dark)]"
          >
            I have a code
          </Link>
        </div>
      </section>
    </main>
  );
}
