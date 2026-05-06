import { StaffStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class StaffLifecycleDto {
  @IsEnum(StaffStatus)
  status!: StaffStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}
