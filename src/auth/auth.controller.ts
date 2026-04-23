import {
  Body,
  Controller,
  Headers,
  Post,
  Res,
  Req,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth-request.interface';
import { LoginDto } from './dto/login.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.login(dto, response, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('refresh')
  refresh(
    @Body() dto: RefreshSessionDto,
    @Res({ passthrough: true }) response: Response,
    @Headers('cookie') cookieHeader?: string,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.authService.refresh(dto, response, cookieHeader, {
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'],
    });
  }

  @Post('logout')
  logout(
    @Body() dto: RefreshSessionDto,
    @Res({ passthrough: true }) response: Response,
    @Headers('cookie') cookieHeader?: string,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.authService.logout(dto, response, cookieHeader, {
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'],
    });
  }
}
