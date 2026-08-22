"use client";

import { formatBsDate } from "@schoolos/core";
import { AlertTriangle, ArrowRight, Database, Users } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/components/session-provider";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hasAllPermissions, hasPermission } from "@/lib/session";
import { useTenantDetail } from "./tenant-detail-page";
import { tenantSectionHref } from "./tenant-detail-routes";

export function TenantOverview() {
  const { tenant } = useTenantDetail();
  const { session } = useSession();
  const canReadUsage = hasPermission(session, "platform:usage:read");
  const canReadSubscriptions = hasPermission(
    session,
    "platform:subscriptions:read",
  );
  const canReadBilling = hasPermission(session, "platform:billing:read");
  const canReadOnboarding = hasPermission(session, "platform:onboarding:read");
  const canReadProviders = hasPermission(session, "platform:providers:read");
  const canReadPlanLimits = hasAllPermissions(session, [
    "platform:subscriptions:read",
    "platform:usage:read",
  ]);
  const usageWarnings = (
    canReadUsage ? (tenant.usageCounters ?? []) : []
  ).filter(
    (counter) => counter.limit != null && counter.value >= counter.limit * 0.9,
  );
  const providerIssues = (
    canReadProviders ? (tenant.providerReadiness ?? []) : []
  ).filter((provider) => provider.status !== "ready");
  const onboardingOpen = (
    canReadOnboarding ? (tenant.onboarding?.items ?? []) : []
  ).filter((item) => item.required && !item.completed).length;

  return (
    <div className="space-y-7">
      <section aria-labelledby="tenant-summary-heading">
        <div className="mb-4">
          <h2
            id="tenant-summary-heading"
            className="text-2xl font-black text-slate-900"
          >
            Decision summary
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Current tenant state and the operator queues that need attention.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryMetric
            label="Student records"
            value={tenant.studentCount.toLocaleString()}
            icon={Users}
          />
          <SummaryMetric
            label="Staff records"
            value={tenant.staffCount.toLocaleString()}
            icon={Users}
          />
          {canReadUsage ? (
            <SummaryMetric
              label="Storage used"
              value={
                tenant.usage?.storageSizeBytes == null
                  ? "Unavailable"
                  : formatBytes(tenant.usage.storageSizeBytes)
              }
              icon={Database}
            />
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {canReadSubscriptions ? (
          <AttentionCard
            title="Subscription"
            status={tenant.subscription?.status ?? "UNASSIGNED"}
            description={
              tenant.subscription?.planName ?? "No SchoolOS plan assigned"
            }
            href={tenantSectionHref(tenant.id, "subscription")}
            needsAttention={
              !tenant.subscription ||
              !["ACTIVE", "TRIAL"].includes(tenant.subscription.status)
            }
          />
        ) : null}
        {canReadOnboarding ? (
          <AttentionCard
            title="Onboarding"
            status={`${tenant.onboarding?.progressPercent ?? 0}% complete`}
            description={
              onboardingOpen
                ? `${onboardingOpen} required item${onboardingOpen === 1 ? "" : "s"} open`
                : "Required checks complete"
            }
            href={tenantSectionHref(tenant.id, "onboarding")}
            needsAttention={onboardingOpen > 0}
          />
        ) : null}
        {canReadProviders ? (
          <AttentionCard
            title="Integrations"
            status={
              providerIssues.length
                ? `${providerIssues.length} need review`
                : "No reported issues"
            }
            description="Backend-reported provider readiness for this tenant"
            href={tenantSectionHref(tenant.id, "integrations")}
            needsAttention={providerIssues.length > 0}
          />
        ) : null}
        {canReadPlanLimits ? (
          <AttentionCard
            title="Plan limits"
            status={
              usageWarnings.length
                ? `${usageWarnings.length} near limit`
                : "Within reported limits"
            }
            description="Usage counters at or above 90% of their configured limit"
            href={tenantSectionHref(tenant.id, "subscription")}
            needsAttention={usageWarnings.length > 0}
          />
        ) : null}
      </div>

      <Card className="rounded-3xl border-slate-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-black">Tenant record</CardTitle>
          <CardDescription>
            Stable identifiers and registration context.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <RecordValue label="Plan key" value={tenant.plan || "Not assigned"} />
          {canReadBilling ? (
            <RecordValue
              label="PAN / VAT"
              value={tenant.panNumber || "Not provided"}
            />
          ) : null}
          <RecordValue
            label="Registered"
            value={formatDate(tenant.createdAt)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-mod-platform-bg)] text-[var(--color-mod-platform-accent)]">
        <Icon size={21} />
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function AttentionCard({
  title,
  status,
  description,
  href,
  needsAttention,
}: {
  title: string;
  status: string;
  description: string;
  href: string;
  needsAttention: boolean;
}) {
  return (
    <Card
      className={`rounded-3xl shadow-sm ${needsAttention ? "border-amber-200" : "border-slate-100"}`}
    >
      <CardContent className="flex items-start justify-between gap-5 p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-slate-900">{title}</h3>
            <Badge variant={needsAttention ? "warning" : "success"}>
              {status}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <Link
          href={href}
          aria-label={`Open ${title}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-[var(--color-mod-platform-border)] hover:text-[var(--color-mod-platform-accent)]"
        >
          {needsAttention ? (
            <AlertTriangle size={18} />
          ) : (
            <ArrowRight size={18} />
          )}
        </Link>
      </CardContent>
    </Card>
  );
}

function RecordValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date not recorded"
    : formatBsDate(date);
}

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
