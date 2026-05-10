import { GradeCalculatorService } from '../apps/api/src/academics/grade-calculator.service';
import { MarkEntryStatus } from '@prisma/client';

const service = new GradeCalculatorService();

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    console.log(e);
  }
}

test('Standard grades', () => {
  const cases = [
    [90, 'A+', 4.0, 'PASS'],
    [80, 'A', 3.6, 'PASS'],
    [70, 'B+', 3.2, 'PASS'],
    [60, 'B', 2.8, 'PASS'],
    [50, 'C+', 2.4, 'PASS'],
    [40, 'C', 2.0, 'PASS'],
    [35, 'D', 1.6, 'PASS'],
    [34.99, 'NG', 0, 'FAIL'],
  ] as const;

  for (const [percentage, grade, gpa, status] of cases) {
    const result = service.getMoestGrade(percentage);
    if (result.grade !== grade || result.gpa !== gpa || result.status !== status) {
      throw new Error(`Failed for ${percentage}: expected ${grade}/${gpa}/${status}, got ${result.grade}/${result.gpa}/${result.status}`);
    }
  }
});

test('Weighted subject', () => {
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

    if (result.percentage !== 86 || result.grade !== 'A' || result.gpa !== 3.6 || result.status !== 'PASS') {
        throw new Error(`Weighted failed: ${JSON.stringify(result)}`);
    }
});

test('Component failure', () => {
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

    if (result.status !== 'FAIL' || result.grade !== 'NG' || result.gpa !== 0 || result.failedComponentCount !== 1) {
        throw new Error(`Component failure failed: ${JSON.stringify(result)}`);
    }
});

test('Incomplete', () => {
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

    if (result.status !== 'INCOMPLETE' || result.missingComponentCount !== 1 || result.weightUsed !== 60 || result.percentage !== 75) {
        throw new Error(`Incomplete failed: ${JSON.stringify(result)}`);
    }
});
