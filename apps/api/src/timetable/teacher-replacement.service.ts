import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TeacherAssignmentStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  CancelTeacherReplacementDto,
  CreateReplacementHandoverNoteDto,
  CreateTeacherReplacementDto,
  DisposePendingWorkDto,
  TeacherReplacementQueryDto,
} from './dto/teacher-replacement.dto';

const ReplacementStatus = {
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

@Injectable()
export class TeacherReplacementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthContext, query: TeacherReplacementQueryDto) {
    this.assertCoordinator(actor);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const where: Prisma.TeacherReplacementWhereInput = {
      tenantId: actor.tenantId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.teacherReplacement.findMany({
        where,
        include: replacementInclude(),
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.teacherReplacement.count({ where }),
    ]);
    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async get(id: string, actor: AuthContext) {
    this.assertCoordinator(actor);
    return this.findOrThrow(id, actor.tenantId);
  }

  async schedule(dto: CreateTeacherReplacementDto, actor: AuthContext) {
    this.assertCoordinator(actor);
    const source = await this.prisma.teacherAssignment.findFirst({
      where: {
        id: dto.sourceAssignmentId,
        tenantId: actor.tenantId,
        status: TeacherAssignmentStatus.ACTIVE,
      },
    });
    if (!source) {
      throw new NotFoundException('Source teacher assignment not found');
    }
    if (source.staffId === dto.replacementStaffId) {
      throw new ConflictException(
        'Replacement teacher cannot be the same as the former teacher',
      );
    }

    const replacementStaff = await this.prisma.staff.findFirst({
      where: { id: dto.replacementStaffId, tenantId: actor.tenantId },
    });
    if (!replacementStaff) {
      throw new NotFoundException('Replacement staff member not found');
    }

    const effectiveFrom = stripTime(new Date(dto.effectiveFrom));
    const existingOpen = await this.prisma.teacherReplacement.findFirst({
      where: {
        tenantId: actor.tenantId,
        sourceAssignmentId: source.id,
        status: {
          in: [ReplacementStatus.SCHEDULED, ReplacementStatus.ACTIVE],
        },
      },
    });
    if (existingOpen) {
      throw new ConflictException(
        'An open replacement already exists for this assignment',
      );
    }

    const created = await this.prisma.teacherReplacement.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: source.academicYearId,
        sourceAssignmentId: source.id,
        formerStaffId: source.staffId,
        replacementStaffId: dto.replacementStaffId,
        classId: source.classId,
        sectionId: source.sectionId,
        subjectId: source.subjectId,
        assignmentType: source.assignmentType,
        componentScope: source.componentScope,
        effectiveFrom,
        reason: dto.reason.trim(),
        status: ReplacementStatus.SCHEDULED,
        createdById: actor.userId,
        pendingWork: dto.pendingWork?.length
          ? {
              create: dto.pendingWork.map((item) => ({
                tenantId: actor.tenantId,
                kind: item.kind,
                resourceId: item.resourceId,
                resourceLabel: item.resourceLabel ?? null,
              })),
            }
          : undefined,
      },
      include: replacementInclude(),
    });

    await this.auditService.record({
      action: 'schedule',
      resource: 'teacher_replacement',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: created.id,
      after: created,
    });

    return created;
  }

  async activate(id: string, actor: AuthContext) {
    this.assertCoordinator(actor);
    const replacement = await this.findOrThrow(id, actor.tenantId);
    if (replacement.status !== ReplacementStatus.SCHEDULED) {
      throw new ConflictException(
        'Only SCHEDULED replacements can be activated',
      );
    }

    const activated = await this.prisma.$transaction(async (tx) => {
      const source = await tx.teacherAssignment.findFirst({
        where: {
          id: replacement.sourceAssignmentId,
          tenantId: actor.tenantId,
        },
      });
      if (!source || source.status !== TeacherAssignmentStatus.ACTIVE) {
        throw new ConflictException(
          'Source assignment is no longer active and cannot be replaced',
        );
      }

      const cutover = new Date();
      // End former operational access immediately without deleting history.
      await tx.teacherAssignment.update({
        where: { id: source.id },
        data: {
          status: TeacherAssignmentStatus.REVOKED,
          effectiveUntil: cutover,
          revokedAt: cutover,
          revokedById: actor.userId,
        },
      });

      const newAssignment = await tx.teacherAssignment.create({
        data: {
          tenantId: actor.tenantId,
          academicYearId: replacement.academicYearId,
          staffId: replacement.replacementStaffId,
          assignmentType: replacement.assignmentType,
          classId: replacement.classId,
          sectionId: replacement.sectionId,
          subjectId: replacement.subjectId,
          componentScope: replacement.componentScope,
          isPrimary: source.isPrimary,
          effectiveFrom: cutover,
          status: TeacherAssignmentStatus.ACTIVE,
          createdById: actor.userId,
        },
      });

      return tx.teacherReplacement.update({
        where: { id },
        data: {
          status: ReplacementStatus.ACTIVE,
          activatedAt: cutover,
          activatedById: actor.userId,
          replacementAssignmentId: newAssignment.id,
          effectiveFrom: cutover,
        },
        include: replacementInclude(),
      });
    });

    await this.auditService.record({
      action: 'activate',
      resource: 'teacher_replacement',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: id,
      after: activated,
    });

    return activated;
  }

  async disposePendingWork(
    replacementId: string,
    pendingWorkId: string,
    dto: DisposePendingWorkDto,
    actor: AuthContext,
  ) {
    this.assertCoordinator(actor);
    const replacement = await this.findOrThrow(replacementId, actor.tenantId);
    if (
      replacement.status !== ReplacementStatus.ACTIVE &&
      replacement.status !== ReplacementStatus.SCHEDULED
    ) {
      throw new ConflictException(
        'Pending work can only be disposed on SCHEDULED or ACTIVE replacements',
      );
    }

    const item = await this.prisma.teacherReplacementPendingWork.findFirst({
      where: {
        id: pendingWorkId,
        replacementId,
        tenantId: actor.tenantId,
      },
    });
    if (!item) {
      throw new NotFoundException('Pending work item not found');
    }
    if (item.disposition) {
      throw new ConflictException('Pending work item already disposed');
    }

    const updated = await this.prisma.teacherReplacementPendingWork.update({
      where: { id: pendingWorkId },
      data: {
        disposition: dto.disposition,
        dispositionNote: dto.dispositionNote?.trim() || null,
        disposedAt: new Date(),
        disposedById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'dispose_pending_work',
      resource: 'teacher_replacement_pending_work',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: pendingWorkId,
      after: {
        replacementId,
        disposition: dto.disposition,
        kind: item.kind,
        resourceId: item.resourceId,
      },
    });

    return updated;
  }

  async complete(id: string, actor: AuthContext) {
    this.assertCoordinator(actor);
    const replacement = await this.findOrThrow(id, actor.tenantId);
    if (replacement.status !== ReplacementStatus.ACTIVE) {
      throw new ConflictException('Only ACTIVE replacements can be completed');
    }
    const open = replacement.pendingWork.filter((item) => !item.disposition);
    if (open.length > 0) {
      throw new ConflictException(
        'All pending work items must be disposed before completion',
      );
    }

    const updated = await this.prisma.teacherReplacement.update({
      where: { id },
      data: {
        status: ReplacementStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: replacementInclude(),
    });

    await this.auditService.record({
      action: 'complete',
      resource: 'teacher_replacement',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: id,
      after: updated,
    });

    return updated;
  }

  async cancel(
    id: string,
    dto: CancelTeacherReplacementDto,
    actor: AuthContext,
  ) {
    this.assertCoordinator(actor);
    const replacement = await this.findOrThrow(id, actor.tenantId);
    if (replacement.status !== ReplacementStatus.SCHEDULED) {
      throw new ConflictException(
        'Only SCHEDULED replacements can be cancelled',
      );
    }

    const updated = await this.prisma.teacherReplacement.update({
      where: { id },
      data: {
        status: ReplacementStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: dto.reason.trim(),
      },
      include: replacementInclude(),
    });

    await this.auditService.record({
      action: 'cancel',
      resource: 'teacher_replacement',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: id,
      after: updated,
    });

    return updated;
  }

  async addHandoverNote(
    id: string,
    dto: CreateReplacementHandoverNoteDto,
    actor: AuthContext,
  ) {
    this.assertCoordinator(actor);
    const replacement = await this.findOrThrow(id, actor.tenantId);
    const note = await this.prisma.teacherHandoverNote.create({
      data: {
        tenantId: actor.tenantId,
        kind: 'REPLACEMENT_HANDOVER',
        replacementId: replacement.id,
        body: dto.body.trim(),
        createdById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'handover_note',
      resource: 'teacher_replacement',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: id,
      after: note,
    });

    return note;
  }

  private async findOrThrow(id: string, tenantId: string) {
    const replacement = await this.prisma.teacherReplacement.findFirst({
      where: { id, tenantId },
      include: replacementInclude(),
    });
    if (!replacement) {
      throw new NotFoundException('Teacher replacement not found');
    }
    return replacement;
  }

  private assertCoordinator(actor: AuthContext) {
    if (
      actor.roles.includes('student') ||
      actor.roles.includes('parent') ||
      ((actor.roles.includes('teacher') ||
        actor.roles.includes('subject_teacher')) &&
        !actor.permissions.includes('timetable:substitute'))
    ) {
      throw new ForbiddenException(
        'Teacher replacement operations are limited to authorized coordinators',
      );
    }
  }
}

function stripTime(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function replacementInclude() {
  return {
    formerStaff: {
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
      },
    },
    replacementStaff: {
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
      },
    },
    sourceAssignment: true,
    replacementAssignment: true,
    pendingWork: true,
    handoverNotes: {
      orderBy: { createdAt: 'desc' as const },
    },
    class: { select: { id: true, name: true } },
    section: { select: { id: true, name: true } },
    subject: { select: { id: true, name: true, code: true } },
  } satisfies Prisma.TeacherReplacementInclude;
}
