import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { StreamsService } from './streams.service';
import { StreamsController } from './streams.controller';

@Module({
  imports: [AuthModule, AuditModule],
  providers: [ClassesService, StreamsService],
  controllers: [ClassesController, StreamsController],
  exports: [ClassesService, StreamsService],
})
export class ClassesModule {}
