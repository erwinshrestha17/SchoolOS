import { BadRequestException } from '@nestjs/common';
import {
  GUARDIAN_CHILD_CONFIRMATION_MISMATCH_CODE,
  assertConfirmStudentId,
  assertConfirmStudentIdAllowed,
} from './confirm-student-action';

describe('assertConfirmStudentId (P0-07)', () => {
  it('allows matching confirmation', () => {
    expect(() => assertConfirmStudentId('child-1', 'child-1')).not.toThrow();
  });

  it('rejects missing confirmation', () => {
    try {
      assertConfirmStudentId('child-1', undefined);
      fail('expected BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({
          code: GUARDIAN_CHILD_CONFIRMATION_MISMATCH_CODE,
        }),
      );
    }
  });

  it('rejects mismatched confirmation (stale child context)', () => {
    try {
      assertConfirmStudentId('child-1', 'child-2');
      fail('expected BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({
          code: GUARDIAN_CHILD_CONFIRMATION_MISMATCH_CODE,
          expectedStudentId: 'child-1',
        }),
      );
    }
  });
});

describe('assertConfirmStudentIdAllowed (P0-07)', () => {
  it('allows confirmation when the child is linked and authorized', () => {
    expect(() =>
      assertConfirmStudentIdAllowed('child-1', ['child-1', 'child-2']),
    ).not.toThrow();
  });

  it('rejects confirmation outside the authorized child set', () => {
    try {
      assertConfirmStudentIdAllowed('child-3', ['child-1', 'child-2']);
      fail('expected BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({
          code: GUARDIAN_CHILD_CONFIRMATION_MISMATCH_CODE,
          expectedStudentId: 'child-1',
        }),
      );
    }
  });
});
