import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AcademicYearsModule } from './academic-years/academic-years.module';
import { AdmissionsModule } from './admissions/admissions.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { StudentsModule } from './students/students.module';
import { SectionsModule } from './sections/sections.module';
import { ClassesModule } from './classes/classes.module';
import { GradesModule } from './grades/grades.module';
import { TenantsModule } from './tenants/tenants.module';
import { RedisModule } from './redis/redis.module';
import { ConfigModule } from './config/config.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { StaffModule } from './staff/staff.module';
import { AttendanceModule } from './attendance/attendance.module';
import { APP_RATE_LIMIT, APP_RATE_TTL_MS } from './auth/auth.constants';
import { FinanceModule } from './finance/finance.module';
import { CommunicationsModule } from './communications/communications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        limit: APP_RATE_LIMIT,
        ttl: APP_RATE_TTL_MS,
      },
    ]),
    PrismaModule,
    AuditModule,
    UsersModule,
    AuthModule,
    RolesModule,
    AcademicYearsModule,
    SectionsModule,
    StudentsModule,
    AdmissionsModule,
    StaffModule,
    ClassesModule,
    GradesModule,
    AttendanceModule,
    FinanceModule,
    CommunicationsModule,
    TenantsModule,
    RedisModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
