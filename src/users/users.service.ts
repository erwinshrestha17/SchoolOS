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

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async createUser(dto: CreateUserDto, actor: AuthContext) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: actor.tenantId,
          email: dto.email,
        },
      },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered in this tenant');
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

    const passwordHash = await bcrypt.hash(
      dto.password,
      this.configService.bcryptRounds,
    );

    const user = await this.prisma.user.create({
      data: {
        tenantId: actor.tenantId,
        email: dto.email,
        phone: dto.phone ?? null,
        passwordHash,
        authMethod: AuthMethod.PASSWORD,
        status: UserStatus.ACTIVE,
        userRoles: {
          create: dto.roleIds.map((roleId) => ({
            roleId,
            tenantId: actor.tenantId,
            assignedById: actor.userId,
          })),
        },
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
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

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      status: user.status,
      roles: user.userRoles.map(({ role }) => ({
        id: role.id,
        name: role.name,
      })),
    };
  }
}
