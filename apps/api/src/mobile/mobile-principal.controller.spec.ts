import { AuthMethod } from '@prisma/client';
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
      | 'getAttendanceSummary'
      | 'getStaffAbsence'
      | 'getFeesSummary'
      | 'getAcademicsReadiness'
      | 'getTransportAlerts'
      | 'getEscalations'
      | 'searchStudents'
      | 'getReportsSnapshot'
      | 'getTasks'
      | 'getClassroomWalkthroughs'
      | 'getEmergencyNotice'
    >
  >;
  let controller: MobilePrincipalController;
  let actor: AuthContext;

  beforeEach(() => {
    service = {
      getDashboard: jest.fn(),
      getAttention: jest.fn(),
      getApprovals: jest.fn(),
      getAttendanceSummary: jest.fn(),
      getStaffAbsence: jest.fn(),
      getFeesSummary: jest.fn(),
      getAcademicsReadiness: jest.fn(),
      getTransportAlerts: jest.fn(),
      getEscalations: jest.fn(),
      searchStudents: jest.fn(),
      getReportsSnapshot: jest.fn(),
      getTasks: jest.fn(),
      getClassroomWalkthroughs: jest.fn(),
      getEmergencyNotice: jest.fn(),
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
        'advanced:approvals:read',
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

    await controller.approvals(actor, 'pending');
    await controller.attendanceSummary(actor, '2026-06-19');
    await controller.staffAbsence(actor, '2026-06-19');

    expect(service.getApprovals).toHaveBeenCalledWith(actor, 'pending');
    expect(service.getAttendanceSummary).toHaveBeenCalledWith(
      actor,
      '2026-06-19',
    );
    expect(service.getStaffAbsence).toHaveBeenCalledWith(actor, '2026-06-19');
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
    await controller.escalations(actor, 'open');
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
});
