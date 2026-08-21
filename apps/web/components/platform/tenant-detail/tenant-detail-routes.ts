import {
  BadgeCheck,
  BookOpenCheck,
  Building2,
  CreditCard,
  FileClock,
  KeyRound,
  Link2,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import type { PermissionKey } from "@schoolos/core";

export type TenantDetailSection =
  | "overview"
  | "access"
  | "modules"
  | "subscription"
  | "billing"
  | "onboarding"
  | "integrations"
  | "api-keys"
  | "audit";

export const TENANT_SECTIONS = [
  {
    key: "overview",
    label: "Overview",
    icon: Building2,
    permissions: ["platform:tenants:read"],
  },
  {
    key: "access",
    label: "Access",
    icon: ShieldCheck,
    permissions: ["platform:tenants:status", "platform:support:override"],
  },
  {
    key: "modules",
    label: "Modules",
    icon: PackageCheck,
    permissions: ["platform:subscriptions:read"],
  },
  {
    key: "subscription",
    label: "Subscription",
    icon: BadgeCheck,
    permissions: ["platform:subscriptions:read"],
  },
  {
    key: "billing",
    label: "SaaS Billing",
    icon: CreditCard,
    permissions: ["platform:billing:read"],
  },
  {
    key: "onboarding",
    label: "Onboarding",
    icon: BookOpenCheck,
    permissions: ["platform:onboarding:read"],
  },
  {
    key: "integrations",
    label: "Integrations",
    icon: Link2,
    permissions: ["platform:providers:read"],
  },
  {
    key: "api-keys",
    label: "API Keys",
    icon: KeyRound,
    permissions: ["platform:api-keys:read"],
  },
  {
    key: "audit",
    label: "Audit",
    icon: FileClock,
    permissions: ["platform:audit:read"],
  },
] as const satisfies ReadonlyArray<{
  key: TenantDetailSection;
  label: string;
  icon: typeof Building2;
  permissions: readonly PermissionKey[];
}>;

export const TENANT_LEGACY_TAB_ROUTES: Record<string, TenantDetailSection> = {
  overview: "overview",
  access: "access",
  entitlements: "modules",
  modules: "modules",
  subscription: "subscription",
  billing: "billing",
  onboarding: "onboarding",
  integrations: "integrations",
  "api-keys": "api-keys",
  audit: "audit",
};

export function tenantSectionHref(
  tenantId: string,
  section: TenantDetailSection,
) {
  const base = `/platform/schools/${encodeURIComponent(tenantId)}`;
  return section === "overview" ? base : `${base}/${section}`;
}
