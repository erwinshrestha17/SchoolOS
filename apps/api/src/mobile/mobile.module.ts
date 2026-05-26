import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [PrismaModule, AttendanceModule],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}
