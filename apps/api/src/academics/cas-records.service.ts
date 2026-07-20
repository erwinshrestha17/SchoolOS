import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StaffStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { isTeacherOnly } from '../common/security/parent-scope';
import { BulkUpsertCasRecordsDto } from './dto/bulk-upsert-cas-records.dto';
import { CreateCasRecordDto } from './dto/create-cas-record.dto';
import { ListCasRecordsDto } from './dto/list-cas-records.dto';
import { UpdateCasRecordDto } from './dto/update-cas-record.dto';

@Injectable()
export class CasRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthContext, filters: ListCasRecordsDto) {
    const {
      academicYearId,
      classId,
      sectionId,
      subjectId,
      studentId,
      category,
      fromDate,
      toDate,
      search,
      page = 1,
      limit = 100,
    } = filters;

    const skip = (page - 1) * limit;

    // Confirmed gap: this was scoped only by tenantId, with classId/sectionId
    // caller-supplied and optional -- any actor with cas-records:read
    // (a base teacher included) got every CAS record (character/behavior
    // notes) in the tenant when no filter was supplied. create/update already
    // call ensureCasScope for referential checks; this adds the missing
    // actor-scoping to the read path.
    const teacherFilter = await this.buildTeacherCasScopeFilter(actor);
    if (teacherFilter === 'NONE') {
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }

    const where: Prisma.CasRecordWhereInput = {
      tenantId: actor.tenantId,
      ...(academicYearId ? { academicYearId } : {}),
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(studentId ? { studentId } : {}),
      ...(teacherFilter ?? {}),
      ...(category
        ? { category: { contains: category, mode: 'insensitive' } }
        : {}),
      ...(fromDate || toDate
        ? {
            observedOn: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            student: {
              OR: [
                { firstNameEn: { contains: search, mode: 'insensitive' } },
                { lastNameEn: { contains: search, mode: 'insensitive' } },
                { studentSystemId: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.casRecord.count({ where }),
      this.prisma.casRecord.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              firstNameEn: true,
              lastNameEn: true,
              studentSystemId: true,
            },
          },
          subject: true,
          class: true,
          section: true,
        },
        orderBy: [{ observedOn: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, actor: AuthContext) {
    const record = await this.prisma.casRecord.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        student: true,
        subject: true,
        class: true,
        section: true,
        academicYear: true,
      },
    });

    if (!record) {
      throw new NotFoundException('CAS record not found in this tenant');
    }

    if (isTeacherOnly(actor)) {
      const classSections = await this.getTeacherAssignedClassSections(actor);
      const inScope = classSections.some(
        (cs) =>
          cs.classId === record.classId &&
          (cs.sectionId === null || cs.sectionId === record.sectionId),
      );
      if (!inScope) {
        throw new ForbiddenException(
          'CAS record is outside your teaching scope',
        );
      }
    }

    return record;
  }

  /**
   * Returns `null` for non-teacher (privileged) actors -- no restriction.
   * Returns the literal string 'NONE' when a teacher-only actor has no
   * active teaching assignment at all, distinguishing "see nothing" from
   * "see everything" without an ambiguous empty-array/empty-object return.
   */
  private async buildTeacherCasScopeFilter(
    actor: AuthContext,
  ): Promise<Prisma.CasRecordWhereInput | 'NONE' | null> {
    if (!isTeacherOnly(actor)) return null;

    const classSections = await this.getTeacherAssignedClassSections(actor);
    if (classSections.length === 0) return 'NONE';

    return {
      OR: classSections.flatMap(({ classId, sectionId }) =>
        sectionId
          ? [{ classId, sectionId }, { classId, sectionId: null }]
          : [{ classId, sectionId: null }],
      ),
    };
  }

  private async getTeacherAssignedClassSections(
    actor: AuthContext,
  ): Promise<Array<{ classId: string; sectionId: string | null }>> {
    const staff = await this.prisma.staff.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        status: StaffStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!staff) return [];

    const [assignments, classTeacherSections] = await Promise.all([
      this.prisma.subjectTeacherAssignment.findMany({
        where: { tenantId: actor.tenantId, staffId: staff.id },
        select: { classId: true, sectionId: true },
      }),
      this.prisma.section.findMany({
        where: { tenantId: actor.tenantId, classTeacherId: staff.id },
        select: { id: true, classId: true },
      }),
    ]);

    const combos = new Map<
      string,
      { classId: string; sectionId: string | null }
    >();
    for (const a of assignments) {
      combos.set(`${a.classId}:${a.sectionId ?? 'none'}`, {
        classId: a.classId,
        sectionId: a.sectionId,
      });
    }
    for (const s of classTeacherSections) {
      combos.set(`${s.classId}:${s.id}`, { classId: s.classId, sectionId: s.id });
    }
    return Array.from(combos.values());
  }

  async create(dto: CreateCasRecordDto, actor: AuthContext) {
    await this.ensureCasScope(actor, {
      academicYearId: dto.academicYearId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      subjectId: dto.subjectId,
      studentId: dto.studentId,
    });

    const score = dto.score ?? 0;
    const maxScore = dto.maxScore ?? 100;
    this.validateScore(score, maxScore);

    const observedOn = dto.recordedAt
      ? new Date(dto.recordedAt)
      : dto.observedOn
        ? new Date(dto.observedOn)
        : new Date();

    const note = [dto.observation, dto.remarks, dto.note]
      .filter(Boolean)
      .join(' | ');

    const record = await this.prisma.casRecord.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        subjectId: dto.subjectId ?? null,
        studentId: dto.studentId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        category: dto.category.trim(),
        score: new Prisma.Decimal(score),
        maxScore: new Prisma.Decimal(maxScore),
        observedOn,
        note: note.trim() || null,
      },
      include: {
        student: true,
        subject: true,
        class: true,
        section: true,
      },
    });

    await this.auditService.record({
      action: 'ACADEMICS_CAS_RECORD_CREATED',
      resource: 'cas_record',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: record.id,
      after: this.toAuditPayload(record),
    });

    return record;
  }

  async update(id: string, dto: UpdateCasRecordDto, actor: AuthContext) {
    const existing = await this.findOne(id, actor);

    const score = dto.score ?? Number(existing.score);
    const maxScore = dto.maxScore ?? Number(existing.maxScore);
    this.validateScore(score, maxScore);

    const observedOn = dto.recordedAt
      ? new Date(dto.recordedAt)
      : dto.observedOn
        ? new Date(dto.observedOn)
        : existing.observedOn;

    const note =
      [dto.observation, dto.remarks].filter(Boolean).join(' | ') ||
      existing.note;

    const updated = await this.prisma.casRecord.update({
      where: { id },
      data: {
        ...(dto.category ? { category: dto.category.trim() } : {}),
        score: new Prisma.Decimal(score),
        maxScore: new Prisma.Decimal(maxScore),
        observedOn,
        note,
      },
      include: {
        student: true,
        subject: true,
        class: true,
        section: true,
      },
    });

    await this.auditService.record({
      action: 'ACADEMICS_CAS_RECORD_UPDATED',
      resource: 'cas_record',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: updated.id,
      before: this.toAuditPayload(existing),
      after: this.toAuditPayload(updated),
    });

    return updated;
  }

  async bulkUpsert(dto: BulkUpsertCasRecordsDto, actor: AuthContext) {
    const {
      academicYearId,
      classId,
      sectionId,
      subjectId,
      category,
      maxScore,
      observedOn,
      entries,
    } = dto;

    await Promise.all([
      this.ensureAcademicYear(actor, academicYearId),
      this.ensureClass(actor, classId),
      subjectId
        ? this.ensureSubject(actor, subjectId, classId)
        : Promise.resolve(),
      sectionId
        ? this.ensureSection(actor, sectionId, classId)
        : Promise.resolve(),
    ]);

    const studentIds = entries.map((e) => e.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      throw new ConflictException('Duplicate student entries in request');
    }

    const students = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
        tenantId: actor.tenantId,
        classId,
        ...(sectionId ? { sectionId } : {}),
      },
    });

    if (students.length !== studentIds.length) {
      throw new NotFoundException(
        'One or more students not found in class/section scope',
      );
    }

    const date = new Date(observedOn);
    const notePrefix = category.trim();

    const results = await this.prisma.$transaction(
      entries.map((entry) => {
        const note = [entry.observation, entry.remarks]
          .filter(Boolean)
          .join(' | ');
        return this.prisma.casRecord.create({
          data: {
            tenantId: actor.tenantId,
            academicYearId,
            classId,
            sectionId: sectionId ?? null,
            subjectId: subjectId ?? null,
            studentId: entry.studentId,
            category: notePrefix,
            score: new Prisma.Decimal(entry.score ?? 0),
            maxScore: new Prisma.Decimal(maxScore),
            observedOn: date,
            note: note || null,
          },
        });
      }),
    );

    await this.auditService.record({
      action: 'ACADEMICS_CAS_RECORDS_BULK_UPSERTED',
      resource: 'cas_record',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        count: results.length,
        academicYearId,
        classId,
        subjectId,
        category,
      },
    });

    return { count: results.length, items: results };
  }

  async delete(id: string, actor: AuthContext) {
    const existing = await this.findOne(id, actor);

    await this.prisma.casRecord.delete({ where: { id } });

    await this.auditService.record({
      action: 'delete',
      resource: 'cas_record',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: id,
      before: this.toAuditPayload(existing),
    });

    return { deleted: true };
  }

  private async ensureCasScope(
    actor: AuthContext,
    scope: {
      academicYearId: string;
      classId: string;
      sectionId?: string;
      subjectId?: string;
      studentId?: string;
    },
  ) {
    const checks = [
      this.ensureAcademicYear(actor, scope.academicYearId),
      this.ensureClass(actor, scope.classId),
    ];

    if (scope.subjectId) {
      checks.push(this.ensureSubject(actor, scope.subjectId, scope.classId));
    }
    if (scope.sectionId) {
      checks.push(this.ensureSection(actor, scope.sectionId, scope.classId));
    }
    if (scope.studentId) {
      checks.push(
        this.ensureStudent(
          actor,
          scope.studentId,
          scope.classId,
          scope.sectionId,
        ),
      );
    }

    await Promise.all(checks);
  }

  private async ensureAcademicYear(actor: AuthContext, id: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!year) throw new NotFoundException(`Academic year ${id} not found`);
  }

  private async ensureClass(actor: AuthContext, id: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!cls) throw new NotFoundException(`Class ${id} not found`);
  }

  private async ensureSubject(actor: AuthContext, id: string, classId: string) {
    const sub = await this.prisma.subject.findFirst({
      where: { id, tenantId: actor.tenantId, classId },
    });
    if (!sub) throw new NotFoundException(`Subject ${id} not found in class`);
  }

  private async ensureSection(actor: AuthContext, id: string, classId: string) {
    const sec = await this.prisma.section.findFirst({
      where: { id, tenantId: actor.tenantId, classId },
    });
    if (!sec) throw new NotFoundException(`Section ${id} not found in class`);
  }

  private async ensureStudent(
    actor: AuthContext,
    id: string,
    classId: string,
    sectionId?: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: {
        id,
        tenantId: actor.tenantId,
        classId,
        ...(sectionId ? { sectionId } : {}),
      },
    });
    if (!student)
      throw new NotFoundException(`Student ${id} not found in scope`);
  }

  private validateScore(score: number, maxScore: number) {
    if (score < 0) throw new ConflictException('Score cannot be negative');
    if (score > maxScore)
      throw new ConflictException(`Score ${score} exceeds max ${maxScore}`);
  }

  private toAuditPayload(record: {
    id: string;
    studentId: string;
    subjectId?: string | null;
    category: string;
    score: Prisma.Decimal | number;
    maxScore: Prisma.Decimal | number;
    observedOn: Date;
  }) {
    return {
      id: record.id,
      studentId: record.studentId,
      subjectId: record.subjectId,
      category: record.category,
      score: Number(record.score),
      maxScore: Number(record.maxScore),
      observedOn: record.observedOn,
    };
  }
}
