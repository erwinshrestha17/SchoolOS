export const platformPermissions = [
  {
    resource: "tenants",
    action: "manage",
    description: "Deactivate or manage tenants (super_admin only)",
  },
  {
    resource: "tenants",
    action: "read",
    description: "Read the current tenant profile",
  },
  {
    resource: "platform",
    action: "read",
    description: "Read platform global data (platform admins only)",
  },
  {
    resource: "platform",
    action: "manage",
    description: "Manage platform, tenants, and global settings",
  },
  {
    resource: "platform:dashboard",
    action: "read",
    description: "Read platform dashboard",
  },
  {
    resource: "platform:tenants",
    action: "read",
    description: "Read platform tenants",
  },
  {
    resource: "platform:tenants",
    action: "status",
    description: "Suspend or activate platform tenants",
  },
  {
    resource: "platform:plans",
    action: "read",
    description: "Read SaaS plans and features",
  },
  {
    resource: "platform:plans",
    action: "manage",
    description: "Create, update, and archive SaaS plans",
  },
  {
    resource: "platform:subscriptions",
    action: "read",
    description: "Read tenant SaaS subscriptions",
  },
  {
    resource: "platform:subscriptions",
    action: "manage",
    description: "Assign and update tenant SaaS subscriptions",
  },
  {
    resource: "platform:usage",
    action: "read",
    description: "Read platform usage counters and limits",
  },
  {
    resource: "platform:billing",
    action: "read",
    description: "Read SchoolOS SaaS billing",
  },
  {
    resource: "platform:billing",
    action: "manage",
    description: "Manage SchoolOS SaaS invoices and payments",
  },
  {
    resource: "platform:providers",
    action: "read",
    description: "Read masked platform provider configuration",
  },
  {
    resource: "platform:providers",
    action: "manage",
    description: "Update platform provider configuration",
  },
  {
    resource: "platform:api-keys",
    action: "read",
    description: "Read tenant API key metadata",
  },
  {
    resource: "platform:api-keys",
    action: "manage",
    description: "Create and revoke tenant API keys",
  },
  {
    resource: "platform:queues",
    action: "read",
    description: "Read platform queue health",
  },
  {
    resource: "platform:queues",
    action: "retry",
    description: "Retry failed platform jobs",
  },
  {
    resource: "platform:queues",
    action: "manage",
    description: "Manage platform queues and jobs (delete, pause)",
  },
  {
    resource: "platform:support",
    action: "override",
    description: "Enter or exit support override mode for a tenant",
  },
  {
    resource: "platform:audit",
    action: "read",
    description: "Read platform audit logs",
  },
  {
    resource: "platform:health",
    action: "read",
    description: "Read platform production health details",
  },
  {
    resource: "platform:reports",
    action: "read",
    description: "Read platform report/export history",
  },
  {
    resource: "platform:onboarding",
    action: "read",
    description: "Read pilot onboarding checklist status",
  },
  {
    resource: "platform:onboarding",
    action: "manage",
    description: "Update pilot onboarding checklist overrides",
  },
  {
    resource: "platform:demo-requests",
    action: "read",
    description: "Read public marketing demo request leads",
  },
  {
    resource: "platform:demo-requests",
    action: "manage",
    description: "Update demo request follow-up status and notes",
  },
  {
    resource: "settings",
    action: "read_public",
    description: "Read public-safe tenant branding and localization settings",
  },
  {
    resource: "settings",
    action: "read",
    description: "Read tenant settings and preferences",
  },
  {
    resource: "settings",
    action: "manage",
    description: "Manage tenant branding, localization, and operational settings",
  },
  {
    resource: "reports",
    action: "read",
    description: "List available reports",
  },
  {
    resource: "reports",
    action: "export",
    description: "Execute and export reports in various formats",
  },
] as const;
