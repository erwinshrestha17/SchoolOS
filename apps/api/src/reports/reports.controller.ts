import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import type { AuthContext } from '../auth/auth.types';
import { ReportExportDto } from './dto/report-export.dto';
import { Query } from '@nestjs/common';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @Permissions('reports:read')
  async listReports(@CurrentAuth() actor: AuthContext) {
    return this.reportsService.listReports(actor);
  }

  @Post(':reportKey/export')
  @Permissions('reports:export')
  async exportReport(
    @Param('reportKey') reportKey: string,
    @Body() request: ReportExportDto,
    @CurrentAuth() actor: AuthContext,
    @Res() res: Response,
  ) {
    const result = await this.reportsService.exportReport(
      reportKey,
      request,
      actor,
    );

    if (result.status === 'QUEUED') {
      return res.status(202).json({
        success: true,
        message: 'Report export queued',
        data: {
          jobId: result.jobId,
          status: result.status,
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (result.format === 'json') {
      return res.json({
        success: true,
        message: 'Report exported successfully',
        data: result.content ?? result.data,
        timestamp: new Date().toISOString(),
      });
    }

    if (
      !result.contentType ||
      !result.fileName ||
      result.content === undefined
    ) {
      return res.status(500).json({
        success: false,
        message: 'Report export did not produce a downloadable file',
        timestamp: new Date().toISOString(),
      });
    }

    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    // Buffer for CSV/PDF
    return res.send(result.content);
  }

  @Get('export-history')
  @Permissions('reports:read')
  async getExportHistory(
    @CurrentAuth() auth: AuthContext,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reportsService.getExportHistory(auth.tenantId, { page, limit });
  }

  @Get('export-history/:id/download')
  @Permissions('reports:read')
  async downloadExportHistory(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const snapshot = await this.reportsService.downloadExportSnapshot(id, auth);
    res.setHeader('Content-Type', snapshot.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${snapshot.fileName.replace(/"/g, '')}"`,
    );
    return res.send(snapshot.content);
  }
}
