import {
  ApprovalDecisionType,
  ApprovalRequestStatus,
  ApprovalWorkflowType,
  AudienceType,
  AuthMethod,
  ChatEscalationStatus,
  NoticeLifecycleStatus,
  NoticePriority,
} from '@prisma/client';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { MobilePrincipalService } from './mobile-principal.service';

describe('MobilePrincipalService', () => {
  const actor: AuthContext = {
    userId: 'principal-user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school',
    email: 'principal@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['principal'],
    permissions: [
      'students:read',
      'advanced:approvals:read',
      'advanced:approvals:decide',
      'advanced:approvals:manage',
      'messaging:manage',
      'notices:create',
      'notices:read',
    ],
  };

  let prisma: {
    student: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
    approvalRequest: {
      findFirst: jest.Mock;
    };
    approvalDecision: {
      findFirst: jest.Mock;
    };
    approvalPolicy: {
      findFirst: jest.Mock;
    };
    chatEscalation: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    user: {
      findFirst: jest.Mock;
    };
    auditLog: {
      findMany: jest.Mock;
    };
    tenantSetting: {
      findMany: jest.Mock;
    };
    notice: {
      findFirst: jest.Mock;
    };
    notificationDelivery: {
      groupBy: jest.Mock;
    };
  };
  let entitlements: {
    assertModuleEnabled: jest.Mock;
    assertFeatureEnabled: jest.Mock;
  };
  let approvalWorkflow: {
    registerFinalAction: jest.Mock;
    hasFinalActionExecutor: jest.Mock;
    decide: jest.Mock;
    createRequest: jest.Mock;
  };
  let audit: {
    record: jest.Mock;
  };
  let communications: {
    previewNoticeRecipients: jest.Mock;
    getCommunicationProviderDiagnostics: jest.Mock;
    createNoticeDraft: jest.Mock;
    markNoticeApprovalPending: jest.Mock;
    markNoticeApproved: jest.Mock;
    publishNotice: jest.Mock;
  };
  let fileRegistry: {
    listFilesByEntity: jest.Mock;
  };
  let service: MobilePrincipalService;

  beforeEach(() => {
    prisma = {
      student: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      approvalRequest: {
        findFirst: jest.fn(),
      },
      approvalDecision: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      approvalPolicy: {
        findFirst: jest.fn(),
      },
      chatEscalation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn(),
      },
      tenantSetting: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      notice: {
        findFirst: jest.fn(),
      },
      notificationDelivery: {
        groupBy: jest.fn(),
      },
    };
    entitlements = {
      assertModuleEnabled: jest.fn().mockResolvedValue(undefined),
      assertFeatureEnabled: jest.fn().mockResolvedValue(undefined),
    };
    approvalWorkflow = {
      registerFinalAction: jest.fn(),
      hasFinalActionExecutor: jest.fn().mockReturnValue(false),
      decide: jest.fn(),
      createRequest: jest.fn(),
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    communications = {
      previewNoticeRecipients: jest.fn(),
      getCommunicationProviderDiagnostics: jest.fn(),
      createNoticeDraft: jest.fn(),
      markNoticeApprovalPending: jest.fn(),
      markNoticeApproved: jest.fn(),
      publishNotice: jest.fn(),
    };
    fileRegistry = {
      listFilesByEntity: jest.fn(),
    };
    service = new MobilePrincipalService(
      prisma as never,
      entitlements as never,
      approvalWorkflow as never,
      audit as never,
      communications as never,
      fileRegistry as never,
    );
  });

  it('returns masked guardian contact in principal student lookup', async () => {
    prisma.student.findMany.mockResolvedValue([
      {
        id: 'student-1',
        firstNameEn: 'Aarav',
        lastNameEn: 'Sharma',
        class: { name: 'Grade 5' },
        sectionRef: { name: 'A' },
        guardianLinks: [
          {
            guardian: {
              fullName: 'Mina Sharma',
              primaryPhone: '+9779800001234',
            },
          },
        ],
        attendanceRecords: [{ status: 'PRESENT' }, { status: 'ABSENT' }],
        invoices: [],
      },
    ]);
    prisma.student.count.mockResolvedValue(1);

    await expect(
      service.searchStudents(actor, { query: 'aarav' }),
    ).resolves.toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            name: 'Aarav Sharma',
            guardianName: 'Mina Sharma',
            guardianPhone: '******1234',
            attendanceSummary: '50%',
            feeRisk: 'Clear',
          }),
        ],
      }),
    );
  });

  it('fails closed when an approval belongs to another tenant', async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue(null);

    await expect(
      service.getApprovalDetail(actor, 'approval-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.approvalRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'approval-1',
          tenantId: 'tenant-1',
        }),
      }),
    );
  });

  it('projects only permission-safe approval context on mobile', async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'approval-1',
      tenantId: 'tenant-1',
      workflowType: ApprovalWorkflowType.LEAVE_REQUEST,
      status: ApprovalRequestStatus.PENDING,
      title: 'Leave request',
      reason: 'Medical leave requested.',
      targetModule: 'hr',
      targetType: 'staff_leave_request',
      targetId: 'leave-1',
      requestedById: 'staff-user-1',
      safeContext: {
        leaveDays: 2,
        salaryAmount: 50000,
        bankAccount: 'private',
      },
      finalActionStatus: 'NOT_READY',
      finalActionAppliedAt: null,
      createdAt: new Date('2026-06-28T01:00:00.000Z'),
      updatedAt: new Date('2026-06-28T01:00:00.000Z'),
      policy: null,
      requestedBy: {
        id: 'staff-user-1',
        email: 'teacher@school.test',
        staff: {
          firstName: 'Sita',
          lastName: 'Sharma',
        },
        guardian: null,
      },
      steps: [
        {
          id: 'step-1',
          sequence: 1,
          name: 'Principal review',
          status: 'PENDING',
          approverRole: 'principal',
          approverPermission: null,
          decidedAt: null,
        },
      ],
      decisions: [],
      _count: { attachments: 0, comments: 0 },
    });

    const result = await service.getApprovalDetail(actor, 'approval-1');

    expect(result.requester.name).toBe('Sita Sharma');
    expect(result.supportingContext).toEqual({ leaveDays: 2 });
    expect(JSON.stringify(result)).not.toContain('salaryAmount');
    expect(JSON.stringify(result)).not.toContain('bankAccount');
    expect(JSON.stringify(result)).not.toContain('targetId');
  });

  it('denies approval detail without the read permission', async () => {
    await expect(
      service.getApprovalDetail(
        { ...actor, permissions: ['advanced:approvals:decide'] },
        'approval-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.approvalRequest.findFirst).not.toHaveBeenCalled();
  });

  it('denies principal mutation contracts to non-principal roles', async () => {
    await expect(
      service.resolveEscalation(
        {
          ...actor,
          roles: ['parent'],
          permissions: ['messaging:manage'],
        },
        'escalation-1',
        { resolutionReason: 'Attempted cross-role action.' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chatEscalation.findFirst).not.toHaveBeenCalled();
  });

  it('prevents a requester from deciding their own approval', async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'approval-1',
      requestedById: actor.userId,
      workflowType: ApprovalWorkflowType.LEAVE_REQUEST,
      targetModule: 'hr',
      targetType: 'staff_leave_request',
      status: ApprovalRequestStatus.PENDING,
      steps: [
        {
          id: 'step-1',
          status: 'PENDING',
          approverRole: 'principal',
          approverPermission: null,
        },
      ],
    });

    await expect(
      service.decideApproval(actor, 'approval-1', {
        decision: ApprovalDecisionType.APPROVE,
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(approvalWorkflow.decide).not.toHaveBeenCalled();
  });

  it('requires an approval reason for high-impact mobile approvals', async () => {
    approvalWorkflow.hasFinalActionExecutor.mockReturnValue(true);
    prisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'approval-1',
      requestedById: 'requester-1',
      workflowType: ApprovalWorkflowType.STUDENT_TRANSFER_WITHDRAWAL,
      targetModule: 'students',
      targetType: 'student',
      finalActionKey: 'students.lifecycle.transfer_or_withdraw',
      status: ApprovalRequestStatus.PENDING,
      steps: [
        {
          id: 'step-1',
          status: 'PENDING',
          approverRole: 'principal',
          approverPermission: null,
        },
      ],
    });

    await expect(
      service.decideApproval(actor, 'approval-1', {
        decision: ApprovalDecisionType.APPROVE,
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toThrow(
      'An approval reason is required for this high-impact request.',
    );
    expect(approvalWorkflow.decide).not.toHaveBeenCalled();
  });

  it('delegates an allowed approval decision and records mobile audit', async () => {
    approvalWorkflow.hasFinalActionExecutor.mockReturnValue(true);
    prisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'approval-1',
      requestedById: 'requester-1',
      workflowType: ApprovalWorkflowType.ATTENDANCE_CORRECTION,
      targetModule: 'attendance',
      targetType: 'attendance_record',
      finalActionKey: 'attendance.record.correct',
      status: ApprovalRequestStatus.PENDING,
      steps: [
        {
          id: 'step-1',
          status: 'PENDING',
          approverRole: 'principal',
          approverPermission: null,
        },
      ],
    });
    approvalWorkflow.decide.mockResolvedValue({
      status: ApprovalRequestStatus.APPLIED,
    });
    jest
      .spyOn(service, 'getApprovalDetail')
      .mockResolvedValue({ id: 'approval-1', status: 'APPLIED' } as never);

    await expect(
      service.decideApproval(actor, 'approval-1', {
        decision: ApprovalDecisionType.APPROVE,
        idempotencyKey: '33333333-3333-4333-8333-333333333333',
      }),
    ).resolves.toEqual({ id: 'approval-1', status: 'APPLIED' });

    expect(approvalWorkflow.decide).toHaveBeenCalledWith(
      'approval-1',
      {
        decision: ApprovalDecisionType.APPROVE,
        reason: undefined,
        context: { source: 'principal_mobile' },
        idempotencyKey: '33333333-3333-4333-8333-333333333333',
      },
      actor,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'principal_mobile_approval_decided',
        tenantId: 'tenant-1',
        resourceId: 'approval-1',
      }),
    );
  });

  it('does not approve requests without a registered module final action', async () => {
    prisma.approvalRequest.findFirst.mockResolvedValue({
      id: 'approval-1',
      requestedById: 'requester-1',
      workflowType: ApprovalWorkflowType.LEAVE_REQUEST,
      targetModule: 'hr',
      targetType: 'staff_leave_request',
      finalActionKey: 'hr.leave.apply',
      status: ApprovalRequestStatus.PENDING,
      steps: [
        {
          id: 'step-1',
          status: 'PENDING',
          approverRole: 'principal',
          approverPermission: null,
        },
      ],
    });

    await expect(
      service.decideApproval(actor, 'approval-1', {
        decision: ApprovalDecisionType.APPROVE,
        idempotencyKey: '55555555-5555-4555-8555-555555555555',
      }),
    ).rejects.toThrow(
      'Approval is unavailable until the module final action is registered.',
    );
    expect(approvalWorkflow.decide).not.toHaveBeenCalled();
  });

  it('replays a previously accepted approval decision idempotently', async () => {
    prisma.approvalDecision.findFirst.mockResolvedValue({
      requestId: 'approval-1',
    });
    jest
      .spyOn(service, 'getApprovalDetail')
      .mockResolvedValue({ id: 'approval-1', status: 'APPLIED' } as never);

    await expect(
      service.decideApproval(actor, 'approval-1', {
        decision: ApprovalDecisionType.APPROVE,
        idempotencyKey: '44444444-4444-4444-8444-444444444444',
      }),
    ).resolves.toEqual({ id: 'approval-1', status: 'APPLIED' });
    expect(prisma.approvalRequest.findFirst).not.toHaveBeenCalled();
    expect(approvalWorkflow.decide).not.toHaveBeenCalled();
  });

  it('registers a tenant-safe emergency notice approval final action', async () => {
    service.onModuleInit();
    const executor = approvalWorkflow.registerFinalAction.mock.calls[0][1];

    await expect(
      executor.apply({
        tenantId: 'tenant-2',
        requestId: 'approval-1',
        workflowType: ApprovalWorkflowType.EMERGENCY_HIGH_IMPACT_NOTICE,
        targetModule: 'communications',
        targetType: 'notice',
        targetId: 'notice-1',
        payload: {},
        actor,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(communications.publishNotice).not.toHaveBeenCalled();

    communications.publishNotice.mockResolvedValue({ state: 'QUEUED' });
    await executor.apply({
      tenantId: 'tenant-1',
      requestId: 'approval-1',
      workflowType: ApprovalWorkflowType.EMERGENCY_HIGH_IMPACT_NOTICE,
      targetModule: 'communications',
      targetType: 'notice',
      targetId: 'notice-1',
      payload: { scheduledFor: null },
      actor,
    });
    expect(communications.publishNotice).toHaveBeenCalledWith(
      'notice-1',
      actor,
      { scheduledFor: null },
    );
    expect(communications.markNoticeApproved).toHaveBeenCalledWith(
      'notice-1',
      'approval-1',
      actor,
    );
  });

  it('locks resolved escalations against resolution-note edits', async () => {
    prisma.chatEscalation.findFirst.mockResolvedValue({
      id: 'escalation-1',
      status: ChatEscalationStatus.RESOLVED,
    });

    await expect(
      service.addEscalationNote(actor, 'escalation-1', {
        note: 'Follow-up completed.',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.chatEscalation.updateMany).not.toHaveBeenCalled();
  });

  it('resolves an open tenant escalation with a reason and audit record', async () => {
    prisma.chatEscalation.findFirst.mockResolvedValue({
      id: 'escalation-1',
      status: ChatEscalationStatus.OPEN,
    });
    prisma.chatEscalation.updateMany.mockResolvedValue({ count: 1 });
    jest
      .spyOn(service, 'getEscalationDetail')
      .mockResolvedValue({ id: 'escalation-1', status: 'RESOLVED' } as never);

    await service.resolveEscalation(actor, 'escalation-1', {
      resolutionReason: 'Guardian concern addressed by the class team.',
    });

    expect(prisma.chatEscalation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'escalation-1',
          tenantId: 'tenant-1',
        }),
        data: expect.objectContaining({
          status: ChatEscalationStatus.RESOLVED,
          resolvedByUserId: actor.userId,
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'principal_mobile_escalation_resolved',
        tenantId: 'tenant-1',
        resourceId: 'escalation-1',
      }),
    );
  });

  it('assigns an open escalation to the signed-in principal with audit', async () => {
    prisma.chatEscalation.findFirst.mockResolvedValue({
      id: 'escalation-1',
      status: ChatEscalationStatus.OPEN,
    });
    prisma.chatEscalation.updateMany.mockResolvedValue({ count: 1 });
    jest
      .spyOn(service, 'getEscalationDetail')
      .mockResolvedValue({ id: 'escalation-1', status: 'OPEN' } as never);

    await service.assignEscalationToSelf(actor, 'escalation-1');

    expect(prisma.chatEscalation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'escalation-1',
          tenantId: 'tenant-1',
        }),
        data: expect.objectContaining({
          escalatedToUserId: actor.userId,
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'principal_mobile_escalation_assigned_to_self',
        tenantId: 'tenant-1',
      }),
    );
  });

  it('reopens only resolved escalations and records the reason', async () => {
    prisma.chatEscalation.findFirst.mockResolvedValue({
      id: 'escalation-1',
      status: ChatEscalationStatus.RESOLVED,
    });
    prisma.chatEscalation.updateMany.mockResolvedValue({ count: 1 });
    jest.spyOn(service, 'getEscalationDetail').mockResolvedValue({
      id: 'escalation-1',
      status: 'REOPENED',
    } as never);

    await service.reopenEscalation(actor, 'escalation-1', {
      reason: 'Guardian reported the concern again.',
    });

    expect(prisma.chatEscalation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          status: ChatEscalationStatus.RESOLVED,
        }),
        data: expect.objectContaining({
          status: ChatEscalationStatus.REOPENED,
          resolvedAt: null,
          resolvedByUserId: null,
        }),
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'principal_mobile_escalation_reopened',
        after: expect.objectContaining({
          reason: 'Guardian reported the concern again.',
        }),
      }),
    );
  });

  it('fails closed when an escalation is outside the actor tenant', async () => {
    prisma.chatEscalation.findFirst.mockResolvedValue(null);

    await expect(
      service.resolveEscalation(actor, 'other-escalation', {
        resolutionReason: 'Resolved.',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.chatEscalation.updateMany).not.toHaveBeenCalled();
  });

  it('creates an approval-required emergency notice without publishing it', async () => {
    communications.previewNoticeRecipients.mockResolvedValue({
      audienceType: AudienceType.ALL,
      classId: null,
      sectionId: null,
      recipientCount: 12,
      allowedRecipientCount: 10,
      skippedRecipientCount: 2,
      estimatedDeliveryRows: 20,
      channels: ['PUSH', 'SMS'],
    });
    communications.getCommunicationProviderDiagnostics.mockResolvedValue(
      providerDiagnostics('healthy'),
    );
    prisma.approvalPolicy.findFirst.mockResolvedValue({
      id: 'policy-1',
      name: 'Emergency notice approval',
      minApprovals: 1,
    });
    communications.createNoticeDraft.mockResolvedValue({
      id: 'notice-1',
      title: 'School closure',
      priority: NoticePriority.EMERGENCY,
      audienceType: AudienceType.ALL,
    });
    approvalWorkflow.createRequest.mockResolvedValue({
      id: 'approval-1',
    });
    jest.spyOn(service, 'getEmergencyNoticeStatus').mockResolvedValue({
      id: 'notice-1',
      state: 'AWAITING_APPROVAL',
    } as never);

    await expect(
      service.submitEmergencyNotice(actor, {
        title: 'School closure',
        body: 'School is closed today due to an emergency.',
        priority: NoticePriority.EMERGENCY,
        audienceType: AudienceType.ALL,
        sendMode: 'SEND_NOW',
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
        reason: 'Immediate safety notice.',
      }),
    ).resolves.toEqual({
      id: 'notice-1',
      state: 'AWAITING_APPROVAL',
    });

    expect(approvalWorkflow.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowType: ApprovalWorkflowType.EMERGENCY_HIGH_IMPACT_NOTICE,
        targetId: 'notice-1',
        policyId: 'policy-1',
        idempotencyKey:
          'principal-mobile-notice:11111111-1111-4111-8111-111111111111',
      }),
      actor,
    );
    expect(communications.publishNotice).not.toHaveBeenCalled();
    expect(communications.markNoticeApprovalPending).toHaveBeenCalledWith(
      'notice-1',
      'approval-1',
      actor,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'principal_mobile_emergency_notice_submitted',
        tenantId: 'tenant-1',
        resourceId: 'notice-1',
      }),
    );
  });

  it('fails closed before preview when the notices module is locked', async () => {
    entitlements.assertModuleEnabled.mockRejectedValue(
      new ForbiddenException('Notices module is locked.'),
    );

    await expect(
      service.previewEmergencyNoticeRecipients(actor, {
        title: 'Urgent update',
        body: 'Classes start one hour late.',
        priority: NoticePriority.URGENT,
        audienceType: AudienceType.ALL,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(communications.previewNoticeRecipients).not.toHaveBeenCalled();
  });

  it('reports disabled emergency providers without claiming delivery readiness', async () => {
    prisma.notice.findFirst.mockResolvedValue(null);
    communications.getCommunicationProviderDiagnostics.mockResolvedValue(
      providerDiagnostics('unavailable'),
    );

    await expect(service.getEmergencyNotice(actor)).resolves.toEqual(
      expect.objectContaining({
        status: 'empty',
        providerState: expect.objectContaining({
          availableChannelCount: 0,
        }),
        actions: expect.objectContaining({
          previewRecipients: true,
          submit: true,
        }),
      }),
    );
  });

  it('does not create a send-now notice when all providers are unavailable', async () => {
    communications.previewNoticeRecipients.mockResolvedValue({
      audienceType: AudienceType.ALL,
      classId: null,
      sectionId: null,
      recipientCount: 10,
      allowedRecipientCount: 10,
      skippedRecipientCount: 0,
      estimatedDeliveryRows: 10,
      channels: ['PUSH'],
    });
    communications.getCommunicationProviderDiagnostics.mockResolvedValue(
      providerDiagnostics('unavailable'),
    );
    prisma.approvalPolicy.findFirst.mockResolvedValue(null);

    await expect(
      service.submitEmergencyNotice(actor, {
        title: 'Urgent update',
        body: 'Classes will start one hour late today.',
        priority: NoticePriority.URGENT,
        audienceType: AudienceType.ALL,
        sendMode: 'SEND_NOW',
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(communications.createNoticeDraft).not.toHaveBeenCalled();
    expect(communications.publishNotice).not.toHaveBeenCalled();
  });

  it('fails closed for urgent mobile dispatch while quiet hours are enabled', async () => {
    communications.previewNoticeRecipients.mockResolvedValue({
      audienceType: AudienceType.ALL,
      classId: null,
      sectionId: null,
      recipientCount: 10,
      allowedRecipientCount: 10,
      skippedRecipientCount: 0,
      estimatedDeliveryRows: 10,
      channels: ['PUSH'],
    });
    communications.getCommunicationProviderDiagnostics.mockResolvedValue(
      providerDiagnostics('healthy'),
    );
    prisma.approvalPolicy.findFirst.mockResolvedValue(null);
    prisma.tenantSetting.findMany.mockResolvedValue([
      { key: 'quiet_hours_enabled', value: true },
    ]);

    await expect(
      service.submitEmergencyNotice(actor, {
        title: 'Urgent update',
        body: 'Classes start one hour late.',
        priority: NoticePriority.URGENT,
        audienceType: AudienceType.ALL,
        sendMode: 'SCHEDULE',
        scheduledFor: new Date(Date.now() + 60_000).toISOString(),
        idempotencyKey: '33333333-3333-4333-8333-333333333333',
      }),
    ).rejects.toThrow(
      'Urgent mobile dispatch is unavailable while quiet hours are enabled',
    );
    expect(communications.createNoticeDraft).not.toHaveBeenCalled();
  });

  it('returns protected attachment metadata without storage internals', async () => {
    prisma.notice.findFirst.mockResolvedValue({
      id: 'notice-1',
      title: 'Urgent update',
      body: 'Please review the attached circular.',
      priority: NoticePriority.URGENT,
      audienceType: AudienceType.ALL,
      classId: null,
      sectionId: null,
      lifecycleStatus: NoticeLifecycleStatus.PUBLISHED,
      approvalRequestId: null,
      scheduledFor: null,
      publishedAt: null,
      createdAt: new Date('2026-06-28T01:00:00.000Z'),
      updatedAt: new Date('2026-06-28T01:00:00.000Z'),
    });
    prisma.notificationDelivery.groupBy.mockResolvedValue([]);
    prisma.approvalRequest.findFirst.mockResolvedValue(null);
    fileRegistry.listFilesByEntity.mockResolvedValue([
      {
        id: 'file-1',
        originalFilename: 'circular.pdf',
        objectKey: 'tenant-1/private/circular.pdf',
      },
    ]);
    communications.getCommunicationProviderDiagnostics.mockResolvedValue(
      providerDiagnostics('healthy'),
    );

    const result = await service.getEmergencyNoticeStatus(actor, 'notice-1');

    expect(result.attachment).toEqual({
      fileAssetId: 'file-1',
      fileName: 'circular.pdf',
      protected: true,
    });
    expect(JSON.stringify(result)).not.toContain('objectKey');
    expect(JSON.stringify(result)).not.toContain(
      'tenant-1/private/circular.pdf',
    );
  });
});

function providerDiagnostics(health: 'healthy' | 'unavailable') {
  return {
    channels: [
      {
        channel: 'PUSH',
        mode: health === 'healthy' ? 'configured' : 'disabled',
        health,
        message: 'Push provider state.',
      },
      {
        channel: 'SMS',
        mode: health === 'healthy' ? 'configured' : 'disabled',
        health,
        message: 'SMS provider state.',
      },
      {
        channel: 'EMAIL',
        mode: health === 'healthy' ? 'configured' : 'disabled',
        health,
        message: 'Email provider state.',
      },
    ],
  };
}
