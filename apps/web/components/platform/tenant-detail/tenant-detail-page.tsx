"use client";

import type { PlatformTenantDetail } from "@schoolos/core";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  PlatformInlineError,
  PlatformSectionSkeleton,
} from "@/app/platform/_components/platform-operator-states";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/platform/PermissionDenied";
import { useSession } from "@/components/session-provider";
import { platformApi } from "@/lib/api/platform";
import { hasAnyPermission } from "@/lib/session";
import {
  TENANT_SECTIONS,
  tenantSectionHref,
  type TenantDetailSection,
} from "./tenant-detail-routes";

type TenantDetailContextValue = {
  tenant: PlatformTenantDetail;
  tenantId: string;
  refreshTenant: () => Promise<PlatformTenantDetail>;
};

const TenantDetailContext = createContext<TenantDetailContextValue | null>(
  null,
);

export function TenantDetailPage({
  section,
  children,
}: {
  section: TenantDetailSection;
  children: ReactNode;
}) {
  const { tenantId = "" } = useParams<{ tenantId: string }>();
  const pathname = usePathname();
  const { session } = useSession();
  const activeSection = TENANT_SECTIONS.find((item) => item.key === section);
  const canViewSection = Boolean(
    activeSection && hasAnyPermission(session, [...activeSection.permissions]),
  );
  const [tenant, setTenant] = useState<PlatformTenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTenant = useCallback(async () => {
    const detail = await platformApi.getPlatformTenantDetail(tenantId);
    setTenant(detail);
    return detail;
  }, [tenantId]);

  const loadInitialTenant = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await refreshTenant();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [refreshTenant]);

  useEffect(() => {
    if (tenantId && canViewSection) void loadInitialTenant();
  }, [canViewSection, loadInitialTenant, tenantId]);

  const contextValue = useMemo(
    () => (tenant ? { tenant, tenantId, refreshTenant } : null),
    [refreshTenant, tenant, tenantId],
  );

  if (!canViewSection) {
    return (
      <PermissionDenied
        title="Tenant section restricted"
        description="Your platform permissions do not allow this tenant workflow. No tenant detail or workflow data was loaded."
      />
    );
  }

  if (loading) return <PlatformSectionSkeleton rows={8} />;

  if (error || !tenant || !contextValue) {
    return (
      <PlatformInlineError
        title="Tenant detail unavailable"
        message={error ?? "The requested tenant could not be loaded."}
        onRetry={() => void loadInitialTenant()}
      />
    );
  }

  return (
    <TenantDetailContext.Provider value={contextValue}>
      <div className="space-y-7 animate-in fade-in duration-300">
        <Link
          href="/platform/schools"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 transition-colors hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to schools
        </Link>

        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black tracking-tight text-slate-900">
                {tenant.name}
              </h1>
              <Badge variant={tenant.isActive ? "success" : "destructive"}>
                {tenant.isActive ? "ACTIVE" : "SUSPENDED"}
              </Badge>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono font-bold uppercase text-slate-700">
                {tenant.slug}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-xs">{tenant.id}</span>
            </p>
          </div>
          {!tenant.isActive ? (
            <div className="flex max-w-md items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              School access is suspended. Review the audited lifecycle action
              before restoring access.
            </div>
          ) : null}
        </header>

        <nav
          aria-label="Tenant detail sections"
          className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50 p-1"
        >
          {TENANT_SECTIONS.filter((item) =>
            hasAnyPermission(session, [...item.permissions]),
          ).map(({ key, label, icon: Icon }) => {
            const href = tenantSectionHref(tenant.id, key);
            const active =
              section === key && (key !== "overview" || pathname === href);
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                  active
                    ? "bg-white text-[var(--color-mod-platform-text)] shadow-sm"
                    : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <main>{children}</main>
      </div>
    </TenantDetailContext.Provider>
  );
}

export function useTenantDetail() {
  const context = useContext(TenantDetailContext);
  if (!context) {
    throw new Error("useTenantDetail must be used inside TenantDetailPage");
  }
  return context;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "This tenant detail could not be loaded. Try again.";
}
