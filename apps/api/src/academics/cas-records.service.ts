import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { BatchCasRecordsDto } from './dto/batch-cas-records.dto';
import { CreateCasRecordDto } from './dto/create-cas-record.dto';
import { UpdateCasRecordDto } from './dto/update-cas-record.dto';

interface CasFilters {
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  studentId?: string;
}

@Injectable()
export class CasRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthContext, filters: CasFilters = {}) {
    await this.validateFilters(actor, filters);

    return this.prisma.casRecord.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.academicYearId
          ? { academicYearId: filters.academicYearId }
          : {}),
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
        ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
      },
      include: {
        student: true,
        subject: true,
        class: true,
        section: true,
        academicYear: true,
      },
      orderBy: [{ observedOn: 'desc' }, { createdAt: 'desc' }],
      take: 300,
    });
  }

  async getCasRoster(
    actor: AuthContext,
    filters: {
      classId: string;
      sectionId?: string;
      subjectId: string;
      academicYearId: string;
      category?: string;
    },
  ) {
    await this.ensureCasScope(actor, {
      academicYearId: filters.academicYearId,
      classId: filters.classId,
      sectionId: filters.sectionId,
      subjectId: filters.subjectId,
    });

    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        classId: filters.classId,
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
        lifecycleStatus: 'ACTIVE',
      },
      orderBy: [{ rollNumber: 'asc' }, { firstNameEn: 'asc' }],
    });

    const existingRecords = await this.prisma.casRecord.findMany({
      where: {
        tenantId: actor.tenantId,
        academicYearId: filters.academicYearId,
        classId: filters.classId,
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
        subjectId: filters.subjectId,
        ...(filters.category ? { category: filters.category } : {}),
      },
    });

    // Note: Multiple CAS records can exist for one student if category is different or multiple observations.
    // For a simple roster, we might group by student and category.
    return students.map((student) => ({
      studentId: student.id,
      studentName: `${student.firstNameEn} ${student.lastNameEn}`,
      studentSystemId: student.studentSystemId,
      rollNumber: student.rollNumber,
      records: existingRecords.filter((r) => r.studentId === student.id),
    }));
  }

  async create(dto: CreateCasRecordDto, actor: AuthContext) {
    await this.ensureCasScope(actor, {
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      sectionId: dto.sectionId ?? undefined,
      subjectId: dto.subjectId,
      studentId: dto.studentId,
    });
    this.validateScore(dto.score, dto.maxScore);

    const observedOn = this.parseIsoDateOrThrow(dto.observedOn, 'observedOn');

    const record = await this.prisma.casRecord.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        subjectId: dto.subjectId,
        studentId: dto.studentId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        category: dto.category.trim(),
        score: new Prisma.Decimal(dto.score),
        maxScore: new Prisma.Decimal(dto.maxScore),
        observedOn,
        note: dto.note?.trim() || null,
      },
      include: {
        student: true,
        subject: true,
        class: true,
        section: true,
        academicYear: true,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'cas_record',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: record.id,
      after: this.toAuditPayload(record),
    });

    return record;
  }

  async update(id: string, dto: UpdateCasRecordDto, actor: AuthContext) {
    const existing = await this.prisma.casRecord.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('CAS record not found in this tenant');
    }

    const academicYearId = dto.academicYearId ?? existing.academicYearId;
    const classId = dto.classId ?? existing.classId;
    const sectionId =
      dto.sectionId === undefined ? existing.sectionId : dto.sectionId;
    const subjectId = dto.subjectId ?? existing.subjectId;
    const studentId = dto.studentId ?? existing.studentId;
    const score = dto.score ?? Number(existing.score);
    const maxScore = dto.maxScore ?? Number(existing.maxScore);

    await this.ensureCasScope(actor, {
      academicYearId,
      classId,
      sectionId: sectionId ?? undefined,
      subjectId,
      studentId,
    });
    this.validateScore(score, maxScore);

    const updated = await this.prisma.casRecord.update({
      where: { id: existing.id },
      data: {
        academicYearId,
        classId,
        sectionId: sectionId ?? null,
        subjectId,
        studentId,
        ...(dto.category !== undefined
          ? { category: dto.category.trim() }
          : {}),
        score: new Prisma.Decimal(score),
        maxScore: new Prisma.Decimal(maxScore),
        ...(dto.observedOn !== undefined
          ? {
              observedOn: this.parseIsoDateOrThrow(
                dto.observedOn,
                'observedOn',
              ),
            }
          : {}),
        ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
      },
      include: {
        student: true,
        subject: true,
        class: true,
        section: true,
        academicYear: true,
      },
    });

    await this.auditService.record({
      action: 'update',
      resource: 'cas_record',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: this.toAuditPayload(existing),
      after: this.toAuditPayload(updated),
    });

    return updated;
  }

  async delete(id: string, actor: AuthContext) {
    const existing = await this.prisma.casRecord.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('CAS record not found in this tenant');
    }

    await this.prisma.casRecord.delete({ where: { id: existing.id } });

    await this.auditService.record({
      action: 'delete',
      resource: 'cas_record',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: existing.id,
      before: this.toAuditPayload(existing),
    });

    return { deleted: true, casRecordId: id };
  }

  async batchCreate(dto: BatchCasRecordsDto, actor: AuthContext) {
    await this.ensureCasScope(actor, {
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      sectionId: dto.sectionId ?? undefined,
      subjectId: dto.subjectId,
    });
    this.validateScore(0, dto.maxScore);

    const observedOn = this.parseIsoDateOrThrow(dto.observedOn, 'observedOn');
    const studentIds = dto.entries.map((entry) => entry.studentId);
    const students = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
        tenantId: actor.tenantId,
        classId: dto.classId,
        ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
      },
      select: { id: true },
    });

    const foundIds = new Set(students.map((student) => student.id));
    const missing = studentIds.filter((studentId) => !foundIds.has(studentId));
    if (missing.length > 0) {
      throw new NotFoundException(
        `Students not found for this CAS scope: ${missing.slice(0, 5).join(', ')}`,
      );
    }

    const overMax = dto.entries.filter((entry) => entry.score > dto.maxScore);
    if (overMax.length > 0) {
      throw new ConflictException(
        `${overMax.length} CAS entries exceed max score (${dto.maxScore})`,
      );
    }

    const created = await this.prisma.$transaction(
      dto.entries.map((entry) =>
        this.prisma.casRecord.create({
          data: {
            tenantId: actor.tenantId,
            academicYearId: dto.academicYearId,
            subjectId: dto.subjectId,
            studentId: entry.studentId,
            classId: dto.classId,
            sectionId: dto.sectionId ?? null,
            category: dto.category.trim(),
            score: new Prisma.Decimal(entry.score),
            maxScore: new Prisma.Decimal(dto.maxScore),
            observedOn,
            note: entry.note?.trim() || null,
          },
          include: {
            student: true,
            subject: true,
            class: true,
            section: true,
            academicYear: true,
          },
        }),
      ),
    );

    await this.auditService.record({
      action: 'batch_create',
      resource: 'cas_record',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        subjectId: dto.subjectId,
        category: dto.category,
        count: created.length,
      },
    });

    return { created: created.length, entries: created };
  }

  private async validateFilters(actor: AuthContext, filters: CasFilters) {
    if (filters.academicYearId) {
      await this.ensureAcademicYear(actor, filters.academicYearId);
    }
    if (filters.classId) {
      await this.ensureClass(actor, filters.classId);
    }
    if (filters.sectionId) {
      await this.ensureSection(actor, filters.sectionId, filters.classId);
    }
    if (filters.subjectId) {
      await this.ensureSubject(actor, filters.subjectId, filters.classId);
    }
    if (filters.studentId) {
      await this.ensureStudent(
        actor,
        filters.studentId,
        filters.classId,
        filters.sectionId,
      );
    }
  }

  private async ensureCasScope(
    actor: AuthContext,
    scope: {
      academicYearId: string;
      classId: string;
      sectionId?: string;
      subjectId: string;
      studentId?: string;
    },
  ) {
    await Promise.all([
      this.ensureAcademicYear(actor, scope.academicYearId),
      this.ensureClass(actor, scope.classId),
      this.ensureSubject(actor, scope.subjectId, scope.classId),
    ]);

    if (scope.sectionId) {
      await this.ensureSection(actor, scope.sectionId, scope.classId);
    }

    if (scope.studentId) {
      await this.ensureStudent(
        actor,
        scope.studentId,
        scope.classId,
        scope.sectionId,
      );
    }
  }

  private async ensureAcademicYear(actor: AuthContext, academicYearId: string) {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId: actor.tenantId },
    });
    if (!academicYear) {
      throw new NotFoundException('Academic year not found in this tenant');
    }
  }

  private async ensureClass(actor: AuthContext, classId: string) {
    const classRecord = await this.prisma.class.findFirst({
      where: { id: classId, tenantId: actor.tenantId },
    });
    if (!classRecord) {
      throw new NotFoundException('Class not found in this tenant');
    }
  }

  private async ensureSection(
    actor: AuthContext,
    sectionId: string,
    classId?: string,
  ) {
    const section = await this.prisma.section.findFirst({
      where: {
        id: sectionId,
        tenantId: actor.tenantId,
        ...(classId ? { classId } : {}),
      },
    });
    if (!section) {
      throw new NotFoundException('Section not found in this tenant/class');
    }
  }

  private async ensureSubject(
    actor: AuthContext,
    subjectId: string,
    classId?: string,
  ) {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        tenantId: actor.tenantId,
        ...(classId ? { classId } : {}),
      },
    });
    if (!subject) {
      throw new NotFoundException('Subject not found in this tenant/class');
    }
  }

  private async ensureStudent(
    actor: AuthContext,
    studentId: string,
    classId?: string,
    sectionId?: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
        ...(classId ? { classId } : {}),
        ...(sectionId ? { sectionId } : {}),
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this CAS scope');
    }
  }

  private validateScore(score: number, maxScore: number) {
    if (maxScore <= 0) {
      throw new ConflictException('maxScore must be greater than zero');
    }
    if (score < 0) {
      throw new ConflictException('score cannot be negative');
    }
    if (score > maxScore) {
      throw new ConflictException('score cannot exceed maxScore');
    }
  }

  private parseIsoDateOrThrow(value: string, fieldName: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new ConflictException(`${fieldName} must be a valid ISO date`);
    }
    return parsed;
  }

  private toAuditPayload(record: {
    academicYearId: string;
    classId: string;
    sectionId: string | null;
    subjectId: string;
    studentId: string;
    category: string;
    score: Prisma.Decimal | number;
    maxScore: Prisma.Decimal | number;
    observedOn: Date;
    note: string | null;
  }) {
    return {
      academicYearId: record.academicYearId,
      classId: record.classId,
      sectionId: record.sectionId,
      subjectId: record.subjectId,
      studentId: record.studentId,
      category: record.category,
      score: Number(record.score),
      maxScore: Number(record.maxScore),
      observedOn: record.observedOn,
      note: record.note,
    };
  }
}
