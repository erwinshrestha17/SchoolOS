import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({
  imports: [AuthModule, CommunicationsModule, AuditModule],
  controllers: [MessagingController],
  providers: [MessagingService],
})
export class MessagingModule {}
