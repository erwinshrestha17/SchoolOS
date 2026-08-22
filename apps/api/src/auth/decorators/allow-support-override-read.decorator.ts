import { SetMetadata } from '@nestjs/common';
import type { SupportOverrideScope } from '@schoolos/core';

export const SUPPORT_OVERRIDE_READ_SCOPES_KEY =
  'supportOverrideReadScopes' as const;

/**
 * Explicit method-level allowlist for purpose-limited support reads.
 *
 * JwtAuthGuard ignores class-level metadata deliberately: every newly added
 * route must be reviewed and annotated on its own before a Platform support
 * session can reach it.
 */
export const AllowSupportOverrideRead = (
  ...scopes: SupportOverrideScope[]
) => SetMetadata(SUPPORT_OVERRIDE_READ_SCOPES_KEY, scopes);
