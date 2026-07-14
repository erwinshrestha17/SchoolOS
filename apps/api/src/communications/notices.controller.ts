import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from './communications.service';
import { CreateNoticeDto } from './dto/create-notice.dto';

@Controller('notices')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.notices')
export class NoticesController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Get()
  @Permissions('notices:read')
  listNotices(@CurrentAuth() auth: AuthContext) {
    return this.communicationsService.listNotices(auth);
  }

  @Post()
  @Permissions('notices:create')
  createNotice(@Body() dto: CreateNoticeDto, @CurrentAuth() auth: AuthContext) {
    return this.communicationsService.createNotice(dto, auth);
  }

  @Post('recipient-preview')
  @Permissions('notices:create')
  previewNoticeRecipients(
    @Body() dto: CreateNoticeDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.previewNoticeRecipients(dto, auth);
  }

  @Post('scheduled/process')
  @Permissions('notices:create')
  processScheduled(@CurrentAuth() auth: AuthContext) {
    return this.communicationsService.processScheduledNotices(auth);
  }
}
