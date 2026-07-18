"use client";

import { useId, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { api, ApiRequestError } from "../../lib/api";
import { useSession } from "../session-provider";
import { SettingsPageHeader } from "../settings/settings-page-header";
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

type PasswordFieldName =
  | "currentPassword"
  | "newPassword"
  | "confirmNewPassword";

type PasswordFieldErrors = Partial<Record<PasswordFieldName, string>>;

type PasswordRule = {
  id: string;
  label: string;
  issue: string;
  met: boolean;
};

const initialDraft: PasswordDraft = {
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
  logoutOtherDevices: true,
};

const COMMON_PASSWORDS = new Set([
  "admin123",
  "password123",
  "school123",
  "qwerty123",
  "welcome123",
  "letmein123",
]);

export function AccountSecurityWorkspace({
  plane = "dashboard",
  embedded,
}: {
  plane?: "dashboard" | "platform";
  embedded?: boolean;
}) {
  const { session, refreshSession } = useSession();
  const [draft, setDraft] = useState<PasswordDraft>(initialDraft);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [touchedFields, setTouchedFields] = useState<
    Partial<Record<PasswordFieldName, boolean>>
  >({});
  const [serverFieldErrors, setServerFieldErrors] =
    useState<PasswordFieldErrors>({});
  const isEmbedded = embedded ?? plane === "dashboard";

  const passwordRules = useMemo(
    () => getPasswordRules(draft.newPassword, session?.user.email ?? null),
    [draft.newPassword, session?.user.email],
  );
  const passwordIssues = useMemo(
    () => passwordRules.filter((rule) => !rule.met).map((rule) => rule.issue),
    [passwordRules],
  );

  const fieldErrors = useMemo<PasswordFieldErrors>(() => {
    const errors: PasswordFieldErrors = { ...serverFieldErrors };
    const showCurrentError =
      attemptedSubmit || Boolean(touchedFields.currentPassword);
    const showNewError =
      attemptedSubmit ||
      Boolean(touchedFields.newPassword) ||
      draft.newPassword.length > 0;
    const showConfirmationError =
      attemptedSubmit ||
      Boolean(touchedFields.confirmNewPassword) ||
      draft.confirmNewPassword.length > 0;

    if (showCurrentError && !draft.currentPassword) {
      errors.currentPassword = "Enter your current password.";
    }

    if (showNewError) {
      const newPasswordError = draft.newPassword
        ? passwordIssues[0]
        : "Enter a new password.";
      if (newPasswordError) {
        errors.newPassword = newPasswordError;
      }
    }

    if (showConfirmationError) {
      const confirmationError = !draft.confirmNewPassword
        ? "Confirm your new password."
        : draft.newPassword !== draft.confirmNewPassword
          ? "Confirm password must match new password."
          : undefined;
      if (confirmationError) {
        errors.confirmNewPassword = confirmationError;
      }
    }

    return errors;
  }, [
    attemptedSubmit,
    draft.confirmNewPassword,
    draft.currentPassword,
    draft.newPassword,
    passwordIssues,
    serverFieldErrors,
    touchedFields,
  ]);

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
      setAttemptedSubmit(false);
      setTouchedFields({});
      setServerFieldErrors({});
      await refreshSession();
      setNotice({
        kind: "success",
        text:
          result.message ||
          "Password changed. For your security, other sessions have been signed out.",
      });
    },
    onError: (error) => {
      const fieldError = getServerFieldError(error);
      if (fieldError) {
        setServerFieldErrors((current) => ({
          ...current,
          [fieldError.field]: fieldError.message,
        }));
        return;
      }
      setNotice({
        kind: "error",
        text: friendlyPasswordError(error),
      });
    },
  });

  function submit() {
    setNotice(null);
    setServerFieldErrors({});
    setAttemptedSubmit(true);
    setTouchedFields({
      currentPassword: true,
      newPassword: true,
      confirmNewPassword: true,
    });

    if (
      !draft.currentPassword ||
      !draft.newPassword ||
      passwordIssues.length > 0 ||
      !draft.confirmNewPassword ||
      draft.newPassword !== draft.confirmNewPassword
    ) {
      return;
    }

    mutation.mutate();
  }

  function updateField(field: PasswordFieldName, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setServerFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function markFieldTouched(field: PasswordFieldName) {
    setTouchedFields((current) => ({ ...current, [field]: true }));
  }

  const forceChange = session?.user.mustChangePassword ?? false;
  const accent =
    plane === "platform"
      ? "border-indigo-200 bg-indigo-50 text-indigo-950"
      : "border-slate-200 bg-white text-slate-950";

  return (
    <div className={isEmbedded ? "space-y-6 p-6 pb-24" : "space-y-6"}>
      {isEmbedded ? (
        <SettingsPageHeader
          title="Account & Security"
          description="Change your password and control what happens to other signed-in devices."
          scope={{ type: "personal", label: "Personal setting" }}
          access="can-manage"
        />
      ) : (
        <section className={`rounded-2xl border p-5 shadow-sm ${accent}`}>
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
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
        </section>
      )}

      {forceChange ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"
          role="status"
        >
          Your account is using a temporary password. Change it before opening
          other SchoolOS workspaces.
        </div>
      ) : null}

      {notice ? (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
            notice.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {notice.kind === "success" ? (
            <CheckCircle2
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
          ) : (
            <CircleAlert
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
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
          noValidate
        >
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-slate-500" aria-hidden="true" />
            <h2 className="font-bold text-slate-950">Change password</h2>
          </div>
          <div className="mt-5 grid gap-4">
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              value={draft.currentPassword}
              error={fieldErrors.currentPassword}
              onBlur={() => markFieldTouched("currentPassword")}
              onChange={(value) => updateField("currentPassword", value)}
            />
            <PasswordField
              label="New password"
              autoComplete="new-password"
              value={draft.newPassword}
              error={fieldErrors.newPassword}
              onBlur={() => markFieldTouched("newPassword")}
              onChange={(value) => updateField("newPassword", value)}
            />
            <PasswordField
              label="Confirm new password"
              autoComplete="new-password"
              value={draft.confirmNewPassword}
              error={fieldErrors.confirmNewPassword}
              onBlur={() => markFieldTouched("confirmNewPassword")}
              onChange={(value) => updateField("confirmNewPassword", value)}
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
                  Log out from other devices
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
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              {mutation.isPending ? "Changing password..." : "Change password"}
            </Button>
          </div>
        </form>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-950">Password policy</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {passwordRules.map((rule) => {
              const status =
                draft.newPassword.length === 0
                  ? "neutral"
                  : rule.met
                    ? "met"
                    : "unmet";
              const Icon =
                status === "met"
                  ? CheckCircle2
                  : status === "unmet"
                    ? CircleAlert
                    : Circle;

              return (
                <li
                  key={rule.id}
                  className="flex items-start justify-between gap-3"
                >
                  <span className="flex min-w-0 gap-2">
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        status === "met"
                          ? "text-emerald-600"
                          : status === "unmet"
                            ? "text-rose-600"
                            : "text-slate-300"
                      }`}
                      aria-hidden="true"
                    />
                    <span>{rule.label}</span>
                  </span>
                  <span
                    className={`shrink-0 text-xs font-bold ${
                      status === "met"
                        ? "text-emerald-700"
                        : status === "unmet"
                          ? "text-rose-700"
                          : "text-slate-400"
                    }`}
                  >
                    {status === "met"
                      ? "Met"
                      : status === "unmet"
                        ? "Not met"
                        : "Required"}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
            SchoolOS also checks other account details when you save.
          </p>
        </aside>
      </section>
    </div>
  );
}

function PasswordField({
  label,
  value,
  autoComplete,
  error,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  autoComplete: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={inputId} className="text-sm font-bold text-slate-900">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          value={value}
          required
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          className={`h-11 w-full rounded-lg border bg-white px-3 pr-12 text-sm outline-none focus:ring-2 ${
            error
              ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
              : "border-slate-200 focus:border-slate-500 focus:ring-slate-900/5"
          }`}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--primary)]"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function getPasswordRules(password: string, email: string | null) {
  const normalized = password.toLowerCase();
  const emailParts =
    email
      ?.toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((part) => part.length >= 3) ?? [];

  return [
    {
      id: "length",
      label: "Minimum 8 characters",
      issue: "Password must be at least 8 characters.",
      met: password.length >= 8,
    },
    {
      id: "uppercase",
      label: "At least 1 uppercase letter",
      issue: "Password needs an uppercase letter.",
      met: /[A-Z]/.test(password),
    },
    {
      id: "lowercase",
      label: "At least 1 lowercase letter",
      issue: "Password needs a lowercase letter.",
      met: /[a-z]/.test(password),
    },
    {
      id: "number",
      label: "At least 1 number",
      issue: "Password needs a number.",
      met: /\d/.test(password),
    },
    {
      id: "symbol",
      label: "At least 1 symbol",
      issue: "Password needs a symbol.",
      met: /[^A-Za-z0-9]/.test(password),
    },
    {
      id: "identity",
      label: "Does not include your email",
      issue: "Password must not include your account details.",
      met: !emailParts.some((part) => normalized.includes(part)),
    },
    {
      id: "common",
      label: "Is not a common school password",
      issue: "Password must not use a common school password.",
      met: !COMMON_PASSWORDS.has(normalized),
    },
  ] satisfies PasswordRule[];
}

function getServerFieldError(
  error: unknown,
): { field: PasswordFieldName; message: string } | null {
  if (!(error instanceof ApiRequestError)) {
    return null;
  }

  const normalizedMessage = error.message.toLowerCase();
  if (normalizedMessage.includes("confirm password")) {
    return {
      field: "confirmNewPassword",
      message: "Confirm password must match new password.",
    };
  }
  if (
    normalizedMessage.includes("new password") ||
    normalizedMessage.includes("password must")
  ) {
    return {
      field: "newPassword",
      message: normalizedMessage.includes("same as current")
        ? "Choose a new password that is different from your current password."
        : "Choose a stronger password that meets every requirement.",
    };
  }
  if (normalizedMessage.includes("current password")) {
    return {
      field: "currentPassword",
      message: "Current password is incorrect.",
    };
  }

  return null;
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

  if (error.statusCode === 429) {
    return "Too many password attempts. Wait a moment, then try again.";
  }

  return "Could not change password. Please try again.";
}
