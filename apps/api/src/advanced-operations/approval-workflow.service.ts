import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalDecisionType,
  ApprovalFinalActionStatus,
  ApprovalRequestStatus,
  ApprovalStepStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import {
  AttachApprovalFileDto,
  CreateApprovalCommentDto,
  CreateApprovalPolicyDto,
  CreateApprovalRequestDto,
  DecideApprovalRequestDto,
} from './dto/approval.dto';
import { approvalWorkflowCatalog } from './advanced-operations.catalog';

export interface ApprovalFinalActionExecutor {
  apply(input: {
    tenantId: string;
    requestId: string;
    workflowType: string;
    targetModule: string;
    targetType: string;
    targetId: string;
    payload: unknown;
    actor: AuthContext;
  }): Promise<unknown>;
}

@Injectable()
export class ApprovalWorkflowService {
  private readonly finalActionExecutors = new Map<
    string,
    ApprovalFinalActionExecutor
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  registerFinalAction(key: string, executor: ApprovalFinalActionExecutor) {
    this.finalActionExecutors.set(key, executor);
  }

  getWorkflowCatalog() {
    return approvalWorkflowCatalog;
  }

  async listPolicies(actor: AuthContext) {
    return this.prisma.approvalPolicy.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ workflowType: 'asc' }, { name: 'asc' }],
      take: 100,
    });
  }

  async createPolicy(dto: CreateApprovalPolicyDto, actor: AuthContext) {
    const policy = await this.prisma.approvalPolicy.create({
      data: {
        tenantId: actor.tenantId,
        workflowType: dto.workflowType,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        minApprovals: dto.minApprovals ?? 1,
        approverRoles: (dto.approverRoles ?? []) as Prisma.InputJsonValue,
        approverPermissions: (dto.approverPermissions ??
          []) as Prisma.InputJsonValue,
        finalActionKey: dto.finalActionKey?.trim() || null,
        createdById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'approval_policy_created',
      resource: 'approval_policy',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: policy.id,
      after: this.policyAudit(policy),
    });

    return policy;
  }

  async listRequests(actor: AuthContext) {
    return this.prisma.approvalRequest.findMany({
      where: { tenantId: actor.tenantId },
      include: { steps: true, decisions: true, comments: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createRequest(dto: CreateApprovalRequestDto, actor: AuthContext) {
    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException('Approval request reason is required');
    }

    if (dto.idempotencyKey) {
      const existing = await this.prisma.approvalRequest.findFirst({
        where: { tenantId: actor.tenantId, idempotencyKey: dto.idempotencyKey },
        include: { steps: true, decisions: true, comments: true },
      });
      if (existing) return existing;
    }

    const policy = dto.policyId
      ? await this.prisma.approvalPolicy.findFirst({
          where: {
            id: dto.policyId,
            tenantId: actor.tenantId,
            workflowType: dto.workflowType,
          },
        })
      : await this.prisma.approvalPolicy.findFirst({
          where: {
            tenantId: actor.tenantId,
            workflowType: dto.workflowType,
            isActive: true,
          },
          orderBy: { createdAt: 'asc' },
        });

    if (dto.policyId && !policy) {
      throw new NotFoundException('Approval policy not found in this tenant');
    }

    const catalogEntry = approvalWorkflowCatalog.find(
      (entry) => entry.workflowType === dto.workflowType,
    );
    const finalActionKey =
      dto.finalActionKey ??
      policy?.finalActionKey ??
      catalogEntry?.defaultFinalActionKey ??
      null;

    const request = await this.prisma.approvalRequest.create({
      data: {
        tenantId: actor.tenantId,
        policyId: policy?.id ?? null,
        workflowType: dto.workflowType,
        title: dto.title.trim(),
        reason,
        targetModule: dto.targetModule.trim(),
        targetType: dto.targetType.trim(),
        targetId: dto.targetId.trim(),
        requestedById: actor.userId,
        beforeContext: dto.beforeContext as Prisma.InputJsonValue | undefined,
        afterContext: dto.afterContext as Prisma.InputJsonValue | undefined,
        safeContext: dto.safeContext as Prisma.InputJsonValue | undefined,
        finalActionKey,
        finalActionPayload: (dto.finalActionPayload ??
          {}) as Prisma.InputJsonValue,
        idempotencyKey: dto.idempotencyKey ?? null,
        steps: {
          create: this.buildSteps(policy).map((step) => ({
            tenantId: actor.tenantId,
            ...step,
          })),
        },
      },
      include: { steps: true, decisions: true, comments: true },
    });

    await this.auditService.record({
      action: 'approval_request_created',
      resource: 'approval_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      before: dto.beforeContext,
      after: {
        ...dto.afterContext,
        workflowType: request.workflowType,
        status: request.status,
        finalActionKey: request.finalActionKey,
      },
    });

    return request;
  }

  async decide(
    requestId: string,
    dto: DecideApprovalRequestDto,
    actor: AuthContext,
  ) {
    const request = await this.prisma.approvalRequest.findFirst({
      where: { id: requestId, tenantId: actor.tenantId },
      include: { steps: { orderBy: { sequence: 'asc' } } },
    });
    if (!request) {
      throw new NotFoundException('Approval request not found in this tenant');
    }
    if (
      request.status !== ApprovalRequestStatus.PENDING &&
      request.status !== ApprovalRequestStatus.APPROVED
    ) {
      throw new ConflictException('Approval request is not reviewable');
    }

    const reason = dto.reason?.trim();
    if (dto.decision === ApprovalDecisionType.REJECT && !reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const step = request.steps.find(
      (item) => item.status === ApprovalStepStatus.PENDING,
    );
    if (!step) {
      throw new ConflictException('No pending approval step remains');
    }
    this.assertStepActor(step, actor);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.approvalDecision.create({
        data: {
          tenantId: actor.tenantId,
          requestId: request.id,
          stepId: step.id,
          decision: dto.decision,
          reason: reason ?? null,
          decidedById: actor.userId,
          context: dto.context as Prisma.InputJsonValue | undefined,
        },
      });

      await tx.approvalStep.update({
        where: { id: step.id },
        data: {
          status:
            dto.decision === ApprovalDecisionType.APPROVE
              ? ApprovalStepStatus.APPROVED
              : ApprovalStepStatus.REJECTED,
          decidedById: actor.userId,
          decidedAt: new Date(),
        },
      });

      const approvedCount = await tx.approvalStep.count({
        where: {
          requestId: request.id,
          status: ApprovalStepStatus.APPROVED,
        },
      });
      const nextStatus =
        dto.decision === ApprovalDecisionType.REJECT
          ? ApprovalRequestStatus.REJECTED
          : approvedCount >= (request.policyId ? 1 : 1) &&
              request.steps.every((item) =>
                item.id === step.id
                  ? true
                  : item.status === ApprovalStepStatus.APPROVED,
              )
            ? ApprovalRequestStatus.APPROVED
            : ApprovalRequestStatus.PENDING;

      return tx.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: nextStatus,
          finalActionStatus:
            nextStatus === ApprovalRequestStatus.APPROVED
              ? ApprovalFinalActionStatus.READY
              : request.finalActionStatus,
        },
        include: { steps: true, decisions: true, comments: true },
      });
    });

    await this.auditService.record({
      action: 'approval_request_decided',
      resource: 'approval_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      before: { status: request.status, stepId: step.id },
      after: {
        status: updated.status,
        decision: dto.decision,
        reason: reason ?? null,
      },
    });

    if (updated.status === ApprovalRequestStatus.APPROVED) {
      return this.applyFinalAction(updated.id, actor);
    }

    return updated;
  }

  async applyFinalAction(requestId: string, actor: AuthContext) {
    const request = await this.prisma.approvalRequest.findFirst({
      where: { id: requestId, tenantId: actor.tenantId },
      include: { steps: true, decisions: true, comments: true },
    });
    if (!request) {
      throw new NotFoundException('Approval request not found in this tenant');
    }
    if (request.finalActionStatus === ApprovalFinalActionStatus.APPLIED) {
      return request;
    }
    if (request.status !== ApprovalRequestStatus.APPROVED) {
      throw new ConflictException('Approval request is not approved');
    }

    const executor = request.finalActionKey
      ? this.finalActionExecutors.get(request.finalActionKey)
      : null;

    try {
      const result = executor
        ? await executor.apply({
            tenantId: actor.tenantId,
            requestId: request.id,
            workflowType: request.workflowType,
            targetModule: request.targetModule,
            targetType: request.targetType,
            targetId: request.targetId,
            payload: request.finalActionPayload,
            actor,
          })
        : {
            deferredToModuleBoundary: true,
            finalActionKey: request.finalActionKey,
          };

      const updated = await this.prisma.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: ApprovalRequestStatus.APPLIED,
          finalActionStatus: ApprovalFinalActionStatus.APPLIED,
          finalActionAppliedAt: new Date(),
          finalActionError: null,
        },
        include: { steps: true, decisions: true, comments: true },
      });

      await this.auditService.record({
        action: 'approval_final_action_applied',
        resource: 'approval_request',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: request.id,
        before: { status: request.status },
        after: { status: updated.status, result },
      });

      return updated;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Approval final action failed';
      await this.prisma.approvalRequest.update({
        where: { id: request.id },
        data: {
          status: ApprovalRequestStatus.APPLY_FAILED,
          finalActionStatus: ApprovalFinalActionStatus.FAILED,
          finalActionError: message,
        },
      });
      throw error;
    }
  }

  async addComment(
    requestId: string,
    dto: CreateApprovalCommentDto,
    actor: AuthContext,
  ) {
    await this.ensureRequest(requestId, actor);
    const comment = await this.prisma.approvalComment.create({
      data: {
        tenantId: actor.tenantId,
        requestId,
        body: dto.body.trim(),
        createdById: actor.userId,
      },
    });
    await this.auditService.record({
      action: 'approval_comment_created',
      resource: 'approval_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: requestId,
      after: { commentId: comment.id },
    });
    return comment;
  }

  async attachFile(
    requestId: string,
    dto: AttachApprovalFileDto,
    actor: AuthContext,
  ) {
    await this.ensureRequest(requestId, actor);
    const file = await this.prisma.fileAsset.findFirst({
      where: { id: dto.fileAssetId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!file) {
      throw new NotFoundException('File asset not found in this tenant');
    }
    const attachment = await this.prisma.approvalAttachment.create({
      data: {
        tenantId: actor.tenantId,
        requestId,
        fileAssetId: dto.fileAssetId,
        label: dto.label?.trim() || null,
        createdById: actor.userId,
      },
    });
    await this.auditService.record({
      action: 'approval_attachment_created',
      resource: 'approval_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: requestId,
      after: { attachmentId: attachment.id, fileAssetId: dto.fileAssetId },
    });
    return attachment;
  }

  private async ensureRequest(requestId: string, actor: AuthContext) {
    const request = await this.prisma.approvalRequest.findFirst({
      where: { id: requestId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!request) {
      throw new NotFoundException('Approval request not found in this tenant');
    }
  }

  private buildSteps(policy: { approverRoles: unknown; approverPermissions: unknown } | null) {
    const roles = Array.isArray(policy?.approverRoles)
      ? (policy?.approverRoles as string[])
      : [];
    const permissions = Array.isArray(policy?.approverPermissions)
      ? (policy?.approverPermissions as string[])
      : [];
    const count = Math.max(roles.length, permissions.length, 1);
    return Array.from({ length: count }, (_, index) => ({
      sequence: index + 1,
      name: `Approval step ${index + 1}`,
      approverRole: roles[index] ?? null,
      approverPermission: permissions[index] ?? null,
    }));
  }

  private assertStepActor(
    step: {
      approverRole: string | null;
      approverPermission: string | null;
    },
    actor: AuthContext,
  ) {
    if (actor.roles.includes('admin') || actor.roles.includes('principal')) {
      return;
    }
    if (step.approverRole && actor.roles.includes(step.approverRole)) {
      return;
    }
    if (
      step.approverPermission &&
      actor.permissions.includes(step.approverPermission)
    ) {
      return;
    }
    throw new ForbiddenException('You cannot decide this approval step');
  }

  private policyAudit(policy: {
    id: string;
    workflowType: string;
    name: string;
    minApprovals: number;
    finalActionKey: string | null;
  }) {
    return {
      id: policy.id,
      workflowType: policy.workflowType,
      name: policy.name,
      minApprovals: policy.minApprovals,
      finalActionKey: policy.finalActionKey,
    };
  }
}
