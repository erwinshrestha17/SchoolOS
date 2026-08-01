import { BadRequestException } from '@nestjs/common';

export const FINANCIAL_AUDITOR_ROLE = 'financial_auditor';

type AssignableRole = { id: string; name: string };

export function resolveRoleAssignmentExpiries(
  roles: readonly AssignableRole[],
  input: Record<string, string> | undefined,
  now = new Date(),
): Map<string, Date | null> {
  const roleIds = new Set(roles.map(({ id }) => id));
  const supplied = input ?? {};

  for (const roleId of Object.keys(supplied)) {
    if (!roleIds.has(roleId)) {
      throw new BadRequestException(
        'A role expiry was supplied for a role that is not being assigned.',
      );
    }
  }

  return new Map(
    roles.map((role) => {
      const raw = supplied[role.id]?.trim();
      if (!raw) {
        if (role.name === FINANCIAL_AUDITOR_ROLE) {
          throw new BadRequestException(
            'Financial auditor access requires a future expiry.',
          );
        }
        return [role.id, null] as const;
      }

      const expiresAt = new Date(raw);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
        throw new BadRequestException('Role expiry must be a future instant.');
      }
      return [role.id, expiresAt] as const;
    }),
  );
}
