import { MarkEntryStatus } from '@prisma/client';
import {
  GradeCalculatorService,
  type SubjectGradeResult,
} from './grade-calculator.service';

describe('GradeCalculatorService', () => {
  let service: GradeCalculatorService;

  beforeEach(() => {
    service = new GradeCalculatorService();
  });

  describe('Grading Scale', () => {
    it.each([
      [95, 'A+', 4.0, 'PASS'],
      [85, 'A', 3.6, 'PASS'],
      [75, 'B+', 3.2, 'PASS'],
      [65, 'B', 2.8, 'PASS'],
      [55, 'C+', 2.4, 'PASS'],
      [45, 'C', 2.0, 'PASS'],
      [37, 'D', 1.6, 'PASS'],
      [20, 'NG', 0, 'FAIL'],
    ] as const)(
      'maps %s percent to %s / %s GPA / %s',
      (percentage, expectedGrade, expectedGpa, expectedStatus) => {
        const result = service.getMoestGrade(percentage);

        expect(result.grade).toBe(expectedGrade);
        expect(result.gpa).toBe(expectedGpa);
        expect(result.status).toBe(expectedStatus);
      },
    );

    it('returns the full grading scale for endpoint display', async () => {
      const scale = await service.getGradingScale('tenant-1');
      expect(scale).toHaveLength(8);
      expect(scale[0].grade).toBe('A+');
      expect(scale[7].grade).toBe('NG');
    });
  });

  describe('Subject Calculation', () => {
    it('calculates weighted subject percentage and results', () => {
      const result = service.calculateWeightedSubjectGrade({
        subjectId: 'math',
        subjectName: 'Mathematics',
        subjectCode: 'MAT101',
        components: [
          {
            componentId: 'c1',
            componentName: 'Theory',
            subjectId: 'math',
            maxMarks: 100,
            marksObtained: 80,
            passMarks: 35,
            weightPercent: 75,
          },
          {
            componentId: 'c2',
            componentName: 'Practical',
            subjectId: 'math',
            maxMarks: 25,
            marksObtained: 20,
            passMarks: 10,
            weightPercent: 25,
          },
        ],
      });

      expect(result.percentage).toBe(80);
      expect(result.grade).toBe('A');
      expect(result.status).toBe('PASS');
      expect(result.obtainedMarks).toBe(100);
      expect(result.fullMarks).toBe(125);
    });

    it('returns NG when a component fails pass marks', () => {
      const result = service.calculateWeightedSubjectGrade({
        subjectId: 'sci',
        components: [
          {
            componentId: 'theory',
            subjectId: 'sci',
            maxMarks: 100,
            marksObtained: 80,
            passMarks: 35,
            weightPercent: 70,
          },
          {
            componentId: 'prac',
            subjectId: 'sci',
            maxMarks: 25,
            marksObtained: 5,
            passMarks: 10,
            weightPercent: 30,
          },
        ],
      });

      expect(result.status).toBe('FAIL');
      expect(result.grade).toBe('NG');
      expect(result.failedComponentCount).toBe(1);
    });

    it('marks as WITHHELD if a required component is withheld', () => {
      const result = service.calculateWeightedSubjectGrade({
        subjectId: 'eng',
        components: [
          {
            componentId: 'exam',
            subjectId: 'eng',
            maxMarks: 100,
            marksObtained: null,
            status: MarkEntryStatus.WITHHELD,
            weightPercent: 100,
          },
        ],
      });

      expect(result.status).toBe('WITHHELD');
      expect(result.withheldComponentCount).toBe(1);
    });

    it('marks as INCOMPLETE if a required component is missing', () => {
      const result = service.calculateWeightedSubjectGrade({
        subjectId: 'eng',
        components: [
          {
            componentId: 'exam',
            subjectId: 'eng',
            maxMarks: 100,
            marksObtained: null,
            isMissing: true,
            weightPercent: 100,
          },
        ],
      });

      expect(result.status).toBe('INCOMPLETE');
      expect(result.missingComponentCount).toBe(1);
    });

    it('marks draft autosaved components as incomplete until submitted', () => {
      const result = service.calculateWeightedSubjectGrade({
        subjectId: 'math',
        components: [
          {
            componentId: 'draft-theory',
            subjectId: 'math',
            maxMarks: 100,
            marksObtained: 82,
            passMarks: 35,
            status: 'DRAFT' as MarkEntryStatus,
            weightPercent: 100,
          },
        ],
      });

      expect(result.status).toBe('INCOMPLETE');
      expect(result.missingComponentCount).toBe(1);
    });

    it('returns RETEST component result when status is RETEST and utilizes marksObtained', () => {
      const result = service.calculateWeightedSubjectGrade({
        subjectId: 'eng',
        components: [
          {
            componentId: 'exam',
            subjectId: 'eng',
            maxMarks: 100,
            marksObtained: 45,
            passMarks: 35,
            status: MarkEntryStatus.RETEST,
            weightPercent: 100,
          },
        ],
      });

      expect(result.status).toBe('PASS');
      expect(result.components[0].isRetest).toBe(true);
      expect(result.components[0].obtainedMarks).toBe(45);
    });
  });

  describe('Overall Calculation', () => {
    it('calculates weighted overall GPA correctly', () => {
      const s1 = {
        percentage: 90,
        gpa: 4.0,
        fullMarks: 100,
        status: 'PASS',
        obtainedMarks: 90,
      } as unknown as SubjectGradeResult;
      const s2 = {
        percentage: 80,
        gpa: 3.6,
        fullMarks: 50,
        status: 'PASS',
        obtainedMarks: 40,
      } as unknown as SubjectGradeResult;

      const result = service.calculateOverallGpa([s1, s2]);

      expect(result.percentage).toBe(85);
      expect(result.gpa).toBe(3.87);
      expect(result.resultStatus).toBe('PASS');
    });

    it('fails overall if any required subject fails', () => {
      const s1 = {
        percentage: 90,
        gpa: 4.0,
        fullMarks: 100,
        status: 'PASS',
        obtainedMarks: 90,
      } as unknown as SubjectGradeResult;
      const s2 = {
        percentage: 20,
        gpa: 0,
        fullMarks: 100,
        status: 'FAIL',
        obtainedMarks: 20,
      } as unknown as SubjectGradeResult;

      const result = service.calculateOverallGpa([s1, s2]);

      expect(result.resultStatus).toBe('FAIL');
      expect(result.gpa).toBe(0);
    });
  });

  describe('CAS Summary', () => {
    it('summarizes CAS records per subject', () => {
      const records = [
        {
          subjectId: 'math',
          subjectName: 'Math',
          category: 'Homework',
          score: 8,
          maxScore: 10,
        },
        {
          subjectId: 'math',
          subjectName: 'Math',
          category: 'Classwork',
          score: 9,
          maxScore: 10,
        },
        {
          subjectId: null,
          subjectName: 'General',
          category: 'Conduct',
          score: 5,
          maxScore: 5,
        },
      ];

      const summary = service.summarizeCasRecords(records);

      expect(summary).toHaveLength(2);
      const math = summary.find((s) => s.subjectId === 'math');
      if (math) {
        expect(math.totalScore).toBe(17);
        expect(math.totalMaxScore).toBe(20);
        expect(math.percentage).toBe(85);
        expect(math.categories).toContain('Homework');
        expect(math.categories).toContain('Classwork');
      } else {
        throw new Error('Math summary not found');
      }
    });
  });
});
