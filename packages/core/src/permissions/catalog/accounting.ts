export const accountingPermissions = [
  {
    resource: "accounting",
    action: "read",
    description: "Read accounting periods and financial reports",
  },
  {
    resource: "accounting",
    action: "close",
    description: "Close accounting periods with audit visibility",
  },
  {
    resource: "accounting",
    action: "reverse",
    description: "Create reversing journal entries for posted accounting records",
  },
  {
    resource: "accounting:accounts",
    action: "read",
    description: "Read chart of accounts",
  },
  {
    resource: "accounting:accounts",
    action: "write",
    description: "Create and update chart accounts",
  },
  {
    resource: "accounting:fiscal",
    action: "manage",
    description: "Manage fiscal years and periods",
  },
  {
    resource: "accounting:fiscal",
    action: "reopen",
    description: "Reopen closed fiscal periods",
  },
  {
    resource: "accounting:journals",
    action: "read",
    description: "Read journal entries",
  },
  {
    resource: "accounting:journals",
    action: "create",
    description: "Create manual journals",
  },
  {
    resource: "accounting:journals",
    action: "submit",
    description: "Submit journals for approval",
  },
  {
    resource: "accounting:journals",
    action: "approve",
    description: "Approve submitted journals",
  },
  {
    resource: "accounting:journals",
    action: "reject",
    description: "Reject submitted journals",
  },
  {
    resource: "accounting:journals",
    action: "post",
    description: "Post approved journals to ledger",
  },
  {
    resource: "accounting:journals",
    action: "cancel",
    description: "Cancel draft or submitted journals",
  },
  {
    resource: "accounting:journals",
    action: "reverse",
    description: "Reverse or correct journals",
  },
  {
    resource: "accounting:reports",
    action: "read",
    description: "Read accounting reports",
  },
  {
    resource: "accounting:reports",
    action: "trial-balance",
    description: "View Trial Balance report",
  },
  {
    resource: "accounting:reports",
    action: "general-ledger",
    description: "View General Ledger report",
  },
  {
    resource: "accounting:reports",
    action: "cash-book",
    description: "View Cash Book report",
  },
  {
    resource: "accounting:reports",
    action: "income-statement",
    description: "View Income Statement report",
  },
  {
    resource: "accounting:reports",
    action: "balance-sheet",
    description: "View Balance Sheet report",
  },
  {
    resource: "accounting:reports",
    action: "tax-summary",
    description: "View Tax Summary report",
  },
  {
    resource: "accounting:settings",
    action: "read",
    description: "Read accounting settings",
  },
  {
    resource: "accounting:settings",
    action: "update",
    description: "Update accounting settings and mappings",
  },
  {
    resource: "accounting:exports",
    action: "create",
    description: "Create accounting exports",
  },
] as const;
