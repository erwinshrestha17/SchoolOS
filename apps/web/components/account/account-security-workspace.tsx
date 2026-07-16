"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleAlert,
  KeyRound,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { api, ApiRequestError } from "../../lib/api";
import { useSession } from "../session-provider";
import { Button } from "../ui/button";

type Notice = {
  kind: "success" | "error";
  text: string;
};

type PasswordDraft = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  logoutOtherDevices: boolean;
};

const initialDraft: PasswordDraft = {
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
  logoutOtherDevices: true,
};

export function AccountSecurityWorkspace({
  plane = "dashboard",
}: {
  plane?: "dashboard" | "platform";
}) {
  const { session, refreshSession, logout } = useSession();
  const [draft, setDraft] = useState<PasswordDraft>(initialDraft);
  const [notice, setNotice] = useState<Notice | null>(null);

  const passwordIssues = useMemo(
    () => getPasswordIssues(draft.newPassword, session?.user.email ?? null),
    [draft.newPassword, session?.user.email],
  );

  const mutation = useMutation({
    mutationFn: () =>
      api.changePassword({
        currentPassword: draft.currentPassword,
        newPassword: draft.newPassword,
        confirmNewPassword: draft.confirmNewPassword,
        logoutOtherDevices: draft.logoutOtherDevices,
      }),
    onSuccess: async (result) => {
      setDraft(initialDraft);
      await refreshSession();
      setNotice({
        kind: "success",
        text:
          result.message ||
          "Password changed. For your security, other sessions have been signed out.",
      });
    },
    onError: (error) => {
      setNotice({
        kind: "error",
        text: friendlyPasswordError(error),
      });
    },
  });

  function submit() {
    setNotice(null);

    if (!draft.currentPassword) {
      setNotice({ kind: "error", text: "Enter your current password." });
      return;
    }

    if (passwordIssues.length > 0) {
      setNotice({ kind: "error", text: passwordIssues[0] });
      return;
    }

    if (draft.newPassword !== draft.confirmNewPassword) {
      setNotice({
        kind: "error",
        text: "Confirm password must match new password.",
      });
      return;
    }

    mutation.mutate();
  }

  const forceChange = session?.user.mustChangePassword ?? false;
  const accent =
    plane === "platform"
      ? "border-indigo-200 bg-indigo-50 text-indigo-950"
      : "border-slate-200 bg-white text-slate-950";

  return (
    <div className="space-y-6">
      <section className={`rounded-2xl border p-5 shadow-sm ${accent}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                M0 Auth/Security
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">
                Account &amp; Security
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Change your SchoolOS password using the authenticated backend
                session. Other signed-in devices are signed out by default.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => void logout()}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </section>

      {forceChange ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
          Your account is using a temporary password. Change it before opening
          other SchoolOS workspaces.
        </div>
      ) : null}

      {notice ? (
        <div
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
            notice.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.45fr)]">
        <form
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-slate-500" />
            <h2 className="font-bold text-slate-950">Change password</h2>
          </div>
          <div className="mt-5 grid gap-4">
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              value={draft.currentPassword}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  currentPassword: value,
                }))
              }
            />
            <PasswordField
              label="New password"
              autoComplete="new-password"
              value={draft.newPassword}
              onChange={(value) =>
                setDraft((current) => ({ ...current, newPassword: value }))
              }
            />
            <PasswordField
              label="Confirm new password"
              autoComplete="new-password"
              value={draft.confirmNewPassword}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  confirmNewPassword: value,
                }))
              }
            />
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={draft.logoutOtherDevices}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    logoutOtherDevices: event.target.checked,
                  }))
                }
              />
              <span>
                <span className="block text-sm font-bold text-slate-900">
                  Logout from other devices
                </span>
                <span className="mt-1 block text-sm leading-6 text-slate-600">
                  Recommended. Your current browser session can continue after
                  the password is changed.
                </span>
              </span>
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              <KeyRound className="h-4 w-4" />
              {mutation.isPending ? "Changing password..." : "Change password"}
            </Button>
          </div>
        </form>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-950">Password policy</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {[
              "Minimum 8 characters",
              "At least 1 uppercase letter",
              "At least 1 lowercase letter",
              "At least 1 number",
              "At least 1 symbol",
              "Cannot include your email or name",
              "Cannot use common school passwords",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </div>
  );
}

function PasswordField({
  label,
  value,
  autoComplete,
  onChange,
}: {
  label: string;
  value: string;
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm font-bold text-slate-900">{label}</span>
      <input
        type="password"
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-900/5"
      />
    </label>
  );
}

function getPasswordIssues(password: string, email: string | null) {
  const issues: string[] = [];
  const normalized = password.toLowerCase();
  const commonPasswords = ["admin123", "password123", "school123"];
  const emailParts =
    email
      ?.toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((part) => part.length >= 3) ?? [];

  if (password.length < 8)
    issues.push("Password must be at least 8 characters.");
  if (!/[A-Z]/.test(password))
    issues.push("Password needs an uppercase letter.");
  if (!/[a-z]/.test(password))
    issues.push("Password needs a lowercase letter.");
  if (!/\d/.test(password)) issues.push("Password needs a number.");
  if (!/[^A-Za-z0-9]/.test(password)) issues.push("Password needs a symbol.");
  if (commonPasswords.includes(normalized)) {
    issues.push("Password must not use a common school password.");
  }
  if (emailParts.some((part) => normalized.includes(part))) {
    issues.push("Password must not include your email.");
  }

  return issues;
}

function friendlyPasswordError(error: unknown) {
  if (!(error instanceof ApiRequestError)) {
    return "Network error. Please retry when your connection is stable.";
  }

  if (error.statusCode === 401) {
    return "Your session expired. Sign in again before changing your password.";
  }

  if (error.statusCode === 403) {
    return "This account is not allowed to change password right now.";
  }

  return error.message || "Could not change password. Please try again.";
}
