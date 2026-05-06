import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
}

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

    return this.prisma.markLockRequest.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.examTermId ? { examTermId: filters.examTermId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.requestedById
          ? { requestedById: filters.requestedById }
          : {}),
      },
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
      take: 200,
    });
  }

  async request(dto: RequestMarkLockDto, actor: AuthContext) {
    const term = await this.ensureExamTerm(actor, dto.examTermId);

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
      action: 'request',
      resource: 'mark_lock',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      after: {
        examTermId: term.id,
        reason: request.reason,
        status: request.status,
        examWasLocked: term.isLocked,
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
      action: 'review',
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

    const reason =
      dto.reason?.trim() || 'Manual unlock requested by authorized user';

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
      action: 'unlock',
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
}
