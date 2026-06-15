import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import type { AuthContext } from '../auth/auth.types';
import { DocumentTemplateService } from './document-template.service';
import {
  CreateDocumentTemplateDto,
  GenerateDocumentDto,
} from './dto/document-template.dto';

@ApiTags('advanced-documents')
@Controller('advanced/document-templates')
@UseGuards(JwtAuthGuard, TenantActiveGuard, RolesPermissionsGuard)
export class DocumentTemplateController {
  constructor(private readonly service: DocumentTemplateService) {}

  @Get()
  @Permissions('advanced:documents:read')
  listTemplates(@CurrentAuth() auth: AuthContext) {
    return this.service.listTemplates(auth);
  }

  @Post()
  @Permissions('advanced:documents:manage')
  createTemplate(
    @Body() dto: CreateDocumentTemplateDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.createTemplate(dto, auth);
  }

  @Post(':id/generate')
  @Permissions('advanced:documents:manage')
  generate(
    @Param('id') id: string,
    @Body() dto: GenerateDocumentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.generateDocument(id, dto, auth);
  }

  @Post('generated/:id/print-history')
  @Permissions('advanced:documents:manage')
  recordPrint(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.recordPrint(id, body.reason, auth);
  }
}
