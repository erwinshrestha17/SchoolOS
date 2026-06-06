import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from './communications.service';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.communications')
export class EventsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Get()
  @Permissions('events:read')
  listEvents(@CurrentAuth() auth: AuthContext) {
    return this.communicationsService.listEvents(auth);
  }

  @Post()
  @Permissions('events:create')
  createEvent(@Body() dto: CreateEventDto, @CurrentAuth() auth: AuthContext) {
    return this.communicationsService.createEvent(dto, auth);
  }
}
