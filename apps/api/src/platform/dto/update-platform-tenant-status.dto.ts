import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePlatformTenantStatusDto {
  @IsBoolean()
  isActive!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(5)
  reason?: string;
}
