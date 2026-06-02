export const messagingPermissions = [
  {
    resource: "messaging",
    action: "create",
    description: "Create parent-teacher conversations and messages",
  },
  {
    resource: "messaging",
    action: "read",
    description: "Read parent-teacher conversations and message status",
  },
  {
    resource: "messaging",
    action: "manage",
    description: "Moderate parent-teacher conversations and chat settings",
  },
] as const;
