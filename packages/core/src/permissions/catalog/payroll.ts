export const payrollPermissions = [
  {
    resource: "payroll",
    action: "manage",
    description: "Run, approve, and post payroll",
  },
  {
    resource: "payroll",
    action: "read",
    description: "Read payroll runs and payslips",
  },
  {
    resource: "payroll:salary",
    action: "read",
    description: "Read salary structures",
  },
  {
    resource: "payroll:salary",
    action: "write",
    description: "Create and update salary structures",
  },
  {
    resource: "payroll:run",
    action: "create",
    description: "Create payroll previews and runs",
  },
  {
    resource: "payroll:run",
    action: "read",
    description: "Read payroll runs",
  },
  {
    resource: "payroll:run",
    action: "review",
    description: "Review payroll runs",
  },
  {
    resource: "payroll:run",
    action: "validate",
    description: "Validate payroll inputs before independent review",
  },
  {
    resource: "payroll:run",
    action: "finalize",
    description:
      "Finalize an independently approved payroll snapshot before accounting posting",
  },
  {
    resource: "payroll:run",
    action: "approve",
    description: "Approve payroll runs",
  },
  {
    resource: "payroll:run",
    action: "post",
    description: "Post payroll to accounting",
  },
  {
    resource: "payroll:run",
    action: "pay",
    description: "Mark payroll paid",
  },
  {
    resource: "payroll:run",
    action: "reverse",
    description: "Reverse posted payroll runs",
  },
  {
    resource: "payroll:payslip",
    action: "read",
    description: "Read payslips",
  },
  {
    resource: "payroll:payslip",
    action: "generate",
    description: "Queue and track protected payslip generation",
  },
  {
    resource: "payroll:reports",
    action: "read",
    description: "Read payroll reports",
  },
  {
    resource: "payroll:exports",
    action: "create",
    description: "Create payroll exports",
  },
] as const;
