import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { Prisma, StudentLifecycleStatus } from '@prisma/client';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PrismaService } from '../prisma/prisma.service';

type FullAttachment = Prisma.HomeworkAttachmentGetPayload<{
  include: {
    fileAsset: true;
    submission: {
      include: {
        homework: true;
        student: true;
      };
    };
    assignment: true;
  };
}>;

@Injectable()
export class HomeworkAttachmentAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileRegistryService: FileRegistryService,
  ) {}

  async getAttachmentAccessUrl(
    attachmentId: string,
    actor: AuthContext,
    action: 'preview' | 'download',
  ) {
    const attachment = await this.prisma.homeworkAttachment.findFirst({
      where: {
        id: attachmentId,
        tenantId: actor.tenantId,
      },
      include: {
        fileAsset: true,
        submission: {
          include: {
            homework: true,
            student: true,
          },
        },
        assignment: true,
      },
    });

    if (!attachment) {
      throw new NotFoundException(
        'Homework attachment not found in this tenant',
      );
    }

    const homeworkId =
      attachment.submission?.homeworkId ?? attachment.assignmentId;

    if (!homeworkId) {
      throw new NotFoundException(
        'Homework attachment is not linked to homework',
      );
    }

    await this.ensureHomeworkAttachmentVisibleToActor(actor, attachment);

    if (!attachment.fileAsset || attachment.fileAsset.softDeletedAt) {
      throw new NotFoundException('Homework attachment file is not available');
    }

    if (attachment.fileAsset.tenantId !== actor.tenantId) {
      throw new ForbiddenException(
        'Homework attachment file is outside this tenant',
      );
    }

    if (attachment.fileAsset.status === 'PENDING') {
      throw new ConflictException('Homework attachment is still processing');
    }

    if (attachment.fileAsset.status === 'FAILED') {
      throw new ConflictException('Homework attachment upload failed');
    }

    if (attachment.fileAsset.status !== 'UPLOADED') {
      throw new NotFoundException('Homework attachment file was removed');
    }

    const expectedModule = attachment.submissionId
      ? 'homework-submission'
      : 'homework';
    if (attachment.fileAsset.module !== expectedModule) {
      throw new ForbiddenException(
        'Homework attachment file module is invalid',
      );
    }

    if (
      attachment.fileAsset.entityId &&
      attachment.submissionId &&
      attachment.fileAsset.entityId !== attachment.submissionId
    ) {
      throw new ForbiddenException(
        'Homework attachment file is not linked to this submission',
      );
    }

    if (
      attachment.fileAsset.entityId &&
      attachment.assignmentId &&
      !attachment.submissionId &&
      attachment.fileAsset.entityId !== attachment.assignmentId
    ) {
      throw new ForbiddenException(
        'Homework attachment file is not linked to this assignment',
      );
    }

    await this.fileRegistryService.auditAccess(
      actor.tenantId,
      attachment.fileAssetId,
      actor.userId,
      action,
    );

    return {
      attachmentId: attachment.id,
      homeworkId,
      submissionId: attachment.submissionId,
      assignmentId: attachment.assignmentId,
      fileAssetId: attachment.fileAssetId,
      fileName: attachment.fileAsset.originalFilename,
      mimeType: attachment.fileAsset.mimeType,
      sizeBytes: Number(attachment.fileAsset.sizeBytes),
      url: await this.fileRegistryService.getSignedUrl(
        actor.tenantId,
        attachment.fileAssetId,
      ),
      expiresInSeconds: 60,
    };
  }

  private async ensureHomeworkAttachmentVisibleToActor(
    actor: AuthContext,
    attachment: FullAttachment,
  ) {
    if (
      actor.roles.some((role) =>
        ['admin', 'principal', 'platform_super_admin'].includes(role),
      )
    ) {
      return;
    }

    const assignment =
      attachment.submission?.homework ?? attachment.assignment;
    if (!assignment) {
      throw new ForbiddenException(
        'Homework attachment is outside your scope',
      );
    }

    if (
      actor.roles.includes('teacher') ||
      actor.roles.includes('subject_teacher')
    ) {
      const staff = await this.prisma.staff.findFirst({
        where: { tenantId: actor.tenantId, userId: actor.userId },
        select: { id: true },
      });
      if (!staff) {
        throw new ForbiddenException('Active teacher profile is required');
      }
      const teacherAssignment =
        await this.prisma.subjectTeacherAssignment.findFirst({
          where: {
            tenantId: actor.tenantId,
            staffId: staff.id,
            academicYearId: assignment.academicYearId,
            classId: assignment.classId,
            subjectId: assignment.subjectId,
            OR: assignment.sectionId
              ? [{ sectionId: assignment.sectionId }, { sectionId: null }]
              : [{ sectionId: null }],
          },
          select: { id: true },
        });
      if (!teacherAssignment) {
        throw new ForbiddenException(
          'Homework attachment is outside your teaching scope',
        );
      }
      return;
    }

    if (actor.roles.includes('student')) {
      const student = await this.prisma.student.findFirst({
        where: {
          tenantId: actor.tenantId,
          userId: actor.userId,
          lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        },
        select: {
          id: true,
          classId: true,
          sectionId: true,
          lifecycleStatus: true,
        },
      });

      if (!student) {
        throw new ForbiddenException('Student profile not found');
      }

      if (
        attachment.submission &&
        attachment.submission.studentId !== student.id
      ) {
        throw new ForbiddenException(
          'Homework attachment is outside your scope',
        );
      }

      if (
        assignment &&
        (assignment.classId !== student.classId ||
          (assignment.sectionId && assignment.sectionId !== student.sectionId))
      ) {
        throw new ForbiddenException(
          'Homework attachment is outside your class scope',
        );
      }

      return;
    }

    if (!actor.roles.includes('parent')) {
      throw new ForbiddenException(
        'Homework attachment is outside your permitted scope',
      );
    }

    const link = await this.prisma.studentGuardian.findFirst({
      where: {
        tenantId: actor.tenantId,
        guardian: { userId: actor.userId },
        ...(attachment.submission?.studentId
          ? { studentId: attachment.submission.studentId }
          : {}),
        student: {
          lifecycleStatus: StudentLifecycleStatus.ACTIVE,
          classId: assignment.classId,
          ...(assignment.sectionId
            ? { sectionId: assignment.sectionId }
            : {}),
        },
      },
      include: {
        student: {
          select: {
            id: true,
            classId: true,
            sectionId: true,
            lifecycleStatus: true,
          },
        },
      },
    });

    if (!link) {
      throw new ForbiddenException(
        'Homework attachment is outside your child scope',
      );
    }

    if (
      assignment &&
      (assignment.classId !== link.student.classId ||
        (assignment.sectionId &&
          assignment.sectionId !== link.student.sectionId))
    ) {
      throw new ForbiddenException(
        'Homework attachment is outside your child class scope',
      );
    }

  }
}
