import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from './communications.service';
import { CaptureConsentDto } from './dto/capture-consent.dto';

@Controller('consents')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class ConsentsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Get()
  @Permissions('consents:manage')
  listConsents(@CurrentAuth() auth: AuthContext) {
    return this.communicationsService.listConsents(auth);
  }

  @Post()
  @Permissions('consents:manage')
  captureConsent(
    @Body() dto: CaptureConsentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.captureConsent(dto, auth);
  }
}
