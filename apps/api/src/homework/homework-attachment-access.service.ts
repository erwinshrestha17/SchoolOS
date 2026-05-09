import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PrismaService } from '../prisma/prisma.service';

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
      throw new NotFoundException('Homework attachment not found in this tenant');
    }

    const homeworkId = attachment.submission?.homeworkId ?? attachment.assignmentId;

    if (!homeworkId) {
      throw new NotFoundException('Homework attachment is not linked to homework');
    }

    await this.ensureHomeworkAttachmentVisibleToActor(actor, attachment);

    if (!attachment.fileAsset || attachment.fileAsset.softDeletedAt) {
      throw new NotFoundException('Homework attachment file is not available');
    }

    if (attachment.fileAsset.tenantId !== actor.tenantId) {
      throw new ForbiddenException('Homework attachment file is outside this tenant');
    }

    if (attachment.fileAsset.status !== 'UPLOADED') {
      throw new NotFoundException('Homework attachment file is not uploaded');
    }

    if (
      attachment.fileAsset.module &&
      attachment.fileAsset.module !== 'homework'
    ) {
      throw new ForbiddenException('Homework attachment file module is invalid');
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
    attachment: {
      submissionId: string | null;
      assignmentId: string | null;
      submission?: {
        studentId: string;
        homework: {
          id: string;
          classId: string;
          sectionId: string | null;
        };
      } | null;
      assignment?: {
        id: string;
        classId: string;
        sectionId: string | null;
      } | null;
    },
  ) {
    if (!actor.roles.includes('student') && !actor.roles.includes('parent')) {
      return;
    }

    if (actor.roles.includes('student')) {
      const student = await this.prisma.student.findFirst({
        where: {
          tenantId: actor.tenantId,
          userId: actor.userId,
        },
        select: { id: true, classId: true, sectionId: true },
      });

      if (!student) {
        throw new ForbiddenException('Student profile not found');
      }

      if (attachment.submission && attachment.submission.studentId !== student.id) {
        throw new ForbiddenException('Homework attachment is outside your scope');
      }

      const assignment = attachment.submission?.homework ?? attachment.assignment;
      if (
        assignment &&
        (assignment.classId !== student.classId ||
          (assignment.sectionId && assignment.sectionId !== student.sectionId))
      ) {
        throw new ForbiddenException('Homework attachment is outside your class scope');
      }

      return;
    }

    const link = await this.prisma.studentGuardian.findFirst({
      where: {
        tenantId: actor.tenantId,
        guardian: { userId: actor.userId },
        ...(attachment.submission?.studentId
          ? { studentId: attachment.submission.studentId }
          : {}),
      },
      include: {
        student: {
          select: { id: true, classId: true, sectionId: true },
        },
      },
    });

    if (!link) {
      throw new ForbiddenException('Homework attachment is outside your child scope');
    }

    const assignment = attachment.submission?.homework ?? attachment.assignment;
    if (
      assignment &&
      (assignment.classId !== link.student.classId ||
        (assignment.sectionId && assignment.sectionId !== link.student.sectionId))
    ) {
      throw new ForbiddenException('Homework attachment is outside your child class scope');
    }
  }
}
