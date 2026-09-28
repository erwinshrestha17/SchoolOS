import { TeacherCapability as C } from '../../teacher-scope/teacher-capability';
import { teacherAuthorityWindow, teacherRecordDenial } from './teacher.policy';

describe('Teacher domain policy', () => {
  it('requires a current assignment even for an older record date', () => {
    expect(
      teacherAuthorityWindow(
        new Date('2026-09-27T12:00Z'),
        new Date('2026-04-01T12:00Z'),
      ),
    ).toEqual({
      effectiveFrom: { lte: new Date('2026-04-01T12:00Z') },
      OR: [
        { effectiveUntil: null },
        { effectiveUntil: { gt: new Date('2026-09-27T12:00Z') } },
      ],
    });
  });

  it.each([C.MARKS_ENTER, C.PERIOD_ATTENDANCE_MARK, C.SUBJECT_HOMEWORK_CREATE])(
    'requires an exact subject for %s',
    (capability) => {
      expect(teacherRecordDenial({ capability, staffId: 'staff' })).toBe(
        'missing_scope',
      );
    },
  );

  it('does not turn homeroom attendance into subject attendance', () => {
    expect(
      teacherRecordDenial({
        capability: C.HOMEROOM_ATTENDANCE_MARK,
        staffId: 'staff',
        subjectId: 'math',
      }),
    ).toBe('missing_scope');
  });

  it.each(['LOCKED', 'PUBLISHED', 'SUBMITTED'] as const)(
    'denies a stale write when the record is %s',
    (recordStatus) => {
      expect(
        teacherRecordDenial({
          capability: C.MARKS_ENTER,
          subjectId: 'math',
          staffId: 'staff',
          recordStatus,
        }),
      ).toBe('lifecycle');
    },
  );

  it('fails closed when cross-subject visibility has no authoritative lifecycle', () => {
    expect(
      teacherRecordDenial({
        capability: C.HOMEROOM_ACADEMIC_SUMMARY_READ,
        staffId: 'staff',
      }),
    ).toBe('lifecycle');
  });

  it('requires recorded authorship for an owned update', () => {
    expect(
      teacherRecordDenial({
        capability: C.SUBJECT_RECORD_WRITE,
        subjectId: 'math',
        staffId: 'staff',
        recordStatus: 'DRAFT',
      }),
    ).toBe('ownership');
  });

  it('keeps a locked owned record eligible for a correction request', () => {
    expect(
      teacherRecordDenial({
        capability: C.SUBJECT_CORRECTION_REQUEST,
        subjectId: 'math',
        staffId: 'staff',
        recordOwnerStaffId: 'staff',
        recordStatus: 'LOCKED',
      }),
    ).toBeNull();
  });
});
