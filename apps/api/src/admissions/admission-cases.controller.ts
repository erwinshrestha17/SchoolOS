import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { AdmissionCasesService } from './admission-cases.service';
import {
  CreateAdmissionCaseDto,
  DirectAdmitAdmissionCaseDto,
  FinalizeAdmissionCaseDto,
  ReviewAdmissionCaseDto,
  UpdateAdmissionCaseDto,
  UpdateAdmissionPolicyDto,
} from './dto/admission-case.dto';

@Controller('admissions')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.students')
export class AdmissionCasesController {
  constructor(private readonly admissionCasesService: AdmissionCasesService) {}

  @Get('policy')
  @Permissions('students:read')
  getPolicy(@CurrentAuth() actor: AuthContext) {
    return this.admissionCasesService.getPolicy(actor);
  }

  @Put('policy')
  @Permissions('students:manage_lifecycle')
  updatePolicy(
    @Body() dto: UpdateAdmissionPolicyDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.updatePolicy(dto, actor);
  }

  @Post('cases')
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  createCase(
    @Body() dto: CreateAdmissionCaseDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.createCase(dto, actor);
  }

  @Get('cases/:admissionCaseId')
  @Permissions('enrollments:read', 'students:read', 'guardians:read')
  getCase(
    @Param('admissionCaseId') admissionCaseId: string,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.getCase(admissionCaseId, actor);
  }

  @Get('cases/:admissionCaseId/eligibility')
  @Permissions('enrollments:read', 'students:read', 'guardians:read')
  evaluateCase(
    @Param('admissionCaseId') admissionCaseId: string,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.evaluateCase(admissionCaseId, actor);
  }

  @Patch('cases/:admissionCaseId')
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  updateCase(
    @Param('admissionCaseId') admissionCaseId: string,
    @Body() dto: UpdateAdmissionCaseDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.updateCase(admissionCaseId, dto, actor);
  }

  @Post('cases/:admissionCaseId/review')
  @Permissions('students:manage_lifecycle')
  reviewCase(
    @Param('admissionCaseId') admissionCaseId: string,
    @Body() dto: ReviewAdmissionCaseDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.reviewCase(admissionCaseId, dto, actor);
  }

  @Post('cases/:admissionCaseId/direct-admit')
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  directAdmit(
    @Param('admissionCaseId') admissionCaseId: string,
    @Body() dto: DirectAdmitAdmissionCaseDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.directAdmit(admissionCaseId, dto, actor);
  }

  @Post('cases/:admissionCaseId/finalize')
  @Permissions('enrollments:create', 'students:create', 'guardians:create')
  finalizeApprovedCase(
    @Param('admissionCaseId') admissionCaseId: string,
    @Body() dto: FinalizeAdmissionCaseDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.admissionCasesService.finalizeApprovedCase(
      admissionCaseId,
      dto,
      actor,
    );
  }
}
