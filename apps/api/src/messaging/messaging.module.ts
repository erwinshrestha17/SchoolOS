import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { MessagingController } from './messaging.controller';
import { MessagingHardeningController } from './messaging-hardening.controller';
import { MessagingHardeningService } from './messaging-hardening.service';
import { MessagingService } from './messaging.service';
import { ParentTeacherChatController } from './parent-teacher-chat.controller';
import { ParentTeacherChatService } from './parent-teacher-chat.service';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [AuthModule, CommunicationsModule, AuditModule, UsageModule],
  controllers: [
    MessagingController,
    ParentTeacherChatController,
    MessagingHardeningController,
  ],
  providers: [
    MessagingService,
    ParentTeacherChatService,
    MessagingHardeningService,
  ],
})
export class MessagingModule {}
