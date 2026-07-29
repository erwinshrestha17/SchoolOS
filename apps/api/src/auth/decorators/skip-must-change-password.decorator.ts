import { SetMetadata } from '@nestjs/common';

export const SKIP_MUST_CHANGE_PASSWORD_KEY = 'skip_must_change_password';

/**
 * Allow authenticated users with mustChangePassword=true to reach this route.
 * Use only for password change, session bootstrap, and logout endpoints.
 */
export const SkipMustChangePassword = () =>
  SetMetadata(SKIP_MUST_CHANGE_PASSWORD_KEY, true);
