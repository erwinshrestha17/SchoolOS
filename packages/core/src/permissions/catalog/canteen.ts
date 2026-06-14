export const canteenPermissions = [
  {
    resource: "canteen:menu",
    action: "create",
    description: "Create canteen menu items",
  },
  {
    resource: "canteen:menu",
    action: "read",
    description: "Read canteen menu items",
  },
  {
    resource: "canteen:menu",
    action: "update",
    description: "Update canteen menu items",
  },
  {
    resource: "canteen:plans",
    action: "create",
    description: "Create canteen meal plans",
  },
  {
    resource: "canteen:plans",
    action: "read",
    description: "Read canteen meal plans",
  },
  {
    resource: "canteen:plans",
    action: "update",
    description: "Update canteen meal plans",
  },
  {
    resource: "canteen:enrollments",
    action: "create",
    description: "Create canteen enrollments",
  },
  {
    resource: "canteen:enrollments",
    action: "read",
    description: "Read canteen enrollments",
  },
  {
    resource: "canteen:enrollments",
    action: "update",
    description: "Update canteen enrollments",
  },
  {
    resource: "canteen:serving",
    action: "create",
    description: "Serve canteen meals",
  },
  {
    resource: "canteen:serving",
    action: "read",
    description: "Read canteen servings",
  },
  {
    resource: "canteen:serving",
    action: "update",
    description: "Update canteen servings",
  },
  {
    resource: "canteen:wallets",
    action: "create",
    description: "Create canteen wallets",
  },
  {
    resource: "canteen:wallets",
    action: "read",
    description: "Read canteen wallets",
  },
  {
    resource: "canteen:wallets",
    action: "update",
    description: "Top up canteen wallets",
  },
  {
    resource: "canteen:pos",
    action: "create",
    description: "Create canteen POS sales",
  },
  {
    resource: "canteen:pos",
    action: "read",
    description: "Read canteen POS sales",
  },
  {
    resource: "canteen:pos",
    action: "update",
    description: "Update canteen POS sales",
  },
  {
    resource: "canteen:inventory",
    action: "read",
    description: "Read canteen suppliers, inventory, purchases, and wastage",
  },
  {
    resource: "canteen:inventory",
    action: "update",
    description: "Manage canteen suppliers, inventory, purchases, and wastage",
  },
  {
    resource: "canteen:controls",
    action: "create",
    description: "Create canteen spending controls",
  },
  {
    resource: "canteen:controls",
    action: "read",
    description: "Read canteen spending controls",
  },
  {
    resource: "canteen:controls",
    action: "update",
    description: "Update canteen spending controls",
  },
  {
    resource: "canteen:reports",
    action: "read",
    description: "Read canteen reports",
  },
  {
    resource: "canteen:parent",
    action: "read",
    description: "Read own child canteen wallet, menu, and meal plan status",
  },
] as const;
