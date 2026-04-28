import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateStaffDto } from './dto/create-staff.dto';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  async createStaff(dto: CreateStaffDto, actor: AuthContext) {
    const employeeId = dto.employeeId ?? (await this.generateEmployeeId(actor));

    const existingStaff = await this.prisma.staff.findUnique({
      where: { employeeId },
    });

    if (existingStaff) {
      throw new ConflictException('Employee ID already exists');
    }

    const managedUser = await this.usersService.createManagedUser({
      tenantId: actor.tenantId,
      email: dto.email,
      password: dto.password,
      phone: dto.phone,
      roleIds: dto.roleIds,
      assignedById: actor.userId,
    });

    const staff = await this.prisma.staff.create({
      data: {
        tenantId: actor.tenantId,
        userId: managedUser.id,
        employeeId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        photoUrl: dto.photoUrl ?? null,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        address: dto.address,
        teacherRegistryId: dto.teacherRegistryId ?? null,
        citizenshipNo: dto.citizenshipNo ?? null,
        panNumber: dto.panNumber ?? null,
        bankAccount: dto.bankAccount ?? null,
        bankName: dto.bankName ?? null,
        qualifications: dto.qualifications ?? null,
        experience: dto.experience ?? null,
        joiningDate: new Date(dto.joiningDate),
        contractType: dto.contractType,
        probationEndDate: dto.probationEndDate
          ? new Date(dto.probationEndDate)
          : null,
      },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    const currentYear = new Date().getFullYear();
    await this.prisma.staffLeaveBalance.createMany({
      data: [
        {
          tenantId: actor.tenantId,
          staffId: staff.id,
          leaveType: 'Sick',
          year: currentYear,
          allocated: 12,
        },
        {
          tenantId: actor.tenantId,
          staffId: staff.id,
          leaveType: 'Casual',
          year: currentYear,
          allocated: 10,
        },
        {
          tenantId: actor.tenantId,
          staffId: staff.id,
          leaveType: 'Earned',
          year: currentYear,
          allocated: 18,
        },
        {
          tenantId: actor.tenantId,
          staffId: staff.id,
          leaveType: 'Maternity',
          year: currentYear,
          allocated: 98,
        },
        {
          tenantId: actor.tenantId,
          staffId: staff.id,
          leaveType: 'Paternity',
          year: currentYear,
          allocated: 15,
        },
      ],
    });

    await this.auditService.record({
      action: 'create',
      resource: 'staff',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: staff.id,
      after: {
        employeeId: staff.employeeId,
        email: staff.user.email,
        roleIds: dto.roleIds,
      },
    });

    return {
      id: staff.id,
      employeeId: staff.employeeId,
      firstName: staff.firstName,
      lastName: staff.lastName,
      email: staff.user.email,
      roles: staff.user.userRoles.map(({ role }) => role.name),
      joiningDate: staff.joiningDate,
    };
  }

  async listStaff(actor: AuthContext) {
    const staff = await this.prisma.staff.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
      orderBy: [{ joiningDate: 'desc' }, { firstName: 'asc' }],
    });

    return staff.map((member) => ({
      id: member.id,
      employeeId: member.employeeId,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.user.email,
      roles: member.user.userRoles.map(({ role }) => role.name),
      joiningDate: member.joiningDate,
      contractType: member.contractType,
    }));
  }

  private async generateEmployeeId(actor: AuthContext) {
    const count = await this.prisma.staff.count({
      where: { tenantId: actor.tenantId },
    });

    return `${normalizeSlug(actor.tenantSlug)}-EMP-${String(count + 1).padStart(4, '0')}`;
  }
}

function normalizeSlug(slug: string) {
  return slug.replace(/[^a-z0-9]/gi, '').toUpperCase();
}
