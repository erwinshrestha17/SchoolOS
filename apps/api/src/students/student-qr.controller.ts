import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthContext } from '../auth/auth.types';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import {
  ResolveStudentQrDto,
  RotateStudentQrDto,
  RevokeStudentQrDto,
} from './dto/student-qr.dto';
import { StudentQrService } from './student-qr.service';

@ApiTags('Student QR')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.students')
@Controller('students')
export class StudentQrController {
  constructor(private readonly studentQrService: StudentQrService) {}

  @Get(':studentId/qr')
  @Permissions('students:qr:read')
  @ApiOperation({
    summary: 'Get safe student QR credential status and history',
  })
  async getQrStatus(
    @Param('studentId') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentQrService.getQrStatus(auth.tenantId, studentId);
  }

  @Get(':studentId/qr/scans')
  @Permissions('students:qr:read')
  @ApiOperation({ summary: 'Get QR scan audit log history for a student' })
  async getQrScanHistory(
    @Param('studentId') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentQrService.getQrScanHistory(
      auth.tenantId,
      studentId,
      auth,
    );
  }

  @Get(':studentId/qr/analytics')
  @Permissions('students:qr:read')
  @ApiOperation({ summary: 'Get operational QR scan analytics for a student' })
  async getQrAnalytics(
    @Param('studentId') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentQrService.getQrAnalytics(auth.tenantId, studentId, auth);
  }

  @Post(':studentId/qr')
  @Permissions('students:qr:generate')
  @ApiOperation({
    summary:
      'Generate a student QR credential. Returns a printable QR image only when a new credential is issued.',
  })
  async generateQr(
    @Param('studentId') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentQrService.generateQr(auth.tenantId, studentId, auth);
  }

  @Post(':studentId/qr/rotate')
  @Permissions('students:qr:rotate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Rotate a student QR credential and return a new printable QR image',
  })
  async rotateQr(
    @Param('studentId') studentId: string,
    @Body() dto: RotateStudentQrDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentQrService.rotateQr(
      auth.tenantId,
      studentId,
      auth,
      dto.reason,
    );
  }

  @Post(':studentId/qr/revoke')
  @Permissions('students:qr:revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a student QR credential' })
  async revokeQr(
    @Param('studentId') studentId: string,
    @Body() dto: RevokeStudentQrDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentQrService.revokeQr(
      auth.tenantId,
      studentId,
      auth,
      dto.reason,
    );
  }

  @Post('qr/resolve')
  @Permissions('students:qr:resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve a scanned QR token for a declared purpose',
  })
  async resolveQr(
    @Body() dto: ResolveStudentQrDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentQrService.resolveQr(
      auth.tenantId,
      dto.token,
      dto.purpose,
      auth,
    );
  }

  @Get(':studentId/qr-image')
  @Permissions('students:qr:read')
  @ApiOperation({
    summary: 'Explain why QR images are one-time printable and not re-readable',
  })
  async getQrImageMetadata(@Param('studentId') studentId: string) {
    return {
      studentId,
      qrImageAvailable: false,
      message:
        'Student QR raw tokens are never stored. Generate or rotate the credential to receive a one-time printable QR image.',
    };
  }
}
