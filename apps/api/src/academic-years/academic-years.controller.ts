import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { AcademicYearsService } from './academic-years.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';

@Controller('academic-years')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class AcademicYearsController {
  constructor(private readonly academicYearsService: AcademicYearsService) {}

  @Get()
  @Permissions('academic_years:read')
  listAcademicYears(@CurrentAuth() auth: AuthContext) {
    return this.academicYearsService.listAcademicYears(auth);
  }

  @Post()
  @Permissions('academic_years:create')
  createAcademicYear(
    @Body() dto: CreateAcademicYearDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.academicYearsService.createAcademicYear(dto, auth);
  }
}
