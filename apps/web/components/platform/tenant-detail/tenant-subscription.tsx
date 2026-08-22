"use client";

import { formatBsDate } from "@schoolos/core";
import { AlertTriangle, CreditCard, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PlatformBoundaryNote } from "@/app/platform/_components/platform-operator-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/components/session-provider";
import { platformApi } from "@/lib/api/platform";
import { hasPermission } from "@/lib/session";
import { useTenantDetail } from "./tenant-detail-page";
import { tenantSectionHref } from "./tenant-detail-routes";

export function TenantSubscription() {
  const { tenant, refreshTenant } = useTenantDetail();
  const { session } = useSession();
  const canManageBilling = hasPermission(session, "platform:billing:manage");
  const canReadBilling = hasPermission(session, "platform:billing:read");
  const canReadUsage = hasPermission(session, "platform:usage:read");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cancelSubscription() {
    if (!canManageBilling || !tenant.subscription || reason.trim().length < 5) {
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await platformApi.updatePlatformSubscriptionStatus(
        tenant.id,
        tenant.subscription.id,
        {
          status: "CANCELLED",
          notes: `Cancelled by platform operator: ${reason.trim()}`,
        },
      );
      await refreshTenant();
      setMessage(
        "SchoolOS subscription cancelled. Module access now follows backend entitlement state.",
      );
      setCancelOpen(false);
      setReason("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The subscription could not be cancelled.",
      );
    } finally {
      setSaving(false);
    }
  }

  const subscription = tenant.subscription;
  const warnings = (canReadUsage ? (tenant.usageCounters ?? []) : []).filter(
    (counter) => counter.limit != null && counter.value >= counter.limit * 0.9,
  );

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Subscription</h2>
          <p className="mt-1 text-sm text-slate-500">
            Plan assignment, lifecycle, renewal, and backend-reported limits.
          </p>
        </div>
        {canManageBilling ? (
          <Link
            href={`/platform/schools/${encodeURIComponent(tenant.id)}/change-plan`}
          >
            <Button className="rounded-2xl font-bold">Change plan</Button>
          </Link>
        ) : null}
      </div>

      <PlatformBoundaryNote title="SchoolOS subscription boundary">
        This controls SchoolOS-to-school SaaS access. It does not create M3
        student fee invoices or post entries into the school&apos;s M11
        Accounting ledger.
      </PlatformBoundaryNote>

      {message || error ? (
        <div
          className={`rounded-2xl border p-4 text-sm font-bold ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {error ?? message}
        </div>
      ) : null}

      <Card className="rounded-3xl border-slate-100 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl font-black">
              <CreditCard size={20} /> Current plan
            </CardTitle>
            <CardDescription>
              Backend subscription record for this tenant.
            </CardDescription>
          </div>
          <Badge
            variant={
              subscription?.status === "ACTIVE" ||
              subscription?.status === "TRIAL"
                ? "success"
                : "warning"
            }
          >
            {subscription?.status ?? "UNASSIGNED"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <RecordValue
              label="Plan"
              value={subscription?.planName ?? "No plan"}
            />
            <RecordValue
              label="Starts"
              value={formatDate(subscription?.startsAt)}
            />
            <RecordValue
              label="Renews"
              value={formatDate(subscription?.renewsAt)}
            />
            <RecordValue
              label="Ends"
              value={formatDate(subscription?.endsAt)}
            />
          </div>
          {canManageBilling &&
          subscription &&
          subscription.status !== "CANCELLED" ? (
            <div className="flex justify-end border-t border-slate-100 pt-5">
              <Button
                variant="destructive"
                className="rounded-2xl font-bold"
                onClick={() => setCancelOpen(true)}
                data-testid="cancel-subscription-button"
              >
                Cancel subscription
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canReadUsage ? (
        <Card className="rounded-3xl border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-black">
              Usage and limits
            </CardTitle>
            <CardDescription>
              Values and limits returned by the platform backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(tenant.usageCounters ?? []).length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {tenant.usageCounters?.map((counter) => {
                  const ratio = counter.limit
                    ? counter.value / counter.limit
                    : 0;
                  return (
                    <div
                      key={`${counter.usageKey}-${counter.period}`}
                      className={`rounded-2xl border p-4 ${ratio >= 0.9 ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50"}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-mono text-sm font-bold text-slate-900">
                          {counter.usageKey}
                        </p>
                        {ratio >= 0.9 ? (
                          <AlertTriangle className="text-amber-600" size={18} />
                        ) : null}
                      </div>
                      <p className="mt-2 text-2xl font-black text-slate-900">
                        {counter.value.toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Limit{" "}
                        {counter.limit?.toLocaleString() ?? "not configured"} ·{" "}
                        {counter.period}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                No usage counters are available for this subscription.
              </p>
            )}
            {warnings.length ? (
              <p className="mt-4 text-sm font-bold text-amber-800">
                {warnings.length} counter{warnings.length === 1 ? "" : "s"} at
                or above 90% of the configured limit.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canReadBilling ? (
        <div className="text-sm">
          <Link
            href={tenantSectionHref(tenant.id, "billing")}
            className="font-bold text-[var(--color-mod-platform-accent)] hover:underline"
          >
            Open SaaS invoices and billing profile
          </Link>
        </div>
      ) : null}

      {canManageBilling ? (
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogContent className="rounded-3xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cancel school subscription</DialogTitle>
              <DialogDescription>
                Cancelling disables paid module access according to backend
                entitlement rules. This action is audited and must include an
                approved reason.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="cancel-subscription-reason">Audit reason</Label>
              <Textarea
                id="cancel-subscription-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why this subscription is being cancelled"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelOpen(false)}>
                Keep subscription
              </Button>
              <Button
                variant="destructive"
                disabled={saving || reason.trim().length < 5}
                onClick={() => void cancelSubscription()}
              >
                {saving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Confirm cancellation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function RecordValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : formatBsDate(date);
}
