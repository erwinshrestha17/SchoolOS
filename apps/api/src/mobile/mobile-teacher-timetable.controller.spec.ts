import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { TimetableService } from '../timetable/timetable.service';
import { MobileTeacherTimetableController } from './mobile-teacher-timetable.controller';

describe('MobileTeacherTimetableController', () => {
  let timetableService: jest.Mocked<
    Pick<TimetableService, 'getTeacherMobileTimetable'>
  >;
  let controller: MobileTeacherTimetableController;
  let actor: AuthContext;

  beforeEach(() => {
    timetableService = {
      getTeacherMobileTimetable: jest.fn(),
    };
    controller = new MobileTeacherTimetableController(
      timetableService as unknown as TimetableService,
    );
    actor = {
      userId: 'teacher-user-1',
      tenantId: 'tenant-1',
      tenantSlug: 'school',
      email: 'teacher@school.test',
      authMethod: AuthMethod.PASSWORD,
      roles: ['teacher'],
      permissions: ['timetable:read'],
    };
  });

  it('delegates timetable reads to the teacher-scoped mobile service', async () => {
    const query = { weekStart: '2026-06-21', days: 7 };
    timetableService.getTeacherMobileTimetable.mockResolvedValue({
      range: {
        startsOn: new Date('2026-06-21T00:00:00.000Z'),
        endsOn: new Date('2026-06-27T00:00:00.000Z'),
      },
      items: [{ id: 'slot-1' }],
      substitutions: [{ id: 'sub-1' }],
    } as never);

    await expect(controller.getTimetable(actor, query)).resolves.toEqual({
      range: {
        startsOn: new Date('2026-06-21T00:00:00.000Z'),
        endsOn: new Date('2026-06-27T00:00:00.000Z'),
      },
      items: [{ id: 'slot-1' }],
      substitutions: [{ id: 'sub-1' }],
    });
    expect(timetableService.getTeacherMobileTimetable).toHaveBeenCalledWith(
      actor,
      query,
    );
  });
});
