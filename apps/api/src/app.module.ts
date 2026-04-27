import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AcademicYearsModule } from './academic-years/academic-years.module';
import { ActivityFeedModule } from './activity-feed/activity-feed.module';
import { AccountingModule } from './accounting/accounting.module';
import { AdmissionsModule } from './admissions/admissions.module';
import { AcademicsModule } from './academics/academics.module';
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
import { StorageModule } from './storage/storage.module';
import { StudentRecordsModule } from './student-records/student-records.module';
import { AttendanceModule } from './attendance/attendance.module';
import { APP_RATE_LIMIT, APP_RATE_TTL_MS } from './auth/auth.constants';
import { FinanceModule } from './finance/finance.module';
import { CommunicationsModule } from './communications/communications.module';
import { TimetableModule } from './timetable/timetable.module';
import { PayrollModule } from './payroll/payroll.module';
import { MessagingModule } from './messaging/messaging.module';
import { LibraryModule } from './library/library.module';
import { TransportModule } from './transport/transport.module';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from './config/config.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        limit: APP_RATE_LIMIT,
        ttl: APP_RATE_TTL_MS,
      },
    ]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.redisHost,
          port: configService.redisPort,
        },
      }),
    }),
    PrismaModule,
    StorageModule,
    AuditModule,
    UsersModule,
    AuthModule,
    RolesModule,
    AcademicYearsModule,
    SectionsModule,
    StudentsModule,
    StudentRecordsModule,
    AdmissionsModule,
    StaffModule,
    ClassesModule,
    GradesModule,
    AttendanceModule,
    FinanceModule,
    ActivityFeedModule,
    CommunicationsModule,
    AcademicsModule,
    TimetableModule,
    PayrollModule,
    AccountingModule,
    MessagingModule,
    LibraryModule,
    TransportModule,
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
