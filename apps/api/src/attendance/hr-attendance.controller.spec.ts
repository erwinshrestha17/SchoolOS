import type { AuthContext } from '../auth/auth.types';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { HrAttendanceController } from './hr-attendance.controller';
import { ListStaffAttendanceRosterDto } from './dto/list-staff-attendance-roster.dto';

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
    listStaffAttendanceRoster: jest.fn(),
    reviewLeaveRequest: jest.fn(),
  };

  return {
    controller: new HrAttendanceController(service as never),
    service,
  };
}

describe('HrAttendanceController leave decision routes', () => {
  it('delegates the paginated attendance roster behind the HR attendance write permission', () => {
    const { controller, service } = createController();
    const query = { page: 2, limit: 25 };
    service.listStaffAttendanceRoster.mockReturnValue({ items: [], total: 0 });

    expect(controller.listStaffAttendanceRoster(query, actor)).toEqual({
      items: [],
      total: 0,
    });
    expect(service.listStaffAttendanceRoster).toHaveBeenCalledWith(
      query,
      actor,
    );
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        HrAttendanceController.prototype.listStaffAttendanceRoster,
      ),
    ).toEqual(['hr:attendance:write']);
  });

  it('validates and caps staff attendance roster pagination', async () => {
    const valid = plainToInstance(ListStaffAttendanceRosterDto, {
      page: '2',
      limit: '100',
    });
    expect(await validate(valid)).toHaveLength(0);
    expect(valid).toEqual(expect.objectContaining({ page: 2, limit: 100 }));

    const invalid = plainToInstance(ListStaffAttendanceRosterDto, {
      page: 0,
      limit: 101,
    });
    expect(await validate(invalid)).not.toHaveLength(0);
  });

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
