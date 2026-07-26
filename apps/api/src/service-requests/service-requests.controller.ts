import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import {
  AddSchoolServiceRequestNoteDto,
  ListSchoolServiceRequestsDto,
  ReasonedSchoolServiceRequestDto,
  ResolveSchoolServiceRequestDto,
  TriageSchoolServiceRequestDto,
} from './dto/service-request.dto';
import { ServiceRequestsService } from './service-requests.service';

@ApiTags('service-requests')
@Controller('service-requests')
@UseGuards(JwtAuthGuard, TenantActiveGuard, RolesPermissionsGuard)
export class ServiceRequestsController {
  constructor(private readonly service: ServiceRequestsService) {}

  @Get()
  @Permissions('service_requests:read')
  list(
    @Query() query: ListSchoolServiceRequestsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.listManagerRequests(query, auth);
  }

  @Get(':id')
  @Permissions('service_requests:read')
  detail(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.service.getManagerRequest(id, auth);
  }

  @Patch(':id/triage')
  @Permissions('service_requests:manage')
  triage(
    @Param('id') id: string,
    @Body() dto: TriageSchoolServiceRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.triageRequest(id, dto, auth);
  }

  @Post(':id/notes')
  @Permissions('service_requests:manage')
  addNote(
    @Param('id') id: string,
    @Body() dto: AddSchoolServiceRequestNoteDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.addManagerNote(id, dto, auth);
  }

  @Post(':id/resolve')
  @Permissions('service_requests:manage')
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveSchoolServiceRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.resolveRequest(id, dto, auth);
  }

  @Post(':id/escalate')
  @Permissions('service_requests:manage')
  escalate(
    @Param('id') id: string,
    @Body() dto: ReasonedSchoolServiceRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.escalateRequest(id, dto, auth);
  }

  @Get(':id/attachments/:attachmentId')
  @Permissions('service_requests:read')
  async downloadAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    const file = await this.service.downloadAttachment(id, attachmentId, auth);
    return new StreamableFile(file.content, {
      type: file.mimeType,
      disposition: `attachment; filename="${safeFileName(file.fileName)}"`,
      length: file.sizeBytes,
    });
  }
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}
