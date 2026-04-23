import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Mode, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import {
  DEFAULT_CHART_ACCOUNTS,
  DEFAULT_FEE_HEADS,
} from '../finance/finance.defaults';
import { PrismaService } from '../prisma/prisma.service';
import {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_DEFINITIONS,
  SYSTEM_ROLE_PERMISSIONS,
  buildPermissionKey,
} from '../rbac/rbac.defaults';
import { UsersService } from '../users/users.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterTenantDto) {
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existingTenant) {
      throw new ConflictException('Tenant slug is already in use');
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        mode: Mode.MULTI,
        plan: dto.plan ?? 'standard',
      },
    });

    await this.provisionTenantDefaults(tenant.id);

    const adminRole = await this.prisma.role.findUnique({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: 'admin',
        },
      },
    });

    if (!adminRole) {
      throw new NotFoundException('Default admin role was not provisioned');
    }

    const adminUser = await this.usersService.createManagedUser({
      tenantId: tenant.id,
      email: dto.adminEmail,
      password: dto.adminPassword,
      roleIds: [adminRole.id],
      assignedById: null,
    });

    await this.auditService.record({
      action: 'register',
      resource: 'tenant',
      tenantId: tenant.id,
      userId: adminUser.id,
      resourceId: tenant.id,
      after: {
        slug: tenant.slug,
        adminEmail: adminUser.email,
      },
    });

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
      },
      admin: {
        id: adminUser.id,
        email: adminUser.email,
      },
    };
  }

  async getCurrentTenant(actor: AuthContext) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: actor.tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const [userCount, staffCount, studentCount, classCount] = await Promise.all(
      [
        this.prisma.user.count({ where: { tenantId: actor.tenantId } }),
        this.prisma.staff.count({ where: { tenantId: actor.tenantId } }),
        this.prisma.student.count({ where: { tenantId: actor.tenantId } }),
        this.prisma.class.count({ where: { tenantId: actor.tenantId } }),
      ],
    );

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      mode: tenant.mode,
      isActive: tenant.isActive,
      counts: {
        users: userCount,
        staff: staffCount,
        students: studentCount,
        classes: classCount,
      },
    };
  }

  async provisionTenantDefaults(tenantId: string) {
    for (const permission of PERMISSION_CATALOG) {
      await this.prisma.permission.upsert({
        where: {
          resource_action: {
            resource: permission.resource,
            action: permission.action,
          },
        },
        update: {
          description: permission.description,
        },
        create: permission,
      });
    }

    for (const role of SYSTEM_ROLE_DEFINITIONS) {
      await this.prisma.role.upsert({
        where: {
          tenantId_name: {
            tenantId,
            name: role.name,
          },
        },
        update: {
          description: role.description,
          isSystem: true,
        },
        create: {
          tenantId,
          name: role.name,
          description: role.description,
          isSystem: true,
        },
      });
    }

    for (const [roleName, permissionKeys] of Object.entries(
      SYSTEM_ROLE_PERMISSIONS,
    )) {
      const role = await this.prisma.role.findUnique({
        where: {
          tenantId_name: {
            tenantId,
            name: roleName,
          },
        },
      });

      if (!role) {
        continue;
      }

      await this.prisma.rolePermission.deleteMany({
        where: {
          roleId: role.id,
        },
      });

      for (const permissionKey of permissionKeys) {
        const [resource, action] = permissionKey.split(':');
        const permission = await this.prisma.permission.findUnique({
          where: {
            resource_action: {
              resource,
              action,
            },
          },
        });

        if (!permission) {
          continue;
        }

        await this.prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }

    await this.ensureAcademicYearDefaults(tenantId);
    await this.ensureFinanceDefaults(tenantId);
  }

  private async ensureAcademicYearDefaults(tenantId: string) {
    const yearStart = new Date(
      `${new Date().getFullYear()}-04-01T00:00:00.000Z`,
    );
    const yearEnd = new Date(
      `${new Date().getFullYear() + 1}-03-31T23:59:59.999Z`,
    );

    await this.prisma.academicYear.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: `${yearStart.getUTCFullYear()}-${yearEnd.getUTCFullYear()}`,
        },
      },
      update: {
        startsOn: yearStart,
        endsOn: yearEnd,
        isCurrent: true,
      },
      create: {
        tenantId,
        name: `${yearStart.getUTCFullYear()}-${yearEnd.getUTCFullYear()}`,
        startsOn: yearStart,
        endsOn: yearEnd,
        isCurrent: true,
      },
    });
  }

  private async ensureFinanceDefaults(tenantId: string) {
    for (const account of DEFAULT_CHART_ACCOUNTS) {
      await this.prisma.chartAccount.upsert({
        where: {
          tenantId_code: {
            tenantId,
            code: account.code,
          },
        },
        update: {
          name: account.name,
          type: account.type,
          isSystem: true,
        },
        create: {
          tenantId,
          code: account.code,
          name: account.name,
          type: account.type,
          isSystem: true,
        },
      });
    }

    for (const feeHead of DEFAULT_FEE_HEADS) {
      await this.prisma.feeHead.upsert({
        where: {
          tenantId_code: {
            tenantId,
            code: feeHead.code,
          },
        },
        update: {
          name: feeHead.name,
          frequency: feeHead.frequency,
          defaultAmount: new Prisma.Decimal(feeHead.defaultAmount),
          vatApplicable: feeHead.vatApplicable,
        },
        create: {
          tenantId,
          code: feeHead.code,
          name: feeHead.name,
          frequency: feeHead.frequency,
          defaultAmount: new Prisma.Decimal(feeHead.defaultAmount),
          vatApplicable: feeHead.vatApplicable,
        },
      });
    }
  }
}
