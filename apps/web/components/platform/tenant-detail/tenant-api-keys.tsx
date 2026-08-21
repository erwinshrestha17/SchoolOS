"use client";

import type {
  PlatformApiKeyCreated,
  PlatformApiKeySummary,
} from "@schoolos/core";
import { Copy, KeyRound, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  PlatformInlineError,
  PlatformSectionSkeleton,
} from "@/app/platform/_components/platform-operator-states";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/components/session-provider";
import { platformApi } from "@/lib/api/platform";
import { hasPermission } from "@/lib/session";
import { useTenantDetail } from "./tenant-detail-page";

export function TenantApiKeys() {
  const { tenant } = useTenantDetail();
  const { session } = useSession();
  const canManageApiKeys = hasPermission(session, "platform:api-keys:manage");
  const [keys, setKeys] = useState<PlatformApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(makeDefaultForm);
  const [createdKey, setCreatedKey] = useState<PlatformApiKeyCreated | null>(
    null,
  );
  const [revokeTarget, setRevokeTarget] =
    useState<PlatformApiKeySummary | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [saving, setSaving] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const items = await platformApi.listPlatformApiKeys(tenant.id);
      setKeys(Array.isArray(items) ? items : []);
    } catch (caught) {
      setLoadError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function createKey() {
    if (!canManageApiKeys || form.name.trim().length < 3) return;
    setSaving(true);
    setActionError(null);
    setMessage(null);
    try {
      const created = await platformApi.createPlatformApiKey(tenant.id, {
        name: form.name.trim(),
        scopes: form.scopes
          .split(",")
          .map((scope) => scope.trim())
          .filter(Boolean),
        ...(form.expiresAt
          ? {
              expiresAt: new Date(
                `${form.expiresAt}T00:00:00.000Z`,
              ).toISOString(),
            }
          : {}),
      });
      setCreatedKey(created);
      setCreateOpen(false);
      setForm(makeDefaultForm());
      await loadKeys();
      setMessage(
        "API key created. Copy the one-time secret now; it will not be shown again.",
      );
    } catch (caught) {
      setActionError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function revokeKey() {
    if (!canManageApiKeys || !revokeTarget || revokeReason.trim().length < 5) {
      return;
    }
    setSaving(true);
    setActionError(null);
    setMessage(null);
    try {
      await platformApi.revokePlatformApiKey(tenant.id, revokeTarget.id, {
        reason: revokeReason.trim(),
      });
      setRevokeTarget(null);
      setRevokeReason("");
      setCreatedKey(null);
      await loadKeys();
      setMessage("API key revoked.");
    } catch (caught) {
      setActionError(getErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function copySecret() {
    if (!canManageApiKeys || !createdKey) return;
    await navigator.clipboard.writeText(createdKey.secret);
    setMessage("API key secret copied.");
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">
            Tenant API keys
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Scoped credentials for approved tenant integrations.
          </p>
        </div>
        {canManageApiKeys ? (
          <Button
            variant="outline"
            className="rounded-2xl font-bold"
            onClick={() => setCreateOpen(true)}
            data-testid="create-platform-api-key-button"
          >
            <Plus className="mr-2" size={17} />
            New API key
          </Button>
        ) : null}
      </div>

      {message || actionError ? (
        <div
          className={`rounded-2xl border p-4 text-sm font-bold ${actionError ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {actionError ?? message}
        </div>
      ) : null}

      {canManageApiKeys && createdKey ? (
        <Card className="rounded-3xl border-emerald-200 bg-emerald-50 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-black text-emerald-950">
                <KeyRound size={20} />
                One-time API key secret
              </CardTitle>
              <CardDescription className="text-emerald-800">
                Store this secret now. SchoolOS retains only the hashed key and
                cannot reveal it again.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              className="bg-white font-bold text-emerald-800"
              onClick={() => void copySecret()}
            >
              <Copy className="mr-2" size={16} />
              Copy secret
            </Button>
          </CardHeader>
          <CardContent>
            <div className="break-all rounded-2xl border border-emerald-200 bg-white p-4 font-mono text-sm font-bold text-slate-900">
              {createdKey.secret}
            </div>
            <p className="mt-3 text-xs font-bold text-emerald-900">
              {createdKey.name} · {createdKey.keyPreview} ·{" "}
              {createdKey.scopes.join(", ") || "default scopes"}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-3xl border-slate-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-black">Issued keys</CardTitle>
          <CardDescription>
            Full secrets are shown only once, immediately after creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PlatformSectionSkeleton rows={5} />
          ) : loadError ? (
            <PlatformInlineError
              title="API keys unavailable"
              message={loadError}
              onRetry={() => void loadKeys()}
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Name
                    </th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Preview
                    </th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Scopes
                    </th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Status
                    </th>
                    {canManageApiKeys ? (
                      <th className="px-5 py-4">
                        <span className="sr-only">Actions</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {keys.length ? (
                    keys.map((key) => (
                      <tr key={key.id}>
                        <td className="px-5 py-4">
                          <p className="font-black text-slate-900">
                            {key.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Created {formatDate(key.createdAt)}
                          </p>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs font-bold text-slate-700">
                          {key.keyPreview}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-600">
                          {key.scopes.join(", ") || "default"}
                        </td>
                        <td className="px-5 py-4">
                          <Badge
                            variant={
                              key.status === "ACTIVE" ? "success" : "neutral"
                            }
                          >
                            {key.status}
                          </Badge>
                        </td>
                        {canManageApiKeys ? (
                          <td className="px-5 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-700"
                              disabled={key.status === "REVOKED"}
                              onClick={() => setRevokeTarget(key)}
                            >
                              <Trash2 className="mr-2" size={15} />
                              Revoke
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={canManageApiKeys ? 5 : 4}
                        className="px-5 py-14 text-center font-semibold text-slate-400"
                      >
                        No tenant API keys have been created.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {canManageApiKeys ? (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="rounded-3xl sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Create tenant API key</DialogTitle>
              <DialogDescription>
                The secret is shown once after creation. Use only the scopes
                approved for this integration.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Field
                label="Key name"
                value={form.name}
                onChange={(value) => setForm({ ...form, name: value })}
              />
              <Field
                label="Scopes"
                value={form.scopes}
                onChange={(value) => setForm({ ...form, scopes: value })}
              />
              <p className="text-xs text-slate-500">
                Comma-separated scopes, for example students:read,
                attendance:read.
              </p>
              <Field
                label="Expires at"
                type="date"
                value={form.expiresAt}
                onChange={(value) => setForm({ ...form, expiresAt: value })}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={saving || form.name.trim().length < 3}
                onClick={() => void createKey()}
              >
                {saving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create API key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {canManageApiKeys ? (
        <Dialog
          open={Boolean(revokeTarget)}
          onOpenChange={(open: boolean) => {
            if (!open) setRevokeTarget(null);
          }}
        >
          <DialogContent className="rounded-3xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Revoke API key</DialogTitle>
              <DialogDescription>
                Revoking {revokeTarget?.name} immediately disables this
                integration credential. Provide an audit reason.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="revoke-key-reason">Audit reason</Label>
              <Textarea
                id="revoke-key-reason"
                value={revokeReason}
                onChange={(event) => setRevokeReason(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevokeTarget(null)}>
                Keep key
              </Button>
              <Button
                variant="destructive"
                disabled={saving || revokeReason.trim().length < 5}
                onClick={() => void revokeKey()}
              >
                {saving ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Revoke key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = `api-key-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function makeDefaultForm() {
  return { name: "", scopes: "students:read, attendance:read", expiresAt: "" };
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date not recorded"
    : date.toLocaleDateString();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Tenant API keys could not be loaded.";
}
