import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GradeLockStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { BatchGenerateReportCardsDto } from './dto/batch-generate-report-cards.dto';
import { GenerateReportCardDto } from './dto/generate-report-card.dto';
import {
  GradeCalculatorService,
  type ComponentScoreInput,
  type SubjectGradeResult,
} from './grade-calculator.service';
import { FinanceService } from '../finance/finance.service';
import { SettingsService } from '../settings/settings.service';

type MarkWithComponent = Prisma.MarkEntryGetPayload<{
  include: {
    assessmentComponent: true;
    subject: true;
  };
}>;

type ComponentWithSubject = Prisma.AssessmentComponentGetPayload<{
  include: { subject: true };
}>;

type GeneratedReportCard = Awaited<
  ReturnType<ReportCardsService['generateReportCard']>
>;

@Injectable()
export class ReportCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly gradeCalculator: GradeCalculatorService,
    private readonly financeService: FinanceService,
    private readonly settingsService: SettingsService,
  ) {}

  async generateReportCard(dto: GenerateReportCardDto, actor: AuthContext) {
    const [academicYear, examTerm, student] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, tenantId: actor.tenantId },
      }),
      this.prisma.examTerm.findFirst({
        where: {
          id: dto.examTermId,
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
        },
      }),
      this.prisma.student.findFirst({
        where: { id: dto.studentId, tenantId: actor.tenantId },
        include: { class: true, sectionRef: true },
      }),
    ]);

    if (!academicYear) {
      throw new NotFoundException('Academic year not found in this tenant');
    }

    if (!examTerm) {
      throw new NotFoundException('Exam term not found in this academic year');
    }

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const settings = await this.prisma.tenantSetting.findFirst({
      where: { tenantId: actor.tenantId, key: 'block_report_card_on_dues' },
    });

    if (settings?.value === 'true') {
      const ledger = await this.financeService.getStudentFeeLedger(
        dto.studentId,
        actor,
      );
      if (ledger.outstandingBalance > 0) {
        throw new ConflictException(
          `Report card generation blocked: student has outstanding dues of ${ledger.outstandingBalance}`,
        );
      }
    }

    const [components, marks] = await Promise.all([
      this.prisma.assessmentComponent.findMany({
        where: {
          tenantId: actor.tenantId,
          examTermId: dto.examTermId,
          subject: { classId: student.classId },
        },
        include: { subject: true },
        orderBy: [{ subject: { code: 'asc' } }, { name: 'asc' }],
      }),
      this.prisma.markEntry.findMany({
        where: {
          tenantId: actor.tenantId,
          examTermId: dto.examTermId,
          studentId: dto.studentId,
        },
        include: {
          assessmentComponent: true,
          subject: true,
        },
      }),
    ]);

    if (components.length === 0) {
      throw new ConflictException(
        'No assessment components configured for this exam term and student class',
      );
    }

    const subjectGrades = this.calculateSubjectGrades(components, marks);
    const overall = this.gradeCalculator.calculateOverallGpa(subjectGrades);
    const status = dto.lock ? GradeLockStatus.LOCKED : GradeLockStatus.DRAFT;

    const reportCard = await this.prisma.reportCard.upsert({
      where: {
        tenantId_academicYearId_examTermId_studentId: {
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
          examTermId: dto.examTermId,
          studentId: dto.studentId,
        },
      },
      create: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        examTermId: dto.examTermId,
        studentId: dto.studentId,
        classId: student.classId,
        sectionId: student.sectionId ?? null,
        totalMarks: new Prisma.Decimal(overall.percentage),
        maxMarks: new Prisma.Decimal(100),
        percentage: new Prisma.Decimal(overall.percentage),
        grade: overall.grade,
        gpa: new Prisma.Decimal(overall.gpa),
        remarks: this.buildRemarks(dto.remarks, subjectGrades, overall.status),
        status,
        lockedAt: status === GradeLockStatus.LOCKED ? new Date() : null,
      },
      update: {
        classId: student.classId,
        sectionId: student.sectionId ?? null,
        totalMarks: new Prisma.Decimal(overall.percentage),
        maxMarks: new Prisma.Decimal(100),
        percentage: new Prisma.Decimal(overall.percentage),
        grade: overall.grade,
        gpa: new Prisma.Decimal(overall.gpa),
        remarks: this.buildRemarks(dto.remarks, subjectGrades, overall.status),
        status,
        lockedAt: status === GradeLockStatus.LOCKED ? new Date() : null,
      },
      include: {
        academicYear: true,
        examTerm: true,
        student: true,
        class: true,
        section: true,
      },
    });

    await this.auditService.record({
      action: 'generate',
      resource: 'report_card',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: reportCard.id,
      after: {
        academicYearId: dto.academicYearId,
        examTermId: dto.examTermId,
        studentId: dto.studentId,
        percentage: overall.percentage,
        grade: overall.grade,
        gpa: overall.gpa,
        resultStatus: overall.status,
        subjectCount: overall.subjectCount,
        failedSubjectCount: overall.failedSubjectCount,
        incompleteSubjectCount: overall.incompleteSubjectCount,
        locked: status === GradeLockStatus.LOCKED,
      },
    });

    return {
      ...reportCard,
      calculation: {
        ...overall,
        subjects: subjectGrades,
      },
    };
  }

  async batchGenerateReportCards(
    dto: BatchGenerateReportCardsDto,
    actor: AuthContext,
  ) {
    const reports: GeneratedReportCard[] = [];

    for (const studentId of dto.studentIds) {
      reports.push(
        await this.generateReportCard(
          {
            academicYearId: dto.academicYearId,
            examTermId: dto.examTermId,
            studentId,
            remarks: dto.remarks,
            lock: dto.lock,
          },
          actor,
        ),
      );
    }

    return {
      generated: reports.length,
      reports,
    };
  }

  private calculateSubjectGrades(
    components: ComponentWithSubject[],
    marks: MarkWithComponent[],
  ): SubjectGradeResult[] {
    const marksByComponent = new Map(
      marks.map((mark) => [mark.assessmentComponentId, mark]),
    );
    const componentsBySubject = new Map<string, ComponentWithSubject[]>();

    for (const component of components) {
      const existing = componentsBySubject.get(component.subjectId) ?? [];
      existing.push(component);
      componentsBySubject.set(component.subjectId, existing);
    }

    return Array.from(componentsBySubject.entries()).map(
      ([subjectId, subjectComponents]) => {
        const componentInputs: ComponentScoreInput[] = subjectComponents.map(
          (component) => {
            const mark = marksByComponent.get(component.id);

            return {
              componentId: component.id,
              subjectId,
              maxMarks: Number(component.maxMarks),
              marksObtained: mark ? Number(mark.marksObtained) : null,
              status: mark?.status,
              passMarks:
                component.passMarks === null ||
                component.passMarks === undefined
                  ? null
                  : Number(component.passMarks),
              weightPercent: Number(component.weightPercent),
              isMissing: !mark,
            };
          },
        );

        return this.gradeCalculator.calculateWeightedSubjectGrade({
          subjectId,
          components: componentInputs,
        });
      },
    );
  }

  private buildRemarks(
    remarks: string | undefined,
    subjects: SubjectGradeResult[],
    overallStatus: string,
  ) {
    const trimmedRemarks = remarks?.trim();
    const incompleteCount = subjects.filter(
      (subject) => subject.status === 'INCOMPLETE',
    ).length;
    const failedCount = subjects.filter(
      (subject) => subject.status === 'FAIL',
    ).length;
    const systemRemarks: string[] = [];

    if (incompleteCount > 0) {
      systemRemarks.push(`${incompleteCount} subject(s) have missing marks.`);
    }

    if (failedCount > 0) {
      systemRemarks.push(`${failedCount} subject(s) require remedial support.`);
    }

    if (overallStatus === 'PASS' && systemRemarks.length === 0) {
      return trimmedRemarks || null;
    }

    return [trimmedRemarks, ...systemRemarks].filter(Boolean).join(' ') || null;
  }
}
