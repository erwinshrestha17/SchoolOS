import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { StudentsModule } from './students/students.module';
import { ClassesModule } from './classes/classes.module';
import { GradesModule } from './grades/grades.module';
import { TenantsModule } from './tenants/tenants.module';
import { RedisModule } from './redis/redis.module';
import { ConfigModule } from './config/config.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, RolesModule, StudentsModule, ClassesModule, GradesModule, TenantsModule, RedisModule, ConfigModule, NotificationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
