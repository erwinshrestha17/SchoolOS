import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';

@Module({
  imports: [AuthModule, AuditModule],
  providers: [ClassesService],
  controllers: [ClassesController],
  exports: [ClassesService],
})
export class ClassesModule {}
