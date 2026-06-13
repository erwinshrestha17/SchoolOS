import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { RedisModule } from '../redis/redis.module';
import { TransportController } from './transport.controller';
import { TransportHardeningService } from './transport-hardening.service';
import { TransportM8bService } from './transport-m8b.service';
import { TransportService } from './transport.service';

@Module({
  imports: [AuthModule, AuditModule, CommunicationsModule, RedisModule],
  controllers: [TransportController],
  providers: [TransportService, TransportHardeningService, TransportM8bService],
  exports: [TransportService, TransportHardeningService, TransportM8bService],
})
export class TransportModule {}
