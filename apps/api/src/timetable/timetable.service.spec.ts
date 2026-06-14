import { ConflictException } from '@nestjs/common';
import { TimetableVersionStatus } from '@prisma/client';
import {
  minutesBetween,
  TimetableService,
  timesOverlap,
} from './timetable.service';

describe('timesOverlap', () => {
  it('detects overlapping class and teacher timetable slots', () => {
    expect(timesOverlap('09:00', '09:45', '09:30', '10:15')).toBe(true);
    expect(timesOverlap('09:00', '09:45', '09:45', '10:30')).toBe(false);
    expect(timesOverlap('10:00', '10:45', '09:00', '10:00')).toBe(false);
    expect(timesOverlap('10:00', '10:45', '09:30', '10:15')).toBe(true);
  });

  it('calculates weekly workload minutes from HH:mm slot strings', () => {
    expect(minutesBetween('09:00', '09:45')).toBe(45);
    expect(minutesBetween('10:15', '11:30')).toBe(75);
    expect(minutesBetween('11:30', '10:15')).toBe(0);
  });
});

describe('TimetableService lifecycle behavior', () => {
  it('blocks archiving locked timetable versions through the service path', async () => {
    const prisma = {
      timetableVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'version-locked',
          tenantId: 'tenant-1',
          status: TimetableVersionStatus.LOCKED,
          slots: [],
        }),
        update: jest.fn(),
      },
    };
    const lifecycleService = {
      assertCanArchive: jest.fn(() => {
        throw new ConflictException(
          'Locked timetable versions cannot be archived without an explicit elevated workflow',
        );
      }),
    };
    const service = new TimetableService(
      prisma as never,
      {} as never,
      { record: jest.fn() } as never,
      lifecycleService as never,
      {} as never,
    );

    await expect(
      service.archiveVersion('version-locked', {
        tenantId: 'tenant-1',
        userId: 'admin-1',
      } as never),
    ).rejects.toThrow(
      'Locked timetable versions cannot be archived without an explicit elevated workflow',
    );

    expect(lifecycleService.assertCanArchive).toHaveBeenCalledWith(
      TimetableVersionStatus.LOCKED,
    );
    expect(prisma.timetableVersion.update).not.toHaveBeenCalled();
  });
});
