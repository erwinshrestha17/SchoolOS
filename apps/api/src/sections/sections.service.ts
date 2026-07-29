import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StaffStatus,
  TeacherAssignmentStatus,
  TeacherAssignmentType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { isTeacherOnly } from '../common/security/parent-scope';
import { PrismaService } from '../prisma/prisma.service';
import {
  type TeacherAssignmentScope,
  TeacherScopeService,
} from '../teacher-scope/teacher-scope.service';
import { AssignClassTeacherDto } from './dto/assign-class-teacher.dto';
import { CreateSectionDto } from './dto/create-section.dto';

const SAFE_CLASS_TEACHER_STAFF_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  employeeId: true,
} satisfies Prisma.StaffSelect;

@Injectable()
export class SectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly teacherScopeService: TeacherScopeService,
  ) {}

  async listSections(actor: AuthContext) {
    let teacherAssignments: TeacherAssignmentScope[] = [];
    const includeClassTeacher = !isTeacherOnly(actor);

    if (isTeacherOnly(actor)) {
      teacherAssignments = (
        await this.teacherScopeService.resolveReadableScope(actor)
      ).assignments;
    }

    const assignedSectionIds = new Set(
      teacherAssignments.map((assignment) => assignment.sectionId),
    );

    const currentYear = includeClassTeacher
      ? await this.prisma.academicYear.findFirst({
          where: { tenantId: actor.tenantId, isCurrent: true },
          select: { id: true },
        })
      : null;

    const sections = await this.prisma.section.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(isTeacherOnly(actor)
          ? {
              id: {
                in:
                  assignedSectionIds.size > 0
                    ? [...assignedSectionIds]
                    : ['__no_teacher_sections__'],
              },
            }
          : {}),
      },
      include: {
        class: true,
        _count: {
          select: {
            students: true,
          },
        },
        ...(includeClassTeacher && currentYear
          ? {
              teacherAssignmentRecords: {
                where: {
                  academicYearId: currentYear.id,
                  assignmentType: TeacherAssignmentType.CLASS_TEACHER,
                  status: TeacherAssignmentStatus.ACTIVE,
                  subjectId: null,
                },
                include: {
                  staff: { select: SAFE_CLASS_TEACHER_STAFF_SELECT },
                },
                take: 1,
              },
            }
          : {}),
      },
      orderBy: [{ class: { level: 'asc' } }, { name: 'asc' }],
    });

    return sections.map((section) => {
      const assignmentRecords = includeClassTeacher
        ? (
            section as typeof section & {
              teacherAssignmentRecords?: Array<{
                staff: {
                  id: string;
                  firstName: string;
                  lastName: string;
                  employeeId: string;
                };
              }>;
            }
          ).teacherAssignmentRecords
        : undefined;
      const activeClassTeacher = includeClassTeacher
        ? (assignmentRecords?.[0]?.staff ?? null)
        : undefined;

      return {
        id: section.id,
        name: section.name,
        capacity: section.capacity,
        classId: section.classId,
        class: {
          id: section.class.id,
          name: section.class.name,
        },
        studentCount: section._count.students,
        ...(includeClassTeacher
          ? {
              classTeacher: activeClassTeacher
                ? {
                    id: activeClassTeacher.id,
                    firstName: activeClassTeacher.firstName,
                    lastName: activeClassTeacher.lastName,
                    employeeId: activeClassTeacher.employeeId,
                  }
                : null,
            }
          : {}),
        // Lets teacher-facing screens default to the caller's own section
        // without exposing staff ids to the browser.
        isAssignedClassTeacher: teacherAssignments.some(
          (assignment) =>
            assignment.sectionId === section.id &&
            assignment.assignmentType === TeacherAssignmentType.CLASS_TEACHER,
        ),
        isAssignedSubjectTeacher: teacherAssignments.some(
          (assignment) =>
            assignment.sectionId === section.id &&
            assignment.subjectId !== null &&
            assignment.assignmentType !== TeacherAssignmentType.CLASS_TEACHER,
        ),
      };
    });
  }

  async createSection(dto: CreateSectionDto, actor: AuthContext) {
    const classroom = await this.prisma.class.findFirst({
      where: {
        id: dto.classId,
        tenantId: actor.tenantId,
      },
    });

    if (!classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    const existing = await this.prisma.section.findUnique({
      where: {
        tenantId_classId_name: {
          tenantId: actor.tenantId,
          classId: dto.classId,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Section already exists for this class');
    }

    const section = await this.prisma.section.create({
      data: {
        tenantId: actor.tenantId,
        classId: dto.classId,
        name: dto.name,
        capacity: dto.capacity ?? null,
      },
      include: {
        class: true,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'section',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: section.id,
      after: {
        name: section.name,
        classId: section.classId,
        capacity: section.capacity,
      },
    });

    return section;
  }

  async assignClassTeacher(
    sectionId: string,
    dto: AssignClassTeacherDto,
    actor: AuthContext,
  ) {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, tenantId: actor.tenantId },
      include: { class: true },
    });

    if (!section) {
      throw new NotFoundException('Section not found in this tenant');
    }

    const staff = await this.prisma.staff.findFirst({
      where: { id: dto.staffId, tenantId: actor.tenantId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found in this tenant');
    }

    if (staff.status !== StaffStatus.ACTIVE) {
      throw new ConflictException(
        'Only active staff members can be assigned as class teacher',
      );
    }

    const academicYear = await this.resolveAcademicYear(
      actor.tenantId,
      dto.academicYearId,
    );

    const priorActive = await this.prisma.teacherAssignment.findFirst({
      where: {
        tenantId: actor.tenantId,
        academicYearId: academicYear.id,
        sectionId: section.id,
        assignmentType: TeacherAssignmentType.CLASS_TEACHER,
        status: TeacherAssignmentStatus.ACTIVE,
      },
      select: { staffId: true },
    });

    const assignment = await this.prisma.$transaction(async (tx) => {
      await tx.teacherAssignment.updateMany({
        where: {
          tenantId: actor.tenantId,
          academicYearId: academicYear.id,
          sectionId: section.id,
          assignmentType: TeacherAssignmentType.CLASS_TEACHER,
          status: TeacherAssignmentStatus.ACTIVE,
          staffId: { not: dto.staffId },
        },
        data: {
          status: TeacherAssignmentStatus.REVOKED,
          revokedById: actor.userId,
          revokedAt: new Date(),
        },
      });

      const existing = await tx.teacherAssignment.findFirst({
        where: {
          tenantId: actor.tenantId,
          academicYearId: academicYear.id,
          staffId: dto.staffId,
          assignmentType: TeacherAssignmentType.CLASS_TEACHER,
          classId: section.classId,
          sectionId: section.id,
          subjectId: null,
          componentScope: null,
        },
      });

      const teacherAssignment = existing
        ? await tx.teacherAssignment.update({
            where: { id: existing.id },
            data: {
              status: TeacherAssignmentStatus.ACTIVE,
              effectiveFrom: academicYear.startsOn,
              effectiveUntil: academicYear.endsOn,
              revokedById: null,
              revokedAt: null,
            },
            include: {
              staff: { select: SAFE_CLASS_TEACHER_STAFF_SELECT },
              class: true,
              section: true,
              academicYear: true,
            },
          })
        : await tx.teacherAssignment.create({
            data: {
              tenantId: actor.tenantId,
              academicYearId: academicYear.id,
              staffId: dto.staffId,
              assignmentType: TeacherAssignmentType.CLASS_TEACHER,
              classId: section.classId,
              sectionId: section.id,
              subjectId: null,
              componentScope: null,
              isPrimary: true,
              effectiveFrom: academicYear.startsOn,
              effectiveUntil: academicYear.endsOn,
              createdById: actor.userId,
            },
            include: {
              staff: { select: SAFE_CLASS_TEACHER_STAFF_SELECT },
              class: true,
              section: true,
              academicYear: true,
            },
          });

      await tx.section.update({
        where: { id: section.id },
        data: { classTeacherId: dto.staffId },
      });

      return teacherAssignment;
    });

    await this.auditService.record({
      action: 'assign_class_teacher',
      resource: 'teacher_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: assignment.id,
      before: priorActive ? { staffId: priorActive.staffId } : undefined,
      after: {
        staffId: dto.staffId,
        sectionId: section.id,
        classId: section.classId,
        academicYearId: academicYear.id,
      },
    });

    return assignment;
  }

  async removeClassTeacher(
    sectionId: string,
    academicYearId: string | undefined,
    actor: AuthContext,
  ) {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, tenantId: actor.tenantId },
    });

    if (!section) {
      throw new NotFoundException('Section not found in this tenant');
    }

    const academicYear = await this.resolveAcademicYear(
      actor.tenantId,
      academicYearId,
    );

    const priorActive = await this.prisma.teacherAssignment.findFirst({
      where: {
        tenantId: actor.tenantId,
        academicYearId: academicYear.id,
        sectionId: section.id,
        assignmentType: TeacherAssignmentType.CLASS_TEACHER,
        status: TeacherAssignmentStatus.ACTIVE,
      },
      select: { id: true, staffId: true },
    });

    if (!priorActive) {
      throw new NotFoundException(
        'No active class teacher assignment found for this section',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.teacherAssignment.updateMany({
        where: {
          tenantId: actor.tenantId,
          academicYearId: academicYear.id,
          sectionId: section.id,
          assignmentType: TeacherAssignmentType.CLASS_TEACHER,
          status: TeacherAssignmentStatus.ACTIVE,
        },
        data: {
          status: TeacherAssignmentStatus.REVOKED,
          revokedById: actor.userId,
          revokedAt: new Date(),
        },
      });

      await tx.section.update({
        where: { id: section.id },
        data: { classTeacherId: null },
      });
    });

    await this.auditService.record({
      action: 'unassign_class_teacher',
      resource: 'teacher_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: priorActive.id,
      before: { staffId: priorActive.staffId },
      after: {
        sectionId: section.id,
        classId: section.classId,
        academicYearId: academicYear.id,
      },
    });

    return { removed: true, sectionId: section.id };
  }

  private async resolveAcademicYear(tenantId: string, academicYearId?: string) {
    const year = academicYearId
      ? await this.prisma.academicYear.findFirst({
          where: { id: academicYearId, tenantId },
        })
      : await this.prisma.academicYear.findFirst({
          where: { tenantId, isCurrent: true },
        });

    if (!year) {
      throw new ConflictException(
        academicYearId
          ? 'Academic year not found in this tenant'
          : 'No current academic year is configured for this school',
      );
    }

    return year;
  }
}
