export const financePermissions = [
  {
    resource: "fees",
    action: "manage",
    description: "Manage fee heads, plans, and student assignments",
  },
  {
    resource: "fees",
    action: "bill",
    description: "Generate recurring fee invoices and billing runs",
  },
  {
    resource: "fees",
    action: "discount",
    description: "Manage discounts and waivers",
  },
  {
    resource: "fees",
    action: "adjust",
    description: "Void invoices and post audited fee invoice adjustments",
  },
  {
    resource: "payments",
    action: "collect",
    description: "Collect payments and issue receipts",
  },
  {
    resource: "payments",
    action: "refund",
    description: "Refund collected payments with immutable journal posting",
  },
  {
    resource: "payments",
    action: "close",
    description: "Preview and finalize cashier close snapshots",
  },
  {
    resource: "payments",
    action: "reverse",
    description: "Reverse collected payments",
  },
  {
    resource: "receipts",
    action: "read",
    description: "Read payment receipts and receipt PDFs",
  },
  {
    resource: "receipts",
    action: "manage",
    description: "Manage receipt reprint history and auditing",
  },
  {
    resource: "ledger",
    action: "read",
    description: "Read ledger entries and journal lines",
  },
] as const;
