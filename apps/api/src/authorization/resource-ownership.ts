import { studentResourceScope } from './scopes/student-resource-scope';
import { Injectable, Optional, SetMetadata } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ResourceScope } from './scopes/scope.types';

export const RESOURCE_OWNERSHIP_KEY = 'authorization.resourceOwnership';
export type OwnershipResourceType =
  | 'STUDENT'
  | 'CLASS'
  | 'SECTION'
  | 'SUBJECT'
  | 'STAFF'
  | 'FINANCE_ACCOUNT';
export const AuthorizeResource = (type: OwnershipResourceType, param: string) =>
  SetMetadata(RESOURCE_OWNERSHIP_KEY, Object.freeze({ type, param }));
export interface OwnedResource {
  readonly id: string;
  readonly tenantId: string;
  readonly scope: ResourceScope;
}

/** Minimal, explicitly tenant-scoped persistence projection; request dimensions are never trusted. */
@Injectable()
export class ResourceOwnershipService {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async lookup(
    tenantId: string,
    type: OwnershipResourceType,
    id: string,
  ): Promise<OwnedResource | null> {
    if (!this.prisma || !id || !tenantId) return null;
    const scope: Partial<Record<keyof ResourceScope, string>> = {
      TENANT: tenantId,
    };
    const where = { tenantId, id };
    switch (type) {
      case 'STUDENT': {
        const row = await this.prisma.student.findFirst({
          where: { ...where, class: { tenantId } },
          select: {
            id: true,
            tenantId: true,
            classId: true,
            sectionId: true,
            enrollments: {
              where: {
                tenantId,
                status: 'ACTIVE',
                academicYear: { tenantId, isCurrent: true },
                effectiveFrom: { lte: new Date() },
                OR: [
                  { effectiveUntil: null },
                  { effectiveUntil: { gt: new Date() } },
                ],
              },
              select: {
                academicYearId: true,
                classId: true,
                sectionId: true,
                status: true,
                effectiveFrom: true,
                effectiveUntil: true,
                academicYear: { select: { isCurrent: true } },
              },
              take: 2,
            },
          },
        });
        if (!row) return null;
        return { id, tenantId: row.tenantId, scope: studentResourceScope(row) };
      }
      case 'SECTION':
      case 'SUBJECT': {
        const row =
          type === 'SECTION'
            ? await this.prisma.section.findFirst({
                where: { ...where, class: { tenantId } },
                select: { tenantId: true, classId: true },
              })
            : await this.prisma.subject.findFirst({
                where: { ...where, class: { tenantId } },
                select: { tenantId: true, classId: true },
              });
        if (!row) return null;
        scope[type] = id;
        scope.CLASS = row.classId;
        return { id, tenantId: row.tenantId, scope };
      }
      case 'CLASS':
      case 'STAFF':
      case 'FINANCE_ACCOUNT': {
        const row =
          type === 'CLASS'
            ? await this.prisma.class.findFirst({
                where,
                select: { tenantId: true },
              })
            : type === 'STAFF'
              ? await this.prisma.staff.findFirst({
                  where: { ...where, user: { tenantId } },
                  select: { tenantId: true },
                })
              : await this.prisma.chartAccount.findFirst({
                  where,
                  select: { tenantId: true },
                });
        return row
          ? { id, tenantId: row.tenantId, scope: { ...scope, [type]: id } }
          : null;
      }
    }
  }
}

/** Validate all requested ids before any batch write; never silently operate on a subset. */
export function assertCompleteTenantBatch(
  tenantId: string,
  requestedIds: readonly string[],
  rows: ReadonlyArray<{ id: string; tenantId: string }>,
): boolean {
  const ids = new Set(requestedIds);
  return (
    ids.size === requestedIds.length &&
    rows.length === ids.size &&
    rows.every((row) => row.tenantId === tenantId && ids.delete(row.id)) &&
    ids.size === 0
  );
}
