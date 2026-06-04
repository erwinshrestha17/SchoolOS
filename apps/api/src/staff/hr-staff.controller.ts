import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffStatus } from '@prisma/client';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { CreateStaffDto } from './dto/create-staff.dto';
import { StaffLifecycleDto } from './dto/staff-lifecycle.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';
import { StaffDocumentService } from './staff-document.service';
import { StaffLifecycleService } from './staff-lifecycle.service';
import { StaffLeaveAccrualService } from '../hr/staff-leave-accrual.service';
import {
  AddStaffDocumentDto,
  ContractExpiryReminderQueryDto,
  TerminateStaffDto,
  VerifyStaffDocumentDto,
} from './dto/staff-actions.dto';

@Controller('hr/staff')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.hr')
export class HrStaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly documentService: StaffDocumentService,
    private readonly lifecycleService: StaffLifecycleService,
    private readonly accrualService: StaffLeaveAccrualService,
  ) {}

  @Post('accruals/process')
  @Permissions('hr:manage')
  processAccruals(
    @Body() dto: { year: number; month: number },
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.accrualService.processMonthlyAccruals(
      auth.tenantId,
      dto.year,
      dto.month,
      auth.userId,
    );
  }

  @Get()
  @Permissions('hr:staff:read')
  listStaff(@CurrentAuth() auth: AuthContext) {
    return this.staffService.listStaff(auth);
  }

  @Post()
  @Permissions('hr:staff:create')
  createStaff(@Body() dto: CreateStaffDto, @CurrentAuth() auth: AuthContext) {
    return this.staffService.createStaff(dto, auth);
  }

  @Get('contract-expiry/reminders')
  @Permissions('hr:staff:read')
  listContractExpiryReminders(
    @Query() query: ContractExpiryReminderQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.listContractExpiryReminders(auth, query);
  }

  @Get(':staffId')
  @Permissions('hr:staff:read')
  getStaffDetail(
    @Param('staffId') staffId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.getStaffDetail(staffId, auth);
  }

  @Patch(':staffId')
  @Permissions('hr:staff:update')
  updateStaff(
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.updateStaff(staffId, dto, auth);
  }

  @Post(':staffId/archive')
  @Permissions('hr:staff:archive')
  archiveStaff(
    @Param('staffId') staffId: string,
    @Body() dto: Partial<StaffLifecycleDto>,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.transitionStaffStatus(
      staffId,
      {
        status: StaffStatus.INACTIVE,
        reason: dto.reason ?? 'Archived through HR staff archive action',
      },
      auth,
    );
  }

  @Post(':staffId/lifecycle')
  @Permissions('hr:staff:lifecycle')
  transitionStaff(
    @Param('staffId') staffId: string,
    @Body() dto: StaffLifecycleDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.transitionStaffStatus(staffId, dto, auth);
  }

  @Post(':staffId/terminate')
  @Permissions('hr:staff:terminate')
  terminateStaff(
    @Param('staffId') staffId: string,
    @Body() dto: TerminateStaffDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.terminateStaff(staffId, dto, auth);
  }

  @Get(':staffId/documents')
  @Permissions('hr:staff:read')
  listDocuments(
    @Param('staffId') staffId: string,
    @CurrentAuth() auth: AuthContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.documentService.listDocuments(staffId, auth, { page, limit });
  }

  @Post(':staffId/documents')
  @Permissions('hr:staff:update')
  addDocument(
    @Param('staffId') staffId: string,
    @Body() dto: AddStaffDocumentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.documentService.addDocument(staffId, dto, auth);
  }

  @Post(':staffId/documents/:documentId/verify')
  @Permissions('hr:staff:update')
  verifyDocument(
    @Param('documentId') documentId: string,
    @Body() dto: VerifyStaffDocumentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.documentService.verifyDocument(
      documentId,
      dto.notes || '',
      auth,
    );
  }

  @Get(':staffId/history')
  @Permissions('hr:staff:read')
  getHistory(
    @Param('staffId') staffId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.lifecycleService.getStaffHistory(staffId, auth);
  }
}
