import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FileStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UploadStudentPhotoDto } from './dto/upload-student-photo.dto';

const MAX_STUDENT_PHOTO_BYTES = 2 * 1024 * 1024;
const ALLOWED_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

@Injectable()
export class StudentPhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly fileRegistryService: FileRegistryService,
    private readonly auditService: AuditService,
  ) {}

  async uploadPhoto(studentId: string, dto: UploadStudentPhotoDto, actor: AuthContext) {
    const student = await this.findStudentOrThrow(studentId, actor);

    if (!ALLOWED_PHOTO_MIME_TYPES.has(dto.mimeType)) {
      throw new BadRequestException('Unsupported student photo MIME type');
    }

    const content = Buffer.from(dto.base64Content, 'base64');

    if (content.byteLength === 0) {
      throw new BadRequestException('Student photo file is empty');
    }

    if (content.byteLength > MAX_STUDENT_PHOTO_BYTES) {
      throw new BadRequestException('Student photo must be 2MB or smaller');
    }

    const stored = await this.storageService.saveBufferObject({
      tenantId: actor.tenantId,
      prefix: `students/${student.id}/photo`,
      fileName: dto.fileName,
      contentType: dto.mimeType,
      content,
    });

    const asset = await this.fileRegistryService.registerFile({
      tenantId: actor.tenantId,
      uploadedByUserId: actor.userId,
      originalFilename: dto.fileName,
      objectKey: stored.objectKey,
      mimeType: dto.mimeType,
      sizeBytes: stored.sizeBytes,
      module: 'students',
      entityId: student.id,
      metadata: {
        kind: 'PHOTO',
        title: 'Student Photo',
        note: dto.note ?? null,
      },
    });

    await this.fileRegistryService.markUploaded(actor.tenantId, asset.id, actor.userId);

    const previousPhotoFileId = student.photoFileId;

    await this.prisma.student.update({
      where: { id: student.id },
      data: {
        photoFileId: asset.id,
        photoUrl: asset.id,
      },
    });

    if (previousPhotoFileId && previousPhotoFileId !== asset.id) {
      await this.fileRegistryService.softDeleteFile(
        actor.tenantId,
        previousPhotoFileId,
        actor.userId,
      );
    }

    await this.auditService.record({
      action: 'student_photo_uploaded',
      resource: 'student',
      resourceId: student.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { photoFileId: previousPhotoFileId },
      after: {
        photoFileId: asset.id,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: stored.sizeBytes,
      },
    });

    return {
      studentId: student.id,
      photoFileId: asset.id,
      fileName: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: Number(asset.sizeBytes),
      previewUrl: `/api/v1/students/${encodeURIComponent(student.id)}/photo/preview`,
      downloadUrl: `/api/v1/students/${encodeURIComponent(student.id)}/photo/download`,
    };
  }

  async getPhotoAccess(studentId: string, actor: AuthContext, action: 'preview' | 'download') {
    const student = await this.findStudentOrThrow(studentId, actor);

    if (!student.photoFileId) {
      throw new NotFoundException('Student photo not found');
    }

    const asset = await this.fileRegistryService.getFileMetadata(
      actor.tenantId,
      student.photoFileId,
    );

    if (asset.status !== FileStatus.UPLOADED) {
      throw new NotFoundException('Student photo is not available');
    }

    if (asset.module !== 'students' || asset.entityId !== student.id) {
      throw new NotFoundException('Student photo is not linked to this student');
    }

    await this.fileRegistryService.auditAccess(
      actor.tenantId,
      asset.id,
      actor.userId,
      action,
    );

    return {
      studentId: student.id,
      photoFileId: asset.id,
      fileName: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: Number(asset.sizeBytes),
      url: await this.fileRegistryService.getSignedUrl(actor.tenantId, asset.id),
      expiresInSeconds: 60,
    };
  }

  async deletePhoto(studentId: string, actor: AuthContext) {
    const student = await this.findStudentOrThrow(studentId, actor);

    if (!student.photoFileId) {
      return { success: true, deleted: false };
    }

    const previousPhotoFileId = student.photoFileId;

    await this.fileRegistryService.softDeleteFile(
      actor.tenantId,
      previousPhotoFileId,
      actor.userId,
    );

    await this.prisma.student.update({
      where: { id: student.id },
      data: {
        photoFileId: null,
        photoUrl: null,
      },
    });

    await this.auditService.record({
      action: 'student_photo_deleted',
      resource: 'student',
      resourceId: student.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { photoFileId: previousPhotoFileId },
      after: { photoFileId: null },
    });

    return { success: true, deleted: true };
  }

  private async findStudentOrThrow(studentId: string, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
      },
      select: {
        id: true,
        tenantId: true,
        photoFileId: true,
        lifecycleStatus: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    return student;
  }
}
