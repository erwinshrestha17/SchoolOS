import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { ParentTeacherChatController } from './parent-teacher-chat.controller';
import { ParentTeacherChatService } from './parent-teacher-chat.service';

@Module({
  imports: [AuthModule, CommunicationsModule, AuditModule],
  controllers: [MessagingController, ParentTeacherChatController],
  providers: [MessagingService, ParentTeacherChatService],
})
export class MessagingModule {}
