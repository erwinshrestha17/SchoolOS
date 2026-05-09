import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MarkEntryStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { BatchEnterMarksDto } from './dto/batch-enter-marks.dto';
import { EnterMarkDto } from './dto/enter-mark.dto';

interface MarkFilters {
  examTermId?: string;
  assessmentComponentId?: string;
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  studentId?: string;
}

@Injectable()
export class MarksEntryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: AuthContext, filters: MarkFilters = {}) {
    return this.prisma.markEntry.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.examTermId ? { examTermId: filters.examTermId } : {}),
        ...(filters.assessmentComponentId
          ? { assessmentComponentId: filters.assessmentComponentId }
          : {}),
        ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
        ...(filters.classId
          ? {
              student: {
                classId: filters.classId,
                ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
              },
            }
          : {}),
      },
      include: {
        student: true,
        subject: true,
        assessmentComponent: true,
        examTerm: true,
        enteredBy: {
          select: {
            id: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: [
        { student: { class: { level: 'asc' } } },
        { student: { rollNumber: 'asc' } },
        { student: { firstNameEn: 'asc' } },
      ],
      take: 500,
    });
  }

  async getMarksRoster(
    actor: AuthContext,
    filters: {
      examTermId: string;
      assessmentComponentId: string;
      classId: string;
      sectionId?: string;
    },
  ) {
    const [component, students] = await Promise.all([
      this.prisma.assessmentComponent.findFirst({
        where: {
          id: filters.assessmentComponentId,
          tenantId: actor.tenantId,
          examTermId: filters.examTermId,
        },
        include: { examTerm: true, subject: true },
      }),
      this.prisma.student.findMany({
        where: {
          tenantId: actor.tenantId,
          classId: filters.classId,
          ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
          lifecycleStatus: 'ACTIVE',
        },
        orderBy: [{ rollNumber: 'asc' }, { firstNameEn: 'asc' }],
      }),
    ]);

    if (!component) {
      throw new NotFoundException('Assessment component not found');
    }

    const existingMarks = await this.prisma.markEntry.findMany({
      where: {
        tenantId: actor.tenantId,
        assessmentComponentId: filters.assessmentComponentId,
        studentId: { in: students.map((s) => s.id) },
      },
    });

    const marksMap = new Map(existingMarks.map((m) => [m.studentId, m]));

    return students.map((student) => ({
      studentId: student.id,
      studentName: `${student.firstNameEn} ${student.lastNameEn}`,
      studentSystemId: student.studentSystemId,
      rollNumber: student.rollNumber,
      marksObtained: marksMap.has(student.id)
        ? Number(marksMap.get(student.id)!.marksObtained)
        : null,
      status: marksMap.has(student.id)
        ? marksMap.get(student.id)!.status
        : null,
      remarks: marksMap.has(student.id)
        ? marksMap.get(student.id)!.remarks
        : null,
      isLocked: marksMap.has(student.id)
        ? marksMap.get(student.id)!.isLocked
        : component.examTerm.isLocked,
    }));
  }

  async enterMark(dto: EnterMarkDto, actor: AuthContext) {
    const component = await this.prisma.assessmentComponent.findFirst({
      where: {
        id: dto.assessmentComponentId,
        tenantId: actor.tenantId,
        examTermId: dto.examTermId,
      },
      include: { examTerm: true },
    });

    if (!component) {
      throw new NotFoundException('Assessment component not found');
    }

    if (component.examTerm.isLocked) {
      throw new ConflictException('Exam term is locked');
    }

    this.validateMarkValue(Number(component.maxMarks), dto.marksObtained, dto.status);

    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId: actor.tenantId },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const existingMark = await this.prisma.markEntry.findUnique({
      where: {
        tenantId_assessmentComponentId_studentId: {
          tenantId: actor.tenantId,
          assessmentComponentId: dto.assessmentComponentId,
          studentId: dto.studentId,
        },
      },
    });

    if (existingMark?.isLocked) {
      throw new ConflictException('Mark entry is locked and cannot be edited');
    }

    const marksObtainedValue = this.resolveMarkValue(dto.marksObtained, dto.status);

    const mark = await this.prisma.markEntry.upsert({
      where: {
        tenantId_assessmentComponentId_studentId: {
          tenantId: actor.tenantId,
          assessmentComponentId: dto.assessmentComponentId,
          studentId: dto.studentId,
        },
      },
      update: {
        marksObtained: new Prisma.Decimal(marksObtainedValue),
        status: dto.status || MarkEntryStatus.SUBMITTED,
        remarks: dto.remarks || null,
        enteredById: actor.userId,
      },
      create: {
        tenantId: actor.tenantId,
        examTermId: dto.examTermId,
        assessmentComponentId: dto.assessmentComponentId,
        subjectId: component.subjectId,
        studentId: dto.studentId,
        enteredById: actor.userId,
        marksObtained: new Prisma.Decimal(marksObtainedValue),
        status: dto.status || MarkEntryStatus.SUBMITTED,
        remarks: dto.remarks || null,
      },
    });

    await this.auditService.record({
      action: 'upsert',
      resource: 'mark_entry',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: mark.id,
      after: {
        studentId: mark.studentId,
        componentId: mark.assessmentComponentId,
        marksObtained: Number(mark.marksObtained),
        status: mark.status,
      },
    });

    return mark;
  }

  async batchEnterMarks(dto: BatchEnterMarksDto, actor: AuthContext) {
    const component = await this.prisma.assessmentComponent.findFirst({
      where: {
        id: dto.assessmentComponentId,
        tenantId: actor.tenantId,
        examTermId: dto.examTermId,
      },
      include: { examTerm: true },
    });

    if (!component) {
      throw new NotFoundException('Assessment component not found');
    }

    if (component.examTerm.isLocked) {
      throw new ConflictException('Exam term is locked');
    }

    const studentIds = dto.entries.map((e) => e.studentId);
    const students = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
        tenantId: actor.tenantId,
      },
      select: { id: true },
    });

    const foundIds = new Set(students.map((s) => s.id));
    const missing = studentIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(`Students not found: ${missing.slice(0, 5).join(', ')}`);
    }

    const maxMarks = Number(component.maxMarks);
    for (const entry of dto.entries) {
      this.validateMarkValue(maxMarks, entry.marksObtained, entry.status);
    }

    const existingMarks = await this.prisma.markEntry.findMany({
      where: {
        tenantId: actor.tenantId,
        assessmentComponentId: dto.assessmentComponentId,
        studentId: { in: studentIds },
      },
    });

    const lockedCount = existingMarks.filter((m) => m.isLocked).length;
    if (lockedCount > 0) {
      throw new ConflictException(`${lockedCount} mark entries are locked and cannot be updated`);
    }

    const results = await this.prisma.$transaction(
      dto.entries.map((entry) => {
        const val = this.resolveMarkValue(entry.marksObtained, entry.status);
        return this.prisma.markEntry.upsert({
          where: {
            tenantId_assessmentComponentId_studentId: {
              tenantId: actor.tenantId,
              assessmentComponentId: dto.assessmentComponentId,
              studentId: entry.studentId,
            },
          },
          update: {
            marksObtained: new Prisma.Decimal(val),
            status: entry.status || MarkEntryStatus.SUBMITTED,
            remarks: entry.remarks || null,
            enteredById: actor.userId,
          },
          create: {
            tenantId: actor.tenantId,
            examTermId: dto.examTermId,
            assessmentComponentId: dto.assessmentComponentId,
            subjectId: component.subjectId,
            studentId: entry.studentId,
            enteredById: actor.userId,
            marksObtained: new Prisma.Decimal(val),
            status: entry.status || MarkEntryStatus.SUBMITTED,
            remarks: entry.remarks || null,
          },
        });
      }),
    );

    await this.auditService.record({
      action: 'batch_upsert',
      resource: 'mark_entry',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        componentId: dto.assessmentComponentId,
        count: results.length,
      },
    });

    return { updated: results.length, entries: results };
  }

  private validateMarkValue(maxMarks: number, obtained?: number, status?: MarkEntryStatus) {
    // If absent/missing/withheld, marksObtained is usually ignored or forced to 0
    if (status && status !== MarkEntryStatus.SUBMITTED && status !== MarkEntryStatus.PRESENT) {
      return;
    }

    const val = obtained ?? 0;
    if (val < 0) {
      throw new ConflictException('Marks cannot be negative');
    }
    if (val > maxMarks) {
      throw new ConflictException(`Marks cannot exceed max marks (${maxMarks})`);
    }
  }

  private resolveMarkValue(obtained?: number, status?: MarkEntryStatus): number {
    if (status && status !== MarkEntryStatus.SUBMITTED && status !== MarkEntryStatus.PRESENT) {
      return 0;
    }
    return obtained ?? 0;
  }
}
