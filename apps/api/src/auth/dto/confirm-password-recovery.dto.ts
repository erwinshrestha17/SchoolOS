import { IsEmail, IsString, MinLength } from 'class-validator';

export class ConfirmPasswordRecoveryDto {
  @IsString()
  tenantSlug!: string;

  @IsEmail()
  email!: string;

  @IsString()
  code!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;

  @IsString()
  @MinLength(8)
  confirmNewPassword!: string;
}
