import { SetMetadata } from '@nestjs/common';

export const NO_MODULE_ENTITLEMENT_KEY = 'no_module_entitlement';

/**
 * Explicit opt-out for controllers that carry EntitlementGuard but are
 * genuinely module-free (platform plane, health, self-service, etc.).
 * The reason is stored for audit/documentation and must be non-empty.
 */
export const NoModuleEntitlement = (reason: string) => {
  if (!reason.trim()) {
    throw new Error('NoModuleEntitlement requires a non-empty reason');
  }
  return SetMetadata(NO_MODULE_ENTITLEMENT_KEY, reason.trim());
};
