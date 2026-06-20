import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { AdmissionCaseQueuesService } from './admission-case-queues.service';

const ADMISSION_QUEUE_NAMES = [
  'NEEDS_INFORMATION',
  'WAITING_FOR_REVIEW',
  'READY_TO_ADMIT',
  'APPROVED',
  'NOT_ADMITTED',
  'DOCUMENTS_PENDING',
  'DUPLICATE_WARNINGS',
] as const;

class ListAdmissionCaseQueuesDto {
  @IsOptional()
  @IsIn(ADMISSION_QUEUE_NAMES)
  queue?: (typeof ADMISSION_QUEUE_NAMES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 25;

  @IsOptional()
  @IsString()
  search?: string;
}

@Controller('admissions/cases')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.students')
export class AdmissionCaseQueuesController {
  constructor(private readonly admissionCaseQueuesService: AdmissionCaseQueuesService) {}

  @Get()
  @Permissions('enrollments:read', 'students:read', 'guardians:read')
  list(@Query() query: ListAdmissionCaseQueuesDto, @CurrentAuth() actor: AuthContext) {
    return this.admissionCaseQueuesService.list(actor, query);
  }
}
