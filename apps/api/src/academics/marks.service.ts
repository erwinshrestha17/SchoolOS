import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssessmentRetakeStatus,
  AssessmentType,
  MarkEntryStatus,
  MarkSheetStatus,
  Prisma,
  type MarkEntry,
  TeacherAssignmentComponentScope,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { BulkUpsertMarksDto } from './dto/bulk-upsert-marks.dto';
import { ListMarksDto } from './dto/list-marks.dto';
import { ListAssessmentComponentsDto } from './dto/list-assessment-components.dto';
import { UpdateMarkDto } from './dto/update-mark.dto';
import { TeacherScopeService } from '../teacher-scope/teacher-scope.service';
import { TeacherCapability } from '../teacher-scope/teacher-capability';
import { assertClientAuthorityFence } from '../sync/authority-fence';
import { MarkSheetService } from './mark-sheet.service';

/**
 * Roles that retain the pre-existing coarse permission-gated access to marks
 * (academic administration, result approval/publication, etc). Every other
 * actor holding the `teacher` or `subject_teacher` role must additionally
 * hold an active TeacherAssignment (or delegation) for the exact
 * class+section+subject+component being written -- see requireTeacherScope
 * below. Mirrors the same admin/principal carve-out already used client-side
 * in attendance-m2-workspaces.tsx.
 */
const ASSIGNMENT_SCOPE_EXEMPT_ROLES = [
  'admin',
  'principal',
  'platform_super_admin',
];

@Injectable()
export class MarksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly teacherScopeService: TeacherScopeService,
    private readonly markSheetService: MarkSheetService,
  ) {}

  /**
   * Closes the gap flagged during the Teacher Persona security audit: this
   * endpoint previously relied solely on the coarse `marks:manage` /
   * `academics:enter_marks` permissions, so any teacher/subject_teacher role
   * holder could enter marks for *any* subject in the tenant. This re-derives
   * each target student's actual section from the database (never trusting
   * `dto.sectionId`) and requires a matching active assignment or delegation
   * per section touched, component-scope included (a PRACTICAL-only teacher
   * cannot write THEORY marks).
   *
   * Bulk-import rows are authorized row by row (spec 23.3 "Bulk operations
   * reject unauthorized rows") rather than all-or-nothing: a student in a
   * section the actor isn't assigned to is rejected individually while the
   * rest of the batch still proceeds. The whole request is only rejected
   * (403) when the actor has no active teacher profile, or *no* row is
   * authorized.
   */
  private async resolveTeacherScopeAuthorization(
    actor: AuthContext,
    dto: BulkUpsertMarksDto,
    academicYearId: string,
    componentType: AssessmentType,
    students: Array<{ id: string; sectionId: string | null }>,
  ): Promise<{
    authorizedStudentIds: Set<string>;
    rejectedRows: Array<{ studentId: string; reason: string }>;
  }> {
    const isExempt = actor.roles.some((role) =>
      ASSIGNMENT_SCOPE_EXEMPT_ROLES.includes(role),
    );
    const isTeacherActor =
      !isExempt &&
      (actor.roles.includes('teacher') ||
        actor.roles.includes('subject_teacher'));
    if (!isTeacherActor) {
      return {
        authorizedStudentIds: new Set(students.map((s) => s.id)),
        rejectedRows: [],
      };
    }

    const staffId = await this.teacherScopeService.resolveActiveStaffId(actor);
    if (!staffId) {
      throw new ForbiddenException('Active teacher profile is required');
    }

    const sectionAuthorized = new Map<string, boolean>();
    const authorizedStudentIds = new Set<string>();
    const rejectedRows: Array<{ studentId: string; reason: string }> = [];

    for (const student of students) {
      if (!student.sectionId) {
        rejectedRows.push({
          studentId: student.id,
          reason: 'Student has no assigned section',
        });
        continue;
      }

      if (!sectionAuthorized.has(student.sectionId)) {
        try {
          await this.teacherScopeService.requireAccess(
            {
              tenantId: actor.tenantId,
              staffId,
              academicYearId,
              classId: dto.classId,
              sectionId: student.sectionId,
              subjectId: dto.subjectId,
              componentType,
              capability: TeacherCapability.MARKS_ENTER,
            },
            actor,
          );
          sectionAuthorized.set(student.sectionId, true);
        } catch (error) {
          if (error instanceof ForbiddenException) {
            sectionAuthorized.set(student.sectionId, false);
          } else {
            throw error;
          }
        }
      }

      if (sectionAuthorized.get(student.sectionId)) {
        authorizedStudentIds.add(student.id);
      } else {
        rejectedRows.push({
          studentId: student.id,
          reason: 'Not authorized for this class/section/subject/component',
        });
      }
    }

    if (authorizedStudentIds.size === 0) {
      throw new ForbiddenException(
        'You are not authorized for this teaching scope',
      );
    }

    return { authorizedStudentIds, rejectedRows };
  }

  async bulkUpsert(dto: BulkUpsertMarksDto, actor: AuthContext) {
    await assertClientAuthorityFence(this.prisma, actor.tenantId, dto);
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

    const { authorizedStudentIds, rejectedRows } =
      await this.resolveTeacherScopeAuthorization(
        actor,
        dto,
        examTerm.academicYearId,
        component.type,
        students,
      );

    const entries = dto.entries.filter((entry) =>
      authorizedStudentIds.has(entry.studentId),
    );
    const authorizedStudentIdList = entries.map((entry) => entry.studentId);

    const maxMarks = Number(component.maxMarks);
    for (const entry of entries) {
      if (entry.isRetest) {
        throw new ConflictException(
          'Use the assessment-retakes workflow to request a retest or make-up',
        );
      }

      const activeStatesCount =
        (entry.isAbsent ? 1 : 0) +
        (entry.isWithheld ? 1 : 0) +
        (entry.isRetest ? 1 : 0) +
        (entry.isDraft ? 1 : 0);

      if (activeStatesCount > 1) {
        throw new ConflictException(
          'Entry can only be one of draft, absent, withheld, or retest',
        );
      }

      if (!entry.isAbsent && !entry.isWithheld && !entry.isDraft) {
        if (entry.marksObtained === undefined || entry.marksObtained === null) {
          throw new ConflictException(
            'marksObtained is required if not draft, absent, or withheld',
          );
        }
        if (entry.marksObtained < 0 || entry.marksObtained > maxMarks) {
          throw new ConflictException(
            `marksObtained must be between 0 and ${maxMarks}`,
          );
        }
      }
    }

    const approvedCorrections =
      await this.prisma.reportCardCorrectionRequest.findMany({
        where: {
          tenantId: actor.tenantId,
          status: 'APPROVED',
          reportCard: {
            examTermId: dto.examTermId,
            studentId: { in: authorizedStudentIdList },
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
      const unapprovedStudents = authorizedStudentIdList.filter(
        (id) => !approvedStudentIds.has(id),
      );
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
        studentId: { in: authorizedStudentIdList },
      },
    });

    // Optimistic concurrency: changing an existing mark requires the version
    // (updatedAt) the client last saw; the write below is a compare-and-set.
    const existingByStudent = new Map(
      existingMarks.map((mark) => [mark.studentId, mark]),
    );
    const expectedVersions = new Map<string, Date>();
    for (const entry of entries) {
      const existing = existingByStudent.get(entry.studentId);
      if (!existing) continue;
      const expectedVersion = entry.expectedVersion?.trim();
      const expected = expectedVersion ? new Date(expectedVersion) : null;
      if (
        !expected ||
        Number.isNaN(+expected) ||
        +expected !== +existing.updatedAt
      ) {
        throw new ConflictException({
          statusCode: 409,
          code: MARK_VERSION_CONFLICT_CODE,
          studentId: entry.studentId,
          currentVersion: existing.updatedAt.toISOString(),
          message:
            'Someone else changed this mark after you loaded it. Reload and review before saving.',
        });
      }
      expectedVersions.set(entry.studentId, expected);
    }

    if (existingMarks.length > 0) {
      const activeRetake = await this.prisma.assessmentRetake.findFirst({
        where: {
          tenantId: actor.tenantId,
          markEntryId: { in: existingMarks.map((mark) => mark.id) },
          status: {
            in: [
              AssessmentRetakeStatus.REQUESTED,
              AssessmentRetakeStatus.APPROVED,
              AssessmentRetakeStatus.SCHEDULED,
              AssessmentRetakeStatus.COMPLETED,
            ],
          },
        },
        select: { id: true },
      });
      if (activeRetake) {
        throw new ConflictException(
          'A mark with an active retest or make-up lifecycle cannot be edited directly',
        );
      }
    }

    for (const mark of existingMarks) {
      if (mark.isLocked && !approvedStudentIds.has(mark.studentId)) {
        throw new ConflictException(
          `Cannot update locked mark entry for student ${mark.studentId} without an approved correction request`,
        );
      }
    }

    // One mark sheet per section touched (class-wide when a student has no
    // section). Writes are only allowed while the sheet is DRAFT/RETURNED; a
    // LOCKED sheet accepts writes only for students with an approved
    // report-card correction (existing correction workflow).
    const sectionByStudent = new Map(
      students.map((student) => [student.id, student.sectionId ?? null]),
    );
    const sheetSections = [
      ...new Set(
        entries.map((entry) => sectionByStudent.get(entry.studentId) ?? null),
      ),
    ];

    const results = await this.prisma.$transaction(
      async (tx) => {
        for (const sectionId of sheetSections) {
          const sheet = await this.markSheetService.ensureSheet(
            tx,
            actor.tenantId,
            {
              examTermId: dto.examTermId,
              assessmentComponentId: dto.assessmentComponentId,
              subjectId: dto.subjectId,
              classId: dto.classId,
              sectionId,
            },
          );
          const sheetStudentIds = entries
            .filter(
              (entry) =>
                (sectionByStudent.get(entry.studentId) ?? null) === sectionId,
            )
            .map((entry) => entry.studentId);
          await this.markSheetService.claimForMarkWrite(
            tx,
            actor.tenantId,
            sheet,
            {
              allowLockedCorrection:
                sheet.status === MarkSheetStatus.LOCKED &&
                sheetStudentIds.every((id) => approvedStudentIds.has(id)),
            },
          );
        }

        const written: MarkEntry[] = [];
        for (const entry of entries) {
          let status: MarkEntryStatus = MarkEntryStatus.SUBMITTED;
          if (entry.isDraft) status = MarkEntryStatus.DRAFT;
          else if (entry.isAbsent) status = MarkEntryStatus.ABSENT;
          else if (entry.isWithheld) status = MarkEntryStatus.WITHHELD;

          const marksObtained = marksForStatus(status, entry.marksObtained);
          const data = {
            marksObtained,
            status,
            remarks: entry.remarks || null,
            enteredById: actor.userId,
            isLocked: examTerm.isLocked,
          };
          const existing = existingByStudent.get(entry.studentId);
          if (existing) {
            const updated = await tx.markEntry.updateMany({
              where: {
                id: existing.id,
                tenantId: actor.tenantId,
                updatedAt: expectedVersions.get(entry.studentId),
              },
              data,
            });
            if (updated.count !== 1) {
              throw new ConflictException({
                statusCode: 409,
                code: MARK_VERSION_CONFLICT_CODE,
                studentId: entry.studentId,
                message:
                  'Someone else changed this mark while you were saving. Reload and review before saving.',
              });
            }
            written.push(
              await tx.markEntry.findUniqueOrThrow({
                where: { id: existing.id },
              }),
            );
          } else {
            try {
              written.push(
                await tx.markEntry.create({
                  data: {
                    tenantId: actor.tenantId,
                    examTermId: dto.examTermId,
                    assessmentComponentId: dto.assessmentComponentId,
                    subjectId: dto.subjectId,
                    studentId: entry.studentId,
                    ...data,
                  },
                }),
              );
            } catch (error) {
              if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
              ) {
                throw new ConflictException({
                  statusCode: 409,
                  code: MARK_VERSION_CONFLICT_CODE,
                  studentId: entry.studentId,
                  message:
                    'Someone else entered this mark at the same time. Reload and review before saving.',
                });
              }
              throw error;
            }
          }
        }
        return written;
      },
      { timeout: 20_000 },
    );

    await this.auditService.record({
      action: 'ACADEMICS_MARKS_BULK_UPSERTED',
      resource: 'mark_entry',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        componentId: dto.assessmentComponentId,
        count: results.length,
        rejectedCount: rejectedRows.length,
      },
    });

    return { updated: results.length, entries: results, rejectedRows };
  }

  async listMarks(actor: AuthContext, dto: ListMarksDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 100;
    const skip = (page - 1) * limit;

    const teacherReadScope = await this.getMarkReadScope(actor);
    if (teacherReadScope === 'NONE') {
      return {
        items: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const where: Prisma.MarkEntryWhereInput = {
      tenantId: actor.tenantId,
      ...(dto.examTermId ? { examTermId: dto.examTermId } : {}),
      ...(dto.assessmentComponentId
        ? { assessmentComponentId: dto.assessmentComponentId }
        : {}),
      ...(dto.subjectId ? { subjectId: dto.subjectId } : {}),
      ...(dto.studentId ? { studentId: dto.studentId } : {}),
      ...(teacherReadScope ? { AND: [teacherReadScope] } : {}),
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
          student: {
            select: {
              id: true,
              firstNameEn: true,
              lastNameEn: true,
              studentSystemId: true,
            },
          },
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

  /**
   * Returns only assessment components for which the current Teacher actor
   * has an active MARKS_ENTER assignment or delegation. AssessmentComponent
   * is class-level while authorization is section-level, so a component is
   * eligible when at least one active section assignment matches the exact
   * academic year, class, subject, and component type.
   *
   * This projection deliberately does not reuse the administrative component
   * catalog: exposing an out-of-scope component lets a Teacher enumerate
   * another class or subject even though the eventual write is denied.
   */
  async listAssignedComponents(
    actor: AuthContext,
    dto: ListAssessmentComponentsDto = {},
  ) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 100;
    const skip = (page - 1) * limit;
    const assignments = (
      await this.teacherScopeService.listActiveAssignmentsForCapability(
        actor,
        TeacherCapability.MARKS_ENTER,
      )
    ).filter(
      (assignment): assignment is typeof assignment & { subjectId: string } =>
        Boolean(assignment.subjectId),
    );

    if (assignments.length === 0) {
      return {
        items: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const assignedScopes: Prisma.AssessmentComponentWhereInput[] =
      assignments.map((assignment) => {
        const componentType =
          assignment.componentScope &&
          assignment.componentScope !==
            TeacherAssignmentComponentScope.ALL_COMPONENTS
            ? (assignment.componentScope as unknown as AssessmentType)
            : null;
        return {
          subjectId: assignment.subjectId,
          subject: { classId: assignment.classId },
          examTerm: { academicYearId: assignment.academicYearId },
          ...(componentType ? { type: componentType } : {}),
        };
      });

    const where: Prisma.AssessmentComponentWhereInput = {
      tenantId: actor.tenantId,
      ...(dto.examTermId ? { examTermId: dto.examTermId } : {}),
      ...(dto.subjectId ? { subjectId: dto.subjectId } : {}),
      ...(dto.type ? { type: dto.type } : {}),
      ...(dto.search
        ? { name: { contains: dto.search, mode: 'insensitive' } }
        : {}),
      ...(dto.classId ? { subject: { classId: dto.classId } } : {}),
      AND: [{ OR: assignedScopes }],
    };

    const [items, total] = await Promise.all([
      this.prisma.assessmentComponent.findMany({
        where,
        include: {
          subject: { include: { class: true } },
          examTerm: true,
        },
        orderBy: [{ subject: { code: 'asc' } }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.assessmentComponent.count({ where }),
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

    await this.assertStudentMarkReadAccess(
      actor,
      student,
      options.academicYearId,
    );

    const teacherReadScope = await this.getMarkReadScope(actor);
    if (teacherReadScope === 'NONE') {
      const page = options.page ?? 1;
      const limit = options.limit ?? 100;
      return {
        items: [],
        meta: { total: 0, page, limit, totalPages: 0 },
      };
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
      ...(teacherReadScope ? { AND: [teacherReadScope] } : {}),
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
    if (dto.isRetest) {
      throw new ConflictException(
        'Use the assessment-retakes workflow to request a retest or make-up',
      );
    }

    const existingMark = await this.prisma.markEntry.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: { assessmentComponent: true },
    });

    if (!existingMark) {
      throw new NotFoundException('Mark entry not found');
    }

    const [student, examTermForScope] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: existingMark.studentId, tenantId: actor.tenantId },
        select: { id: true, classId: true, sectionId: true },
      }),
      this.prisma.examTerm.findFirst({
        where: { id: existingMark.examTermId, tenantId: actor.tenantId },
        select: { id: true, academicYearId: true },
      }),
    ]);
    if (!student) {
      throw new NotFoundException('Student not found in tenant');
    }
    if (!examTermForScope) {
      throw new NotFoundException('Exam term not found in tenant');
    }

    await this.assertMarkWriteAccess(actor, {
      academicYearId: examTermForScope.academicYearId,
      classId: student.classId,
      sectionId: student.sectionId,
      subjectId: existingMark.subjectId,
      componentType: existingMark.assessmentComponent.type,
    });

    const activeRetake = await this.prisma.assessmentRetake.findFirst({
      where: {
        tenantId: actor.tenantId,
        markEntryId: id,
        status: {
          in: [
            AssessmentRetakeStatus.REQUESTED,
            AssessmentRetakeStatus.APPROVED,
            AssessmentRetakeStatus.SCHEDULED,
            AssessmentRetakeStatus.COMPLETED,
          ],
        },
      },
      select: { id: true },
    });
    if (activeRetake) {
      throw new ConflictException(
        'A mark with an active retest or make-up lifecycle cannot be edited directly',
      );
    }

    const examTerm = await this.prisma.examTerm.findFirst({
      where: { id: existingMark.examTermId, tenantId: actor.tenantId },
    });

    const isLocked = examTerm?.isLocked || existingMark.isLocked;

    if (isLocked) {
      const correction =
        await this.prisma.reportCardCorrectionRequest.findFirst({
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
        : dto.isWithheld || dto.isRetest || dto.isDraft
          ? false
          : existingMark.status === MarkEntryStatus.ABSENT;
    const isWithheld =
      dto.isWithheld !== undefined
        ? dto.isWithheld
        : dto.isAbsent || dto.isRetest || dto.isDraft
          ? false
          : existingMark.status === MarkEntryStatus.WITHHELD;
    const isRetest =
      dto.isRetest !== undefined
        ? dto.isRetest
        : dto.isAbsent || dto.isWithheld || dto.isDraft
          ? false
          : existingMark.status === MarkEntryStatus.RETEST;
    const isDraft =
      dto.isDraft !== undefined
        ? dto.isDraft
        : dto.isAbsent || dto.isWithheld || dto.isRetest
          ? false
          : existingMark.status === MarkEntryStatus.DRAFT;

    const activeStatesCount =
      (isAbsent ? 1 : 0) +
      (isWithheld ? 1 : 0) +
      (isRetest ? 1 : 0) +
      (isDraft ? 1 : 0);

    if (activeStatesCount > 1) {
      throw new ConflictException(
        'Entry can only be one of draft, absent, withheld, or retest',
      );
    }

    let status: MarkEntryStatus = existingMark.status;
    let val =
      existingMark.marksObtained === null
        ? null
        : Number(existingMark.marksObtained);

    if (isDraft) status = MarkEntryStatus.DRAFT;
    else if (isAbsent) status = MarkEntryStatus.ABSENT;
    else if (isWithheld) status = MarkEntryStatus.WITHHELD;
    else if (isRetest) status = MarkEntryStatus.RETEST;
    else status = MarkEntryStatus.SUBMITTED;

    if (!isAbsent && !isWithheld && !isDraft) {
      val =
        dto.marksObtained !== undefined && dto.marksObtained !== null
          ? dto.marksObtained
          : val;
      const maxMarks = Number(existingMark.assessmentComponent.maxMarks);
      if (val === null || val < 0 || val > maxMarks) {
        throw new ConflictException(
          `marksObtained must be between 0 and ${maxMarks}`,
        );
      }
    } else {
      if (dto.marksObtained !== undefined && dto.marksObtained !== null) {
        val = dto.marksObtained;
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const sheet = await this.markSheetService.ensureSheet(
        tx,
        actor.tenantId,
        {
          examTermId: existingMark.examTermId,
          assessmentComponentId: existingMark.assessmentComponentId,
          subjectId: existingMark.subjectId,
          classId: student.classId,
          sectionId: student.sectionId ?? null,
        },
      );
      // A locked mark only reaches here with an approved correction.
      await this.markSheetService.claimForMarkWrite(tx, actor.tenantId, sheet, {
        allowLockedCorrection: isLocked,
      });
      const result = await tx.markEntry.updateMany({
        where: {
          id,
          tenantId: actor.tenantId,
          updatedAt: existingMark.updatedAt,
        },
        data: {
          marksObtained: marksForStatus(status, val),
          status,
          remarks:
            dto.remarks !== undefined ? dto.remarks : existingMark.remarks,
          enteredById: actor.userId,
          isLocked: examTerm?.isLocked || existingMark.isLocked,
        },
      });
      if (result.count !== 1) {
        throw new ConflictException({
          statusCode: 409,
          code: MARK_VERSION_CONFLICT_CODE,
          message:
            'Someone else changed this mark while you were saving. Reload and review before saving.',
        });
      }
      return tx.markEntry.findUniqueOrThrow({ where: { id } });
    });

    await this.auditService.record({
      action: 'ACADEMICS_MARK_UPDATED',
      resource: 'mark_entry',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: id,
      before: {
        marksObtained:
          existingMark.marksObtained === null
            ? null
            : Number(existingMark.marksObtained),
        status: existingMark.status,
      },
      after: {
        marksObtained:
          updated.marksObtained === null ? null : Number(updated.marksObtained),
        status: updated.status,
      },
    });

    return updated;
  }

  private isAssignmentScopeExempt(actor: AuthContext) {
    return actor.roles.some((role) =>
      ASSIGNMENT_SCOPE_EXEMPT_ROLES.includes(role),
    );
  }

  private isPrivilegedActor(actor: AuthContext) {
    return [
      'academics:manage',
      'academics:update',
      'academics:manage_report_cards',
      'marks:manage',
    ].some((permission) => actor.permissions.includes(permission));
  }

  private isTeacherActor(actor: AuthContext) {
    return (
      actor.roles.includes('teacher') || actor.roles.includes('subject_teacher')
    );
  }

  private async assertMarkWriteAccess(
    actor: AuthContext,
    scope: {
      academicYearId: string;
      classId: string;
      sectionId: string | null;
      subjectId: string;
      componentType: AssessmentType;
    },
  ) {
    if (this.isAssignmentScopeExempt(actor) || this.isPrivilegedActor(actor)) {
      return;
    }

    if (!this.isTeacherActor(actor)) {
      return;
    }

    if (!scope.sectionId) {
      return this.teacherScopeService.denyActorAccess(
        {
          capability: TeacherCapability.MARKS_ENTER,
          reason: 'missing_scope',
          classId: scope.classId,
          subjectId: scope.subjectId,
        },
        actor,
      );
    }

    await this.teacherScopeService.requireActorAccess(
      {
        academicYearId: scope.academicYearId,
        classId: scope.classId,
        sectionId: scope.sectionId,
        subjectId: scope.subjectId,
        componentType: scope.componentType,
        capability: TeacherCapability.MARKS_ENTER,
      },
      actor,
    );
  }

  private async assertStudentMarkReadAccess(
    actor: AuthContext,
    student: { classId: string; sectionId: string | null },
    academicYearId?: string,
  ) {
    if (this.isAssignmentScopeExempt(actor) || this.isPrivilegedActor(actor)) {
      return;
    }

    if (!this.isTeacherActor(actor)) {
      return;
    }

    const options = academicYearId ? { academicYearId } : {};
    const [subjectAssignments, homeroomAssignments] = await Promise.all([
      this.teacherScopeService.listActiveAssignmentsForCapability(
        actor,
        TeacherCapability.SUBJECT_RECORD_READ,
        options,
      ),
      this.teacherScopeService.listActiveAssignmentsForCapability(
        actor,
        TeacherCapability.HOMEROOM_ACADEMIC_SUMMARY_READ,
        options,
      ),
    ]);

    const inScope = [...subjectAssignments, ...homeroomAssignments].some(
      (assignment) =>
        assignment.classId === student.classId &&
        assignment.sectionId === student.sectionId,
    );
    if (!inScope) {
      throw new ForbiddenException(
        'Student marks are outside your teaching scope',
      );
    }
  }

  private async getMarkReadScope(
    actor: AuthContext,
  ): Promise<Prisma.MarkEntryWhereInput | 'NONE' | null> {
    if (this.isAssignmentScopeExempt(actor) || this.isPrivilegedActor(actor)) {
      return null;
    }

    if (!this.isTeacherActor(actor)) {
      return null;
    }

    const subjectAssignments = (
      await this.teacherScopeService.listActiveAssignmentsForCapability(
        actor,
        TeacherCapability.SUBJECT_RECORD_READ,
      )
    ).filter(
      (assignment): assignment is typeof assignment & { subjectId: string } =>
        Boolean(assignment.subjectId),
    );

    const homeroomAssignments =
      await this.teacherScopeService.listActiveAssignmentsForCapability(
        actor,
        TeacherCapability.HOMEROOM_ACADEMIC_SUMMARY_READ,
      );

    if (subjectAssignments.length === 0 && homeroomAssignments.length === 0) {
      return 'NONE';
    }

    const orConditions: Prisma.MarkEntryWhereInput[] = [];

    for (const assignment of subjectAssignments) {
      orConditions.push({
        examTerm: { academicYearId: assignment.academicYearId },
        subjectId: assignment.subjectId,
        student: {
          classId: assignment.classId,
          sectionId: assignment.sectionId,
        },
      });
    }

    for (const assignment of homeroomAssignments) {
      orConditions.push({
        examTerm: { academicYearId: assignment.academicYearId },
        student: {
          classId: assignment.classId,
          sectionId: assignment.sectionId,
        },
        status: { not: MarkEntryStatus.DRAFT },
      });
    }

    return { OR: orConditions };
  }
}

export const MARK_VERSION_CONFLICT_CODE = 'MARK_VERSION_CONFLICT';

/**
 * Non-numeric outcomes are stored without a number (never zero); see
 * MarkEntry_marks_match_status_check. A draft keeps whatever was typed.
 */
export function marksForStatus(
  status: MarkEntryStatus,
  value: number | null | undefined,
): Prisma.Decimal | null {
  if (
    status === MarkEntryStatus.ABSENT ||
    status === MarkEntryStatus.EXCUSED ||
    status === MarkEntryStatus.WITHHELD ||
    status === MarkEntryStatus.MISSING
  ) {
    return null;
  }
  return value === null || value === undefined
    ? null
    : new Prisma.Decimal(value);
}
