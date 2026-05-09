import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { ActivityMediaService } from './activity-media.service';

@Controller('media')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class MediaAccessController {
  constructor(private readonly activityMediaService: ActivityMediaService) {}

  @Get(':mediaId/preview-url')
  @Permissions('activity_feed:read')
  getPreviewUrl(
    @Param('mediaId') mediaId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityMediaService.getAttachmentAccessUrl(
      auth,
      mediaId,
      'preview',
    );
  }

  @Get(':mediaId/download-url')
  @Permissions('activity_feed:read')
  getDownloadUrl(
    @Param('mediaId') mediaId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityMediaService.getAttachmentAccessUrl(
      auth,
      mediaId,
      'download',
    );
  }
}
