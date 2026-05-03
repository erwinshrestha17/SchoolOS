import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { NoticeDetailService } from './notice-detail.service';

@Controller('notices')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class NoticeDetailController {
  constructor(private readonly noticeDetailService: NoticeDetailService) {}

  @Get(':noticeId')
  @Permissions('notices:read')
  getNoticeDetail(
    @Param('noticeId') noticeId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.noticeDetailService.getNoticeDetail(noticeId, auth);
  }
}
