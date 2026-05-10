import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthMethod, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async createUser(dto: CreateUserDto, actor: AuthContext) {
    const user = await this.createManagedUser({
      tenantId: actor.tenantId,
      email: dto.email,
      phone: dto.phone,
      password: dto.password,
      roleIds: dto.roleIds,
      assignedById: actor.userId,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'user',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: user.id,
      after: {
        email: user.email,
        roleIds: dto.roleIds,
      },
    });

    return this.toUserSummary(user);
  }

  async createManagedUser(input: CreateManagedUserInput) {
    await this.ensureEmailIsAvailable(input.tenantId, input.email);

    const roles = await this.prisma.role.findMany({
      where: {
        tenantId: input.tenantId,
        id: { in: input.roleIds },
      },
    });

    if (roles.length !== input.roleIds.length) {
      throw new NotFoundException(
        'One or more roles do not exist in this tenant',
      );
    }

    const passwordHash = await bcrypt.hash(
      input.password,
      this.configService.bcryptRounds,
    );

    return this.prisma.user.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        phone: input.phone ?? null,
        passwordHash,
        authMethod: AuthMethod.PASSWORD,
        status: input.status ?? UserStatus.ACTIVE,
        userRoles: {
          create: input.roleIds.map((roleId) => ({
            roleId,
            tenantId: input.tenantId,
            assignedById: input.assignedById ?? null,
          })),
        },
      },
      include: this.userInclude,
    });
  }

  async listUsers(actor: AuthContext) {
    const users = await this.prisma.user.findMany({
      where: { tenantId: actor.tenantId },
      include: this.userInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return users.map((user) => this.toUserSummary(user));
  }

  async updateStatus(
    userId: string,
    dto: UpdateUserStatusDto,
    actor: AuthContext,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: actor.tenantId,
      },
      include: this.userInclude,
    });

    if (!user) {
      throw new NotFoundException('User not found in this tenant');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: dto.status,
      },
      include: this.userInclude,
    });

    if (dto.status !== UserStatus.ACTIVE) {
      await this.revokeUserSessions(user.id);
    }

    await this.auditService.record({
      action: 'update_status',
      resource: 'user',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: user.id,
      before: { status: user.status },
      after: { status: dto.status },
    });

    return this.toUserSummary(updatedUser);
  }

  async resetPassword(
    userId: string,
    dto: ResetUserPasswordDto,
    actor: AuthContext,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: actor.tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this tenant');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(
          dto.password,
          this.configService.bcryptRounds,
        ),
      },
    });

    await this.revokeUserSessions(user.id);

    await this.auditService.record({
      action: 'reset_password',
      resource: 'user',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: user.id,
      after: {
        passwordReset: true,
      },
    });

    return { success: true };
  }

  async forceLogout(userId: string, actor: AuthContext) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId: actor.tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this tenant');
    }

    await this.revokeUserSessions(user.id);

    await this.auditService.record({
      action: 'force_logout',
      resource: 'user',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: user.id,
      after: { sessionsRevoked: true },
    });

    return { success: true };
  }

  private get userInclude() {
    return {
      userRoles: {
        include: {
          role: true,
        },
      },
      staff: true,
      student: true,
    } as const;
  }

  private async ensureEmailIsAvailable(tenantId: string, email: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId,
          email,
        },
      },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered in this tenant');
    }
  }

  async deactivateTenant(tenantId: string, actor: AuthContext) {
    // Only super_admin can deactivate a tenant
    if (!actor.roles.includes('super_admin')) {
      throw new ConflictException('Only super admins can deactivate tenants');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive: false },
    });

    // Revoke all sessions for all users in this tenant
    await this.prisma.refreshToken.updateMany({
      where: {
        user: { tenantId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await this.auditService.record({
      action: 'deactivate',
      resource: 'tenant',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: tenantId,
      after: { isActive: false },
    });

    return { success: true, tenantId, isActive: false };
  }

  private async revokeUserSessions(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private toUserSummary(user: UserWithRelations) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      status: user.status,
      roles: user.userRoles.map(({ role }) => ({
        id: role.id,
        name: role.name,
      })),
      profileType: user.staff ? 'staff' : user.student ? 'student' : 'user',
      staffId: user.staff?.id ?? null,
      studentId: user.student?.id ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt,
    };
  }
}

interface CreateManagedUserInput {
  tenantId: string;
  email: string;
  password: string;
  phone?: string;
  roleIds: string[];
  assignedById?: string | null;
  status?: UserStatus;
}

interface UserWithRelations {
  id: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  userRoles: Array<{
    role: {
      id: string;
      name: string;
    };
  }>;
  staff: {
    id: string;
  } | null;
  student: {
    id: string;
  } | null;
}
