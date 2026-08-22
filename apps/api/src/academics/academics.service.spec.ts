import type { AuthContext } from '../auth/auth.types';
import { AcademicsService } from './academics.service';
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

describe('AcademicsService report-card projection', () => {
  it('returns report-card rows with only narrow student identity fields', async () => {
    const student = {
      id: 'student-1',
      firstNameEn: 'Asha',
      lastNameEn: 'Tamang',
      studentSystemId: 'STD-001',
    };
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'report-card-1',
        student,
      },
    ]);
    const service = new AcademicsService(
      { reportCard: { findMany } } as never,
      {} as never,
      {} as never,
      {} as never,
      new GradeCalculatorService(),
      {} as never,
    );
    const actor = { tenantId: 'tenant-1' } as AuthContext;

    const result = await service.listReportCards(actor);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          student: {
            select: {
              id: true,
              firstNameEn: true,
              lastNameEn: true,
              studentSystemId: true,
            },
          },
        }),
      }),
    );
    expect(result[0]?.student).toEqual(student);
  });

  it('removes history and correction workflow rows from support report cards', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new AcademicsService(
      { reportCard: { findMany } } as never,
      {} as never,
      {} as never,
      {} as never,
      new GradeCalculatorService(),
      {} as never,
    );
    const actor = {
      tenantId: 'tenant-1',
      isSupportOverride: true,
    } as AuthContext;

    await service.listReportCards(actor);

    const args = findMany.mock.calls[0]?.[0];
    expect(args.select).toEqual(
      expect.objectContaining({
        id: true,
        totalMarks: true,
        student: {
          select: {
            id: true,
            firstNameEn: true,
            lastNameEn: true,
            studentSystemId: true,
          },
        },
      }),
    );
    expect(args.select).not.toHaveProperty('history');
    expect(args.select).not.toHaveProperty('correctionRequests');
    expect(args).not.toHaveProperty('include');
  });
});
