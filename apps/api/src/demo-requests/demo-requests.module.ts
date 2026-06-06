import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DemoRequestsController } from './demo-requests.controller';
import { DemoRequestsPlatformController } from './demo-requests-platform.controller';
import { DemoRequestsService } from './demo-requests.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [DemoRequestsController, DemoRequestsPlatformController],
  providers: [DemoRequestsService],
  exports: [DemoRequestsService],
})
export class DemoRequestsModule {}
