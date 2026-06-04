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
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import {
  CommunicationAuditQueryDto,
  CommunicationPreferenceDto,
  CreateConsentTemplateDto,
  ProviderDeliveryStatusDto,
  ResendNoticeDto,
  RetryDeliveryDto,
  UpdateConsentTemplateDto,
} from './dto/m10-hardening.dto';
import { M10HardeningService } from './m10-hardening.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class M10HardeningController {
  constructor(private readonly m10HardeningService: M10HardeningService) {}

  @Get('communications/notices')
  @Permissions('notices:read')
  listCommunicationNotices(@CurrentAuth() auth: AuthContext) {
    return this.m10HardeningService.listNoticesWithReadStatus(auth);
  }

  @Get('communications/notices/:noticeId')
  @Permissions('notices:read')
  getCommunicationNotice(
    @Param('noticeId') noticeId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.getNoticeDetailWithReadStatus(
      noticeId,
      auth,
    );
  }

  @Post('communications/notices/:noticeId/read')
  @Permissions('notices:read')
  markNoticeRead(
    @Param('noticeId') noticeId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.markNoticeRead(noticeId, auth);
  }

  @Post('communications/notices/:noticeId/resend-failed')
  @Permissions('communications:retry_deliveries')
  resendFailedNoticeDeliveries(
    @Param('noticeId') noticeId: string,
    @Body() dto: ResendNoticeDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.resendNoticeFailed(noticeId, dto, auth);
  }

  @Get('communications/retention-policy')
  @Permissions('communications:read_deliveries')
  getRetentionPolicyStatus(@CurrentAuth() auth: AuthContext) {
    return this.m10HardeningService.getRetentionPolicyStatus(auth);
  }

  @Get('communications/audit')
  @Permissions('communications:read_deliveries')
  listCommunicationAuditTrail(
    @Query() query: CommunicationAuditQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.listCommunicationAuditTrail(query, auth);
  }

  @Post('notifications/deliveries/:deliveryId/retry')
  @Permissions('communications:retry_deliveries')
  retryDelivery(
    @Param('deliveryId') deliveryId: string,
    @Body() dto: RetryDeliveryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.retryDeliveryWithMetadata(
      deliveryId,
      dto,
      auth,
    );
  }

  @Patch('communications/deliveries/provider-status')
  @Permissions('communications:retry_deliveries')
  recordProviderDeliveryStatus(
    @Body() dto: ProviderDeliveryStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.recordProviderDeliveryStatus(dto, auth);
  }

  @Post('communications/consent/templates')
  @Permissions('communications:manage_consent')
  createConsentTemplate(
    @Body() dto: CreateConsentTemplateDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.createConsentTemplate(dto, auth);
  }

  @Get('communications/consent/templates')
  @Permissions('communications:manage_consent')
  listConsentTemplates(@CurrentAuth() auth: AuthContext) {
    return this.m10HardeningService.listConsentTemplates(auth, false);
  }

  @Get('communications/consent/templates/active')
  @Permissions('notices:read')
  listActiveConsentTemplates(@CurrentAuth() auth: AuthContext) {
    return this.m10HardeningService.listConsentTemplates(auth, true);
  }

  @Patch('communications/consent/templates/:templateId')
  @Permissions('communications:manage_consent')
  updateConsentTemplate(
    @Param('templateId') templateId: string,
    @Body() dto: UpdateConsentTemplateDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.updateConsentTemplate(
      templateId,
      dto,
      auth,
    );
  }

  @Post('communications/consent/templates/:templateId/publish')
  @Permissions('communications:manage_consent')
  publishConsentTemplate(
    @Param('templateId') templateId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.publishConsentTemplate(templateId, auth);
  }

  @Post('communications/consent/templates/:templateId/archive')
  @Permissions('communications:manage_consent')
  archiveConsentTemplate(
    @Param('templateId') templateId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.archiveConsentTemplate(templateId, auth);
  }

  @Get('communications/preferences')
  @Permissions('notices:read')
  getCommunicationPreference(@CurrentAuth() auth: AuthContext) {
    return this.m10HardeningService.getCommunicationPreference(auth);
  }

  @Patch('communications/preferences')
  @Permissions('notices:read')
  updateCommunicationPreference(
    @Body() dto: CommunicationPreferenceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return dto.reason === 'opt_in'
      ? this.m10HardeningService.marketingOptIn(dto, auth)
      : this.m10HardeningService.marketingOptOut(dto, auth);
  }

  @Post('communications/marketing-opt-out')
  @Permissions('notices:read')
  marketingOptOut(
    @Body() dto: CommunicationPreferenceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.marketingOptOut(dto, auth);
  }

  @Post('communications/marketing-opt-in')
  @Permissions('notices:read')
  marketingOptIn(
    @Body() dto: CommunicationPreferenceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.marketingOptIn(dto, auth);
  }
}
