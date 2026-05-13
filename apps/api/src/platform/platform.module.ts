import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformQueuesService } from './platform-queues.service';
import { PlatformReportExportsService } from './platform-report-exports.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UsageModule } from '../usage/usage.module';
import { ConfigModule } from '../config/config.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    UsageModule,
    ConfigModule,
    RedisModule,
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'finance' },
      { name: 'payroll' },
      { name: 'activity-media' },
      { name: 'homework' },
    ),
  ],
  controllers: [PlatformController],
  providers: [
    PlatformService,
    PlatformQueuesService,
    PlatformReportExportsService,
  ],
  exports: [
    PlatformService,
    PlatformQueuesService,
    PlatformReportExportsService,
  ],
})
export class PlatformModule {}
