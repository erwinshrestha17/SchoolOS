import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { CreateClassDto } from './dto/create-class.dto';
import { ClassesService } from './classes.service';

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get()
  @Permissions('classes:read')
  listClasses(@CurrentAuth() auth: AuthContext) {
    return this.classesService.listClasses(auth);
  }

  @Post()
  @Permissions('classes:create')
  createClass(@Body() dto: CreateClassDto, @CurrentAuth() auth: AuthContext) {
    return this.classesService.createClass(dto, auth);
  }
}
