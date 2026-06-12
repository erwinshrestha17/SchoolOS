export const learningPermissions = [
  {
    resource: "learning",
    action: "read",
    description: "Read learning activities, sessions, and progress",
  },
  {
    resource: "learning",
    action: "manage",
    description: "Manage learning activities and classroom sessions",
  },
  {
    resource: "learning",
    action: "create",
    description: "Create learning activities for assigned classes and subjects",
  },
  {
    resource: "learning",
    action: "update",
    description: "Update learning activities and session state",
  },
  {
    resource: "learning",
    action: "delete",
    description: "Archive learning activities",
  },
  {
    resource: "learning",
    action: "launch",
    description: "Launch and control school-only learning sessions",
  },
  {
    resource: "learning",
    action: "attempt",
    description: "Join learning sessions and submit activity attempts",
  },
  {
    resource: "learning",
    action: "progress",
    description: "Read learning progress summaries",
  },
] as const;
