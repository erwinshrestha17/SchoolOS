export const staffPermissions = [
  {
    resource: "staff",
    action: "create",
    description: "Create staff accounts and profiles inside a tenant",
  },
  {
    resource: "staff",
    action: "read",
    description: "Read staff accounts and profiles inside a tenant",
  },
  {
    resource: "staff",
    action: "update",
    description: "Update staff accounts and profiles inside a tenant",
  },
] as const;
