import { ForbiddenException } from '@nestjs/common';
import type { AuthContext } from '../../auth/auth.types';

export const SUPPORT_OVERRIDE_PROTECTED_FILE_DENIED_MESSAGE =
  'Protected files are unavailable during support override';

/**
 * Support override scopes intentionally expose operational metadata only.
 * Protected file bytes and access URLs remain unavailable until a separate
 * step-up/approval workflow exists for sensitive support access.
 */
export function assertProtectedFileAccessAllowed(
  actor: Pick<AuthContext, 'isSupportOverride'>,
): void {
  if (actor.isSupportOverride) {
    throw new ForbiddenException(
      SUPPORT_OVERRIDE_PROTECTED_FILE_DENIED_MESSAGE,
    );
  }
}
