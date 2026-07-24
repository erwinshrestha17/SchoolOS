import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSectionDto } from './dto/create-section.dto';

@Injectable()
export class SectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listSections(actor: AuthContext) {
    const [sections, staff] = await Promise.all([
      this.prisma.section.findMany({
        where: { tenantId: actor.tenantId },
        include: {
          class: true,
          _count: {
            select: {
              students: true,
            },
          },
        },
        orderBy: [{ class: { level: 'asc' } }, { name: 'asc' }],
      }),
      this.prisma.staff.findFirst({
        where: { userId: actor.userId, tenantId: actor.tenantId },
        select: { id: true },
      }),
    ]);

    const subjectAssignments = staff
      ? await this.prisma.subjectTeacherAssignment.findMany({
          where: { tenantId: actor.tenantId, staffId: staff.id },
          select: { classId: true, sectionId: true },
        })
      : [];

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
      isAssignedClassTeacher: Boolean(section.classTeacherId === staff?.id),
      isAssignedSubjectTeacher: subjectAssignments.some(
        (assignment) =>
          assignment.sectionId === section.id ||
          (!assignment.sectionId && assignment.classId === section.classId),
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
