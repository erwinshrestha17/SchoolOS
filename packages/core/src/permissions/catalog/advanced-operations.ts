export const advancedOperationsPermissions = [
  {
    resource: "advanced:approvals",
    action: "read",
    description: "Read tenant approval workflow requests and policies",
  },
  {
    resource: "advanced:approvals",
    action: "manage",
    description: "Create approval policies and approval requests",
  },
  {
    resource: "advanced:approvals",
    action: "decide",
    description: "Approve or reject approval workflow steps",
  },
  {
    resource: "advanced:automation",
    action: "read",
    description: "Read deterministic automation rules and execution logs",
  },
  {
    resource: "advanced:automation",
    action: "manage",
    description: "Create and update deterministic automation rules",
  },
  {
    resource: "advanced:automation",
    action: "execute",
    description: "Run deterministic automation triggers",
  },
  {
    resource: "advanced:analytics",
    action: "read",
    description: "Read cached descriptive analytics summaries",
  },
  {
    resource: "advanced:analytics",
    action: "refresh",
    description: "Refresh cached descriptive analytics summaries",
  },
  {
    resource: "advanced:documents",
    action: "read",
    description: "Read document and certificate templates",
  },
  {
    resource: "advanced:documents",
    action: "manage",
    description: "Create document templates and generate documents",
  },
  {
    resource: "advanced:exports",
    action: "read",
    description: "Read tenant export center job history",
  },
  {
    resource: "advanced:exports",
    action: "create",
    description: "Create and retry tenant export center jobs",
  },
] as const;
