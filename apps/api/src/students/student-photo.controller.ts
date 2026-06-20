import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { UploadStudentPhotoDto } from './dto/upload-student-photo.dto';
import { StudentPhotoService } from './student-photo.service';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.students')
export class StudentPhotoController {
  constructor(private readonly studentPhotoService: StudentPhotoService) {}

  @Post(':id/photo')
  @Permissions('students:update')
  uploadStudentPhoto(@Param('id') studentId: string, @Body() dto: UploadStudentPhotoDto, @CurrentAuth() auth: AuthContext) {
    return this.studentPhotoService.uploadPhoto(studentId, dto, auth);
  }

  @Get(':id/photo/content')
  @Permissions('students:read')
  async getStudentPhotoContent(@Param('id') studentId: string, @CurrentAuth() auth: AuthContext) {
    const photo = await this.studentPhotoService.getPhotoContent(studentId, auth);
    return new StreamableFile(photo.content, {
      type: photo.mimeType,
      disposition: `inline; filename="${safePhotoFileName(photo.fileName)}"`,
    });
  }

  @Get(':id/photo/preview')
  @Permissions('students:read')
  getStudentPhotoPreview(@Param('id') studentId: string, @CurrentAuth() auth: AuthContext) {
    return this.studentPhotoService.getPhotoAccess(studentId, auth, 'preview');
  }

  @Get(':id/photo/download')
  @Permissions('students:read')
  getStudentPhotoDownload(@Param('id') studentId: string, @CurrentAuth() auth: AuthContext) {
    return this.studentPhotoService.getPhotoAccess(studentId, auth, 'download');
  }

  @Delete(':id/photo')
  @Permissions('students:update')
  deleteStudentPhoto(@Param('id') studentId: string, @CurrentAuth() auth: AuthContext) {
    return this.studentPhotoService.deletePhoto(studentId, auth);
  }
}

function safePhotoFileName(fileName: string) {
  return fileName.replace(/[\\/\r\n"]/g, '_');
}
