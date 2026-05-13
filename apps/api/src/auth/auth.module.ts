import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { ConfigModule } from '../config/config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesPermissionsGuard } from './guards/roles-permissions.guard';
import { EntitlementGuard } from './guards/entitlement.guard';
import { PlansModule } from '../plans/plans.module';

@Global()
@Module({
  imports: [
    JwtModule.register({}),
    ConfigModule,
    AuditModule,
    NotificationsModule,
    PlansModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard],
  exports: [AuthService, JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard, JwtModule],
})
export class AuthModule {}
