import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type {
  PaginatedResponse,
  PlatformDemoRequestDetail,
  PlatformDemoRequestSummary,
} from '@schoolos/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformGuard } from '../auth/guards/platform.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth-request.interface';
import { DemoRequestsService } from './demo-requests.service';
import { ListDemoRequestsDto } from './dto/list-demo-requests.dto';
import { UpdateDemoRequestStatusDto } from './dto/update-demo-request-status.dto';

@Controller('platform/demo-requests')
@UseGuards(JwtAuthGuard, PlatformGuard)
export class DemoRequestsPlatformController {
  constructor(private readonly demoRequestsService: DemoRequestsService) {}

  @Get()
  @Permissions('platform:demo-requests:read')
  listPage(
    @Query() query: ListDemoRequestsDto,
  ): Promise<PaginatedResponse<PlatformDemoRequestSummary>> {
    return this.demoRequestsService.listPage(query);
  }

  @Get(':id')
  @Permissions('platform:demo-requests:read')
  getById(@Param('id') id: string): Promise<PlatformDemoRequestDetail> {
    return this.demoRequestsService.getById(id);
  }

  @Patch(':id/status')
  @Permissions('platform:demo-requests:manage')
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateDemoRequestStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<PlatformDemoRequestDetail> {
    if (!req.auth?.userId) {
      throw new UnauthorizedException('Authentication context required');
    }

    return this.demoRequestsService.updateStatus(id, body, req.auth.userId);
  }
}
