"use client";

import { CheckCircle2, Circle, RefreshCw } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/components/session-provider";
import { platformApi } from "@/lib/api/platform";
import { hasPermission } from "@/lib/session";
import { useTenantDetail } from "./tenant-detail-page";

type OnboardingTarget = { key: string; label: string; completed: boolean };

export function TenantOnboarding() {
  const { tenant, refreshTenant } = useTenantDetail();
  const { session } = useSession();
  const canManageOnboarding = hasPermission(
    session,
    "platform:onboarding:manage",
  );
  const [target, setTarget] = useState<OnboardingTarget | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveOverride() {
    if (!canManageOnboarding || !target || reason.trim().length < 5) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await platformApi.setTenantOnboardingOverride(tenant.id, {
        itemKey: target.key,
        completed: target.completed,
        reason: reason.trim(),
      });
      await refreshTenant();
      setMessage("Onboarding checklist override saved.");
      setTarget(null);
      setReason("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The onboarding override could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  const items = tenant.onboarding?.items ?? [];

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Onboarding</h2>
        <p className="mt-1 text-sm text-slate-500">
          Required setup checks and explicitly audited operator overrides.
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
        <CardHeader>
          <CardTitle className="text-xl font-black">
            Checklist progress
          </CardTitle>
          <CardDescription>
            Completion is reported by the backend; manual changes require a
            reason.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-7 flex items-center gap-4">
            <Progress
              value={tenant.onboarding?.progressPercent ?? 0}
              className="h-3 flex-1"
            />
            <span className="text-lg font-black text-[var(--color-mod-platform-accent)]">
              {tenant.onboarding?.progressPercent ?? 0}%
            </span>
          </div>
          <div className="space-y-3">
            {items.length ? (
              items.map((item) => (
                <div
                  key={item.key}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    {item.completed ? (
                      <CheckCircle2
                        className="mt-0.5 shrink-0 text-emerald-600"
                        size={19}
                      />
                    ) : (
                      <Circle
                        className="mt-0.5 shrink-0 text-slate-300"
                        size={19}
                      />
                    )}
                    <div>
                      <p className="font-bold text-slate-900">{item.label}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {item.required ? "Required" : "Optional"} ·{" "}
                        {item.source}
                      </p>
                      {item.href ? (
                        <p className="mt-1 font-mono text-xs text-slate-400">
                          {item.href}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={item.completed ? "success" : "neutral"}>
                      {item.completed ? "COMPLETE" : "OPEN"}
                    </Badge>
                    {canManageOnboarding ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl font-bold"
                        onClick={() =>
                          setTarget({
                            key: item.key,
                            label: item.label,
                            completed: !item.completed,
                          })
                        }
                      >
                        Override
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-semibold text-slate-500">
                No onboarding checklist is available for this tenant.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {canManageOnboarding ? (
        <Dialog
          open={Boolean(target)}
          onOpenChange={(open: boolean) => {
            if (!open) setTarget(null);
          }}
        >
          <DialogContent className="rounded-3xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Override checklist item</DialogTitle>
              <DialogDescription>
                {target?.label}. This manual decision is audited.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="onboarding-override-reason">Audit reason</Label>
              <Textarea
                id="onboarding-override-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why this checklist state is being changed"
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
                Save override
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
