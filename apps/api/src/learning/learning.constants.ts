export const LEARNING_MODULE_ENTITLEMENT = 'module.learning';

export const LEARNING_SESSION_CODE_LENGTH = 6;
export const LEARNING_SESSION_TTL_MINUTES = 120;

export const LEARNING_AUDIT_RESOURCES = {
  ACTIVITY: 'learning_activity',
  SESSION: 'learning_session',
  ATTEMPT: 'learning_attempt',
  RESOURCE: 'learning_resource',
  PARENT_SUMMARY: 'learning_parent_summary',
} as const;

export const LEARNING_PROGRESS_LABELS = {
  NEEDS_PRACTICE: 'Needs practice',
  IMPROVING: 'Improving',
  READY: 'Ready',
  STRONG: 'Strong',
} as const;
