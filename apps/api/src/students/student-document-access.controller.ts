import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { StudentDocumentAccessService } from './student-document-access.service';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class StudentDocumentAccessController {
  constructor(
    private readonly studentDocumentAccessService: StudentDocumentAccessService,
  ) {}

  @Get(':studentId/documents/:documentId/preview-url')
  @Permissions('students:read', 'student_documents:manage')
  getDocumentPreviewUrl(
    @Param('studentId') studentId: string,
    @Param('documentId') documentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentDocumentAccessService.getDocumentAccessUrl(
      auth,
      studentId,
      documentId,
      'preview',
    );
  }

  @Get(':studentId/documents/:documentId/download-url')
  @Permissions('students:read', 'student_documents:manage')
  getDocumentDownloadUrl(
    @Param('studentId') studentId: string,
    @Param('documentId') documentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentDocumentAccessService.getDocumentAccessUrl(
      auth,
      studentId,
      documentId,
      'download',
    );
  }
}
