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
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
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
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.notifications')
export class M10HardeningController {
  constructor(private readonly m10HardeningService: M10HardeningService) {}

  @Get('communications/notices')
  @Entitlement('module.notices')
  @Permissions('notices:read')
  listCommunicationNotices(@CurrentAuth() auth: AuthContext) {
    return this.m10HardeningService.listNoticesWithReadStatus(auth);
  }

  @Get('communications/notices/:noticeId')
  @Entitlement('module.notices')
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
  @Entitlement('module.notices')
  @Permissions('notices:read')
  markNoticeRead(
    @Param('noticeId') noticeId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.markNoticeRead(noticeId, auth);
  }

  @Post('communications/notices/:noticeId/resend-failed')
  @Entitlement('module.notices')
  @Permissions('notifications:retry_deliveries')
  resendFailedNoticeDeliveries(
    @Param('noticeId') noticeId: string,
    @Body() dto: ResendNoticeDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.resendNoticeFailed(noticeId, dto, auth);
  }

  @Get('communications/retention-policy')
  @Permissions('notifications:view_delivery_diagnostics')
  getRetentionPolicyStatus(@CurrentAuth() auth: AuthContext) {
    return this.m10HardeningService.getRetentionPolicyStatus(auth);
  }

  @Get('communications/audit')
  @Permissions('notifications:view_delivery_diagnostics')
  listCommunicationAuditTrail(
    @Query() query: CommunicationAuditQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.listCommunicationAuditTrail(query, auth);
  }

  @Post('notifications/deliveries/:deliveryId/retry')
  @Permissions('notifications:retry_deliveries')
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
  @Permissions('notifications:retry_deliveries')
  recordProviderDeliveryStatus(
    @Body() dto: ProviderDeliveryStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.recordProviderDeliveryStatus(dto, auth);
  }

  @Post('communications/consent/templates')
  @Permissions('notifications:manage_preferences')
  createConsentTemplate(
    @Body() dto: CreateConsentTemplateDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.createConsentTemplate(dto, auth);
  }

  @Get('communications/consent/templates')
  @Permissions('notifications:manage_preferences')
  listConsentTemplates(@CurrentAuth() auth: AuthContext) {
    return this.m10HardeningService.listConsentTemplates(auth, false);
  }

  @Get('communications/consent/templates/active')
  @Permissions('notifications:manage_preferences')
  listActiveConsentTemplates(@CurrentAuth() auth: AuthContext) {
    return this.m10HardeningService.listConsentTemplates(auth, true);
  }

  @Patch('communications/consent/templates/:templateId')
  @Permissions('notifications:manage_preferences')
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
  @Permissions('notifications:manage_preferences')
  publishConsentTemplate(
    @Param('templateId') templateId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.publishConsentTemplate(templateId, auth);
  }

  @Post('communications/consent/templates/:templateId/archive')
  @Permissions('notifications:manage_preferences')
  archiveConsentTemplate(
    @Param('templateId') templateId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.archiveConsentTemplate(templateId, auth);
  }

  @Get('communications/preferences')
  @Permissions('notifications:manage_preferences')
  getCommunicationPreference(@CurrentAuth() auth: AuthContext) {
    return this.m10HardeningService.getCommunicationPreference(auth);
  }

  @Patch('communications/preferences')
  @Permissions('notifications:manage_preferences')
  updateCommunicationPreference(
    @Body() dto: CommunicationPreferenceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return dto.reason === 'opt_in'
      ? this.m10HardeningService.marketingOptIn(dto, auth)
      : this.m10HardeningService.marketingOptOut(dto, auth);
  }

  @Post('communications/marketing-opt-out')
  @Permissions('notifications:manage_preferences')
  marketingOptOut(
    @Body() dto: CommunicationPreferenceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.marketingOptOut(dto, auth);
  }

  @Post('communications/marketing-opt-in')
  @Permissions('notifications:manage_preferences')
  marketingOptIn(
    @Body() dto: CommunicationPreferenceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.m10HardeningService.marketingOptIn(dto, auth);
  }
}
