import type { AuthContext } from '../auth/auth.types';
import { AttendanceController } from './attendance.controller';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'admin@school.test',
  roles: ['admin'],
  permissions: [],
  authMethod: 'PASSWORD',
};

function createController() {
  const service = {
    listAttendance: jest.fn(),
    getRoster: jest.fn(),
    getAnalytics: jest.fn(),
    getSummary: jest.fn(),
    getMonthlyRegister: jest.fn(),
    exportMonthlyRegister: jest.fn(),
    listConflicts: jest.fn(),
    listCalendarDays: jest.fn(),
    upsertCalendarDay: jest.fn(),
    listStaffAttendance: jest.fn(),
    listStaffAttendanceSummary: jest.fn(),
    listMyAttendance: jest.fn(),
    listMyLeaveRequests: jest.fn(),
    submitStaffAttendance: jest.fn(),
    listLeaveBalances: jest.fn(),
    listLeaveRequests: jest.fn(),
    createLeaveRequest: jest.fn(),
    reviewLeaveRequest: jest.fn(),
    submitAttendance: jest.fn(),
    syncAttendance: jest.fn(),
    overrideLockedSession: jest.fn(),
    reviewConflict: jest.fn(),
    createCorrectionRequest: jest.fn(),
    listCorrectionRequests: jest.fn(),
    approveCorrectionRequest: jest.fn(),
    getStudentHistory: jest.fn(),
    getParentSummary: jest.fn(),
  };

  return {
    controller: new AttendanceController(service as never),
    service,
  };
}

describe('AttendanceController M2 contracts', () => {
  it('delegates correction request creation with current actor', () => {
    const { controller, service } = createController();
    const dto = {
      attendanceRecordId: 'record-1',
      studentId: 'student-1',
      attendanceDate: '2026-05-09',
      requestedStatus: 'PRESENT',
      reason: 'Teacher corrected mistaken absence',
    };
    service.createCorrectionRequest.mockReturnValue({ id: 'correction-1' });

    const result = controller.createCorrectionRequest(dto as never, actor);

    expect(service.createCorrectionRequest).toHaveBeenCalledWith(dto, actor);
    expect(result).toEqual({ id: 'correction-1' });
  });

  it('forces approve correction endpoint to APPROVED regardless of body status', () => {
    const { controller, service } = createController();
    service.approveCorrectionRequest.mockReturnValue({ status: 'APPROVED' });

    const result = controller.approveCorrectionRequest(
      'correction-1',
      { status: 'REJECTED', reviewNote: 'Looks valid' },
      actor,
    );

    expect(service.approveCorrectionRequest).toHaveBeenCalledWith(
      'correction-1',
      { status: 'APPROVED', reviewNote: 'Looks valid' },
      actor,
    );
    expect(result).toEqual({ status: 'APPROVED' });
  });

  it('adds reject correction endpoint and forces REJECTED review status', () => {
    const { controller, service } = createController();
    service.approveCorrectionRequest.mockReturnValue({ status: 'REJECTED' });

    const result = controller.rejectCorrectionRequest(
      'correction-1',
      { status: 'APPROVED', reviewNote: 'Evidence not enough' },
      actor,
    );

    expect(service.approveCorrectionRequest).toHaveBeenCalledWith(
      'correction-1',
      { status: 'REJECTED', reviewNote: 'Evidence not enough' },
      actor,
    );
    expect(result).toEqual({ status: 'REJECTED' });
  });

  it('keeps generic correction review endpoint for existing clients', () => {
    const { controller, service } = createController();
    const dto = { status: 'REJECTED', reviewNote: 'Duplicate request' };
    service.approveCorrectionRequest.mockReturnValue({ status: 'REJECTED' });

    const result = controller.reviewCorrectionRequest(
      'correction-1',
      dto as never,
      actor,
    );

    expect(service.approveCorrectionRequest).toHaveBeenCalledWith(
      'correction-1',
      dto,
      actor,
    );
    expect(result).toEqual({ status: 'REJECTED' });
  });

  it('delegates parent/student summary request with current actor', () => {
    const { controller, service } = createController();
    service.getParentSummary.mockReturnValue({ studentId: 'student-1' });

    const result = controller.getParentSummary('student-1', actor);

    expect(service.getParentSummary).toHaveBeenCalledWith('student-1', actor);
    expect(result).toEqual({ studentId: 'student-1' });
  });

  it('delegates monthly register export with filters and current actor', () => {
    const { controller, service } = createController();
    const query = {
      academicYearId: 'year-1',
      classId: 'class-1',
      sectionId: 'section-1',
      month: 5,
      year: 2026,
    };
    service.exportMonthlyRegister.mockReturnValue('csv');

    const result = controller.exportMonthlyRegister(query as never, actor);

    expect(service.exportMonthlyRegister).toHaveBeenCalledWith(query, actor);
    expect(result).toBe('csv');
  });

  it('delegates offline sync submissions with current actor', () => {
    const { controller, service } = createController();
    const dto = {
      clientSubmissionId: 'draft-1',
      academicYearId: 'year-1',
      classId: 'class-1',
      attendanceDate: '2026-05-09',
      deviceTimestamp: '2026-05-09T08:00:00.000Z',
      exceptions: [],
    };
    service.syncAttendance.mockReturnValue({ clientSubmissionId: 'draft-1' });

    const result = controller.syncAttendance(dto as never, actor);

    expect(service.syncAttendance).toHaveBeenCalledWith(dto, actor);
    expect(result).toEqual({ clientSubmissionId: 'draft-1' });
  });
});
