import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import type { AuthContext } from '../auth/auth.types';
import { FEATURE_KEYS } from '@schoolos/core';
import { MobileService } from './mobile.service';
import { ParentAttendanceSummaryQueryDto } from './dto/parent-attendance-summary-query.dto';

@Controller('mobile')
@UseGuards(JwtAuthGuard, EntitlementGuard)
@Entitlement(FEATURE_KEYS.MOBILE_PARENT_BASIC)
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @Get('me/students')
  listMyStudents(@CurrentAuth() auth: AuthContext) {
    return this.mobileService.listMyStudents(auth);
  }

  @Get('me/dashboard')
  getDashboard(
    @CurrentAuth() auth: AuthContext,
    @Query('studentId') studentId?: string,
  ) {
    return this.mobileService.getDashboard(auth, studentId);
  }

  @Get('me/notifications')
  listNotifications(@CurrentAuth() auth: AuthContext) {
    return this.mobileService.listNotifications(auth);
  }

  @Post('me/notifications/:id/read')
  markNotificationRead(
    @Param('id') notificationId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.markNotificationRead(notificationId, auth);
  }

  @Get('students/:id/profile')
  getStudentProfile(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentProfile(studentId, auth);
  }

  @Get('students/:id/attendance-summary')
  getStudentAttendanceSummary(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
    @Query() query: ParentAttendanceSummaryQueryDto,
  ) {
    return this.mobileService.getStudentAttendanceSummary(studentId, auth, {
      month: query.month,
      year: query.year,
    });
  }

  @Get('students/:id/fees-summary')
  getStudentFeesSummary(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentFeesSummary(studentId, auth);
  }

  @Get('students/:id/receipts/:receiptNumber.pdf')
  async getStudentReceiptPdf(
    @Param('id') studentId: string,
    @Param('receiptNumber') receiptNumber: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    const pdf = await this.mobileService.getStudentReceiptPdf(
      studentId,
      receiptNumber,
      auth,
    );

    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${safePdfFileName(`${receiptNumber}.pdf`)}"`,
    });
  }

  @Get('students/:id/activity-feed')
  getStudentActivityFeed(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
    @Query('take') take?: string,
  ) {
    return this.mobileService.getStudentActivityFeed(studentId, auth, take);
  }

  @Get('students/:id/homework')
  getStudentHomework(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
    @Query('take') take?: string,
  ) {
    return this.mobileService.getStudentHomework(studentId, auth, take);
  }

  @Get('students/:id/timetable')
  getStudentTimetable(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentTimetable(studentId, auth);
  }

  @Get('students/:id/report-cards')
  getStudentReportCards(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentReportCards(studentId, auth);
  }

  @Get('students/:id/canteen')
  getStudentCanteen(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentCanteen(studentId, auth);
  }

  @Get('students/:id/library')
  getStudentLibrary(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentLibrary(studentId, auth);
  }

  @Get('students/:id/transport')
  getStudentTransport(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentTransport(studentId, auth);
  }
}

function safePdfFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}
