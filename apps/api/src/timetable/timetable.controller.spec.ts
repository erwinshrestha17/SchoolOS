import type { AuthContext } from '../auth/auth.types';
import { TimetableController } from './timetable.controller';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'principal@school.test',
  roles: ['principal'],
  permissions: [],
  authMethod: 'PASSWORD',
};

function createController() {
  const timetableService = {
    listTimetable: jest.fn(),
    createTimetableSlot: jest.fn(),
    listPeriods: jest.fn(),
    createPeriod: jest.fn(),
    updatePeriod: jest.fn(),
    deletePeriod: jest.fn(),
    listRooms: jest.fn(),
    createRoom: jest.fn(),
    updateRoom: jest.fn(),
    deleteRoom: jest.fn(),
    listVersions: jest.fn(),
    createVersion: jest.fn(),
    getVersion: jest.fn(),
    createVersionSlot: jest.fn(),
    validateVersion: jest.fn(),
    publishVersion: jest.fn(),
    lockVersion: jest.fn(),
    archiveVersion: jest.fn(),
    reopenVersion: jest.fn(),
    updateSlot: jest.fn(),
    deleteSlot: jest.fn(),
    listTeacherAvailability: jest.fn(),
    createTeacherAvailability: jest.fn(),
    updateTeacherAvailability: jest.fn(),
    deleteTeacherAvailability: jest.fn(),
    getTeacherWorkload: jest.fn(),
    listTeacherWorkload: jest.fn(),
    listSubstitutions: jest.fn(),
    createSubstitution: jest.fn(),
    updateSubstitution: jest.fn(),
    assignSubstitution: jest.fn(),
    cancelSubstitution: jest.fn(),
    completeSubstitution: jest.fn(),
  };

  return {
    controller: new TimetableController(timetableService as never),
    timetableService,
  };
}

describe('TimetableController M6 contracts', () => {
  it('delegates period setup and validates through service layer', () => {
    const { controller, timetableService } = createController();
    const dto = {
      academicYearId: 'year-1',
      name: 'Period 1',
      dayOfWeek: 1,
      startsAt: '09:00',
      endsAt: '09:45',
      sortOrder: 1,
    };
    timetableService.createPeriod.mockReturnValue({ id: 'period-1' });
    timetableService.updatePeriod.mockReturnValue({ id: 'period-1' });

    expect(controller.createPeriod(dto as never, actor)).toEqual({
      id: 'period-1',
    });
    expect(controller.updatePeriod('period-1', dto as never, actor)).toEqual({
      id: 'period-1',
    });
    expect(timetableService.createPeriod).toHaveBeenCalledWith(dto, actor);
    expect(timetableService.updatePeriod).toHaveBeenCalledWith(
      'period-1',
      dto,
      actor,
    );
  });

  it('delegates room setup through service boundary', () => {
    const { controller, timetableService } = createController();
    const dto = { name: 'Science Lab', code: 'SCI-LAB', capacity: 32 };
    timetableService.createRoom.mockReturnValue({ id: 'room-1' });
    timetableService.updateRoom.mockReturnValue({ id: 'room-1' });

    expect(controller.createRoom(dto, actor)).toEqual({ id: 'room-1' });
    expect(controller.updateRoom('room-1', dto, actor)).toEqual({
      id: 'room-1',
    });
    expect(timetableService.createRoom).toHaveBeenCalledWith(dto, actor);
    expect(timetableService.updateRoom).toHaveBeenCalledWith(
      'room-1',
      dto,
      actor,
    );
  });

  it('delegates timetable version lifecycle commands with current actor', () => {
    const { controller, timetableService } = createController();
    timetableService.publishVersion.mockReturnValue({ status: 'PUBLISHED' });
    timetableService.lockVersion.mockReturnValue({ status: 'LOCKED' });
    timetableService.archiveVersion.mockReturnValue({ status: 'ARCHIVED' });
    timetableService.reopenVersion.mockReturnValue({ status: 'DRAFT' });

    expect(controller.publishVersion('version-1', actor)).toEqual({
      status: 'PUBLISHED',
    });
    expect(controller.lockVersion('version-1', actor)).toEqual({
      status: 'LOCKED',
    });
    expect(controller.archiveVersion('version-1', actor)).toEqual({
      status: 'ARCHIVED',
    });
    expect(controller.reopenVersion('version-1', actor)).toEqual({
      status: 'DRAFT',
    });
    expect(timetableService.publishVersion).toHaveBeenCalledWith(
      'version-1',
      actor,
    );
    expect(timetableService.lockVersion).toHaveBeenCalledWith(
      'version-1',
      actor,
    );
    expect(timetableService.archiveVersion).toHaveBeenCalledWith(
      'version-1',
      actor,
    );
    expect(timetableService.reopenVersion).toHaveBeenCalledWith(
      'version-1',
      actor,
    );
  });

  it('delegates version validation and slot mutation through server-side conflict service', () => {
    const { controller, timetableService } = createController();
    const slotDto = {
      classId: 'class-1',
      subjectId: 'subject-1',
      staffId: 'staff-1',
      dayOfWeek: 1,
      startsAt: '09:00',
      endsAt: '09:45',
      roomId: 'room-1',
    };
    timetableService.validateVersion.mockReturnValue({
      valid: true,
      errors: [],
    });
    timetableService.createVersionSlot.mockReturnValue({ id: 'slot-1' });
    timetableService.updateSlot.mockReturnValue({ id: 'slot-1' });

    expect(controller.validateVersion('version-1', actor)).toEqual({
      valid: true,
      errors: [],
    });
    expect(
      controller.createVersionSlot('version-1', slotDto as never, actor),
    ).toEqual({ id: 'slot-1' });
    expect(controller.updateSlot('slot-1', slotDto as never, actor)).toEqual({
      id: 'slot-1',
    });
    expect(timetableService.validateVersion).toHaveBeenCalledWith(
      'version-1',
      actor,
    );
    expect(timetableService.createVersionSlot).toHaveBeenCalledWith(
      'version-1',
      slotDto,
      actor,
    );
    expect(timetableService.updateSlot).toHaveBeenCalledWith(
      'slot-1',
      slotDto,
      actor,
    );
  });

  it('delegates teacher availability and workload queries with current actor', () => {
    const { controller, timetableService } = createController();
    const availabilityDto = {
      dayOfWeek: 1,
      startsAt: '09:00',
      endsAt: '15:00',
      type: 'AVAILABLE',
    };
    const workloadQuery = { academicYearId: 'year-1', versionId: 'version-1' };
    timetableService.listTeacherAvailability.mockReturnValue({
      availability: [],
    });
    timetableService.createTeacherAvailability.mockReturnValue({
      availability: [],
    });
    timetableService.getTeacherWorkload.mockReturnValue({ weeklyPeriods: 20 });

    expect(controller.listTeacherAvailability('teacher-1', actor)).toEqual({
      availability: [],
    });
    expect(
      controller.upsertTeacherAvailability(
        'teacher-1',
        availabilityDto as never,
        actor,
      ),
    ).toEqual({ availability: [] });
    expect(
      controller.getTeacherWorkload('teacher-1', workloadQuery as never, actor),
    ).toEqual({ weeklyPeriods: 20 });
    expect(timetableService.listTeacherAvailability).toHaveBeenCalledWith(
      'teacher-1',
      actor,
    );
    expect(timetableService.createTeacherAvailability).toHaveBeenCalledWith(
      'teacher-1',
      availabilityDto,
      actor,
    );
    expect(timetableService.getTeacherWorkload).toHaveBeenCalledWith(
      'teacher-1',
      workloadQuery,
      actor,
    );
  });

  it('delegates substitution workflow and status transitions through service boundary', () => {
    const { controller, timetableService } = createController();
    const createDto = {
      timetableSlotId: 'slot-1',
      absentTeacherId: 'teacher-1',
      substituteTeacherId: 'teacher-2',
      date: '2026-05-09',
      reason: 'Absent on leave',
    };
    const assignDto = { substituteTeacherId: 'teacher-2' };
    timetableService.createSubstitution.mockReturnValue({ status: 'ASSIGNED' });
    timetableService.updateSubstitution.mockReturnValue({ status: 'DRAFT' });
    timetableService.assignSubstitution.mockReturnValue({ status: 'ASSIGNED' });
    timetableService.cancelSubstitution.mockReturnValue({
      status: 'CANCELLED',
    });
    timetableService.completeSubstitution.mockReturnValue({
      status: 'COMPLETED',
    });

    expect(controller.createSubstitution(createDto as never, actor)).toEqual({
      status: 'ASSIGNED',
    });
    expect(
      controller.updateSubstitution('sub-1', createDto as never, actor),
    ).toEqual({ status: 'DRAFT' });
    expect(controller.assignSubstitution('sub-1', assignDto, actor)).toEqual({
      status: 'ASSIGNED',
    });
    expect(controller.cancelSubstitution('sub-1', actor)).toEqual({
      status: 'CANCELLED',
    });
    expect(controller.completeSubstitution('sub-1', actor)).toEqual({
      status: 'COMPLETED',
    });
    expect(timetableService.createSubstitution).toHaveBeenCalledWith(
      createDto,
      actor,
    );
    expect(timetableService.updateSubstitution).toHaveBeenCalledWith(
      'sub-1',
      createDto,
      actor,
    );
    expect(timetableService.assignSubstitution).toHaveBeenCalledWith(
      'sub-1',
      assignDto,
      actor,
    );
    expect(timetableService.cancelSubstitution).toHaveBeenCalledWith(
      'sub-1',
      actor,
    );
    expect(timetableService.completeSubstitution).toHaveBeenCalledWith(
      'sub-1',
      actor,
    );
  });
});
