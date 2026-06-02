export const studentsPermissions = [
  {
    resource: "students",
    action: "create",
    description: "Create student records inside a tenant",
  },
  {
    resource: "students",
    action: "read",
    description: "Read student records inside a tenant",
  },
  {
    resource: "students",
    action: "update",
    description: "Update mutable student profile fields inside a tenant",
  },
  {
    resource: "students",
    action: "delete",
    description: "Delete or withdraw student records",
  },
  {
    resource: "students",
    action: "manage_lifecycle",
    description: "Transfer, exit, archive, and manage student lifecycle transitions",
  },
  {
    resource: "students:qr",
    action: "generate",
    description: "Generate new QR credentials for students",
  },
  {
    resource: "students:qr",
    action: "read",
    description: "Read student QR credentials and images",
  },
  {
    resource: "students:qr",
    action: "rotate",
    description: "Rotate existing student QR credentials",
  },
  {
    resource: "students:qr",
    action: "revoke",
    description: "Revoke student QR credentials",
  },
  {
    resource: "students:qr",
    action: "resolve",
    description: "Resolve scanned QR tokens for identity verification",
  },
  {
    resource: "students:qr",
    action: "resolve_all",
    description: "Resolve scanned QR tokens beyond assigned-student scope",
  },
  {
    resource: "guardians",
    action: "create",
    description: "Create guardian records inside a tenant",
  },
  {
    resource: "guardians",
    action: "read",
    description: "Read guardian records inside a tenant",
  },
  {
    resource: "guardians",
    action: "update",
    description: "Update linked guardian records inside a tenant",
  },
  {
    resource: "guardians",
    action: "verify",
    description: "Review and approve guardian identity verification records",
  },
  {
    resource: "student_documents",
    action: "manage",
    description: "Upload and manage student documents inside a tenant",
  },
  {
    resource: "siblings",
    action: "manage",
    description: "Manage sibling groups for fee discounts and family views",
  },
  {
    resource: "enrollments",
    action: "create",
    description: "Create student enrollment records and side effects",
  },
  {
    resource: "enrollments",
    action: "read",
    description: "Read student enrollment history",
  },
] as const;
