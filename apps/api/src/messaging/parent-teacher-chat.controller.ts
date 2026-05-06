import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import {
  CloseParentTeacherThreadDto,
  CreateChatAbuseReportDto,
  CreateParentTeacherMessageDto,
  CreateParentTeacherThreadDto,
  EscalateParentTeacherThreadDto,
  ListParentTeacherMessagesDto,
  ListParentTeacherThreadsDto,
  ResolveChatEscalationDto,
  ReviewChatAbuseReportDto,
  UpdateChatAvailabilityDto,
} from './dto/parent-teacher-chat.dto';
import { ParentTeacherChatService } from './parent-teacher-chat.service';

@Controller('messaging/parent-teacher')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class ParentTeacherChatController {
  constructor(private readonly service: ParentTeacherChatService) {}

  @Get('threads')
  @Permissions('messaging:read')
  listThreads(
    @Query() query: ListParentTeacherThreadsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.listThreads(query, auth);
  }

  @Get('threads/:threadId')
  @Permissions('messaging:read')
  getThread(
    @Param('threadId') threadId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.getThread(threadId, auth);
  }

  @Post('threads')
  @Permissions('messaging:create')
  createThread(
    @Body() dto: CreateParentTeacherThreadDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.createOrGetThread(dto, auth);
  }

  @Patch('threads/:threadId/close')
  @Permissions('messaging:manage')
  closeThread(
    @Param('threadId') threadId: string,
    @Body() dto: CloseParentTeacherThreadDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.closeThread(threadId, dto, auth);
  }

  @Patch('threads/:threadId/escalate')
  @Permissions('messaging:create')
  escalateThread(
    @Param('threadId') threadId: string,
    @Body() dto: EscalateParentTeacherThreadDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.escalateThread(threadId, dto, auth);
  }

  @Get('threads/:threadId/messages')
  @Permissions('messaging:read')
  listMessages(
    @Param('threadId') threadId: string,
    @Query() query: ListParentTeacherMessagesDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.listMessages(threadId, query, auth);
  }

  @Post('threads/:threadId/messages')
  @Permissions('messaging:create')
  sendMessage(
    @Param('threadId') threadId: string,
    @Body() dto: CreateParentTeacherMessageDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.sendMessage(threadId, dto, auth);
  }

  @Patch('messages/:messageId/read')
  @Permissions('messaging:create')
  markMessageRead(
    @Param('messageId') messageId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.markMessageRead(messageId, auth);
  }

  @Patch('threads/:threadId/read')
  @Permissions('messaging:create')
  markThreadRead(
    @Param('threadId') threadId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.markThreadRead(threadId, auth);
  }

  @Get('availability')
  @Permissions('messaging:read')
  listAvailability(@CurrentAuth() auth: AuthContext) {
    return this.service.listAvailability(auth);
  }

  @Put('availability')
  @Permissions('messaging:manage')
  updateAvailability(
    @Body() dto: UpdateChatAvailabilityDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.updateAvailability(dto, auth);
  }

  @Get('availability/status')
  @Permissions('messaging:read')
  getAvailabilityStatus(@CurrentAuth() auth: AuthContext) {
    return this.service.getAvailabilityStatus(auth);
  }

  @Post('threads/:threadId/abuse-report')
  @Permissions('messaging:create')
  createAbuseReport(
    @Param('threadId') threadId: string,
    @Body() dto: CreateChatAbuseReportDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.createAbuseReport(threadId, dto, auth);
  }

  @Get('abuse-reports')
  @Permissions('messaging:manage')
  listAbuseReports(@CurrentAuth() auth: AuthContext) {
    return this.service.listAbuseReports(auth);
  }

  @Patch('abuse-reports/:reportId/review')
  @Permissions('messaging:manage')
  reviewAbuseReport(
    @Param('reportId') reportId: string,
    @Body() dto: ReviewChatAbuseReportDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.reviewAbuseReport(reportId, dto, auth);
  }

  @Patch('escalations/:escalationId/resolve')
  @Permissions('messaging:manage')
  resolveEscalation(
    @Param('escalationId') escalationId: string,
    @Body() dto: ResolveChatEscalationDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.resolveEscalation(escalationId, dto, auth);
  }
}
