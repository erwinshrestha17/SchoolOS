import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from './communications.service';
import { CaptureConsentDto } from './dto/capture-consent.dto';
import { GuardianConsentActionDto } from './dto/guardian-consent-action.dto';

@Controller('consents')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.communications')
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

  @Get('guardians/:guardianId/status')
  @Permissions('consents:manage')
  getGuardianConsentStatus(
    @Param('guardianId') guardianId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.getGuardianConsentStatus(
      guardianId,
      auth,
    );
  }

  @Post('guardians/:guardianId/capture')
  @Permissions('consents:manage')
  captureGuardianConsent(
    @Param('guardianId') guardianId: string,
    @Body() dto: GuardianConsentActionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.captureConsent(
      {
        ...dto,
        guardianId,
        granted: true,
      },
      auth,
    );
  }

  @Post('guardians/:guardianId/revoke')
  @Permissions('consents:manage')
  revokeGuardianConsent(
    @Param('guardianId') guardianId: string,
    @Body() dto: GuardianConsentActionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.captureConsent(
      {
        ...dto,
        guardianId,
        granted: false,
      },
      auth,
    );
  }
}
