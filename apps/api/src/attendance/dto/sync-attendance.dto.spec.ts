import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SyncAttendanceDto } from './sync-attendance.dto';

const basePayload = {
  academicYearId: 'ay-1',
  classId: 'class-1',
  attendanceDate: '2026-04-28',
  clientSubmissionId: 'submission-1',
  deviceTimestamp: '2026-04-28T08:00:00.000Z',
};

describe('SyncAttendanceDto roster precondition', () => {
  it('temporarily accepts an omitted roster version for wire compatibility', async () => {
    const dto = plainToInstance(SyncAttendanceDto, basePayload);

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts exactly 64 lowercase hexadecimal characters', async () => {
    const dto = plainToInstance(SyncAttendanceDto, {
      ...basePayload,
      expectedRosterVersion: 'a'.repeat(64),
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), 'g'.repeat(64)])(
    'rejects malformed roster version %s',
    async (expectedRosterVersion) => {
      const dto = plainToInstance(SyncAttendanceDto, {
        ...basePayload,
        expectedRosterVersion,
      });

      const errors = await validate(dto);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'expectedRosterVersion' }),
        ]),
      );
    },
  );
});
