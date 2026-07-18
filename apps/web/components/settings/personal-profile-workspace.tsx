"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BriefcaseBusiness,
  Mail,
  School,
  ShieldCheck,
  User,
} from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/components/session-provider";
import { useEntitlements } from "@/components/entitlements-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { SectionCard } from "@/components/ui/section-card";
import {
  SettingsPageHeader,
  SettingsPermissionNotice,
} from "@/components/settings/settings-page-header";

export function PersonalProfileWorkspace() {
  const { session, status } = useSession();
  const { hasModule } = useEntitlements();
  const profileQuery = useQuery({
    queryKey: ["auth", "profile"],
    queryFn: api.getProfile,
    enabled: status === "authenticated",
  });

  if (status === "loading") {
    return (
      <LoadingState variant="page" label="Loading your personal profile..." />
    );
  }

  if (!session) {
    return (
      <EmptyState
        title="Personal profile unavailable"
        description="Your signed-in account could not be confirmed. Refresh the page or sign in again."
        icon={<User className="h-7 w-7" />}
      />
    );
  }

  const primaryRole = session.user.roles[0];
  const profile = profileQuery.data;
  const canOpenMyWorkspace = Boolean(
    profile?.staff &&
    hasModule("hr") &&
    session.user.permissions.includes("staff:read"),
  );
  const fullName = profile?.staff
    ? [profile.staff.firstName, profile.staff.lastName]
        .filter(Boolean)
        .join(" ")
    : profile?.student
      ? [profile.student.firstNameEn, profile.student.lastNameEn]
          .filter(Boolean)
          .join(" ")
      : null;

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title="Profile"
        description="Review the personal account identity used for SchoolOS. Employment information remains in My Workspace."
        scope={{ type: "personal", label: "Personal setting" }}
        access="view-only"
      />

      <SettingsPermissionNotice
        access="view-only"
        description="Your account identity is managed by your school. You can review it here, but profile editing is not currently available for this account."
      />

      {profileQuery.isError ? (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
        >
          Your signed-in account is available, but the linked full-name record
          could not be loaded. Refresh to try again.
        </p>
      ) : null}

      <SectionCard
        title="Account identity"
        description="These details come from your authenticated account and current school workspace."
      >
        <dl className="grid gap-5 md:grid-cols-2">
          {fullName ? (
            <ProfileDetail
              icon={<User className="h-4 w-4" aria-hidden="true" />}
              label="Full name"
              value={fullName}
            />
          ) : null}
          <ProfileDetail
            icon={<Mail className="h-4 w-4" aria-hidden="true" />}
            label="Sign-in email"
            value={session.user.email ?? "No email recorded"}
          />
          <ProfileDetail
            icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
            label="Current role"
            value={
              primaryRole ? formatAccountValue(primaryRole) : "No role assigned"
            }
          />
          <ProfileDetail
            icon={<School className="h-4 w-4" aria-hidden="true" />}
            label="Current school"
            value={session.tenant.name}
          />
          <ProfileDetail
            icon={<User className="h-4 w-4" aria-hidden="true" />}
            label="Account access"
            value={
              session.user.mustChangePassword
                ? "Password change required"
                : "Active"
            }
          />
        </dl>
      </SectionCard>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/settings/personal/security"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[var(--primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Account &amp; Security
        </Link>
        {canOpenMyWorkspace ? (
          <Link
            href="/dashboard/my-workspace"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
            Open My Workspace
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function ProfileDetail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm font-semibold text-slate-950">
        {value}
      </dd>
    </div>
  );
}

function formatAccountValue(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
