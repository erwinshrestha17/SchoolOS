import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { CreateSectionDto } from './dto/create-section.dto';
import { SectionsService } from './sections.service';

@Controller('sections')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Get()
  @Permissions('sections:read')
  listSections(@CurrentAuth() auth: AuthContext) {
    return this.sectionsService.listSections(auth);
  }

  @Post()
  @Permissions('sections:create')
  createSection(
    @Body() dto: CreateSectionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.sectionsService.createSection(dto, auth);
  }
}
