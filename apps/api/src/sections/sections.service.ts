import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TeacherAssignmentType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { isTeacherOnly } from '../common/security/parent-scope';
import { PrismaService } from '../prisma/prisma.service';
import {
  type TeacherAssignmentScope,
  TeacherScopeService,
} from '../teacher-scope/teacher-scope.service';
import { CreateSectionDto } from './dto/create-section.dto';

@Injectable()
export class SectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly teacherScopeService: TeacherScopeService,
  ) {}

  async listSections(actor: AuthContext) {
    let teacherAssignments: TeacherAssignmentScope[] = [];
    if (isTeacherOnly(actor)) {
      teacherAssignments = (
        await this.teacherScopeService.resolveReadableScope(actor)
      ).assignments;
    }
    const assignedSectionIds = new Set(
      teacherAssignments.map((assignment) => assignment.sectionId),
    );

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
      },
      orderBy: [{ class: { level: 'asc' } }, { name: 'asc' }],
    });

    return sections.map((section) => ({
      id: section.id,
      name: section.name,
      capacity: section.capacity,
      classId: section.classId,
      class: {
        id: section.class.id,
        name: section.class.name,
      },
      studentCount: section._count.students,
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
    }));
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
}
