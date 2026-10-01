import { TimetableVersionStatus } from '@prisma/client';
import {
  liveTimetableSlotWhere,
  liveTimetableVersionWhere,
  toTimetableDayOfWeek,
} from './timetable-calendar';
import { findCrossVersionClashes } from './timetable.service';

describe('Phase 6.1 timetable calendar helpers', () => {
  describe('toTimetableDayOfWeek uses the Nepal school day', () => {
    it('returns Friday at 01:45 NPT even though UTC is still Thursday', () => {
      // 2026-10-01T20:00Z = 2026-10-02 01:45 Asia/Kathmandu (Friday).
      expect(toTimetableDayOfWeek(new Date('2026-10-01T20:00:00.000Z'))).toBe(
        5,
      );
    });

    it('maps Sunday to 7 and keeps date-only inputs on their calendar day', () => {
      expect(toTimetableDayOfWeek(new Date('2026-10-04T00:00:00.000Z'))).toBe(
        7,
      );
      expect(toTimetableDayOfWeek(new Date('2026-10-05'))).toBe(1);
    });
  });

  describe('liveTimetableSlotWhere', () => {
    const where = liveTimetableSlotWhere(new Date('2026-10-01T20:00:00.000Z'));
    const day = new Date('2026-10-02T00:00:00.000Z');

    it('bounds every slot by its academic year on the Nepal school day', () => {
      expect(where.academicYear).toEqual({
        startsOn: { lte: day },
        endsOn: { gte: day },
      });
    });

    it('only admits published/locked versions in force that day', () => {
      expect(where.OR).toEqual([
        { versionId: null },
        {
          version: {
            status: {
              in: [
                TimetableVersionStatus.PUBLISHED,
                TimetableVersionStatus.LOCKED,
              ],
            },
            effectiveFrom: { lte: day },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }],
          },
        },
      ]);
    });

    it('version filter excludes drafts, future versions and other years', () => {
      const versionWhere = liveTimetableVersionWhere(
        new Date('2026-10-01T20:00:00.000Z'),
      );
      expect(versionWhere.status).toEqual({
        in: [TimetableVersionStatus.PUBLISHED, TimetableVersionStatus.LOCKED],
      });
      expect(versionWhere.effectiveFrom).toEqual({ lte: day });
      expect(versionWhere.AND).toEqual([
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: day } }] },
        { academicYear: { startsOn: { lte: day }, endsOn: { gte: day } } },
      ]);
    });
  });
});

describe('findCrossVersionClashes', () => {
  const window = {
    effectiveFrom: new Date('2026-01-01'),
    effectiveTo: null,
  };
  const slot = {
    id: 'mine',
    staffId: 'teacher-1',
    roomId: 'room-1',
    dayOfWeek: 1,
    startsAt: '08:00',
    endsAt: '08:45',
  };
  const other = (
    overrides: Partial<typeof slot> & {
      version?: { id: string; effectiveFrom: Date; effectiveTo: Date | null };
    },
  ) => ({
    ...slot,
    id: 'theirs',
    staffId: 'teacher-2',
    roomId: 'room-2',
    version: { id: 'v-other', ...window },
    ...overrides,
  });

  it('reports a teacher booked in an overlapping period of another published version', () => {
    expect(
      findCrossVersionClashes(
        window,
        [slot],
        [other({ staffId: 'teacher-1', startsAt: '08:30', endsAt: '09:15' })],
      ),
    ).toEqual([
      {
        kind: 'TEACHER',
        slotId: 'mine',
        conflictingSlotId: 'theirs',
        conflictingVersionId: 'v-other',
        dayOfWeek: 1,
      },
    ]);
  });

  it('reports a shared room', () => {
    expect(
      findCrossVersionClashes(window, [slot], [other({ roomId: 'room-1' })]),
    ).toEqual([expect.objectContaining({ kind: 'ROOM' })]);
  });

  it('ignores back-to-back periods, other days and non-overlapping effective windows', () => {
    expect(
      findCrossVersionClashes(
        window,
        [slot],
        [
          other({ staffId: 'teacher-1', startsAt: '08:45', endsAt: '09:30' }),
          other({ staffId: 'teacher-1', dayOfWeek: 2 }),
          other({
            staffId: 'teacher-1',
            version: {
              id: 'v-old',
              effectiveFrom: new Date('2025-01-01'),
              effectiveTo: new Date('2025-12-31'),
            },
          }),
        ],
      ),
    ).toEqual([]);
  });
});
