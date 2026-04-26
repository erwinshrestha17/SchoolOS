import { calculateMoestGrade } from './academics.service';

describe('calculateMoestGrade', () => {
  it('maps Nepal-ready grading bands for report cards', () => {
    expect(calculateMoestGrade(94)).toEqual({ grade: 'A+', gpa: 4 });
    expect(calculateMoestGrade(82)).toEqual({ grade: 'A', gpa: 3.6 });
    expect(calculateMoestGrade(72)).toEqual({ grade: 'B+', gpa: 3.2 });
    expect(calculateMoestGrade(63)).toEqual({ grade: 'B', gpa: 2.8 });
    expect(calculateMoestGrade(52)).toEqual({ grade: 'C+', gpa: 2.4 });
    expect(calculateMoestGrade(42)).toEqual({ grade: 'C', gpa: 2 });
    expect(calculateMoestGrade(36)).toEqual({ grade: 'D', gpa: 1.6 });
    expect(calculateMoestGrade(32)).toEqual({ grade: 'NG', gpa: 0 });
  });
});
