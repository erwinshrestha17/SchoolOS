import { Injectable, NotFoundException } from '@nestjs/common';
import { FileStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { validateImageUpload } from '../common/files/image-upload-validation';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UploadStudentPhotoDto } from './dto/upload-student-photo.dto';

const MAX_STUDENT_PHOTO_BYTES = 2 * 1024 * 1024;

@Injectable()
export class StudentPhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly fileRegistryService: FileRegistryService,
    private readonly auditService: AuditService,
  ) {}

  async uploadPhoto(
    studentId: string,
    dto: UploadStudentPhotoDto,
    actor: AuthContext,
  ) {
    const student = await this.findStudentOrThrow(studentId, actor);
    const image = validateImageUpload({
      base64Content: dto.base64Content,
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      maxBytes: MAX_STUDENT_PHOTO_BYTES,
      label: 'Student photo',
    });
    const stored = await this.storageService.saveBufferObject({
      tenantId: actor.tenantId,
      prefix: `students/${student.id}/photo`,
      fileName: image.safeFileName,
      contentType: image.mimeType,
      content: image.content,
    });
    const asset = await this.fileRegistryService.registerFile({
      tenantId: actor.tenantId,
      uploadedByUserId: actor.userId,
      originalFilename: image.safeFileName,
      objectKey: stored.objectKey,
      mimeType: image.mimeType,
      sizeBytes: stored.sizeBytes,
      provider: stored.provider,
      bucket: stored.bucket,
      checksumSha256: stored.checksumSha256,
      module: 'students',
      entityId: student.id,
      metadata: {
        kind: 'PHOTO',
        title: 'Student Photo',
        note: dto.note ?? null,
        originalFileName: dto.fileName,
      },
    });
    await this.fileRegistryService.markUploaded(
      actor.tenantId,
      asset.id,
      actor.userId,
    );
    const previousPhotoFileId = student.photoFileId;
    await this.prisma.student.update({
      where: { id: student.id },
      data: { photoFileId: asset.id, photoUrl: asset.id },
    });
    if (previousPhotoFileId && previousPhotoFileId !== asset.id)
      await this.fileRegistryService.softDeleteFile(
        actor.tenantId,
        previousPhotoFileId,
        actor.userId,
      );
    await this.auditService.record({
      action: previousPhotoFileId
        ? 'student_photo_replaced'
        : 'student_photo_uploaded',
      resource: 'student',
      resourceId: student.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { photoFileId: previousPhotoFileId },
      after: {
        photoFileId: asset.id,
        fileName: image.safeFileName,
        mimeType: image.mimeType,
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

  async getPhotoAccess(
    studentId: string,
    actor: AuthContext,
    action: 'preview' | 'download',
  ) {
    const { student, asset } = await this.findPhotoAssetOrThrow(
      studentId,
      actor,
    );
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
      url: await this.fileRegistryService.getSignedUrl(
        actor.tenantId,
        asset.id,
      ),
      expiresInSeconds: 60,
    };
  }

  async getPhotoContent(studentId: string, actor: AuthContext) {
    const { student, asset } = await this.findPhotoAssetOrThrow(
      studentId,
      actor,
    );
    await this.fileRegistryService.auditAccess(
      actor.tenantId,
      asset.id,
      actor.userId,
      'preview',
    );
    const content = await this.storageService.getObjectBuffer(asset.objectKey);
    if (content.length === 0)
      throw new NotFoundException('Student photo is not available');
    return {
      studentId: student.id,
      fileName: asset.originalFilename,
      mimeType: asset.mimeType,
      content,
    };
  }

  async deletePhoto(studentId: string, actor: AuthContext) {
    const student = await this.findStudentOrThrow(studentId, actor);
    if (!student.photoFileId) return { success: true, deleted: false };
    const previousPhotoFileId = student.photoFileId;
    await this.fileRegistryService.softDeleteFile(
      actor.tenantId,
      previousPhotoFileId,
      actor.userId,
    );
    await this.prisma.student.update({
      where: { id: student.id },
      data: { photoFileId: null, photoUrl: null },
    });
    await this.auditService.record({
      action: 'student_photo_removed',
      resource: 'student',
      resourceId: student.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      before: { photoFileId: previousPhotoFileId },
      after: { photoFileId: null },
    });
    return { success: true, deleted: true };
  }

  private async findPhotoAssetOrThrow(studentId: string, actor: AuthContext) {
    const student = await this.findStudentOrThrow(studentId, actor);
    if (!student.photoFileId)
      throw new NotFoundException('Student photo not found');
    const asset = await this.fileRegistryService.getFileMetadata(
      actor.tenantId,
      student.photoFileId,
    );
    if (
      asset.status !== FileStatus.UPLOADED ||
      asset.module !== 'students' ||
      asset.entityId !== student.id
    )
      throw new NotFoundException('Student photo is not available');
    return { student, asset };
  }

  private async findStudentOrThrow(studentId: string, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId: actor.tenantId },
      select: {
        id: true,
        tenantId: true,
        photoFileId: true,
        lifecycleStatus: true,
      },
    });
    if (!student)
      throw new NotFoundException('Student not found in this tenant');
    return student;
  }
}
