import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import type { AuthContext } from '../auth/auth.types';
import { ApprovalWorkflowService } from './approval-workflow.service';
import {
  AttachApprovalFileDto,
  CreateApprovalCommentDto,
  CreateApprovalPolicyDto,
  CreateApprovalRequestDto,
  DecideApprovalRequestDto,
} from './dto/approval.dto';

@ApiTags('advanced-approvals')
@Controller('advanced/approvals')
@UseGuards(JwtAuthGuard, TenantActiveGuard, RolesPermissionsGuard)
export class ApprovalWorkflowController {
  constructor(private readonly service: ApprovalWorkflowService) {}

  @Get('catalog')
  @Permissions('advanced:approvals:read')
  getCatalog() {
    return this.service.getWorkflowCatalog();
  }

  @Get('policies')
  @Permissions('advanced:approvals:read')
  listPolicies(@CurrentAuth() auth: AuthContext) {
    return this.service.listPolicies(auth);
  }

  @Post('policies')
  @Permissions('advanced:approvals:manage')
  createPolicy(
    @Body() dto: CreateApprovalPolicyDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.createPolicy(dto, auth);
  }

  @Get()
  @Permissions('advanced:approvals:read')
  listRequests(@CurrentAuth() auth: AuthContext) {
    return this.service.listRequests(auth);
  }

  @Post()
  @Permissions('advanced:approvals:manage')
  createRequest(
    @Body() dto: CreateApprovalRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.createRequest(dto, auth);
  }

  @Post(':id/decisions')
  @Permissions('advanced:approvals:decide')
  decide(
    @Param('id') id: string,
    @Body() dto: DecideApprovalRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.decide(id, dto, auth);
  }

  @Post(':id/apply')
  @Permissions('advanced:approvals:decide')
  apply(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.service.applyFinalAction(id, auth);
  }

  @Post(':id/comments')
  @Permissions('advanced:approvals:manage')
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateApprovalCommentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.addComment(id, dto, auth);
  }

  @Post(':id/attachments')
  @Permissions('advanced:approvals:manage')
  attachFile(
    @Param('id') id: string,
    @Body() dto: AttachApprovalFileDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.attachFile(id, dto, auth);
  }
}
