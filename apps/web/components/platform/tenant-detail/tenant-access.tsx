"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  History,
  RefreshCw,
  Shield,
  ShieldOff,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/components/session-provider";
import { platformApi } from "@/lib/api/platform";
import { hasPermission } from "@/lib/session";
import { useTenantDetail } from "./tenant-detail-page";

export function TenantAccess() {
  const { tenant, refreshTenant } = useTenantDetail();
  const { session } = useSession();
  const canChangeStatus = hasPermission(session, "platform:tenants:status");
  const canEnterSupportMode = hasPermission(
    session,
    "platform:support:override",
  );
  const canReadAudit = hasPermission(session, "platform:audit:read");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusReason, setStatusReason] = useState("");
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [supportReason, setSupportReason] = useState("");
  const [supportDuration, setSupportDuration] = useState("30");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateTenantStatus() {
    if (!canChangeStatus || statusReason.trim().length < 5) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await platformApi.updatePlatformTenantStatus(
        tenant.id,
        !tenant.isActive,
        statusReason.trim(),
      );
      await refreshTenant();
      setMessage(
        tenant.isActive
          ? "School access suspended."
          : "School access restored.",
      );
      setStatusDialogOpen(false);
      setStatusReason("");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function enterSupportMode() {
    if (!canEnterSupportMode || supportReason.trim().length < 5) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await platformApi.enterPlatformSupportOverride({
        tenantId: tenant.id,
        reason: supportReason.trim(),
        durationMinutes: Number(supportDuration),
      });
      queryClient.clear();
      setMessage(
        `Support override is active until ${formatDateTime(result.expiresAt)}.`,
      );
      setSupportDialogOpen(false);
      router.push(`/dashboard?tenantOverride=${encodeURIComponent(tenant.id)}`);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Tenant access</h2>
        <p className="mt-1 text-sm text-slate-500">
          Audited tenant lifecycle and time-bound support access controls.
        </p>
      </div>

      {message || error ? (
        <div
          className={`rounded-2xl border p-4 text-sm font-bold ${error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {error ?? message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {canChangeStatus ? (
          <Card className="rounded-3xl border-slate-100 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-black">
                {tenant.isActive ? (
                  <Shield size={20} />
                ) : (
                  <ShieldOff size={20} />
                )}
                School access state
              </CardTitle>
              <CardDescription>
                Suspension fails closed for school users. Restoring access is
                also audited.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Badge variant={tenant.isActive ? "success" : "destructive"}>
                {tenant.isActive ? "ACTIVE" : "SUSPENDED"}
              </Badge>
              <Button
                variant={tenant.isActive ? "destructive" : "default"}
                className="w-full rounded-2xl font-bold"
                onClick={() => setStatusDialogOpen(true)}
              >
                {tenant.isActive ? (
                  <ShieldOff className="mr-2" size={18} />
                ) : (
                  <Shield className="mr-2" size={18} />
                )}
                {tenant.isActive ? "Suspend school" : "Restore access"}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {canEnterSupportMode ? (
          <Card className="rounded-3xl border-slate-100 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-black">
                <ExternalLink size={20} /> Support override
              </CardTitle>
              <CardDescription>
                Enter the school workspace only through a reasoned, expiring
                backend override.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full rounded-2xl border-slate-200 font-bold"
                onClick={() => setSupportDialogOpen(true)}
                data-testid="support-mode-button"
              >
                Enter support mode
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {canReadAudit ? (
        <Card className="rounded-3xl border-slate-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black">
              <History size={20} /> Support override history
            </CardTitle>
            <CardDescription>
              Backend-reported sessions, including expiry and current state.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Operator
                    </th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Reason
                    </th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Expires
                    </th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(tenant.supportOverrideHistory ?? []).length ? (
                    tenant.supportOverrideHistory?.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-4 font-mono text-xs font-bold text-slate-900">
                          {item.platformUserEmail ?? item.platformUserId}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {item.reason}
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {formatDateTime(item.expiresAt)}
                        </td>
                        <td className="px-5 py-4">
                          <Badge
                            variant={item.isActive ? "success" : "neutral"}
                          >
                            {item.isActive ? "ACTIVE" : "EXPIRED"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-12 text-center font-semibold text-slate-400"
                      >
                        No support overrides recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canChangeStatus ? (
        <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
          <DialogContent className="rounded-3xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {tenant.isActive
                  ? "Suspend school access"
                  : "Restore school access"}
              </DialogTitle>
              <DialogDescription>
                {tenant.isActive
                  ? "This immediately blocks school users. The action is reversible and audited."
                  : "This immediately allows eligible school users to resume access. The action is audited."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="tenant-status-reason">Audit reason</Label>
              <Textarea
                id="tenant-status-reason"
                value={statusReason}
                onChange={(event) => setStatusReason(event.target.value)}
                placeholder="Explain the approved lifecycle action"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStatusDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant={tenant.isActive ? "destructive" : "default"}
                disabled={saving || statusReason.trim().length < 5}
                onClick={() => void updateTenantStatus()}
              >
                {saving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Confirm status change
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {canEnterSupportMode ? (
        <Dialog open={supportDialogOpen} onOpenChange={setSupportDialogOpen}>
          <DialogContent className="rounded-3xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Enter support mode</DialogTitle>
              <DialogDescription>
                The backend creates a time-bound override for {tenant.name}. The
                reason and expiry are audited.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="support-duration">Duration</Label>
                <Select
                  id="support-duration"
                  value={supportDuration}
                  onChange={(event) => setSupportDuration(event.target.value)}
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-reason">Audit reason</Label>
                <Textarea
                  id="support-reason"
                  value={supportReason}
                  onChange={(event) => setSupportReason(event.target.value)}
                  placeholder="Explain the support case or operator action"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSupportDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={saving || supportReason.trim().length < 5}
                onClick={() => void enterSupportMode()}
              >
                {saving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Enter support mode
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date not recorded"
    : date.toLocaleString();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "This access action could not be completed.";
}
