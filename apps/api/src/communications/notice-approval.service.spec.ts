import {
  ApprovalWorkflowType,
  AuthMethod,
  NoticeLifecycleStatus,
  NoticePriority,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { NoticeApprovalService } from './notice-approval.service';

describe('NoticeApprovalService', () => {
  const actor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school',
    email: 'admin@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['admin'],
    permissions: ['notices:create'],
  };

  const notice = {
    id: 'notice-1',
    tenantId: 'tenant-1',
    title: 'Urgent closure',
    body: 'School will close early today.',
    priority: NoticePriority.URGENT,
    audienceType: 'ALL',
    classId: null,
    sectionId: null,
    lifecycleStatus: NoticeLifecycleStatus.DRAFT,
    approvalRequestId: null,
    updatedAt: new Date('2026-07-16T06:00:00.000Z'),
  };

  function setup() {
    const prisma = {
      notice: { findFirst: jest.fn().mockResolvedValue(notice) },
    };
    const approvalWorkflow = {
      registerFinalAction: jest.fn(),
      createRequest: jest.fn().mockResolvedValue({ id: 'approval-1' }),
    };
    const communications = {
      previewNoticeRecipients: jest.fn().mockResolvedValue({
        allowedRecipientCount: 12,
        channels: ['IN_APP', 'PUSH'],
      }),
      markNoticeApprovalPending: jest.fn().mockResolvedValue({
        ...notice,
        lifecycleStatus: NoticeLifecycleStatus.APPROVAL_PENDING,
        approvalRequestId: 'approval-1',
      }),
      markNoticeApproved: jest.fn(),
      publishNotice: jest.fn(),
    };
    const service = new NoticeApprovalService(
      prisma as never,
      approvalWorkflow as never,
      communications as never,
    );
    return { service, prisma, approvalWorkflow, communications };
  }

  it('uses the backend recipient result when creating a notice approval request', async () => {
    const { service, approvalWorkflow, communications } = setup();

    const result = await service.requestApproval(
      notice.id,
      { reason: 'Urgent school-wide operational update.' },
      actor,
    );

    expect(communications.previewNoticeRecipients).toHaveBeenCalledWith(
      expect.objectContaining({
        title: notice.title,
        audienceType: notice.audienceType,
      }),
      actor,
    );
    expect(approvalWorkflow.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowType: ApprovalWorkflowType.EMERGENCY_HIGH_IMPACT_NOTICE,
        targetModule: 'notices',
        targetId: notice.id,
        safeContext: expect.objectContaining({
          recipientCount: 12,
          channels: ['IN_APP', 'PUSH'],
        }),
      }),
      actor,
    );
    expect(communications.markNoticeApprovalPending).toHaveBeenCalledWith(
      notice.id,
      'approval-1',
      actor,
    );
    expect(result.approvalRequestId).toBe('approval-1');
  });

  it('registers the approval final action with the M15 lifecycle service', () => {
    const { service, approvalWorkflow } = setup();

    service.onModuleInit();

    expect(approvalWorkflow.registerFinalAction).toHaveBeenCalledWith(
      'communications.notice.publish_high_impact',
      expect.objectContaining({ apply: expect.any(Function) }),
    );
  });
});
