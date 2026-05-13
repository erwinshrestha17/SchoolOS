import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StaffStatus, StaffLifecycleEventType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { StaffLifecycleDto } from './dto/staff-lifecycle.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffLifecycleService } from './staff-lifecycle.service';
import { UsageService } from '../usage/usage.service';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly lifecycleService: StaffLifecycleService,
    private readonly usageService: UsageService,
  ) {}

  async createStaff(dto: CreateStaffDto, actor: AuthContext) {
    const employeeId = dto.employeeId ?? (await this.generateEmployeeId(actor));

    const existingStaff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, employeeId },
    });

    if (existingStaff) {
      throw new ConflictException('Employee ID already exists');
    }

    const currentCount = await this.prisma.staff.count({
      where: { tenantId: actor.tenantId, status: 'ACTIVE' },
    });
    await this.usageService.verifyLimit(
      actor.tenantId,
      'staff.count',
      currentCount,
    );

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

    await this.usageService.incrementUsage(actor.tenantId, 'staff.count');

    await this.lifecycleService.recordEvent(
      staff.id,
      StaffLifecycleEventType.HIRED,
      actor,
      {
        eventDate: staff.joiningDate,
        reason: 'Initial recruitment',
      },
    );

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

  async getStaffProfile(actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
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
        staffContracts: {
          orderBy: { startDate: 'desc' },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff profile not found');
    }

    return staff;
  }

  async getStaffDetail(staffId: string, actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
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
        staffContracts: {
          orderBy: { startDate: 'desc' },
        },
        salaryStructures: {
          include: {
            components: true,
          },
          orderBy: { effectiveFrom: 'desc' },
        },
        attendanceRecords: {
          orderBy: { attendanceDate: 'desc' },
          take: 30,
        },
        leaveBalances: {
          orderBy: [{ year: 'desc' }, { leaveType: 'asc' }],
        },
        leaveRequests: {
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
        payrollLines: {
          include: {
            payrollRun: true,
            payslip: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
        qualificationsRecords: true,
        experienceRecords: true,
        teacherAssignments: {
          include: {
            subject: true,
            class: true,
            section: true,
          },
        },
      },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found in this tenant');
    }

    return mapStaffDetail(staff, actor);
  }

  async updateStaff(staffId: string, dto: UpdateStaffDto, actor: AuthContext) {
    const existing = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
      include: { user: true },
    });

    if (!existing) {
      throw new NotFoundException('Staff member not found in this tenant');
    }

    if (dto.employeeId && dto.employeeId !== existing.employeeId) {
      const duplicate = await this.prisma.staff.findFirst({
        where: {
          tenantId: actor.tenantId,
          employeeId: dto.employeeId,
          id: { not: staffId },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          'Employee ID already exists in this tenant',
        );
      }
    }

    if (dto.staffCode && dto.staffCode !== existing.staffCode) {
      const duplicate = await this.prisma.staff.findFirst({
        where: {
          tenantId: actor.tenantId,
          staffCode: dto.staffCode,
          id: { not: staffId },
        },
      });

      if (duplicate) {
        throw new ConflictException('Staff code already exists in this tenant');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.email && dto.email !== existing.user.email) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { email: dto.email },
        });
      }

      return tx.staff.update({
        where: { id: existing.id },
        data: buildStaffUpdateData(dto),
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
          staffContracts: true,
          salaryStructures: {
            include: { components: true },
          },
          attendanceRecords: { take: 0 },
          leaveBalances: true,
          leaveRequests: { take: 0 },
          payrollLines: { take: 0 },
          qualificationsRecords: true,
          experienceRecords: true,
          teacherAssignments: true,
        },
      });
    });

    await this.auditService.record({
      action: 'update',
      resource: 'staff',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: {
        employeeId: existing.employeeId,
        staffCode: existing.staffCode,
        status: existing.status,
        email: existing.user.email,
        firstName: existing.firstName,
        lastName: existing.lastName,
        joiningDate: existing.joiningDate,
        contractType: existing.contractType,
        department: existing.department,
        designation: existing.designation,
      },
      after: {
        employeeId: updated.employeeId,
        staffCode: updated.staffCode,
        status: updated.status,
        email: updated.user.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        joiningDate: updated.joiningDate,
        contractType: updated.contractType,
        department: updated.department,
        designation: updated.designation,
      },
    });

    return mapStaffDetail(updated, actor);
  }

  async transitionStaffStatus(
    staffId: string,
    dto: StaffLifecycleDto,
    actor: AuthContext,
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
      include: { user: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found in this tenant');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Suspend user if status is Terminated, Resigned or Suspended
      if (isInactiveStaffStatus(dto.status)) {
        await tx.user.update({
          where: { id: staff.userId },
          data: { status: 'SUSPENDED' },
        });
      } else if (dto.status === StaffStatus.ACTIVE) {
        // Reactivate user if they were suspended and are now active
        if (staff.user.status === 'SUSPENDED') {
          await tx.user.update({
            where: { id: staff.userId },
            data: { status: 'ACTIVE' },
          });
        }
      }

      return tx.staff.update({
        where: { id: staff.id },
        data: { status: dto.status },
      });
    });

    await this.auditService.record({
      action: 'lifecycle',
      resource: 'staff',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: staff.id,
      before: { status: staff.status },
      after: { status: updated.status, reason: dto.reason ?? null },
    });

    await this.lifecycleService.recordEvent(
      staff.id,
      StaffLifecycleEventType.STATUS_CHANGE,
      actor,
      {
        reason: dto.reason,
        metadata: { from: staff.status, to: updated.status },
      },
    );

    return updated;
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
      take: 100,
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

  async terminateStaff(
    staffId: string,
    dto: { reason: string; effectiveDate?: string },
    actor: AuthContext,
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
      include: { user: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    const effectiveDate = dto.effectiveDate
      ? new Date(dto.effectiveDate)
      : new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      // Deactivate user if effective date is today or in the past
      if (effectiveDate <= new Date()) {
        await tx.user.update({
          where: { id: staff.userId },
          data: { status: 'SUSPENDED' },
        });
      }

      // Update staff status
      return tx.staff.update({
        where: { id: staff.id },
        data: {
          status: StaffStatus.TERMINATED,
        },
      });
    });

    await this.lifecycleService.recordEvent(
      staff.id,
      StaffLifecycleEventType.TERMINATED,
      actor,
      {
        reason: dto.reason,
        eventDate: effectiveDate,
      },
    );

    await this.auditService.record({
      action: 'terminate',
      resource: 'staff',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: staff.id,
      after: {
        status: StaffStatus.TERMINATED,
        reason: dto.reason,
        effectiveDate,
      },
    });

    return updated;
  }
}

function normalizeSlug(slug: string) {
  return slug.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

function buildStaffUpdateData(dto: UpdateStaffDto): Prisma.StaffUpdateInput {
  return {
    employeeId: dto.employeeId,
    staffCode: dto.staffCode,
    firstName: dto.firstName,
    lastName: dto.lastName,
    dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    gender: dto.gender,
    address: dto.address,
    joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
    contractType: dto.contractType,
    employmentType: dto.employmentType,
    status: dto.status,
    department: dto.department,
    designation: dto.designation,
    contractStatus: dto.contractStatus,
    teacherRegistryId: dto.teacherRegistryId,
    citizenshipNo: dto.citizenshipNo,
    panNumber: dto.panNumber,
    bankAccount: dto.bankAccount,
    bankName: dto.bankName,
    emergencyContactName: dto.emergencyContactName,
    emergencyContactPhone: dto.emergencyContactPhone,
    emergencyContactRelation: dto.emergencyContactRelation,
    qualifications: dto.qualifications,
    experience: dto.experience,
  };
}

function mapStaffDetail(
  staff: {
    id: string;
    employeeId: string;
    staffCode?: string | null;
    firstName: string;
    lastName: string;
    firstNameNp?: string | null;
    lastNameNp?: string | null;
    userId?: string | null;
    photoUrl?: string | null;
    dateOfBirth: Date;
    gender: string;
    address: string;
    teacherRegistryId?: string | null;
    citizenshipNo?: string | null;
    panNumber?: string | null;
    bankAccount?: string | null;
    bankName?: string | null;
    department?: string | null;
    designation?: string | null;
    employmentType?: string | null;
    status?: StaffStatus | string;
    contractStatus?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    emergencyContactRelation?: string | null;
    qualifications?: string | null;
    experience?: string | null;
    joiningDate: Date;
    contractType: string;
    probationEndDate?: Date | null;
    user?: {
      email?: string | null;
      userRoles?: Array<{ role: { name: string } }>;
    };
    staffContracts?: unknown[];
    salaryStructures?: unknown[];
    attendanceRecords?: unknown[];
    leaveBalances?: unknown[];
    leaveRequests?: unknown[];
    payrollLines?: unknown[];
    qualificationsRecords?: unknown[];
    experienceRecords?: unknown[];
    teacherAssignments?: unknown[];
  },
  actor?: AuthContext,
) {
  const canSeeSensitive =
    actor?.permissions?.includes('hr.admin') ||
    actor?.permissions?.includes('payroll.admin') ||
    (staff.userId && actor?.userId === staff.userId);

  const mask = (val: string | null | undefined) => {
    if (!val) return val;
    if (canSeeSensitive) return val;
    if (val.length <= 4) return '****';
    return val.substring(0, 2) + '****' + val.substring(val.length - 2);
  };

  return {
    ...staff,
    citizenshipNo: mask(staff.citizenshipNo),
    panNumber: mask(staff.panNumber),
    bankAccount: mask(staff.bankAccount),
    email: staff.user?.email ?? null,
    roles: staff.user?.userRoles?.map(({ role }) => role.name) ?? [],
    personal: {
      dateOfBirth: staff.dateOfBirth,
      gender: staff.gender,
      address: staff.address,
      emergencyContact: {
        name: staff.emergencyContactName,
        phone: staff.emergencyContactPhone,
        relation: staff.emergencyContactRelation,
      },
    },
    employment: {
      department: staff.department,
      designation: staff.designation,
      employmentType: staff.employmentType ?? staff.contractType,
      joiningDate: staff.joiningDate,
      contractStatus: staff.contractStatus,
      teacherRegistryId: staff.teacherRegistryId,
    },
  };
}

function isInactiveStaffStatus(
  status: StaffStatus,
): status is 'SUSPENDED' | 'TERMINATED' | 'RESIGNED' {
  return (
    status === StaffStatus.SUSPENDED ||
    status === StaffStatus.TERMINATED ||
    status === StaffStatus.RESIGNED
  );
}
