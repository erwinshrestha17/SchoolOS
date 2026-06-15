import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import type { AuthContext } from '../auth/auth.types';
import { DataExportCenterService } from './data-export-center.service';
import { CreateDataExportJobDto } from './dto/export-center.dto';

@ApiTags('advanced-exports')
@Controller('advanced/exports')
@UseGuards(JwtAuthGuard, TenantActiveGuard, RolesPermissionsGuard)
export class DataExportCenterController {
  constructor(private readonly service: DataExportCenterService) {}

  @Get()
  @Permissions('advanced:exports:read')
  list(@CurrentAuth() auth: AuthContext) {
    return this.service.listJobs(auth);
  }

  @Post()
  @Permissions('advanced:exports:create')
  create(
    @Body() dto: CreateDataExportJobDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.createJob(dto, auth);
  }

  @Post(':id/retry')
  @Permissions('advanced:exports:create')
  retry(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.service.retryJob(id, auth);
  }
}
