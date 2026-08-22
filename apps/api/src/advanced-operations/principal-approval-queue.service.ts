import { Injectable } from '@nestjs/common';
import {
  ApprovalRequestStatus,
  ApprovalStepStatus,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const SCAN_MULTIPLIER = 4;

@Injectable()
export class PrincipalApprovalQueueService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: AuthContext,
    input: { cursor?: string; limit?: number },
  ) {
    const limit = Math.max(
      1,
      Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
    );
    const scanTake = Math.min(limit * SCAN_MULTIPLIER, 200);
    const rows = await this.prisma.approvalRequest.findMany({
      where: {
        tenantId: actor.tenantId,
        status: ApprovalRequestStatus.PENDING,
        OR: [{ delegatedToId: null }, { delegatedToId: actor.userId }],
      },
      ...(input.cursor
        ? { cursor: { id: input.cursor }, skip: 1 }
        : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: scanTake,
      select: {
        id: true,
        workflowType: true,
        status: true,
        title: true,
        reason: true,
        targetModule: true,
        targetType: true,
        targetId: true,
        safeContext: true,
        finalActionStatus: true,
        deadlineAt: true,
        delegatedToId: true,
        createdAt: true,
        updatedAt: true,
        steps: {
          orderBy: { sequence: 'asc' },
          select: {
            id: true,
            sequence: true,
            name: true,
            status: true,
            approverRole: true,
            approverPermission: true,
            decidedAt: true,
          },
        },
      },
    });

    const items: typeof rows = [];
    let lastScannedIndex = -1;
    for (let index = 0; index < rows.length; index += 1) {
      const request = rows[index];
      lastScannedIndex = index;
      if (!this.canReview(request, actor)) continue;
      items.push(request);
      if (items.length === limit) break;
    }

    const scannedAllReturnedRows = lastScannedIndex === rows.length - 1;
    const mightHaveMoreRawRows = rows.length === scanTake;
    const unscannedReturnedRows = lastScannedIndex < rows.length - 1;
    const hasMore =
      lastScannedIndex >= 0 &&
      (unscannedReturnedRows || mightHaveMoreRawRows);

    return {
      items,
      nextCursor: hasMore ? rows[lastScannedIndex].id : null,
      limit,
      generatedAt: new Date().toISOString(),
      scannedAllReturnedRows,
    };
  }

  private canReview(
    request: {
      delegatedToId: string | null;
      steps: Array<{
        status: ApprovalStepStatus;
        approverRole: string | null;
        approverPermission: string | null;
      }>;
    },
    actor: AuthContext,
  ) {
    if (request.delegatedToId) {
      return request.delegatedToId === actor.userId;
    }

    const step = request.steps.find(
      (candidate) => candidate.status === ApprovalStepStatus.PENDING,
    );
    if (!step) return false;

    if (!step.approverRole && !step.approverPermission) {
      return actor.roles.includes('principal') || actor.roles.includes('admin');
    }

    return Boolean(
      (step.approverRole && actor.roles.includes(step.approverRole)) ||
        (step.approverPermission &&
          actor.permissions.includes(step.approverPermission)),
    );
  }
}
