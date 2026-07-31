import {
  P0_01_CAPABILITY_CONTRACT,
  P0_01_REQUIRED_CAPABILITY_NAMES,
} from './p0-01-capability-contract';
import { TeacherCapability } from './teacher-capability';

describe('P0-01 capability contract', () => {
  it('maps every required capability name', () => {
    expect(Object.keys(P0_01_CAPABILITY_CONTRACT).sort()).toEqual(
      expect.arrayContaining([...P0_01_REQUIRED_CAPABILITY_NAMES].sort()),
    );
  });

  it('resolves teacher aliases to persisted TeacherCapability values', () => {
    const aliases = [
      'HOMEROOM_ATTENDANCE_MARK',
      'PERIOD_ATTENDANCE_MARK',
      'SUBJECT_HOMEWORK_WRITE',
      'SUBJECT_MARKS_WRITE',
      'CLASS_ACADEMIC_OVERVIEW',
      'CLASS_TEACHER_REMARK_WRITE',
      'RESULT_REVIEW',
    ] as const;

    for (const name of aliases) {
      const entry = P0_01_CAPABILITY_CONTRACT[name];
      expect(entry.kind).toBe('teacher_capability');
      if (entry.kind === 'teacher_capability') {
        expect(Object.values(TeacherCapability)).toContain(entry.capability);
      }
    }
  });
});
