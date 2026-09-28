export const hrPermissions = [
  {
    resource: "hr:documents",
    action: "read",
    description: "Read protected staff document records and files",
  },
  {
    resource: "hr:documents",
    action: "manage",
    description: "Manage and verify protected staff documents",
  },
  {
    resource: "hr:identity",
    action: "read",
    description: "Read protected staff identity numbers",
  },
  {
    resource: "hr:identity",
    action: "write",
    description: "Update protected staff identity numbers",
  },
  {
    resource: "hr:bank",
    action: "read",
    description: "Read staff and compensation bank details",
  },
  {
    resource: "hr:bank",
    action: "write",
    description: "Update staff and compensation bank details",
  },
  {
    resource: "hr:tax",
    action: "read",
    description: "Read staff tax identity and statutory details",
  },
  {
    resource: "hr:tax",
    action: "write",
    description: "Update staff tax identity and statutory details",
  },
  {
    resource: "hr:disciplinary",
    action: "read",
    description: "Read restricted staff disciplinary evidence",
  },
  {
    resource: "hr:disciplinary",
    action: "manage",
    description: "Manage restricted staff disciplinary evidence",
  },
  {
    resource: "hr",
    action: "manage",
    description: "Manage HR contracts and staff employment records",
  },
  {
    resource: "hr",
    action: "read",
    description: "Read HR contracts and staff employment records",
  },
  {
    resource: "hr:staff",
    action: "read",
    description: "Read staff profile details",
  },
  {
    resource: "hr:staff",
    action: "create",
    description: "Create HR staff profiles",
  },
  {
    resource: "hr:staff",
    action: "update",
    description: "Update HR staff profiles",
  },
  {
    resource: "hr:staff",
    action: "lifecycle",
    description: "Manage staff lifecycle transitions",
  },
  {
    resource: "hr:staff",
    action: "terminate",
    description: "Terminate staff employment",
  },
  {
    resource: "hr:staff",
    action: "archive",
    description: "Archive staff profiles",
  },
  {
    resource: "hr:attendance",
    action: "read",
    description: "Read staff attendance",
  },
  {
    resource: "hr:attendance",
    action: "write",
    description: "Mark staff attendance",
  },
  {
    resource: "hr:attendance",
    action: "correct",
    description: "Correct staff attendance with audit reason",
  },
  {
    resource: "hr:leave",
    action: "read",
    description: "Read staff leave requests and balances",
  },
  {
    resource: "hr:leave",
    action: "request",
    description: "Create staff leave requests",
  },
  {
    resource: "hr:leave",
    action: "approve",
    description: "Approve or reject staff leave requests",
  },
  {
    resource: "hr:leave",
    action: "adjust",
    description: "Adjust staff leave balances",
  },
] as const;
