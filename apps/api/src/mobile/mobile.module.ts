import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [PrismaModule, AttendanceModule, FinanceModule],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}
