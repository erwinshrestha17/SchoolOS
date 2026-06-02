export const activityPermissions = [
  {
    resource: "activity_feed",
    action: "create",
    description: "Create classroom activity feed posts and mood logs",
  },
  {
    resource: "activity_feed",
    action: "read",
    description: "Read activity feed posts and mood logs",
  },
  {
    resource: "activity_feed",
    action: "moderate",
    description: "Moderate classroom activity feed posts and comments",
  },
] as const;
