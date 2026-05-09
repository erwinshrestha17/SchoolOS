import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { CanteenController } from './canteen.controller';
import { CanteenHardeningService } from './canteen-hardening.service';
import { CanteenService } from './canteen.service';

@Module({
  imports: [AuthModule, AuditModule, CommunicationsModule],
  controllers: [CanteenController],
  providers: [CanteenService, CanteenHardeningService],
  exports: [CanteenService, CanteenHardeningService],
})
export class CanteenModule {}
