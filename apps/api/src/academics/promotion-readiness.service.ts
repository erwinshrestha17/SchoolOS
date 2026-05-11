import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GradeLockStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { BatchPromoteDto } from './dto/batch-promote.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';

export type PromotionReadinessStatus = 'READY' | 'NEEDS_REVIEW' | 'BLOCKED';
export type PromotionRecommendedAction = 'PROMOTE' | 'REVIEW' | 'HOLD';

export interface PromotionReadinessRow {
  studentId: string;
  studentName: string;
  studentSystemId: string;
  classId: string;
  className: string;
  sectionId: string | null;
  sectionName: string | null;
  reportCardId: string | null;
  percentage: number;
  grade: string;
  gpa: number;
  status: PromotionReadinessStatus;
  reasons: string[];
  recommendedAction: PromotionRecommendedAction;
  lifecycleStatus: string;
  outstandingBalance: number;
}

type PromotionFilters = {
  academicYearId: string;
  examTermId?: string;
  classId?: string;
  sectionId?: string;
  status?: string;
  page?: number;
  limit?: number;
};

type StudentWithScope = {
  id: string;
  firstNameEn: string;
  lastNameEn: string;
  studentSystemId: string;
  classId: string;
  sectionId: string | null;
  lifecycleStatus?: string | null;
  class?: { id: string; name: string } | null;
  sectionRef?: { id: string; name: string } | null;
};

type ReportCardLike = {
  id: string;
  studentId: string;
  status: GradeLockStatus | string;
  percentage: Prisma.Decimal | number;
  grade: string;
  gpa: Prisma.Decimal | number;
  remarks?: string | null;
};

@Injectable()
export class PromotionReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listPromotionReadiness(
    actor: AuthContext,
    filters: PromotionFilters,
  ): Promise<PromotionReadinessRow[]> {
    await this.ensureAcademicYear(actor, filters.academicYearId);

    if (filters.examTermId) {
      await this.ensureExamTerm(actor, filters.examTermId, filters.academicYearId);
    }

    if (filters.classId) {
      await this.ensureClass(actor, filters.classId);
    }

    if (filters.sectionId) {
      if (!filters.classId) {
        throw new ConflictException('classId is required when sectionId is provided');
      }
      await this.ensureSection(actor, filters.sectionId, filters.classId);
    }

    const page = Math.max(1, Number(filters.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit ?? 50)));
    const skip = (page - 1) * limit;

    const prisma = this.prisma as unknown as {
      student: {
        findMany: (args: unknown) => Promise<StudentWithScope[]>;
      };
      reportCard: {
        findMany: (args: unknown) => Promise<ReportCardLike[]>;
      };
    };

    const students = await prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
      },
      include: {
        class: true,
        sectionRef: true,
      },
      orderBy: [{ class: { level: 'asc' } }, { rollNumber: 'asc' }],
      skip,
      take: limit,
    });

    const reportCards = await prisma.reportCard.findMany({
      where: {
        tenantId: actor.tenantId,
        academicYearId: filters.academicYearId,
        ...(filters.examTermId ? { examTermId: filters.examTermId } : {}),
        studentId: { in: students.map((student) => student.id) },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    const reportCardByStudent = new Map<string, ReportCardLike>();
    for (const reportCard of reportCards) {
      if (!reportCardByStudent.has(reportCard.studentId)) {
        reportCardByStudent.set(reportCard.studentId, reportCard);
      }
    }

    const rows = students.map((student) =>
      this.buildReadinessRow(student, reportCardByStudent.get(student.id)),
    );

    if (!filters.status) {
      return rows;
    }

    const normalizedStatus = this.normalizeStatus(filters.status);
    return rows.filter((row) => row.status === normalizedStatus);
  }

  async promoteStudent(dto: PromoteStudentDto, actor: AuthContext) {
    await Promise.all([
      this.ensureAcademicYear(actor, dto.academicYearId),
      this.ensureAcademicYear(actor, dto.targetAcademicYearId),
      this.ensureClass(actor, dto.toClassId),
    ]);

    if (dto.academicYearId === dto.targetAcademicYearId) {
      throw new ConflictException('Target academic year must differ from source academic year');
    }

    if (dto.toSectionId) {
      await this.ensureSection(actor, dto.toSectionId, dto.toClassId);
    }

    const prisma = this.prisma as unknown as {
      student: {
        findFirst: (args: unknown) => Promise<StudentWithScope | null>;
        update: (args: unknown) => Promise<StudentWithScope>;
      };
      reportCard: {
        findFirst: (args: unknown) => Promise<ReportCardLike | null>;
      };
      $transaction: <T>(callback: (tx: {
        student: {
          update: (args: unknown) => Promise<StudentWithScope>;
        };
      }) => Promise<T>) => Promise<T>;
    };

    const student = await prisma.student.findFirst({
      where: { id: dto.studentId, tenantId: actor.tenantId },
      include: { class: true, sectionRef: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    if (student.classId === dto.toClassId && student.sectionId === (dto.toSectionId ?? null)) {
      throw new ConflictException('Student is already in the target class/section');
    }

    const reportCard = await prisma.reportCard.findFirst({
      where: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        studentId: dto.studentId,
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    const readiness = this.buildReadinessRow(student, reportCard ?? undefined);
    if (readiness.status !== 'READY') {
      await this.auditService.record({
        action: 'ACADEMICS_PROMOTION_BLOCKED',
        resource: 'student',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: dto.studentId,
        after: {
          academicYearId: dto.academicYearId,
          targetAcademicYearId: dto.targetAcademicYearId,
          reasons: readiness.reasons,
        },
      });
      throw new ConflictException(`Student is not promotion-ready: ${readiness.reasons.join(', ')}`);
    }

    const promoted = await prisma.$transaction(async (tx) => {
      return tx.student.update({
        where: { id: dto.studentId },
        data: {
          classId: dto.toClassId,
          sectionId: dto.toSectionId ?? null,
        },
      });
    });

    await this.auditService.record({
      action: 'ACADEMICS_STUDENT_PROMOTED',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: dto.studentId,
      before: {
        academicYearId: dto.academicYearId,
        classId: student.classId,
        sectionId: student.sectionId,
      },
      after: {
        targetAcademicYearId: dto.targetAcademicYearId,
        classId: dto.toClassId,
        sectionId: dto.toSectionId ?? null,
        remarks: dto.remarks ?? null,
      },
    });

    return promoted;
  }

  async batchPromote(dto: BatchPromoteDto, actor: AuthContext) {
    await Promise.all([
      this.ensureAcademicYear(actor, dto.academicYearId),
      this.ensureAcademicYear(actor, dto.targetAcademicYearId),
    ]);

    if (dto.academicYearId === dto.targetAcademicYearId) {
      throw new ConflictException('Target academic year must differ from source academic year');
    }

    const seen = new Set<string>();
    const results: unknown[] = [];

    for (const mapping of dto.classMappings) {
      await this.ensureClass(actor, mapping.toClassId);
      if (mapping.toSectionId) {
        await this.ensureSection(actor, mapping.toSectionId, mapping.toClassId);
      }

      for (const studentId of mapping.studentIds ?? []) {
        if (seen.has(studentId)) {
          throw new ConflictException('Duplicate student IDs are not allowed in batch promotion');
        }
        seen.add(studentId);
        results.push(
          await this.promoteStudent(
            {
              academicYearId: dto.academicYearId,
              targetAcademicYearId: dto.targetAcademicYearId,
              studentId,
              toClassId: mapping.toClassId,
              toSectionId: mapping.toSectionId,
              remarks: dto.remarks,
            },
            actor,
          ),
        );
      }
    }

    await this.auditService.record({
      action: 'ACADEMICS_BATCH_PROMOTION_COMPLETED',
      resource: 'student',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        academicYearId: dto.academicYearId,
        targetAcademicYearId: dto.targetAcademicYearId,
        promotedCount: results.length,
      },
    });

    return { promoted: results.length, results };
  }

  private buildReadinessRow(
    student: StudentWithScope,
    reportCard?: ReportCardLike,
  ): PromotionReadinessRow {
    const reasons: string[] = [];
    let status: PromotionReadinessStatus = 'READY';
    let recommendedAction: PromotionRecommendedAction = 'PROMOTE';

    if (!reportCard) {
      status = 'BLOCKED';
      recommendedAction = 'HOLD';
      reasons.push('MISSING_REPORT_CARD');
    } else if (reportCard.status !== GradeLockStatus.LOCKED) {
      status = 'BLOCKED';
      recommendedAction = 'HOLD';
      reasons.push('REPORT_CARD_NOT_LOCKED');
    } else if (reportCard.grade === 'NG' || Number(reportCard.gpa) <= 0) {
      status = 'NEEDS_REVIEW';
      recommendedAction = 'REVIEW';
      reasons.push('FAILED_SUBJECTS');
    } else {
      reasons.push('READY');
    }

    const lifecycleStatus = student.lifecycleStatus ?? 'ACTIVE';
    if (lifecycleStatus !== 'ACTIVE') {
      status = 'BLOCKED';
      recommendedAction = 'HOLD';
      reasons.push('INVALID_STUDENT_STATUS');
    }

    return {
      studentId: student.id,
      studentName: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
      studentSystemId: student.studentSystemId,
      classId: student.classId,
      className: student.class?.name ?? '',
      sectionId: student.sectionId,
      sectionName: student.sectionRef?.name ?? null,
      reportCardId: reportCard?.id ?? null,
      percentage: reportCard ? Number(reportCard.percentage) : 0,
      grade: reportCard?.grade ?? 'N/A',
      gpa: reportCard ? Number(reportCard.gpa) : 0,
      status,
      reasons,
      recommendedAction,
      lifecycleStatus,
      outstandingBalance: 0,
    };
  }

  private normalizeStatus(status: string): PromotionReadinessStatus {
    const normalized = status.toUpperCase();
    if (normalized === 'REVIEW') return 'NEEDS_REVIEW';
    if (normalized === 'NEEDS_REVIEW') return 'NEEDS_REVIEW';
    if (normalized === 'READY') return 'READY';
    if (normalized === 'BLOCKED') return 'BLOCKED';
    throw new ConflictException('Unsupported promotion readiness status');
  }

  private async ensureAcademicYear(actor: AuthContext, id: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!year) throw new NotFoundException('Academic year not found in this tenant');
  }

  private async ensureExamTerm(
    actor: AuthContext,
    id: string,
    academicYearId: string,
  ) {
    const term = await this.prisma.examTerm.findFirst({
      where: { id, tenantId: actor.tenantId, academicYearId },
    });
    if (!term) throw new NotFoundException('Exam term not found in this academic year');
  }

  private async ensureClass(actor: AuthContext, id: string) {
    const classroom = await this.prisma.class.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!classroom) throw new NotFoundException('Class not found in this tenant');
  }

  private async ensureSection(actor: AuthContext, id: string, classId: string) {
    const section = await this.prisma.section.findFirst({
      where: { id, tenantId: actor.tenantId, classId },
    });
    if (!section) throw new NotFoundException('Section not found in this class');
  }
}
