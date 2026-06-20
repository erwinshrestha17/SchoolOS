import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformGuard } from '../auth/guards/platform.guard';
import { PlatformService } from '../platform/platform.service';

@ApiTags('platform-summary')
@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformGuard)
export class OperationalPlatformSummaryController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('summary')
  @Permissions('platform:dashboard:read')
  @ApiOperation({
    summary:
      'Get the platform operational summary for tenants, subscriptions, providers, queues, storage, and onboarding risks',
  })
  @ApiOkResponse({
    description:
      'Uses the existing platform dashboard service. Platform billing is kept separate from school fee collection.',
  })
  getSummary() {
    return this.platformService.getDashboardSummary();
  }
}
