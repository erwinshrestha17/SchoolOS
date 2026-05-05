import { ConflictException } from '@nestjs/common';
import { GradeCalculatorService } from './grade-calculator.service';

describe('GradeCalculatorService', () => {
  let service: GradeCalculatorService;

  beforeEach(() => {
    service = new GradeCalculatorService();
  });

  it.each([
    [90, 'A+', 4.0, 'PASS'],
    [80, 'A', 3.6, 'PASS'],
    [70, 'B+', 3.2, 'PASS'],
    [60, 'B', 2.8, 'PASS'],
    [50, 'C+', 2.4, 'PASS'],
    [40, 'C', 2.0, 'PASS'],
    [35, 'D', 1.6, 'PASS'],
    [34.99, 'NG', 0, 'FAIL'],
  ] as const)(
    'maps %s percent to %s / %s GPA / %s',
    (percentage, expectedGrade, expectedGpa, expectedStatus) => {
      const result = service.getMoestGrade(percentage);

      expect(result.grade).toBe(expectedGrade);
      expect(result.gpa).toBe(expectedGpa);
      expect(result.status).toBe(expectedStatus);
    },
  );

  it('calculates weighted component subject percentage deterministically', () => {
    const result = service.calculateWeightedSubjectGrade({
      subjectId: 'math',
      components: [
        {
          componentId: 'theory',
          subjectId: 'math',
          maxMarks: 100,
          marksObtained: 90,
          passMarks: 35,
          weightPercent: 60,
        },
        {
          componentId: 'practical',
          subjectId: 'math',
          maxMarks: 50,
          marksObtained: 40,
          passMarks: 20,
          weightPercent: 40,
        },
      ],
    });

    expect(result.percentage).toBe(86);
    expect(result.grade).toBe('A');
    expect(result.gpa).toBe(3.6);
    expect(result.status).toBe('PASS');
    expect(result.weightUsed).toBe(100);
  });

  it('returns NG when a component fails its pass marks even if weighted percentage is high', () => {
    const result = service.calculateWeightedSubjectGrade({
      subjectId: 'science',
      components: [
        {
          componentId: 'theory',
          subjectId: 'science',
          maxMarks: 100,
          marksObtained: 88,
          passMarks: 35,
          weightPercent: 70,
        },
        {
          componentId: 'practical',
          subjectId: 'science',
          maxMarks: 25,
          marksObtained: 7,
          passMarks: 10,
          weightPercent: 30,
        },
      ],
    });

    expect(result.status).toBe('FAIL');
    expect(result.grade).toBe('NG');
    expect(result.gpa).toBe(0);
    expect(result.failedComponentCount).toBe(1);
  });

  it('marks missing components as incomplete without treating them as zero', () => {
    const result = service.calculateWeightedSubjectGrade({
      subjectId: 'english',
      components: [
        {
          componentId: 'terminal',
          subjectId: 'english',
          maxMarks: 100,
          marksObtained: 75,
          passMarks: 35,
          weightPercent: 60,
        },
        {
          componentId: 'project',
          subjectId: 'english',
          maxMarks: 20,
          marksObtained: null,
          passMarks: 8,
          weightPercent: 40,
          isMissing: true,
        },
      ],
    });

    expect(result.status).toBe('INCOMPLETE');
    expect(result.missingComponentCount).toBe(1);
    expect(result.weightUsed).toBe(60);
    expect(result.percentage).toBe(75);
  });

  it('treats absent marks explicitly as zero', () => {
    const result = service.calculateWeightedSubjectGrade({
      subjectId: 'nepali',
      components: [
        {
          componentId: 'terminal',
          subjectId: 'nepali',
          maxMarks: 100,
          marksObtained: null,
          passMarks: 35,
          weightPercent: 100,
          isAbsent: true,
        },
      ],
    });

    expect(result.status).toBe('FAIL');
    expect(result.grade).toBe('NG');
    expect(result.percentage).toBe(0);
  });

  it('rejects component weights above 100 percent', () => {
    expect(() =>
      service.calculateWeightedSubjectGrade({
        subjectId: 'social',
        components: [
          {
            componentId: 'terminal',
            subjectId: 'social',
            maxMarks: 100,
            marksObtained: 70,
            passMarks: 35,
            weightPercent: 80,
          },
          {
            componentId: 'project',
            subjectId: 'social',
            maxMarks: 20,
            marksObtained: 18,
            passMarks: 8,
            weightPercent: 30,
          },
        ],
      }),
    ).toThrow(ConflictException);
  });

  it('calculates overall GPA only when all subjects pass', () => {
    const math = service.calculateWeightedSubjectGrade({
      subjectId: 'math',
      components: [
        {
          componentId: 'math-terminal',
          subjectId: 'math',
          maxMarks: 100,
          marksObtained: 90,
          passMarks: 35,
          weightPercent: 100,
        },
      ],
    });
    const english = service.calculateWeightedSubjectGrade({
      subjectId: 'english',
      components: [
        {
          componentId: 'english-terminal',
          subjectId: 'english',
          maxMarks: 100,
          marksObtained: 80,
          passMarks: 35,
          weightPercent: 100,
        },
      ],
    });

    const result = service.calculateOverallGpa([math, english]);

    expect(result.percentage).toBe(85);
    expect(result.gpa).toBe(3.8);
    expect(result.grade).toBe('A');
    expect(result.status).toBe('PASS');
  });
});
