export const transportPermissions = [
  {
    resource: "transport",
    action: "read",
    description: "Read routes, vehicles, enrollments, and transport logs",
  },
  {
    resource: "transport",
    action: "manage",
    description: "Manage transport setup, enrollments, boarding, and delays",
  },
  {
    resource: "transport",
    action: "operate",
    description: "Record assigned route logs and transport delay updates",
  },
  {
    resource: "transport:routes",
    action: "create",
    description: "Create transport routes",
  },
  {
    resource: "transport:routes",
    action: "read",
    description: "Read transport routes",
  },
  {
    resource: "transport:routes",
    action: "update",
    description: "Update transport routes",
  },
  {
    resource: "transport:vehicles",
    action: "create",
    description: "Create transport vehicles",
  },
  {
    resource: "transport:vehicles",
    action: "read",
    description: "Read transport vehicles",
  },
  {
    resource: "transport:vehicles",
    action: "update",
    description: "Update transport vehicles",
  },
  {
    resource: "transport:assignments",
    action: "create",
    description: "Create transport assignments",
  },
  {
    resource: "transport:assignments",
    action: "read",
    description: "Read transport assignments",
  },
  {
    resource: "transport:assignments",
    action: "update",
    description: "Update transport assignments",
  },
  {
    resource: "transport:trips",
    action: "create",
    description: "Start transport trips",
  },
  {
    resource: "transport:trips",
    action: "read",
    description: "Read transport trips",
  },
  {
    resource: "transport:trips",
    action: "update",
    description: "Update transport trips",
  },
  {
    resource: "transport:location",
    action: "read",
    description: "Read transport latest location",
  },
  {
    resource: "transport:location",
    action: "update",
    description: "Update transport latest location",
  },
  {
    resource: "transport:tracking",
    action: "parent",
    description: "Read own child active transport trip tracking",
  },
  {
    resource: "transport:reports",
    action: "read",
    description: "Read transport reports",
  },
] as const;
