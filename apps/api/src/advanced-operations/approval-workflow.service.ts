import { unrestrictedRoleAssignmentsWhere } from '../authorization/scopes/unrestricted-role-where';
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
  ApprovalWorkflowType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { withSchoolAuthorizationTransaction } from '../auth/school-authorization-transaction';
import { requireDomainPermission } from '../authorization/policies/domain-permission';
import type { AuthContext } from '../auth/auth.types';
import {
  AttachApprovalFileDto,
  CreateApprovalCommentDto,
  CreateApprovalPolicyDto,
  CreateApprovalRequestDto,
  DelegateApprovalRequestDto,
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
    tx?: Prisma.TransactionClient;
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

  hasFinalActionExecutor(key: string | null | undefined) {
    return Boolean(key && this.finalActionExecutors.has(key));
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
    requireDomainPermission(actor, 'advanced:approvals:manage');
    const fiscal = isFiscalReopen(dto.workflowType);
    const expectedActionKey =
      dto.workflowType === ApprovalWorkflowType.FISCAL_PERIOD_REOPEN
        ? 'accounting.fiscal_period.reopen'
        : 'accounting.fiscal_year.reopen';
    if (fiscal && dto.finalActionKey?.trim() !== expectedActionKey)
      throw new BadRequestException(
        'Fiscal reopen policy requires the matching final action',
      );
    return withSchoolAuthorizationTransaction(
      this.prisma,
      actor,
      'advanced:approvals:manage',
      [],
      async (tx) => {
        const replaced = fiscal
          ? await tx.approvalPolicy.findMany({
              where: {
                tenantId: actor.tenantId,
                workflowType: dto.workflowType,
                isActive: true,
              },
              select: { id: true, name: true, minApprovals: true },
            })
          : [];
        if (replaced.length)
          await tx.approvalPolicy.updateMany({
            where: {
              tenantId: actor.tenantId,
              workflowType: dto.workflowType,
              isActive: true,
            },
            data: { isActive: false },
          });
        const policy = await tx.approvalPolicy.create({
          data: {
            tenantId: actor.tenantId,
            workflowType: dto.workflowType,
            name: dto.name.trim(),
            description: dto.description?.trim() || null,
            minApprovals: dto.minApprovals ?? 1,
            approverRoles: dto.approverRoles ?? [],
            approverPermissions: dto.approverPermissions ?? [],
            finalActionKey: dto.finalActionKey?.trim() || null,
            createdById: actor.userId,
          },
        });
        await this.auditService.record(
          {
            action: 'approval_policy_created',
            resource: 'approval_policy',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: policy.id,
            before: replaced.length ? { replaced } : undefined,
            after: this.policyAudit(policy),
          },
          tx,
        );
        return policy;
      },
      fiscal,
    );
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
    const fiscal = isFiscalReopen(dto.workflowType);
    if (fiscal) {
      requireDomainPermission(actor, 'accounting:fiscal:reopen');
      const targetType =
        dto.workflowType === ApprovalWorkflowType.FISCAL_PERIOD_REOPEN
          ? 'fiscal_period'
          : 'fiscal_year';
      const actionKey = `accounting.${targetType}.reopen`;
      if (
        dto.targetModule !== 'accounting' ||
        dto.targetType !== targetType ||
        dto.finalActionKey !== actionKey ||
        dto.finalActionPayload?.reason !== dto.reason.trim() ||
        dto.reason.trim().length < 10
      )
        throw new BadRequestException(
          'Fiscal reopen requires the canonical target, action and a reason of at least ten characters',
        );
    }
    const reason = dto.reason.trim();
    if (fiscal) return this.createFiscalReopenRequest(dto, actor, reason);
    if (!reason) {
      throw new BadRequestException('Approval request reason is required');
    }

    if (dto.idempotencyKey) {
      const existing = await this.prisma.approvalRequest.findFirst({
        where: { tenantId: actor.tenantId, idempotencyKey: dto.idempotencyKey },
        include: { steps: true, decisions: true, comments: true },
      });
      if (existing) {
        if (
          fiscal &&
          (existing.workflowType !== dto.workflowType ||
            existing.targetId !== dto.targetId ||
            existing.reason !== reason ||
            existing.finalActionKey !== dto.finalActionKey)
        )
          throw new ConflictException(
            'Idempotency key belongs to another fiscal reopen request',
          );
        return existing;
      }
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
    const defaultApproverPermission =
      catalogEntry && 'defaultApproverPermission' in catalogEntry
        ? catalogEntry.defaultApproverPermission
        : undefined;
    const finalActionKey =
      dto.finalActionKey ??
      policy?.finalActionKey ??
      catalogEntry?.defaultFinalActionKey ??
      null;
    const deadlineAt = dto.deadlineAt
      ? this.parseFutureDeadline(dto.deadlineAt)
      : null;

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
        deadlineAt,
        steps: {
          create: this.buildSteps(policy, defaultApproverPermission).map(
            (step) => ({
              tenantId: actor.tenantId,
              ...step,
            }),
          ),
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

  private async createFiscalReopenRequest(
    dto: CreateApprovalRequestDto,
    actor: AuthContext,
    reason: string,
  ) {
    return withSchoolAuthorizationTransaction(
      this.prisma,
      actor,
      'accounting:fiscal:reopen',
      [],
      async (tx) => {
        if (dto.idempotencyKey) {
          const existing = await tx.approvalRequest.findFirst({
            where: {
              tenantId: actor.tenantId,
              idempotencyKey: dto.idempotencyKey,
            },
            include: { steps: true, decisions: true, comments: true },
          });
          if (existing) {
            if (
              existing.workflowType !== dto.workflowType ||
              existing.targetId !== dto.targetId ||
              existing.reason !== reason ||
              existing.requestedById !== actor.userId ||
              existing.finalActionKey !== dto.finalActionKey
            )
              throw new ConflictException(
                'Idempotency key belongs to another fiscal reopen request',
              );
            return existing;
          }
        }
        if (dto.workflowType === ApprovalWorkflowType.FISCAL_PERIOD_REOPEN) {
          const period = await tx.fiscalPeriod.findFirst({
            where: { id: dto.targetId, tenantId: actor.tenantId },
            include: { fiscalYear: true },
          });
          if (!period) throw new NotFoundException('Fiscal period not found');
          if (period.status !== 'CLOSED' || period.fiscalYear.status !== 'OPEN')
            throw new ConflictException(
              'Fiscal period is no longer eligible for reopening',
            );
        } else {
          const year = await tx.fiscalYear.findFirst({
            where: { id: dto.targetId, tenantId: actor.tenantId },
            include: { periods: true },
          });
          if (!year) throw new NotFoundException('Fiscal year not found');
          if (
            year.status !== 'CLOSED' ||
            year.periods.some((period) => period.status !== 'CLOSED')
          )
            throw new ConflictException(
              'Fiscal year is no longer eligible for reopening',
            );
        }
        const policy = await tx.approvalPolicy.findFirst({
          where: {
            tenantId: actor.tenantId,
            workflowType: dto.workflowType,
            isActive: true,
          },
          orderBy: { createdAt: 'asc' },
        });
        if (
          policy?.finalActionKey &&
          policy.finalActionKey !== dto.finalActionKey
        )
          throw new ConflictException(
            'Active fiscal approval policy has an incompatible final action',
          );
        if (dto.policyId && dto.policyId !== policy?.id)
          throw new ConflictException(
            'Fiscal reopen requires the active approval policy',
          );
        const steps = this.buildSteps(policy, 'advanced:approvals:decide');
        if (
          !steps.every((step) => step.approverRole || step.approverPermission)
        )
          throw new ConflictException(
            'Fiscal reopen policy must require an explicit approver capability',
          );
        const request = await tx.approvalRequest.create({
          data: {
            tenantId: actor.tenantId,
            policyId: policy?.id ?? null,
            workflowType: dto.workflowType,
            title: dto.title.trim(),
            reason,
            targetModule: dto.targetModule,
            targetType: dto.targetType,
            targetId: dto.targetId,
            requestedById: actor.userId,
            beforeContext: dto.beforeContext as
              | Prisma.InputJsonValue
              | undefined,
            afterContext: dto.afterContext as Prisma.InputJsonValue | undefined,
            safeContext: dto.safeContext as Prisma.InputJsonValue | undefined,
            finalActionKey: dto.finalActionKey,
            finalActionPayload: { reason },
            idempotencyKey: dto.idempotencyKey ?? null,
            deadlineAt: dto.deadlineAt
              ? this.parseFutureDeadline(dto.deadlineAt)
              : null,
            steps: {
              create: steps.map((step) => ({
                tenantId: actor.tenantId,
                ...step,
              })),
            },
          },
          include: { steps: true, decisions: true, comments: true },
        });
        await this.auditService.record(
          {
            action: 'approval_request_created',
            resource: 'approval_request',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: request.id,
            before: dto.beforeContext,
            after: {
              workflowType: request.workflowType,
              status: request.status,
              finalActionKey: request.finalActionKey,
              targetType: request.targetType,
              targetId: request.targetId,
              reason,
            },
          },
          tx,
        );
        return request;
      },
      false,
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
    if (isFiscalReopen(request.workflowType))
      return this.decideFiscalReopen(requestId, dto, actor);
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
    if (
      dto.decision === ApprovalDecisionType.APPROVE &&
      !this.hasFinalActionExecutor(request.finalActionKey)
    ) {
      throw new ConflictException(
        'Approval is unavailable until the module final action is registered',
      );
    }

    const step = request.steps.find(
      (item) => item.status === ApprovalStepStatus.PENDING,
    );
    if (!step) {
      throw new ConflictException('No pending approval step remains');
    }
    this.assertStepActor(step, actor, request.delegatedToId);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.approvalDecision.create({
        data: {
          tenantId: actor.tenantId,
          requestId: request.id,
          stepId: step.id,
          decision: dto.decision,
          reason: reason ?? null,
          idempotencyKey: dto.idempotencyKey ?? null,
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
    if (isFiscalReopen(request.workflowType))
      return this.applyFiscalFinalAction(requestId, actor);
    if (request.finalActionStatus === ApprovalFinalActionStatus.APPLIED) {
      return request;
    }
    if (request.status !== ApprovalRequestStatus.APPROVED) {
      throw new ConflictException('Approval request is not approved');
    }

    const executor = request.finalActionKey
      ? this.finalActionExecutors.get(request.finalActionKey)
      : null;
    if (!executor) {
      throw new ConflictException(
        'Approval is unavailable until the module final action is registered',
      );
    }

    try {
      const result = await executor.apply({
        tenantId: actor.tenantId,
        requestId: request.id,
        workflowType: request.workflowType,
        targetModule: request.targetModule,
        targetType: request.targetType,
        targetId: request.targetId,
        payload: request.finalActionPayload,
        actor,
      });

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

  private async decideFiscalReopen(
    requestId: string,
    dto: DecideApprovalRequestDto,
    actor: AuthContext,
  ) {
    requireDomainPermission(actor, 'advanced:approvals:decide');
    const updated = await withSchoolAuthorizationTransaction(
      this.prisma,
      actor,
      'advanced:approvals:decide',
      [],
      async (tx) => {
        const request = await tx.approvalRequest.findFirst({
          where: { id: requestId, tenantId: actor.tenantId },
          include: {
            steps: { orderBy: { sequence: 'asc' } },
            decisions: true,
            comments: true,
          },
        });
        if (!request || !isFiscalReopen(request.workflowType))
          throw new NotFoundException('Fiscal reopen request not found');
        if (request.status !== ApprovalRequestStatus.PENDING)
          throw new ConflictException('Fiscal reopen request is not pending');
        if (request.requestedById === actor.userId)
          throw new ForbiddenException(
            'The requester cannot approve the fiscal reopen',
          );
        if (request.deadlineAt && request.deadlineAt <= new Date())
          throw new ConflictException(
            'Fiscal reopen approval deadline has passed',
          );
        if (dto.decision === ApprovalDecisionType.REJECT && !dto.reason?.trim())
          throw new BadRequestException('Rejection reason is required');
        if (
          dto.decision === ApprovalDecisionType.APPROVE &&
          !this.hasFinalActionExecutor(request.finalActionKey)
        )
          throw new ConflictException(
            'Fiscal reopen final action is unavailable',
          );
        if (
          request.steps.some(
            (step) =>
              step.status === ApprovalStepStatus.APPROVED &&
              step.decidedById === actor.userId,
          )
        )
          throw new ForbiddenException(
            'One person cannot count as multiple fiscal reopen approvers',
          );
        const step = request.steps.find(
          (item) => item.status === ApprovalStepStatus.PENDING,
        );
        if (!step)
          throw new ConflictException(
            'No pending fiscal reopen approval step remains',
          );
        const assignments = await tx.userRole.findMany({
          where: {
            userId: actor.userId,
            ...unrestrictedRoleAssignmentsWhere(actor.tenantId),
          },
          select: {
            role: {
              select: {
                name: true,
                rolePermissions: {
                  select: {
                    permission: { select: { resource: true, action: true } },
                  },
                },
              },
            },
          },
        });
        const currentRoles = assignments.map(({ role }) => role.name);
        const currentPermissions = assignments.flatMap(({ role }) =>
          role.rolePermissions.map(
            ({ permission }) => `${permission.resource}:${permission.action}`,
          ),
        );
        if (
          (request.delegatedToId && request.delegatedToId !== actor.userId) ||
          (!step.approverRole && !step.approverPermission) ||
          (step.approverRole && !currentRoles.includes(step.approverRole)) ||
          (step.approverPermission &&
            !currentPermissions.includes(step.approverPermission))
        )
          throw new ForbiddenException(
            'Current fiscal approval role and capability are required for this step',
          );
        const claim = await tx.approvalStep.updateMany({
          where: {
            id: step.id,
            tenantId: actor.tenantId,
            requestId,
            status: ApprovalStepStatus.PENDING,
          },
          data: {
            status:
              dto.decision === ApprovalDecisionType.APPROVE
                ? ApprovalStepStatus.APPROVED
                : ApprovalStepStatus.REJECTED,
            decidedById: actor.userId,
            decidedAt: new Date(),
          },
        });
        if (claim.count !== 1)
          throw new ConflictException(
            'Fiscal approval step changed concurrently',
          );
        await tx.approvalDecision.create({
          data: {
            tenantId: actor.tenantId,
            requestId,
            stepId: step.id,
            decision: dto.decision,
            reason: dto.reason?.trim() ?? null,
            idempotencyKey: dto.idempotencyKey ?? null,
            decidedById: actor.userId,
            context: dto.context as Prisma.InputJsonValue | undefined,
          },
        });
        const allApproved =
          dto.decision === ApprovalDecisionType.APPROVE &&
          request.steps.every(
            (item) =>
              item.id === step.id ||
              item.status === ApprovalStepStatus.APPROVED,
          );
        const nextStatus =
          dto.decision === ApprovalDecisionType.REJECT
            ? ApprovalRequestStatus.REJECTED
            : allApproved
              ? ApprovalRequestStatus.APPROVED
              : ApprovalRequestStatus.PENDING;
        const requestClaim = await tx.approvalRequest.updateMany({
          where: {
            id: requestId,
            tenantId: actor.tenantId,
            status: ApprovalRequestStatus.PENDING,
          },
          data: {
            status: nextStatus,
            finalActionStatus: allApproved
              ? ApprovalFinalActionStatus.READY
              : request.finalActionStatus,
          },
        });
        if (requestClaim.count !== 1)
          throw new ConflictException(
            'Fiscal reopen request changed concurrently',
          );
        await this.auditService.record(
          {
            tenantId: actor.tenantId,
            userId: actor.userId,
            action: 'approval_request_decided',
            resource: 'approval_request',
            resourceId: request.id,
            before: { status: request.status, stepId: step.id },
            after: {
              status: nextStatus,
              decision: dto.decision,
              reason: dto.reason?.trim() ?? null,
            },
          },
          tx,
        );
        return tx.approvalRequest.findFirstOrThrow({
          where: { id: requestId, tenantId: actor.tenantId },
          include: { steps: true, decisions: true, comments: true },
        });
      },
      false,
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return updated.status === ApprovalRequestStatus.APPROVED
      ? this.applyFiscalFinalAction(requestId, actor)
      : updated;
  }

  private async applyFiscalFinalAction(requestId: string, actor: AuthContext) {
    requireDomainPermission(actor, 'advanced:approvals:decide');
    return withSchoolAuthorizationTransaction(
      this.prisma,
      actor,
      'advanced:approvals:decide',
      [],
      async (tx) => {
        const request = await tx.approvalRequest.findFirst({
          where: { id: requestId, tenantId: actor.tenantId },
          include: { steps: true, decisions: true, comments: true },
        });
        if (!request || !isFiscalReopen(request.workflowType))
          throw new NotFoundException('Fiscal reopen request not found');
        if (request.requestedById === actor.userId)
          throw new ForbiddenException(
            'The requester cannot execute the fiscal reopen',
          );
        if (request.finalActionStatus === ApprovalFinalActionStatus.APPLIED)
          return request;
        if (
          request.status !== ApprovalRequestStatus.APPROVED ||
          request.finalActionStatus !== ApprovalFinalActionStatus.READY
        )
          throw new ConflictException(
            'Fiscal reopen request is not approved for execution',
          );
        if (request.deadlineAt && request.deadlineAt <= new Date())
          throw new ConflictException(
            'Fiscal reopen approval deadline has passed',
          );
        const approved = request.steps.filter(
          (step) =>
            step.status === ApprovalStepStatus.APPROVED && step.decidedById,
        );
        if (
          !approved.length ||
          approved.length !== request.steps.length ||
          new Set(approved.map((step) => step.decidedById)).size !==
            approved.length ||
          approved.some((step) => step.decidedById === request.requestedById) ||
          !approved.some((step) => step.decidedById === actor.userId) ||
          approved.some(
            (step) =>
              !request.decisions.some(
                (decision) =>
                  decision.stepId === step.id &&
                  decision.decision === ApprovalDecisionType.APPROVE &&
                  decision.decidedById === step.decidedById,
              ),
          )
        )
          throw new ConflictException(
            'Independent fiscal reopen approval evidence is incomplete',
          );
        const actorApprovalStep = approved.find(
          (step) => step.decidedById === actor.userId,
        );
        const assignments = await tx.userRole.findMany({
          where: {
            userId: actor.userId,
            ...unrestrictedRoleAssignmentsWhere(actor.tenantId),
          },
          select: {
            role: {
              select: {
                name: true,
                rolePermissions: {
                  select: {
                    permission: { select: { resource: true, action: true } },
                  },
                },
              },
            },
          },
        });
        const currentRoles = assignments.map(({ role }) => role.name);
        const currentPermissions = assignments.flatMap(({ role }) =>
          role.rolePermissions.map(
            ({ permission }) => `${permission.resource}:${permission.action}`,
          ),
        );
        if (
          !actorApprovalStep ||
          (actorApprovalStep.approverRole &&
            !currentRoles.includes(actorApprovalStep.approverRole)) ||
          (actorApprovalStep.approverPermission &&
            !currentPermissions.includes(actorApprovalStep.approverPermission))
        )
          throw new ForbiddenException(
            'Current fiscal approval role and capability are required to execute',
          );
        const targetType =
          request.workflowType === ApprovalWorkflowType.FISCAL_PERIOD_REOPEN
            ? 'fiscal_period'
            : 'fiscal_year';
        const actionKey = `accounting.${targetType}.reopen`;
        const payload = request.finalActionPayload as {
          reason?: string;
        } | null;
        if (
          request.targetModule !== 'accounting' ||
          request.targetType !== targetType ||
          request.finalActionKey !== actionKey ||
          !request.targetId ||
          !payload ||
          payload.reason !== request.reason ||
          request.reason.trim().length < 10
        )
          throw new ConflictException(
            'Fiscal reopen request target or reason evidence is invalid',
          );
        const executor = this.finalActionExecutors.get(actionKey);
        if (!executor)
          throw new ConflictException('Fiscal reopen executor is unavailable');
        const result = await executor.apply({
          tenantId: actor.tenantId,
          requestId,
          workflowType: request.workflowType,
          targetModule: request.targetModule,
          targetType: request.targetType,
          targetId: request.targetId,
          payload: request.finalActionPayload,
          actor,
          tx,
        });
        const claim = await tx.approvalRequest.updateMany({
          where: {
            id: request.id,
            tenantId: actor.tenantId,
            status: ApprovalRequestStatus.APPROVED,
            finalActionStatus: ApprovalFinalActionStatus.READY,
          },
          data: {
            status: ApprovalRequestStatus.APPLIED,
            finalActionStatus: ApprovalFinalActionStatus.APPLIED,
            finalActionAppliedAt: new Date(),
            finalActionError: null,
          },
        });
        if (claim.count !== 1)
          throw new ConflictException(
            'Fiscal reopen approval changed during execution',
          );
        await this.auditService.record(
          {
            tenantId: actor.tenantId,
            userId: actor.userId,
            action: 'approval_final_action_applied',
            resource: 'approval_request',
            resourceId: request.id,
            before: { status: request.status },
            after: { status: 'APPLIED', result },
          },
          tx,
        );
        return tx.approvalRequest.findFirstOrThrow({
          where: { id: requestId, tenantId: actor.tenantId },
          include: { steps: true, decisions: true, comments: true },
        });
      },
      false,
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async delegate(
    requestId: string,
    dto: DelegateApprovalRequestDto,
    actor: AuthContext,
  ) {
    const reason = dto.reason.trim();
    const request = await this.prisma.approvalRequest.findFirst({
      where: { id: requestId, tenantId: actor.tenantId },
      include: { steps: { orderBy: { sequence: 'asc' } } },
    });
    if (!request) {
      throw new NotFoundException('Approval request not found in this tenant');
    }
    if (request.status !== ApprovalRequestStatus.PENDING) {
      throw new ConflictException('Only pending approvals can be delegated');
    }
    if (dto.delegatedToUserId === actor.userId) {
      throw new BadRequestException('Choose another eligible approver');
    }
    if (
      request.delegatedToId === dto.delegatedToUserId &&
      request.delegationReason === reason
    ) {
      return request;
    }

    const pendingStep = request.steps.find(
      (step) => step.status === ApprovalStepStatus.PENDING,
    );
    if (!pendingStep) {
      throw new ConflictException('No pending approval step remains');
    }
    if (!actor.permissions.includes('advanced:approvals:manage')) {
      this.assertStepActor(pendingStep, actor, request.delegatedToId);
    }

    const delegate = await this.prisma.user.findFirst({
      where: {
        id: dto.delegatedToUserId,
        tenantId: actor.tenantId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        userRoles: {
          where: unrestrictedRoleAssignmentsWhere(actor.tenantId),
          select: {
            role: {
              select: {
                name: true,
                rolePermissions: {
                  select: {
                    permission: { select: { resource: true, action: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!delegate) {
      throw new NotFoundException('Eligible delegate not found in this tenant');
    }

    const delegateRoles = delegate.userRoles.map((item) => item.role.name);
    const delegatePermissions = delegate.userRoles.flatMap((item) =>
      item.role.rolePermissions.map(
        ({ permission }) => `${permission.resource}:${permission.action}`,
      ),
    );
    if (
      !this.canUserDecideStep(pendingStep, delegateRoles, delegatePermissions)
    ) {
      throw new ForbiddenException(
        'Selected user cannot decide the current approval step',
      );
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id: request.id },
      data: {
        delegatedToId: delegate.id,
        delegatedById: actor.userId,
        delegatedAt: new Date(),
        delegationReason: reason,
      },
      include: { steps: true, decisions: true, comments: true },
    });

    await this.auditService.record({
      action: 'approval_request_delegated',
      resource: 'approval_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      before: { delegatedToId: request.delegatedToId },
      after: {
        delegatedToId: delegate.id,
        reason,
        stepId: pendingStep.id,
      },
    });

    return updated;
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

  private buildSteps(
    policy: {
      approverRoles: unknown;
      approverPermissions: unknown;
      minApprovals: number;
    } | null,
    defaultApproverPermission?: string,
  ) {
    const roles = Array.isArray(policy?.approverRoles)
      ? (policy?.approverRoles as string[])
      : [];
    const permissions = Array.isArray(policy?.approverPermissions)
      ? (policy?.approverPermissions as string[])
      : [];
    if (permissions.length === 0 && defaultApproverPermission) {
      permissions.push(defaultApproverPermission);
    }
    const count = Math.max(
      roles.length,
      permissions.length,
      policy?.minApprovals ?? 1,
      1,
    );
    return Array.from({ length: count }, (_, index) => ({
      sequence: index + 1,
      name: `Approval step ${index + 1}`,
      approverRole: roles[index] ?? null,
      approverPermission:
        permissions[index] ?? permissions[permissions.length - 1] ?? null,
    }));
  }

  private assertStepActor(
    step: {
      approverRole: string | null;
      approverPermission: string | null;
    },
    actor: AuthContext,
    delegatedToId?: string | null,
  ) {
    if (delegatedToId) {
      if (actor.userId === delegatedToId) return;
      throw new ForbiddenException(
        'This approval step is delegated to another user',
      );
    }
    if (step.approverRole || step.approverPermission) {
      if (this.canUserDecideStep(step, actor.roles, actor.permissions)) return;
      throw new ForbiddenException('You cannot decide this approval step');
    }
    if (
      actor.roles.includes('admin') ||
      actor.roles.includes('principal') ||
      actor.roles.includes('platform_super_admin')
    ) {
      return;
    }
    if (this.canUserDecideStep(step, actor.roles, actor.permissions)) {
      return;
    }
    throw new ForbiddenException('You cannot decide this approval step');
  }

  private canUserDecideStep(
    step: {
      approverRole: string | null;
      approverPermission: string | null;
    },
    roles: string[],
    permissions: string[],
  ) {
    if (!step.approverRole && !step.approverPermission) {
      return roles.includes('principal') || roles.includes('admin');
    }
    return Boolean(
      (step.approverRole && roles.includes(step.approverRole)) ||
      (step.approverPermission &&
        permissions.includes(step.approverPermission)),
    );
  }

  private parseFutureDeadline(value: string) {
    const deadline = new Date(value);
    if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
      throw new BadRequestException(
        'Approval deadline must be a future date and time',
      );
    }
    return deadline;
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

function isFiscalReopen(workflowType: ApprovalWorkflowType) {
  return (
    workflowType === ApprovalWorkflowType.FISCAL_PERIOD_REOPEN ||
    workflowType === ApprovalWorkflowType.FISCAL_YEAR_REOPEN
  );
}
