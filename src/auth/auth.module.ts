import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { ConfigModule } from '../config/config.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesPermissionsGuard } from './guards/roles-permissions.guard';

@Module({
  imports: [JwtModule.register({}), ConfigModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesPermissionsGuard],
  exports: [AuthService, JwtAuthGuard, RolesPermissionsGuard, JwtModule],
})
export class AuthModule {}
