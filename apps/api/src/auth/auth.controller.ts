import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AUTH_RATE_LIMIT, AUTH_RATE_TTL_MS } from './auth.constants';
import { CurrentAuth } from './decorators/current-auth.decorator';
import { AllowSupportOverrideRead } from './decorators/allow-support-override-read.decorator';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth-request.interface';
import type { AuthContext } from './auth.types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmMfaSetupDto } from './dto/confirm-mfa-setup.dto';
import { ConfirmPasswordRecoveryDto } from './dto/confirm-password-recovery.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { RequestOtpLoginDto } from './dto/request-otp-login.dto';
import { RequestPasswordRecoveryDto } from './dto/request-password-recovery.dto';
import { RevokeOtherSessionsDto } from './dto/revoke-other-sessions.dto';
import { VerifyOtpLoginDto } from './dto/verify-otp-login.dto';
import { VerifyPasswordDto } from './dto/verify-password.dto';
import { SkipMustChangePassword } from './decorators/skip-must-change-password.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({
    default: {
      limit: AUTH_RATE_LIMIT,
      ttl: AUTH_RATE_TTL_MS,
    },
  })
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.login(dto, response, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId: request.requestId,
    });
  }

  @Post('otp/request-login')
  @Throttle({
    default: {
      limit: AUTH_RATE_LIMIT,
      ttl: AUTH_RATE_TTL_MS,
    },
  })
  requestOtpLogin(@Body() dto: RequestOtpLoginDto) {
    return this.authService.requestOtpLogin(dto);
  }

  @Post('otp/verify')
  @Throttle({
    default: {
      limit: AUTH_RATE_LIMIT,
      ttl: AUTH_RATE_TTL_MS,
    },
  })
  verifyOtpLogin(
    @Body() dto: VerifyOtpLoginDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.verifyOtpLogin(dto, response, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('password-recovery/request')
  @Throttle({
    default: {
      limit: AUTH_RATE_LIMIT,
      ttl: AUTH_RATE_TTL_MS,
    },
  })
  requestPasswordRecovery(@Body() dto: RequestPasswordRecoveryDto) {
    return this.authService.requestPasswordRecovery(dto);
  }

  @Post('forgot-password')
  @Throttle({
    default: {
      limit: AUTH_RATE_LIMIT,
      ttl: AUTH_RATE_TTL_MS,
    },
  })
  forgotPassword(@Body() dto: RequestPasswordRecoveryDto) {
    return this.authService.requestPasswordRecovery(dto);
  }

  @Post('password-recovery/confirm')
  @Throttle({
    default: {
      limit: AUTH_RATE_LIMIT,
      ttl: AUTH_RATE_TTL_MS,
    },
  })
  confirmPasswordRecovery(@Body() dto: ConfirmPasswordRecoveryDto) {
    return this.authService.confirmPasswordRecovery(dto);
  }

  @Post('reset-password')
  @Throttle({
    default: {
      limit: AUTH_RATE_LIMIT,
      ttl: AUTH_RATE_TTL_MS,
    },
  })
  resetPassword(@Body() dto: ConfirmPasswordRecoveryDto) {
    return this.authService.confirmPasswordRecovery(dto);
  }

  @Post('refresh')
  @Throttle({
    default: {
      limit: AUTH_RATE_LIMIT,
      ttl: AUTH_RATE_TTL_MS,
    },
  })
  refresh(
    @Body() dto: RefreshSessionDto,
    @Res({ passthrough: true }) response: Response,
    @Headers('cookie') cookieHeader?: string,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.authService.refresh(dto, response, cookieHeader, {
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'],
      requestId: request?.requestId,
    });
  }

  @Post('logout')
  @SkipMustChangePassword()
  logout(
    @Body() dto: RefreshSessionDto,
    @Res({ passthrough: true }) response: Response,
    @Headers('cookie') cookieHeader?: string,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.authService.logout(dto, response, cookieHeader, {
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'],
      requestId: request?.requestId,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @SkipMustChangePassword()
  @AllowSupportOverrideRead(
    'SCHOOL_PROFILE',
    'STUDENT_RECORDS',
    'ATTENDANCE',
    'ACADEMICS',
    'HOMEWORK_TIMETABLE',
    'NOTICES_DELIVERY',
  )
  me(@CurrentAuth() auth: AuthContext) {
    return this.authService.getProfile(auth);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  listSessions(@CurrentAuth() auth: AuthContext) {
    return this.authService.listSessions(auth);
  }

  @Post('sessions/revoke-others')
  @UseGuards(JwtAuthGuard)
  revokeOtherSessions(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: RevokeOtherSessionsDto,
    @Headers('cookie') cookieHeader?: string,
  ) {
    return this.authService.revokeOtherSessions(auth, dto, cookieHeader);
  }

  @Post('sessions/:sessionId/revoke')
  @UseGuards(JwtAuthGuard)
  revokeSession(
    @Param('sessionId') sessionId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.authService.revokeSession(sessionId, auth);
  }

  @Post('verify-password')
  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: {
      limit: AUTH_RATE_LIMIT,
      ttl: AUTH_RATE_TTL_MS,
    },
  })
  verifyPassword(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: VerifyPasswordDto,
  ) {
    return this.authService.verifyPassword(auth, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @SkipMustChangePassword()
  @Throttle({
    default: {
      limit: AUTH_RATE_LIMIT,
      ttl: AUTH_RATE_TTL_MS,
    },
  })
  changePassword(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
    @Headers('cookie') cookieHeader?: string,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.authService.changePassword(auth, dto, response, cookieHeader, {
      ipAddress: request?.ip,
      userAgent: request?.headers['user-agent'],
      requestId: request?.requestId,
    });
  }

  @Post('mfa/setup/request')
  @UseGuards(JwtAuthGuard)
  requestMfaSetup(@CurrentAuth() auth: AuthContext) {
    return this.authService.requestMfaSetup(auth);
  }

  @Post('mfa/setup/confirm')
  @UseGuards(JwtAuthGuard)
  confirmMfaSetup(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: ConfirmMfaSetupDto,
  ) {
    return this.authService.confirmMfaSetup(auth, dto);
  }
}
