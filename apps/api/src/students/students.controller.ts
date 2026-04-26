import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { CreateStudentDto } from './dto/create-student.dto';
import { StudentsService } from './students.service';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Permissions('students:read')
  listStudents(@CurrentAuth() auth: AuthContext) {
    return this.studentsService.listStudents(auth);
  }

  @Post()
  @Permissions('students:create')
  createStudent(
    @Body() dto: CreateStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.createStudent(dto, auth);
  }

  @Get(':id/documents/:kind.pdf')
  @Header('Content-Type', 'application/pdf')
  @Permissions('student_documents:manage')
  getGeneratedDocument(
    @Param('id') studentId: string,
    @Param('kind') kind: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentsService.generateStudentDocumentPdf(
      studentId,
      kind,
      auth,
    );
  }
}
