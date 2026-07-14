export const communicationsPermissions = [
  {
    resource: "notifications",
    action: "view_own",
    description: "View and update one's own notification inbox",
  },
  {
    resource: "notifications",
    action: "manage_templates",
    description: "Manage notification delivery templates",
  },
  {
    resource: "notifications",
    action: "manage_preferences",
    description: "Manage tenant-safe notification preferences and quiet hours",
  },
  {
    resource: "notifications",
    action: "view_delivery_diagnostics",
    description: "View bounded notification delivery diagnostics",
  },
  {
    resource: "notifications",
    action: "retry_deliveries",
    description: "Retry eligible failed notification deliveries",
  },
  {
    resource: "notices",
    action: "create",
    description: "Create and publish school notices",
  },
  {
    resource: "notices",
    action: "read",
    description: "Read school notices",
  },
  {
    resource: "notices",
    action: "approve",
    description: "Approve high-impact notices",
  },
  {
    resource: "notices",
    action: "send_emergency",
    description: "Create and publish emergency notices",
  },
  {
    resource: "notices",
    action: "read_reports",
    description: "Read notice delivery and acknowledgement reports",
  },
  {
    resource: "events",
    action: "create",
    description: "Create school events",
  },
  {
    resource: "events",
    action: "read",
    description: "Read school events",
  },
  {
    resource: "communications",
    action: "read_deliveries",
    description: "Read notification delivery records",
  },
  {
    resource: "communications",
    action: "retry_deliveries",
    description: "Retry failed notification deliveries",
  },
  {
    resource: "communications",
    action: "manage_templates",
    description: "Create, publish, and archive communication templates",
  },
  {
    resource: "communications",
    action: "manage_consent",
    description: "Manage communication consent settings",
  },
  {
    resource: "consents",
    action: "manage",
    description: "Capture and revoke guardian consent records",
  },
] as const;
