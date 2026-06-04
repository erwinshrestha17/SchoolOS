import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  GradeCalculatorService,
  type TenantGradingPolicy,
} from './grade-calculator.service';
import {
  buildReportCardPdf,
  getJpegDimensions,
} from '../common/pdf/simple-pdf';

type ReportCardWithRelations = Prisma.ReportCardGetPayload<{
  include: {
    student: {
      include: {
        guardianLinks: {
          include: { guardian: true };
        };
      };
    };
    class: true;
    section: true;
    examTerm: true;
    academicYear: true;
  };
}>;

type MarkWithRelations = Prisma.MarkEntryGetPayload<{
  include: {
    subject: true;
    assessmentComponent: true;
  };
}>;

interface ReportPdfSubject {
  subject: string;
  components: Array<{
    name: string;
    type: string;
    obtained: number;
    max: number;
    weightPercent: number;
    passMarks: number | null;
    status: 'PASS' | 'FAIL';
  }>;
  totalObtained: number;
  totalMax: number;
  percentage: number;
  grade: string;
  gradePoint: number;
}

@Injectable()
export class ReportCardPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gradeCalculator: GradeCalculatorService,
    private readonly auditService: AuditService,
    private readonly fileRegistryService: FileRegistryService,
  ) {}

  async getReportCardPdf(reportCardId: string, actor: AuthContext) {
    const reportCard = await this.prisma.reportCard.findFirst({
      where: {
        id: reportCardId,
        tenantId: actor.tenantId,
      },
      include: {
        student: {
          include: {
            guardianLinks: {
              include: { guardian: true },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            },
          },
        },
        class: true,
        section: true,
        examTerm: true,
        academicYear: true,
      },
    });

    if (!reportCard) {
      throw new NotFoundException('Report card not found in this tenant');
    }

    const [
      tenant,
      settings,
      marks,
      attendanceSessions,
      attendanceRecords,
      unpaid,
    ] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: actor.tenantId } }),
      this.prisma.tenantSetting.findMany({
        where: {
          tenantId: actor.tenantId,
          key: {
            in: [
              'school_name',
              'school_address',
              'school_phone',
              'school_email',
              'school_logo',
              'principal_name',
              'report_card_footer_text',
            ],
          },
        },
      }),
      this.prisma.markEntry.findMany({
        where: {
          tenantId: actor.tenantId,
          examTermId: reportCard.examTermId,
          studentId: reportCard.studentId,
        },
        include: {
          subject: true,
          assessmentComponent: true,
        },
        orderBy: [
          { subject: { code: 'asc' } },
          { assessmentComponent: { name: 'asc' } },
        ],
      }),
      this.prisma.attendanceSession.count({
        where: {
          tenantId: actor.tenantId,
          academicYearId: reportCard.academicYearId,
          classId: reportCard.classId,
          sectionId: reportCard.sectionId ?? null,
        },
      }),
      this.prisma.attendanceRecord.groupBy({
        by: ['status'],
        where: {
          tenantId: actor.tenantId,
          studentId: reportCard.studentId,
          attendanceSession: {
            tenantId: actor.tenantId,
            academicYearId: reportCard.academicYearId,
            classId: reportCard.classId,
            sectionId: reportCard.sectionId ?? null,
          },
        },
        _count: { _all: true },
      }),
      this.prisma.invoice.count({
        where: {
          tenantId: actor.tenantId,
          studentId: reportCard.studentId,
          reportCardBlocked: true,
          status: { in: ['ISSUED', 'PARTIAL'] },
        },
      }),
    ]);

    if (unpaid > 0) {
      throw new ConflictException('Report card is blocked by unpaid fees');
    }

    const settingMap = new Map(settings.map((s) => [s.key, String(s.value)]));
    const primaryGuardian = reportCard.student.guardianLinks[0]?.guardian;

    let logoBuffer: Buffer | null = null;
    let logoDimensions: { width: number; height: number } | null = null;

    const logoSetting = settingMap.get('school_logo');
    if (
      logoSetting &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        String(logoSetting),
      )
    ) {
      try {
        const { content } = await this.fileRegistryService.getProtectedDownload(
          actor.tenantId,
          String(logoSetting),
          actor.userId,
        );
        logoBuffer = content;
        logoDimensions = getJpegDimensions(content);
      } catch (e) {
        // Silently fail logo load to prevent report card generation failure
      }
    }

    const gradingPolicy = await this.gradeCalculator.getTenantGradingPolicy(
      actor.tenantId,
    );

    const pdf = buildReportCardPdf({
      schoolName:
        settingMap.get('school_name') ?? tenant?.name ?? 'SchoolOS School',
      panNumber: tenant?.panNumber ?? null,
      examName: reportCard.examTerm.name,
      academicYear: reportCard.academicYear.name,
      student: {
        id: reportCard.student.studentSystemId,
        name: `${reportCard.student.firstNameEn} ${reportCard.student.lastNameEn}`.trim(),
        className: reportCard.class.name,
        sectionName: reportCard.section?.name,
        rollNumber: reportCard.student.rollNumber,
      },
      subjects: this.buildSubjectRows(marks, gradingPolicy).map((s) => ({
        name: s.subject,
        theory: s.components.find((c) => c.type === 'THEORY')
          ? {
              max: s.components
                .filter((c) => c.type === 'THEORY')
                .reduce((sum, c) => sum + c.max, 0),
              obtained: s.components
                .filter((c) => c.type === 'THEORY')
                .reduce((sum, c) => sum + c.obtained, 0),
              grade: s.grade,
            }
          : undefined,
        practical: s.components.find((c) => c.type === 'PRACTICAL')
          ? {
              max: s.components
                .filter((c) => c.type === 'PRACTICAL')
                .reduce((sum, c) => sum + c.max, 0),
              obtained: s.components
                .filter((c) => c.type === 'PRACTICAL')
                .reduce((sum, c) => sum + c.obtained, 0),
              grade: s.grade,
            }
          : undefined,
        totalGrade: s.grade,
        gradePoint: s.gradePoint,
      })),
      summary: {
        totalMarks: Number(reportCard.totalMarks),
        maxMarks: Number(reportCard.maxMarks),
        percentage: Number(reportCard.percentage),
        finalGrade: reportCard.grade,
        finalGpa: Number(reportCard.gpa),
        remarks: reportCard.remarks,
      },
      logo:
        logoBuffer && logoDimensions
          ? {
              buffer: logoBuffer,
              width: logoDimensions.width,
              height: logoDimensions.height,
              format: 'jpeg',
            }
          : null,
    });

    if (!reportCard.fileId) {
      const asset = await this.fileRegistryService.registerGeneratedFile({
        tenantId: actor.tenantId,
        generatedByUserId: actor.userId,
        originalFilename: `report-card-${reportCard.student.studentSystemId}-${reportCard.version}.pdf`,
        content: pdf,
        mimeType: 'application/pdf',
        module: 'academics',
        entityId: reportCard.id,
        metadata: {
          reportType: 'REPORT_CARD',
          reportCardId: reportCard.id,
          version: reportCard.version,
          academicYearId: reportCard.academicYearId,
          examTermId: reportCard.examTermId,
          studentId: reportCard.studentId,
        },
      });
      await this.prisma.reportCard.update({
        where: { id: reportCard.id },
        data: { fileId: asset.id },
      });
      await this.prisma.reportExport.create({
        data: {
          tenantId: actor.tenantId,
          reportKey: 'academics.report-card',
          format: 'pdf',
          filters: {
            reportCardId: reportCard.id,
            version: reportCard.version,
          },
          status: 'COMPLETED',
          fileAssetId: asset.id,
          requestedBy: actor.userId,
          completedAt: new Date(),
        },
      });
    }

    await this.auditService.record({
      action: 'ACADEMICS_REPORT_CARD_PDF_DOWNLOADED',
      resource: 'report_card',
      resourceId: reportCard.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { version: reportCard.version },
    });

    return pdf;
  }

  private buildSubjectRows(
    marks: MarkWithRelations[],
    gradingPolicy: TenantGradingPolicy,
  ) {
    const groupedMarks = new Map<string, MarkWithRelations[]>();

    for (const mark of marks) {
      const existing = groupedMarks.get(mark.subjectId) ?? [];
      existing.push(mark);
      groupedMarks.set(mark.subjectId, existing);
    }

    const rows: ReportPdfSubject[] = [];

    for (const [subjectId, subjectMarks] of groupedMarks.entries()) {
      const firstMark = subjectMarks[0];
      const result = this.gradeCalculator.calculateWeightedSubjectGrade(
        {
          subjectId,
          components: subjectMarks.map((m) => ({
            componentId: m.assessmentComponentId,
            subjectId,
            maxMarks: Number(m.assessmentComponent.maxMarks),
            marksObtained: Number(m.marksObtained),
            status: m.status,
            passMarks: m.assessmentComponent.passMarks
              ? Number(m.assessmentComponent.passMarks)
              : null,
            weightPercent: Number(m.assessmentComponent.weightPercent),
          })),
        },
        gradingPolicy,
      );

      rows.push({
        subject: `${firstMark.subject.code} / ${firstMark.subject.name}`,
        components: subjectMarks.map((m) => ({
          name: m.assessmentComponent.name,
          type: m.assessmentComponent.type,
          obtained: Number(m.marksObtained),
          max: Number(m.assessmentComponent.maxMarks),
          weightPercent: Number(m.assessmentComponent.weightPercent),
          passMarks: m.assessmentComponent.passMarks
            ? Number(m.assessmentComponent.passMarks)
            : null,
          status:
            m.assessmentComponent.passMarks === null ||
            Number(m.marksObtained) >= Number(m.assessmentComponent.passMarks)
              ? 'PASS'
              : 'FAIL',
        })),
        totalObtained: subjectMarks.reduce(
          (sum, m) => sum + Number(m.marksObtained),
          0,
        ),
        totalMax: subjectMarks.reduce(
          (sum, m) => sum + Number(m.assessmentComponent.maxMarks),
          0,
        ),
        percentage: result.percentage,
        grade: result.grade,
        gradePoint: result.gpa,
      });
    }

    return rows;
  }
}
