import { UserStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;

  /**
   * Required when deactivating a user who holds the School Configuration
   * Owner role. Recorded in the tenant audit trail.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
