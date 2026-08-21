"use client";

import { KeyRound, Link2, Settings } from "lucide-react";
import Link from "next/link";
import { PlatformEmptyState } from "@/app/platform/_components/platform-operator-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSession } from "@/components/session-provider";
import { hasPermission } from "@/lib/session";
import { useTenantDetail } from "./tenant-detail-page";
import { tenantSectionHref } from "./tenant-detail-routes";

export function TenantIntegrations() {
  const { tenant } = useTenantDetail();
  const { session } = useSession();
  const canReadApiKeys = hasPermission(session, "platform:api-keys:read");
  const readiness = tenant.providerReadiness ?? [];

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Integrations</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tenant provider readiness and approved integration credentials.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReadApiKeys ? (
            <Link href={tenantSectionHref(tenant.id, "api-keys")}>
              <Button variant="outline" className="rounded-2xl font-bold">
                <KeyRound className="mr-2" size={17} />
                Tenant API keys
              </Button>
            </Link>
          ) : null}
          <Link href="/platform/settings/providers">
            <Button variant="outline" className="rounded-2xl font-bold">
              <Settings className="mr-2" size={17} />
              Platform providers
            </Button>
          </Link>
        </div>
      </div>

      <Card className="rounded-3xl border-slate-100 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-black">
            <Link2 size={20} /> Provider readiness
          </CardTitle>
          <CardDescription>
            Backend-reported configuration status. Credentials and provider
            secrets are never rendered here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {readiness.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {readiness.map((provider) => (
                <div
                  key={provider.providerId}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900">
                        {provider.name}
                      </p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {provider.type}
                      </p>
                    </div>
                    <Badge
                      variant={
                        provider.status === "ready"
                          ? "success"
                          : provider.status === "failed"
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {provider.status.replaceAll("_", " ").toUpperCase()}
                    </Badge>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    {provider.message}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <PlatformEmptyState
              icon={Link2}
              title="No provider readiness reported"
              description="No tenant-scoped provider status is available. Review platform provider configuration without assuming production readiness."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
