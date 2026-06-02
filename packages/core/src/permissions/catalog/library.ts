export const libraryPermissions = [
  {
    resource: "library",
    action: "read",
    description: "Read library catalog, circulation, and overdue records",
  },
  {
    resource: "library",
    action: "manage",
    description: "Manage books, copies, issue/return, fines, and lost items",
  },
  {
    resource: "library:books",
    action: "create",
    description: "Create library book catalog records",
  },
  {
    resource: "library:books",
    action: "read",
    description: "Read library book catalog records",
  },
  {
    resource: "library:books",
    action: "update",
    description: "Update library book catalog records",
  },
  {
    resource: "library:copies",
    action: "create",
    description: "Create library copy records",
  },
  {
    resource: "library:copies",
    action: "read",
    description: "Read library copy records",
  },
  {
    resource: "library:copies",
    action: "update",
    description: "Update library copy records and status",
  },
  {
    resource: "library:issues",
    action: "create",
    description: "Issue library copies",
  },
  {
    resource: "library:issues",
    action: "read",
    description: "Read library circulation records",
  },
  {
    resource: "library:issues",
    action: "return",
    description: "Return issued library copies",
  },
  {
    resource: "library:fines",
    action: "create",
    description: "Create controlled library fine records",
  },
  {
    resource: "library:fines",
    action: "update",
    description: "Waive, reverse, or correct library fine records with reason",
  },
  {
    resource: "library:fines",
    action: "post",
    description: "Post approved library fines to student fee dues",
  },
  {
    resource: "library:reports",
    action: "read",
    description: "Read library overdue and circulation reports",
  },
  {
    resource: "library:reports",
    action: "export",
    description: "Export library overdue and circulation reports",
  },
] as const;
