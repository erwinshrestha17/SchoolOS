export const authPermissions = [
  {
    resource: "users",
    action: "create",
    description: "Create users inside a tenant",
  },
  {
    resource: "users",
    action: "read",
    description: "Read users inside a tenant",
  },
  {
    resource: "users",
    action: "update_status",
    description: "Suspend or activate users inside a tenant",
  },
  {
    resource: "users",
    action: "reset_password",
    description: "Reset user passwords and revoke active sessions",
  },
  {
    resource: "roles",
    action: "read",
    description: "Read roles and permission catalog",
  },
  {
    resource: "roles",
    action: "create",
    description: "Create custom roles inside a tenant",
  },
  {
    resource: "roles",
    action: "assign",
    description: "Assign roles to tenant users",
  },
  {
    resource: "roles",
    action: "manage_permissions",
    description: "Attach permissions to roles",
  },
] as const;
