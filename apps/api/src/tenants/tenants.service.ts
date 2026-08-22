import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Mode, Prisma } from '@prisma/client';
import { SCHOOL_CONFIG_OWNER_ROLE } from '@schoolos/core';
import { ClsService } from 'nestjs-cls';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { REQUEST_ID_KEY } from '../common/security/cls-keys';
import {
  DEFAULT_CHART_ACCOUNTS,
  DEFAULT_FEE_HEADS,
  DEFAULT_ACCOUNTING_SOURCE_MAPPINGS,
} from '../finance/finance.defaults';
import { PrismaService } from '../prisma/prisma.service';
import {
  PERMISSION_CATALOG,
  SCHOOL_ROLE_DEFINITIONS,
  SCHOOL_ROLE_PERMISSIONS,
} from '../rbac/rbac.defaults';
import { UsersService } from '../users/users.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly cls: ClsService,
  ) {}

  async register(dto: RegisterTenantDto, actor: AuthContext) {
    const requestId = this.cls.get<string | undefined>(REQUEST_ID_KEY);

    // Provisioning reads and writes rows for a not-yet-established school
    // tenant while the authenticated operator remains scoped to the Platform
    // tenant. Use the explicit, auditable bypass region; an empty CLS context
    // would fail closed and is not itself authority to cross tenants.
    return this.prisma.runWithoutTenantScope(
      'platform: provision a new school tenant and its first administrator',
      () => this.provisionTenant(dto, actor, requestId),
    );
  }

  private async provisionTenant(
    dto: RegisterTenantDto,
    actor: AuthContext,
    requestId: string | undefined,
  ) {
    const normalizedEmail = dto.adminEmail.trim().toLowerCase();

    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existingTenant) {
      throw new ConflictException('Tenant slug is already in use');
    }

    const existingAdmin = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingAdmin) {
      throw new ConflictException(
        'Admin email is already registered in SchoolOS',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          mode: Mode.MULTI,
          plan: dto.plan ?? 'standard',
        },
      });

      await this.provisionTenantDefaults(tenant.id, tx);

      const adminRole = await tx.role.findUnique({
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

      const configOwnerRole = await tx.role.findUnique({
        where: {
          tenantId_name: {
            tenantId: tenant.id,
            name: SCHOOL_CONFIG_OWNER_ROLE,
          },
        },
      });

      if (!configOwnerRole) {
        throw new NotFoundException(
          'School Configuration Owner role was not provisioned',
        );
      }

      const adminUser = await this.usersService.createManagedUser(
        {
          tenantId: tenant.id,
          email: normalizedEmail,
          password: dto.adminPassword,
          roleIds: [adminRole.id, configOwnerRole.id],
          assignedById: null,
        },
        tx,
      );

      await this.auditService.record(
        {
          action: 'register',
          resource: 'tenant',
          tenantId: tenant.id,
          userId: actor.userId,
          resourceId: tenant.id,
          requestId,
          after: {
            slug: tenant.slug,
            adminEmail: adminUser.email,
            adminUserId: adminUser.id,
          },
        },
        tx,
      );

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
    });
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

  async provisionTenantDefaults(
    tenantId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    for (const permission of PERMISSION_CATALOG) {
      await tx.permission.upsert({
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

    for (const role of SCHOOL_ROLE_DEFINITIONS) {
      await tx.role.upsert({
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
      SCHOOL_ROLE_PERMISSIONS,
    )) {
      const role = await tx.role.findUnique({
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

      await tx.rolePermission.deleteMany({
        where: {
          roleId: role.id,
        },
      });

      for (const permissionKey of permissionKeys) {
        const parts = permissionKey.split(':');
        const action = parts.pop();
        const resource = parts.join(':');
        if (!resource || !action) {
          throw new Error(`Invalid permission key: ${permissionKey}`);
        }
        const permission = await tx.permission.findUnique({
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

        await tx.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }

    await this.ensureAcademicYearDefaults(tenantId, tx);
    await this.ensureFinanceDefaults(tenantId, tx);
  }

  private async ensureAcademicYearDefaults(
    tenantId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const yearStart = new Date(
      `${new Date().getFullYear()}-04-01T00:00:00.000Z`,
    );
    const yearEnd = new Date(
      `${new Date().getFullYear() + 1}-03-31T23:59:59.999Z`,
    );

    await tx.academicYear.upsert({
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

  private async ensureFinanceDefaults(
    tenantId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    for (const account of DEFAULT_CHART_ACCOUNTS) {
      await tx.chartAccount.upsert({
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
      await tx.feeHead.upsert({
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

    for (const mapping of DEFAULT_ACCOUNTING_SOURCE_MAPPINGS) {
      const debitAccount = await tx.chartAccount.findUnique({
        where: {
          tenantId_code: { tenantId, code: mapping.debitCode },
        },
      });
      const creditAccount = await tx.chartAccount.findUnique({
        where: {
          tenantId_code: { tenantId, code: mapping.creditCode },
        },
      });

      if (!debitAccount || !creditAccount) {
        continue;
      }

      const existing = await tx.accountingSourceMapping.findFirst({
        where: {
          tenantId,
          sourceModule: mapping.sourceModule,
          sourceType: mapping.sourceType,
          postingType: mapping.postingType,
          isActive: true,
        },
      });

      if (existing) {
        continue;
      }

      await tx.accountingSourceMapping.create({
        data: {
          tenantId,
          sourceModule: mapping.sourceModule,
          sourceType: mapping.sourceType,
          postingType: mapping.postingType,
          debitAccountId: debitAccount.id,
          creditAccountId: creditAccount.id,
          description: mapping.description,
        },
      });
    }
  }
}
