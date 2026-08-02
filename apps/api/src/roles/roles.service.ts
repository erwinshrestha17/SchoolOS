import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SCHOOL_CONFIG_OWNER_ROLE,
  systemRolePermissions,
} from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import { AuthzCacheService } from '../auth/authz-cache.service';
import { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import {
  FINANCIAL_AUDITOR_ROLE,
  resolveRoleAssignmentExpiries,
} from './role-assignment-expiry';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly authzCache: AuthzCacheService,
  ) {}

  async listRoles(actor: AuthContext) {
    const roles = await this.prisma.role.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissions: [...role.rolePermissions]
        .sort((left, right) => {
          const leftKey = `${left.permission.resource}:${left.permission.action}`;
          const rightKey = `${right.permission.resource}:${right.permission.action}`;
          return leftKey.localeCompare(rightKey);
        })
        .map(({ permission }) => ({
          id: permission.id,
          key: `${permission.resource}:${permission.action}`,
        })),
    }));
  }

  async listPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });

    return permissions.map((permission) => ({
      id: permission.id,
      resource: permission.resource,
      action: permission.action,
      key: `${permission.resource}:${permission.action}`,
      description: permission.description,
    }));
  }

  async createRole(dto: CreateRoleDto, actor: AuthContext) {
    const existingRole = await this.prisma.role.findUnique({
      where: {
        tenantId_name: {
          tenantId: actor.tenantId,
          name: dto.name,
        },
      },
    });

    if (existingRole) {
      throw new ConflictException('Role already exists in this tenant');
    }

    const role = await this.prisma.role.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        description: dto.description,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'role',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: role.id,
      after: { name: role.name },
    });

    return role;
  }

  async assignPermissions(
    roleId: string,
    dto: AssignPermissionsDto,
    actor: AuthContext,
  ) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        tenantId: actor.tenantId,
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found in this tenant');
    }

    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: dto.permissionIds } },
    });

    if (permissions.length !== dto.permissionIds.length) {
      throw new NotFoundException('One or more permissions do not exist');
    }

    await this.prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    await this.prisma.rolePermission.createMany({
      data: dto.permissionIds.map((permissionId) => ({
        roleId: role.id,
        permissionId,
      })),
    });

    // Changing a role's permissions changes the effective permission set of
    // every user holding it, so the whole tenant namespace is dropped.
    // AuthzCacheService documents the full invalidation contract.
    await this.authzCache.invalidateTenant(actor.tenantId);

    await this.auditService.record({
      action: 'assign_permissions',
      resource: 'role',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: role.id,
      after: { permissionIds: dto.permissionIds },
    });

    return this.prisma.role.findUnique({
      where: { id: role.id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async assignRoles(dto: AssignRoleDto, actor: AuthContext) {
    const roleIds = Array.from(new Set(dto.roleIds));
    const user = await this.prisma.user.findFirst({
      where: {
        id: dto.userId,
        tenantId: actor.tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this tenant');
    }

    const roles = await this.prisma.role.findMany({
      where: {
        tenantId: actor.tenantId,
        id: { in: roleIds },
      },
    });

    if (roles.length !== roleIds.length) {
      throw new NotFoundException(
        'One or more roles do not exist in this tenant',
      );
    }

    const expiresAtByRole = resolveRoleAssignmentExpiries(
      roles,
      dto.expiresAtByRole,
    );

    const removesOwnerRole = await this.wouldRemoveConfigOwnerRole(
      actor.tenantId,
      dto.userId,
      roleIds,
    );
    const activeAssignments = await this.prisma.userRole.findMany({
      where: {
        userId: dto.userId,
        tenantId: actor.tenantId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { role: true },
    });
    const removedAssignments = activeAssignments.filter(
      ({ roleId }) => !roleIds.includes(roleId),
    );
    const removesAuditorRole = removedAssignments.some(
      ({ role }) => role.name === FINANCIAL_AUDITOR_ROLE,
    );

    if (removesOwnerRole || removesAuditorRole) {
      if (!dto.reason?.trim()) {
        throw new BadRequestException(
          'A reason is required when revoking protected role access.',
        );
      }
    }
    if (removesOwnerRole) {
      await this.assertAnotherActiveConfigOwnerExists(
        actor.tenantId,
        dto.userId,
      );
    }

    const activeByRoleId = new Map(
      activeAssignments.map((assignment) => [assignment.roleId, assignment]),
    );
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const assignment of removedAssignments) {
        await tx.userRole.update({
          where: { id: assignment.id },
          data: {
            revokedAt: now,
            revokedById: actor.userId,
            revokeReason: dto.reason?.trim() ?? 'Role assignment replaced',
          },
        });
      }

      for (const roleId of roleIds) {
        const existing = activeByRoleId.get(roleId);
        const expiresAt = expiresAtByRole.get(roleId) ?? null;
        if (existing) {
          await tx.userRole.update({
            where: { id: existing.id },
            data: { expiresAt },
          });
          continue;
        }
        await tx.userRole.create({
          data: {
            userId: dto.userId,
            roleId,
            tenantId: actor.tenantId,
            assignedById: actor.userId,
            expiresAt,
          },
        });
      }
    });

    // Only this user's role membership changed.
    await this.authzCache.invalidateUser(actor.tenantId, dto.userId);

    await this.auditService.record({
      action: 'assign_roles',
      resource: 'user',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: dto.userId,
      after: {
        roleIds,
        expiresAtByRole: Object.fromEntries(
          [...expiresAtByRole].map(([roleId, value]) => [
            roleId,
            value?.toISOString() ?? null,
          ]),
        ),
        revokedRoleIds: removedAssignments.map(({ roleId }) => roleId),
        ...(removesOwnerRole
          ? {
              configOwnerRoleRemoved: true,
              reason: dto.reason?.trim(),
            }
          : {}),
      },
    });

    return this.prisma.userRole.findMany({
      where: {
        userId: dto.userId,
        tenantId: actor.tenantId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { role: true },
    });
  }

  async previewFinancePermissionReconciliation(actor: AuthContext) {
    const presetNames = FINANCE_RECONCILIATION_ROLE_PRESETS;
    const roles = await this.prisma.role.findMany({
      where: { tenantId: actor.tenantId, name: { in: [...presetNames] } },
      include: {
        rolePermissions: { include: { permission: true } },
      },
      orderBy: { name: 'asc' },
    });
    const now = new Date();
    const designatedFinanceUserCount = await this.prisma.userRole.count({
      where: {
        tenantId: actor.tenantId,
        role: { name: 'accountant' },
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    const roleByName = new Map(roles.map((role) => [role.name, role]));
    const changes = presetNames.map((roleName) => {
      const role = roleByName.get(roleName);
      const current = new Set(
        (role?.rolePermissions ?? [])
          .map(
            ({ permission }) => `${permission.resource}:${permission.action}`,
          )
          .filter(isFinancePermissionKey),
      );
      const expected = new Set(
        (systemRolePermissions[roleName] ?? []).filter(isFinancePermissionKey),
      );
      return {
        roleName,
        roleId: role?.id ?? null,
        missingRole: !role,
        add: [...expected].filter((key) => !current.has(key)).sort(),
        remove: [...current].filter((key) => !expected.has(key)).sort(),
      };
    });

    const hasPermissionChanges = changes.some(
      (change) =>
        change.missingRole || change.add.length > 0 || change.remove.length > 0,
    );
    return {
      status:
        designatedFinanceUserCount === 0
          ? ('BLOCKED' as const)
          : hasPermissionChanges
            ? ('PARTIAL' as const)
            : ('PASS' as const),
      designatedFinanceUserCount,
      financeAuthorityLocked: designatedFinanceUserCount === 0,
      changes,
      note:
        designatedFinanceUserCount === 0
          ? 'No active Accountant is designated. Finance mutation remains safely unavailable until an authorized administrator explicitly assigns the Accountant role.'
          : 'Finance permissions can be reconciled without changing any user role assignment.',
    };
  }

  async reconcileFinancePermissions(reason: string, actor: AuthContext) {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      throw new BadRequestException(
        'A reason is required to reconcile finance permissions.',
      );
    }

    const preview = await this.previewFinancePermissionReconciliation(actor);
    const roles = await this.prisma.role.findMany({
      where: {
        tenantId: actor.tenantId,
        name: { in: [...FINANCE_RECONCILIATION_ROLE_PRESETS] },
      },
    });
    const permissions = await this.prisma.permission.findMany();
    const permissionByKey = new Map(
      permissions.map((permission) => [
        `${permission.resource}:${permission.action}`,
        permission,
      ]),
    );
    const changeByRole = new Map<string, (typeof preview.changes)[number]>(
      preview.changes.map((change) => [change.roleName, change]),
    );

    await this.prisma.$transaction(async (tx) => {
      for (const role of roles) {
        const change = changeByRole.get(role.name);
        if (!change) continue;
        const removeIds = change.remove
          .map((key) => permissionByKey.get(key)?.id)
          .filter((id): id is string => Boolean(id));
        if (removeIds.length) {
          await tx.rolePermission.deleteMany({
            where: { roleId: role.id, permissionId: { in: removeIds } },
          });
        }
        const addIds = change.add.map((key) => {
          const permission = permissionByKey.get(key);
          if (!permission) {
            throw new ConflictException(
              `Finance permission catalog entry is missing for ${key}`,
            );
          }
          return permission.id;
        });
        if (addIds.length) {
          await tx.rolePermission.createMany({
            data: addIds.map((permissionId) => ({
              roleId: role.id,
              permissionId,
            })),
            skipDuplicates: true,
          });
        }
      }
    });

    await this.authzCache.invalidateTenant(actor.tenantId);
    await this.auditService.record({
      action: 'reconcile_finance_permissions',
      resource: 'role_permissions',
      resourceId: actor.tenantId,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { status: preview.status, changes: preview.changes },
      after: {
        reason: trimmedReason,
        userRoleAssignmentsChanged: false,
        designatedFinanceUserCount: preview.designatedFinanceUserCount,
      },
    });

    return this.previewFinancePermissionReconciliation(actor);
  }

  private async wouldRemoveConfigOwnerRole(
    tenantId: string,
    userId: string,
    nextRoleIds: string[],
  ): Promise<boolean> {
    const currentOwnerAssignment = await this.prisma.userRole.findFirst({
      where: {
        tenantId,
        userId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        role: { tenantId, name: SCHOOL_CONFIG_OWNER_ROLE },
      },
      select: { roleId: true },
    });
    if (!currentOwnerAssignment) {
      return false;
    }
    return !nextRoleIds.includes(currentOwnerAssignment.roleId);
  }

  private async assertAnotherActiveConfigOwnerExists(
    tenantId: string,
    excludedUserId: string,
  ): Promise<void> {
    const otherActiveOwners = await this.prisma.userRole.count({
      where: {
        tenantId,
        userId: { not: excludedUserId },
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        role: { tenantId, name: SCHOOL_CONFIG_OWNER_ROLE },
        user: { status: 'ACTIVE' },
      },
    });
    if (otherActiveOwners === 0) {
      throw new ForbiddenException(
        'At least one active School Configuration Owner must remain. Assign the role to another active user first.',
      );
    }
  }
}

const FINANCE_RECONCILIATION_ROLE_PRESETS = [
  'admin',
  'principal',
  'accountant',
  'financial_auditor',
  'hr_manager',
] as const;

function isFinancePermissionKey(key: string): boolean {
  const root = key.split(':')[0];
  return (
    [
      'accounting',
      'fees',
      'payments',
      'receipts',
      'ledger',
      'payroll',
      'finance',
    ].includes(root) ||
    key === 'reports:export' ||
    key === 'settings:finance:manage' ||
    key === 'settings:accounting:manage'
  );
}
