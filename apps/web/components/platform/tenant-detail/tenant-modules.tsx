"use client";

import { Lock, RefreshCw } from "lucide-react";
import { useState } from "react";
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

const PLATFORM_MODULE_ENTITLEMENTS = [
  { key: "module.students", label: "M1 Admissions and Student Profiles" },
  { key: "module.attendance", label: "M2 Smart Attendance" },
  { key: "module.fees", label: "M3 Fees and Receipts" },
  { key: "module.exams", label: "M4 Academics, Exams, CAS, Report Cards" },
  { key: "module.activity", label: "M5 Activity Feed and Milestones" },
  { key: "module.homework", label: "M6 Homework and Timetable" },
  { key: "module.hr", label: "M7 HR and Payroll" },
  { key: "module.library", label: "M8 Library" },
  { key: "module.transport", label: "M9 Transport" },
  { key: "module.canteen", label: "M10 Canteen" },
  { key: "module.accounting", label: "M11 Accounting and Finance" },
  { key: "module.notifications", label: "M12 Notifications and Delivery" },
  { key: "module.learning", label: "M13 Learning Layer" },
  { key: "module.notices", label: "M15 Notices and Announcements" },
] as const;

export function TenantModules() {
  const { tenant, refreshTenant } = useTenantDetail();
  const { session } = useSession();
  const canManageModules = hasPermission(
    session,
    "platform:subscriptions:manage",
  );
  const [target, setTarget] = useState<{
    key: string;
    enabled: boolean;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveOverride() {
    if (!canManageModules || !target || reason.trim().length < 5) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await platformApi.setPlatformFeatureOverride(tenant.id, {
        featureKey: target.key,
        enabled: target.enabled,
        reason: reason.trim(),
      });
      await refreshTenant();
      setMessage(
        `${target.key} ${target.enabled ? "enabled" : "disabled"} by audited override.`,
      );
      setTarget(null);
      setReason("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The module override could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-2xl font-black text-slate-900">
          Modules and entitlements
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Plan-backed module access with explicit, audited tenant overrides.
        </p>
      </div>

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
            <CardTitle className="text-xl font-black">Module access</CardTitle>
            <CardDescription>
              Backend entitlement checks remain authoritative.
            </CardDescription>
          </div>
          <Badge variant="neutral">Plan: {tenant.plan}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PLATFORM_MODULE_ENTITLEMENTS.map(({ key, label }) => {
            const enabled = (tenant.enabledFeatures ?? []).includes(key);
            const override = (tenant.overrides ?? []).find(
              (item) => item.featureKey === key,
            );
            return (
              <div
                key={key}
                className={`rounded-2xl border p-4 ${enabled ? "border-slate-100 bg-white" : "border-slate-100 bg-slate-50"}`}
              >
                <div className="min-h-14">
                  <p className="text-sm font-bold text-slate-900">{label}</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-400">
                    {key}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <Badge variant={enabled ? "success" : "neutral"}>
                      {enabled ? "ENABLED" : "DISABLED"}
                    </Badge>
                    {override ? (
                      <Badge variant="warning">OVERRIDE</Badge>
                    ) : null}
                  </div>
                  {canManageModules ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl font-bold"
                      onClick={() => setTarget({ key, enabled: !enabled })}
                    >
                      {enabled ? "Disable" : "Enable"}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-rose-100 bg-rose-50/30 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-black text-rose-950">
            <Lock size={20} /> Active overrides
          </CardTitle>
          <CardDescription className="text-rose-800/70">
            Manual access decisions reported by the backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(tenant.overrides ?? []).length ? (
            tenant.overrides?.map((override) => (
              <div
                key={override.featureKey}
                className="flex flex-col gap-3 rounded-2xl border border-rose-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-mono text-sm font-bold text-slate-900">
                    {override.featureKey}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {override.reason}
                  </p>
                </div>
                <Badge variant={override.enabled ? "success" : "destructive"}>
                  {override.enabled ? "FORCED ON" : "FORCED OFF"}
                </Badge>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-rose-200 bg-white/60 p-8 text-center text-sm font-semibold text-rose-800">
              No active overrides.
            </p>
          )}
        </CardContent>
      </Card>

      {canManageModules ? (
        <Dialog
          open={Boolean(target)}
          onOpenChange={(open: boolean) => {
            if (!open) setTarget(null);
          }}
        >
          <DialogContent className="rounded-3xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm module override</DialogTitle>
              <DialogDescription>
                This will {target?.enabled ? "enable" : "disable"} {target?.key}{" "}
                outside the plan default. The backend records the reason.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="module-override-reason">Audit reason</Label>
              <Textarea
                id="module-override-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain the approved override"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTarget(null)}>
                Cancel
              </Button>
              <Button
                disabled={saving || reason.trim().length < 5}
                onClick={() => void saveOverride()}
              >
                {saving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Confirm override
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
