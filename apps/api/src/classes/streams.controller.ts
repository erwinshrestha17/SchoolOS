import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import type { AuthContext } from '../auth/auth.types';
import { CreateStreamDto } from './dto/create-stream.dto';
import { StreamsService } from './streams.service';

@Controller('streams')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.students')
export class StreamsController {
  constructor(private readonly streamsService: StreamsService) {}

  @Get()
  @Permissions('streams:read')
  listStreams(@CurrentAuth() auth: AuthContext) {
    return this.streamsService.listStreams(auth);
  }

  @Post()
  @Permissions('streams:create')
  createStream(@Body() dto: CreateStreamDto, @CurrentAuth() auth: AuthContext) {
    return this.streamsService.createStream(dto, auth);
  }
}
