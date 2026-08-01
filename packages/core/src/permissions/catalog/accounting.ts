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
    resource: "accounting:audit",
    action: "read",
    description: "Read tenant-scoped financial audit and access evidence",
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
  {
    resource: "accounting:posting-batches",
    action: "read",
    description: "Read source posting batches and reconciliation state",
  },
  {
    resource: "accounting:posting-batches",
    action: "retry",
    description: "Retry failed source posting batches",
  },
  {
    resource: "accounting:payroll-handoff",
    action: "read",
    description: "Read approved payroll accounting handoff summaries",
  },
  {
    resource: "accounting:payroll-handoff",
    action: "post",
    description: "Post an approved payroll snapshot through the accounting boundary",
  },
  {
    resource: "accounting:expenses",
    action: "read",
    description: "Read tenant-scoped expenses and supporting-document state",
  },
  {
    resource: "accounting:expenses",
    action: "write",
    description: "Create and correct tenant-scoped expenses",
  },
  {
    resource: "accounting:vendors",
    action: "read",
    description: "Read tenant-scoped vendors and vendor balances",
  },
  {
    resource: "accounting:vendors",
    action: "write",
    description: "Create and update tenant-scoped vendors",
  },
  {
    resource: "accounting:payables",
    action: "read",
    description: "Read tenant-scoped payables and settlements",
  },
  {
    resource: "accounting:payables",
    action: "write",
    description: "Create and correct tenant-scoped payables and settlements",
  },
  {
    resource: "accounting:reconciliation",
    action: "read",
    description: "Read bank reconciliation sessions and match evidence",
  },
  {
    resource: "accounting:reconciliation",
    action: "manage",
    description: "Match and unmatch bank reconciliation items with reason",
  },
  {
    resource: "accounting:reconciliation",
    action: "finalize",
    description: "Finalize a balanced bank reconciliation session",
  },
  {
    resource: "finance:principal",
    action: "read",
    description: "Read server-projected Principal financial oversight summaries",
  },
  {
    resource: "finance:approvals",
    action: "read",
    description: "Read policy-designated financial approval requests",
  },
  {
    resource: "finance:approvals",
    action: "decide",
    description: "Decide policy-designated financial approval requests",
  },
  {
    resource: "accounting:budgets",
    action: "read",
    description: "Read fiscal budgets",
  },
  {
    resource: "accounting:budgets",
    action: "write",
    description: "Create and update fiscal budgets",
  },
  {
    resource: "accounting:reports",
    action: "budget-vs-actual",
    description: "View Budget vs Actual report",
  },
  {
    resource: "accounting:reports",
    action: "cash-flow-statement",
    description: "View Cash Flow Statement report",
  },
] as const;
