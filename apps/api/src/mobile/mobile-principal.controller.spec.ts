import { AuthMethod } from '@prisma/client';
import { FEATURE_KEYS } from '@schoolos/core';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { REQUIRED_FEATURE_KEY } from '../auth/decorators/required-feature.decorator';
import { REQUIRED_MODULE_KEY } from '../auth/decorators/required-module.decorator';
import type { AuthContext } from '../auth/auth.types';
import { MobilePrincipalController } from './mobile-principal.controller';
import { MobilePrincipalService } from './mobile-principal.service';

describe('MobilePrincipalController', () => {
  let service: jest.Mocked<
    Pick<
      MobilePrincipalService,
      | 'getDashboard'
      | 'getAttention'
      | 'getApprovals'
      | 'getApprovalDetail'
      | 'decideApproval'
      | 'getAttendanceSummary'
      | 'getStaffAbsence'
      | 'getFeesSummary'
      | 'getAcademicsReadiness'
      | 'getTransportAlerts'
      | 'getEscalations'
      | 'getEscalationDetail'
      | 'assignEscalationToSelf'
      | 'assignEscalation'
      | 'addEscalationNote'
      | 'resolveEscalation'
      | 'reopenEscalation'
      | 'searchStudents'
      | 'getReportsSnapshot'
      | 'getTasks'
      | 'getClassroomWalkthroughs'
      | 'getEmergencyNotice'
      | 'previewEmergencyNoticeRecipients'
      | 'submitEmergencyNotice'
      | 'getEmergencyNoticeStatus'
    >
  >;
  let controller: MobilePrincipalController;
  let actor: AuthContext;

  beforeEach(() => {
    service = {
      getDashboard: jest.fn(),
      getAttention: jest.fn(),
      getApprovals: jest.fn(),
      getApprovalDetail: jest.fn(),
      decideApproval: jest.fn(),
      getAttendanceSummary: jest.fn(),
      getStaffAbsence: jest.fn(),
      getFeesSummary: jest.fn(),
      getAcademicsReadiness: jest.fn(),
      getTransportAlerts: jest.fn(),
      getEscalations: jest.fn(),
      getEscalationDetail: jest.fn(),
      assignEscalationToSelf: jest.fn(),
      assignEscalation: jest.fn(),
      addEscalationNote: jest.fn(),
      resolveEscalation: jest.fn(),
      reopenEscalation: jest.fn(),
      searchStudents: jest.fn(),
      getReportsSnapshot: jest.fn(),
      getTasks: jest.fn(),
      getClassroomWalkthroughs: jest.fn(),
      getEmergencyNotice: jest.fn(),
      previewEmergencyNoticeRecipients: jest.fn(),
      submitEmergencyNotice: jest.fn(),
      getEmergencyNoticeStatus: jest.fn(),
    };
    controller = new MobilePrincipalController(
      service as unknown as MobilePrincipalService,
    );
    actor = {
      userId: 'principal-user-1',
      tenantId: 'tenant-1',
      tenantSlug: 'school',
      email: 'principal@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['principal'],
      permissions: [
        'students:read',
        'attendance:read',
        'notices:read',
        'notices:create',
        'advanced:approvals:read',
        'advanced:approvals:decide',
        'advanced:approvals:manage',
        'messaging:manage',
      ],
    };
  });

  it('delegates principal dashboard and attention snapshots', async () => {
    service.getDashboard.mockResolvedValue({ attentionCount: 2 } as never);
    service.getAttention.mockResolvedValue({ items: [] } as never);

    await expect(controller.dashboard(actor)).resolves.toEqual({
      attentionCount: 2,
    });
    await expect(controller.attention(actor, 'critical')).resolves.toEqual({
      items: [],
    });

    expect(service.getDashboard).toHaveBeenCalledWith(actor);
    expect(service.getAttention).toHaveBeenCalledWith(actor, 'critical');
  });

  it('delegates approval, attendance, and staff coverage snapshots', async () => {
    service.getApprovals.mockResolvedValue({ items: [] } as never);
    service.getAttendanceSummary.mockResolvedValue({
      metrics: { classesNotMarked: 0 },
    } as never);
    service.getStaffAbsence.mockResolvedValue({
      metrics: { absentToday: 0 },
    } as never);

    await controller.approvals(actor, { status: 'pending' });
    await controller.attendanceSummary(actor, '2026-06-19');
    await controller.staffAbsence(actor, '2026-06-19');

    expect(service.getApprovals).toHaveBeenCalledWith(actor, 'pending');
    expect(service.getAttendanceSummary).toHaveBeenCalledWith(
      actor,
      '2026-06-19',
    );
    expect(service.getStaffAbsence).toHaveBeenCalledWith(actor, '2026-06-19');
  });

  it('delegates purpose-limited approval and escalation mutations', async () => {
    service.getApprovalDetail.mockResolvedValue({ id: 'approval-1' } as never);
    service.decideApproval.mockResolvedValue({ status: 'APPLIED' } as never);
    service.assignEscalationToSelf.mockResolvedValue({
      status: 'OPEN',
    } as never);
    service.getEscalationDetail.mockResolvedValue({
      status: 'OPEN',
    } as never);
    service.assignEscalation.mockResolvedValue({
      status: 'OPEN',
    } as never);
    service.addEscalationNote.mockResolvedValue({
      status: 'OPEN',
    } as never);
    service.resolveEscalation.mockResolvedValue({
      status: 'RESOLVED',
    } as never);
    service.reopenEscalation.mockResolvedValue({
      status: 'REOPENED',
    } as never);

    await controller.approvalDetail(actor, 'approval-1');
    await controller.decideApproval(actor, 'approval-1', {
      decision: 'APPROVE',
      reason: 'Policy checked.',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
    });
    await controller.escalationDetail(actor, 'escalation-1');
    await controller.assignEscalationToSelf(actor, 'escalation-1');
    await controller.assignEscalation(actor, 'escalation-1', {
      assigneeUserId: '11111111-1111-4111-8111-111111111111',
    });
    await controller.addEscalationNote(actor, 'escalation-1', {
      note: 'Class team contacted.',
    });
    await controller.resolveEscalation(actor, 'escalation-1', {
      resolutionReason: 'Concern addressed.',
    });
    await controller.reopenEscalation(actor, 'escalation-1', {
      reason: 'Guardian reported the issue again.',
    });

    expect(service.getApprovalDetail).toHaveBeenCalledWith(actor, 'approval-1');
    expect(service.decideApproval).toHaveBeenCalledWith(actor, 'approval-1', {
      decision: 'APPROVE',
      reason: 'Policy checked.',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
    });
    expect(service.resolveEscalation).toHaveBeenCalledWith(
      actor,
      'escalation-1',
      { resolutionReason: 'Concern addressed.' },
    );
    expect(service.reopenEscalation).toHaveBeenCalledWith(
      actor,
      'escalation-1',
      { reason: 'Guardian reported the issue again.' },
    );
  });

  it('delegates more-area principal snapshots without exposing admin payloads', async () => {
    service.getFeesSummary.mockResolvedValue({ readOnly: true } as never);
    service.getAcademicsReadiness.mockResolvedValue({ metrics: {} } as never);
    service.getTransportAlerts.mockResolvedValue({ routes: [] } as never);
    service.getEscalations.mockResolvedValue({ items: [] } as never);
    service.searchStudents.mockResolvedValue({ items: [] } as never);
    service.getReportsSnapshot.mockResolvedValue({
      protectedExports: [],
    } as never);
    service.getTasks.mockResolvedValue({
      createTask: { supported: false },
    } as never);
    service.getClassroomWalkthroughs.mockResolvedValue({
      newObservation: { supported: false },
    } as never);
    service.getEmergencyNotice.mockResolvedValue({
      actions: { approveAndSend: false },
    } as never);

    await controller.feesSummary(actor);
    await controller.academicsReadiness(actor);
    await controller.transportAlerts(actor);
    await controller.escalations(actor, { status: 'open' });
    await controller.studentSearch(actor, 'aadya', 'class-1', 'section-1');
    await controller.reportsSnapshot(actor);
    await controller.tasks(actor, 'my');
    await controller.classroomWalkthroughs(actor);
    await controller.emergencyNotice(actor);

    expect(service.getFeesSummary).toHaveBeenCalledWith(actor);
    expect(service.getEscalations).toHaveBeenCalledWith(actor, 'open');
    expect(service.searchStudents).toHaveBeenCalledWith(actor, {
      query: 'aadya',
      classId: 'class-1',
      sectionId: 'section-1',
    });
    expect(service.getEmergencyNotice).toHaveBeenCalledWith(actor);
  });

  it('delegates emergency notice preview, submit, and status contracts', async () => {
    service.previewEmergencyNoticeRecipients.mockResolvedValue({
      recipients: { eligible: 10 },
    } as never);
    service.submitEmergencyNotice.mockResolvedValue({
      state: 'AWAITING_APPROVAL',
    } as never);
    service.getEmergencyNoticeStatus.mockResolvedValue({
      state: 'QUEUED',
    } as never);
    const dto = {
      title: 'School closure',
      body: 'School is closed today.',
      priority: 'EMERGENCY' as const,
      audienceType: 'ALL' as const,
    };

    await controller.previewEmergencyNoticeRecipients(actor, dto);
    await controller.submitEmergencyNotice(actor, {
      ...dto,
      sendMode: 'SEND_NOW',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      reason: 'Safety notice.',
    });
    await controller.emergencyNoticeStatus(actor, 'notice-1');

    expect(service.previewEmergencyNoticeRecipients).toHaveBeenCalledWith(
      actor,
      dto,
    );
    expect(service.submitEmergencyNotice).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      }),
    );
    expect(service.getEmergencyNoticeStatus).toHaveBeenCalledWith(
      actor,
      'notice-1',
    );
  });

  it('declares strict RBAC and entitlement metadata on new write routes', () => {
    const decideHandler = MobilePrincipalController.prototype.decideApproval;
    const escalationHandler =
      MobilePrincipalController.prototype.resolveEscalation;
    const noticeHandler =
      MobilePrincipalController.prototype.submitEmergencyNotice;

    expect(Reflect.getMetadata(PERMISSIONS_KEY, decideHandler)).toEqual([
      'advanced:approvals:decide',
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, escalationHandler)).toEqual([
      'messaging:manage',
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, noticeHandler)).toEqual([
      'notices:create',
      'advanced:approvals:manage',
    ]);
    expect(Reflect.getMetadata(REQUIRED_MODULE_KEY, noticeHandler)).toBe(
      'notices',
    );
    expect(Reflect.getMetadata(REQUIRED_FEATURE_KEY, noticeHandler)).toBe(
      FEATURE_KEYS.NOTICES_FULL,
    );
  });
});
