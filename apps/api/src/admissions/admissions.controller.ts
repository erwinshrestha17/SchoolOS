import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { AdmissionsService } from './admissions.service';
import { BulkAdmissionImportDto } from './dto/bulk-admission-import.dto';
import { CheckAdmissionDuplicateDto } from './dto/check-admission-duplicate.dto';
import { CreateAdmissionDto } from './dto/create-admission.dto';

@Controller('admissions')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Get()
  @Permissions('enrollments:read', 'students:read', 'guardians:read')
  listAdmissions(@CurrentAuth() auth: AuthContext) {
    return this.admissionsService.listAdmissions(auth);
  }

  @Post()
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  createAdmission(
    @Body() dto: CreateAdmissionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.createAdmission(dto, auth);
  }

  @Post('duplicates')
  @Permissions('students:read')
  checkDuplicates(
    @Body() dto: CheckAdmissionDuplicateDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.checkDuplicateAdmissions(dto, auth);
  }

  @Post('bulk-import')
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  bulkImport(
    @Body() dto: BulkAdmissionImportDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.admissionsService.bulkImport(dto, auth);
  }
}
