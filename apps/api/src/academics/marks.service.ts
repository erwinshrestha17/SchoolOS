import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MarkEntryStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { BulkUpsertMarksDto } from './dto/bulk-upsert-marks.dto';
import { ListMarksDto } from './dto/list-marks.dto';
import { UpdateMarkDto } from './dto/update-mark.dto';

@Injectable()
export class MarksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async bulkUpsert(dto: BulkUpsertMarksDto, actor: AuthContext) {
    const examTerm = await this.prisma.examTerm.findFirst({
      where: { id: dto.examTermId, tenantId: actor.tenantId },
    });
    if (!examTerm) {
      throw new NotFoundException('Exam term not found');
    }

    const component = await this.prisma.assessmentComponent.findFirst({
      where: {
        id: dto.assessmentComponentId,
        tenantId: actor.tenantId,
        examTermId: dto.examTermId,
        subjectId: dto.subjectId,
      },
      include: {
        subject: {
          include: { class: true },
        },
      },
    });
    if (!component) {
      throw new NotFoundException(
        'Assessment component not found for the given term and subject',
      );
    }

    if (component.subject.classId !== dto.classId) {
      throw new ConflictException('Subject does not belong to the given class');
    }

    if (dto.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: {
          id: dto.sectionId,
          tenantId: actor.tenantId,
          classId: dto.classId,
        },
      });
      if (!section) {
        throw new NotFoundException('Section not found for the given class');
      }
    }

    const studentIds = dto.entries.map((e) => e.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      throw new ConflictException('Duplicate student entries in request');
    }

    const students = await this.prisma.student.findMany({
      where: {
        id: { in: studentIds },
        tenantId: actor.tenantId,
        classId: dto.classId,
        ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
      },
    });
    if (students.length !== studentIds.length) {
      throw new NotFoundException(
        'One or more students not found in the given class/section scope',
      );
    }

    const maxMarks = Number(component.maxMarks);
    for (const entry of dto.entries) {
      const activeStatesCount =
        (entry.isAbsent ? 1 : 0) +
        (entry.isWithheld ? 1 : 0) +
        (entry.isRetest ? 1 : 0);

      if (activeStatesCount > 1) {
        throw new ConflictException(
          'Entry can only be one of absent, withheld, or retest',
        );
      }

      if (!entry.isAbsent && !entry.isWithheld) {
        if (entry.marksObtained === undefined || entry.marksObtained === null) {
          throw new ConflictException(
            'marksObtained is required if not absent or withheld',
          );
        }
        if (entry.marksObtained < 0 || entry.marksObtained > maxMarks) {
          throw new ConflictException(
            `marksObtained must be between 0 and ${maxMarks}`,
          );
        }
      }
    }

    const approvedCorrections = await this.prisma.reportCardCorrectionRequest.findMany({
      where: {
        tenantId: actor.tenantId,
        status: 'APPROVED',
        reportCard: {
          examTermId: dto.examTermId,
          studentId: { in: studentIds },
        },
      },
      include: {
        reportCard: true,
      },
    });
    const approvedStudentIds = new Set(
      approvedCorrections.map((c) => c.reportCard.studentId),
    );

    if (examTerm.isLocked) {
      const unapprovedStudents = studentIds.filter((id) => !approvedStudentIds.has(id));
      if (unapprovedStudents.length > 0) {
        throw new ConflictException(
          `Cannot enter or update marks because the exam term is locked and no approved correction request exists for student(s): ${unapprovedStudents.join(', ')}`,
        );
      }
    }

    const existingMarks = await this.prisma.markEntry.findMany({
      where: {
        tenantId: actor.tenantId,
        assessmentComponentId: dto.assessmentComponentId,
        studentId: { in: studentIds },
      },
    });

    for (const mark of existingMarks) {
      if (mark.isLocked && !approvedStudentIds.has(mark.studentId)) {
        throw new ConflictException(
          `Cannot update locked mark entry for student ${mark.studentId} without an approved correction request`,
        );
      }
    }

    const results = await this.prisma.$transaction(
      dto.entries.map((entry) => {
        let status: MarkEntryStatus = MarkEntryStatus.SUBMITTED;
        if (entry.isAbsent) status = MarkEntryStatus.ABSENT;
        else if (entry.isWithheld) status = MarkEntryStatus.WITHHELD;
        else if (entry.isRetest) status = MarkEntryStatus.RETEST;

        const val = entry.marksObtained ?? 0;

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
            status,
            remarks: entry.remarks || null,
            enteredById: actor.userId,
            isLocked: examTerm.isLocked,
          },
          create: {
            tenantId: actor.tenantId,
            examTermId: dto.examTermId,
            assessmentComponentId: dto.assessmentComponentId,
            subjectId: dto.subjectId,
            studentId: entry.studentId,
            enteredById: actor.userId,
            marksObtained: new Prisma.Decimal(val),
            status,
            remarks: entry.remarks || null,
            isLocked: examTerm.isLocked,
          },
        });
      }),
    );

    await this.auditService.record({
      action: 'ACADEMICS_MARKS_BULK_UPSERTED',
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

  async listMarks(actor: AuthContext, dto: ListMarksDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 100;
    const skip = (page - 1) * limit;

    const where: Prisma.MarkEntryWhereInput = {
      tenantId: actor.tenantId,
      ...(dto.examTermId ? { examTermId: dto.examTermId } : {}),
      ...(dto.assessmentComponentId
        ? { assessmentComponentId: dto.assessmentComponentId }
        : {}),
      ...(dto.subjectId ? { subjectId: dto.subjectId } : {}),
      ...(dto.studentId ? { studentId: dto.studentId } : {}),
    };

    if (dto.classId || dto.sectionId || dto.search) {
      where.student = {
        ...(dto.classId ? { classId: dto.classId } : {}),
        ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
        ...(dto.search
          ? {
              OR: [
                { firstNameEn: { contains: dto.search, mode: 'insensitive' } },
                {
                  studentSystemId: {
                    contains: dto.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      };
    }

    if (dto.status) {
      where.status = dto.status as MarkEntryStatus;
    }

    const [items, total] = await Promise.all([
      this.prisma.markEntry.findMany({
        where,
        include: {
          student: true,
          subject: true,
          assessmentComponent: true,
          examTerm: true,
        },
        orderBy: [
          { student: { class: { level: 'asc' } } },
          { student: { rollNumber: 'asc' } },
          { student: { firstNameEn: 'asc' } },
        ],
        skip,
        take: limit,
      }),
      this.prisma.markEntry.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStudentHistory(
    studentId: string,
    actor: AuthContext,
    options: {
      academicYearId?: string;
      examTermId?: string;
      subjectId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
    });
    if (!student) {
      throw new NotFoundException('Student not found in tenant');
    }

    const page = options.page ?? 1;
    const limit = options.limit ?? 100;
    const skip = (page - 1) * limit;

    const where: Prisma.MarkEntryWhereInput = {
      tenantId: actor.tenantId,
      studentId,
      ...(options.examTermId ? { examTermId: options.examTermId } : {}),
      ...(options.subjectId ? { subjectId: options.subjectId } : {}),
      ...(options.academicYearId
        ? { examTerm: { academicYearId: options.academicYearId } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.markEntry.findMany({
        where,
        include: {
          assessmentComponent: true,
          subject: true,
          examTerm: true,
        },
        orderBy: [
          { examTerm: { startsOn: 'desc' } },
          { subject: { name: 'asc' } },
        ],
        skip,
        take: limit,
      }),
      this.prisma.markEntry.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateMark(id: string, dto: UpdateMarkDto, actor: AuthContext) {
    const existingMark = await this.prisma.markEntry.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { assessmentComponent: true },
    });

    if (!existingMark) {
      throw new NotFoundException('Mark entry not found');
    }

    const examTerm = await this.prisma.examTerm.findFirst({
      where: { id: existingMark.examTermId, tenantId: actor.tenantId },
    });

    const isLocked = examTerm?.isLocked || existingMark.isLocked;

    if (isLocked) {
      const correction = await this.prisma.reportCardCorrectionRequest.findFirst({
        where: {
          tenantId: actor.tenantId,
          status: 'APPROVED',
          reportCard: {
            studentId: existingMark.studentId,
            examTermId: existingMark.examTermId,
          },
        },
      });

      if (!correction) {
        await this.auditService.record({
          action: 'ACADEMICS_MARK_UPDATE_REJECTED_LOCKED',
          resource: 'mark_entry',
          tenantId: actor.tenantId,
          userId: actor.userId,
          resourceId: id,
        });
        throw new ConflictException(
          'Cannot update locked mark entry or locked exam term marks without an approved correction request',
        );
      }
    }

    const isAbsent =
      dto.isAbsent !== undefined
        ? dto.isAbsent
        : dto.isWithheld || dto.isRetest
          ? false
          : existingMark.status === MarkEntryStatus.ABSENT;
    const isWithheld =
      dto.isWithheld !== undefined
        ? dto.isWithheld
        : dto.isAbsent || dto.isRetest
          ? false
          : existingMark.status === MarkEntryStatus.WITHHELD;
    const isRetest =
      dto.isRetest !== undefined
        ? dto.isRetest
        : dto.isAbsent || dto.isWithheld
          ? false
          : existingMark.status === MarkEntryStatus.RETEST;

    const activeStatesCount =
      (isAbsent ? 1 : 0) + (isWithheld ? 1 : 0) + (isRetest ? 1 : 0);

    if (activeStatesCount > 1) {
      throw new ConflictException(
        'Entry can only be one of absent, withheld, or retest',
      );
    }

    let status: MarkEntryStatus = existingMark.status;
    let val = Number(existingMark.marksObtained);

    if (isAbsent) status = MarkEntryStatus.ABSENT;
    else if (isWithheld) status = MarkEntryStatus.WITHHELD;
    else if (isRetest) status = MarkEntryStatus.RETEST;
    else status = MarkEntryStatus.SUBMITTED;

    if (!isAbsent && !isWithheld) {
      val =
        dto.marksObtained !== undefined && dto.marksObtained !== null
          ? dto.marksObtained
          : val;
      const maxMarks = Number(existingMark.assessmentComponent.maxMarks);
      if (val < 0 || val > maxMarks) {
        throw new ConflictException(
          `marksObtained must be between 0 and ${maxMarks}`,
        );
      }
    } else {
      if (dto.marksObtained !== undefined && dto.marksObtained !== null) {
        val = dto.marksObtained;
      }
    }

    const updated = await this.prisma.markEntry.update({
      where: { id },
      data: {
        marksObtained: new Prisma.Decimal(val),
        status,
        remarks: dto.remarks !== undefined ? dto.remarks : existingMark.remarks,
        enteredById: actor.userId,
        isLocked: examTerm?.isLocked || existingMark.isLocked,
      },
    });

    await this.auditService.record({
      action: 'ACADEMICS_MARK_UPDATED',
      resource: 'mark_entry',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: id,
      before: {
        marksObtained: Number(existingMark.marksObtained),
        status: existingMark.status,
      },
      after: {
        marksObtained: Number(updated.marksObtained),
        status: updated.status,
      },
    });

    return updated;
  }
}
