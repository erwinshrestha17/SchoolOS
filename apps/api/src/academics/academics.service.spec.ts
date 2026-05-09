import { GradeCalculatorService } from './grade-calculator.service';

describe('Academics Service Utilities (via GradeCalculator)', () => {
  let service: GradeCalculatorService;

  beforeEach(() => {
    service = new GradeCalculatorService();
  });

  it('maps Nepal-ready grading bands for report cards', () => {
    expect(service.getMoestGrade(94).grade).toEqual('A+');
    expect(service.getMoestGrade(94).gpa).toEqual(4);

    expect(service.getMoestGrade(82).grade).toEqual('A');
    expect(service.getMoestGrade(82).gpa).toEqual(3.6);

    expect(service.getMoestGrade(72).grade).toEqual('B+');
    expect(service.getMoestGrade(72).gpa).toEqual(3.2);

    expect(service.getMoestGrade(63).grade).toEqual('B');
    expect(service.getMoestGrade(63).gpa).toEqual(2.8);

    expect(service.getMoestGrade(52).grade).toEqual('C+');
    expect(service.getMoestGrade(52).gpa).toEqual(2.4);

    expect(service.getMoestGrade(42).grade).toEqual('C');
    expect(service.getMoestGrade(42).gpa).toEqual(2);

    expect(service.getMoestGrade(36).grade).toEqual('D');
    expect(service.getMoestGrade(36).gpa).toEqual(1.6);

    expect(service.getMoestGrade(32).grade).toEqual('NG');
    expect(service.getMoestGrade(32).gpa).toEqual(0);
  });

  it('requires academic review below the promotion threshold', () => {
    expect(service.getPromotionStatus(34.99)).toBe('REVIEW');
    expect(service.getPromotionStatus(35)).toBe('READY');
  });
});
