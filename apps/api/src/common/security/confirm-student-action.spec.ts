import { BadRequestException } from '@nestjs/common';
import {
  assertConfirmStudentId,
  GUARDIAN_CHILD_CONFIRMATION_MISMATCH_CODE,
} from './confirm-student-action';

describe('assertConfirmStudentId', () => {
  it('accepts a matching confirmation id', () => {
    expect(() =>
      assertConfirmStudentId('student-1', 'student-1'),
    ).not.toThrow();
  });

  it('rejects missing confirmation id', () => {
    try {
      assertConfirmStudentId('student-1', undefined);
      fail('expected BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: GUARDIAN_CHILD_CONFIRMATION_MISMATCH_CODE,
      });
    }
  });

  it('rejects mismatched confirmation id', () => {
    try {
      assertConfirmStudentId('student-1', 'student-2');
      fail('expected BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: GUARDIAN_CHILD_CONFIRMATION_MISMATCH_CODE,
        expectedStudentId: 'student-1',
      });
    }
  });
});
