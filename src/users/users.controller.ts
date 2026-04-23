import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('users:read')
  listUsers(@CurrentAuth() auth: AuthContext) {
    return this.usersService.listUsers(auth);
  }

  @Post()
  @Permissions('users:create')
  createUser(@Body() dto: CreateUserDto, @CurrentAuth() auth: AuthContext) {
    return this.usersService.createUser(dto, auth);
  }

  @Patch(':id/status')
  @Permissions('users:update_status')
  updateStatus(
    @Param('id') userId: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.usersService.updateStatus(userId, dto, auth);
  }

  @Post(':id/reset-password')
  @Permissions('users:reset_password')
  resetPassword(
    @Param('id') userId: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.usersService.resetPassword(userId, dto, auth);
  }
}
