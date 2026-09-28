import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import {
  CreateIemisHandoffDto,
  RecordIemisHandoffEventDto,
} from './dto/iemis-handoff.dto';
import { IemisHandoffService } from './iemis-handoff.service';

@ApiTags('iEMIS manual handoff')
@ApiBearerAuth()
@Controller('students/iemis/handoffs')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.students')
export class IemisHandoffController {
  constructor(private readonly service: IemisHandoffService) {}

  @Get()
  @Permissions('students:manage_lifecycle', 'reports:export')
  @ApiOperation({ summary: 'List manual iEMIS handoff status and evidence' })
  @ApiOkResponse({ type: Object, isArray: true })
  list(@CurrentAuth() actor: AuthContext) {
    return this.service.list(actor);
  }

  @Post()
  @Permissions('students:manage_lifecycle', 'reports:export')
  @ApiOperation({ summary: 'Register an internal reporting-readiness snapshot for manual review' })
  @ApiCreatedResponse({ type: Object })
  create(@Body() dto: CreateIemisHandoffDto, @CurrentAuth() actor: AuthContext) {
    return this.service.create(dto, actor);
  }

  @Post(':id/events')
  @Permissions('students:manage_lifecycle', 'reports:export')
  @ApiOperation({ summary: 'Record evidence of a manual external handoff or response' })
  @ApiCreatedResponse({ type: Object })
  recordEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordIemisHandoffEventDto,
    @CurrentAuth() actor: AuthContext,
  ) {
    return this.service.recordEvent(id, dto, actor);
  }
}
