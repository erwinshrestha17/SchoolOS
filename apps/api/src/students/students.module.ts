import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';

@Module({
  imports: [AuthModule, UsersModule, AuditModule],
  providers: [StudentsService],
  controllers: [StudentsController],
  exports: [StudentsService],
})
export class StudentsModule {}
