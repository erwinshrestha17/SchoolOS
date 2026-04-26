import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ReadMessageDto } from './dto/read-message.dto';
import { MessagingService } from './messaging.service';

@Controller('messaging')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('conversations')
  @Permissions('messaging:read')
  listConversations(@CurrentAuth() auth: AuthContext) {
    return this.messagingService.listConversations(auth);
  }

  @Post('conversations')
  @Permissions('messaging:create')
  createConversation(
    @Body() dto: CreateConversationDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.messagingService.createConversation(dto, auth);
  }

  @Get('messages')
  @Permissions('messaging:read')
  listMessages(@CurrentAuth() auth: AuthContext) {
    return this.messagingService.listMessages(auth);
  }

  @Post('messages')
  @Permissions('messaging:create')
  createMessage(
    @Body() dto: CreateMessageDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.messagingService.createMessage(dto, auth);
  }

  @Get('read-receipts')
  @Permissions('messaging:read')
  listReadReceipts(@CurrentAuth() auth: AuthContext) {
    return this.messagingService.listReadReceipts(auth);
  }

  @Post('read-receipts')
  @Permissions('messaging:create')
  markRead(@Body() dto: ReadMessageDto, @CurrentAuth() auth: AuthContext) {
    return this.messagingService.markRead(dto, auth);
  }
}
