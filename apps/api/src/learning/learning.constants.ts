export const LEARNING_MODULE_ENTITLEMENT = 'module.learning';

/**
 * School-only network/device hardening (IP allowlist, on-campus Wi-Fi, device
 * attestation) is deferred until product policy is finalized. Current MVP
 * enforcement: authenticated tenant membership, class/section match, expiring
 * session code/QR token hash, and schoolOnly=true join gate.
 */
export const LEARNING_SCHOOL_ONLY_NETWORK_HARDENING_DEFERRED = true;

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
