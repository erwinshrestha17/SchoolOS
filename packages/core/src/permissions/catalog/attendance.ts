export const attendancePermissions = [
  {
    resource: "attendance",
    action: "mark",
    description: "Submit and lock attendance sessions",
  },
  {
    resource: "attendance",
    action: "read",
    description: "Read attendance sessions and analytics",
  },
  {
    resource: "attendance",
    action: "review_conflicts",
    description: "Review conflicting attendance submissions",
  },
  {
    resource: "attendance",
    action: "manage_all",
    description: "Manage all attendance sessions and review workflows",
  },
  {
    resource: "attendance",
    action: "override_lock",
    description: "Edit or submit attendance sessions after their lock cutoff",
  },
  {
    resource: "attendance:staff",
    action: "update",
    description: "Update staff attendance records",
  },
] as const;
