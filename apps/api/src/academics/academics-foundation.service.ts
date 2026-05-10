import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExamTermDto } from './dto/create-exam-term.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { UpdateExamTermDto } from './dto/update-exam-term.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';

interface ExamTermFilters {
  academicYearId?: string;
}

interface SubjectFilters {
  classId?: string;
}

@Injectable()
export class AcademicsFoundationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listExamTerms(actor: AuthContext, filters: ExamTermFilters = {}) {
    if (filters.academicYearId) {
      await this.ensureAcademicYear(actor, filters.academicYearId);
    }

    return this.prisma.examTerm.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.academicYearId
          ? { academicYearId: filters.academicYearId }
          : {}),
      },
      include: {
        academicYear: true,
        components: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: [{ startsOn: 'desc' }, { name: 'asc' }],
      take: 100,
    });
  }

  async createExamTerm(dto: CreateExamTermDto, actor: AuthContext) {
    await this.ensureAcademicYear(actor, dto.academicYearId);

    const startsOn = this.parseIsoDateOrThrow(dto.startsOn, 'startsOn');
    const endsOn = this.parseIsoDateOrThrow(dto.endsOn, 'endsOn');
    this.ensureDateRange(startsOn, endsOn);

    const requestedWeight = new Prisma.Decimal(dto.weightPercent ?? 100);
    await this.ensureExamTermWeightLimit(
      actor,
      dto.academicYearId,
      requestedWeight,
    );

    const term = await this.prisma.examTerm.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        name: dto.name.trim(),
        startsOn,
        endsOn,
        weightPercent: requestedWeight,
        status: dto.status || 'ACTIVE',
      },
      include: {
        academicYear: true,
        components: {
          include: { subject: true },
        },
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'exam_term',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: term.id,
      after: {
        academicYearId: term.academicYearId,
        name: term.name,
        startsOn: term.startsOn,
        endsOn: term.endsOn,
        weightPercent: Number(term.weightPercent),
      },
    });

    return term;
  }

  async updateExamTerm(
    examTermId: string,
    dto: UpdateExamTermDto,
    actor: AuthContext,
  ) {
    const existing = await this.prisma.examTerm.findFirst({
      where: { id: examTermId, tenantId: actor.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Exam term not found in this tenant');
    }

    if (existing.isLocked) {
      throw new ConflictException('Locked exam terms cannot be updated');
    }

    const academicYearId = dto.academicYearId ?? existing.academicYearId;
    if (dto.academicYearId) {
      await this.ensureAcademicYear(actor, dto.academicYearId);
    }

    const startsOn = dto.startsOn
      ? this.parseIsoDateOrThrow(dto.startsOn, 'startsOn')
      : existing.startsOn;
    const endsOn = dto.endsOn
      ? this.parseIsoDateOrThrow(dto.endsOn, 'endsOn')
      : existing.endsOn;
    this.ensureDateRange(startsOn, endsOn);

    const weightPercent =
      dto.weightPercent === undefined
        ? existing.weightPercent
        : new Prisma.Decimal(dto.weightPercent);

    await this.ensureExamTermWeightLimit(
      actor,
      academicYearId,
      weightPercent,
      examTermId,
    );

    const updated = await this.prisma.examTerm.update({
      where: { id: existing.id },
      data: {
        academicYearId,
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        startsOn,
        endsOn,
        weightPercent,
        status: dto.status ?? existing.status,
      },
      include: {
        academicYear: true,
        components: {
          include: { subject: true },
        },
      },
    });

    await this.auditService.record({
      action: 'update',
      resource: 'exam_term',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: {
        academicYearId: existing.academicYearId,
        name: existing.name,
        startsOn: existing.startsOn,
        endsOn: existing.endsOn,
        weightPercent: Number(existing.weightPercent),
      },
      after: {
        academicYearId: updated.academicYearId,
        name: updated.name,
        startsOn: updated.startsOn,
        endsOn: updated.endsOn,
        weightPercent: Number(updated.weightPercent),
      },
    });

    return updated;
  }

  async deleteExamTerm(examTermId: string, actor: AuthContext) {
    const existing = await this.prisma.examTerm.findFirst({
      where: { id: examTermId, tenantId: actor.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Exam term not found in this tenant');
    }

    if (existing.isLocked) {
      throw new ConflictException('Locked exam terms cannot be deleted');
    }

    const [componentCount, markCount, reportCardCount, timetableCount] =
      await Promise.all([
        this.prisma.assessmentComponent.count({
          where: { tenantId: actor.tenantId, examTermId },
        }),
        this.prisma.markEntry.count({
          where: { tenantId: actor.tenantId, examTermId },
        }),
        this.prisma.reportCard.count({
          where: { tenantId: actor.tenantId, examTermId },
        }),
        this.prisma.examTimetableSlot.count({
          where: { tenantId: actor.tenantId, examTermId },
        }),
      ]);

    const dependencyCount =
      componentCount + markCount + reportCardCount + timetableCount;
    if (dependencyCount > 0) {
      throw new ConflictException(
        'Exam term has assessment, timetable, marks, or report card records and cannot be deleted',
      );
    }

    await this.prisma.examTerm.delete({ where: { id: existing.id } });

    await this.auditService.record({
      action: 'delete',
      resource: 'exam_term',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: existing.id,
      before: {
        academicYearId: existing.academicYearId,
        name: existing.name,
      },
    });

    return { deleted: true, examTermId };
  }

  async archiveExamTerm(examTermId: string, actor: AuthContext) {
    const existing = await this.prisma.examTerm.findFirst({
      where: { id: examTermId, tenantId: actor.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Exam term not found in this tenant');
    }

    const updated = await this.prisma.examTerm.update({
      where: { id: existing.id },
      data: { status: 'ARCHIVED' },
    });

    await this.auditService.record({
      action: 'archive',
      resource: 'exam_term',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      after: { status: 'ARCHIVED' },
    });

    return updated;
  }

  async listSubjects(actor: AuthContext, filters: SubjectFilters = {}) {
    if (filters.classId) {
      await this.ensureClass(actor, filters.classId);
    }

    return this.prisma.subject.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.classId ? { classId: filters.classId } : {}),
      },
      include: {
        class: true,
        teacherAssignments: {
          include: {
            staff: true,
            section: true,
            academicYear: true,
          },
        },
      },
      orderBy: [{ class: { level: 'asc' } }, { code: 'asc' }],
      take: 100,
    });
  }

  async createSubject(dto: CreateSubjectDto, actor: AuthContext) {
    await this.ensureClass(actor, dto.classId);
    await this.ensureUniqueSubjectCode(actor, dto.classId, dto.code);

    const subject = await this.prisma.subject.create({
      data: this.buildSubjectData(dto, actor.tenantId),
      include: {
        class: true,
        teacherAssignments: {
          include: {
            staff: true,
            section: true,
            academicYear: true,
          },
        },
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'subject',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: subject.id,
      after: {
        code: subject.code,
        classId: subject.classId,
        name: subject.name,
      },
    });

    return subject;
  }

  async updateSubject(
    subjectId: string,
    dto: UpdateSubjectDto,
    actor: AuthContext,
  ) {
    const existing = await this.prisma.subject.findFirst({
      where: { id: subjectId, tenantId: actor.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Subject not found in this tenant');
    }

    const classId = dto.classId ?? existing.classId;
    if (dto.classId) {
      await this.ensureClass(actor, dto.classId);
    }

    const code = dto.code?.trim() ?? existing.code;
    if (code !== existing.code || classId !== existing.classId) {
      await this.ensureUniqueSubjectCode(actor, classId, code, subjectId);
    }

    const updated = await this.prisma.subject.update({
      where: { id: existing.id },
      data: {
        classId,
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        code,
        ...(dto.type !== undefined ? { type: dto.type.trim() } : {}),
        ...(dto.hasPractical !== undefined
          ? { hasPractical: dto.hasPractical }
          : {}),
        ...(dto.theoryMarks !== undefined
          ? { theoryMarks: dto.theoryMarks }
          : {}),
        ...(dto.practicalMarks !== undefined
          ? { practicalMarks: dto.practicalMarks }
          : {}),
        ...(dto.passMarks !== undefined ? { passMarks: dto.passMarks } : {}),
      },
      include: {
        class: true,
        teacherAssignments: {
          include: {
            staff: true,
            section: true,
            academicYear: true,
          },
        },
      },
    });

    await this.auditService.record({
      action: 'update',
      resource: 'subject',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: {
        classId: existing.classId,
        code: existing.code,
        name: existing.name,
        type: existing.type,
      },
      after: {
        classId: updated.classId,
        code: updated.code,
        name: updated.name,
        type: updated.type,
      },
    });

    return updated;
  }

  async deleteSubject(subjectId: string, actor: AuthContext) {
    const existing = await this.prisma.subject.findFirst({
      where: { id: subjectId, tenantId: actor.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Subject not found in this tenant');
    }

    const [componentCount, markCount, casCount, timetableCount, homeworkCount] =
      await Promise.all([
        this.prisma.assessmentComponent.count({
          where: { tenantId: actor.tenantId, subjectId },
        }),
        this.prisma.markEntry.count({
          where: { tenantId: actor.tenantId, subjectId },
        }),
        this.prisma.casRecord.count({
          where: { tenantId: actor.tenantId, subjectId },
        }),
        this.prisma.timetableSlot.count({
          where: { tenantId: actor.tenantId, subjectId },
        }),
        this.prisma.homeworkAssignment.count({
          where: { tenantId: actor.tenantId, subjectId },
        }),
      ]);

    const dependencyCount =
      componentCount + markCount + casCount + timetableCount + homeworkCount;
    if (dependencyCount > 0) {
      throw new ConflictException(
        'Subject has academic, timetable, or homework records and cannot be deleted',
      );
    }

    await this.prisma.subject.delete({ where: { id: existing.id } });

    await this.auditService.record({
      action: 'delete',
      resource: 'subject',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: existing.id,
      before: {
        classId: existing.classId,
        code: existing.code,
        name: existing.name,
      },
    });

    return { deleted: true, subjectId };
  }

  private async ensureAcademicYear(actor: AuthContext, academicYearId: string) {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId: actor.tenantId },
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found in this tenant');
    }

    return academicYear;
  }

  private async ensureClass(actor: AuthContext, classId: string) {
    const classRecord = await this.prisma.class.findFirst({
      where: { id: classId, tenantId: actor.tenantId },
    });

    if (!classRecord) {
      throw new NotFoundException('Class not found in this tenant');
    }

    return classRecord;
  }

  private async ensureUniqueSubjectCode(
    actor: AuthContext,
    classId: string,
    code: string,
    excludeSubjectId?: string,
  ) {
    const existing = await this.prisma.subject.findFirst({
      where: {
        tenantId: actor.tenantId,
        classId,
        code: code.trim(),
        ...(excludeSubjectId ? { id: { not: excludeSubjectId } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException(
        'Subject code already exists for this class in this tenant',
      );
    }
  }

  private async ensureExamTermWeightLimit(
    actor: AuthContext,
    academicYearId: string,
    requestedWeight: Prisma.Decimal,
    excludeExamTermId?: string,
  ) {
    const aggregate = await this.prisma.examTerm.aggregate({
      where: {
        tenantId: actor.tenantId,
        academicYearId,
        ...(excludeExamTermId ? { id: { not: excludeExamTermId } } : {}),
      },
      _sum: { weightPercent: true },
    });

    const totalWeight =
      Number(aggregate._sum.weightPercent ?? 0) + Number(requestedWeight);
    if (totalWeight > 100) {
      throw new ConflictException(
        'Total exam term weight for the academic year cannot exceed 100%',
      );
    }
  }

  private parseIsoDateOrThrow(value: string, fieldName: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new ConflictException(`${fieldName} must be a valid ISO date`);
    }

    return parsed;
  }

  private ensureDateRange(startsOn: Date, endsOn: Date) {
    if (startsOn > endsOn) {
      throw new ConflictException('Exam term startsOn cannot be after endsOn');
    }
  }

  private buildSubjectData(dto: CreateSubjectDto, tenantId: string) {
    return {
      tenantId,
      classId: dto.classId,
      name: dto.name.trim(),
      code: dto.code.trim(),
      type: dto.type.trim(),
      hasPractical: dto.hasPractical ?? false,
      theoryMarks: dto.theoryMarks ?? null,
      practicalMarks:
        dto.practicalMarks === undefined ? null : dto.practicalMarks,
      passMarks: dto.passMarks ?? null,
    };
  }
}
