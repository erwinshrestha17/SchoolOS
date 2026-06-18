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
import { RequiredModule } from '../auth/decorators/required-module.decorator';
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
  @RequiredModule('students')
  listMyStudents(@CurrentAuth() auth: AuthContext) {
    return this.mobileService.listMyStudents(auth);
  }

  @Get('me/dashboard')
  @RequiredModule('students')
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

  @Get('me/notifications/:id')
  getNotificationDetail(
    @Param('id') notificationId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getNotificationDetail(notificationId, auth);
  }

  @Post('me/notifications/:id/read')
  markNotificationRead(
    @Param('id') notificationId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.markNotificationRead(notificationId, auth);
  }

  @Get('students/:id/profile')
  @RequiredModule('students')
  getStudentProfile(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentProfile(studentId, auth);
  }

  @Get('students/:id/attendance-summary')
  @RequiredModule('attendance')
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
  @RequiredModule('fees')
  getStudentFeesSummary(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentFeesSummary(studentId, auth);
  }

  @Get('students/:id/receipts/:receiptNumber.pdf')
  @RequiredModule('fees')
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
  @RequiredModule('activity')
  getStudentActivityFeed(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
    @Query('take') take?: string,
  ) {
    return this.mobileService.getStudentActivityFeed(studentId, auth, take);
  }

  @Get('students/:id/homework')
  @RequiredModule('homework')
  getStudentHomework(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
    @Query('take') take?: string,
  ) {
    return this.mobileService.getStudentHomework(studentId, auth, take);
  }

  @Get('students/:id/timetable')
  @RequiredModule('homework')
  getStudentTimetable(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentTimetable(studentId, auth);
  }

  @Get('students/:id/report-cards')
  @RequiredModule('exams')
  getStudentReportCards(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentReportCards(studentId, auth);
  }

  @Get('students/:id/canteen')
  @RequiredModule('canteen')
  getStudentCanteen(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentCanteen(studentId, auth);
  }

  @Get('students/:id/library')
  @RequiredModule('library')
  getStudentLibrary(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentLibrary(studentId, auth);
  }

  @Get('students/:id/transport')
  @RequiredModule('transport')
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
