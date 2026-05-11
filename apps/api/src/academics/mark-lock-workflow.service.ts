import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { RequestMarkLockDto } from './dto/request-mark-lock.dto';
import { ReviewMarkLockDto } from './dto/review-mark-lock.dto';
import { UnlockExamTermDto } from './dto/unlock-exam-term.dto';

interface MarkLockFilters {
  examTermId?: string;
  status?: string;
  requestedById?: string;
  page?: number;
  limit?: number;
}

type LockScope = {
  examTermId: string;
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  assessmentComponentId?: string;
};

@Injectable()
export class MarkLockWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthContext, filters: MarkLockFilters = {}) {
    if (filters.examTermId) {
      await this.ensureExamTerm(actor, filters.examTermId);
    }

    const page = Math.max(1, Number(filters.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit ?? 50)));
    const skip = (page - 1) * limit;

    const where = {
      tenantId: actor.tenantId,
      ...(filters.examTermId ? { examTermId: filters.examTermId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.requestedById ? { requestedById: filters.requestedById } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.markLockRequest.findMany({
        where,
        include: {
          examTerm: {
            include: {
              academicYear: true,
            },
          },
          requestedBy: true,
          reviewedBy: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.markLockRequest.count({ where }),
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

  async request(dto: RequestMarkLockDto, actor: AuthContext) {
    const term = await this.ensureExamTerm(actor, dto.examTermId);
    await this.ensureScope(actor, dto);

    if (term.isLocked) {
      throw new ConflictException('Exam term is already locked');
    }

    const existingPending = await this.prisma.markLockRequest.findFirst({
      where: {
        tenantId: actor.tenantId,
        examTermId: term.id,
        status: 'PENDING',
      },
    });

    if (existingPending) {
      throw new ConflictException(
        'A pending lock/unlock review already exists for this exam term',
      );
    }

    const request = await this.prisma.markLockRequest.create({
      data: {
        tenantId: actor.tenantId,
        examTermId: term.id,
        requestedById: actor.userId,
        reason: dto.reason.trim(),
      },
      include: {
        examTerm: {
          include: { academicYear: true },
        },
        requestedBy: true,
        reviewedBy: true,
      },
    });

    await this.auditService.record({
      action: 'ACADEMICS_MARK_LOCK_REQUESTED',
      resource: 'mark_lock',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      after: {
        examTermId: term.id,
        reason: request.reason,
        status: request.status,
        examWasLocked: term.isLocked,
        scope: this.scopePayload(dto),
      },
    });

    return request;
  }

  async review(requestId: string, dto: ReviewMarkLockDto, actor: AuthContext) {
    const request = await this.prisma.markLockRequest.findFirst({
      where: { id: requestId, tenantId: actor.tenantId },
      include: { examTerm: true },
    });

    if (!request) {
      throw new NotFoundException('Mark lock request not found');
    }

    if (request.status !== 'PENDING') {
      throw new ConflictException(
        'Only pending mark lock requests can be reviewed',
      );
    }

    if (dto.status === 'REJECTED' && !dto.reviewNote?.trim()) {
      throw new ConflictException('Rejection requires a review note');
    }

    if (dto.status === 'APPROVED') {
      await this.ensureRequiredMarksExist(actor, {
        examTermId: request.examTermId,
      });
    }

    const reviewed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.markLockRequest.update({
        where: { id: request.id },
        data: {
          status: dto.status,
          reviewNote: dto.reviewNote?.trim() || null,
          reviewedById: actor.userId,
          reviewedAt: new Date(),
        },
        include: {
          examTerm: {
            include: { academicYear: true },
          },
          requestedBy: true,
          reviewedBy: true,
        },
      });

      if (dto.status === 'APPROVED') {
        await tx.examTerm.update({
          where: { id: request.examTermId },
          data: { isLocked: true },
        });
        await tx.markEntry.updateMany({
          where: {
            tenantId: actor.tenantId,
            examTermId: request.examTermId,
          },
          data: { isLocked: true },
        });
      }

      return updated;
    });

    await this.auditService.record({
      action:
        dto.status === 'APPROVED'
          ? 'ACADEMICS_MARK_LOCK_APPROVED'
          : 'ACADEMICS_MARK_LOCK_REJECTED',
      resource: 'mark_lock',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: reviewed.id,
      before: {
        status: request.status,
        examTermId: request.examTermId,
      },
      after: {
        status: reviewed.status,
        reviewNote: reviewed.reviewNote,
        examTermId: reviewed.examTermId,
        locked: dto.status === 'APPROVED',
      },
    });

    return reviewed;
  }

  async unlockExamTerm(
    examTermId: string,
    dto: UnlockExamTermDto,
    actor: AuthContext,
  ) {
    const term = await this.ensureExamTerm(actor, examTermId);

    if (!term.isLocked) {
      throw new ConflictException('Exam term is already unlocked');
    }

    const generatedReportCards = await this.prisma.reportCard.count({
      where: {
        tenantId: actor.tenantId,
        examTermId: term.id,
      },
    });

    if (generatedReportCards > 0) {
      throw new ConflictException(
        'Cannot directly unlock marks after report cards are generated; use a correction workflow',
      );
    }

    const reason = dto.reason.trim();

    const request = await this.prisma.$transaction(async (tx) => {
      await tx.examTerm.update({
        where: { id: term.id },
        data: { isLocked: false },
      });

      await tx.markEntry.updateMany({
        where: {
          tenantId: actor.tenantId,
          examTermId: term.id,
        },
        data: { isLocked: false },
      });

      return tx.markLockRequest.create({
        data: {
          tenantId: actor.tenantId,
          examTermId: term.id,
          requestedById: actor.userId,
          reviewedById: actor.userId,
          status: 'UNLOCKED',
          reason,
          reviewNote: reason,
          reviewedAt: new Date(),
        },
        include: {
          examTerm: {
            include: { academicYear: true },
          },
          requestedBy: true,
          reviewedBy: true,
        },
      });
    });

    await this.auditService.record({
      action: 'ACADEMICS_MARK_UNLOCK_APPROVED',
      resource: 'exam_term',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: term.id,
      after: {
        reason,
        markLockRequestId: request.id,
      },
    });

    return { examTermId: term.id, unlocked: true, request };
  }

  private async ensureExamTerm(actor: AuthContext, examTermId: string) {
    const term = await this.prisma.examTerm.findFirst({
      where: { id: examTermId, tenantId: actor.tenantId },
      include: { academicYear: true },
    });

    if (!term) {
      throw new NotFoundException('Exam term not found in this tenant');
    }

    return term;
  }

  private async ensureScope(actor: AuthContext, scope: LockScope) {
    if (scope.classId) {
      const classroom = await this.prisma.class.findFirst({
        where: { id: scope.classId, tenantId: actor.tenantId },
      });
      if (!classroom) {
        throw new NotFoundException('Class not found in this tenant');
      }
    }

    if (scope.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: {
          id: scope.sectionId,
          tenantId: actor.tenantId,
          ...(scope.classId ? { classId: scope.classId } : {}),
        },
      });
      if (!section) {
        throw new NotFoundException('Section not found in this class');
      }
    }

    if (scope.subjectId) {
      const subject = await this.prisma.subject.findFirst({
        where: {
          id: scope.subjectId,
          tenantId: actor.tenantId,
          ...(scope.classId ? { classId: scope.classId } : {}),
        },
      });
      if (!subject) {
        throw new NotFoundException('Subject not found in this class');
      }
    }

    if (scope.assessmentComponentId) {
      const component = await this.prisma.assessmentComponent.findFirst({
        where: {
          id: scope.assessmentComponentId,
          tenantId: actor.tenantId,
          examTermId: scope.examTermId,
          ...(scope.subjectId ? { subjectId: scope.subjectId } : {}),
        },
      });
      if (!component) {
        throw new NotFoundException(
          'Assessment component not found in this lock scope',
        );
      }
    }
  }

  private async ensureRequiredMarksExist(
    actor: AuthContext,
    scope: { examTermId: string },
  ) {
    const components = await this.prisma.assessmentComponent.findMany({
      where: {
        tenantId: actor.tenantId,
        examTermId: scope.examTermId,
        isRequired: true,
      },
      select: { id: true, name: true },
      take: 500,
    });

    if (components.length === 0) {
      throw new ConflictException(
        'Cannot lock marks before required assessment components are configured',
      );
    }

    const componentIds = components.map((component) => component.id);
    const marks = await this.prisma.markEntry.findMany({
      where: {
        tenantId: actor.tenantId,
        examTermId: scope.examTermId,
        assessmentComponentId: { in: componentIds },
      },
      select: { assessmentComponentId: true },
      take: 1000,
    });

    const markedComponentIds = new Set(
      marks.map((mark) => mark.assessmentComponentId),
    );
    const missing = components.filter(
      (component) => !markedComponentIds.has(component.id),
    );

    if (missing.length > 0) {
      throw new ConflictException(
        `Cannot lock marks; missing marks for required component(s): ${missing
          .map((component) => component.name)
          .join(', ')}`,
      );
    }
  }

  private scopePayload(scope: Partial<LockScope>) {
    return {
      classId: scope.classId ?? null,
      sectionId: scope.sectionId ?? null,
      subjectId: scope.subjectId ?? null,
      assessmentComponentId: scope.assessmentComponentId ?? null,
    };
  }
}
