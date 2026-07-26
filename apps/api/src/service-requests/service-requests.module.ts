import { Module } from '@nestjs/common';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';

@Module({
  imports: [PrismaModule, FileRegistryModule],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
