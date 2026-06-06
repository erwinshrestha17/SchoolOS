import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { MarkEntryStatus, type Prisma } from '@prisma/client';
import { SettingsService } from '../settings/settings.service';

export type MoestLetterGrade =
  | 'A+'
  | 'A'
  | 'B+'
  | 'B'
  | 'C+'
  | 'C'
  | 'D'
  | 'NG';

export type GradeStatus = 'PASS' | 'FAIL' | 'INCOMPLETE' | 'WITHHELD';

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
  componentName?: string;
  subjectId: string;
  type?: string;
  maxMarks: number;
  marksObtained?: number | null;
  passMarks?: number | null;
  weightPercent: number;
  status?: MarkEntryStatus;
  isMissing?: boolean;
}

export interface SubjectGradeInput {
  subjectId: string;
  subjectName?: string;
  subjectCode?: string;
  components: ComponentScoreInput[];
  includeIncomplete?: boolean;
}

export interface ComponentResult {
  componentId: string;
  componentName: string;
  type: string;
  obtainedMarks: number;
  fullMarks: number;
  isAbsent: boolean;
  isWithheld: boolean;
  isMissing: boolean;
  passMarks: number | null;
  passed: boolean;
  resultStatus: GradeStatus;
}

export interface SubjectGradeResult extends MoestGradeResult {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  obtainedMarks: number;
  fullMarks: number;
  weightedScore: number;
  weightUsed: number;
  componentCount: number;
  missingComponentCount: number;
  failedComponentCount: number;
  withheldComponentCount: number;
  components: ComponentResult[];
}

export interface CasSubjectSummary {
  subjectId: string | null;
  subjectName: string;
  totalScore: number;
  totalMaxScore: number;
  percentage: number;
  recordCount: number;
  categories: string[];
}

export interface OverallResult {
  totalObtained: number;
  totalFullMarks: number;
  percentage: number;
  gpa: number;
  grade: MoestLetterGrade;
  resultStatus: GradeStatus;
  subjectCount: number;
  failedSubjectCount: number;
  incompleteSubjectCount: number;
  withheldSubjectCount: number;
}

export interface GradeScaleEntry {
  grade: MoestLetterGrade;
  minPercentage: number;
  maxPercentage: number;
  gradePoint: number;
  label: string;
  passed: boolean;
}

export type RoundingMode = 'HALF_UP' | 'FLOOR' | 'CEIL';

export interface GradingRoundingPolicy {
  percentageDecimals: number;
  gpaDecimals: number;
  marksDecimals: number;
  mode: RoundingMode;
}

export interface TenantGradingPolicy {
  scale: GradeScaleEntry[];
  rounding: GradingRoundingPolicy;
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

const DEFAULT_ROUNDING_POLICY: GradingRoundingPolicy = {
  percentageDecimals: 2,
  gpaDecimals: 2,
  marksDecimals: 2,
  mode: 'HALF_UP',
};

function roundNumber(
  value: number,
  decimals: number,
  mode: RoundingMode = 'HALF_UP',
) {
  const factor = 10 ** decimals;
  const adjusted = (value + Number.EPSILON) * factor;

  if (mode === 'FLOOR') {
    return Math.floor(adjusted) / factor;
  }
  if (mode === 'CEIL') {
    return Math.ceil(adjusted) / factor;
  }

  return Math.round(adjusted) / factor;
}

function roundTwo(value: number) {
  return roundNumber(value, 2);
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
  constructor(@Optional() private readonly settingsService?: SettingsService) {}

  async getTenantGradingPolicy(tenantId: string): Promise<TenantGradingPolicy> {
    if (!this.settingsService) {
      return this.getDefaultGradingPolicy();
    }

    const [scaleSetting, roundingSetting] = await Promise.all([
      this.settingsService.getSetting(tenantId, 'grading_scale'),
      this.settingsService.getSetting(tenantId, 'grading_rounding_policy'),
    ]);

    return {
      scale: this.parseGradingScale(scaleSetting),
      rounding: this.parseRoundingPolicy(roundingSetting),
    };
  }

  getDefaultGradingPolicy(): TenantGradingPolicy {
    return {
      scale: this.getDefaultGradingScale(),
      rounding: { ...DEFAULT_ROUNDING_POLICY },
    };
  }

  async getGradingScale(tenantId: string): Promise<GradeScaleEntry[]> {
    return (await this.getTenantGradingPolicy(tenantId)).scale;
  }

  getDefaultGradingScale(): GradeScaleEntry[] {
    const entries: GradeScaleEntry[] = [];
    for (let i = 0; i < GRADE_SCALE.length; i++) {
      const current = GRADE_SCALE[i];
      const maxPct = i === 0 ? 100 : GRADE_SCALE[i - 1].minInclusive - 0.01;
      entries.push({
        grade: current.grade,
        minPercentage: current.minInclusive,
        maxPercentage: roundTwo(maxPct),
        gradePoint: current.gpa,
        label: current.description,
        passed: true,
      });
    }
    entries.push({
      grade: 'NG',
      minPercentage: 0,
      maxPercentage: 34.99,
      gradePoint: 0,
      label: 'Not Graded',
      passed: false,
    });
    return entries;
  }

  getMoestGrade(
    percentage: number,
    policy = this.getDefaultGradingPolicy(),
  ): MoestGradeResult {
    assertFiniteNonNegative(percentage, 'percentage');

    const normalized = Math.min(
      roundNumber(
        percentage,
        policy.rounding.percentageDecimals,
        policy.rounding.mode,
      ),
      100,
    );
    const matched = policy.scale.find(
      (grade) =>
        normalized >= grade.minPercentage && normalized <= grade.maxPercentage,
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
      gpa: roundNumber(
        matched.gradePoint,
        policy.rounding.gpaDecimals,
        policy.rounding.mode,
      ),
      grade: matched.grade,
      description: matched.label,
      status: matched.passed ? 'PASS' : 'FAIL',
      honorMention: matched.grade === 'A+',
      remedialRequired: !matched.passed || matched.grade === 'D',
    };
  }

  /**
   * Calculate a single component's result status and effective marks.
   */
  calculateComponentResult(
    component: ComponentScoreInput,
    policy = this.getDefaultGradingPolicy(),
  ): ComponentResult {
    const isAbsent =
      component.status === MarkEntryStatus.ABSENT ||
      component.status === MarkEntryStatus.EXCUSED;
    const isWithheld = component.status === MarkEntryStatus.WITHHELD;
    const isMissing =
      component.isMissing ||
      component.status === MarkEntryStatus.MISSING ||
      ((component.marksObtained === undefined ||
        component.marksObtained === null) &&
        !isAbsent &&
        !isWithheld);

    let obtainedMarks = 0;
    if (isAbsent) {
      obtainedMarks = 0;
    } else if (isWithheld || isMissing) {
      obtainedMarks = 0;
    } else {
      obtainedMarks = component.marksObtained ?? 0;
    }

    let resultStatus: GradeStatus = 'PASS';
    if (isWithheld) {
      resultStatus = 'WITHHELD';
    } else if (isMissing) {
      resultStatus = 'INCOMPLETE';
    } else {
      const passMarks = component.passMarks;
      if (
        passMarks !== undefined &&
        passMarks !== null &&
        obtainedMarks < passMarks
      ) {
        resultStatus = 'FAIL';
      }
    }

    const passed =
      resultStatus === 'PASS' &&
      (component.passMarks === undefined ||
        component.passMarks === null ||
        obtainedMarks >= component.passMarks);

    return {
      componentId: component.componentId,
      componentName: component.componentName ?? '',
      type: component.type ?? '',
      obtainedMarks: roundNumber(
        obtainedMarks,
        policy.rounding.marksDecimals,
        policy.rounding.mode,
      ),
      fullMarks: roundNumber(
        component.maxMarks,
        policy.rounding.marksDecimals,
        policy.rounding.mode,
      ),
      isAbsent,
      isWithheld,
      isMissing,
      passMarks: component.passMarks ?? null,
      passed,
      resultStatus,
    };
  }

  calculateWeightedSubjectGrade(
    input: SubjectGradeInput,
    policy = this.getDefaultGradingPolicy(),
  ): SubjectGradeResult {
    if (input.components.length === 0) {
      throw new ConflictException(
        'At least one assessment component is required',
      );
    }

    let weightedScore = 0;
    let weightUsed = 0;
    let missingComponentCount = 0;
    let failedComponentCount = 0;
    let withheldComponentCount = 0;
    let totalObtained = 0;
    let totalFull = 0;
    const componentResults: ComponentResult[] = [];

    for (const component of input.components) {
      this.validateComponent(component);
      const cr = this.calculateComponentResult(component, policy);
      componentResults.push(cr);

      if (cr.isWithheld) {
        withheldComponentCount += 1;
        if (!input.includeIncomplete) {
          continue;
        }
      }

      if (cr.isMissing) {
        missingComponentCount += 1;
        if (!input.includeIncomplete) {
          continue;
        }
      }

      const componentPercentage =
        component.maxMarks === 0
          ? 0
          : (cr.obtainedMarks / component.maxMarks) * 100;

      weightedScore += componentPercentage * (component.weightPercent / 100);
      weightUsed += component.weightPercent;
      totalObtained += cr.obtainedMarks;
      totalFull += component.maxMarks;

      if (!cr.passed && !cr.isMissing && !cr.isWithheld) {
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
    const grade = this.getMoestGrade(normalizedPercentage, policy);

    let status: GradeStatus;
    if (withheldComponentCount > 0 && !input.includeIncomplete) {
      status = 'WITHHELD';
    } else if (missingComponentCount > 0 && !input.includeIncomplete) {
      status = 'INCOMPLETE';
    } else if (failedComponentCount > 0 || grade.status === 'FAIL') {
      status = 'FAIL';
    } else {
      status = 'PASS';
    }

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
      subjectName: input.subjectName ?? '',
      subjectCode: input.subjectCode ?? '',
      obtainedMarks: roundNumber(
        totalObtained,
        policy.rounding.marksDecimals,
        policy.rounding.mode,
      ),
      fullMarks: roundNumber(
        totalFull,
        policy.rounding.marksDecimals,
        policy.rounding.mode,
      ),
      percentage: roundNumber(
        normalizedPercentage,
        policy.rounding.percentageDecimals,
        policy.rounding.mode,
      ),
      weightedScore: roundNumber(
        weightedScore,
        policy.rounding.percentageDecimals,
        policy.rounding.mode,
      ),
      weightUsed: roundNumber(
        weightUsed,
        policy.rounding.percentageDecimals,
        policy.rounding.mode,
      ),
      componentCount: input.components.length,
      missingComponentCount,
      failedComponentCount,
      withheldComponentCount,
      components: componentResults,
    };
  }

  calculateOverallGpa(
    subjects: SubjectGradeResult[],
    policy = this.getDefaultGradingPolicy(),
  ): OverallResult {
    if (subjects.length === 0) {
      return {
        totalObtained: 0,
        totalFullMarks: 0,
        percentage: 0,
        gpa: 0,
        grade: 'NG',
        resultStatus: 'INCOMPLETE',
        subjectCount: 0,
        failedSubjectCount: 0,
        incompleteSubjectCount: 0,
        withheldSubjectCount: 0,
      };
    }

    const failedSubjectCount = subjects.filter(
      (s) => s.status === 'FAIL',
    ).length;
    const incompleteSubjectCount = subjects.filter(
      (s) => s.status === 'INCOMPLETE',
    ).length;
    const withheldSubjectCount = subjects.filter(
      (s) => s.status === 'WITHHELD',
    ).length;

    const totalObtained = subjects.reduce((sum, s) => sum + s.obtainedMarks, 0);
    const totalFullMarks = subjects.reduce((sum, s) => sum + s.fullMarks, 0);

    const averagePercentage =
      subjects.reduce((sum, s) => sum + s.percentage, 0) / subjects.length;

    // Weighted GPA: weight by subject fullMarks
    const totalWeight = subjects.reduce((sum, s) => sum + s.fullMarks, 0);
    const weightedGpa =
      totalWeight > 0
        ? subjects.reduce((sum, s) => sum + s.gpa * s.fullMarks, 0) /
          totalWeight
        : 0;

    const grade = this.getMoestGrade(averagePercentage, policy);

    let resultStatus: GradeStatus;
    if (withheldSubjectCount > 0) {
      resultStatus = 'WITHHELD';
    } else if (incompleteSubjectCount > 0) {
      resultStatus = 'INCOMPLETE';
    } else if (failedSubjectCount > 0) {
      resultStatus = 'FAIL';
    } else {
      resultStatus = grade.status === 'FAIL' ? 'FAIL' : 'PASS';
    }

    return {
      totalObtained: roundNumber(
        totalObtained,
        policy.rounding.marksDecimals,
        policy.rounding.mode,
      ),
      totalFullMarks: roundNumber(
        totalFullMarks,
        policy.rounding.marksDecimals,
        policy.rounding.mode,
      ),
      percentage: roundNumber(
        averagePercentage,
        policy.rounding.percentageDecimals,
        policy.rounding.mode,
      ),
      gpa:
        resultStatus === 'PASS'
          ? roundNumber(
              weightedGpa,
              policy.rounding.gpaDecimals,
              policy.rounding.mode,
            )
          : 0,
      grade: resultStatus === 'PASS' ? grade.grade : 'NG',
      resultStatus,
      subjectCount: subjects.length,
      failedSubjectCount,
      incompleteSubjectCount,
      withheldSubjectCount,
    };
  }

  /**
   * Summarize CAS records per subject for preview display.
   */
  summarizeCasRecords(
    records: Array<{
      subjectId: string | null;
      subjectName?: string;
      category: string;
      score: number;
      maxScore: number;
    }>,
  ): CasSubjectSummary[] {
    const map = new Map<
      string,
      {
        scores: number;
        maxScores: number;
        count: number;
        categories: Set<string>;
        name: string;
      }
    >();

    for (const r of records) {
      const key = r.subjectId ?? '__general__';
      if (!map.has(key)) {
        map.set(key, {
          scores: 0,
          maxScores: 0,
          count: 0,
          categories: new Set(),
          name: r.subjectName ?? 'General',
        });
      }
      const entry = map.get(key);
      if (entry) {
        entry.scores += r.score;
        entry.maxScores += r.maxScore;
        entry.count += 1;
        entry.categories.add(r.category);
      }
    }

    return Array.from(map.entries()).map(([subjectId, data]) => ({
      subjectId: subjectId === '__general__' ? null : subjectId,
      subjectName: data.name,
      totalScore: roundTwo(data.scores),
      totalMaxScore: roundTwo(data.maxScores),
      percentage:
        data.maxScores > 0 ? roundTwo((data.scores / data.maxScores) * 100) : 0,
      recordCount: data.count,
      categories: Array.from(data.categories),
    }));
  }

  getPromotionStatus(percentage: number): 'READY' | 'REVIEW' {
    return percentage >= 35 ? 'READY' : 'REVIEW';
  }

  /**
   * @deprecated Use getGradingScale() for endpoint-friendly format.
   */
  getGradeScale() {
    return this.getDefaultGradingScale().map((grade) => ({
      minInclusive: grade.minPercentage,
      grade: grade.grade,
      gpa: grade.gradePoint,
      description: grade.label,
    }));
  }

  private parseGradingScale(value: Prisma.JsonValue | null): GradeScaleEntry[] {
    if (!Array.isArray(value) || value.length === 0) {
      return this.getDefaultGradingScale();
    }

    const entries = value
      .map((entry) => this.parseGradingScaleEntry(entry))
      .filter((entry): entry is GradeScaleEntry => entry !== null)
      .sort((a, b) => b.minPercentage - a.minPercentage);

    return entries.length > 0 ? entries : this.getDefaultGradingScale();
  }

  private parseGradingScaleEntry(
    value: Prisma.JsonValue | null,
  ): GradeScaleEntry | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }

    const entry = value as Record<string, Prisma.JsonValue>;
    if (
      typeof entry.grade !== 'string' ||
      typeof entry.minPercentage !== 'number' ||
      typeof entry.gradePoint !== 'number' ||
      typeof entry.label !== 'string' ||
      typeof entry.passed !== 'boolean'
    ) {
      return null;
    }

    const minPercentage = Math.max(0, Math.min(entry.minPercentage, 100));
    const maxPercentage =
      typeof entry.maxPercentage === 'number'
        ? Math.max(minPercentage, Math.min(entry.maxPercentage, 100))
        : 100;

    return {
      grade: entry.grade as MoestLetterGrade,
      minPercentage: roundTwo(minPercentage),
      maxPercentage: roundTwo(maxPercentage),
      gradePoint: roundTwo(Math.max(0, Math.min(entry.gradePoint, 4))),
      label: entry.label,
      passed: entry.passed,
    };
  }

  private parseRoundingPolicy(
    value: Prisma.JsonValue | null,
  ): GradingRoundingPolicy {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ...DEFAULT_ROUNDING_POLICY };
    }

    const policy = value as Record<string, Prisma.JsonValue>;
    const mode =
      policy.mode === 'FLOOR' || policy.mode === 'CEIL'
        ? policy.mode
        : DEFAULT_ROUNDING_POLICY.mode;

    return {
      percentageDecimals: this.parseDecimalPlaces(
        policy.percentageDecimals,
        DEFAULT_ROUNDING_POLICY.percentageDecimals,
      ),
      gpaDecimals: this.parseDecimalPlaces(
        policy.gpaDecimals,
        DEFAULT_ROUNDING_POLICY.gpaDecimals,
      ),
      marksDecimals: this.parseDecimalPlaces(
        policy.marksDecimals,
        DEFAULT_ROUNDING_POLICY.marksDecimals,
      ),
      mode,
    };
  }

  private parseDecimalPlaces(value: Prisma.JsonValue, fallback: number) {
    return typeof value === 'number' && Number.isInteger(value)
      ? Math.max(0, Math.min(value, 4))
      : fallback;
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
