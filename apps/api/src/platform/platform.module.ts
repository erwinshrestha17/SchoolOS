import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { PlatformQueuesService } from './platform-queues.service';
import { PlatformReportExportsService } from './platform-report-exports.service';
import { PlatformApiKeysService } from './platform-api-keys.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UsageModule } from '../usage/usage.module';
import { ConfigModule } from '../config/config.module';
import { RedisModule } from '../redis/redis.module';
import { StorageModule } from '../storage/storage.module';

import { PlatformBillingLifecycleService } from './platform-billing-lifecycle.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    forwardRef(() => AuthModule),
    UsageModule,
    ConfigModule,
    RedisModule,
    StorageModule,
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'finance' },
      { name: 'payroll' },
      { name: 'activity-media' },
      { name: 'homework' },
      { name: 'reports' },
      { name: 'accounting-reports' },
      { name: 'accounting-bank-import' },
      { name: 'canteen-alerts' },
    ),
  ],
  controllers: [PlatformController],
  providers: [
    PlatformService,
    PlatformQueuesService,
    PlatformReportExportsService,
    PlatformApiKeysService,
    PlatformBillingLifecycleService,
  ],
  exports: [
    PlatformService,
    PlatformQueuesService,
    PlatformReportExportsService,
    PlatformApiKeysService,
  ],
})
export class PlatformModule {}
