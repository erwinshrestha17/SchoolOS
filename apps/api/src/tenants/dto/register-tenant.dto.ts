import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class RegisterTenantDto {
  @IsString()
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(8)
  adminPassword!: string;
}
