import { StaffStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { AuthContext } from '../auth/auth.types';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { ListStaffOptionsDto } from './dto/list-staff-options.dto';
import { StaffController } from './staff.controller';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'hr@school.test',
  roles: ['admin'],
  permissions: [],
  authMethod: 'PASSWORD',
};

function createController() {
  const staffService = {
    listStaff: jest.fn(),
    listStaffDirectory: jest.fn(),
    listStaffOptions: jest.fn(),
    getStaffProfile: jest.fn(),
    getStaffDetail: jest.fn(),
    createStaff: jest.fn(),
    updateStaff: jest.fn(),
    transitionStaffStatus: jest.fn(),
  };

  return {
    controller: new StaffController(staffService as never),
    staffService,
  };
}

describe('StaffController M7 contracts', () => {
  it('delegates tenant-scoped staff option search behind staff:read', () => {
    const { controller, staffService } = createController();
    const query = { search: 'Sita', page: 1, limit: 25 };
    staffService.listStaffOptions.mockReturnValue({ items: [], total: 0 });

    expect(controller.listStaffOptions(query, actor)).toEqual({
      items: [],
      total: 0,
    });
    expect(staffService.listStaffOptions).toHaveBeenCalledWith(query, actor);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        StaffController.prototype.listStaffOptions,
      ),
    ).toEqual(['staff:read']);
  });

  it('requires a trimmed two-character search and caps staff option pages at 25', async () => {
    const shortSearch = plainToInstance(ListStaffOptionsDto, {
      search: ' x ',
      limit: 26,
    });
    const validSearch = plainToInstance(ListStaffOptionsDto, {
      search: ' Sita ',
      limit: 25,
    });

    expect(await validate(shortSearch)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'search' }),
        expect.objectContaining({ property: 'limit' }),
      ]),
    );
    expect(await validate(validSearch)).toHaveLength(0);
    expect(validSearch.search).toBe('Sita');
  });

  it('delegates staff list and self profile with current actor', () => {
    const { controller, staffService } = createController();
    staffService.listStaff.mockReturnValue([{ id: 'staff-1' }]);
    staffService.getStaffProfile.mockReturnValue({ id: 'staff-1' });

    expect(controller.listStaff(actor)).toEqual([{ id: 'staff-1' }]);
    expect(controller.getMe(actor)).toEqual({ id: 'staff-1' });
    expect(staffService.listStaff).toHaveBeenCalledWith(actor);
    expect(staffService.getStaffProfile).toHaveBeenCalledWith(actor);
  });

  it('delegates staff detail endpoint with tenant-scoped actor', () => {
    const { controller, staffService } = createController();
    staffService.getStaffDetail.mockReturnValue({ id: 'staff-1' });

    const result = controller.getStaffDetail('staff-1', actor);

    expect(staffService.getStaffDetail).toHaveBeenCalledWith('staff-1', actor);
    expect(result).toEqual({ id: 'staff-1' });
  });

  it('delegates staff create and update with current actor', () => {
    const { controller, staffService } = createController();
    const createDto = {
      firstName: 'Sita',
      lastName: 'Teacher',
      email: 'sita@school.test',
      password: 'Password123!',
      phone: '9800000000',
      dateOfBirth: '1990-01-01',
      gender: 'FEMALE',
      address: 'Butwal',
      joiningDate: '2026-05-09',
      contractType: 'FULL_TIME',
      roleIds: ['role-teacher'],
    };
    const updateDto = {
      department: 'Primary',
      designation: 'Class Teacher',
      panNumber: 'PAN-001',
      bankAccount: '00112233',
    };
    staffService.createStaff.mockReturnValue({ id: 'staff-1' });
    staffService.updateStaff.mockReturnValue({ id: 'staff-1' });

    expect(controller.createStaff(createDto as never, actor)).toEqual({
      id: 'staff-1',
    });
    expect(
      controller.updateStaff('staff-1', updateDto as never, actor),
    ).toEqual({ id: 'staff-1' });
    expect(staffService.createStaff).toHaveBeenCalledWith(createDto, actor);
    expect(staffService.updateStaff).toHaveBeenCalledWith(
      'staff-1',
      updateDto,
      actor,
    );
  });

  it('maps archive endpoint to INACTIVE lifecycle status', () => {
    const { controller, staffService } = createController();
    const dto = { status: StaffStatus.ACTIVE, reason: 'Contract ended' };
    staffService.transitionStaffStatus.mockReturnValue({
      status: StaffStatus.INACTIVE,
    });

    const result = controller.archiveStaff('staff-1', dto, actor);

    expect(staffService.transitionStaffStatus).toHaveBeenCalledWith(
      'staff-1',
      { status: StaffStatus.INACTIVE, reason: 'Contract ended' },
      actor,
    );
    expect(result).toEqual({ status: StaffStatus.INACTIVE });
  });

  it('maps terminate endpoint to TERMINATED lifecycle status', () => {
    const { controller, staffService } = createController();
    const dto = { status: StaffStatus.ACTIVE, reason: 'Policy violation' };
    staffService.transitionStaffStatus.mockReturnValue({
      status: StaffStatus.TERMINATED,
    });

    const result = controller.terminateStaff('staff-1', dto, actor);

    expect(staffService.transitionStaffStatus).toHaveBeenCalledWith(
      'staff-1',
      { status: StaffStatus.TERMINATED, reason: 'Policy violation' },
      actor,
    );
    expect(result).toEqual({ status: StaffStatus.TERMINATED });
  });
});
