import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from './communications.service';
import {
  CreateCommunicationTemplateDto,
  ListCommunicationTemplatesQueryDto,
  UpdateCommunicationTemplateDto,
} from './dto/communication-template.dto';

@Controller('communications')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.communications')
export class CommunicationsOperationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Get('summary')
  @Permissions('notices:read')
  getSummary(@CurrentAuth() auth: AuthContext) {
    return this.communicationsService.getCommunicationsSummary(auth);
  }

  @Get('provider-diagnostics')
  @Permissions('communications:read_deliveries')
  getProviderDiagnostics(@CurrentAuth() auth: AuthContext) {
    return this.communicationsService.getCommunicationProviderDiagnostics(auth);
  }

  @Get('templates')
  @Permissions('communications:manage_templates')
  listTemplates(
    @Query() query: ListCommunicationTemplatesQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.listCommunicationTemplates(query, auth);
  }

  @Post('templates')
  @Permissions('communications:manage_templates')
  createTemplate(
    @Body() dto: CreateCommunicationTemplateDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.createCommunicationTemplate(dto, auth);
  }

  @Patch('templates/:templateId')
  @Permissions('communications:manage_templates')
  updateTemplate(
    @Param('templateId') templateId: string,
    @Body() dto: UpdateCommunicationTemplateDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.updateCommunicationTemplate(
      templateId,
      dto,
      auth,
    );
  }

  @Post('templates/:templateId/publish')
  @Permissions('communications:manage_templates')
  publishTemplate(
    @Param('templateId') templateId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.publishCommunicationTemplate(
      templateId,
      auth,
    );
  }

  @Post('templates/:templateId/archive')
  @Permissions('communications:manage_templates')
  archiveTemplate(
    @Param('templateId') templateId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.archiveCommunicationTemplate(
      templateId,
      auth,
    );
  }
}
