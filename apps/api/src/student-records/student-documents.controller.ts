import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { UploadStudentDocumentDto } from './dto/upload-student-document.dto';
import { StudentRecordsService } from './student-records.service';

@Controller('student-documents')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class StudentDocumentsController {
  constructor(private readonly studentRecordsService: StudentRecordsService) {}

  @Get()
  @Permissions('students:read')
  listDocuments(
    @CurrentAuth() auth: AuthContext,
    @Query('studentId') studentId?: string,
  ) {
    return this.studentRecordsService.listDocuments(auth, studentId);
  }

  @Post()
  @Permissions('student_documents:manage')
  uploadDocument(
    @Body() dto: UploadStudentDocumentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentRecordsService.uploadDocument(dto, auth);
  }
}
