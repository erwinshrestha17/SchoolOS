import {
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { RequiredModule } from '../auth/decorators/required-module.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DevicePushTokensService } from '../notifications/device-push-tokens.service';
import { RegisterDevicePushTokenDto } from '../notifications/dto/register-device-push-token.dto';

@Controller('mobile/push-tokens')
@UseGuards(JwtAuthGuard, EntitlementGuard)
@RequiredModule('notices')
export class MobilePushTokensController {
  constructor(
    private readonly devicePushTokensService: DevicePushTokensService,
  ) {}

  @Post()
  register(
    @Body() dto: RegisterDevicePushTokenDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.devicePushTokensService.register(dto, auth);
  }

  @Delete(':installationId')
  revoke(
    @Param('installationId', new ParseUUIDPipe({ version: '4' }))
    installationId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.devicePushTokensService.revoke(installationId, auth);
  }
}
