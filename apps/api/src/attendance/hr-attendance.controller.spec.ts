import type { AuthContext } from '../auth/auth.types';
import { HrAttendanceController } from './hr-attendance.controller';

const actor: AuthContext = {
  userId: 'admin-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'admin@school.test',
  roles: ['admin'],
  permissions: [],
  authMethod: 'PASSWORD',
};

function createController() {
  const service = {
    reviewLeaveRequest: jest.fn(),
  };

  return {
    controller: new HrAttendanceController(service as never),
    service,
  };
}

describe('HrAttendanceController leave decision routes', () => {
  it('approves a pending leave request for an empty body', () => {
    const { controller, service } = createController();
    service.reviewLeaveRequest.mockReturnValue({ status: 'APPROVED' });

    const result = controller.approveLeave('leave-1', {}, actor);

    expect(service.reviewLeaveRequest).toHaveBeenCalledWith(
      'leave-1',
      { reviewNote: undefined, status: 'APPROVED' },
      actor,
    );
    expect(result).toEqual({ status: 'APPROVED' });
  });

  it('forwards an approval reviewNote and forces status to APPROVED', () => {
    const { controller, service } = createController();
    service.reviewLeaveRequest.mockReturnValue({ status: 'APPROVED' });

    controller.approveLeave(
      'leave-1',
      { reviewNote: 'Approved by principal' },
      actor,
    );

    expect(service.reviewLeaveRequest).toHaveBeenCalledWith(
      'leave-1',
      { reviewNote: 'Approved by principal', status: 'APPROVED' },
      actor,
    );
  });

  it('ignores any client-supplied status and always rejects with REJECTED', () => {
    const { controller, service } = createController();
    service.reviewLeaveRequest.mockReturnValue({ status: 'REJECTED' });

    const result = controller.rejectLeave(
      'leave-1',
      // Cast simulates a caller that tries to smuggle a status field in the
      // body; the decision DTO has no such field so it is dropped before
      // reaching the controller in real requests.
      { reviewNote: 'Insufficient leave balance', status: 'APPROVED' } as never,
      actor,
    );

    expect(service.reviewLeaveRequest).toHaveBeenCalledWith(
      'leave-1',
      { reviewNote: 'Insufficient leave balance', status: 'REJECTED' },
      actor,
    );
    expect(result).toEqual({ status: 'REJECTED' });
  });

  it('keeps the generic review endpoint requiring an explicit status', () => {
    const { controller, service } = createController();
    const dto = {
      status: 'REJECTED' as const,
      reviewNote: 'Duplicate request',
    };
    service.reviewLeaveRequest.mockReturnValue({ status: 'REJECTED' });

    const result = controller.reviewLeaveRequest('leave-1', dto, actor);

    expect(service.reviewLeaveRequest).toHaveBeenCalledWith(
      'leave-1',
      dto,
      actor,
    );
    expect(result).toEqual({ status: 'REJECTED' });
  });
});
