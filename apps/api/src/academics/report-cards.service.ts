import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GradeLockStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { FinanceService } from '../finance/finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { BatchGenerateReportCardsDto } from './dto/batch-generate-report-cards.dto';
import { GenerateReportCardDto } from './dto/generate-report-card.dto';
import {
  ApplyReportCardCorrectionDto,
  RequestReportCardCorrectionDto,
} from './dto/report-card-correction.dto';
import {
  GradeCalculatorService,
  type ComponentScoreInput,
  type SubjectGradeResult,
  type TenantGradingPolicy,
} from './grade-calculator.service';
import { UsageService } from '../usage/usage.service';

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
    private readonly usageService: UsageService,
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

    if (!examTerm.isLocked) {
      throw new ConflictException(
        'Report card generation requires locked marks for this exam term',
      );
    }

    const existingReportCard = await this.prisma.reportCard.findUnique({
      where: {
        tenantId_academicYearId_examTermId_studentId: {
          tenantId: actor.tenantId,
          academicYearId: dto.academicYearId,
          examTermId: dto.examTermId,
          studentId: dto.studentId,
        },
      },
    });

    if (existingReportCard?.status === GradeLockStatus.LOCKED) {
      throw new ConflictException(
        'Locked report cards cannot be regenerated without a correction workflow',
      );
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

    await this.usageService.checkLimit(
      actor.tenantId,
      'report_cards.generated',
      1,
    );

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

    const unlockedMarks = marks.filter((mark) => !mark.isLocked);
    if (unlockedMarks.length > 0) {
      throw new ConflictException(
        'Report card generation requires all available marks to be locked',
      );
    }

    const gradingPolicy = await this.gradeCalculator.getTenantGradingPolicy(
      actor.tenantId,
    );
    const subjectGrades = this.calculateSubjectGrades(
      components,
      marks,
      gradingPolicy,
    );
    const overall = this.gradeCalculator.calculateOverallGpa(
      subjectGrades,
      gradingPolicy,
    );

    if (overall.resultStatus === 'INCOMPLETE') {
      throw new ConflictException(
        'Cannot generate report card while required marks are incomplete',
      );
    }

    if (overall.resultStatus === 'WITHHELD') {
      throw new ConflictException(
        'Cannot generate report card while any result is withheld',
      );
    }

    const status = dto.lock ? GradeLockStatus.LOCKED : GradeLockStatus.DRAFT;
    const lockedAt = status === GradeLockStatus.LOCKED ? new Date() : null;
    const remarks = this.buildRemarks(
      dto.remarks,
      subjectGrades,
      overall.resultStatus,
    );

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
        totalMarks: new Prisma.Decimal(overall.totalObtained),
        maxMarks: new Prisma.Decimal(overall.totalFullMarks),
        percentage: new Prisma.Decimal(overall.percentage),
        grade: overall.grade,
        gpa: new Prisma.Decimal(overall.gpa),
        remarks,
        status,
        lockedAt,
      },
      update: {
        classId: student.classId,
        sectionId: student.sectionId ?? null,
        totalMarks: new Prisma.Decimal(overall.totalObtained),
        maxMarks: new Prisma.Decimal(overall.totalFullMarks),
        percentage: new Prisma.Decimal(overall.percentage),
        grade: overall.grade,
        gpa: new Prisma.Decimal(overall.gpa),
        remarks,
        status,
        lockedAt,
      },
      include: {
        academicYear: true,
        examTerm: true,
        student: true,
        class: true,
        section: true,
      },
    });

    await this.usageService.incrementUsage(
      actor.tenantId,
      'report_cards.generated',
      1,
    );

    await this.auditService.record({
      action: 'ACADEMICS_REPORT_CARD_GENERATED',
      resource: 'report_card',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: reportCard.id,
      after: {
        academicYearId: dto.academicYearId,
        examTermId: dto.examTermId,
        studentId: dto.studentId,
        totalObtained: overall.totalObtained,
        totalFullMarks: overall.totalFullMarks,
        percentage: overall.percentage,
        grade: overall.grade,
        gpa: overall.gpa,
        resultStatus: overall.resultStatus,
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
    if (new Set(dto.studentIds).size !== dto.studentIds.length) {
      throw new ConflictException('Duplicate student IDs are not allowed');
    }

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

  async requestCorrection(
    reportCardId: string,
    dto: RequestReportCardCorrectionDto,
    actor: AuthContext,
  ) {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new ConflictException('Correction reason is required');
    }

    const reportCard = await this.prisma.reportCard.findFirst({
      where: { id: reportCardId, tenantId: actor.tenantId },
    });

    if (!reportCard) {
      throw new NotFoundException('Report card not found in this tenant');
    }

    const request = await this.prisma.reportCardCorrectionRequest.create({
      data: {
        tenantId: actor.tenantId,
        reportCardId,
        requestedById: actor.userId,
        reason,
      },
    });

    await this.auditService.record({
      action: 'ACADEMICS_REPORT_CARD_CORRECTION_REQUESTED',
      resource: 'report_card',
      resourceId: reportCardId,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { reason, requestId: request.id, version: reportCard.version },
    });

    return request;
  }

  async applyCorrectionAndRegenerate(
    reportCardId: string,
    dto: ApplyReportCardCorrectionDto,
    actor: AuthContext,
  ) {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new ConflictException('Correction reason is required');
    }

    const reportCard = await this.prisma.reportCard.findFirst({
      where: { id: reportCardId, tenantId: actor.tenantId },
      include: { examTerm: true },
    });

    if (!reportCard) {
      throw new NotFoundException('Report card not found in this tenant');
    }

    if (reportCard.status !== GradeLockStatus.LOCKED) {
      throw new ConflictException(
        'Only locked report cards use the correction workflow',
      );
    }

    if (!reportCard.examTerm.isLocked) {
      throw new ConflictException(
        'Corrected report cards can only be regenerated after marks are locked again',
      );
    }

    const recalculated = await this.calculateRegeneratedValues(
      {
        academicYearId: reportCard.academicYearId,
        examTermId: reportCard.examTermId,
        studentId: reportCard.studentId,
        remarks: dto.remarks,
        lock: true,
      },
      actor,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.reportCardCorrectionRequest.create({
        data: {
          tenantId: actor.tenantId,
          reportCardId,
          requestedById: actor.userId,
          reviewedById: actor.userId,
          status: 'APPROVED',
          reason,
          reviewNote: dto.reviewNote ?? null,
          reviewedAt: new Date(),
        },
      });

      const history = await tx.reportCardHistory.create({
        data: {
          reportCardId,
          tenantId: actor.tenantId,
          academicYearId: reportCard.academicYearId,
          examTermId: reportCard.examTermId,
          studentId: reportCard.studentId,
          classId: reportCard.classId,
          sectionId: reportCard.sectionId,
          totalMarks: reportCard.totalMarks,
          maxMarks: reportCard.maxMarks,
          percentage: reportCard.percentage,
          grade: reportCard.grade,
          gpa: reportCard.gpa,
          remarks: reportCard.remarks,
          version: reportCard.version,
          fileId: reportCard.fileId,
        },
      });

      const nextVersion = reportCard.version + 1;
      const updated = await tx.reportCard.update({
        where: { id: reportCardId },
        data: {
          totalMarks: new Prisma.Decimal(recalculated.overall.totalObtained),
          maxMarks: new Prisma.Decimal(recalculated.overall.totalFullMarks),
          percentage: new Prisma.Decimal(recalculated.overall.percentage),
          grade: recalculated.overall.grade,
          gpa: new Prisma.Decimal(recalculated.overall.gpa),
          remarks: recalculated.remarks,
          status: GradeLockStatus.LOCKED,
          lockedAt: new Date(),
          version: nextVersion,
          fileId: null,
          publishStatus: dto.republish
            ? 'PUBLISHED'
            : reportCard.publishStatus === 'PUBLISHED'
              ? 'CORRECTED_DRAFT'
              : reportCard.publishStatus,
          publishedAt: dto.republish ? new Date() : reportCard.publishedAt,
          publishedById: dto.republish
            ? actor.userId
            : reportCard.publishedById,
        },
        include: {
          academicYear: true,
          examTerm: true,
          student: true,
          class: true,
          section: true,
        },
      });

      return { request, history, reportCard: updated };
    });

    await this.auditService.record({
      action: 'ACADEMICS_REPORT_CARD_CORRECTION_APPLIED',
      resource: 'report_card',
      resourceId: reportCardId,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        reason,
        previousVersion: reportCard.version,
        newVersion: result.reportCard.version,
        historyId: result.history.id,
        requestId: result.request.id,
      },
    });

    await this.auditService.record({
      action: 'ACADEMICS_REPORT_CARD_REGENERATED',
      resource: 'report_card',
      resourceId: reportCardId,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        version: result.reportCard.version,
        republished: Boolean(dto.republish),
        publishStatus: result.reportCard.publishStatus,
      },
    });

    return result.reportCard;
  }

  async listHistory(reportCardId: string, actor: AuthContext) {
    const reportCard = await this.prisma.reportCard.findFirst({
      where: { id: reportCardId, tenantId: actor.tenantId },
      select: { id: true },
    });

    if (!reportCard) {
      throw new NotFoundException('Report card not found in this tenant');
    }

    const [history, corrections] = await Promise.all([
      this.prisma.reportCardHistory.findMany({
        where: { tenantId: actor.tenantId, reportCardId },
        orderBy: { version: 'desc' },
      }),
      this.prisma.reportCardCorrectionRequest.findMany({
        where: { tenantId: actor.tenantId, reportCardId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { history, corrections };
  }

  private async calculateRegeneratedValues(
    dto: GenerateReportCardDto,
    actor: AuthContext,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId: actor.tenantId },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
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
        include: { assessmentComponent: true, subject: true },
      }),
    ]);

    if (components.length === 0) {
      throw new ConflictException(
        'No assessment components configured for this exam term and student class',
      );
    }

    if (marks.some((mark) => !mark.isLocked)) {
      throw new ConflictException(
        'Report card regeneration requires all available marks to be locked',
      );
    }

    const gradingPolicy = await this.gradeCalculator.getTenantGradingPolicy(
      actor.tenantId,
    );
    const subjectGrades = this.calculateSubjectGrades(
      components,
      marks,
      gradingPolicy,
    );
    const overall = this.gradeCalculator.calculateOverallGpa(
      subjectGrades,
      gradingPolicy,
    );

    if (overall.resultStatus === 'INCOMPLETE') {
      throw new ConflictException(
        'Cannot regenerate report card while required marks are incomplete',
      );
    }

    if (overall.resultStatus === 'WITHHELD') {
      throw new ConflictException(
        'Cannot regenerate report card while any result is withheld',
      );
    }

    return {
      overall,
      remarks: this.buildRemarks(
        dto.remarks,
        subjectGrades,
        overall.resultStatus,
      ),
    };
  }

  private calculateSubjectGrades(
    components: ComponentWithSubject[],
    marks: MarkWithComponent[],
    gradingPolicy: TenantGradingPolicy,
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
              componentName: component.name,
              subjectId,
              type: component.type,
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

        return this.gradeCalculator.calculateWeightedSubjectGrade(
          {
            subjectId,
            subjectName: subjectComponents[0]?.subject.name,
            subjectCode: subjectComponents[0]?.subject.code,
            components: componentInputs,
          },
          gradingPolicy,
        );
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
