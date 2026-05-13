import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StudentQrService } from './student-qr.service';
import {
  ResolveStudentQrDto,
  RotateStudentQrDto,
  RevokeStudentQrDto,
} from './dto/student-qr.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { AuthContext } from '../auth/auth.types';
import { Response } from 'express';

@ApiTags('Student QR')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
@Controller('students')
export class StudentQrController {
  constructor(private readonly studentQrService: StudentQrService) {}

  @Post(':studentId/qr')
  @Permissions('students:qr:generate')
  @ApiOperation({ summary: 'Generate a new QR credential for a student' })
  async generateQr(
    @Param('studentId') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentQrService.generateQr(auth.tenantId, studentId, auth);
  }

  @Post(':studentId/qr/rotate')
  @Permissions('students:qr:rotate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a student QR credential' })
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
  @ApiOperation({ summary: 'Return QR SVG for ID card/profile' })
  async getQrImage(
    @Param('studentId') studentId: string,
    @Query('token') token: string,
    @Res() res: Response,
    @CurrentAuth() auth: AuthContext,
  ) {
    if (!token) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message:
          'Raw token is required to generate the QR image as it is not stored server-side.',
      });
    }

    const svg = await this.studentQrService.getQrImage(token);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  }
}
