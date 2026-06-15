import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AutomationConditionOperator,
  AutomationExecutionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import {
  CreateAutomationRuleDto,
  ExecuteAutomationTriggerDto,
} from './dto/automation.dto';
import { initialAutomationRuleCatalog } from './advanced-operations.catalog';

@Injectable()
export class AutomationEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  getInitialRuleCatalog() {
    return initialAutomationRuleCatalog;
  }

  async listRules(actor: AuthContext) {
    return this.prisma.automationRule.findMany({
      where: { tenantId: actor.tenantId },
      include: { triggers: true, conditions: true, actions: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async createRule(dto: CreateAutomationRuleDto, actor: AuthContext) {
    if (!dto.triggers.length) {
      throw new BadRequestException('At least one trigger is required');
    }
    if (!dto.actions.length) {
      throw new BadRequestException('At least one action is required');
    }

    const rule = await this.prisma.automationRule.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        isEnabled: dto.isEnabled ?? true,
        priority: dto.priority ?? 100,
        featureKey: dto.featureKey?.trim() || null,
        createdById: actor.userId,
        triggers: {
          create: dto.triggers.map((trigger) => ({
            tenantId: actor.tenantId,
            type: trigger.type,
            sourceModule: trigger.sourceModule?.trim() || null,
            config: (trigger.config ?? {}) as Prisma.InputJsonValue,
          })),
        },
        conditions: {
          create: (dto.conditions ?? []).map((condition) => ({
            tenantId: actor.tenantId,
            fieldPath: condition.fieldPath.trim(),
            operator: condition.operator,
            value: condition.value as Prisma.InputJsonValue | undefined,
          })),
        },
        actions: {
          create: dto.actions.map((action, index) => ({
            tenantId: actor.tenantId,
            type: action.type,
            config: (action.config ?? {}) as Prisma.InputJsonValue,
            sortOrder: action.sortOrder ?? index,
          })),
        },
      },
      include: { triggers: true, conditions: true, actions: true },
    });

    await this.auditService.record({
      action: 'automation_rule_created',
      resource: 'automation_rule',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: rule.id,
      after: {
        name: rule.name,
        triggers: rule.triggers.map((trigger) => trigger.type),
        actions: rule.actions.map((action) => action.type),
      },
    });

    return rule;
  }

  async executeTrigger(dto: ExecuteAutomationTriggerDto, actor: AuthContext) {
    const idempotencyKey =
      dto.idempotencyKey ??
      [
        dto.triggerType,
        dto.targetType ?? 'tenant',
        dto.targetId ?? actor.tenantId,
        new Date().toISOString().slice(0, 10),
      ].join(':');
    const rules = await this.prisma.automationRule.findMany({
      where: {
        tenantId: actor.tenantId,
        isEnabled: true,
        triggers: { some: { type: dto.triggerType } },
      },
      include: { triggers: true, conditions: true, actions: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    });

    const logs: unknown[] = [];
    for (const rule of rules) {
      const ruleKey = `${rule.id}:${idempotencyKey}`;
      const existing = await this.prisma.automationExecutionLog.findFirst({
        where: { tenantId: actor.tenantId, idempotencyKey: ruleKey },
      });
      if (existing) {
        logs.push(existing);
        continue;
      }

      const input = dto.payload ?? {};
      const matched = rule.conditions.every((condition) =>
        evaluateCondition(
          getPath(input, condition.fieldPath),
          condition.operator,
          condition.value,
        ),
      );

      if (!matched) {
        logs.push(
          await this.prisma.automationExecutionLog.create({
            data: {
              tenantId: actor.tenantId,
              ruleId: rule.id,
              triggerType: dto.triggerType,
              targetType: dto.targetType ?? null,
              targetId: dto.targetId ?? null,
              status: AutomationExecutionStatus.SKIPPED,
              idempotencyKey: ruleKey,
              input: input as Prisma.InputJsonValue,
              result: { reason: 'conditions_not_matched' },
            },
          }),
        );
        continue;
      }

      try {
        const actionResults = rule.actions
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((action) => ({
            actionId: action.id,
            type: action.type,
            queuedForModuleBoundary: true,
            config: action.config,
          }));

        const log = await this.prisma.automationExecutionLog.create({
          data: {
            tenantId: actor.tenantId,
            ruleId: rule.id,
            triggerType: dto.triggerType,
            targetType: dto.targetType ?? null,
            targetId: dto.targetId ?? null,
            status: AutomationExecutionStatus.SUCCEEDED,
            idempotencyKey: ruleKey,
            input: input as Prisma.InputJsonValue,
            result: { actions: actionResults },
          },
        });
        logs.push(log);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Automation action failed';
        const log = await this.prisma.automationExecutionLog.create({
          data: {
            tenantId: actor.tenantId,
            ruleId: rule.id,
            triggerType: dto.triggerType,
            targetType: dto.targetType ?? null,
            targetId: dto.targetId ?? null,
            status: AutomationExecutionStatus.FAILED,
            idempotencyKey: ruleKey,
            input: input as Prisma.InputJsonValue,
            result: { error: message },
            failures: {
              create: {
                tenantId: actor.tenantId,
                errorCode: 'ACTION_FAILED',
                errorMessage: message,
              },
            },
          },
        });
        logs.push(log);
      }
    }

    await this.auditService.record({
      action: 'automation_trigger_executed',
      resource: 'automation_rule',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        triggerType: dto.triggerType,
        targetType: dto.targetType ?? null,
        targetId: dto.targetId ?? null,
        matchedRules: logs.length,
      },
    });

    return { items: logs, total: logs.length };
  }

  async listExecutionLogs(actor: AuthContext) {
    return this.prisma.automationExecutionLog.findMany({
      where: { tenantId: actor.tenantId },
      include: { failures: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

function getPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

function evaluateCondition(
  actual: unknown,
  operator: AutomationConditionOperator,
  expected: unknown,
) {
  switch (operator) {
    case AutomationConditionOperator.EXISTS:
      return actual !== undefined && actual !== null && actual !== '';
    case AutomationConditionOperator.EQUALS:
      return actual === expected;
    case AutomationConditionOperator.NOT_EQUALS:
      return actual !== expected;
    case AutomationConditionOperator.GREATER_THAN:
      return Number(actual) > Number(expected);
    case AutomationConditionOperator.GREATER_THAN_OR_EQUAL:
      return Number(actual) >= Number(expected);
    case AutomationConditionOperator.LESS_THAN:
      return Number(actual) < Number(expected);
    case AutomationConditionOperator.LESS_THAN_OR_EQUAL:
      return Number(actual) <= Number(expected);
    case AutomationConditionOperator.IN:
      return Array.isArray(expected) && expected.includes(actual);
    case AutomationConditionOperator.NOT_IN:
      return Array.isArray(expected) && !expected.includes(actual);
    default:
      return false;
  }
}
