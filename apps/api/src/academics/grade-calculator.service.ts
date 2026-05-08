import { ConflictException, Injectable } from '@nestjs/common';
import { MarkEntryStatus } from '@prisma/client';

export type MoestLetterGrade =
  | 'A+'
  | 'A'
  | 'B+'
  | 'B'
  | 'C+'
  | 'C'
  | 'D'
  | 'NG';

export type GradeStatus = 'PASS' | 'FAIL' | 'INCOMPLETE';

export interface MoestGradeResult {
  percentage: number;
  gpa: number;
  grade: MoestLetterGrade;
  description: string;
  status: GradeStatus;
  honorMention: boolean;
  remedialRequired: boolean;
}

export interface ComponentScoreInput {
  componentId: string;
  subjectId: string;
  maxMarks: number;
  marksObtained?: number | null;
  passMarks?: number | null;
  weightPercent: number;
  status?: MarkEntryStatus;
  isMissing?: boolean;
}

export interface SubjectGradeInput {
  subjectId: string;
  components: ComponentScoreInput[];
  includeIncomplete?: boolean;
}

export interface SubjectGradeResult extends MoestGradeResult {
  subjectId: string;
  weightedScore: number;
  weightUsed: number;
  componentCount: number;
  missingComponentCount: number;
  failedComponentCount: number;
}

const GRADE_SCALE: ReadonlyArray<{
  minInclusive: number;
  grade: MoestLetterGrade;
  gpa: number;
  description: string;
}> = [
  { minInclusive: 90, grade: 'A+', gpa: 4.0, description: 'Outstanding' },
  { minInclusive: 80, grade: 'A', gpa: 3.6, description: 'Excellent' },
  { minInclusive: 70, grade: 'B+', gpa: 3.2, description: 'Very Good' },
  { minInclusive: 60, grade: 'B', gpa: 2.8, description: 'Good' },
  { minInclusive: 50, grade: 'C+', gpa: 2.4, description: 'Satisfactory' },
  { minInclusive: 40, grade: 'C', gpa: 2.0, description: 'Acceptable' },
  { minInclusive: 35, grade: 'D', gpa: 1.6, description: 'Basic' },
];

function roundTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertFiniteNonNegative(value: number, fieldName: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new ConflictException(
      `${fieldName} must be a finite non-negative number`,
    );
  }
}

@Injectable()
export class GradeCalculatorService {
  getMoestGrade(percentage: number): MoestGradeResult {
    assertFiniteNonNegative(percentage, 'percentage');

    const normalized = Math.min(roundTwo(percentage), 100);
    const matched = GRADE_SCALE.find(
      (grade) => normalized >= grade.minInclusive,
    );

    if (!matched) {
      return {
        percentage: normalized,
        gpa: 0,
        grade: 'NG',
        description: 'Not Graded',
        status: 'FAIL',
        honorMention: false,
        remedialRequired: true,
      };
    }

    return {
      percentage: normalized,
      gpa: matched.gpa,
      grade: matched.grade,
      description: matched.description,
      status: 'PASS',
      honorMention: matched.grade === 'A+',
      remedialRequired: matched.grade === 'D',
    };
  }

  calculateWeightedSubjectGrade(input: SubjectGradeInput): SubjectGradeResult {
    if (input.components.length === 0) {
      throw new ConflictException(
        'At least one assessment component is required',
      );
    }

    let weightedScore = 0;
    let weightUsed = 0;
    let missingComponentCount = 0;
    let failedComponentCount = 0;

    for (const component of input.components) {
      this.validateComponent(component);

      const isWithheld =
        component.status === MarkEntryStatus.WITHHELD || component.isMissing;
      const isAbsent = component.status === MarkEntryStatus.ABSENT;

      if (isWithheld) {
        missingComponentCount += 1;
        if (!input.includeIncomplete) {
          continue;
        }
      }

      const marksObtained = isAbsent ? 0 : (component.marksObtained ?? 0);
      const componentPercentage =
        component.maxMarks === 0
          ? 0
          : (marksObtained / component.maxMarks) * 100;

      weightedScore += componentPercentage * (component.weightPercent / 100);
      weightUsed += component.weightPercent;

      if (
        component.passMarks !== undefined &&
        component.passMarks !== null &&
        marksObtained < component.passMarks
      ) {
        failedComponentCount += 1;
      }
    }

    if (weightUsed > 100) {
      throw new ConflictException(
        'Total component weight per subject cannot exceed 100%',
      );
    }

    const normalizedPercentage =
      weightUsed > 0 ? (weightedScore / weightUsed) * 100 : 0;
    const grade = this.getMoestGrade(normalizedPercentage);
    const status: GradeStatus =
      missingComponentCount > 0 && !input.includeIncomplete
        ? 'INCOMPLETE'
        : failedComponentCount > 0 || grade.status === 'FAIL'
          ? 'FAIL'
          : 'PASS';

    return {
      ...grade,
      status,
      grade: status === 'FAIL' && failedComponentCount > 0 ? 'NG' : grade.grade,
      gpa: status === 'FAIL' && failedComponentCount > 0 ? 0 : grade.gpa,
      description:
        status === 'FAIL' && failedComponentCount > 0
          ? 'Not Graded'
          : grade.description,
      remedialRequired:
        status === 'FAIL' || status === 'INCOMPLETE' || grade.remedialRequired,
      subjectId: input.subjectId,
      percentage: roundTwo(normalizedPercentage),
      weightedScore: roundTwo(weightedScore),
      weightUsed: roundTwo(weightUsed),
      componentCount: input.components.length,
      missingComponentCount,
      failedComponentCount,
    };
  }

  calculateOverallGpa(subjects: SubjectGradeResult[]) {
    if (subjects.length === 0) {
      return {
        percentage: 0,
        gpa: 0,
        grade: 'NG' as MoestLetterGrade,
        status: 'INCOMPLETE' as GradeStatus,
        subjectCount: 0,
        failedSubjectCount: 0,
        incompleteSubjectCount: 0,
      };
    }

    const failedSubjectCount = subjects.filter(
      (subject) => subject.status === 'FAIL',
    ).length;
    const incompleteSubjectCount = subjects.filter(
      (subject) => subject.status === 'INCOMPLETE',
    ).length;
    const averagePercentage =
      subjects.reduce((sum, subject) => sum + subject.percentage, 0) /
      subjects.length;
    const averageGpa =
      subjects.reduce((sum, subject) => sum + subject.gpa, 0) / subjects.length;
    const grade = this.getMoestGrade(averagePercentage);
    const status: GradeStatus =
      incompleteSubjectCount > 0
        ? 'INCOMPLETE'
        : failedSubjectCount > 0
          ? 'FAIL'
          : grade.status;

    return {
      percentage: roundTwo(averagePercentage),
      gpa: status === 'PASS' ? roundTwo(averageGpa) : 0,
      grade: status === 'PASS' ? grade.grade : ('NG' as MoestLetterGrade),
      status,
      subjectCount: subjects.length,
      failedSubjectCount,
      incompleteSubjectCount,
    };
  }

  getGradeScale() {
    return [
      ...GRADE_SCALE.map((grade) => ({ ...grade })),
      {
        minInclusive: 0,
        grade: 'NG' as MoestLetterGrade,
        gpa: 0,
        description: 'Not Graded',
      },
    ];
  }

  private validateComponent(component: ComponentScoreInput) {
    assertFiniteNonNegative(component.maxMarks, 'maxMarks');
    assertFiniteNonNegative(component.weightPercent, 'weightPercent');

    if (component.maxMarks === 0) {
      throw new ConflictException('maxMarks must be greater than zero');
    }

    if (component.weightPercent === 0 || component.weightPercent > 100) {
      throw new ConflictException(
        'weightPercent must be greater than 0 and <= 100',
      );
    }

    if (
      component.passMarks !== undefined &&
      component.passMarks !== null &&
      component.passMarks > component.maxMarks
    ) {
      throw new ConflictException('passMarks cannot exceed maxMarks');
    }

    if (
      component.marksObtained !== undefined &&
      component.marksObtained !== null &&
      component.marksObtained > component.maxMarks
    ) {
      throw new ConflictException('marksObtained cannot exceed maxMarks');
    }
  }
}
