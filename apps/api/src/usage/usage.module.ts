import { Module } from '@nestjs/common';
import { UsageService } from './usage.service';
import { UsageInterceptor } from './usage.interceptor';
import { PrismaModule } from '../prisma/prisma.module';
import { PlansModule } from '../plans/plans.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, PlansModule, RedisModule],

  providers: [UsageService, UsageInterceptor],
  exports: [UsageService, UsageInterceptor],
})
export class UsageModule {}
