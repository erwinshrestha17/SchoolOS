import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CanteenController } from './canteen.controller';
import { CanteenService } from './canteen.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [CanteenController],
  providers: [CanteenService],
  exports: [CanteenService],
})
export class CanteenModule {}
