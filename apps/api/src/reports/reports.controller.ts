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
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import type { AuthContext } from '../auth/auth.types';
import { ReportExportDto } from './dto/report-export.dto';

@Controller('reports')
@UseGuards(RolesPermissionsGuard)
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

    if (result.format === 'json') {
      return res.json({
        success: true,
        message: 'Report exported successfully',
        data: result.content,
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
}
