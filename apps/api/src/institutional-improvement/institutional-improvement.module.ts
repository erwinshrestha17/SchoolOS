import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentsModule } from '../students/students.module';
import { InstitutionalImprovementController } from './institutional-improvement.controller';
import { InstitutionalImprovementService } from './institutional-improvement.service';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    AuditModule,
    FileRegistryModule,
    StudentsModule,
  ],
  controllers: [InstitutionalImprovementController],
  providers: [InstitutionalImprovementService],
  exports: [InstitutionalImprovementService],
})
export class InstitutionalImprovementModule {}
