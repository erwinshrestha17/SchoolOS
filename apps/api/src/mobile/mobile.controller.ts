import {
  Body,
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
import { ParentNotificationQueryDto } from './dto/parent-notification-query.dto';
import { InitiateParentPaymentDto } from './dto/initiate-parent-payment.dto';
import {
  ParentSandboxCanteenTopUpDto,
  ParentSandboxFeePaymentDto,
} from './dto/parent-sandbox-payment.dto';
import { MobileParentConsentDecisionDto } from './dto/mobile-parent-consent.dto';
import {
  MobileParentAttendanceCorrectionCancelDto,
  MobileParentAttendanceCorrectionDto,
} from './dto/mobile-parent-attendance-correction.dto';
import { MobileParentStudentLeaveRequestDto } from './dto/mobile-parent-student-leave.dto';
import {
  CreateSchoolServiceRequestDto,
  ReasonedSchoolServiceRequestDto,
  UploadSchoolServiceRequestAttachmentDto,
} from '../service-requests/dto/service-request.dto';
import { LearningImprovementService } from '../learning-improvement/learning-improvement.service';

@Controller('mobile')
@UseGuards(JwtAuthGuard, EntitlementGuard)
@Entitlement(FEATURE_KEYS.MOBILE_PARENT_BASIC)
export class MobileController {
  constructor(
    private readonly mobileService: MobileService,
    private readonly learningImprovementService: LearningImprovementService,
  ) {}

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

  @Get('me/action-centre')
  @RequiredModule('students')
  getParentActionCentre(
    @CurrentAuth() auth: AuthContext,
    @Query('studentId') studentId?: string,
  ) {
    return this.mobileService.getParentActionCentre(auth, studentId);
  }

  @Get('students/:id/weekly-progress')
  @RequiredModule('students')
  getStudentWeeklyProgress(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentWeeklyProgress(studentId, auth);
  }

  @Get('students/:id/learning-summary')
  @RequiredModule('learning')
  getStudentLearningSummary(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.learningImprovementService.getParentLearningSummary(
      studentId,
      auth,
    );
  }

  @Get('me/notifications')
  listNotifications(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ParentNotificationQueryDto,
  ) {
    return this.mobileService.listNotifications(auth, query);
  }

  @Get('me/notifications/unread-count')
  getNotificationUnreadCount(@CurrentAuth() auth: AuthContext) {
    return this.mobileService.getNotificationUnreadCount(auth);
  }

  @Post('me/notifications/mark-all-read')
  markAllNotificationsRead(@CurrentAuth() auth: AuthContext) {
    return this.mobileService.markAllNotificationsRead(auth);
  }

  @Get('me/notifications/:id/attachment')
  async getNotificationAttachment(
    @Param('id') notificationId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    const file = await this.mobileService.getNotificationAttachment(
      notificationId,
      auth,
    );

    return new StreamableFile(file.content, {
      type: file.mimeType,
      disposition: `attachment; filename="${safePdfFileName(file.fileName)}"`,
    });
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

  @Get('students/:id/documents/:documentId/download-url')
  @RequiredModule('students')
  getStudentDocumentDownloadUrl(
    @Param('id') studentId: string,
    @Param('documentId') documentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentDocumentDownloadUrl(
      studentId,
      documentId,
      auth,
    );
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

  @Get('students/:id/attendance-corrections')
  @RequiredModule('attendance')
  listStudentAttendanceCorrections(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.listStudentAttendanceCorrections(studentId, auth);
  }

  @Post('students/:id/attendance-corrections')
  @RequiredModule('attendance')
  createStudentAttendanceCorrection(
    @Param('id') studentId: string,
    @Body() dto: MobileParentAttendanceCorrectionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.createStudentAttendanceCorrection(
      studentId,
      dto,
      auth,
    );
  }

  @Post('students/:id/attendance-corrections/:requestId/cancel')
  @RequiredModule('attendance')
  cancelStudentAttendanceCorrection(
    @Param('id') studentId: string,
    @Param('requestId') requestId: string,
    @Body() dto: MobileParentAttendanceCorrectionCancelDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.cancelStudentAttendanceCorrection(
      studentId,
      requestId,
      dto,
      auth,
    );
  }

  @Get('students/:id/leave-requests')
  @RequiredModule('attendance')
  listStudentLeaveRequests(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.listStudentLeaveRequests(studentId, auth);
  }

  @Post('students/:id/leave-requests')
  @RequiredModule('attendance')
  createStudentLeaveRequest(
    @Param('id') studentId: string,
    @Body() dto: MobileParentStudentLeaveRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.createStudentLeaveRequest(studentId, dto, auth);
  }

  @Get('students/:id/service-requests')
  @RequiredModule('students')
  listStudentServiceRequests(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.listStudentServiceRequests(studentId, auth);
  }

  @Post('students/:id/service-requests')
  @RequiredModule('students')
  createStudentServiceRequest(
    @Param('id') studentId: string,
    @Body() dto: CreateSchoolServiceRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.createStudentServiceRequest(studentId, dto, auth);
  }

  @Get('service-requests/:requestId')
  getStudentServiceRequest(
    @Param('requestId') requestId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentServiceRequest(requestId, auth);
  }

  @Post('service-requests/:requestId/cancel')
  cancelStudentServiceRequest(
    @Param('requestId') requestId: string,
    @Body() dto: ReasonedSchoolServiceRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.cancelStudentServiceRequest(requestId, dto, auth);
  }

  @Post('service-requests/:requestId/confirm-resolution')
  confirmStudentServiceRequestResolution(
    @Param('requestId') requestId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.confirmStudentServiceRequestResolution(
      requestId,
      auth,
    );
  }

  @Post('service-requests/:requestId/reopen')
  reopenStudentServiceRequest(
    @Param('requestId') requestId: string,
    @Body() dto: ReasonedSchoolServiceRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.reopenStudentServiceRequest(requestId, dto, auth);
  }

  @Post('service-requests/:requestId/attachments')
  uploadStudentServiceRequestAttachment(
    @Param('requestId') requestId: string,
    @Body() dto: UploadSchoolServiceRequestAttachmentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.uploadStudentServiceRequestAttachment(
      requestId,
      dto,
      auth,
    );
  }

  @Get('service-requests/:requestId/attachments/:attachmentId')
  async downloadStudentServiceRequestAttachment(
    @Param('requestId') requestId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    const file =
      await this.mobileService.downloadStudentServiceRequestAttachment(
        requestId,
        attachmentId,
        auth,
      );
    return new StreamableFile(file.content, {
      type: file.mimeType,
      disposition: `attachment; filename="${safePdfFileName(file.fileName)}"`,
      length: file.sizeBytes,
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

  @Get('students/:id/payment-gateway-readiness')
  @RequiredModule('fees')
  getStudentPaymentGatewayReadiness(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentPaymentGatewayReadiness(
      studentId,
      auth,
    );
  }

  @Post('students/:id/payment-intents')
  @RequiredModule('fees')
  initiateStudentPayment(
    @Param('id') studentId: string,
    @Body() dto: InitiateParentPaymentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.initiateStudentPayment(studentId, dto, auth);
  }

  @Post('students/:id/sandbox-payments/fees')
  @RequiredModule('fees')
  collectStudentSandboxFeePayment(
    @Param('id') studentId: string,
    @Body() dto: ParentSandboxFeePaymentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.collectStudentSandboxFeePayment(
      studentId,
      dto,
      auth,
    );
  }

  @Post('students/:id/sandbox-payments/canteen-top-up')
  @RequiredModule('canteen')
  topUpStudentCanteenSandbox(
    @Param('id') studentId: string,
    @Body() dto: ParentSandboxCanteenTopUpDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.topUpStudentCanteenSandbox(studentId, dto, auth);
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

  @Get('me/consents')
  getMyConsentStatus(@CurrentAuth() auth: AuthContext) {
    return this.mobileService.getMyConsentStatus(auth);
  }

  @Post('me/consents/decision')
  decideMyConsent(
    @Body() dto: MobileParentConsentDecisionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.decideMyConsent(dto, auth);
  }

  @Get('students/:id/activity-feed')
  @RequiredModule('activity')
  getStudentActivityFeed(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
    @Query('take') take?: string,
    @Query('category') category?: string,
    @Query('month') month?: string,
  ) {
    return this.mobileService.getStudentActivityFeed(
      studentId,
      auth,
      take,
      category,
      month,
    );
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

  @Get('students/:id/homework/:homeworkId/attachments')
  @RequiredModule('homework')
  getStudentHomeworkAttachments(
    @Param('id') studentId: string,
    @Param('homeworkId') homeworkId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentHomeworkAttachments(
      studentId,
      homeworkId,
      auth,
    );
  }

  @Get(
    'students/:id/homework/:homeworkId/attachments/:attachmentId/download-url',
  )
  @RequiredModule('homework')
  getStudentHomeworkAttachmentDownloadUrl(
    @Param('id') studentId: string,
    @Param('homeworkId') homeworkId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentHomeworkAttachmentDownloadUrl(
      studentId,
      homeworkId,
      attachmentId,
      auth,
    );
  }

  @Get('students/:id/timetable')
  @RequiredModule('homework')
  getStudentTimetable(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentTimetable(studentId, auth);
  }

  @Get('students/:id/exam-schedule')
  @RequiredModule('exams')
  getStudentExamSchedule(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentExamSchedule(studentId, auth);
  }

  @Get('students/:id/report-cards')
  @RequiredModule('exams')
  getStudentReportCards(
    @Param('id') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.mobileService.getStudentReportCards(studentId, auth);
  }

  @Get('students/:id/report-cards/:reportCardId.pdf')
  @RequiredModule('exams')
  async getStudentReportCardPdf(
    @Param('id') studentId: string,
    @Param('reportCardId') reportCardId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    const pdf = await this.mobileService.getStudentReportCardPdf(
      studentId,
      reportCardId,
      auth,
    );

    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${safePdfFileName(`report-card-${reportCardId}.pdf`)}"`,
    });
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
