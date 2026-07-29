import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

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

  // Fail fast at validation time; UsersService.createManagedUser still
  // enforces the full assertStrongPassword policy (common-password and
  // identity-hint checks) when the admin user is created.
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'adminPassword must include uppercase, lowercase, number, and symbol characters',
  })
  adminPassword!: string;
}
