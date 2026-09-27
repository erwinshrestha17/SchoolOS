import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  SCHOOL_SCOPE_TYPES,
  type ScopeGrant,
  type SchoolScopeType,
} from './scope.types';
import { scopeTargetExists } from './scope-target';

export async function validateScopeWrites(
  db: Prisma.TransactionClient,
  tenantId: string,
  roleIds: readonly string[],
  input: unknown,
): Promise<Map<string, ScopeGrant[]>> {
  const result = new Map<string, ScopeGrant[]>();
  if (input === undefined) return result;
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BadRequestException('Scopes must be keyed by role id');
  for (const [roleId, values] of Object.entries(input)) {
    if (
      !roleIds.includes(roleId) ||
      !Array.isArray(values) ||
      !values.length ||
      values.length > 20
    )
      throw new BadRequestException('Invalid role scope list');
    const scopes: ScopeGrant[] = [];
    for (const value of values as unknown[]) {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new BadRequestException('Invalid typed scope');
      const fields = value as Record<string, unknown>;
      if (
        Object.keys(fields).some(
          (k) =>
            !['scopeType', 'scopeId', 'effectiveFrom', 'expiresAt'].includes(k),
        ) ||
        !SCHOOL_SCOPE_TYPES.includes(fields.scopeType as SchoolScopeType) ||
        typeof fields.scopeId !== 'string' ||
        !fields.scopeId.trim()
      )
        throw new BadRequestException(
          'Explicit scopeType and scopeId are required',
        );
      const effectiveFrom = parseDate(fields.effectiveFrom) ?? new Date();
      const expiresAt = parseDate(fields.expiresAt) ?? null;
      if (expiresAt && expiresAt <= effectiveFrom)
        throw new BadRequestException(
          'Scope expiry must follow its effective time',
        );
      const scopeType = fields.scopeType as SchoolScopeType;
      if (!(await scopeTargetExists(db, tenantId, scopeType, fields.scopeId)))
        throw new NotFoundException('Scope target not found');
      if (
        scopes.some(
          (s) => s.scopeType === scopeType && s.scopeId === fields.scopeId,
        )
      )
        throw new BadRequestException('Duplicate scope');
      scopes.push({
        scopeType,
        scopeId: fields.scopeId,
        effectiveFrom,
        expiresAt,
        revokedAt: null,
      });
    }
    if (scopes.length > 1 && scopes.some((s) => s.scopeType === 'TENANT'))
      throw new BadRequestException(
        'Tenant scope cannot override a restriction',
      );
    // Class/section/subject dimensions must describe one coherent academic context.
    const classes = scopes
      .filter((s) => s.scopeType === 'CLASS')
      .map((s) => s.scopeId);
    for (const scope of scopes.filter(
      (s) => s.scopeType === 'SECTION' || s.scopeType === 'SUBJECT',
    )) {
      const row =
        scope.scopeType === 'SECTION'
          ? await db.section.findFirst({
              where: { tenantId, id: scope.scopeId },
              select: { classId: true },
            })
          : await db.subject.findFirst({
              where: { tenantId, id: scope.scopeId },
              select: { classId: true },
            });
      if (!row || (classes.length && !classes.includes(row.classId)))
        throw new BadRequestException('Conflicting academic scope');
    }
    result.set(roleId, scopes);
  }
  return result;
}

function parseDate(value: unknown): Date | undefined {
  if (value === undefined || value === null) return undefined;
  if (
    typeof value !== 'string' ||
    !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new BadRequestException(
      'Scope dates require ISO timestamps with a timezone',
    );
  return new Date(value);
}
