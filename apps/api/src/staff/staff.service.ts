import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceStatus,
  Prisma,
  StaffStatus,
  StaffLifecycleEventType,
  AddressOwnerType,
  AddressType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AddressService } from '../addresses/address.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { StaffLifecycleDto } from './dto/staff-lifecycle.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffLifecycleService } from './staff-lifecycle.service';
import { UsageService } from '../usage/usage.service';
import type {
  ContractExpiryReminderQueryDto,
  CreateStaffLeaveRequestDto,
  RecordStaffAttendanceDto,
  ReviewStaffLeaveRequestDto,
} from './dto/staff-actions.dto';
import {
  optionalNepalPhone,
  parseDateOfBirth,
  requirePersonName,
  requireProfileEmail,
} from '../common/validation/contact-profile';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly lifecycleService: StaffLifecycleService,
    private readonly usageService: UsageService,
    private readonly addressService: AddressService,
  ) {}

  async createStaff(dto: CreateStaffDto, actor: AuthContext) {
    const firstName = requirePersonName(dto.firstName, 'firstName');
    const lastName = requirePersonName(dto.lastName, 'lastName');
    const email = requireProfileEmail(dto.email);
    const phone = optionalNepalPhone(dto.phone);
    const dateOfBirth = parseDateOfBirth(dto.dateOfBirth);
    const employeeId = dto.employeeId ?? (await this.generateEmployeeId(actor));

    const existingStaff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, employeeId },
    });

    if (existingStaff) {
      throw new ConflictException('Employee ID already exists');
    }

    await this.usageService.checkLimit(actor.tenantId, 'staff.count', 1);

    const managedUser = await this.usersService.createManagedUser({
      tenantId: actor.tenantId,
      email,
      password: dto.password,
      phone: phone ?? undefined,
      roleIds: dto.roleIds,
      assignedById: actor.userId,
    });

    const staff = await this.prisma.staff.create({
      data: {
        tenantId: actor.tenantId,
        userId: managedUser.id,
        employeeId,
        firstName,
        lastName,
        photoUrl: dto.photoUrl ?? null,
        dateOfBirth,
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

    if (dto.addresses?.length) {
      for (const addressInput of dto.addresses) {
        await this.addressService.upsertAddress(this.prisma, {
          tenantId: actor.tenantId,
          ownerType: AddressOwnerType.STAFF,
          ownerId: staff.id,
          input: addressInput,
          legacyText:
            (addressInput.addressType ?? AddressType.OTHER) ===
            AddressType.PERMANENT
              ? dto.address
              : undefined,
        });
      }
    }

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

    return mapStaffDetail(staff, actor);
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
      if (dto.email && requireProfileEmail(dto.email) !== existing.user.email) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { email: requireProfileEmail(dto.email) },
        });
      }

      if (dto.addresses?.length) {
        for (const addressInput of dto.addresses) {
          await this.addressService.upsertAddress(tx, {
            tenantId: actor.tenantId,
            ownerType: AddressOwnerType.STAFF,
            ownerId: existing.id,
            input: addressInput,
            legacyText:
              (addressInput.addressType ?? AddressType.OTHER) ===
              AddressType.PERMANENT
                ? (dto.address ?? existing.address)
                : undefined,
          });
        }
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
      // Bounded generously rather than paginated: callers (staff directory,
      // faculty-assignment dropdowns) expect the full roster in one shot.
      // 1000 comfortably covers any real school while still guarding against
      // unbounded growth per the pagination-hardening gate.
      take: 1000,
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

  async listStaffDirectory(query: ListStaffQueryDto = {}, actor: AuthContext) {
    const page = clampPage(query.page, 1, 10_000);
    const limit = clampPage(query.limit, 25, 100);
    const where: Prisma.StaffWhereInput = {
      tenantId: actor.tenantId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.contractType) {
      where.contractType = query.contractType;
    }

    if (query.department) {
      where.department = query.department.trim();
    }

    if (query.designation) {
      where.designation = query.designation.trim();
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { employeeId: { contains: search, mode: 'insensitive' } },
        { staffCode: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.staff.findMany({
        where,
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
        orderBy: [{ joiningDate: 'desc' }, { employeeId: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.staff.count({ where }),
    ]);

    return {
      items: items.map((member) => ({
        id: member.id,
        employeeId: member.employeeId,
        staffCode: member.staffCode,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.user.email,
        roles: member.user.userRoles.map(({ role }) => role.name),
        joiningDate: member.joiningDate,
        contractType: member.contractType,
        status: member.status,
        department: member.department,
        designation: member.designation,
        photoUrl: member.photoUrl,
      })),
      total,
      page,
      limit,
      hasNextPage: page * limit < total,
    };
  }

  async listContractExpiryReminders(
    actor: AuthContext,
    query: ContractExpiryReminderQueryDto = {},
  ) {
    const days = clampReminderWindow(query.days);
    const now = startOfDay(new Date());
    const cutoff = addDays(now, days);

    const [contracts, probationStaff] = await Promise.all([
      this.prisma.staffContract.findMany({
        where: {
          tenantId: actor.tenantId,
          status: 'ACTIVE',
          endDate: {
            gte: now,
            lte: cutoff,
          },
          staff: {
            tenantId: actor.tenantId,
            status: StaffStatus.ACTIVE,
          },
        },
        include: {
          staff: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              department: true,
              designation: true,
            },
          },
        },
        orderBy: [{ endDate: 'asc' }, { contractNumber: 'asc' }],
        take: 100,
      }),
      this.prisma.staff.findMany({
        where: {
          tenantId: actor.tenantId,
          status: StaffStatus.ACTIVE,
          probationEndDate: {
            gte: now,
            lte: cutoff,
          },
        },
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          department: true,
          designation: true,
          probationEndDate: true,
        },
        orderBy: [{ probationEndDate: 'asc' }, { employeeId: 'asc' }],
        take: 100,
      }),
    ]);

    const items = [
      ...contracts.map((contract) => ({
        type: 'CONTRACT_EXPIRY' as const,
        staffId: contract.staffId,
        employeeId: contract.staff.employeeId,
        staffName: `${contract.staff.firstName} ${contract.staff.lastName}`,
        department: contract.staff.department,
        designation: contract.staff.designation,
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        position: contract.position,
        expiresAt: contract.endDate,
        daysRemaining: contract.endDate
          ? daysBetween(now, contract.endDate)
          : null,
      })),
      ...probationStaff.map((staff) => ({
        type: 'PROBATION_END' as const,
        staffId: staff.id,
        employeeId: staff.employeeId,
        staffName: `${staff.firstName} ${staff.lastName}`,
        department: staff.department,
        designation: staff.designation,
        contractId: null,
        contractNumber: null,
        position: staff.designation,
        expiresAt: staff.probationEndDate,
        daysRemaining: staff.probationEndDate
          ? daysBetween(now, staff.probationEndDate)
          : null,
      })),
    ].sort((a, b) => {
      const aTime = a.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    return {
      windowDays: days,
      from: now,
      to: cutoff,
      total: items.length,
      items,
    };
  }

  async getMyStaffTimeline(actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff profile not found');
    }

    return this.getStaffTimeline(staff.id, actor);
  }

  async getStaffTimeline(staffId: string, actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
      select: { id: true, joiningDate: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found in this tenant');
    }

    const [events, contracts, leaveRequests, payrollLines, documents] =
      await Promise.all([
        this.prisma.staffLifecycleEvent.findMany({
          where: { tenantId: actor.tenantId, staffId },
          orderBy: { eventDate: 'desc' },
          take: 100,
        }),
        this.prisma.staffContract.findMany({
          where: { tenantId: actor.tenantId, staffId },
          orderBy: { startDate: 'desc' },
          take: 50,
        }),
        this.prisma.staffLeaveRequest.findMany({
          where: { tenantId: actor.tenantId, staffId },
          orderBy: { startsOn: 'desc' },
          take: 50,
        }),
        this.prisma.payrollLine.findMany({
          where: { tenantId: actor.tenantId, staffId },
          include: { payrollRun: true, payslip: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.staffDocument.findMany({
          where: { tenantId: actor.tenantId, staffId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

    const items = [
      ...events.map((event) => ({
        id: event.id,
        type: `LIFECYCLE_${event.eventType}`,
        occurredAt: event.eventDate,
        title: event.eventType,
        reason: event.reason,
        notes: event.notes,
        metadata: event.metadata,
      })),
      ...contracts.map((contract) => ({
        id: contract.id,
        type: 'CONTRACT',
        occurredAt: contract.startDate,
        title: `Contract ${contract.contractNumber}`,
        reason: contract.status,
        metadata: {
          position: contract.position,
          endDate: contract.endDate,
        },
      })),
      ...leaveRequests.map((leave) => ({
        id: leave.id,
        type: 'LEAVE',
        occurredAt: leave.startsOn,
        title: `${leave.leaveType} leave`,
        reason: leave.status,
        notes: leave.reviewNote ?? leave.reason,
        metadata: {
          startsOn: leave.startsOn,
          endsOn: leave.endsOn,
          days: Number(leave.days),
          isPaid: leave.isPaid,
        },
      })),
      ...payrollLines.map((line) => ({
        id: line.id,
        type: 'PAYROLL',
        occurredAt: line.createdAt,
        title: `Payroll ${line.payrollRun.periodMonth}/${line.payrollRun.periodYear}`,
        reason: line.payrollRun.status,
        metadata: {
          payrollRunId: line.payrollRunId,
          payslipNumber: line.payslip?.payslipNumber ?? null,
          netSalary: canSeeSensitiveStaffData(actor)
            ? Number(line.netSalary)
            : null,
        },
      })),
      ...documents.map((document) => ({
        id: document.id,
        type: 'DOCUMENT',
        occurredAt: document.createdAt,
        title: document.name,
        reason: document.status,
        metadata: {
          kind: document.kind,
          verifiedAt: document.verifiedAt,
        },
      })),
    ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    return { staffId, total: items.length, items };
  }

  async createMyLeaveRequest(
    dto: CreateStaffLeaveRequestDto,
    actor: AuthContext,
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff profile not found');
    }

    return this.createLeaveRequest(staff.id, dto, actor);
  }

  async createLeaveRequest(
    staffId: string,
    dto: CreateStaffLeaveRequestDto,
    actor: AuthContext,
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
      select: { id: true, userId: true, status: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found in this tenant');
    }

    if (staff.userId !== actor.userId && !canManageHr(actor)) {
      throw new ForbiddenException(
        'You cannot create leave requests for another staff member',
      );
    }

    if (
      staff.status === StaffStatus.TERMINATED ||
      staff.status === StaffStatus.RESIGNED
    ) {
      throw new ConflictException('Inactive staff cannot request leave');
    }

    const startsOn = startOfDay(new Date(dto.startsOn));
    const endsOn = startOfDay(new Date(dto.endsOn));
    assertDateRange(
      startsOn,
      endsOn,
      'Leave end date cannot be before start date',
    );
    const days = getInclusiveDays(startsOn, endsOn);
    const leaveType = normalizeLeaveType(dto.leaveType);
    const isPaid = dto.isPaid ?? leaveType !== 'UNPAID';

    if (isPaid) {
      await this.assertLeaveBalanceAvailable(
        staffId,
        leaveType,
        startsOn.getUTCFullYear(),
        days,
        actor,
      );
    }

    const request = await this.prisma.staffLeaveRequest.create({
      data: {
        tenantId: actor.tenantId,
        staffId,
        leaveType,
        isPaid,
        startsOn,
        endsOn,
        days: new Prisma.Decimal(days),
        reason: dto.reason.trim(),
        status: 'PENDING',
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'staff_leave_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      after: { staffId, leaveType, startsOn, endsOn, days, isPaid },
    });

    return request;
  }

  async reviewLeaveRequest(
    leaveRequestId: string,
    dto: ReviewStaffLeaveRequestDto,
    actor: AuthContext,
  ) {
    if (dto.status !== 'APPROVED' && dto.status !== 'REJECTED') {
      throw new BadRequestException('Leave review must approve or reject');
    }

    const request = await this.prisma.staffLeaveRequest.findFirst({
      where: { id: leaveRequestId, tenantId: actor.tenantId },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found in this tenant');
    }

    if (request.status !== 'PENDING') {
      throw new ConflictException(
        `Leave request in ${request.status} status cannot be reviewed`,
      );
    }

    if (dto.status === 'APPROVED') {
      await this.assertLeaveApprovalDoesNotRequirePayrollAdjustment(
        request.startsOn,
        request.endsOn,
        actor,
      );

      if (request.isPaid) {
        await this.assertLeaveBalanceAvailable(
          request.staffId,
          normalizeLeaveType(request.leaveType),
          request.startsOn.getUTCFullYear(),
          Number(request.days),
          actor,
        );
      }
    }

    const reviewed = await this.prisma.$transaction(async (tx) => {
      if (dto.status === 'APPROVED' && request.isPaid) {
        await this.incrementLeaveUsed(
          tx,
          request.staffId,
          normalizeLeaveType(request.leaveType),
          request.startsOn.getUTCFullYear(),
          request.days,
          actor,
        );
      }

      return tx.staffLeaveRequest.update({
        where: { id: request.id },
        data: {
          status: dto.status,
          reviewedById: actor.userId,
          reviewedAt: new Date(),
          reviewNote: dto.reviewNote ?? null,
        },
      });
    });

    await this.auditService.record({
      action: dto.status === 'APPROVED' ? 'approve' : 'reject',
      resource: 'staff_leave_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: reviewed.id,
      before: { status: request.status },
      after: {
        status: reviewed.status,
        reviewNote: dto.reviewNote ?? null,
      },
    });

    if (reviewed.status === 'APPROVED') {
      await this.lifecycleService.recordEvent(
        reviewed.staffId,
        StaffLifecycleEventType.ON_LEAVE,
        actor,
        {
          eventDate: reviewed.startsOn,
          reason: reviewed.reason,
          metadata: {
            leaveRequestId: reviewed.id,
            leaveType: reviewed.leaveType,
            startsOn: reviewed.startsOn,
            endsOn: reviewed.endsOn,
            days: Number(reviewed.days),
            isPaid: reviewed.isPaid,
          },
        },
      );
    }

    return reviewed;
  }

  async recordMyAttendance(dto: RecordStaffAttendanceDto, actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff profile not found');
    }

    return this.recordStaffAttendance(staff.id, dto, actor);
  }

  async recordStaffAttendance(
    staffId: string,
    dto: RecordStaffAttendanceDto,
    actor: AuthContext,
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
      select: { id: true, userId: true },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found in this tenant');
    }

    if (staff.userId !== actor.userId && !canManageHr(actor)) {
      throw new ForbiddenException(
        'You cannot record attendance for another staff member',
      );
    }

    const attendanceDate = startOfDay(
      dto.attendanceDate ? new Date(dto.attendanceDate) : new Date(),
    );
    const checkInAt = dto.checkInAt ? new Date(dto.checkInAt) : undefined;
    const checkOutAt = dto.checkOutAt ? new Date(dto.checkOutAt) : undefined;

    if (checkInAt && checkOutAt && checkOutAt < checkInAt) {
      throw new BadRequestException('Check-out cannot be before check-in');
    }
    const status = (dto.status ?? AttendanceStatus.PRESENT) as AttendanceStatus;

    const attendance = await this.prisma.staffAttendance.upsert({
      where: {
        tenantId_staffId_attendanceDate: {
          tenantId: actor.tenantId,
          staffId,
          attendanceDate,
        },
      },
      update: {
        status,
        checkInAt,
        checkOutAt,
        note: dto.note,
        approvedById: canManageHr(actor) ? actor.userId : undefined,
      },
      create: {
        tenantId: actor.tenantId,
        staffId,
        attendanceDate,
        status,
        checkInAt: checkInAt ?? new Date(),
        checkOutAt,
        note: dto.note,
        approvedById: canManageHr(actor) ? actor.userId : null,
      },
    });

    await this.auditService.record({
      action: 'record_attendance',
      resource: 'staff_attendance',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: attendance.id,
      after: {
        staffId,
        attendanceDate,
        status: attendance.status,
        hasCheckIn: Boolean(attendance.checkInAt),
        hasCheckOut: Boolean(attendance.checkOutAt),
      },
    });

    return attendance;
  }

  private async assertLeaveBalanceAvailable(
    staffId: string,
    leaveType: string,
    year: number,
    days: number,
    actor: AuthContext,
  ) {
    const balances = await this.prisma.staffLeaveBalance.findMany({
      where: {
        tenantId: actor.tenantId,
        staffId,
        year,
        leaveType: { in: leaveTypeAliases(leaveType) },
      },
    });

    const available = balances.reduce((total, balance) => {
      return total
        .add(balance.opening)
        .add(balance.accrued)
        .add(balance.allocated)
        .add(balance.carried)
        .add(balance.adjusted)
        .sub(balance.used);
    }, new Prisma.Decimal(0));

    if (available.lt(days)) {
      throw new ConflictException(
        `Insufficient ${leaveType} leave balance for requested ${days} day(s)`,
      );
    }
  }

  private async assertLeaveApprovalDoesNotRequirePayrollAdjustment(
    startsOn: Date,
    endsOn: Date,
    actor: AuthContext,
  ) {
    const periodPairs = getMonthYearPairs(startsOn, endsOn);
    const existingRuns = await this.prisma.payrollRun.findMany({
      where: {
        tenantId: actor.tenantId,
        status: {
          in: [
            'GENERATED',
            'UNDER_REVIEW',
            'REVIEWED',
            'APPROVED',
            'POSTED',
            'PAID',
          ],
        },
        OR: periodPairs.map(({ month, year }) => ({
          periodMonth: month,
          periodYear: year,
        })),
      },
      select: {
        id: true,
        periodMonth: true,
        periodYear: true,
        status: true,
      },
      take: 1,
    });

    if (existingRuns.length > 0) {
      const run = existingRuns[0];
      throw new ConflictException(
        `Leave overlaps payroll run ${run.periodMonth}/${run.periodYear} in ${run.status} status. Reverse/regenerate payroll or post an approved adjustment instead of silently changing payroll.`,
      );
    }
  }

  private async incrementLeaveUsed(
    tx: Prisma.TransactionClient,
    staffId: string,
    leaveType: string,
    year: number,
    days: Prisma.Decimal,
    actor: AuthContext,
  ) {
    const balance = await tx.staffLeaveBalance.findFirst({
      where: {
        tenantId: actor.tenantId,
        staffId,
        year,
        leaveType: { in: leaveTypeAliases(leaveType) },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!balance) {
      throw new ConflictException(`Missing ${leaveType} leave balance`);
    }

    await tx.staffLeaveBalance.update({
      where: { id: balance.id },
      data: { used: { increment: days } },
    });
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

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
}

function clampReminderWindow(days: number | undefined) {
  if (!days || !Number.isFinite(days)) return 30;
  return Math.min(Math.max(Math.trunc(days), 1), 180);
}

function clampPage(value: number | undefined, fallback: number, max: number) {
  const candidate =
    value === undefined || !Number.isFinite(value)
      ? fallback
      : Math.trunc(value);
  return Math.min(Math.max(candidate, 1), max);
}

function assertDateRange(startsOn: Date, endsOn: Date, message: string) {
  if (Number.isNaN(startsOn.getTime()) || Number.isNaN(endsOn.getTime())) {
    throw new BadRequestException('Invalid date');
  }

  if (endsOn < startsOn) {
    throw new BadRequestException(message);
  }
}

function getInclusiveDays(startsOn: Date, endsOn: Date) {
  const start = Date.UTC(
    startsOn.getUTCFullYear(),
    startsOn.getUTCMonth(),
    startsOn.getUTCDate(),
  );
  const end = Date.UTC(
    endsOn.getUTCFullYear(),
    endsOn.getUTCMonth(),
    endsOn.getUTCDate(),
  );

  return Math.round((end - start) / 86_400_000) + 1;
}

function normalizeLeaveType(leaveType: string) {
  return leaveType.trim().toUpperCase().replace(/\s+/g, '_');
}

function titleCaseLeaveType(leaveType: string) {
  return leaveType
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function leaveTypeAliases(leaveType: string) {
  const normalized = normalizeLeaveType(leaveType);
  return Array.from(new Set([normalized, titleCaseLeaveType(normalized)]));
}

function getMonthYearPairs(startsOn: Date, endsOn: Date) {
  const pairs: Array<{ month: number; year: number }> = [];
  const cursor = new Date(
    Date.UTC(startsOn.getUTCFullYear(), startsOn.getUTCMonth(), 1),
  );
  const last = new Date(
    Date.UTC(endsOn.getUTCFullYear(), endsOn.getUTCMonth(), 1),
  );

  while (cursor <= last) {
    pairs.push({
      month: cursor.getUTCMonth() + 1,
      year: cursor.getUTCFullYear(),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return pairs;
}

function canManageHr(actor?: AuthContext) {
  return Boolean(
    actor?.permissions?.includes('hr:manage') ||
    actor?.permissions?.includes('hr:staff:update'),
  );
}

function canSeeSensitiveStaffData(actor?: AuthContext) {
  return Boolean(
    actor?.permissions?.includes('hr:manage') ||
    actor?.permissions?.includes('payroll:manage') ||
    actor?.permissions?.includes('payroll:salary:read'),
  );
}

function buildStaffUpdateData(dto: UpdateStaffDto): Prisma.StaffUpdateInput {
  return {
    employeeId: dto.employeeId,
    staffCode: dto.staffCode,
    firstName: dto.firstName
      ? requirePersonName(dto.firstName, 'firstName')
      : undefined,
    lastName: dto.lastName
      ? requirePersonName(dto.lastName, 'lastName')
      : undefined,
    dateOfBirth: dto.dateOfBirth
      ? parseDateOfBirth(dto.dateOfBirth)
      : undefined,
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
    emergencyContactName: dto.emergencyContactName
      ? requirePersonName(dto.emergencyContactName, 'emergencyContactName')
      : undefined,
    emergencyContactPhone:
      optionalNepalPhone(dto.emergencyContactPhone) ?? undefined,
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
  const canSeeSensitive = canSeeSensitiveStaffData(actor);

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
    salaryStructures: canSeeSensitive
      ? staff.salaryStructures
      : maskSalaryStructures(staff.salaryStructures),
    payrollLines: canSeeSensitive
      ? staff.payrollLines
      : maskPayrollLines(staff.payrollLines),
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

function maskSalaryStructures(items?: unknown[]) {
  return (items ?? []).map((item) => {
    if (!item || typeof item !== 'object') return item;
    return {
      ...(item as Record<string, unknown>),
      basicSalary: null,
      allowances: null,
      deductions: null,
      bankAccount: null,
      bankName: null,
      components: [],
      masked: true,
    };
  });
}

function maskPayrollLines(items?: unknown[]) {
  return (items ?? []).map((item) => {
    if (!item || typeof item !== 'object') return item;
    return {
      ...(item as Record<string, unknown>),
      basicSalary: null,
      earnings: null,
      grossSalary: null,
      allowances: null,
      deductions: null,
      netSalary: null,
      masked: true,
    };
  });
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
