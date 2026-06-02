export const hrPermissions = [
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
