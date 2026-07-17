import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SCHOOL_CONFIG_OWNER_ROLE } from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
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
        id: { in: dto.roleIds },
      },
    });

    if (roles.length !== dto.roleIds.length) {
      throw new NotFoundException(
        'One or more roles do not exist in this tenant',
      );
    }

    const removesOwnerRole = await this.wouldRemoveConfigOwnerRole(
      actor.tenantId,
      dto.userId,
      dto.roleIds,
    );
    if (removesOwnerRole) {
      if (!dto.reason?.trim()) {
        throw new BadRequestException(
          'A reason is required when removing the School Configuration Owner role.',
        );
      }
      await this.assertAnotherActiveConfigOwnerExists(
        actor.tenantId,
        dto.userId,
      );
    }

    await this.prisma.userRole.deleteMany({
      where: {
        userId: dto.userId,
        tenantId: actor.tenantId,
      },
    });

    await this.prisma.userRole.createMany({
      data: dto.roleIds.map((roleId) => ({
        userId: dto.userId,
        roleId,
        tenantId: actor.tenantId,
        assignedById: actor.userId,
      })),
    });

    await this.auditService.record({
      action: 'assign_roles',
      resource: 'user',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: dto.userId,
      after: {
        roleIds: dto.roleIds,
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
      },
      include: { role: true },
    });
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
