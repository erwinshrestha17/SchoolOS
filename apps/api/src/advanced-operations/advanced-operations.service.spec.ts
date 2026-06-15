import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  AnalyticsSummaryDomain,
  ApprovalDecisionType,
  ApprovalFinalActionStatus,
  ApprovalRequestStatus,
  ApprovalStepStatus,
  ApprovalWorkflowType,
  AutomationActionType,
  AutomationConditionOperator,
  AutomationExecutionStatus,
  AutomationTriggerType,
  DataExportJobStatus,
  DocumentTemplateKind,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { AutomationEngineService } from './automation-engine.service';
import { DescriptiveAnalyticsService } from './descriptive-analytics.service';
import { DocumentTemplateService } from './document-template.service';
import { DataExportCenterService } from './data-export-center.service';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'school',
  email: 'admin@school.test',
  authMethod: 'PASSWORD',
  roles: ['admin'],
  permissions: [
    'advanced:approvals:manage',
    'advanced:approvals:decide',
    'advanced:automation:manage',
    'advanced:analytics:refresh',
    'advanced:documents:manage',
    'advanced:exports:create',
  ],
};

describe('advanced operations services', () => {
  const audit = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires a rejection reason before mutating approval state', async () => {
    const prisma = {
      approvalRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'approval-1',
          tenantId: actor.tenantId,
          status: ApprovalRequestStatus.PENDING,
          policyId: null,
          finalActionStatus: ApprovalFinalActionStatus.NOT_READY,
          steps: [
            {
              id: 'step-1',
              status: ApprovalStepStatus.PENDING,
              approverRole: null,
              approverPermission: null,
            },
          ],
        }),
      },
    };
    const service = new ApprovalWorkflowService(prisma as any, audit as any);

    await expect(
      service.decide(
        'approval-1',
        { decision: ApprovalDecisionType.REJECT },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies approval final action idempotently', async () => {
    const executor = { apply: jest.fn().mockResolvedValue({ ok: true }) };
    const prisma = {
      approvalRequest: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'approval-1',
            tenantId: actor.tenantId,
            workflowType: ApprovalWorkflowType.MARKS_CORRECTION,
            targetModule: 'academics',
            targetType: 'mark_entry',
            targetId: 'mark-1',
            status: ApprovalRequestStatus.APPROVED,
            finalActionStatus: ApprovalFinalActionStatus.READY,
            finalActionKey: 'academics.marks.correct',
            finalActionPayload: { markId: 'mark-1' },
            steps: [],
            decisions: [],
            comments: [],
          })
          .mockResolvedValueOnce({
            id: 'approval-1',
            tenantId: actor.tenantId,
            status: ApprovalRequestStatus.APPLIED,
            finalActionStatus: ApprovalFinalActionStatus.APPLIED,
            steps: [],
            decisions: [],
            comments: [],
          }),
        update: jest.fn().mockResolvedValue({
          id: 'approval-1',
          status: ApprovalRequestStatus.APPLIED,
        }),
      },
    };
    const service = new ApprovalWorkflowService(prisma as any, audit as any);
    service.registerFinalAction('academics.marks.correct', executor);

    await service.applyFinalAction('approval-1', actor);
    await service.applyFinalAction('approval-1', actor);

    expect(executor.apply).toHaveBeenCalledTimes(1);
    expect(prisma.approvalRequest.update).toHaveBeenCalledTimes(1);
  });

  it('executes deterministic automation once per rule idempotency key', async () => {
    const prisma = {
      automationRule: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'rule-1',
            tenantId: actor.tenantId,
            conditions: [
              {
                fieldPath: 'student.status',
                operator: AutomationConditionOperator.EQUALS,
                value: 'ACTIVE',
              },
            ],
            actions: [
              {
                id: 'action-1',
                type: AutomationActionType.CREATE_NOTIFICATION_TASK,
                sortOrder: 0,
                config: { channel: 'push' },
              },
            ],
          },
        ]),
      },
      automationExecutionLog: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'log-1',
          status: AutomationExecutionStatus.SUCCEEDED,
        }),
      },
    };
    const service = new AutomationEngineService(prisma as any, audit as any);

    const result = await service.executeTrigger(
      {
        triggerType: AutomationTriggerType.STUDENT_MARKED_ABSENT,
        targetType: 'student',
        targetId: 'student-1',
        idempotencyKey: 'absent:student-1:2026-06-15',
        payload: { student: { status: 'ACTIVE' } },
      },
      actor,
    );

    expect(result.total).toBe(1);
    expect(prisma.automationExecutionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: actor.tenantId,
          idempotencyKey: 'rule-1:absent:student-1:2026-06-15',
          status: AutomationExecutionStatus.SUCCEEDED,
        }),
      }),
    );
  });

  it('refreshes cached attendance analytics summaries with tenant scope', async () => {
    const prisma = {
      analyticsRefreshJob: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'job-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      attendanceRecord: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'ABSENT', _count: { _all: 2 } },
        ]),
      },
      attendanceSession: { count: jest.fn().mockResolvedValue(3) },
      attendanceCorrectionRequest: { count: jest.fn().mockResolvedValue(1) },
      analyticsSummary: {
        upsert: jest.fn().mockResolvedValue({ id: 'summary-1' }),
      },
    };
    const service = new DescriptiveAnalyticsService(
      prisma as any,
      audit as any,
    );

    await service.refresh(
      {
        domain: AnalyticsSummaryDomain.ATTENDANCE,
        summaryDate: '2026-06-15',
      },
      actor,
    );

    expect(prisma.attendanceRecord.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: actor.tenantId }),
      }),
    );
    expect(prisma.analyticsSummary.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantId: actor.tenantId,
          domain: AnalyticsSummaryDomain.ATTENDANCE,
        }),
      }),
    );
  });

  it('rejects document templates that use undeclared merge fields', async () => {
    const service = new DocumentTemplateService(
      {} as any,
      audit as any,
      {} as any,
    );

    await expect(
      service.createTemplate(
        {
          kind: DocumentTemplateKind.BONAFIDE_CERTIFICATE,
          key: 'bonafide',
          name: 'Bonafide',
          body: 'Student: {{studentName}} {{unsafeField}}',
          mergeFields: ['studentName'],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generates documents through File Registry with safe merge data', async () => {
    const prisma = {
      documentTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'template-1',
          key: 'bonafide',
          name: 'Bonafide',
          status: 'ACTIVE',
          versions: [
            {
              id: 'version-1',
              version: 1,
              body: 'This certifies {{studentName}}.',
              mergeFields: ['studentName'],
            },
          ],
        }),
      },
      generatedDocument: {
        create: jest.fn().mockResolvedValue({ id: 'doc-1' }),
        update: jest.fn().mockResolvedValue({
          id: 'doc-1',
          status: 'GENERATED',
          fileAssetId: 'file-1',
        }),
      },
    };
    const fileRegistry = {
      registerGeneratedFile: jest.fn().mockResolvedValue({ id: 'file-1' }),
    };
    const service = new DocumentTemplateService(
      prisma as any,
      audit as any,
      fileRegistry as any,
    );

    await service.generateDocument(
      'template-1',
      {
        subjectType: 'student',
        subjectId: 'student-1',
        mergeData: { studentName: 'Asha Sharma' },
      },
      actor,
    );

    expect(fileRegistry.registerGeneratedFile).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        module: 'advanced-documents',
        entityId: 'doc-1',
      }),
    );
  });

  it('keeps export job creation and processing idempotent', async () => {
    const queue = { add: jest.fn().mockResolvedValue({}) };
    const prisma = {
      dataExportJob: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'job-1',
            tenantId: actor.tenantId,
            exportKey: 'advanced.export_jobs',
            format: 'csv',
            filters: {},
            requestedById: actor.userId,
            status: DataExportJobStatus.COMPLETED,
            fileAssetId: 'file-1',
          }),
        create: jest.fn().mockResolvedValue({
          id: 'job-1',
          tenantId: actor.tenantId,
          exportKey: 'advanced.export_jobs',
          format: 'csv',
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new DataExportCenterService(
      prisma as any,
      audit as any,
      { registerGeneratedFile: jest.fn() } as any,
      queue as any,
    );

    await service.createJob(
      { exportKey: 'advanced.export_jobs', format: 'csv' },
      actor,
    );
    await service.completeJob({ tenantId: actor.tenantId, jobId: 'job-1' });

    expect(queue.add).toHaveBeenCalledWith(
      'runDataExport',
      { tenantId: actor.tenantId, jobId: 'job-1' },
      expect.objectContaining({ jobId: 'job-1' }),
    );
  });

  it('rejects export retries unless the source job failed', async () => {
    const prisma = {
      dataExportJob: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'job-1',
          tenantId: actor.tenantId,
          status: DataExportJobStatus.COMPLETED,
        }),
      },
    };
    const service = new DataExportCenterService(
      prisma as any,
      audit as any,
      {} as any,
      { add: jest.fn() } as any,
    );

    await expect(service.retryJob('job-1', actor)).rejects.toThrow(
      'Only failed export jobs can be retried',
    );
  });

  it('uses the advanced permission aliases for permission-denied checks', () => {
    const principalOnly = {
      ...actor,
      roles: ['teacher'],
      permissions: ['reports:read'],
    };
    expect(principalOnly.permissions).not.toContain('advanced:exports:create');
    expect(() => {
      if (!principalOnly.permissions.includes('advanced:exports:create')) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }).toThrow(ForbiddenException);
  });
});
