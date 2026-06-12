import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StaffStatus } from '@prisma/client';
import type { AuthContext } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';

export interface LearningScopeInput {
  classId: string;
  sectionId?: string | null;
  subjectId: string;
  topicId?: string | null;
}

@Injectable()
export class LearningActivityPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveActorStaffId(actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        status: StaffStatus.ACTIVE,
      },
      select: { id: true },
    });

    return staff?.id ?? null;
  }

  async resolveTeacherIdForWrite(
    actor: AuthContext,
    requestedTeacherId?: string | null,
  ) {
    const actorStaffId = await this.resolveActorStaffId(actor);
    if (actorStaffId) {
      return actorStaffId;
    }

    if (!this.isSchoolAdmin(actor) || !requestedTeacherId) {
      throw new ForbiddenException('Only active staff can manage learning');
    }

    await this.ensureActiveStaff(actor, requestedTeacherId);
    return requestedTeacherId;
  }

  async validateLearningScope(actor: AuthContext, scope: LearningScopeInput) {
    const [classRecord, subject] = await Promise.all([
      this.prisma.class.findFirst({
        where: { id: scope.classId, tenantId: actor.tenantId },
        select: { id: true },
      }),
      this.prisma.subject.findFirst({
        where: {
          id: scope.subjectId,
          tenantId: actor.tenantId,
          classId: scope.classId,
        },
        select: { id: true },
      }),
    ]);

    if (!classRecord) {
      throw new NotFoundException('Class not found in this school');
    }

    if (!subject) {
      throw new NotFoundException('Subject not found for this class');
    }

    if (scope.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: {
          id: scope.sectionId,
          tenantId: actor.tenantId,
          classId: scope.classId,
        },
        select: { id: true },
      });
      if (!section) {
        throw new NotFoundException('Section not found for this class');
      }
    }

    if (scope.topicId) {
      const topic = await this.prisma.syllabusTopic.findFirst({
        where: {
          id: scope.topicId,
          tenantId: actor.tenantId,
          subjectId: scope.subjectId,
        },
        select: { id: true },
      });
      if (!topic) {
        throw new NotFoundException('Topic not found for this subject');
      }
    }
  }

  async assertTeacherAssigned(
    actor: AuthContext,
    teacherId: string,
    scope: LearningScopeInput,
  ) {
    await this.ensureActiveStaff(actor, teacherId);

    const assignment = await this.prisma.subjectTeacherAssignment.findFirst({
      where: {
        tenantId: actor.tenantId,
        staffId: teacherId,
        classId: scope.classId,
        subjectId: scope.subjectId,
        ...(scope.sectionId
          ? { OR: [{ sectionId: scope.sectionId }, { sectionId: null }] }
          : {}),
      },
      select: { id: true },
    });

    if (!assignment) {
      throw new ForbiddenException(
        'Teacher is not assigned to this class, section, and subject',
      );
    }
  }

  async assertActorCanControlScope(
    actor: AuthContext,
    teacherId: string,
    scope: LearningScopeInput,
  ) {
    await this.validateLearningScope(actor, scope);
    await this.assertTeacherAssigned(actor, teacherId, scope);

    if (this.isSchoolAdmin(actor)) {
      return;
    }

    const actorStaffId = await this.resolveActorStaffId(actor);
    if (!actorStaffId || actorStaffId !== teacherId) {
      throw new ForbiddenException('Only the assigned teacher can manage this');
    }
  }

  async assertActorCanReadStudentProgress(
    actor: AuthContext,
    student: { id: string; classId: string; sectionId: string | null },
  ) {
    if (this.isSchoolAdmin(actor)) {
      return;
    }

    const actorStaffId = await this.resolveActorStaffId(actor);
    if (!actorStaffId) {
      throw new ForbiddenException('Learning progress access denied');
    }

    const assignment = await this.prisma.subjectTeacherAssignment.findFirst({
      where: {
        tenantId: actor.tenantId,
        staffId: actorStaffId,
        classId: student.classId,
        ...(student.sectionId
          ? { OR: [{ sectionId: student.sectionId }, { sectionId: null }] }
          : {}),
      },
      select: { id: true },
    });

    if (!assignment) {
      throw new ForbiddenException('Learning progress access denied');
    }
  }

  private async ensureActiveStaff(actor: AuthContext, staffId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: {
        id: staffId,
        tenantId: actor.tenantId,
        status: StaffStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!staff) {
      throw new ForbiddenException('Active teacher profile is required');
    }
  }

  private isSchoolAdmin(actor: AuthContext) {
    return actor.roles.some((role) =>
      ['admin', 'principal', 'platform_super_admin'].includes(role),
    );
  }
}
