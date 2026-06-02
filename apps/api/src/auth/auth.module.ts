import { Global, Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { ConfigModule } from '../config/config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesPermissionsGuard } from './guards/roles-permissions.guard';
import { EntitlementGuard } from './guards/entitlement.guard';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { PlansModule } from '../plans/plans.module';
import { PlatformModule } from '../platform/platform.module';

@Global()
@Module({
  imports: [
    JwtModule.register({}),
    ConfigModule,
    AuditModule,
    NotificationsModule,
    PlansModule,
    forwardRef(() => PlatformModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    RolesPermissionsGuard,
    EntitlementGuard,
    ApiKeyAuthGuard,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    RolesPermissionsGuard,
    EntitlementGuard,
    ApiKeyAuthGuard,
    JwtModule,
  ],
})
export class AuthModule {}
