export const communicationsPermissions = [
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
    action: "manage_consent",
    description: "Manage communication consent settings",
  },
  {
    resource: "consents",
    action: "manage",
    description: "Capture and revoke guardian consent records",
  },
] as const;
